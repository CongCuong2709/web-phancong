// ============================================================
// server.js — Express server chính
// ============================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Khởi tạo DB trước (tạo schema nếu chưa có)
const db = require('./db');
const { seedIfEmpty } = require('./seed');

const authRoutes  = require('./routes/auth');
const userRoutes  = require('./routes/users');
const taskRoutes  = require('./routes/tasks');

// ============================================================
// App setup
// ============================================================
const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const IS_DEV = process.env.NODE_ENV !== 'production';

// Bảo mật cơ bản — tắt contentSecurityPolicy khi serve SPA
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// CORS: chỉ cho phép từ localhost khi dev
app.use(
  cors({
    origin: IS_DEV
      ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
      : false, // production: same-origin (frontend serve từ Express)
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// API Routes
// ============================================================
app.use('/api/auth',  authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ============================================================
// Serve frontend (production mode)
// Khi đã build: `npm run build` trong thư mục gốc,
// Express sẽ serve file tĩnh từ /dist
// ============================================================
const fs = require('fs');
if (!IS_DEV && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else if (!IS_DEV) {
  console.warn('⚠️  Thư mục dist/ chưa tồn tại. Chạy "npm run build" trước.');
}

// ============================================================
// Error handler
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Lỗi server nội bộ', detail: err.message });
});

// ============================================================
// Start
// ============================================================
seedIfEmpty();

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   🚀  Phân công Công việc — Backend    ║');
  console.log(`║   Đang chạy tại: http://0.0.0.0:${PORT}   ║`);
  console.log('║   Truy cập nội bộ:                     ║');
  console.log(`║   → http://localhost:${PORT}               ║`);
  console.log(`║   → http://[IP-máy-bạn]:${PORT}            ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
