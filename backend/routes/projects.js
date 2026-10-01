// ============================================================
// routes/projects.js — CRUD Dự án xây dựng (Tier 1)
// Quyền: BGĐ/Admin create/edit/delete; Manager/Employee chỉ xem
// ============================================================
const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');

const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getVisibleProjects, canEditProject, logHistory,
  serializeProject, serializePhase, serializeBundle, getUserBrief,
} = require('./_helpers');

const router = express.Router();
router.use(requireAuth);

// ============================================================
// GET /api/projects — Danh sách dự án (theo quyền của user)
// ============================================================
router.get('/', (req, res) => {
  const projects = getVisibleProjects(req.user);
  res.json(projects.map(serializeProject));
});

// ============================================================
// GET /api/projects/:id — Chi tiết 1 dự án (kèm phases + bundles)
// ============================================================
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  // Check quyền xem
  const all = getVisibleProjects(req.user);
  if (!all.find((x) => x.id === p.id)) {
    return res.status(403).json({ error: 'Không có quyền xem dự án này' });
  }

  const phases = db.prepare(`
    SELECT * FROM project_phases WHERE project_id = ? ORDER BY sequence
  `).all(p.id).map(serializePhase);

  // Lấy bundles kèm tasks count
  const bundles = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM tasks WHERE bundle_id = b.id) AS task_count,
      (SELECT COUNT(*) FROM tasks WHERE bundle_id = b.id AND status = 'completed') AS done_count
    FROM assignment_bundles b
    WHERE b.project_id = ?
    ORDER BY b.created_at
  `).all(p.id).map((b) => {
    const ser = serializeBundle(b);
    ser.taskCount = b.task_count || 0;
    ser.doneCount = b.done_count || 0;
    return ser;
  });

  // Lấy tasks độc lập (không thuộc bundle, project_id = p.id)
  const standaloneTasks = db.prepare(`
    SELECT * FROM tasks WHERE project_id = ? AND bundle_id IS NULL
    ORDER BY created_at
  `).all(p.id);

  res.json({
    ...serializeProject(p),
    phases,
    bundles,
    standaloneTasksCount: standaloneTasks.length,
  });
});

// ============================================================
// POST /api/projects — Tạo dự án mới (BGĐ/Admin)
// ============================================================
router.post('/', requireRole('admin', 'director'), (req, res) => {
  const {
    code, name, description, address, projectManagerId,
    targetStart, targetEnd, budget,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Tên dự án là bắt buộc' });
  if (!code?.trim()) return res.status(400).json({ error: 'Mã dự án là bắt buộc' });

  // Check code unique
  const dup = db.prepare('SELECT id FROM construction_projects WHERE code = ?').get(code.trim());
  if (dup) return res.status(409).json({ error: `Mã dự án "${code}" đã tồn tại` });

  // Check manager tồn tại + active
  if (projectManagerId) {
    const m = db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(projectManagerId);
    if (!m) return res.status(400).json({ error: 'BGĐ dự án không tồn tại hoặc đã bị khóa' });
  }

  // Validate ngày
  if (targetStart && targetEnd && new Date(targetEnd) < new Date(targetStart)) {
    return res.status(400).json({ error: 'Ngày kết thúc phải >= ngày bắt đầu' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO construction_projects (
      id, code, name, description, address, project_manager_id,
      target_start, target_end, status, budget, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    code.trim(),
    name.trim(),
    description?.trim() || '',
    address?.trim() || '',
    projectManagerId || req.user.id, // mặc định = BGĐ tạo
    targetStart || '',
    targetEnd || '',
    'planning',
    budget ?? null,
    req.user.fullname,
    now, now,
  );

  logHistory('project', id, `Tạo dự án "${name.trim()}"`, req.user);

  const created = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(id);
  res.status(201).json(serializeProject(created));
});

// ============================================================
// PUT /api/projects/:id — Cập nhật dự án (BGĐ/Admin)
// ============================================================
router.put('/:id', requireRole('admin', 'director'), (req, res) => {
  const p = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const {
    code, name, description, address, projectManagerId,
    targetStart, targetEnd, actualEnd, status, budget,
  } = req.body;

  // Check code unique nếu đổi
  if (code && code.trim() !== p.code) {
    const dup = db.prepare('SELECT id FROM construction_projects WHERE code = ? AND id != ?').get(code.trim(), p.id);
    if (dup) return res.status(409).json({ error: `Mã dự án "${code}" đã tồn tại` });
  }

  // Check manager
  if (projectManagerId) {
    const m = db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(projectManagerId);
    if (!m) return res.status(400).json({ error: 'BGĐ dự án không tồn tại hoặc đã bị khóa' });
  }

  const updates = [];
  const params = [];
  const setIf = (field, val) => { if (val !== undefined) { updates.push(`${field} = ?`); params.push(val); } };

  setIf('code', code?.trim());
  setIf('name', name?.trim());
  setIf('description', description?.trim());
  setIf('address', address?.trim());
  setIf('project_manager_id', projectManagerId);
  setIf('target_start', targetStart);
  setIf('target_end', targetEnd);
  setIf('actual_end', actualEnd);
  setIf('status', status);
  setIf('budget', budget);
  updates.push('updated_at = ?'); params.push(new Date().toISOString());
  params.push(req.params.id);

  if (updates.length === 1) {
    return res.status(400).json({ error: 'Không có gì để cập nhật' });
  }

  db.prepare(`UPDATE construction_projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logHistory('project', p.id, `Cập nhật dự án`, req.user);

  const updated = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(p.id);
  res.json(serializeProject(updated));
});

