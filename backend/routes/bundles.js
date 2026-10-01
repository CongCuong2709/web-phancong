// ============================================================
// routes/bundles.js — CRUD Hạng mục giao (Tier 3) + workflow đặc biệt
// - Reassign owner (đổi TP)        PATCH /api/bundles/:id/owner
// - Change department (auto-fill)  PATCH /api/bundles/:id/department
// - Reopen (Admin only)            POST  /api/bundles/:id/reopen
// - State transitions               POST  /api/bundles/:id/start|block|complete|close
// ============================================================
const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');

const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  findManagerOfDepartment, parseJsonArray, logHistory,
  serializeBundle, getVisibleProjects, canEditBundle,
  recalcBundleProgress,
} = require('./_helpers');

const router = express.Router();
router.use(requireAuth);

// ============================================================
// POST /api/projects/:projectId/bundles — Tạo bundle mới (BGĐ/Admin)
// Body: { name, phaseId?, department, startDate, dueDate, ... }
// → owner tự fill theo department
// ============================================================
router.post('/projects/:projectId/bundles', requireRole('admin', 'director'), (req, res) => {
  const p = db.prepare('SELECT id, code FROM construction_projects WHERE id = ?').get(req.params.projectId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const {
    name, description, phaseId, department,
    startDate, dueDate, priority, notes, tags,
    budget, collaboratingDepts,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Tên hạng mục là bắt buộc' });
  if (!department?.trim()) return res.status(400).json({ error: 'Phòng ban là bắt buộc' });

  // Auto-fill owner = TP của phòng
  const mgr = findManagerOfDepartment(department.trim());
  if (!mgr) {
    return res.status(400).json({
      error: `Phòng "${department}" chưa có Trưởng phòng active. Hãy tạo TP trước khi giao.`,
    });
  }

  // Nếu có phaseId thì check thuộc cùng project
  if (phaseId) {
    const ph = db.prepare('SELECT id, project_id FROM project_phases WHERE id = ?').get(phaseId);
    if (!ph || ph.project_id !== p.id) {
      return res.status(400).json({ error: 'Giai đoạn không thuộc dự án này' });
    }
  }

  if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
    return res.status(400).json({ error: 'Hạn xong phải >= ngày bắt đầu' });
  }

  // Auto-gen code
  const count = db.prepare('SELECT COUNT(*) as c FROM assignment_bundles').get().c;
  const code = `DA${String(count + 1).padStart(3, '0')}`;

  const id = uuidv4();
  const now = new Date().toISOString();
  const tagList = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  const collabList = Array.isArray(collaboratingDepts) ? collaboratingDepts.filter((d) => typeof d === 'string' && d.trim()) : [];

  db.prepare(`
    INSERT INTO assignment_bundles (
      id, code, name, description, project_id, phase_id, owner_id, department,
      start_date, due_date, status, progress, priority, notes, tags, budget,
      collaborating_depts, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', 0, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, code, name.trim(), description?.trim() || '',
    p.id, phaseId || null, mgr.id, department.trim(),
    startDate || '', dueDate || '',
    priority || 'medium', notes?.trim() || '',
    JSON.stringify(tagList),
    budget ?? null,
    JSON.stringify(collabList),
    req.user.fullname, now, now,
  );

  logHistory('bundle', id, `Tạo hạng mục giao "${name.trim()}" → ${department} (TP: ${mgr.fullname})`, req.user);

  const created = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(id);
  res.status(201).json(serializeBundle(created));
});

// ============================================================
// GET /api/bundles/:id — Chi tiết bundle
// ============================================================
router.get('/bundles/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });

  // Check quyền xem
  const all = getVisibleProjects(req.user);
  if (!all.find((p) => p.id === b.project_id)) {
    return res.status(403).json({ error: 'Không có quyền xem hạng mục này' });
  }

  // Lấy tasks
  const tasks = db.prepare(`
    SELECT t.*, u.fullname AS assignee_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.bundle_id = ?
    ORDER BY t.created_at
  `).all(b.id);

  res.json({
    ...serializeBundle(b),
    tasks: tasks.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      assigneeId: t.assignee_id,
      assigneeName: t.assignee_name,
      startDate: t.start_date,
      endDate: t.end_date,
      progress: t.progress,
      status: t.status,
      priority: t.priority,
      tags: parseJsonArray(t.tags),
    })),
  });
});

// ============================================================
// PUT /api/bundles/:id — Cập nhật bundle metadata
// BGĐ/Admin: mọi trường; Manager (của mình): status/progress/notes/block_reason
// ============================================================
router.put('/bundles/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });

  const isEditorFull = canEditBundle(req.user, b);
  const allowedPartial = req.user.role === 'manager'
    && (req.user.id === b.owner_id || /* TP của dept */ (req.user.departments || []).includes(b.department));

  if (!isEditorFull && !allowedPartial) {
    return res.status(403).json({ error: 'Không có quyền chỉnh sửa hạng mục này' });
  }

  const {
    name, description, phaseId, startDate, dueDate,
    priority, notes, tags, budget, collaboratingDepts,
    status, progress, blockReason,
  } = req.body;

  // Manager chỉ được update status/progress/notes/block_reason
  if (!isEditorFull && (name || description || phaseId !== undefined || startDate !== undefined || dueDate !== undefined || priority || tags || budget !== undefined || collaboratingDepts !== undefined)) {
    return res.status(403).json({ error: 'Bạn chỉ có thể cập nhật trạng thái/tiến độ/ghi chú/lý do tạm dừng' });
  }

  // Nếu là closed → không ai được edit (chỉ admin reopen)
  if (b.status === 'closed') {
    return res.status(403).json({ error: 'Hạng mục đã đóng — không thể chỉnh sửa' });
  }

  const updates = [];
  const params = [];
  const setIf = (field, val) => { if (val !== undefined) { updates.push(`${field} = ?`); params.push(val); } };

  setIf('name', name?.trim());
  setIf('description', description?.trim());
  setIf('phase_id', phaseId);
  setIf('start_date', startDate);
  setIf('due_date', dueDate);
  setIf('priority', priority);
  setIf('notes', notes?.trim());
  if (tags !== undefined) {
    setIf('tags', JSON.stringify(tags.filter((t) => typeof t === 'string' && t.trim())));
  }
  setIf('budget', budget);
  if (collaboratingDepts !== undefined) {
    setIf('collaborating_depts', JSON.stringify(collaboratingDepts.filter((d) => typeof d === 'string' && d.trim())));
  }
  setIf('status', status);
  setIf('progress', progress);
  setIf('block_reason', blockReason);
  updates.push('updated_at = ?'); params.push(new Date().toISOString());
  params.push(b.id);

  db.prepare(`UPDATE assignment_bundles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logHistory('bundle', b.id, `Cập nhật hạng mục giao`, req.user);

  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json(serializeBundle(updated));
});

// ============================================================
// PATCH /api/bundles/:id/owner — Đổi Trưởng phòng phụ trách (BGĐ/Admin)
// Body: { ownerId }
// → Ghi history. Task assignee không đổi.
// ============================================================
router.patch('/bundles/:id/owner', requireRole('admin', 'director'), (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });

  const { ownerId } = req.body;
  if (!ownerId) return res.status(400).json({ error: 'Thiếu ownerId' });

  const newOwner = db.prepare(`
    SELECT id, fullname, role FROM users WHERE id = ? AND active = 1
  `).get(ownerId);
  if (!newOwner) return res.status(400).json({ error: 'Trưởng phòng không tồn tại hoặc đã bị khóa' });
  if (newOwner.role !== 'manager') {
    return res.status(400).json({ error: 'Người nhận phải là Trưởng phòng (role = manager)' });
  }

  // Kiểm tra: owner mới có thuộc department của bundle không?
  const ownerDepts = db.prepare(`
    SELECT department FROM user_departments WHERE user_id = ?
  `).all(ownerId).map((r) => r.department);
  if (!ownerDepts.includes(b.department)) {
    return res.status(400).json({
      error: `Trưởng phòng ${newOwner.fullname} không thuộc phòng "${b.department}". ` +
             `Hãy dùng API đổi phòng để tự động cập nhật owner.`,
    });
  }

  if (ownerId === b.owner_id) {
    return res.status(400).json({ error: 'Owner mới trùng với owner hiện tại' });
  }

  const oldOwner = db.prepare('SELECT fullname FROM users WHERE id = ?').get(b.owner_id);
  db.prepare('UPDATE assignment_bundles SET owner_id = ?, updated_at = ? WHERE id = ?')
    .run(ownerId, new Date().toISOString(), b.id);

  logHistory('bundle', b.id,
    `Đổi owner từ "${oldOwner?.fullname}" → "${newOwner.fullname}"`,
    req.user);

  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json({
    ...serializeBundle(updated),
    prevOwnerId: b.owner_id,
  });
});

