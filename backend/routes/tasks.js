// ============================================================
// routes/tasks.js — CRUD Task (công việc gốc)
// ============================================================
const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');

const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ============================================================
// Helper: tính progress task từ subtasks
// ============================================================
function recalcTaskProgress(taskId) {
  const subs = db.prepare('SELECT progress FROM subtasks WHERE task_id = ?').all(taskId);
  if (!subs.length) return null; // không có subtask → không ghi đè
  const avg = Math.round(subs.reduce((s, r) => s + r.progress, 0) / subs.length);
  db.prepare('UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?')
    .run(avg, new Date().toISOString(), taskId);
  return avg;
}

// ============================================================
// Helper: lấy danh sách phòng ban user có quyền truy cập
// ============================================================
function getUserDepartments(userId) {
  const rows = db.prepare(`
    SELECT department FROM user_departments WHERE user_id = ? ORDER BY is_primary DESC
  `).all(userId);
  return rows.map((r) => r.department);
}

// ============================================================
// Helper: lọc task theo role — dùng user_departments
// ============================================================
function getTasksForUser(user) {
  let tasks;
  if (user.role === 'director' || user.role === 'admin') {
    // BGĐ/Admin: thấy tất cả
    tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  } else {
    // Manager/Employee: thấy task thuộc bất kỳ phòng nào mình thuộc
    const depts = getUserDepartments(user.id);
    if (!depts.length) {
      // Fallback nếu user chưa có user_departments (lỗi data) → dùng department cũ
      const fallback = user.department || '';
      if (!fallback) return [];
      tasks = db.prepare(`
        SELECT * FROM tasks
        WHERE department = ? OR collab_depts LIKE ?
        ORDER BY created_at DESC
      `).all(fallback, `%"${fallback}"%`);
    } else {
      const placeholders = depts.map(() => '?').join(',');
      const likeClauses = depts.map(() => `collab_depts LIKE ?`).join(' OR ');
      const params = [...depts, ...depts.map((d) => `%"${d}"%`)];
      tasks = db.prepare(`
        SELECT * FROM tasks
        WHERE department IN (${placeholders})
           OR ${likeClauses}
        ORDER BY created_at DESC
      `).all(...params);
    }
  }
  return tasks;
}

// ============================================================
// Serialize task: parse collab_depts JSON + gắn subtasks
// ============================================================
function parseJsonArray(value, fallback = []) {
  if (!value) return fallback;
  try { const arr = JSON.parse(value); return Array.isArray(arr) ? arr : fallback; }
  catch { return fallback; }
}

function serializeTask(t, includeSubtasks = true) {
  let collaboratingDepts = parseJsonArray(t.collab_depts, []);
  let tags = parseJsonArray(t.tags, []);

  // Lấy tên assignee
  const assignee = t.assignee_id
    ? db.prepare('SELECT id, fullname, role, department FROM users WHERE id = ?').get(t.assignee_id)
    : null;

  const task = {
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    department: t.department,
    collaboratingDepts,
    assigneeId: t.assignee_id,
    assignee: assignee ? assignee.fullname : t.created_by,
    createdBy: t.created_by,
    startDate: t.start_date,
    endDate: t.end_date,
    progress: t.progress,
    status: t.status,
    priority: t.priority,
    results: t.results,
    notes: t.notes,
    tags,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    subTasks: [],
    history: [],
  };

  if (includeSubtasks) {
    const subs = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(t.id);
    task.subTasks = subs.map(s => {
      const assigneeUser = s.assignee_id
        ? db.prepare('SELECT id, fullname FROM users WHERE id = ?').get(s.assignee_id)
        : null;
      const logs = db.prepare('SELECT * FROM daily_logs WHERE subtask_id = ? ORDER BY log_date DESC').all(s.id);
      let sTags = parseJsonArray(s.tags, []);
      return {
        id: s.id,
        taskId: s.task_id,
        name: s.name,
        description: s.description,
        assigneeId: s.assignee_id,
        assignee: assigneeUser ? assigneeUser.fullname : '',
        startDate: s.start_date,
        endDate: s.end_date,
        progress: s.progress,
        status: s.status,
        priority: s.priority,
        results: s.results,
        notes: s.notes,
        tags: sTags,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        history: [],
        dailyLogs: logs.map(l => ({
          id: l.id,
          date: l.log_date,
          description: l.description,
          result: l.result,
          obstacle: l.obstacle,
          progress: l.progress,
          userId: l.user_id,
          createdAt: l.created_at,
        })),
      };
    });

    // Lấy history
    const hist = db.prepare(`
      SELECT * FROM history WHERE entity_type = 'task' AND entity_id = ?
      ORDER BY created_at ASC
    `).all(t.id);
    task.history = hist.map(h => ({ at: h.created_at, action: h.action, user: h.user_name }));
  }

  return task;
}

