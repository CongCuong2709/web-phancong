// ============================================================
// seed.js — Tạo dữ liệu mẫu ban đầu (chạy 1 lần)
// ============================================================
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');

const db = require('./db');

function shiftDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) {
    console.log('✅ Dữ liệu đã tồn tại, bỏ qua seed.');
    return;
  }

  console.log('🌱 Đang tạo dữ liệu mẫu...');

  // ============================================================
  // Seed Users
  // ============================================================
  const users = [
    { username: 'admin',    password: 'admin123',   fullname: 'Quản trị hệ thống', role: 'admin',    department: 'IT' },
    { username: 'giamdoc',  password: 'giamdoc123', fullname: 'Nguyễn Văn Giám đốc', role: 'director', department: 'Ban Giám đốc' },
    { username: 'tp.it',    password: '123456',     fullname: 'Trần Thị Trưởng phòng IT', role: 'manager',  department: 'Phòng IT' },
    { username: 'tp.ns',    password: '123456',     fullname: 'Phạm Văn Trưởng NS', role: 'manager',  department: 'Phòng Nhân sự' },
    { username: 'tp.kt',    password: '123456',     fullname: 'Bùi Văn Trưởng KT', role: 'manager',  department: 'Phòng Kế toán' },
    { username: 'nv.it01',  password: '123456',     fullname: 'Lê Văn IT01', role: 'employee', department: 'Phòng IT' },
    { username: 'nv.it02',  password: '123456',     fullname: 'Phạm Thị IT02', role: 'employee', department: 'Phòng IT' },
    { username: 'nv.ns01',  password: '123456',     fullname: 'Nguyễn Thị NS01', role: 'employee', department: 'Phòng Nhân sự' },
  ];

  const userIds = {};
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password, fullname, role, department)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    const id = uuidv4();
    userIds[u.username] = id;
    insertUser.run(id, u.username, bcrypt.hashSync(u.password, 10), u.fullname, u.role, u.department);
  }

  // ============================================================
  // Seed Tasks
  // ============================================================
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, code, name, description, department, collab_depts,
      assignee_id, created_by, start_date, end_date, progress, status, priority, results, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSubtask = db.prepare(`
    INSERT INTO subtasks (id, task_id, name, description, assignee_id, start_date, end_date, progress, status, priority, results, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO daily_logs (id, subtask_id, log_date, description, result, obstacle, progress, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  // Task 1: Nâng cấp ERP
  const t1id = uuidv4();
  insertTask.run(
    t1id, 'DA001', 'Nâng cấp hệ thống ERP nội bộ',
    'Triển khai phiên bản mới của hệ thống ERP, đồng bộ dữ liệu từ phần mềm cũ sang module mới.',
    'Phòng IT',
    JSON.stringify(['Phòng Kế toán', 'Phòng Nhân sự']),
    userIds['tp.it'], 'Nguyễn Văn Giám đốc',
    shiftDays(-20), shiftDays(15),
    65, 'in_progress', 'high',
    'Đã hoàn thành migrate module kế toán. Đang xử lý module nhân sự.',
    'Cần phối hợp Phòng Kế toán để test trước go-live.',
    now, now
  );

  const s1id = uuidv4();
  insertSubtask.run(s1id, t1id, 'Migrate dữ liệu module Kế toán', '', userIds['nv.it01'],
    shiftDays(-20), shiftDays(5), 80, 'in_progress', 'high',
    'Đã migrate 15.000 records kế toán, đang kiểm tra tính toàn vẹn.', '', now, now);

  // Daily logs cho s1
  const logs1 = [
    [shiftDays(-3), 'Phân tích cấu trúc dữ liệu module kế toán cũ', 'Đã lập sơ đồ mapping 12 bảng', 'Không có', 40],
    [shiftDays(-2), 'Viết script migrate dữ liệu khách hàng', 'Hoàn thành script, test 500 records', 'Một số record encoding lỗi', 55],
    [shiftDays(-1), 'Fix lỗi encoding, chạy migrate toàn bộ', 'Migrate thành công 15.000 records', 'Không có', 70],
    [shiftDays(0),  'Kiểm tra dữ liệu sau migrate', 'Báo cáo đã gửi Trưởng phòng', 'Không có', 80],
  ];
  for (const [date, desc, result, obstacle, prog] of logs1) {
    insertLog.run(uuidv4(), s1id, date, desc, result, obstacle, prog, userIds['nv.it01'], now);
  }

  const s2id = uuidv4();
  insertSubtask.run(s2id, t1id, 'Migrate dữ liệu module Nhân sự', '', userIds['nv.it01'],
    shiftDays(-10), shiftDays(15), 45, 'in_progress', 'high',
    'Đang viết script migrate, kết nối API ổn định.', '', now, now);

  insertSubtask.run(uuidv4(), t1id, 'Đào tạo người dùng cuối sử dụng ERP mới', '', userIds['nv.it02'],
    shiftDays(5), shiftDays(20), 0, 'not_started', 'medium', '', '', now, now);

  // Task 2: Đào tạo kỹ năng mềm
  const t2id = uuidv4();
  insertTask.run(
    t2id, 'DA002', 'Tổ chức khóa đào tạo kỹ năng mềm Q4',
    'Lên kế hoạch và tổ chức khóa đào tạo kỹ năng giao tiếp cho toàn công ty trong Quý 4.',
    'Phòng Nhân sự', JSON.stringify(['Ban Giám đốc']),
    userIds['tp.ns'], 'Nguyễn Văn Giám đốc',
    shiftDays(-10), shiftDays(30), 40, 'in_progress', 'medium',
    'Đã chốt giảng viên, đang khảo sát nhu cầu học viên.', '', now, now
  );

  insertSubtask.run(uuidv4(), t2id, 'Khảo sát nhu cầu học viên', '', userIds['nv.ns01'],
    shiftDays(-10), shiftDays(-2), 100, 'completed', 'medium',
    'Đã khảo sát 120 nhân viên, thu thập kết quả.', '', now, now);

  insertSubtask.run(uuidv4(), t2id, 'Liên hệ và chốt giảng viên', '', userIds['nv.ns01'],
    shiftDays(-8), shiftDays(0), 100, 'completed', 'high',
    'Đã ký hợp đồng với công ty đào tạo ABC.', '', now, now);

  // Task 3: Kiểm toán nội bộ
  insertTask.run(
    uuidv4(), 'DA003', 'Kiểm toán nội bộ tài chính quý 3',
    'Rà soát và đánh giá toàn bộ quy trình tài chính, kế toán quý 3.',
    'Phòng Kế toán', JSON.stringify(['Ban Giám đốc']),
    userIds['tp.kt'], 'Nguyễn Văn Giám đốc',
    shiftDays(5), shiftDays(45), 0, 'not_started', 'medium',
    '', 'Chờ BGĐ phê duyệt kế hoạch kiểm toán.', now, now
  );

  console.log('✅ Seed hoàn thành!');
  console.log('');
  console.log('📋 Tài khoản mẫu:');
  console.log('  admin     / admin123   (Quản trị hệ thống)');
  console.log('  giamdoc   / giamdoc123 (Giám đốc)');
  console.log('  tp.it     / 123456     (Trưởng phòng IT)');
  console.log('  tp.ns     / 123456     (Trưởng phòng Nhân sự)');
  console.log('  tp.kt     / 123456     (Trưởng phòng Kế toán)');
  console.log('  nv.it01   / 123456     (Nhân viên IT)');
  console.log('  nv.it02   / 123456     (Nhân viên IT)');
  console.log('  nv.ns01   / 123456     (Nhân viên Nhân sự)');
}

module.exports = { seedIfEmpty };
