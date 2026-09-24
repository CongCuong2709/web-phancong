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

// GET /api/users — Danh sách tất cả users (admin/director)
router.get('/', requireRole('admin', 'director'), (req, res) => {
  const users = db.prepare(`
    SELECT id, username, fullname, role, department, active, created_at
    FROM users ORDER BY department, fullname
  `).all();
  res.json(users);
});

// GET /api/users/department — Danh sách user theo phòng ban (để dropdown giao việc)
router.get('/by-department', (req, res) => {
  const { dept } = req.query;
  let users;
  if (dept) {
    users = db.prepare(`
      SELECT id, username, fullname, role, department
      FROM users WHERE department = ? AND active = 1
      ORDER BY role, fullname
    `).all(dept);
  } else {
    users = db.prepare(`
      SELECT id, username, fullname, role, department
      FROM users WHERE active = 1
      ORDER BY department, role, fullname
    `).all();
  }
  res.json(users);
});

// GET /api/users/departments — Danh sách phòng ban
router.get('/departments', (req, res) => {
  const rows = db.prepare(`
    SELECT DISTINCT department FROM users WHERE active = 1 AND department != ''
    ORDER BY department
  `).all();
  res.json(rows.map(r => r.department));
});

// POST /api/users — Tạo user mới (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  const { username, password, fullname, role, department } = req.body;

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

  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, password, fullname, role, department)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username.trim().toLowerCase(), hashed, fullname.trim(), role, department?.trim() || '');

  res.status(201).json({ id, username: username.trim().toLowerCase(), fullname, role, department: department?.trim() || '' });
});

// PUT /api/users/:id — Cập nhật user (admin only)
router.put('/:id', requireRole('admin'), (req, res) => {
  const { fullname, role, department, active } = req.body;

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

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
    department?.trim() ?? null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  );

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