// ============================================================
// GET /api/tasks
// ============================================================
router.get('/', (req, res) => {
  const rows = getTasksForUser(req.user);
  res.json(rows.map(t => serializeTask(t, true)));
});

// ============================================================
// GET /api/tasks/:id
// ============================================================
router.get('/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Không tìm thấy công việc' });
  res.json(serializeTask(t, true));
});

// ============================================================
// POST /api/tasks — Tạo task mới (director / manager)
// ============================================================
router.post('/', requireRole('admin', 'director', 'manager'), (req, res) => {
  const {
    code, name, description, department, collaboratingDepts,
    assigneeId, startDate, endDate, priority, notes, tags,
    progress, status, results,
  } = req.body;

  if (!name?.trim()) return res.status(400).json({ error: 'Tên công việc là bắt buộc' });

  // Validate ngày: endDate >= startDate
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: 'Hạn xong phải >= ngày bắt đầu' });
  }

  // Validate status ↔ progress nhất quán
  const safeStatus = status || 'not_started';
  const safeProgress = progress !== undefined ? Number(progress) : 0;
  if (safeStatus === 'completed' && safeProgress < 100) {
    return res.status(400).json({ error: 'Trạng thái "Hoàn thành" yêu cầu tiến độ = 100%' });
  }
  if (safeStatus === 'not_started' && safeProgress > 0) {
    return res.status(400).json({ error: 'Trạng thái "Chưa bắt đầu" yêu cầu tiến độ = 0%' });
  }

  // BGĐ: bắt buộc phải giao cho Trưởng phòng (role=manager), không giao BGĐ khác, không tự giao
  if (req.user.role === 'director' && assigneeId) {
    const assignee = db.prepare('SELECT role FROM users WHERE id = ? AND active = 1').get(assigneeId);
    if (!assignee) return res.status(400).json({ error: 'Người nhận không tồn tại hoặc đã bị khóa' });
    if (assignee.role !== 'manager') {
      return res.status(403).json({
        error: 'Giám đốc chỉ được giao công việc cho Trưởng phòng. Hãy chọn một Trưởng phòng để nhận.',
      });
    }
  }

  // Manager: chỉ được assign cho user cùng phòng
  if (req.user.role === 'manager' && assigneeId) {
    const userDepts = db.prepare('SELECT department FROM user_departments WHERE user_id = ?').all(req.user.id).map((r) => r.department);
    const target = db.prepare('SELECT id FROM user_departments WHERE user_id = ? AND department IN (SELECT department FROM user_departments WHERE user_id = ?)').get(assigneeId, req.user.id);
    // Ở mức tối thiểu: phòng của manager phải chứa assignee
    if (!userDepts.length) {
      return res.status(403).json({ error: 'Tài khoản chưa được gán phòng ban nào' });
    }
    const assigneeDepts = db.prepare('SELECT department FROM user_departments WHERE user_id = ?').all(assigneeId).map((r) => r.department);
    if (!assigneeDepts.some((d) => userDepts.includes(d))) {
      return res.status(403).json({
        error: 'Chỉ được giao công việc cho người cùng phòng ban mà bạn quản lý.',
      });
    }
  }

  // Tự tạo code nếu không cung cấp
  let taskCode = code?.trim();
  if (!taskCode) {
    const count = db.prepare('SELECT COUNT(*) as c FROM tasks').get().c;
    taskCode = `DA${String(count + 1).padStart(3, '0')}`;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const dept = department?.trim() || req.user.department;
  const tagList = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [];

  db.prepare(`
    INSERT INTO tasks (id, code, name, description, department, collab_depts,
      assignee_id, created_by, start_date, end_date, priority, notes, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, taskCode, name.trim(), description?.trim() || '',
    dept,
    JSON.stringify(Array.isArray(collaboratingDepts) ? collaboratingDepts : []),
    assigneeId || null,
    req.user.fullname,
    startDate || '', endDate || '',
    priority || 'medium', notes?.trim() || '',
    JSON.stringify(tagList),
    now, now
  );

  // Ghi history
  db.prepare(`INSERT INTO history (id, entity_type, entity_id, action, user_id, user_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'task', id, 'Tạo công việc', req.user.id, req.user.fullname, now);

  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(serializeTask(newTask, true));
});

