// ============================================================
// seed-construction.js — Dữ liệu thực tế công ty xây dựng (v3)
// Xóa data cũ & seed data mới phong phú thời gian gần (Quý 3 & Quý 4 / 2026)
// Giữ nguyên toàn bộ danh sách nhân sự cũ (11 tài khoản)
// ============================================================
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');
const db = require('./db');

// ─── helpers ───────────────────────────────────────────────
function shiftDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function pad(n, len = 3) { return String(n).padStart(len, '0'); }

/** Clear toàn bộ dữ liệu dự án, phase, bundle, task, subtask, log, history */
function clearOldData() {
  console.log('🗑️  Đang xóa dữ liệu cũ...');
  db.prepare('DELETE FROM daily_logs').run();
  db.prepare('DELETE FROM subtasks').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM assignment_bundles').run();
  db.prepare('DELETE FROM project_phases').run();
  db.prepare('DELETE FROM construction_projects').run();
  db.prepare('DELETE FROM history').run();
  db.prepare('DELETE FROM user_departments').run();
  db.prepare('DELETE FROM users').run();
  console.log('  ✓ Đã làm sạch toàn bộ các bảng trong CSDL.');
}

/** Tạo user; idempotent */
function createUser(u) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
  if (existing) return existing.id;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO users (id, username, email, password, fullname, role, department, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id, u.username, u.email || `${u.username}@company.com`,
    bcrypt.hashSync(u.password || '123456', 10),
    u.fullname, u.role, u.departments[0]
  );

  const ins = db.prepare('INSERT OR IGNORE INTO user_departments (user_id, department, is_primary) VALUES (?, ?, ?)');
  u.departments.forEach((d, i) => ins.run(id, d, i === 0 ? 1 : 0));
  return id;
}

