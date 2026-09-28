// ============================================================
// seed.js — Khởi tạo dữ liệu người dùng & công việc ban đầu từ Hệ thống cũ
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
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get('tag.hcns8@gmail.com', 'tag.hcns8@gmail.com');
  if (existingUser) {
    console.log('✅ Dữ liệu hệ thống cũ đã tồn tại, bỏ qua seed.');
    return;
  }

  console.log('🌱 Đang khởi tạo dữ liệu mẫu từ Hệ thống cũ...');

  // Xóa bớt dữ liệu cũ nếu chưa có user thực tế
  db.exec('DELETE FROM daily_logs');
  db.exec('DELETE FROM subtasks');
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM user_departments');
  db.exec('DELETE FROM users');

  // ============================================================
  // Seed Users từ Dữ liệu Hệ Thống Cũ
  // ============================================================
  const users = [
    // 1. Quản trị hệ thống
    { username: 'admin', email: 'admin@company.com', password: 'admin123', fullname: 'Quản trị hệ thống', role: 'admin', departments: ['Ban Giám đốc', 'HCNS', 'Kế toán', 'Thu mua', 'Phòng IT'] },

    // 2. Ban Giám đốc (Tổng giám đốc)
    { username: 'tienanhkinhbac@gmail.com', email: 'tienanhkinhbac@gmail.com', password: '123456', fullname: 'Tổng giám đốc Tiến Anh', role: 'director', departments: ['Ban Giám đốc'] },
    { username: 'tag.dndung@gmail.com', email: 'tag.dndung@gmail.com', password: '123456', fullname: 'Tổng giám đốc Đ.N. Dũng', role: 'director', departments: ['Ban Giám đốc'] },
    { username: 'cuong0169c@gmail.com', email: 'cuong0169c@gmail.com', password: '123456', fullname: 'Tổng giám đốc Cường', role: 'director', departments: ['Ban Giám đốc'] },

    // 3. Trưởng phòng các phòng ban
    // HCNS: 81nham@gmail.com, huyduongsishust5059@gmail.com, damvanluan1403@gmail.com
    // Kế toán: caocuong17479@gmail.com, huyduongsishust5059@gmail.com
    // Thu mua: caocuong17479@gmail.com, bintemp05@gmail.com
    { username: '81nham@gmail.com', email: '81nham@gmail.com', password: '123456', fullname: 'Trưởng phòng HCNS (81nham)', role: 'manager', departments: ['HCNS'] },
    { username: 'damvanluan1403@gmail.com', email: 'damvanluan1403@gmail.com', password: '123456', fullname: 'Đàm Văn Luận (Trưởng phòng HCNS)', role: 'manager', departments: ['HCNS'] },
    { username: 'huyduongsishust5059@gmail.com', email: 'huyduongsishust5059@gmail.com', password: '123456', fullname: 'Huy Dương (Trưởng phòng HCNS & Kế toán)', role: 'manager', departments: ['HCNS', 'Kế toán'] },
    { username: 'caocuong17479@gmail.com', email: 'caocuong17479@gmail.com', password: '123456', fullname: 'Cao Cường (Trưởng phòng Kế toán & Thu mua)', role: 'manager', departments: ['Kế toán', 'Thu mua'] },
    { username: 'bintemp05@gmail.com', email: 'bintemp05@gmail.com', password: '123456', fullname: 'Trưởng phòng Thu mua (bintemp05)', role: 'manager', departments: ['Thu mua'] },

    // 4. Nhân viên các phòng ban
    { username: 'tag.hcns8@gmail.com', email: 'tag.hcns8@gmail.com', password: '123456', fullname: 'Đỗ Thị Ánh Nguyệt', role: 'employee', departments: ['HCNS'] },
    { username: 'nhinguyen.tag1@gmail.com', email: 'nhinguyen.tag1@gmail.com', password: '123456', fullname: 'Nguyễn Thảo Nhi', role: 'employee', departments: ['HCNS'] },
    { username: 'tag.thitruong@gmail.com', email: 'tag.thitruong@gmail.com', password: '123456', fullname: 'Bùi Quang Tú', role: 'employee', departments: ['Thu mua'] },
    { username: 'tag.ketoan1@gmail.com', email: 'tag.ketoan1@gmail.com', password: '123456', fullname: 'Nguyễn Thị Hằng', role: 'employee', departments: ['Kế toán'] },
  ];

  const userIds = {};
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password, fullname, role, department)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertUd = db.prepare(`
    INSERT INTO user_departments (user_id, department, is_primary) VALUES (?, ?, ?)
  `);

  for (const u of users) {
    const id = uuidv4();
    userIds[u.username] = id;
    insertUser.run(id, u.username.toLowerCase(), u.email.toLowerCase(), bcrypt.hashSync(u.password, 10), u.fullname, u.role, u.departments[0]);
    u.departments.forEach((d, i) => insertUd.run(id, d, i === 0 ? 1 : 0));
  }

  // ============================================================
  // Seed Sample Tasks cho 3 phòng ban chính (HCNS, Kế toán, Thu mua)
  // ============================================================
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, code, name, description, department, collab_depts,
      assignee_id, created_by, start_date, end_date, progress, status, priority, results, notes, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSubtask = db.prepare(`
    INSERT INTO subtasks (id, task_id, name, description, assignee_id, start_date, end_date, progress, status, priority, results, notes, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO daily_logs (id, subtask_id, log_date, description, result, obstacle, progress, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  // Task 1: HCNS - Đào tạo & Đánh giá nhân sự Q4
  const t1id = uuidv4();
  insertTask.run(
    t1id, 'CV-HCNS-01', 'Tổ chức tuyển dụng & đào tạo nhân sự Quý 4',
    'Lên kế hoạch tuyển dụng nhân sự mới và tổ chức khóa đào tạo định hướng cho nhân viên mới.',
    'HCNS',
    JSON.stringify(['Ban Giám đốc']),
    userIds['huyduongsishust5059@gmail.com'], 'Tổng giám đốc Tiến Anh',
    shiftDays(-10), shiftDays(20),
    60, 'in_progress', 'high',
    'Đã tiếp nhận 20 hồ sơ tuyển dụng và hoàn thành 1 buổi đào tạo.',
    'Cần Ban Giám đốc duyệt bổ sung ngân sách đào tạo.',
    JSON.stringify(['urgent', 'recruitment', 'training']),
    now, now
  );

  const s1id = uuidv4();
  insertSubtask.run(s1id, t1id, 'Rà soát hồ sơ tuyển dụng và lên lịch phỏng vấn', '', userIds['tag.hcns8@gmail.com'],
    shiftDays(-10), shiftDays(2), 80, 'in_progress', 'high',
    'Đã lọc được 15 ứng viên phù hợp.', '',
    JSON.stringify(['recruitment']), now, now);

  const logs1 = [
    [shiftDays(-2), 'Đăng tin tuyển dụng trên các kênh online', 'Thu thập 30 CV', 'Không có', 40],
    [shiftDays(-1), 'Sàng lọc CV và gọi điện xác nhận phỏng vấn', 'Chốt danh sách 15 ứng viên', 'Không có', 70],
    [shiftDays(0),  'Gửi thư mời phỏng vấn và chuẩn bị phòng họp', 'Đã gửi mail cho 15 ứng viên', 'Không có', 80],
  ];
  for (const [date, desc, result, obstacle, prog] of logs1) {
    insertLog.run(uuidv4(), s1id, date, desc, result, obstacle, prog, userIds['tag.hcns8@gmail.com'], now);
  }

  insertSubtask.run(uuidv4(), t1id, 'Soạn thảo giáo trình đào tạo định hướng', '', userIds['nhinguyen.tag1@gmail.com'],
    shiftDays(-5), shiftDays(15), 40, 'in_progress', 'medium',
    'Đã hoàn thành Slide tổng quan công ty.', '',
    JSON.stringify(['training']), now, now);

  // Task 2: Kế toán - Quyết toán & Kiểm toán Quý 3
  const t2id = uuidv4();
  insertTask.run(
    t2id, 'CV-KT-01', 'Quyết toán tài chính & Báo cáo thuế Quý 3',
    'Rà soát hóa đơn chứng từ, đối soát công nợ và lập báo cáo tài chính quý 3.',
    'Kế toán', JSON.stringify(['Thu mua', 'Ban Giám đốc']),
    userIds['caocuong17479@gmail.com'], 'Tổng giám đốc Đ.N. Dũng',
    shiftDays(-15), shiftDays(10),
    75, 'in_progress', 'high',
    'Đã hoàn thành đối soát 90% hóa đơn chứng từ.',
    'Chờ đối soát nốt hợp đồng thu mua vật tư.',
    JSON.stringify(['audit', 'finance']), now, now
  );

  insertSubtask.run(uuidv4(), t2id, 'Rà soát hóa đơn và lập bảng cân đối công nợ', '', userIds['tag.ketoan1@gmail.com'],
    shiftDays(-15), shiftDays(5), 90, 'in_progress', 'high',
    'Đã đối soát xong công nợ với 25 nhà cung cấp.', '',
    JSON.stringify(['finance']), now, now);

  // Task 3: Thu mua - Cung ứng vật tư thiết bị
  const t3id = uuidv4();
  insertTask.run(
    t3id, 'CV-TM-01', 'Thu mua vật tư thiết bị phục vụ vận hành',
    'Khảo sát giá thị trường, đàm phán hợp đồng cung ứng vật tư hàng hóa cho các phòng ban.',
    'Thu mua', JSON.stringify(['Kế toán', 'HCNS']),
    userIds['bintemp05@gmail.com'], 'Tổng giám đốc Cường',
    shiftDays(-5), shiftDays(25),
    35, 'in_progress', 'medium',
    'Đã chốt báo giá từ 3 nhà cung cấp chính.', '',
    JSON.stringify(['procurement', 'vendor']), now, now
  );

  insertSubtask.run(uuidv4(), t3id, 'Khảo sát giá và đàm phán hợp đồng vật tư', '', userIds['tag.thitruong@gmail.com'],
    shiftDays(-5), shiftDays(10), 50, 'in_progress', 'high',
    'Đã đàm phán giảm được 5% chi phí mua hàng.', '',
    JSON.stringify(['procurement']), now, now);

  console.log('✅ Khởi tạo dữ liệu Hệ thống cũ hoàn tất!');
  console.log('');
  console.log('📋 Danh sách tài khoản đã khởi tạo:');
  console.log('  👑 Quản trị: admin / admin123');
  console.log('  🏢 Ban Giám đốc:');
  console.log('     - tienanhkinhbac@gmail.com / 123456');
  console.log('     - tag.dndung@gmail.com / 123456');
  console.log('     - cuong0169c@gmail.com / 123456');
  console.log('  👔 Trưởng phòng:');
  console.log('     - HCNS: 81nham@gmail.com, damvanluan1403@gmail.com, huyduongsishust5059@gmail.com');
  console.log('     - Kế toán: caocuong17479@gmail.com, huyduongsishust5059@gmail.com');
  console.log('     - Thu mua: caocuong17479@gmail.com, bintemp05@gmail.com');
  console.log('  🧑 Nhân viên:');
  console.log('     - Đỗ Thị Ánh Nguyệt (HCNS): tag.hcns8@gmail.com / 123456');
  console.log('     - Nguyễn Thảo Nhi (HCNS): nhinguyen.tag1@gmail.com / 123456');
  console.log('     - Bùi Quang Tú (Thu mua): tag.thitruong@gmail.com / 123456');
  console.log('     - Nguyễn Thị Hằng (Kế toán): tag.ketoan1@gmail.com / 123456');
}

module.exports = { seedIfEmpty };