// ============================================================
// PUT /api/tasks/:id — Cập nhật task
// ============================================================
router.put('/:id', requireRole('admin', 'director', 'manager'), (req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  // Manager chỉ sửa task thuộc phòng mình (đa phòng — check user_departments)
  if (req.user.role === 'manager') {
    const userDepts = getUserDepartments(req.user.id);
    const collab = parseJsonArray(t.collab_depts, []);
    const allowed = userDepts.includes(t.department) || collab.some((d) => userDepts.includes(d));
    if (!allowed) return res.status(403).json({ error: 'Không có quyền chỉnh sửa công việc này' });
  }

  const {
    name, description, department, collaboratingDepts,
    assigneeId, startDate, endDate, progress, status, priority, results, notes, tags,
  } = req.body;

  // Validate ngày: nếu cả 2 đều có → endDate >= startDate
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: 'Hạn xong phải >= ngày bắt đầu' });
  }

  // Validate status ↔ progress nhất quán (chỉ khi cả 2 field được gửi)
  if (status !== undefined && progress !== undefined) {
    const sStatus = String(status);
    const iProg = Number(progress);
    if (sStatus === 'completed' && iProg < 100) {
      return res.status(400).json({ error: 'Trạng thái "Hoàn thành" yêu cầu tiến độ = 100%' });
    }
    if (sStatus === 'not_started' && iProg > 0) {
      return res.status(400).json({ error: 'Trạng thái "Chưa bắt đầu" yêu cầu tiến độ = 0%' });
    }
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks SET
      name            = COALESCE(?, name),
      description     = COALESCE(?, description),
      department      = COALESCE(?, department),
      collab_depts    = COALESCE(?, collab_depts),
      assignee_id     = COALESCE(?, assignee_id),
      start_date      = COALESCE(?, start_date),
      end_date        = COALESCE(?, end_date),
      progress        = COALESCE(?, progress),
      status          = COALESCE(?, status),
      priority        = COALESCE(?, priority),
      results         = COALESCE(?, results),
      notes           = COALESCE(?, notes),
      tags            = COALESCE(?, tags),
      updated_at      = ?
    WHERE id = ?
  `).run(
    name?.trim() || null,
    description?.trim() ?? null,
    department?.trim() || null,
    collaboratingDepts !== undefined ? JSON.stringify(collaboratingDepts) : null,
    assigneeId !== undefined ? assigneeId : null,
    startDate || null,
    endDate || null,
    progress !== undefined ? Number(progress) : null,
    status || null,
    priority || null,
    results?.trim() ?? null,
    notes?.trim() ?? null,
    tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : null,
    now,
    req.params.id
  );

  db.prepare(`INSERT INTO history (id, entity_type, entity_id, action, user_id, user_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'task', req.params.id, 'Cập nhật công việc', req.user.id, req.user.fullname, now);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json(serializeTask(updated, true));
});

// ============================================================
// DELETE /api/tasks/:id — Xóa task (chỉ director/admin)
// ============================================================
router.delete('/:id', requireRole('admin', 'director'), (req, res) => {
  const t = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xóa công việc' });
});

// ============================================================
// Subtask routes (nested)
// ============================================================

