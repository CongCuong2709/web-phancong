// ============================================================
// routes/users.js — Quản lý người dùng (chỉ admin/director)
// ============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');

const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/** Helper: lấy departments[] cho 1 user (cache trong object) */
function attachDepartments(users) {
  if (!users.length) return users;
  const ids = users.map((u) => u.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT user_id, department, is_primary
    FROM user_departments
    WHERE user_id IN (${placeholders})
    ORDER BY is_primary DESC, department
  `).all(...ids);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.user_id)) map.set(r.user_id, []);
    map.get(r.user_id).push(r.department);
  }
  return users.map((u) => ({ ...u, departments: map.get(u.id) || [u.department].filter(Boolean) }));
}

// GET /api/users — Danh sách tất cả users (admin/director)
router.get('/', requireRole('admin', 'director'), (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, fullname, role, department, active, created_at
    FROM users ORDER BY department, fullname
  `).all();
  res.json(attachDepartments(users));
});

// GET /api/users/department — Danh sách user theo phòng ban (để dropdown giao việc)
router.get('/by-department', (req, res) => {
  const { dept } = req.query;
  let users;
  if (dept) {
    // Dùng user_departments để lấy user thuộc phòng đó (kể cả user có primary dept khác)
    users = db.prepare(`
      SELECT u.id, u.username, u.email, u.fullname, u.role, u.department
      FROM users u
      INNER JOIN user_departments ud ON ud.user_id = u.id
      WHERE ud.department = ? AND u.active = 1
      ORDER BY u.role, u.fullname
    `).all(dept);
  } else {
    users = db.prepare(`
      SELECT id, username, email, fullname, role, department
      FROM users WHERE active = 1
      ORDER BY department, role, fullname
    `).all();
  }
  res.json(attachDepartments(users));
});

// GET /api/users/departments — Danh sách tất cả phòng ban (distinct)
router.get('/departments', (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT department FROM user_departments
    WHERE department != ''
    ORDER BY department
  `).all();
  res.json(rows.map((r) => r.department));
});

// POST /api/users — Tạo user mới (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  const { username, password, fullname, role, department, departments } = req.body;

  if (!username || !password || !fullname || !role) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }
  if (!['admin','director','manager','employee'].includes(role)) {
    return res.status(400).json({ error: 'Vai trò không hợp lệ' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
  }

  // Chuẩn hoá departments
  let depts = Array.isArray(departments) && departments.length > 0
    ? [...new Set(departments.filter((d) => typeof d === 'string' && d.trim()))]
    : (department?.trim() ? [department.trim()] : []);
  if (!depts.length) {
    return res.status(400).json({ error: 'Phải có ít nhất 1 phòng ban' });
  }
  const primaryDept = depts[0];

  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);

  const txn = db.prepare;
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, fullname, role, department)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertUd = db.prepare(`
    INSERT INTO user_departments (user_id, department, is_primary) VALUES (?, ?, ?)
  `);

  // Dùng transaction để tránh lệch
  const transaction = db.transaction(() => {
    insertUser.run(id, username.trim().toLowerCase(), hashed, fullname.trim(), role, primaryDept);
    depts.forEach((d, i) => insertUd.run(id, d, i === 0 ? 1 : 0));
  });
  transaction();

  res.status(201).json({
    id, username: username.trim().toLowerCase(), fullname, role,
    department: primaryDept, departments: depts,
  });
});

// PUT /api/users/:id — Cập nhật user (admin only)
router.put('/:id', requireRole('admin'), (req, res) => {
  const { fullname, role, department, departments, active } = req.body;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  // Chuẩn hoá departments (nếu có)
  let depts = null;
  if (Array.isArray(departments)) {
    depts = [...new Set(departments.filter((d) => typeof d === 'string' && d.trim()))];
    if (!depts.length) return res.status(400).json({ error: 'Phải có ít nhất 1 phòng ban' });
  } else if (typeof department === 'string' && department.trim()) {
    depts = [department.trim()];
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE users SET
        fullname   = COALESCE(?, fullname),
        role       = COALESCE(?, role),
        department = COALESCE(?, department),
        active     = COALESCE(?, active)
      WHERE id = ?
    `).run(
      fullname?.trim() || null,
      role || null,
      depts ? depts[0] : null,
      active !== undefined ? (active ? 1 : 0) : null,
      req.params.id
    );

    if (depts) {
      db.prepare('DELETE FROM user_departments WHERE user_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO user_departments (user_id, department, is_primary) VALUES (?, ?, ?)');
      depts.forEach((d, i) => ins.run(req.params.id, d, i === 0 ? 1 : 0));
    }
  });
  transaction();

  res.json({ message: 'Cập nhật thành công' });
});

// POST /api/users/:id/reset-password — Admin reset mật khẩu
router.post('/:id/reset-password', requireRole('admin'), (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.params.id);
  res.json({ message: 'Đặt lại mật khẩu thành công' });
});

// DELETE /api/users/:id — Xóa user (chỉ admin, không xóa chính mình)
router.delete('/:id', requireRole('admin'), (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' });
  }
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã vô hiệu hóa tài khoản' });
});

module.exports = router;
