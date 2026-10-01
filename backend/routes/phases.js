// ============================================================
// routes/phases.js — CRUD Giai đoạn dự án (Tier 2)
// ============================================================
const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');

const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { serializePhase, logHistory, getVisibleProjects } = require('./_helpers');

const router = express.Router();
router.use(requireAuth);

// ============================================================
// POST /api/projects/:projectId/phases — Tạo phase mới (BGĐ/Admin)
// ============================================================
router.post('/projects/:projectId/phases', requireRole('admin', 'director'), (req, res) => {
  const p = db.prepare('SELECT * FROM construction_projects WHERE id = ?').get(req.params.projectId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const { name, sequence, description, targetStart, targetEnd } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên giai đoạn là bắt buộc' });

  // Auto tính sequence nếu không truyền
  let seq = sequence;
  if (seq === undefined || seq === null) {
    const max = db.prepare('SELECT MAX(sequence) as m FROM project_phases WHERE project_id = ?').get(p.id).m;
    seq = (max || 0) + 1;
  }

  // Check unique (project_id, sequence)
  const dup = db.prepare('SELECT id FROM project_phases WHERE project_id = ? AND sequence = ?').get(p.id, seq);
  if (dup) return res.status(409).json({ error: `Sequence ${seq} đã tồn tại trong dự án này` });

  if (targetStart && targetEnd && new Date(targetEnd) < new Date(targetStart)) {
    return res.status(400).json({ error: 'targetEnd phải >= targetStart' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO project_phases (id, project_id, name, sequence, description, target_start, target_end, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, p.id, name.trim(), seq, description?.trim() || '', targetStart || '', targetEnd || '', now, now);

  logHistory('phase', id, `Tạo giai đoạn "${name.trim()}" trong dự án ${p.name}`, req.user);

  const created = db.prepare('SELECT * FROM project_phases WHERE id = ?').get(id);
  res.status(201).json(serializePhase(created));
});

// ============================================================
// GET /api/phases/:id — Chi tiết phase
// ============================================================
router.get('/phases/:id', (req, res) => {
  const ph = db.prepare('SELECT * FROM project_phases WHERE id = ?').get(req.params.id);
  if (!ph) return res.status(404).json({ error: 'Không tìm thấy giai đoạn' });

  // Check quyền xem
  const all = getVisibleProjects(req.user);
  if (!all.find((p) => p.id === ph.project_id)) {
    return res.status(403).json({ error: 'Không có quyền xem giai đoạn này' });
  }

  res.json(serializePhase(ph));
});

// ============================================================
// PUT /api/phases/:id — Cập nhật phase (BGĐ/Admin)
// ============================================================
router.put('/phases/:id', requireRole('admin', 'director'), (req, res) => {
  const ph = db.prepare('SELECT * FROM project_phases WHERE id = ?').get(req.params.id);
  if (!ph) return res.status(404).json({ error: 'Không tìm thấy giai đoạn' });

  const { name, sequence, description, targetStart, targetEnd, actualStart, actualEnd, status } = req.body;

  // Check unique sequence nếu đổi
  if (sequence !== undefined && sequence !== ph.sequence) {
    const dup = db.prepare('SELECT id FROM project_phases WHERE project_id = ? AND sequence = ? AND id != ?').get(ph.project_id, sequence, ph.id);
    if (dup) return res.status(409).json({ error: `Sequence ${sequence} đã tồn tại` });
  }

  const updates = [];
  const params = [];
  const setIf = (field, val) => { if (val !== undefined) { updates.push(`${field} = ?`); params.push(val); } };

  setIf('name', name?.trim());
  setIf('sequence', sequence);
  setIf('description', description?.trim());
  setIf('target_start', targetStart);
  setIf('target_end', targetEnd);
  setIf('actual_start', actualStart);
  setIf('actual_end', actualEnd);
  setIf('status', status);
  updates.push('updated_at = ?'); params.push(new Date().toISOString());
  params.push(ph.id);

  if (updates.length === 1) {
    return res.status(400).json({ error: 'Không có gì để cập nhật' });
  }

  db.prepare(`UPDATE project_phases SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  logHistory('phase', ph.id, `Cập nhật giai đoạn`, req.user);

  const updated = db.prepare('SELECT * FROM project_phases WHERE id = ?').get(ph.id);
  res.json(serializePhase(updated));
});

// ============================================================
// DELETE /api/phases/:id — Xóa phase (BGĐ/Admin, cascade null bundles)
// ============================================================
router.delete('/phases/:id', requireRole('admin', 'director'), (req, res) => {
  const ph = db.prepare('SELECT * FROM project_phases WHERE id = ?').get(req.params.id);
  if (!ph) return res.status(404).json({ error: 'Không tìm thấy giai đoạn' });

  // Move bundles về null phase (đã có ON DELETE SET NULL)
  db.prepare('DELETE FROM project_phases WHERE id = ?').run(ph.id);
  logHistory('phase', ph.id, `Xóa giai đoạn "${ph.name}"`, req.user);

  res.json({ message: 'Đã xóa giai đoạn' });
});

// ============================================================
// POST /api/phases/reorder — Sắp xếp lại sequence trong 1 project
// Body: { projectId, phaseIds: [id1, id2, id3, ...] } (thứ tự mới)
// ============================================================
router.post('/phases/reorder', requireRole('admin', 'director'), (req, res) => {
  const { projectId, phaseIds } = req.body;
  if (!projectId || !Array.isArray(phaseIds)) {
    return res.status(400).json({ error: 'Thiếu projectId hoặc phaseIds' });
  }

  const p = db.prepare('SELECT id FROM construction_projects WHERE id = ?').get(projectId);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const existing = db.prepare('SELECT id FROM project_phases WHERE project_id = ?').all(projectId).map((x) => x.id);
  if (existing.length !== phaseIds.length || !phaseIds.every((id) => existing.includes(id))) {
    return res.status(400).json({ error: 'Danh sách phaseIds không khớp với project' });
  }

  const now = new Date().toISOString();
  const txn = db.transaction((arr) => {
    arr.forEach((id, i) => {
      db.prepare('UPDATE project_phases SET sequence = ?, updated_at = ? WHERE id = ?').run(i + 1, now, id);
    });
  });
  txn(phaseIds);

  logHistory('project', projectId, `Sắp xếp lại thứ tự ${phaseIds.length} giai đoạn`, req.user);
  res.json({ message: 'Đã sắp xếp lại' });
});

module.exports = router;
