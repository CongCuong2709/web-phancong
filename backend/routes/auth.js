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

  const cleanInput = username.trim().toLowerCase();
  const handle = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;
  const fullEmail = cleanInput.includes('@') ? cleanInput : cleanInput + '@gmail.com';

  const user = db.prepare(`
    SELECT id, username, email, password, fullname, role, department, active
    FROM users WHERE username = ? OR email = ? OR username = ? OR email = ?
  `).get(cleanInput, cleanInput, handle, fullEmail);

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
  }

  const ok = bcrypt.compareSync(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'Sai mật khẩu' });
  }

  // Lấy danh sách phòng ban từ user_departments
  const departments = db.prepare(`
    SELECT department FROM user_departments WHERE user_id = ? ORDER BY is_primary DESC, department
  `).all(user.id).map((r) => r.department);

  const token = signToken({
    id: user.id,
    username: user.username,
    fullname: user.fullname,
    role: user.role,
    department: user.department, // primary (back-compat)
    departments,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      department: user.department,
      departments,
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
  const departments = db.prepare(`
    SELECT department FROM user_departments WHERE user_id = ? ORDER BY is_primary DESC, department
  `).all(user.id).map((r) => r.department);
  res.json({ ...user, departments });
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