// ─── main seed ─────────────────────────────────────────────
function seedConstruction(forceReset = false) {
  const hasData = db.prepare("SELECT COUNT(*) as c FROM construction_projects").get().c > 0;
  
  if (forceReset || !hasData) {
    if (forceReset && hasData) {
      clearOldData();
    }
  } else {
    console.log('✅ Dữ liệu công ty đã tồn tại, bỏ qua seed. (Dùng node reset-db.js để reset)');
    return;
  }

  console.log('🌱 Đang khởi tạo dữ liệu phong phú thời gian gần cho công ty xây dựng...');

  // ============================================================
  // 1. USERS (GIỮ NGUYÊN TOÀN BỘ NHÂN SỰ CŨ)
  // ============================================================
  const U = {};

  // Admin hệ thống
  U.admin = createUser({
    username: 'admin', fullname: 'Quản trị hệ thống',
    email: 'admin@company.com', password: 'admin123',
    role: 'admin', departments: ['ĐH', 'QLDA', 'KTTC', 'TC'],
  });

  // ĐH — Ban Điều hành (= BGĐ, tier 1)
  U.khanh = createUser({
    username: 'khanh', fullname: 'Khánh — Điều hành',
    role: 'director', departments: ['ĐH'],
  });
  U.nam = createUser({
    username: 'nam', fullname: 'Nam — Điều hành',
    role: 'director', departments: ['ĐH'],
  });

  // QLDA — Trưởng phòng + Nhân viên
  U.hung = createUser({
    username: 'hung', fullname: 'Hùng — TP.QLDA',
    role: 'manager', departments: ['QLDA'],
  });
  U.hong = createUser({
    username: 'hong', fullname: 'Hồng — NV.QLDA',
    role: 'employee', departments: ['QLDA'],
  });

  // KTTC — Trưởng phòng + 3 Nhân viên
  U.cuong = createUser({
    username: 'cuong', fullname: 'Cường — TP.KTTC',
    role: 'manager', departments: ['KTTC'],
  });
  U.nguyet = createUser({
    username: 'nguyet', fullname: 'Nguyệt — NV.KTTC',
    role: 'employee', departments: ['KTTC'],
  });
  U.hang = createUser({
    username: 'hang', fullname: 'Hằng — NV.KTTC',
    role: 'employee', departments: ['KTTC'],
  });
  U.tu = createUser({
    username: 'tu', fullname: 'Tú — NV.KTTC',
    role: 'employee', departments: ['KTTC'],
  });

  // TC — Trưởng phòng + Nhân viên
  U.thanh = createUser({
    username: 'thanh', fullname: 'Thành — TP.TC',
    role: 'manager', departments: ['TC'],
  });
  U.ngoc = createUser({
    username: 'ngoc', fullname: 'Ngọc — NV.TC',
    role: 'employee', departments: ['TC'],
  });

  console.log(`  ✓ Khởi tạo ${Object.keys(U).length} người dùng (Nhân sự giữ nguyên)`);

  // ============================================================
  // HELPERS BUILD DỮ LIỆU
  // ============================================================
  let bundleSeq = 0;
  let taskSeq = 0;

  function makeProject(code, name, desc, address, manager_id, s_offset, e_offset, status, budget) {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO construction_projects
        (id, code, name, description, address, project_manager_id,
         target_start, target_end, status, budget, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, code, name, desc, address, manager_id,
      shiftDays(s_offset), shiftDays(e_offset),
      status, budget,
      'Khánh — Điều hành',
      now, now
    );
    return id;
  }

  function makePhase(project_id, seq, name, status, s_offset, e_offset, actual_end_offset) {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO project_phases
        (id, project_id, name, sequence, target_start, target_end, actual_end, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, project_id, name, seq,
      shiftDays(s_offset), shiftDays(e_offset),
      actual_end_offset != null ? shiftDays(actual_end_offset) : null,
      status, now, now
    );
    return id;
  }

  function makeBundle(opts) {
    bundleSeq++;
    const id = uuidv4();
    const code = `GV${pad(bundleSeq)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO assignment_bundles
        (id, code, name, description, project_id, phase_id, owner_id, department,
         start_date, due_date, status, progress, priority,
         collaborating_depts, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, code,
      opts.name, opts.desc || '',
      opts.project_id, opts.phase_id,
      opts.owner_id, opts.dept,
      shiftDays(opts.start_offset ?? 0),
      shiftDays(opts.due_offset),
      opts.status || 'assigned',
      opts.progress || 0,
      opts.priority || 'medium',
      JSON.stringify(opts.collab_depts || []),
      opts.created_by || 'Khánh — Điều hành',
      now, now
    );
    return id;
  }

  function makeTask(opts) {
    taskSeq++;
    const id = uuidv4();
    const code = `CV${pad(taskSeq, 4)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks
        (id, code, name, description, department, assignee_id, created_by,
         start_date, end_date, progress, status, priority, results, notes,
         project_id, bundle_id, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).run(
      id, code,
      opts.name, opts.desc || '',
      opts.dept, opts.assignee_id,
      opts.created_by || 'Khánh — Điều hành',
      shiftDays(opts.start_offset ?? 0),
      shiftDays(opts.end_offset),
      opts.progress || 0,
      opts.status || 'not_started',
      opts.priority || 'medium',
      opts.results || '',
      opts.notes || '',
      opts.project_id || null,
      opts.bundle_id || null,
      now, now
    );
    return id;
  }

  function makeSubTask(opts) {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO subtasks
        (id, task_id, name, description, assignee_id, start_date, end_date,
         progress, status, priority, results, notes, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
    `).run(
      id, opts.task_id, opts.name, opts.desc || '',
      opts.assignee_id,
      shiftDays(opts.start_offset ?? 0),
      shiftDays(opts.end_offset),
      opts.progress || 0,
      opts.status || 'not_started',
      opts.priority || 'medium',
      opts.results || '',
      opts.notes || '',
      now, now
    );
    return id;
  }

  function makeDailyLog(opts) {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO daily_logs
        (id, subtask_id, log_date, description, result, obstacle, progress, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, opts.subtask_id,
      shiftDays(opts.days_offset),
      opts.desc || '',
      opts.result || '',
      opts.obstacle || '',
      opts.progress || 0,
      opts.user_id,
      now
    );
    return id;
  }

  function makeHistory(entity_type, entity_id, action, user_id, user_name) {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO history (id, entity_type, entity_id, action, user_id, user_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entity_type, entity_id, action, user_id, user_name, now);
    return id;
  }

  // ============================================================
  // 2. DỰ ÁN 1: DA-CCM-001 — Chung cư mini 7 tầng Hoàng Mai (Đang thi công phần thô)
  // ============================================================
  const p1 = makeProject(
    'DA-CCM-001', 'Chung cư mini 7 tầng Hoàng Mai',
    'Xây dựng tòa nhà chung cư mini 7 tầng + 1 tầng hầm, diện tích sàn 450m². CĐT: Ông Trần Văn Bình.',
    '68 Nguyễn Đức Cảnh, Hoàng Mai, Hà Nội',
    U.khanh,
    -60, 120,
    'in_progress', 12500000000
  );
  makeHistory('project', p1, 'Tạo dự án "Chung cư mini 7 tầng Hoàng Mai"', U.khanh, 'Khánh — Điều hành');

  // Phase 1: Chuẩn bị pháp lý & Thiết kế thi công (Hoàn thành)
  const ph1_1 = makePhase(p1, 1, 'Chuẩn bị pháp lý & Thiết kế thi công', 'completed', -60, -25, -25);
  
  const b1_1 = makeBundle({
    project_id: p1, phase_id: ph1_1, owner_id: U.hung, dept: 'QLDA',
    name: 'Lập hồ sơ Giấy phép xây dựng & Bản vẽ thi công',
    desc: 'Thu thập giấy tờ đất, lập thiết kế kết cấu, nộp hồ sơ xin cấp phép GPXD.',
    start_offset: -60, due_offset: -30, status: 'closed', progress: 100, priority: 'high', collab_depts: ['KTTC']
  });
  makeTask({
    bundle_id: b1_1, project_id: p1, dept: 'QLDA', assignee_id: U.hong,
    name: 'Thu thập Giấy chứng nhận QSDĐ & Hồ sơ pháp lý hiện trạng',
    start_offset: -60, end_offset: -45, progress: 100, status: 'completed', priority: 'high',
    results: 'Đã hoàn tất xác minh ranh giới thửa đất và nộp bản đồ hiện trạng.'
  });
  makeTask({
    bundle_id: b1_1, project_id: p1, dept: 'QLDA', assignee_id: U.hung,
    name: 'Thiết kế bản vẽ thi công tầng hầm + 7 tầng nổi',
    start_offset: -45, end_offset: -30, progress: 100, status: 'completed', priority: 'high',
    results: 'Hồ sơ thiết kế kết cấu bê tông M300 đã được kiến trúc sư thẩm định.'
  });

  const b1_2 = makeBundle({
    project_id: p1, phase_id: ph1_1, owner_id: U.cuong, dept: 'KTTC',
    name: 'Lập dự toán tổng mức đầu tư & Kế hoạch ngân sách',
    desc: 'Khảo sát đơn giá vật liệu xây dựng, bốc tách dự toán kinh phí thi công 12.5 tỷ.',
    start_offset: -55, due_offset: -25, status: 'closed', progress: 100, priority: 'high'
  });
  makeTask({
    bundle_id: b1_2, project_id: p1, dept: 'KTTC', assignee_id: U.nguyet,
    name: 'Khảo sát báo giá sắt thép Hòa Phát, bê tông M300',
    start_offset: -55, end_offset: -40, progress: 100, status: 'completed',
    results: 'Chốt hợp đồng nguyên tắc nhà cung cấp bê tông Việt Hàn.'
  });

  // Phase 2: Thi công phần móng & Khung BTCT phần thô (Đang triển khai)
  const ph1_2 = makePhase(p1, 2, 'Thi công móng & Kết cấu phần thô', 'in_progress', -25, 45, null);

  const b1_3 = makeBundle({
    project_id: p1, phase_id: ph1_2, owner_id: U.thanh, dept: 'TC',
    name: 'Giám sát ép cọc D400 & Thi công móng tầng hầm',
    desc: 'Trực tiếp giám sát ép cọc bê tông, thi công dầm móng và sàn tầng hầm.',
    start_offset: -25, due_offset: 15, status: 'in_progress', progress: 75, priority: 'high'
  });

  const t1_1 = makeTask({
    bundle_id: b1_3, project_id: p1, dept: 'TC', assignee_id: U.thanh,
    name: 'Giám sát thi công ép 48 cọc bê tông D400 sâu 22m',
    start_offset: -25, end_offset: -10, progress: 100, status: 'completed', priority: 'high',
    results: '100% cọc ép đạt tải trọng thiết kế Pmax = 120 tấn.'
  });

  const t1_2 = makeTask({
    bundle_id: b1_3, project_id: p1, dept: 'TC', assignee_id: U.ngoc,
    name: 'Thi công cốt thép dầm móng & Đổ bê tông móng băng',
    start_offset: -10, end_offset: 10, progress: 80, status: 'in_progress', priority: 'high',
    results: 'Đã hoàn thành 80% khối lượng bê tông móng băng và hầm.'
  });

  const sub1_1 = makeSubTask({
    task_id: t1_2, assignee_id: U.ngoc, name: 'Gia công cốt thép dầm móng D18/D22',
    start_offset: -10, end_offset: -2, progress: 100, status: 'completed', priority: 'high',
    results: 'Nghiệm thu thép móng đạt khoảng cách đai 150mm.'
  });
  makeDailyLog({ subtask_id: sub1_1, user_id: U.ngoc, days_offset: -8, desc: 'Kiểm tra mật độ đai thép dầm móng D18, khoảng cách 150mm.', result: 'Đạt tiêu chuẩn TCVN', obstacle: 'Không', progress: 50 });
  makeDailyLog({ subtask_id: sub1_1, user_id: U.ngoc, days_offset: -3, desc: 'Hoàn thành buộc thép dầm móng khung trục A-D. Chờ CĐT nghiệm thu.', result: 'Ký biên bản nghiệm thu chuyển bước', obstacle: 'Mưa nhẹ buổi sáng', progress: 100 });

  const sub1_2 = makeSubTask({
    task_id: t1_2, assignee_id: U.ngoc, name: 'Đổ 350m³ bê tông thương phẩm M300 móng & Sàn hầm',
    start_offset: -2, end_offset: 5, progress: 75, status: 'in_progress', priority: 'high'
  });
  makeDailyLog({ subtask_id: sub1_2, user_id: U.ngoc, days_offset: -2, desc: 'Đổ đợt 1 được 200m³ bê tông móng băng. Lấy 6 mẫu thử nén.', result: 'Bê tông đầm kỹ, không rỗ mặt', obstacle: 'Không', progress: 50 });
  makeDailyLog({ subtask_id: sub1_2, user_id: U.ngoc, days_offset: 0, desc: 'Đổ tiếp đợt 2 được 100m³ bê tông sàn hầm. Thời tiết thuận lợi.', result: 'Tiến độ đúng kế hoạch', obstacle: 'Không', progress: 75 });

  const b1_4 = makeBundle({
    project_id: p1, phase_id: ph1_2, owner_id: U.hung, dept: 'QLDA',
    name: 'Quản lý nhà thầu phụ & Cung ứng vật tư móng',
    desc: 'Tổ chức quản lý các gói thầu thi công cốt thép, bê tông tươi và vật tư gạch.',
    start_offset: -20, due_offset: 20, status: 'in_progress', progress: 60, priority: 'high', collab_depts: ['KTTC']
  });
  makeTask({
    bundle_id: b1_4, project_id: p1, dept: 'QLDA', assignee_id: U.hong,
    name: 'Theo dõi tiến độ cung ứng sắt thép Hòa Phát đợt 1',
    start_offset: -15, end_offset: 10, progress: 65, status: 'in_progress', priority: 'medium',
    results: 'Đã nhập kho 45 tấn thép D10-D25 đạt chứng chỉ CO/CQ.'
  });

  const b1_5 = makeBundle({
    project_id: p1, phase_id: ph1_2, owner_id: U.cuong, dept: 'KTTC',
    name: 'Thanh toán tiến độ & Kiểm soát ngân sách thi công đợt 1',
    desc: 'Kiểm tra khối lượng thực tế công trường, lập phiếu chi và giải ngân tiến độ.',
    start_offset: -10, due_offset: 25, status: 'in_progress', progress: 50, priority: 'high'
  });
  makeTask({
    bundle_id: b1_5, project_id: p1, dept: 'KTTC', assignee_id: U.hang,
    name: 'Thanh toán đợt 1 cho đội thi công ép cọc & làm móng',
    start_offset: -10, end_offset: 2, progress: 80, status: 'in_progress', priority: 'high',
    notes: 'Đã giải ngân 420 triệu tiền ép cọc.'
  });

  // Phase 3 & Phase 4
  const ph1_3 = makePhase(p1, 3, 'Thi công hoàn thiện & Hệ thống M&E', 'pending', 45, 100, null);
  makeBundle({
    project_id: p1, phase_id: ph1_3, owner_id: U.thanh, dept: 'TC',
    name: 'Thi công hệ thống Điện nước M&E & PCCC âm tường',
    start_offset: 45, due_offset: 90, status: 'assigned', progress: 0, priority: 'medium'
  });

  const ph1_4 = makePhase(p1, 4, 'Nghiệm thu PCCC & Bàn giao quyết toán', 'pending', 100, 120, null);
  makeBundle({
    project_id: p1, phase_id: ph1_4, owner_id: U.cuong, dept: 'KTTC',
    name: 'Hồ sơ quyết toán công trình & Bàn giao CĐT',
    start_offset: 105, due_offset: 120, status: 'assigned', progress: 0, priority: 'high'
  });

  console.log('  ✓ Tạo Dự án 1: DA-CCM-001 (Chung cư mini 7 tầng Hoàng Mai)');

  // ============================================================
  // 3. DỰ ÁN 2: DA-BT-002 — Biệt thự Tân cổ điển Vinhomes Riverside (Lập hồ sơ & Chuẩn bị)
  // ============================================================
  const p2 = makeProject(
    'DA-BT-002', 'Biệt thự Tân cổ điển 3 tầng Vinhomes Riverside',
    'Thiết kế & Thi công hoàn thiện trọn gói biệt thự đơn lập 3 tầng, 380m² sàn. CĐT: Bà Lê Thị Hoa.',
    'Bằng Lăng 5-12, Vinhomes Riverside, Long Biên, Hà Nội',
    U.nam,
    -20, 90,
    'in_progress', 6800000000
  );
  makeHistory('project', p2, 'Tạo dự án "Biệt thự Tân cổ điển 3 tầng Vinhomes Riverside"', U.nam, 'Nam — Điều hành');

  const ph2_1 = makePhase(p2, 1, 'Thiết kế 3D Nội thất & Xin phép cải tạo', 'in_progress', -20, 10, null);

  const b2_1 = makeBundle({
    project_id: p2, phase_id: ph2_1, owner_id: U.hung, dept: 'QLDA',
    name: 'Chốt phương án 3D Kiến trúc & Mẫu vật liệu cao cấp',
    desc: 'Thiết kế phối cảnh 3D phòng khách, bếp, 4 phòng ngủ & Trình mẫu đá Marble Ý.',
    start_offset: -20, due_offset: 5, status: 'in_progress', progress: 85, priority: 'high'
  });

  const t2_1 = makeTask({
    bundle_id: b2_1, project_id: p2, dept: 'QLDA', assignee_id: U.hong,
    name: 'Phối cảnh 3D ngoại thất phong cách Tân cổ điển',
    start_offset: -20, end_offset: -5, progress: 100, status: 'completed', priority: 'high',
    results: 'Chủ nhà đã phê duyệt bản vẽ thiết kế 3D ngoại thất.'
  });

  const t2_2 = makeTask({
    bundle_id: b2_1, project_id: p2, dept: 'QLDA', assignee_id: U.hung,
    name: 'Duyệt bản vẽ chi tiết điện nước M&E với gia chủ',
    start_offset: -10, end_offset: 5, progress: 75, status: 'in_progress', priority: 'high'
  });

  const sub2_1 = makeSubTask({
    task_id: t2_2, assignee_id: U.hong, name: 'Trình duyệt mẫu đá Marble Calacatta & Gỗ Óc chó',
    start_offset: -8, end_offset: 0, progress: 90, status: 'in_progress', priority: 'high'
  });
  makeDailyLog({ subtask_id: sub2_1, user_id: U.hong, days_offset: -3, desc: 'Cùng CĐT xem 5 mẫu đá Marble tại kho Long Biên.', result: 'CĐT chốt mẫu đá vân mây M-08', obstacle: 'Không', progress: 70 });
  makeDailyLog({ subtask_id: sub2_1, user_id: U.hong, days_offset: 0, desc: 'Trình bảng màu sơn Dulux & Mẫu gỗ Óc chó lát sàn.', result: 'CĐT đã ký xác nhận mẫu vật liệu', obstacle: 'Không', progress: 90 });

  const b2_2 = makeBundle({
    project_id: p2, phase_id: ph2_1, owner_id: U.cuong, dept: 'KTTC',
    name: 'Lập dự toán thi công trọn gói biệt thự',
    desc: 'Tính toán kinh phí phần thô, hoàn thiện nội thất và thiết bị Smarthome.',
    start_offset: -15, due_offset: 10, status: 'in_progress', progress: 80, priority: 'medium'
  });
  makeTask({
    bundle_id: b2_2, project_id: p2, dept: 'KTTC', assignee_id: U.nguyet,
    name: 'Báo giá thiết bị vệ sinh Kohler & Hệ thống điện thông minh',
    start_offset: -15, end_offset: -2, progress: 100, status: 'completed',
    results: 'Đã nhận báo giá chiết khấu 25% từ đại lý Kohler chính hãng.'
  });

  const ph2_2 = makePhase(p2, 2, 'Tháo dỡ & Thi công ép cọc móng', 'pending', 10, 40, null);
  makeBundle({
    project_id: p2, phase_id: ph2_2, owner_id: U.thanh, dept: 'TC',
    name: 'Giám sát tháo dỡ & Đào móng ép cọc nhồi D300',
    start_offset: 10, due_offset: 35, status: 'assigned', progress: 0, priority: 'high'
  });

  console.log('  ✓ Tạo Dự án 2: DA-BT-002 (Biệt thự Tân cổ điển Vinhomes)');

  // ============================================================
  // 4. DỰ ÁN 3: DA-KXS-003 — Nhà máy & Kho xưởng 2000m² Bắc Ninh (Vừa hoàn thành)
  // ============================================================
  const p3 = makeProject(
    'DA-KXS-003', 'Nhà máy & Kho xưởng công nghiệp 2000m² Bắc Ninh',
    'Xây dựng kho xưởng khung thép tiền chế 2000m², sàn bê tông chịu lực 5 tấn/m². Đã bàn giao.',
    'KCN Tiên Sơn, Tiên Du, Bắc Ninh',
    U.khanh,
    -150, -10,
    'completed', 18500000000
  );
  db.prepare("UPDATE construction_projects SET actual_end = ? WHERE id = ?").run(shiftDays(-5), p3);
  makeHistory('project', p3, 'Tạo dự án "Nhà máy & Kho xưởng công nghiệp 2000m² Bắc Ninh"', U.khanh, 'Khánh — Điều hành');

  const ph3_1 = makePhase(p3, 1, 'Pháp lý KCN & Thiết kế nhà thép', 'completed', -150, -110, -110);
  const b3_1 = makeBundle({
    project_id: p3, phase_id: ph3_1, owner_id: U.hung, dept: 'QLDA',
    name: 'Xin phép xây dựng KCN & Thẩm định PCCC nhà xưởng',
    start_offset: -150, due_offset: -115, status: 'closed', progress: 100, priority: 'high'
  });
  makeTask({
    bundle_id: b3_1, project_id: p3, dept: 'QLDA', assignee_id: U.hung,
    name: 'Khảo sát địa chất & Nộp hồ sơ BQL KCN Bắc Ninh',
    start_offset: -150, end_offset: -115, progress: 100, status: 'completed',
    results: 'Đã nhận Giấy phép xây dựng số 48/GPXD-BQL.'
  });

  const ph3_2 = makePhase(p3, 2, 'Thi công kết cấu khung thép & Lợp mái', 'completed', -110, -40, -42);
  const b3_2 = makeBundle({
    project_id: p3, phase_id: ph3_2, owner_id: U.thanh, dept: 'TC',
    name: 'Gia công 160 tấn khung thép & Lợp tôn PE Kliplok',
    start_offset: -110, due_offset: -45, status: 'closed', progress: 100, priority: 'high'
  });
  makeTask({
    bundle_id: b3_2, project_id: p3, dept: 'TC', assignee_id: U.ngoc,
    name: 'Lắp dựng khung nhà thép bằng cẩu 50 tấn',
    start_offset: -100, end_offset: -60, progress: 100, status: 'completed',
    results: 'Lắp dựng 12 vì kèo thép an toàn tuyệt đối.'
  });

  const ph3_3 = makePhase(p3, 3, 'Bê tông nền xưởng & Hệ thống PCCC', 'completed', -40, -15, -15);
  const b3_3 = makeBundle({
    project_id: p3, phase_id: ph3_3, owner_id: U.thanh, dept: 'TC',
    name: 'Đổ bê tông nền xưởng 2000m² xoa Sika Green & PCCC',
    start_offset: -40, due_offset: -18, status: 'closed', progress: 100, priority: 'high'
  });
  const t3_1 = makeTask({
    bundle_id: b3_3, project_id: p3, dept: 'TC', assignee_id: U.ngoc,
    name: 'Đổ bê tông tươi M300 dày 200mm & Xoa nền tăng cứng',
    start_offset: -38, end_offset: -20, progress: 100, status: 'completed', priority: 'high'
  });
  const sub3_1 = makeSubTask({
    task_id: t3_1, assignee_id: U.ngoc, name: 'Xoa nền đánh bóng Sika Green 2000m²',
    start_offset: -35, end_offset: -20, progress: 100, status: 'completed'
  });
  makeDailyLog({ subtask_id: sub3_1, user_id: U.ngoc, days_offset: -30, desc: 'Đổ 400m³ bê tông nền. Đội xoa nền làm việc liên tục 14 tiếng.', result: 'Mặt nền phẳng bóng, không nứt nẻ', obstacle: 'Không', progress: 100 });

  const ph3_4 = makePhase(p3, 4, 'Nghiệm thu bàn giao & Quyết toán', 'completed', -15, -10, -5);
  const b3_4 = makeBundle({
    project_id: p3, phase_id: ph3_4, owner_id: U.cuong, dept: 'KTTC',
    name: 'Quyết toán công trình & Thanh lý hợp đồng',
    start_offset: -15, due_offset: -5, status: 'closed', progress: 100, priority: 'high'
  });
  makeTask({
    bundle_id: b3_4, project_id: p3, dept: 'KTTC', assignee_id: U.cuong,
    name: 'Nghiệm thu bàn giao đưa nhà xưởng vào hoạt động',
    start_offset: -12, end_offset: -5, progress: 100, status: 'completed',
    results: 'Đã nghiệm thu PCCC và thu hồi 100% công nợ 18.35 tỷ.'
  });

  console.log('  ✓ Tạo Dự án 3: DA-KXS-003 (Kho xưởng công nghiệp 2000m² Bắc Ninh — Hoàn thành)');

  // ============================================================
  // 5. DỰ ÁN 4: DA-SCL-004 — Cải tạo Trụ sở VP Techcombank (Khẩn cấp / Đang thi công)
  // ============================================================
  const p4 = makeProject(
    'DA-SCL-004', 'Cải tạo & Sửa chữa nâng cấp Trụ sở VP Techcom',
    'Cải tạo 3 tầng văn phòng làm việc 650m², thi công trần thạch cao, vách kính & M&E.',
    '18 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
    U.nam,
    -25, 25,
    'in_progress', 3200000000
  );
  makeHistory('project', p4, 'Tạo dự án "Cải tạo Trụ sở VP Techcom"', U.nam, 'Nam — Điều hành');

  const ph4_1 = makePhase(p4, 1, 'Tháo dỡ & Cải tạo mặt bằng cũ', 'completed', -25, -10, -10);
  const b4_1 = makeBundle({
    project_id: p4, phase_id: ph4_1, owner_id: U.thanh, dept: 'TC',
    name: 'Tháo dỡ trần cũ & Đập phá tường nới rộng phòng họp',
    start_offset: -25, due_offset: -12, status: 'closed', progress: 100, priority: 'high'
  });
  makeTask({
    bundle_id: b4_1, project_id: p4, dept: 'TC', assignee_id: U.ngoc,
    name: 'Giám sát tháo dỡ nội thất cũ & Dọn dẹp phế thải',
    start_offset: -25, end_offset: -12, progress: 100, status: 'completed',
    results: 'Đã vận chuyển 14 chuyến xe phế thải rời khỏi công trường.'
  });

  const ph4_2 = makePhase(p4, 2, 'Thi công Trần thạch cao, Vách kính & M&E', 'in_progress', -10, 15, null);
  const b4_2 = makeBundle({
    project_id: p4, phase_id: ph4_2, owner_id: U.thanh, dept: 'TC',
    name: 'Thi công trần thạch cao Vĩnh Tường & M&E âm trần',
    start_offset: -10, due_offset: 10, status: 'in_progress', progress: 75, priority: 'high'
  });
  const t4_1 = makeTask({
    bundle_id: b4_2, project_id: p4, dept: 'TC', assignee_id: U.thanh,
    name: 'Đi dây điện Cadivi, Dây mạng Cat6 & Ống điều hòa âm trần',
    start_offset: -10, end_offset: -2, progress: 100, status: 'completed', priority: 'high',
    results: 'Đã đo đạc thử áp lực đường ống đồng đạt 350 PSI.'
  });
  const t4_2 = makeTask({
    bundle_id: b4_2, project_id: p4, dept: 'TC', assignee_id: U.ngoc,
    name: 'Bắn tấm thạch cao Gyproc chống ẩm & Trét bột sơn Dulux',
    start_offset: -2, end_offset: 10, progress: 65, status: 'in_progress', priority: 'high'
  });
  const sub4_1 = makeSubTask({
    task_id: t4_2, assignee_id: U.ngoc, name: 'Bắn 650m² tấm thạch cao khu VP làm việc',
    start_offset: -2, end_offset: 5, progress: 70, status: 'in_progress', priority: 'high'
  });
  makeDailyLog({ subtask_id: sub4_1, user_id: U.ngoc, days_offset: -2, desc: 'Đóng khung xương sắt nẹp Vĩnh Tường tầng 2.', result: 'Khung xương phẳng, chắc chắn', obstacle: 'Không', progress: 40 });
  makeDailyLog({ subtask_id: sub4_1, user_id: U.ngoc, days_offset: 0, desc: 'Bắn xong 450m² tấm thạch cao chống ẩm. Xử lý mối nối.', result: 'Bề mặt trần phẳng đẹp', obstacle: 'Không', progress: 70 });

  const b4_3 = makeBundle({
    project_id: p4, phase_id: ph4_2, owner_id: U.hung, dept: 'QLDA',
    name: 'Cung cấp & Lắp đặt vách kính cường lực 12mm',
    start_offset: -8, due_offset: 12, status: 'in_progress', progress: 60, priority: 'medium'
  });
  const t4_3 = makeTask({
    bundle_id: b4_3, project_id: p4, dept: 'QLDA', assignee_id: U.hong,
    name: 'Lắp đặt 180m² vách kính cường lực & Cửa thủy lực',
    start_offset: -5, end_offset: 8, progress: 60, status: 'in_progress'
  });
  const sub4_2 = makeSubTask({
    task_id: t4_3, assignee_id: U.hong, name: 'Lắp vách kính phòng họp & Phòng Giám đốc',
    start_offset: -1, end_offset: 8, progress: 40, status: 'in_progress'
  });
  makeDailyLog({ subtask_id: sub4_2, user_id: U.hong, days_offset: -1, desc: 'Tập kết 24 tấm kính cường lực 12mm lên tầng 3.', result: 'Đã định vị 6 ô kính phòng họp', obstacle: 'Không', progress: 40 });

  const ph4_3 = makePhase(p4, 3, 'Lắp đặt nội thất VP & Bàn giao', 'pending', 15, 25, null);
  makeBundle({
    project_id: p4, phase_id: ph4_3, owner_id: U.cuong, dept: 'KTTC',
    name: 'Nghiệm thu bàn giao & Thanh toán quyết toán',
    start_offset: 15, due_offset: 25, status: 'assigned', progress: 0, priority: 'high'
  });

  console.log('  ✓ Tạo Dự án 4: DA-SCL-004 (Cải tạo Trụ sở VP Techcombank)');

  // ============================================================
  // 6. TỰ ĐỘNG TÍNH TOÁN TIẾN ĐỘ CHÍNH XÁC (Recalculate Progress)
  // ============================================================
  console.log('  🔄 Đang tính toán tiến độ tổng hợp...');

  // Recalc task progress from subtasks
  const allTasks = db.prepare('SELECT id FROM tasks').all();
  for (const t of allTasks) {
    const subs = db.prepare('SELECT progress FROM subtasks WHERE task_id = ?').all(t.id);
    if (subs.length > 0) {
      const avg = Math.round(subs.reduce((s, r) => s + r.progress, 0) / subs.length);
      db.prepare('UPDATE tasks SET progress = ? WHERE id = ?').run(avg, t.id);
    }
  }

  // Recalc bundle progress from tasks
  const allBundles = db.prepare('SELECT id FROM assignment_bundles').all();
  for (const b of allBundles) {
    const ts = db.prepare('SELECT progress FROM tasks WHERE bundle_id = ?').all(b.id);
    if (ts.length > 0) {
      const avg = Math.round(ts.reduce((s, r) => s + r.progress, 0) / ts.length);
      db.prepare('UPDATE assignment_bundles SET progress = ? WHERE id = ?').run(avg, b.id);
    }
  }

  console.log('');
  console.log('✅ Khởi tạo dữ liệu phong phú thành công!');
  console.log('');
  console.log('📋 Danh sách nhân sự & tài khoản (Mật khẩu: 123456, admin: admin123):');
  console.log('  👑 Admin:    admin / admin123');
  console.log('  🏢 ĐH:       khanh / 123456   (Điều hành — Khánh)');
  console.log('               nam   / 123456   (Điều hành — Nam)');
  console.log('  👔 QLDA:     hung  / 123456   (Trưởng phòng — Hùng)');
  console.log('               hong  / 123456   (Nhân viên — Hồng)');
  console.log('  👔 KTTC:     cuong / 123456   (Trưởng phòng — Cường)');
  console.log('               nguyet/ 123456   (Nhân viên — Nguyệt)');
  console.log('               hang  / 123456   (Nhân viên — Hằng)');
  console.log('               tu    / 123456   (Nhân viên — Tú)');
  console.log('  👔 TC:       thanh / 123456   (Trưởng phòng — Thành)');
  console.log('               ngoc  / 123456   (Nhân viên — Ngọc)');
  console.log('');
  console.log('📊 Dự án phong phú thời gian gần (T10/2026):');
  console.log('  🏗️  DA-CCM-001  Chung cư mini 7 tầng Hoàng Mai  (Đang thi công phần thô)');
  console.log('  🏠  DA-BT-002   Biệt thự 3 tầng Vinhomes        (Đang duyệt 3D & vật liệu)');
  console.log('  🏭  DA-KXS-003  Kho xưởng 2000m² Bắc Ninh       (Đã hoàn thành bàn giao)');
  console.log('  🏬  DA-SCL-004  Cải tạo Trụ sở VP Techcom       (Đang thi công gấp M&E/Trần)');
}

// CLI execution: node seed-construction.js [--reset]
if (require.main === module) {
  try {
    const isReset = process.argv.includes('--reset');
    seedConstruction(isReset);
  } catch (e) {
    console.error('❌ Seed thất bại:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

module.exports = { seedConstruction };