// GET /api/tasks/:id/subtasks
router.get('/:id/subtasks', (req, res) => {
  const subs = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(subs);
});

// POST /api/tasks/:taskId/subtasks — Tạo subtask (manager+)
// Theo quy trình chuẩn: BGĐ không được giao SubTask trực tiếp — chỉ quản lý tạo Task cha.
router.post('/:taskId/subtasks', requireRole('admin', 'director', 'manager'), (req, res) => {
  // BGĐ bị cấm: chỉ giao Task cha cho Trưởng phòng để họ phân rã.
  // Admin được đặc cách (superuser).
  if (req.user.role === 'director') {
    return res.status(403).json({
      error: 'Giám đốc không nên giao SubTask trực tiếp. Hãy giao Task cha cho Trưởng phòng để họ phân rã cho Nhân viên.',
    });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

  if (req.user.role === 'manager') {
    const userDepts = getUserDepartments(req.user.id);
    const collab = parseJsonArray(task.collab_depts, []);
    const allowed = userDepts.includes(task.department) || collab.some((d) => userDepts.includes(d));
    if (!allowed) return res.status(403).json({ error: 'Không có quyền thêm công việc con vào task này' });
  }

  const { name, description, assigneeId, startDate, endDate, priority, notes, tags, progress, status, results } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Tên công việc con là bắt buộc' });

  // Validate ngày SubTask: endDate >= startDate VÀ nằm trong khoảng task cha
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({ error: 'Hạn xong phải >= ngày bắt đầu' });
  }
  if (startDate && task.start_date && new Date(startDate) < new Date(task.start_date)) {
    return res.status(400).json({ error: `Ngày bắt đầu SubTask phải >= ngày bắt đầu Task cha (${task.start_date})` });
  }
  if (endDate && task.end_date && new Date(endDate) > new Date(task.end_date)) {
    return res.status(400).json({ error: `Hạn xong SubTask phải <= hạn Task cha (${task.end_date})` });
  }

  // Validate status ↔ progress
  if (status && progress !== undefined) {
    if (String(status) === 'completed' && Number(progress) < 100) {
      return res.status(400).json({ error: 'Trạng thái "Hoàn thành" yêu cầu tiến độ = 100%' });
    }
    if (String(status) === 'not_started' && Number(progress) > 0) {
      return res.status(400).json({ error: 'Trạng thái "Chưa bắt đầu" yêu cầu tiến độ = 0%' });
    }
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const tagList = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  const safeProgress = progress !== undefined ? Number(progress) : 0;
  const safeStatus = status || 'not_started';
  const safeResults = results?.trim() || '';

  db.prepare(`
    INSERT INTO subtasks (id, task_id, name, description, assignee_id, start_date, end_date, progress, status, priority, results, notes, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.taskId, name.trim(), description?.trim() || '',
    assigneeId || null, startDate || '', endDate || '',
    safeProgress, safeStatus, priority || 'medium', safeResults, notes?.trim() || '',
    JSON.stringify(tagList), now, now);

  // Recalc task progress
  recalcTaskProgress(req.params.taskId);

  db.prepare(`INSERT INTO history (id, entity_type, entity_id, action, user_id, user_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'subtask', id, `Thêm công việc con: "${name}"`, req.user.id, req.user.fullname, now);

  const newSub = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
  const assignee = newSub.assignee_id
    ? db.prepare('SELECT fullname FROM users WHERE id = ?').get(newSub.assignee_id)
    : null;

  res.status(201).json({
    ...newSub,
    assignee: assignee?.fullname || '',
    tags: tagList,
    dailyLogs: [],
    history: [],
  });
});

// PUT /api/tasks/:taskId/subtasks/:subId — Cập nhật subtask
router.put('/:taskId/subtasks/:subId', (req, res) => {
  const sub = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?').get(req.params.subId, req.params.taskId);
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy công việc con' });

  // Employee chỉ cập nhật subtask được giao cho mình
  if (req.user.role === 'employee') {
    if (sub.assignee_id !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền chỉnh sửa công việc con này' });
    }
    // Employee chỉ được cập nhật tiến độ, kết quả, ghi chú, trạng thái
    req.body.name = sub.name;
    req.body.assigneeId = sub.assignee_id;
    req.body.startDate = sub.start_date;
    req.body.endDate = sub.end_date;
    req.body.priority = sub.priority;
  }

  const { name, description, assigneeId, startDate, endDate, progress, status, priority, results, notes, tags } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE subtasks SET
      name        = COALESCE(?, name),
      description = COALESCE(?, description),
      assignee_id = COALESCE(?, assignee_id),
      start_date  = COALESCE(?, start_date),
      end_date    = COALESCE(?, end_date),
      progress    = COALESCE(?, progress),
      status      = COALESCE(?, status),
      priority    = COALESCE(?, priority),
      results     = COALESCE(?, results),
      notes       = COALESCE(?, notes),
      tags        = COALESCE(?, tags),
      updated_at  = ?
    WHERE id = ?
  `).run(
    name?.trim() || null,
    description?.trim() ?? null,
    assigneeId !== undefined ? assigneeId : null,
    startDate || null, endDate || null,
    progress !== undefined ? Number(progress) : null,
    status || null, priority || null,
    results?.trim() ?? null, notes?.trim() ?? null,
    tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : null,
    now, req.params.subId
  );

  // Recalc task progress
  recalcTaskProgress(req.params.taskId);

  const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.subId);
  const assigneeUser = updated.assignee_id
    ? db.prepare('SELECT fullname FROM users WHERE id = ?').get(updated.assignee_id)
    : null;

  let updatedTags = [];
  try { updatedTags = JSON.parse(updated.tags || '[]'); } catch {}
  res.json({ ...updated, assignee: assigneeUser?.fullname || '', tags: updatedTags });
});

// DELETE /api/tasks/:taskId/subtasks/:subId
router.delete('/:taskId/subtasks/:subId', requireRole('admin', 'director', 'manager'), (req, res) => {
  const sub = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?').get(req.params.subId, req.params.taskId);
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy công việc con' });

  db.prepare('DELETE FROM subtasks WHERE id = ?').run(req.params.subId);
  recalcTaskProgress(req.params.taskId);
  res.json({ message: 'Đã xóa công việc con' });
});

// ============================================================
// Daily Log routes
// ============================================================

// POST /api/tasks/:taskId/subtasks/:subId/logs
router.post('/:taskId/subtasks/:subId/logs', (req, res) => {
  const sub = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?').get(req.params.subId, req.params.taskId);
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy công việc con' });

  // Employee chỉ ghi log cho subtask của mình
  if (req.user.role === 'employee' && sub.assignee_id !== req.user.id) {
    return res.status(403).json({ error: 'Không có quyền ghi nhật ký cho công việc này' });
  }

  const { date, description, result, obstacle, progress } = req.body;
  if (!date) return res.status(400).json({ error: 'Ngày là bắt buộc' });

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO daily_logs (id, subtask_id, log_date, description, result, obstacle, progress, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.subId, date, description || '', result || '', obstacle || '',
    Number(progress) || 0, req.user.id, now);

  // Cập nhật progress subtask theo log mới nhất
  if (progress !== undefined) {
    db.prepare('UPDATE subtasks SET progress = ?, updated_at = ? WHERE id = ?')
      .run(Number(progress), now, req.params.subId);
    recalcTaskProgress(req.params.taskId);
  }

  res.status(201).json({ id, subtaskId: req.params.subId, date, description, result, obstacle, progress: Number(progress) || 0, userId: req.user.id, createdAt: now });
});

// GET /api/tasks/:taskId/subtasks/:subId/logs
router.get('/:taskId/subtasks/:subId/logs', (req, res) => {
  const logs = db.prepare(`
    SELECT dl.*, u.fullname as user_name
    FROM daily_logs dl
    LEFT JOIN users u ON u.id = dl.user_id
    WHERE dl.subtask_id = ?
    ORDER BY dl.log_date DESC
  `).all(req.params.subId);
  res.json(logs);
});

module.exports = router;
