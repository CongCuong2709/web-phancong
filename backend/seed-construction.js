// ============================================================
// seed-construction.js — Dữ liệu thực tế công ty xây dựng
// Idempotent: bỏ qua nếu đã có user 'khanh'
// Reset: node reset-db.js  →  xóa DB → chạy file này lại
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

/** Tạo user; idempotent (trả về id cũ nếu đã tồn tại). */
function createUser(u) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
  if (existing) return existing.id;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO users (id, username, email, password, fullname, role, department, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, u.username, u.email || `${u.username}@company.com`,
         bcrypt.hashSync(u.password || '123456', 10),
         u.fullname, u.role, u.departments[0]);

  const ins = db.prepare('INSERT OR IGNORE INTO user_departments (user_id, department, is_primary) VALUES (?, ?, ?)');
  u.departments.forEach((d, i) => ins.run(id, d, i === 0 ? 1 : 0));
  return id;
}

// ─── main seed ─────────────────────────────────────────────
function seedConstruction() {
  // Idempotent guard
  if (db.prepare("SELECT id FROM users WHERE username = 'khanh'").get()) {
    console.log('✅ Dữ liệu công ty đã tồn tại (user khanh), bỏ qua seed.');
    return;
  }

  console.log('🌱 Đang khởi tạo dữ liệu công ty xây dựng...');

  // ============================================================
  // 1. USERS
  // ============================================================
  //
  //  Ký hiệu  Phụ trách  Thành viên              Nhiệm vụ
  //  ĐH       Khánh      Khánh, Nam               Điều hành chung, pháp lý, tổ chức   [BGĐ]
  //  QLDA     Hùng       Hùng, Hồng               Nội dung công việc triển khai DA      [TP + NV]
  //  KTTC     Cường      Cường, Nguyệt, Hằng, Tú  Thanh quyết toán, mua bán vật tư     [TP + NV]
  //  TC       Thành      Thành, Ngọc              Triển khai hiện trường                [TP + NV]
  //
  const U = {}; // map key → id

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

  console.log(`  ✓ Tạo ${Object.keys(U).length} người dùng`);

  // ============================================================
  // 2. HELPERS tạo bundle + task
  // ============================================================
  let bundleSeq = 0;
  let taskSeq = 0;

  function makeBundle(opts) {
    // opts: { project_id, phase_id, owner_id, dept, name, desc, start_offset, due_offset,
    //         status, progress, priority, collab_depts }
    bundleSeq++;
    const id = uuidv4();
    const code = `GV${pad(bundleSeq)}`;
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
      new Date().toISOString(),
      new Date().toISOString(),
    );
    return id;
  }

  function makeTask(opts) {
    // opts: { bundle_id, project_id, dept, assignee_id, name, start_offset, end_offset,
    //         progress, status, priority }
    taskSeq++;
    const id = uuidv4();
    const code = `CV${pad(taskSeq, 4)}`;
    db.prepare(`
      INSERT INTO tasks
        (id, code, name, description, department, assignee_id, created_by,
         start_date, end_date, progress, status, priority,
         project_id, bundle_id, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)
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
      opts.project_id || null,
      opts.bundle_id || null,
      new Date().toISOString(),
      new Date().toISOString(),
    );
    return id;
  }

  function makePhase(project_id, seq, name, status, s_offset, e_offset, actual_end_offset) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO project_phases
        (id, project_id, name, sequence, target_start, target_end, actual_end, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, project_id, name, seq,
           shiftDays(s_offset), shiftDays(e_offset),
           actual_end_offset != null ? shiftDays(actual_end_offset) : null,
           status);
    return id;
  }

  function makeProject(code, name, desc, address, manager_id, s_offset, e_offset, status, budget) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO construction_projects
        (id, code, name, description, address, project_manager_id,
         target_start, target_end, status, budget, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, name, desc, address, manager_id,
           shiftDays(s_offset), shiftDays(e_offset),
           status, budget,
           'Khánh — Điều hành',
           new Date().toISOString(), new Date().toISOString());
    return id;
  }

  // ============================================================
  // 3. DỰ ÁN A — Chung cư mini 5 tầng (đang triển khai)
  //    Ký hiệu: DA-CCM-001
  // ============================================================
  const pA = makeProject(
    'DA-CCM-001', 'Chung cư mini 5 tầng Hoàng Mai',
    'Xây dựng chung cư mini 5 tầng + 1 tầng hầm, 20 căn, diện tích 400m². Chủ đầu tư: Ông Trần Văn Bình.',
    '68 Nguyễn Đức Cảnh, Hoàng Mai, Hà Nội',
    U.khanh,
    -90, 180,   // đã bắt đầu 90 ngày trước, dự kiến xong sau 180 ngày
    'in_progress', 8500000000, // 8.5 tỷ
  );

  // Phase 1: Chuẩn bị pháp lý (đã hoàn thành)
  const phA1 = makePhase(pA, 1, 'Chuẩn bị pháp lý & hồ sơ đầu tư', 'completed', -90, -30, -35);

  const bA1 = makeBundle({
    project_id: pA, phase_id: phA1,
    owner_id: U.hung, dept: 'QLDA',
    name: 'Lập hồ sơ pháp lý & thiết kế cơ sở',
    desc: 'Thu thập giấy tờ đất, lập hồ sơ thiết kế cơ sở, chuẩn bị hồ sơ xin GPXD.',
    start_offset: -90, due_offset: -40,
    status: 'closed', progress: 100, priority: 'high',
    collab_depts: ['KTTC'],
  });
  makeTask({ bundle_id: bA1, project_id: pA, dept: 'QLDA', assignee_id: U.hong,
    name: 'Thu thập giấy tờ quyền sử dụng đất và pháp lý hiện trạng',
    start_offset: -90, end_offset: -75, progress: 100, status: 'completed', priority: 'high' });
  makeTask({ bundle_id: bA1, project_id: pA, dept: 'QLDA', assignee_id: U.hung,
    name: 'Lập hồ sơ thiết kế cơ sở (bản vẽ phối cảnh, mặt bằng)',
    start_offset: -75, end_offset: -50, progress: 100, status: 'completed', priority: 'high' });
  makeTask({ bundle_id: bA1, project_id: pA, dept: 'QLDA', assignee_id: U.hung,
    name: 'Nộp hồ sơ xin Giấy phép xây dựng tại Sở Xây dựng',
    start_offset: -50, end_offset: -35, progress: 100, status: 'completed', priority: 'high' });

  const bA2 = makeBundle({
    project_id: pA, phase_id: phA1,
    owner_id: U.cuong, dept: 'KTTC',
    name: 'Dự toán tổng mức đầu tư sơ bộ',
    desc: 'Lập bảng dự toán tổng mức đầu tư, phân tích chi phí xây dựng để BGĐ phê duyệt ngân sách.',
    start_offset: -85, due_offset: -45,
    status: 'closed', progress: 100, priority: 'high',
  });
  makeTask({ bundle_id: bA2, project_id: pA, dept: 'KTTC', assignee_id: U.nguyet,
    name: 'Khảo sát đơn giá vật tư, nhân công thị trường',
    start_offset: -85, end_offset: -65, progress: 100, status: 'completed' });
  makeTask({ bundle_id: bA2, project_id: pA, dept: 'KTTC', assignee_id: U.cuong,
    name: 'Lập bảng dự toán tổng mức đầu tư & trình BGĐ',
    start_offset: -65, end_offset: -45, progress: 100, status: 'completed', priority: 'high' });

  // Phase 2: Thi công phần thô (đang triển khai)
  const phA2 = makePhase(pA, 2, 'Thi công phần thô', 'in_progress', -35, 60, null);

  const bA3 = makeBundle({
    project_id: pA, phase_id: phA2,
    owner_id: U.hung, dept: 'QLDA',
    name: 'Quản lý hợp đồng nhà thầu thi công',
    desc: 'Tổ chức đấu thầu, ký hợp đồng nhà thầu xây dựng. Theo dõi tiến độ thi công phần thô.',
    start_offset: -35, due_offset: 30,
    status: 'in_progress', progress: 55, priority: 'high',
    collab_depts: ['KTTC', 'TC'],
  });
  makeTask({ bundle_id: bA3, project_id: pA, dept: 'QLDA', assignee_id: U.hung,
    name: 'Soạn hồ sơ mời thầu & tổ chức đấu thầu nhà thầu chính',
    start_offset: -35, end_offset: -20, progress: 100, status: 'completed', priority: 'high' });
  makeTask({ bundle_id: bA3, project_id: pA, dept: 'QLDA', assignee_id: U.hong,
    name: 'Theo dõi tiến độ thi công móng & tầng 1',
    start_offset: -20, end_offset: 5, progress: 80, status: 'in_progress', priority: 'high' });
  makeTask({ bundle_id: bA3, project_id: pA, dept: 'QLDA', assignee_id: U.hong,
    name: 'Theo dõi thi công kết cấu tầng 2-5',
    start_offset: 5, end_offset: 30, progress: 0, status: 'not_started', priority: 'medium' });

  const bA4 = makeBundle({
    project_id: pA, phase_id: phA2,
    owner_id: U.cuong, dept: 'KTTC',
    name: 'Thanh toán tiến độ gói thầu xây dựng thô',
    desc: 'Kiểm soát chi phí, lập biên bản nghiệm thu từng đợt, thanh toán tiến độ cho nhà thầu.',
    start_offset: -20, due_offset: 35,
    status: 'in_progress', progress: 40, priority: 'high',
  });
  makeTask({ bundle_id: bA4, project_id: pA, dept: 'KTTC', assignee_id: U.hang,
    name: 'Lập biên bản nghiệm thu & thanh toán đợt 1 (móng + tầng 1)',
    start_offset: -10, end_offset: 5, progress: 70, status: 'in_progress', priority: 'high' });
  makeTask({ bundle_id: bA4, project_id: pA, dept: 'KTTC', assignee_id: U.tu,
    name: 'Mua bán vật tư phát sinh: sắt thép bổ sung tầng 2',
    start_offset: -5, end_offset: 10, progress: 30, status: 'in_progress' });
  makeTask({ bundle_id: bA4, project_id: pA, dept: 'KTTC', assignee_id: U.nguyet,
    name: 'Quyết toán đợt 2 (tầng 2-3)',
    start_offset: 10, end_offset: 35, progress: 0, status: 'not_started' });

  const bA5 = makeBundle({
    project_id: pA, phase_id: phA2,
    owner_id: U.thanh, dept: 'TC',
    name: 'Giám sát thi công hiện trường phần thô',
    desc: 'Trực tiếp giám sát thi công tại công trường, kiểm tra chất lượng kết cấu, ATLĐ.',
    start_offset: -20, due_offset: 60,
    status: 'in_progress', progress: 45, priority: 'high',
  });
  makeTask({ bundle_id: bA5, project_id: pA, dept: 'TC', assignee_id: U.thanh,
    name: 'Giám sát đổ móng băng và ép cọc',
    start_offset: -20, end_offset: -5, progress: 100, status: 'completed', priority: 'high' });
  makeTask({ bundle_id: bA5, project_id: pA, dept: 'TC', assignee_id: U.ngoc,
    name: 'Kiểm tra chất lượng đổ bê tông dầm sàn tầng 1',
    start_offset: -5, end_offset: 10, progress: 60, status: 'in_progress', priority: 'high' });
  makeTask({ bundle_id: bA5, project_id: pA, dept: 'TC', assignee_id: U.ngoc,
    name: 'Giám sát xây gạch & hoàn thiện thô tầng 2-5',
    start_offset: 10, end_offset: 60, progress: 0, status: 'not_started' });

  // Phase 3: Hoàn thiện & Nghiệm thu (chưa bắt đầu)
  const phA3 = makePhase(pA, 3, 'Hoàn thiện & Nghiệm thu', 'pending', 60, 150, null);

  makeBundle({
    project_id: pA, phase_id: phA3,
    owner_id: U.hung, dept: 'QLDA',
    name: 'Hồ sơ hoàn công & nghiệm thu chất lượng',
    desc: 'Lập hồ sơ hoàn công, tổ chức nghiệm thu với chủ đầu tư và cơ quan quản lý.',
    start_offset: 60, due_offset: 140,
    status: 'assigned', progress: 0, priority: 'medium',
  });

  makeBundle({
    project_id: pA, phase_id: phA3,
    owner_id: U.cuong, dept: 'KTTC',
    name: 'Quyết toán công trình & thanh lý hợp đồng',
    desc: 'Tổng hợp quyết toán toàn bộ chi phí công trình, lập hồ sơ thanh lý hợp đồng.',
    start_offset: 130, due_offset: 150,
    status: 'assigned', progress: 0, priority: 'high',
  });

  console.log('  ✓ Tạo dự án DA-CCM-001 (Chung cư mini 5 tầng Hoàng Mai)');

  // ============================================================
  // 4. DỰ ÁN B — Nhà ở dân dụng 3 tầng (đang lập hồ sơ)
  //    Ký hiệu: DA-NDD-002
  // ============================================================
  const pB = makeProject(
    'DA-NDD-002', 'Nhà ở dân dụng 3 tầng Cầu Giấy',
    'Xây mới nhà ở 3 tầng + 1 tum, diện tích xây dựng 80m². Chủ đầu tư: Bà Lê Thị Hoa.',
    '14 Trần Thái Tông, Cầu Giấy, Hà Nội',
    U.khanh,
    5, 130,
    'planning', 2800000000, // 2.8 tỷ
  );

  const phB1 = makePhase(pB, 1, 'Chuẩn bị pháp lý', 'pending', 5, 35, null);

  makeBundle({
    project_id: pB, phase_id: phB1,
    owner_id: U.hung, dept: 'QLDA',
    name: 'Lập hồ sơ xin Giấy phép xây dựng nhà ở',
    desc: 'Chuẩn bị đủ hồ sơ theo yêu cầu Sở Xây dựng: bản vẽ thiết kế, giấy tờ đất, đơn xin phép.',
    start_offset: 5, due_offset: 35,
    status: 'assigned', progress: 0, priority: 'high',
  });

  makeBundle({
    project_id: pB, phase_id: phB1,
    owner_id: U.cuong, dept: 'KTTC',
    name: 'Dự toán chi phí xây dựng nhà ở 3 tầng',
    desc: 'Lập dự toán chi phí xây dựng để chủ đầu tư phê duyệt ngân sách trước khi khởi công.',
    start_offset: 5, due_offset: 25,
    status: 'assigned', progress: 0, priority: 'medium',
  });

  console.log('  ✓ Tạo dự án DA-NDD-002 (Nhà ở dân dụng 3 tầng Cầu Giấy)');

  // ============================================================
  // 5. DỰ ÁN C — Kho xưởng sản xuất (đã hoàn thành)
  //    Ký hiệu: DA-KXS-000
  // ============================================================
  const pC = makeProject(
    'DA-KXS-000', 'Kho xưởng sản xuất Đông Anh',
    'Xây dựng kho xưởng sản xuất 1 tầng 1500m², hoàn thành bàn giao tháng 6/2026.',
    'KCN Đông Anh, Hà Nội',
    U.khanh,
    -365, -30,
    'completed', 15000000000,
  );
  db.prepare("UPDATE construction_projects SET actual_end = ? WHERE id = ?")
    .run(shiftDays(-35), pC);

  const phC1 = makePhase(pC, 1, 'Pháp lý & Thiết kế', 'completed', -365, -240, -245);
  const phC2 = makePhase(pC, 2, 'Thi công', 'completed', -240, -60, -55);
  const phC3 = makePhase(pC, 3, 'Hoàn thiện & Bàn giao', 'completed', -60, -30, -35);

  const bC1 = makeBundle({
    project_id: pC, phase_id: phC1,
    owner_id: U.hung, dept: 'QLDA',
    name: 'Hồ sơ pháp lý & thiết kế kỹ thuật',
    start_offset: -365, due_offset: -270,
    status: 'closed', progress: 100, priority: 'high',
  });
  makeTask({ bundle_id: bC1, project_id: pC, dept: 'QLDA', assignee_id: U.hong,
    name: 'Xin GPXD và phê duyệt thiết kế', start_offset: -365, end_offset: -300,
    progress: 100, status: 'completed' });

  const bC2 = makeBundle({
    project_id: pC, phase_id: phC2,
    owner_id: U.thanh, dept: 'TC',
    name: 'Giám sát thi công kho xưởng',
    start_offset: -240, due_offset: -55,
    status: 'closed', progress: 100, priority: 'high',
  });
  makeTask({ bundle_id: bC2, project_id: pC, dept: 'TC', assignee_id: U.ngoc,
    name: 'Giám sát thi công khung thép + mái', start_offset: -240, end_offset: -100,
    progress: 100, status: 'completed' });
  makeTask({ bundle_id: bC2, project_id: pC, dept: 'TC', assignee_id: U.thanh,
    name: 'Giám sát hoàn thiện tường, nền, điện nước', start_offset: -100, end_offset: -55,
    progress: 100, status: 'completed' });

  const bC3 = makeBundle({
    project_id: pC, phase_id: phC3,
    owner_id: U.cuong, dept: 'KTTC',
    name: 'Quyết toán & bàn giao công trình',
    start_offset: -60, due_offset: -35,
    status: 'closed', progress: 100, priority: 'high',
  });
  makeTask({ bundle_id: bC3, project_id: pC, dept: 'KTTC', assignee_id: U.hang,
    name: 'Lập hồ sơ quyết toán toàn bộ công trình', start_offset: -60, end_offset: -40,
    progress: 100, status: 'completed' });
  makeTask({ bundle_id: bC3, project_id: pC, dept: 'KTTC', assignee_id: U.cuong,
    name: 'Thanh lý hợp đồng & bàn giao chủ đầu tư', start_offset: -40, end_offset: -35,
    progress: 100, status: 'completed' });

  console.log('  ✓ Tạo dự án DA-KXS-000 (Kho xưởng sản xuất Đông Anh — đã hoàn thành)');

  // ============================================================
  // 6. HISTORY
  // ============================================================
  const now = new Date().toISOString();
  const insertHist = db.prepare(`
    INSERT INTO history (id, entity_type, entity_id, action, user_id, user_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertHist.run(uuidv4(), 'project', pA, 'Tạo dự án "Chung cư mini 5 tầng Hoàng Mai"', U.khanh, 'Khánh — Điều hành', now);
  insertHist.run(uuidv4(), 'project', pB, 'Tạo dự án "Nhà ở dân dụng 3 tầng Cầu Giấy"', U.khanh, 'Khánh — Điều hành', now);
  insertHist.run(uuidv4(), 'project', pC, 'Tạo dự án "Kho xưởng sản xuất Đông Anh"', U.khanh, 'Khánh — Điều hành', now);

  // ============================================================
  // 7. SUMMARY
  // ============================================================
  console.log('');
  console.log('✅ Khởi tạo dữ liệu hoàn tất!');
  console.log('');
  console.log('📋 Tài khoản (mật khẩu 123456, admin = admin123):');
  console.log('  👑 Admin:    admin / admin123');
  console.log('  🏢 ĐH:       khanh / 123456   (Điều hành — Khánh)');
  console.log('               nam   / 123456   (Điều hành — Nam)');
  console.log('  👔 QLDA:     hung  / 123456   (Trưởng phòng)');
  console.log('               hong  / 123456   (Nhân viên)');
  console.log('  👔 KTTC:     cuong / 123456   (Trưởng phòng)');
  console.log('               nguyet/ 123456   (Nhân viên)');
  console.log('               hang  / 123456   (Nhân viên)');
  console.log('               tu    / 123456   (Nhân viên)');
  console.log('  👔 TC:       thanh / 123456   (Trưởng phòng)');
  console.log('               ngoc  / 123456   (Nhân viên)');
  console.log('');
  console.log('📊 Dự án mẫu:');
  console.log('  🏗️  DA-CCM-001  Chung cư mini 5 tầng Hoàng Mai  (đang thi công thô)');
  console.log('  🏠  DA-NDD-002  Nhà ở dân dụng 3 tầng Cầu Giấy  (đang lập hồ sơ)');
  console.log('  🏭  DA-KXS-000  Kho xưởng sản xuất Đông Anh     (đã hoàn thành)');
}

// CLI: node seed-construction.js
if (require.main === module) {
  try {
    seedConstruction();
  } catch (e) {
    console.error('❌ Seed thất bại:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

module.exports = { seedConstruction };