// ============================================================
// PATCH /api/bundles/:id/department — Đổi phòng ban (BGĐ/Admin)
// → Auto-fill owner theo phòng mới. Trả về confirm required flag nếu frontend cần.
// ============================================================
router.patch('/bundles/:id/department', requireRole('admin', 'director'), (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });

  const { department } = req.body;
  if (!department?.trim()) return res.status(400).json({ error: 'Thiếu department' });
  if (department === b.department) {
    return res.status(400).json({ error: 'Phòng mới trùng với phòng hiện tại' });
  }

  const newOwner = findManagerOfDepartment(department.trim());
  if (!newOwner) {
    return res.status(400).json({
      error: `Phòng "${department}" chưa có Trưởng phòng active.`,
    });
  }

  const oldOwner = db.prepare('SELECT fullname FROM users WHERE id = ?').get(b.owner_id);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE assignment_bundles SET department = ?, owner_id = ?, updated_at = ? WHERE id = ?
  `).run(department.trim(), newOwner.id, now, b.id);

  logHistory('bundle', b.id,
    `Đổi phòng từ "${b.department}" → "${department}" (owner: ${oldOwner?.fullname || '?'} → ${newOwner.fullname})`,
    req.user);

  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json({
    ...serializeBundle(updated),
    prevDepartment: b.department,
    prevOwnerId: b.owner_id,
  });
});

// ============================================================
// POST /api/bundles/:id/start — TP: assigned → in_progress
// ============================================================
router.post('/bundles/:id/start', (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });
  if (!canEditBundle(req.user, b)) return res.status(403).json({ error: 'Không có quyền' });
  if (b.status !== 'assigned') return res.status(400).json({ error: `Chỉ có thể bắt đầu từ trạng thái "assigned" (hiện tại: ${b.status})` });

  db.prepare(`UPDATE assignment_bundles SET status = 'in_progress', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), b.id);
  logHistory('bundle', b.id, 'Bắt đầu triển khai', req.user);
  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json(serializeBundle(updated));
});

