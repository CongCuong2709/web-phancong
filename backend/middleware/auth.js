// ============================================================
// middleware/auth.js — JWT authentication middleware
// ============================================================
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'phancong_secret_key_2024_change_in_production';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  CẢNH BÁO: Chưa cấu hình JWT_SECRET cho môi trường Production!');
}

/**
 * Tạo JWT token cho user
 * @param {object} payload — phải có id, username, fullname, role, departments[]
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

/**
 * Middleware: bắt buộc đăng nhập
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại' });
  }
}

/**
 * Middleware factory: yêu cầu role cụ thể
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole };
