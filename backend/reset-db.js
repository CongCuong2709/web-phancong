// ============================================================
// reset-db.js — Script reset & seed lại dữ liệu ban đầu
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

// Re-import db and seed
const db = require('./db');
const { seedIfEmpty } = require('./seed');

seedIfEmpty();
console.log('✨ Reset và khởi tạo dữ liệu mới thành công!');