// ============================================================
// POST /api/bundles/:id/block — TP: in_progress → blocked
// Body: { reason }
// ============================================================
router.post('/bundles/:id/block', (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });
  if (!canEditBundle(req.user, b)) return res.status(403).json({ error: 'Không có quyền' });
  if (b.status !== 'in_progress') return res.status(400).json({ error: `Chỉ có thể tạm dừng từ "in_progress" (hiện tại: ${b.status})` });

  const reason = (req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'Vui lòng nhập lý do tạm dừng' });

  db.prepare(`UPDATE assignment_bundles SET status = 'blocked', block_reason = ?, updated_at = ? WHERE id = ?`)
    .run(reason, new Date().toISOString(), b.id);
  logHistory('bundle', b.id, `Tạm dừng: ${reason}`, req.user);
  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json(serializeBundle(updated));
});

// ============================================================
// POST /api/bundles/:id/resume — TP: blocked → in_progress
// ============================================================
router.post('/bundles/:id/resume', (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });
  if (!canEditBundle(req.user, b)) return res.status(403).json({ error: 'Không có quyền' });
  if (b.status !== 'blocked') return res.status(400).json({ error: `Chỉ có thể tiếp tục từ "blocked" (hiện tại: ${b.status})` });

  db.prepare(`UPDATE assignment_bundles SET status = 'in_progress', block_reason = NULL, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), b.id);
  logHistory('bundle', b.id, 'Tiếp tục triển khai', req.user);
  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json(serializeBundle(updated));
});

// ============================================================
// POST /api/bundles/:id/complete — TP: in_progress → completed
// Yêu cầu: progress = 100
// ============================================================
router.post('/bundles/:id/complete', (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });
  if (!canEditBundle(req.user, b)) return res.status(403).json({ error: 'Không có quyền' });
  if (b.status !== 'in_progress') return res.status(400).json({ error: `Chỉ có thể hoàn thành từ "in_progress" (hiện tại: ${b.status})` });
  if (b.progress < 100) return res.status(400).json({ error: `Cần đạt 100% tiến độ trước khi hoàn thành (hiện tại: ${b.progress}%)` });

  db.prepare(`UPDATE assignment_bundles SET status = 'completed', progress = 100, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), b.id);
  logHistory('bundle', b.id, 'Hoàn thành hạng mục giao', req.user);
  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json(serializeBundle(updated));
});