// ============================================================
// POST /api/projects/:id/close — Đóng dự án (BGĐ/Admin)
// ============================================================
router.post('/:id/close', requireRole('admin', 'director'), (req, res) => {
  const p = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE construction_projects SET status = 'completed', actual_end = ?, updated_at = ? WHERE id = ?
  `).run(now.slice(0, 10), now, p.id);

  logHistory('project', p.id, `Đóng dự án`, req.user);

  const updated = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(p.id);
  res.json(serializeProject(updated));
});

// ============================================================
// GET /api/projects/:id/dashboard — Dashboard tổng hợp cho BGĐ
// ============================================================
router.get('/:id/dashboard', (req, res) => {
  const p = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const all = getVisibleProjects(req.user);
  if (!all.find((x) => x.id === p.id)) {
    return res.status(403).json({ error: 'Không có quyền xem dự án này' });
  }

  const today = new Date().toISOString().slice(0, 10);

  const phases = db.prepare(`
    SELECT * FROM project_phases WHERE project_id = ? ORDER BY sequence
  `).all(p.id).map((ph) => {
    const bundles = db.prepare(`
      SELECT * FROM assignment_bundles WHERE phase_id = ?
    `).all(ph.id);

    const total = bundles.length;
    const completed = bundles.filter((b) => b.status === 'closed' || b.status === 'completed').length;
    const overdue = bundles.filter((b) => b.due_date && b.due_date < today && b.status !== 'closed' && b.status !== 'completed').length;

    return {
      ...serializePhase(ph),
      bundles: bundles.map(serializeBundle),
      stats: {
        totalBundles: total,
        completedBundles: completed,
        overdueBundles: overdue,
      },
    };
  });

  // Summary
  const allBundles = db.prepare('SELECT * FROM assignment_bundles WHERE project_id = ?').all(p.id);
  const bottlenecks = allBundles
    .filter((b) => b.due_date && b.due_date < today && b.status !== 'closed' && b.status !== 'completed')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)
    .map((b) => ({
      bundleId: b.id,
      name: b.name,
      ownerId: b.owner_id,
      ownerName: getUserBrief(b.owner_id)?.fullname || '',
      dueDate: b.due_date,
      daysOverdue: Math.floor((new Date(today) - new Date(b.due_date)) / 86400000),
    }));

  const upcoming = allBundles
    .filter((b) => b.due_date && b.due_date >= today && b.status !== 'closed' && b.status !== 'completed')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)
    .map((b) => ({
      bundleId: b.id,
      name: b.name,
      dueDate: b.due_date,
      daysLeft: Math.floor((new Date(b.due_date) - new Date(today)) / 86400000),
    }));

  const overallProgress = allBundles.length
    ? Math.round(allBundles.reduce((s, b) => s + (b.progress || 0), 0) / allBundles.length)
    : 0;

  res.json({
    ...serializeProject(p),
    phases,
    summary: {
      overallProgress,
      bottlenecks,
      upcomingDeadlines: upcoming,
    },
  });
});

module.exports = router;
