// ============================================================
// routes/auth.js — Đăng nhập / Đổi mật khẩu / Thông tin cá nhân
// ============================================================
const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
  }

  const user = db.prepare(`
    SELECT id, username, password, fullname, role, department, active
    FROM users WHERE username = ?
  `).get(username.trim().toLowerCase());

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
  }

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'Sai mật khẩu' });
  }

  const token = signToken({
    id: user.id,
    username: user.username,
    fullname: user.fullname,
    role: user.role,
    department: user.department,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      department: user.department,
    },
  });
});

// GET /api/auth/me — Lấy thông tin người dùng hiện tại
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, fullname, role, department, active, created_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Tài khoản không hợp lệ' });
  }
  res.json(user);
});

// POST /api/auth/change-password — Đổi mật khẩu
router.post('/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
  }

  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  res.json({ message: 'Đổi mật khẩu thành công' });
});

module.exports = router;