// ============================================================
// POST /api/bundles/:id/close — BGĐ/Admin: completed → closed
// ============================================================
router.post('/bundles/:id/close', requireRole('admin', 'director'), (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });
  if (b.status !== 'completed') return res.status(400).json({ error: `Chỉ có thể đóng từ "completed" (hiện tại: ${b.status})` });

  db.prepare(`UPDATE assignment_bundles SET status = 'closed', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), b.id);
  logHistory('bundle', b.id, 'Đóng hạng mục (final)', req.user);
  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json(serializeBundle(updated));
});

// ============================================================
// POST /api/bundles/:id/reopen — Admin: closed → assigned
// Body: { reason }
// ============================================================
router.post('/bundles/:id/reopen', requireRole('admin'), (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });
  if (b.status !== 'closed') return res.status(400).json({ error: `Chỉ có thể reopen từ "closed" (hiện tại: ${b.status})` });

  const reason = (req.body?.reason || '').trim() || 'Admin reopen';
  db.prepare(`UPDATE assignment_bundles SET status = 'assigned', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), b.id);
  logHistory('bundle', b.id, `Reopen (Admin): ${reason}`, req.user);

  const updated = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(b.id);
  res.json(serializeBundle(updated));
});

// ============================================================
// DELETE /api/bundles/:id — Xóa bundle (BGĐ/Admin, chỉ khi chưa có task)
// ============================================================
router.delete('/bundles/:id', requireRole('admin', 'director'), (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });

  const taskCount = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE bundle_id = ?').get(b.id).c;
  if (taskCount > 0) {
    return res.status(400).json({
      error: `Không thể xóa: hạng mục có ${taskCount} đầu việc. Hãy xóa tasks trước.`,
    });
  }

  db.prepare('DELETE FROM assignment_bundles WHERE id = ?').run(b.id);
  logHistory('bundle', b.id, `Xóa hạng mục giao "${b.name}"`, req.user);
  res.json({ message: 'Đã xóa' });
});

