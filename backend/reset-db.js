// ============================================================
// reset-db.js — Script reset & seed lại dữ liệu ban đầu
// Chỉ dùng seed-construction (ngành xây dựng, model 4 tầng).
// Seed cũ (seed.js) đã được archive → seed.js.bak
// ============================================================
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const files = ['phancong.db', 'phancong.db-wal', 'phancong.db-shm'];

for (const f of files) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
      console.log(`🗑️ Đã xóa ${f}`);
    } catch (err) {
      console.error(`Không thể xóa ${f}: ${err.message}`);
    }
  }
}

// Khởi tạo schema (db.js tự chạy CREATE TABLE IF NOT EXISTS khi require)
require('./db');

// Seed dữ liệu ngành xây dựng
const { seedConstruction } = require('./seed-construction');
seedConstruction(true);

console.log('✨ Reset và khởi tạo dữ liệu xây dựng thành công!');