// ============================================================
// POST /api/bundles/:id/tasks — TP: Tạo task mới trong bundle
// (Frontend có thể gọi POST /api/projects/:id/tasks cho task độc lập)
// ============================================================
router.post('/bundles/:id/tasks', (req, res) => {
  const b = db.prepare('SELECT * FROM assignment_bundles WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Không tìm thấy hạng mục giao' });
  if (!canEditBundle(req.user, b)) return res.status(403).json({ error: 'Không có quyền tạo task trong bundle này' });
  if (b.status === 'closed') return res.status(403).json({ error: 'Hạng mục đã đóng — không thể thêm task' });

  const {
    name, description, assigneeId,
    startDate, endDate, priority, notes, tags, progress, status,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Tên đầu việc là bắt buộc' });
  if (!assigneeId) return res.status(400).json({ error: 'Phải chọn người thực hiện' });

  // Check assignee thuộc bundle.department HOẶC là chính owner
  const asg = db.prepare('SELECT id, role, department FROM users WHERE id = ? AND active = 1').get(assigneeId);
  if (!asg) return res.status(400).json({ error: 'Người thực hiện không tồn tại' });

  const asgDepts = db.prepare('SELECT department FROM user_departments WHERE user_id = ?').all(assigneeId).map((r) => r.department);
  const ownerIsAsg = asg.id === b.owner_id;
  const asgInDept = asgDepts.includes(b.department);
  if (!ownerIsAsg && !asgInDept) {
    return res.status(400).json({
      error: `Người thực hiện không thuộc phòng "${b.department}".`,
    });
  }

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: 'endDate phải >= startDate' });
  }
  if (startDate && b.start_date && new Date(startDate) < new Date(b.start_date)) {
    return res.status(400).json({ error: `startDate phải >= bundle start_date (${b.start_date})` });
  }
  if (endDate && b.due_date && new Date(endDate) > new Date(b.due_date)) {
    return res.status(400).json({ error: `endDate phải <= bundle due_date (${b.due_date})` });
  }

  const safeStatus = status || 'not_started';
  const safeProgress = progress !== undefined ? Number(progress) : 0;
  if (safeStatus === 'completed' && safeProgress < 100) {
    return res.status(400).json({ error: 'Trạng thái "Hoàn thành" yêu cầu tiến độ = 100%' });
  }

  // Auto-gen code
  const count = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
  const code = `T${String(count + 1).padStart(4, '0')}`;
  const id = uuidv4();
  const now = new Date().toISOString();
  const tagList = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [];

  db.prepare(`
    INSERT INTO tasks (
      id, code, name, description, department, collab_depts,
      assignee_id, created_by, start_date, end_date, progress, status, priority,
      results, notes, tags, project_id, bundle_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, code, name.trim(), description?.trim() || '',
    b.department, '[]',
    assigneeId, req.user.fullname,
    startDate || '', endDate || '',
    safeProgress, safeStatus, priority || 'medium',
    '', notes?.trim() || '',
    JSON.stringify(tagList),
    b.project_id, b.id,
    now, now,
  );

  // Recalc bundle progress
  recalcBundleProgress(b.id);
  logHistory('task', id, `Tạo đầu việc "${name.trim()}" trong bundle "${b.name}"`, req.user);

  // Recalc bundle progress
  recalcBundleProgress(b.id);

  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ ...created, tags: tagList });
});

// ============================================================
// GET /api/projects/:projectId/bundles — Lấy tất cả bundles trong project
// ============================================================
router.get('/projects/:projectId/bundles', (req, res) => {
  const p = db.prepare('SELECT id FROM construction_projects WHERE id = ?').get(req.params.projectId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const all = getVisibleProjects(req.user);
  if (!all.find((x) => x.id === p.id)) {
    return res.status(403).json({ error: 'Không có quyền xem dự án này' });
  }

  const bundles = db.prepare(`
    SELECT * FROM assignment_bundles WHERE project_id = ?
    ORDER BY created_at
  `).all(p.id).map(serializeBundle);

  res.json(bundles);
});

// ============================================================
// POST /api/projects/:projectId/tasks — Tạo task độc lập (không qua bundle)
// Quyền: BGĐ/Admin tạo cho bất kỳ ai; TP tạo cho NV/TP cùng phòng
// assignee có thể là NV hoặc TP (TP tự giao cho mình)
// ============================================================
router.post('/projects/:projectId/tasks', (req, res) => {
  const p = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(req.params.projectId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  // Check quyền xem project
  const all = getVisibleProjects(req.user);
  if (!all.find((x) => x.id === p.id)) {
    return res.status(403).json({ error: 'Không có quyền tạo task trong dự án này' });
  }

  const {
    name, description, assigneeId, department,
    startDate, endDate, priority, notes, tags, progress, status,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Tên đầu việc là bắt buộc' });
  if (!assigneeId) return res.status(400).json({ error: 'Phải chọn người thực hiện' });

  const asg = db.prepare(`
    SELECT id, fullname, role, department FROM users WHERE id = ? AND active = 1
  `).get(assigneeId);
  if (!asg) return res.status(400).json({ error: 'Người thực hiện không tồn tại hoặc đã bị khóa' });

  // Phân quyền tạo:
  // - BGĐ/Admin: cho bất kỳ ai
  // - Manager (TP): chỉ NV/TP cùng phòng
  // - Employee: KHÔNG tạo task (chỉ nhận)
  if (req.user.role === 'manager') {
    const userDepts = db.prepare('SELECT department FROM user_departments WHERE user_id = ?').all(req.user.id).map((r) => r.department);
    const asgDepts = db.prepare('SELECT department FROM user_departments WHERE user_id = ?').all(assigneeId).map((r) => r.department);
    const shared = asgDepts.some((d) => userDepts.includes(d));
    if (!shared) {
      return res.status(403).json({
        error: 'Bạn chỉ có thể tạo task độc lập cho người cùng phòng ban.',
      });
    }
  } else if (req.user.role === 'employee') {
    return res.status(403).json({ error: 'Nhân viên không có quyền tạo task' });
  }

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: 'endDate phải >= startDate' });
  }

  // Auto-gen code
  const count = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
  const code = `T${String(count + 1).padStart(4, '0')}`;
  const id = uuidv4();
  const now = new Date().toISOString();
  const tagList = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  const dept = (department?.trim()) || asg.department || '';

  db.prepare(`
    INSERT INTO tasks (
      id, code, name, description, department, collab_depts,
      assignee_id, created_by, start_date, end_date, progress, status, priority,
      results, notes, tags, project_id, bundle_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    id, code, name.trim(), description?.trim() || '',
    dept, '[]',
    assigneeId, req.user.fullname,
    startDate || '', endDate || '',
    progress !== undefined ? Number(progress) : 0,
    status || 'not_started', priority || 'medium',
    '', notes?.trim() || '',
    JSON.stringify(tagList),
    p.id,
    now, now,
  );

  logHistory('task', id, `Tạo task độc lập "${name.trim()}" trong dự án ${p.name}`, req.user);

  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ ...created, tags: tagList, standalone: true });
});

// ============================================================
// GET /api/projects/:projectId/tasks — Tasks trong project (kể cả standalone)
// ============================================================
router.get('/projects/:projectId/tasks', (req, res) => {
  const p = db.prepare('SELECT id FROM construction_projects WHERE id = ?').get(req.params.projectId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const all = getVisibleProjects(req.user);
  if (!all.find((x) => x.id === p.id)) {
    return res.status(403).json({ error: 'Không có quyền xem dự án này' });
  }

  const tasks = db.prepare(`
    SELECT t.*, u.fullname AS assignee_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ?
    ORDER BY t.bundle_id NULLS FIRST, t.created_at
  `).all(p.id);

  res.json(tasks.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    bundleId: t.bundle_id,
    projectId: t.project_id,
    assigneeId: t.assignee_id,
    assigneeName: t.assignee_name,
    department: t.department,
    startDate: t.start_date,
    endDate: t.end_date,
    progress: t.progress,
    status: t.status,
    priority: t.priority,
    tags: parseJsonArray(t.tags),
    standalone: !t.bundle_id,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  })));
});

// ============================================================
// GET /api/bundles?owner=X&status=Y — Lấy bundles theo filter
// ============================================================
router.get('/bundles', (req, res) => {
  const { owner, status, project, phase } = req.query;
  const where = [];
  const params = [];

  if (owner) { where.push('owner_id = ?'); params.push(owner); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (project) { where.push('project_id = ?'); params.push(project); }
  if (phase) { where.push('phase_id = ?'); params.push(phase); }

  // Phạm vi xem: theo role
  const visibleProjects = getVisibleProjects(req.user);
  const visibleProjectIds = visibleProjects.map((p) => p.id);
  if (visibleProjectIds.length === 0) return res.json([]);

  const placeholders = visibleProjectIds.map(() => '?').join(',');
  where.push(`project_id IN (${placeholders})`);
  params.push(...visibleProjectIds);

  const bundles = db.prepare(`
    SELECT * FROM assignment_bundles WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
  `).all(...params).map(serializeBundle);

  res.json(bundles);
});

module.exports = router;
