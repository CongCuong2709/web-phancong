# Đề xuất Model 4 tầng cho Phân công Công việc (Ngành Xây dựng)

> **Bối cảnh:** Sau khi review với Giám đốc điều hành, nhận ra workflow thực tế của công ty xây dựng **lệch hoàn toàn** với model hiện tại. BGĐ giao "gói việc trừu tượng" theo giai đoạn cho Trưởng phòng; TP mới phân rã thành task cụ thể cho NV (kể cả chính TP).
>
> **Quyết định:** Reset DB + seed data ngành xây dựng. Triển khai model 4 tầng: **Dự án → Giai đoạn → Hạng mục giao (Bundle) → Đầu việc**.
>
> **Trạng thái:** Đề xuất chi tiết, **chưa code**. Sau khi duyệt sẽ triển khai trong 3 sprint riêng.

---

## 1. Tổng quan workflow thực tế

```
┌──────────────────────────────────────────────────────────────────┐
│ [BGĐ Điều hành]                                                  │
│   • Tạo DỰ ÁN xây dựng                                          │
│   • Chia thành các GIAI ĐOẠN (Chuẩn bị → Thiết kế → Thi công)  │
│   • Trong mỗi giai đoạn: tạo HẠNG MỤC GIAO cho từng phòng      │
│   • Mỗi hạng mục giao = gói việc trừu tượng + deadline mục tiêu│
│     VD: "Lập báo cáo đầu tư" — giao TP.QLDA, deadline 30/06     │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ [Trưởng phòng] — nhận gói → TỰ PHÂN RÃ                          │
│   • Nhận bundle từ BGĐ                                            │
│   • Tạo các ĐẦU VIỆC (task) cụ thể trong bundle                  │
│   • Giao task cho NV phòng mình (KỂ CẢ CHÍNH TP — TP tự làm)      │
│   • Theo dõi tiến độ, điều chỉnh deadline task nếu cần           │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ [Nhân viên] — nhận task → thực hiện, báo cáo hằng ngày           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Insight mới quan trọng từ thực tế

### 2.1. Quy tắc "1 phòng ban CHỈ có 1 Trưởng phòng"

**Hiện tượng:** Trong công ty, mỗi phòng ban chỉ có đúng 1 TP đứng ra chịu trách nhiệm. Không có chuyện "2 TP cùng phòng".

**Hệ quả cho model:**
- Hệ thống có thể **tự suy ra owner** của bundle từ `bundle.department`: chỉ cần biết phòng nào → biết TP nào.
- BGĐ không cần chọn owner thủ công khi tạo bundle — chỉ cần chọn **phòng**, hệ thống auto-fill TP.
- **Loại bỏ được lỗi chọn nhầm TP** cho phòng khác.

**Ràng buộc ngầm:**
- Trong 1 phase, **không thể có 2 bundle cùng phòng** (trừ khi BGĐ cố ý tạo 2 gói khác nhau cho cùng TP).
- Trường hợp TP nhận 2 gói riêng biệt: tạo 2 bundle riêng, **không phải 1 bundle có 2 sub-phase**.

### 2.2. TP tự giao task cho chính mình

**Hiện tượng:** TP không chỉ quản lý NV — họ cũng tự làm một phần việc. VD: TP.QLDA trực tiếp đi khảo sát địa hình, hoặc tự tham gia họp với chủ đầu tư.

**Hệ quả cho model:**
- `tasks.assignee_id` có thể là user có role = 'manager' (TP) — không phải chỉ employee.
- TP có thể điền nhật ký hằng ngày như NV bình thường.
- Khi TP mở "Việc của tôi" → thấy cả task do BGĐ giao (nếu có) + task TP tự giao cho mình.

**Không cần đổi schema**, chỉ cần cho phép assignee có role bất kỳ.

### 2.3. Bundle có deadline riêng — KHÔNG lấy từ phase

**Hiện tượng:** Trong cùng 1 phase, các gói có deadline rất khác nhau (vì mỗi phòng có cam kết khác nhau với BGĐ).

VD: Phase "Chuẩn bị đầu tư":
- Bundle "Lập báo cáo đầu tư" (giao QLDA): deadline 30/06
- Bundle "Dự toán sơ bộ" (giao KTTC): deadline 25/06

→ Bundle có `due_date` riêng. Phase chỉ là "khoảng thời gian" để nhóm và cảnh báo overrun.

---

## 3. Model dữ liệu chi tiết

### 3.1. Sơ đồ ERD

```
┌─────────────────────┐
│ construction_projects│
│ (Dự án)              │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│ project_phases       │
│ (Giai đoạn)          │
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│ assignment_bundles   │  ◀──── owner_id → users (1 TP duy nhất)
│ (Hạng mục giao)     │  ◀──── department → departments (1 phòng)
└──────────┬──────────┘
           │ 1:N
           ▼
┌─────────────────────┐
│ tasks                │  ◀──── assignee_id → users (NV hoặc TP)
│ (Đầu việc)          │  ◀──── daily_reports, history
└─────────────────────┘

Users (existing) ── 1 dept/role
Departments (existing)
```

### 3.2. Schema SQL

```sql
-- ============================================================
-- Bảng mới: Dự án xây dựng
-- ============================================================
CREATE TABLE construction_projects (
  id              TEXT PRIMARY KEY,
  code            TEXT UNIQUE NOT NULL,         -- VD: "DA-KĐT-X"
  name            TEXT NOT NULL,
  description     TEXT,
  address         TEXT,                          -- Địa chỉ dự án
  project_manager_id TEXT,                       -- BGĐ dự án (nếu khác BGĐ điều hành)
  target_start    TEXT,                          -- Ngày dự kiến bắt đầu
  target_end      TEXT,                          -- Ngày dự kiến hoàn thành
  actual_end      TEXT,                          -- Ngày hoàn thành thực tế (null nếu chưa)
  status          TEXT DEFAULT 'planning',       -- planning | in_progress | completed | cancelled
  budget          REAL,                          -- Ngân sách (VND)
  created_by      TEXT,
  created_at      TEXT,
  updated_at      TEXT
);

-- ============================================================
-- Bảng mới: Giai đoạn dự án
-- ============================================================
CREATE TABLE project_phases (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                 -- "Chuẩn bị đầu tư", "Thiết kế"...
  sequence        INTEGER NOT NULL,              -- Thứ tự: 1, 2, 3, 4...
  description     TEXT,
  target_start    TEXT,                          -- Ngày dự kiến bắt đầu phase
  target_end      TEXT,                          -- Ngày dự kiến kết thúc phase (cảnh báo overrun)
  actual_start    TEXT,
  actual_end      TEXT,
  status          TEXT DEFAULT 'pending',        -- pending | in_progress | completed
  created_at      TEXT,
  updated_at      TEXT,
  UNIQUE(project_id, sequence)
);

-- ============================================================
-- Bảng mới: Hạng mục giao (Bundle)
-- Đơn vị giao việc từ BGĐ → TP, có 1 owner + deadline riêng
-- ============================================================
CREATE TABLE assignment_bundles (
  id              TEXT PRIMARY KEY,
  code            TEXT UNIQUE,                    -- VD: "DA001" (auto-gen)
  name            TEXT NOT NULL,                  -- "Lập báo cáo đầu tư"
  description     TEXT,
  project_id      TEXT NOT NULL REFERENCES construction_projects(id),
  phase_id        TEXT REFERENCES project_phases(id),
  owner_id        TEXT NOT NULL REFERENCES users(id),  -- 1 TP duy nhất
  department      TEXT NOT NULL,                  -- Phòng của owner (để filter, group)
  start_date      TEXT,
  due_date        TEXT,                           -- Deadline riêng của bundle
  status          TEXT DEFAULT 'draft',           -- draft | assigned | in_progress | blocked | completed | closed
  progress        INTEGER DEFAULT 0,              -- Rollup từ tasks
  priority        TEXT DEFAULT 'medium',
  notes           TEXT,
  tags            TEXT,                           -- JSON array
  collaborating_depts TEXT,                       -- JSON array (phòng phối hợp, không có owner riêng)
  created_by      TEXT,
  created_at      TEXT,
  updated_at      TEXT
);

CREATE INDEX idx_bundles_project ON assignment_bundles(project_id);
CREATE INDEX idx_bundles_phase ON assignment_bundles(phase_id);
CREATE INDEX idx_bundles_owner ON assignment_bundles(owner_id);

-- ============================================================
-- Bảng hiện tại: tasks (cập nhật schema)
-- ============================================================
-- Thêm cột bundle_id, project_id (NULL nếu task độc lập)
ALTER TABLE tasks ADD COLUMN bundle_id TEXT REFERENCES assignment_bundles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES construction_projects(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_bundle ON tasks(bundle_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);

-- Subtasks (giữ nguyên) — không thay đổi
-- tasks.subtasks (JSON array) vẫn dùng cho "đầu việc nhỏ trong task"
```

### 3.3. ERD bằng ASCII

```
   ┌─────────────────────────┐
   │ construction_projects   │
   │─────────────────────────│
   │ PK id                   │
   │ UK code                 │
   │ name                    │
   │ status                  │
   │ target_start, target_end│
   └────────────┬────────────┘
                │ 1:N
                ▼
   ┌─────────────────────────┐
   │ project_phases          │
   │─────────────────────────│
   │ PK id                   │
   │ FK project_id           │
   │ UK (project_id,sequence)│
   │ name                    │
   │ target_start, target_end│
   │ status                  │
   └────────────┬────────────┘
                │ 1:N
                ▼
   ┌─────────────────────────┐
   │ assignment_bundles      │◀──── FK owner_id → users (1 TP)
   │─────────────────────────│      FK department → depts
   │ PK id                   │
   │ UK code                 │
   │ FK project_id           │
   │ FK phase_id             │
   │ FK owner_id             │
   │ department              │
   │ start_date, due_date    │
   │ status, progress        │
   └────────────┬────────────┘
                │ 1:N
                ▼
   ┌─────────────────────────┐
   │ tasks                   │◀──── FK assignee_id → users (NV hoặc TP)
   │─────────────────────────│      FK bundle_id (nullable)
   │ PK id                   │
   │ FK bundle_id            │
   │ FK project_id           │
   │ FK assignee_id          │
   │ status, progress        │
   └─────────────────────────┘
```

---

## 4. State Machine

### 4.1. Bundle states

```
                          ┌─────────┐
                          │  draft  │  ◀── BGĐ đang soạn
                          └────┬────┘
                               │ submit
                               ▼
                          ┌─────────┐
              ┌───────────│ assigned │  ◀── đã giao cho TP
              │           └────┬────┘
              │                │ TP bắt đầu
              │                ▼
              │           ┌─────────────┐
              │           │ in_progress  │  ◀── đang triển khai
              │           └────┬────────┘
              │                │
              │     ┌──────────┴──────────┐
              │     ▼                     ▼
              │ ┌────────┐         ┌─────────────┐
              │ │blocked │         │  completed  │  ◀── TP xong
              │ └───┬────┘         └──────┬──────┘
              │     │ revert              │ BGĐ review
              │     └─────────────────────┤
              │                           ▼
              │                     ┌────────┐
              └─────────────────────│ closed │
                                    └────────┘
```

### 4.2. Task states (giữ nguyên)

```
not_started → in_progress → completed
                  ↘ on_hold → in_progress
```

### 4.3. Phase states

```
pending ─────────────► in_progress ─────────────► completed
   │                       │                         │
   └─(phase trước complete)┘                         │
                                                       ▼
                                              (chỉ khi TẤT CẢ bundle trong phase = closed)
```

### 4.4. Roll-up logic

- **Task → Bundle**: `bundle.progress = avg(tasks.progress)` (recalc mỗi khi task đổi)
- **Bundle → Phase**: `phase.status` auto-update dựa vào bundle status count
- **Bundle → Project**: `project.progress = avg(phases weighted by phase.progress)`

---

## 5. Permission Matrix

| Hành động | Admin | BGĐ | TP | NV |
|---|---|---|---|---|
| **Project** | | | | |
| Tạo / sửa / xóa Project | ✓ | ✓ | ✗ | ✗ |
| Xem Project | ✓ | ✓ | ✓ (của mình) | ✓ (mình tham gia) |
| **Phase** | | | | |
| Tạo / sửa / xóa Phase | ✓ | ✓ | ✗ | ✗ |
| Xem Phase | ✓ | ✓ | ✓ (của mình) | ✓ (mình tham gia) |
| **Bundle (Hạng mục giao)** | | | | |
| Tạo Bundle | ✓ | ✓ | ✗ | ✗ |
| Sửa Bundle (deadline, owner, dept) | ✓ | ✓ | ✗ | ✗ |
| Sửa Bundle (status, progress) | ✓ | ✓ | ✓ (của mình) | ✗ |
| Comment trên Bundle | ✓ | ✓ | ✓ | ✗ |
| **Task (Đầu việc)** | | | | |
| Tạo Task trong Bundle | ✓ | ✓ | ✓ (của mình) | ✗ |
| Sửa Task (assignee, deadline) | ✓ | ✓ | ✓ (trong bundle mình nhận) | ✗ |
| Cập nhật tiến độ / daily report | ✓ | ✓ | ✓ (của mình) | ✓ (của mình) |
| **Dashboard** | | | | |
| Project dashboard | ✓ | ✓ | ✓ (của mình) | ✗ |

**Lưu ý:**
- "Của mình" = bundle.department ∈ `currentUser.departments` (cho TP) HOẶC `bundle.owner_id = currentUser.id`.
- TP có thể tự giao task cho chính mình (assignee = TP). NV chỉ thấy task được giao cho mình.

---

## 6. Workflow chi tiết (Happy path)

### 6.1. BGĐ tạo dự án

```
1. BGĐ mở "Dự án" → "Tạo dự án mới"
2. Điền: Mã, Tên, Địa chỉ, Ngân sách, Target start/end
3. Click "Lưu" → tạo Project với status = 'planning'

4. BGĐ vào Project → "Tạo giai đoạn"
5. Điền: Tên ("Chuẩn bị đầu tư"), Sequence (1), Target dates
6. Lưu → tạo Phase 1

7. BGĐ click vào Phase 1 → "Tạo hạng mục giao"
8. Form hiện:
   - Tên: "Lập báo cáo đầu tư"
   - Phòng: chọn "QLDA"  ← User chọn PHÒNG
   - Start date, Due date  ← BGĐ đặt deadline riêng cho gói
   - Mô tả, Priority, Tags
   - (KHÔNG hiện dropdown chọn TP — hệ thống tự fill từ phòng)
9. Lưu → Bundle status = 'assigned', owner = TP.QLDA (auto)
```

### 6.2. TP nhận gói và phân rã

```
1. TP.QLDA đăng nhập → thấy badge "1 bundle mới"
2. Mở "Dự án" → vào Project → tab "Hạng mục giao của tôi"
3. Click vào bundle "Lập báo cáo đầu tư"
4. Status: 'assigned' → click "Bắt đầu" → status = 'in_progress'

5. TP vào "Đầu việc" của bundle → "Tạo task mới"
6. Form:
   - Tên: "Khảo sát hiện trạng khu đất"
   - Giao cho: dropdown user trong phòng QLDA
   - Deadline, priority, tags
   - (Có thể giao cho chính TP — VD: "Tham gia họp chủ đầu tư")
7. Lưu → Task 1 với assignee = NV Nguyễn A
8. Tạo tiếp Task 2: "Lập báo cáo kinh tế-kỹ thuật" → assignee = NV Trần B
9. Tạo Task 3: "Tổng hợp & trình ký" → assignee = chính TP (TP tự giao)
```

### 6.3. NV nhận và thực hiện

```
1. NV đăng nhập → tab "Việc của tôi" thấy 1 task mới
2. Click task → modal detail
3. Hằng ngày vào "Báo cáo hôm nay" → điền nhật ký, cập nhật %
4. Khi xong 100% → set status = 'completed'
5. Bundle.progress auto-update = avg(tasks.progress)
6. Khi tất cả task = completed → TP nhấn "Hoàn thành gói" → status = 'completed'
7. BGĐ review → status = 'closed'
```

---

## 7. API Design

### 7.1. Projects

```
GET    /api/construction-projects
       ?status=in_progress
       &manager=USER_ID
       &department=DEPT
       Response: [{ id, code, name, status, progress, ... }]

POST   /api/construction-projects      (BGĐ/Admin)
       Body: { code, name, address, budget, target_start, target_end }
       Response: { id, ... }

GET    /api/construction-projects/:id
       Response: { project, phases: [...], bundles: [...], summary: {...} }

PUT    /api/construction-projects/:id  (BGĐ/Admin)

DELETE /api/construction-projects/:id  (Admin only, cascade soft-delete)
```

### 7.2. Phases

```
POST   /api/construction-projects/:id/phases    (BGĐ)
GET    /api/phases/:id
PUT    /api/phases/:id                          (BGĐ)
DELETE /api/phases/:id                          (BGĐ, cascade to bundles)

POST   /api/phases/:id/reorder                 (BGĐ) — thay đổi sequence
       Body: { phaseIds: [...] }
```

### 7.3. Bundles (Hạng mục giao)

```
GET    /api/construction-projects/:id/bundles
       ?phase=PHASE_ID
       &owner=USER_ID
       &status=in_progress
       &department=DEPT

POST   /api/construction-projects/:id/bundles  (BGĐ)
       Body: {
         code, name, description,
         phase_id, department,    ← chỉ cần department, owner tự suy ra
         start_date, due_date,
         priority, tags,
         collaborating_depts
       }
       Response: { id, ..., owner: { id, fullname, role } }  ← auto-fill

PUT    /api/bundles/:id                        (BGĐ: tất cả; TP: status/progress only)
POST   /api/bundles/:id/start                  (TP: assigned → in_progress)
POST   /api/bundles/:id/block                  (TP: in_progress → blocked; kèm reason)
POST   /api/bundles/:id/complete               (TP: in_progress → completed; chỉ khi progress = 100)
POST   /api/bundles/:id/close                  (BGĐ: completed → closed; final)

GET    /api/bundles/:id/tasks                  (danh sách task con)
GET    /api/bundles/:id/dashboard              (stats: progress theo user, bottleneck, ...)
```

### 7.4. Tasks (giữ nguyên cấu trúc, thêm bundle_id)

```
POST   /api/bundles/:id/tasks                  (TP: tạo task trong bundle mình nhận)
       Body: { code, name, description, assignee_id, start_date, end_date, priority, ... }
       Response: { id, ..., bundle_id, project_id }

PUT    /api/tasks/:id                          (giữ nguyên)
POST   /api/tasks/:id/daily-log                (NV/TP: thêm nhật ký hằng ngày)
```

### 7.5. Dashboard chuyên biệt cho BGĐ

```
GET    /api/construction-projects/:id/dashboard
       Response: {
         project: {...},
         phases: [
           {
             phase: { id, name, status, target_end },
             bundles: [{ id, name, owner, status, progress, due_date }],
             stats: { total_bundles, completed, overdue }
           }
         ],
         summary: {
           overall_progress,
           bottlenecks: [{ bundle_id, days_overdue, owner_id }],
           upcoming_deadlines: [{ bundle_id, due_in_days }]
         }
       }
```

---

## 8. UI Design

### 8.1. Navbar (thêm "Dự án")

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo]  Tổng quan | Dự án | Công việc | Việc của tôi | Báo cáo │ Lịch │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2. Project List (Danh sách dự án)

```
┌──────────────────────────────────────────────────────────────────┐
│ DỰ ÁN XÂY DỰNG                                       [+ Tạo dự án]│
│ ━━━━━━                                                             │
│ Tổng hợp tình hình triển khai các dự án                          │
│                                                                    │
│ Kỳ:  [● Tất cả] [Đang chạy] [Hoàn thành] [Tạm dừng]                │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ 📐 DA-KĐT-X | Khu đô thị X                                   ││
│ │ ─────                                                            ││
│ │ Địa chỉ: 123 Nguyễn Trãi, Q.Thanh Xuân, HN                    ││
│ │ BGĐ dự án: Tiến Anh    Ngân sách: 50 tỷ                       ││
│ │ Tiến độ: ▰▰▰▰▰▰▰▱▱▱  68%    Hạn: 30/12/2026                  ││
│ │ Phase: Chuẩn bị ✓ → Thiết kế ● → Thi công ○ → Nghiệm thu ○   ││
│ └────────────────────────────────────────────────────────────────┘│
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ 🏫 DA-THPT-Y | Trường THPT Y                                  ││
│ │ ...                                                              ││
│ └────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 8.3. Project Detail

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Quay lại                                                          │
│                                                                    │
│ DA-KĐT-X · Khu đô thị X                       [Sửa] [Đóng dự án]│
│ ━━━━━━                                                             │
│ Địa chỉ: 123 Nguyễn Trãi, Q.Thanh Xuân, HN                       │
│ BGĐ dự án: Tiến Anh    Ngân sách: 50 tỷ                          │
│ Tiến độ tổng: ▰▰▰▰▰▰▰▱▱▱ 68% (tổng hợp từ 4 phases)             │
│ Hạn dự án: 30/12/2026 (còn 92 ngày)                              │
│                                                                    │
│ Tabs:  [Tổng quan ●] [Hạng mục giao] [Đầu việc] [Nhật ký]         │
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│ TỔNG QUAN (theo GIAI ĐOẠN)                                       │
│ ━━━━━━━━━━━━━━━                                                   │
│                                                                    │
│ 1. Chuẩn bị đầu tư                                  ✓ HOÀN THÀNH│
│    ▰▰▰▰▰▰▰▰▰▰ 100%   15/01 - 30/06/2026                          │
│    ├ Lập báo cáo đầu tư       [TP.QLDA]    ✓ 100%                │
│    └ Dự toán sơ bộ           [TP.KTTC]    ✓ 100%                │
│                                                                    │
│ 2. Thiết kế & Pháp lý                          ● ĐANG TRIỂN KHAI│
│    ▰▰▰▰▰▰▰▱▱▱ 70%   01/07 - 30/09/2026                          │
│    ├ Thiết kế kiến trúc       [TP.TK]      ● 80%   ⚠ còn 12 ngày│
│    ├ Thiết kế kết cấu         [TP.TK]      ● 60%                 │
│    ├ GPXD & pháp lý           [TP.PL]      ● 50%                 │
│    └ Thẩm định thiết kế      [TP.TK]      ○  0%                 │
│                                                                    │
│ 3. Thi công                                   ○ CHƯA BẮT ĐẦU    │
│    ▰▱▱▱▱▱▱▱▱▱  0%   01/10 - 30/12/2026                          │
│    └ (chưa có hạng mục giao)                                       │
│                                                                    │
│ 4. Nghiệm thu & Hoàn công                    ○ CHƯA BẮT ĐẦU    │
│                                                                    │
│ Gantt tổng: [====] [====●=====] [○○○] [○○]                        │
│                                                                    │
│ Bottleneck: ⚠ "Thẩm định thiết kế" chưa bắt đầu — sẽ block phase│
│ Sắp đến hạn: "GPXD & pháp lý" (3 ngày)                           │
└──────────────────────────────────────────────────────────────────┘
```

### 8.4. Tab "Hạng mục giao"

```
┌──────────────────────────────────────────────────────────────────┐
│ HẠNG MỤC GIAO CỦA DỰ ÁN          [+ Tạo hạng mục mới]            │
│ ━━━━━━                                                             │
│ Lọc:  [Tất cả phases ▾] [Tất cả phòng ▾] [Trạng thái ▾]            │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ DA001 · Lập báo cáo đầu tư       [GĐ: Tiến Anh] [TP: Cao Cường]││
│ │ ────                                                            ││
│ │ 📐 QLDA · 15/01 - 30/06/2026 · 100%                            ││
│ │ Trạng thái: ✓ HOÀN THÀNH  · 5/5 task                           ││
│ │ Tags: báo cáo, đầu tư                                          ││
│ │ [Mở chi tiết →]                                                 ││
│ └────────────────────────────────────────────────────────────────┘│
│ ...                                                                │
└──────────────────────────────────────────────────────────────────┘
```

### 8.5. Modal "Tạo hạng mục giao" (cho BGĐ)

```
┌──────────────────────────────────────────────────────────────────┐
│ Tạo hạng mục giao mới                                      [×]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Tên hạng mục *                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Lập báo cáo đầu tư                                          │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Mô tả / Yêu cầu                                                 │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Giai đoạn *                       Phòng ban chủ trì *            │
│ ┌──────────────────┐              ┌─────────────────────────┐    │
│ │ Chuẩn bị đầu tư ▾│              │ QLDA                  ▾ │    │
│ └──────────────────┘              └─────────────────────────┘    │
│                                  TP phụ trách: Cao Cường (auto)  │
│                                                                  │
│ Ngày bắt đầu                  Hạn xong                           │
│ ┌──────────────┐               ┌──────────────┐                  │
│ │ 15/01/2026   │               │ 30/06/2026   │                  │
│ └──────────────┘               └──────────────┘                  │
│                                                                  │
│ Mức độ ưu tiên              Phòng phối hợp                      │
│ ┌─────────┐                  [ ] Pháp lý XD                       │
│ │ Trung bình▾│                [ ] Kỹ thuật                        │
│ └─────────┘                                                       │
│                                                                  │
│ Tags                                                             │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ báo cáo, đầu tư                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [Lưu nháp]                                       [Hủy]  [Tạo gói]│
└──────────────────────────────────────────────────────────────────┘
```

**Khác biệt quan trọng so với form hiện tại:**
- KHÔNG có dropdown "Giao cho (Trưởng phòng)" — hệ thống tự fill
- KHÔNG có Tiến độ % (auto rollup từ tasks)
- KHÔNG có Trạng thái (auto: draft → assigned khi lưu)
- KHÔNG có Kết quả thực hiện (do TP/NV điền ở task level)

---

## 9. Seed data — Ngành xây dựng

### 9.1. Departments

| Phòng ban | Mã | Ghi chú |
|---|---|---|
| Quản lý dự án | `QLDA` | Quản lý tiến độ tổng |
| Kỹ thuật thiết kế | `KTTK` | Thiết kế kiến trúc, kết cấu |
| Pháp lý xây dựng | `PLXD` | GPXD, thẩm định, đất đai |
| Kế toán tài chính | `KTTC` | Dự toán, quyết toán, thuế |
| HCNS | `HCNS` | Nhân sự công trường |
| Thu mua | `TMXD` | Vật tư, thiết bị |
| An toàn lao động | `ATLD` | ATLĐ, PCCC |
| IT | `IT` | Phần mềm BIM, ERP |

### 9.2. Users (8 phòng × 1 TP + 2-3 NV + 1 BGĐ + 1 admin)

```
Admin:                1
Giám đốc điều hành:  1 (Tiến Anh)
Phó giám đốc:        1 (BGĐ thứ 2 — nếu cần test rule BGĐ không giao BGĐ khác)
TP mỗi phòng × 8:    8
NV mỗi phòng × 3:   24
─────────────────────────
Tổng:                35 users
```

### 9.3. Dự án mẫu

**Dự án A — Khu đô thị X**
- 4 phases: Chuẩn bị → Thiết kế & Pháp lý → Thi công → Nghiệm thu
- Mỗi phase 2-3 bundles
- Mỗi bundle 3-5 tasks
- Tổng ~50 tasks

**Dự án B — Trường THPT Y**
- 3 phases đơn giản hơn
- ~20 tasks

**Dự án C — Sân vận động Z**
- Đã hoàn thành — để test view "Dự án hoàn thành"
- ~30 tasks với daily logs

---

## 10. Migration Plan

### 10.1. Phase 1 — Reset & Seed (1 ngày)

```bash
# Trong backend
rm data/app.db
node reset-db.js
node seed.js --reset --mode=construction
```

### 10.2. Phase 2 — Script seed data (1 ngày)

Tạo `seed-construction.js`:
- Tạo 8 departments xây dựng
- Tạo 35 users (admin + BGĐ + 8 TP + 24 NV)
- Tạo 3 dự án mẫu với phases, bundles, tasks
- Một số tasks có daily logs để test "Báo cáo hôm nay"

### 10.3. Phase 3 — Data cũ (nếu muốn giữ)

Nếu có data thật cần migrate:
1. Mapping: Task CHA cũ → Bundle (auto: gán phase_id = null, project_id = null, dùng làm "task độc lập")
2. SubTask cũ → Task với bundle_id tương ứng
3. Sau đó BGĐ có thể nhóm các Bundle vào Project mới thủ công

**Khuyến nghị: KHÔNG migrate data cũ**, dùng data mới cho ngành xây dựng.

---

## 11. Roadmap triển khai

### Sprint 1 — Backend (2 tuần)

| Ngày | Task | Output |
|---|---|---|
| 1-2 | Schema: 2 bảng mới (projects, phases, bundles) + ALTER tasks | Migration script |
| 2-3 | API CRUD: projects, phases, bundles (full) | 12 endpoints |
| 3-4 | API phân quyền + rollup logic (progress avg) | Permission middleware |
| 4-5 | Seed script: 8 departments + 35 users + 3 dự án mẫu | Seed data ready |
| 5 | Test E2E backend | Test pass |

### Sprint 2 — Frontend (2 tuần)

| Ngày | Task | Output |
|---|---|---|
| 1-2 | Navbar + Project List page | Trang danh sách dự án |
| 2-3 | Project Detail page (tab Tổng quan) | Phase progress view |
| 3-4 | Modal tạo/sửa Project + Phase + Bundle | 3 modal mới |
| 4-5 | Tab "Hạng mục giao" + "Đầu việc" trong project | List + filter |
| 5 | Tab "Nhật ký" + Dashboard BGĐ mới | Daily feed |

### Sprint 3 — Polish (1 tuần)

| Ngày | Task | Output |
|---|---|---|
| 1-2 | Gantt view cho project detail | Visual timeline |
| 3-4 | Mobile responsive + dark mode | Tablet/mobile OK |
| 5 | User testing + fix bug | Production ready |

**Tổng: ~5 tuần (1 người full-time), ~3 tuần nếu 2 người song song.**

---

## 12. 8 quyết định đã chốt (từ câu trả lời)

| # | Câu hỏi | Quyết định | Hệ quả |
|---|---|---|---|
| 1 | Có cần "phê duyệt gói" trước khi TP làm? | **❌ KHÔNG** — Tạo = Giao luôn (draft chỉ là nháp BGĐ) | State `draft` chỉ hiện trong form nháp của BGĐ; khi Save → status = `assigned` luôn. Bỏ workflow approval. |
| 2 | Bundle có thể đổi owner (TP)? | **✅ CÓ** — BGĐ/Admin đổi thủ công, có confirm popup | Endpoint `PATCH /api/bundles/:id` với field `owner_id`. UI confirm: "Bạn đang đổi owner từ A sang B. Toàn bộ task trong bundle sẽ không bị ảnh hưởng. Tiếp tục?" Log history. |
| 3 | Dependency giữa bundle? | **❌ Sprint 1 bỏ qua** — chỉ dùng phase ordering | Không có cột `depends_on` trong schema. Phase sequence đủ ràng buộc trong v1. |
| 4 | Đổi department → auto đổi owner? | **✅ CÓ** — auto-fill, hiện confirm trước khi đổi | Frontend: khi user đổi dropdown dept, lookup TP mới của dept đó, hiện confirm popup "Owner sẽ đổi từ X sang Y. Tiếp tục?". Cancel → revert. |
| 5 | Bundle có ngân sách riêng? | **✅ CÓ** — nullable, không bắt buộc | Schema có cột `budget REAL`, form có input (optional). Hiển thị ở project detail, không ảnh hưởng logic. |
| 6 | Phase cần owner riêng? | **❌ KHÔNG** — bỏ `phase_owner` | Phase chỉ là sequence + dates, không có owner. Quyết định này phù hợp vì phase là "khoảng thời gian", không phải đơn vị giao. |
| 7 | Task độc lập (không có bundle)? | **✅ CÓ** — `bundle_id` nullable, nhưng `project_id` BẮT BUỘC | Mọi task phải thuộc dự án. Bundle là optional. Task độc lập dùng khi: yêu cầu phát sinh ngoài kế hoạch, task nhỏ không đáng tạo bundle. Assignee là NV hoặc TP. |
| 8 | Bundle có "phòng phối hợp"? | **✅ CÓ** — chỉ hiển thị (label), không thêm permission | Schema có `collaborating_depts TEXT` (JSON array). UI hiển thị badge, không có filter riêng. Để TP tự quản việc điều phối với phòng phối hợp. |

### Quyết định tổng hợp (từ câu trả lời trước đó)

✓ **Bundle = 1 TP duy nhất** (auto-fill từ department)
✓ **Multi-bundle/phase = multi-department** (vì 1 phòng chỉ 1 TP)
✓ **TP tự giao task cho chính mình** (assignee có thể là TP)
✓ **Reset DB + seed ngành xây dựng**
✓ **Chỉ viết đề xuất chi tiết, chưa code**

---

## 13. Hệ quả chi tiết & Implementation notes

### 13.1. Schema cập nhật theo 8 quyết định

```sql
-- BỎ: phase.owner_id (không có)
-- THÊM vào bundle:
ALTER TABLE assignment_bundles ADD COLUMN budget REAL;  -- nullable

-- ĐÃ CÓ:
-- bundles.owner_id (1 TP duy nhất, có thể đổi)
-- bundles.collaborating_depts (JSON array, label only)
-- tasks.bundle_id (nullable — task độc lập được phép)
-- tasks.project_id (BẮT BUỘC — không null)
-- KHÔNG CÓ bundles.depends_on (bỏ trong Sprint 1)
```

### 13.2. State machine Bundle (đơn giản hóa)

```
                          ┌─────────┐
                          │  draft  │  ◀── BGĐ đang soạn trong form (chưa Save)
                          └────┬────┘
                               │ BGĐ Save
                               ▼ (status = 'assigned' ngay)
                          ┌─────────┐
              ┌───────────│ assigned │  ◀── TP thấy được, có thể "Bắt đầu"
              │           └────┬────┘
              │                │ TP click "Bắt đầu"
              │                ▼
              │           ┌─────────────┐
              │           │ in_progress  │
              │           └────┬────────┘
              │                │
              │     ┌──────────┴──────────┐
              │     ▼                     ▼
              │ ┌────────┐         ┌─────────────┐
              │ │blocked │         │  completed  │
              │ └───┬────┘         └──────┬──────┘
              │     │ revert              │
              │     └─────────────────────┤
              │                           ▼
              │                     ┌────────┐
              │                     │ closed │  ◀── final, read-only
              │                     └────────┘
              │                           ▲
              │     ┌─────────────────────┘
              │     │ BGĐ/Admin: xác nhận đóng gói
              │
              └──── BGĐ/Admin: revert về assigned (chưa bắt đầu)
```

**Lưu ý:**
- `draft` KHÔNG xuất hiện trong database — chỉ là trạng thái tạm của form trước khi Save.
- `blocked` có thể có reason (lưu trong `notes` hoặc thêm cột `block_reason`).
- Khi `closed`, không ai (kể cả BGĐ) có thể edit — chỉ view + reopen bằng quyền admin đặc biệt.

### 13.3. Task độc lập (không thuộc Bundle) — logic chi tiết

**Khi nào dùng:**
- Yêu cầu phát sinh ngoài kế hoạch (BGĐ yêu cầu đột xuất: "Kiểm tra đột xuất hợp đồng NCC X")
- Task nhỏ không đáng tạo bundle (VD: "Họp nội bộ", "Tổng hợp báo cáo tuần")
- TP tự tạo cho mình (đã có rule cho phép)

**Permission matrix cho task độc lập:**

| Hành động | Admin | BGĐ | TP (cùng phòng) | TP (khác phòng) | NV (assignee) |
|---|---|---|---|---|---|
| Tạo | ✓ | ✓ | ✓ (project của mình) | ✗ | ✗ |
| Sửa (assignee, deadline) | ✓ | ✓ | ✓ (cùng phòng assignee) | ✗ | ✗ |
| Cập nhật tiến độ / daily log | ✓ | ✓ | ✓ (cùng phòng) | ✗ | ✓ (của mình) |
| Xem | ✓ | ✓ | ✓ (cùng phòng) | ✗ | ✓ (của mình) |

**Hiển thị:**
- Trong Project Detail → tab "Đầu việc" hiển thị cả task trong bundle + task độc lập (gắn badge "độc lập" hoặc icon khác)
- Trong "Việc của tôi" của assignee → vẫn thấy task độc lập như task thường
- Trong Dashboard → gộp vào stats chung

### 13.4. API endpoints bổ sung

```
PATCH  /api/bundles/:id/owner
       Body: { owner_id: NEW_USER_ID }
       Quyền: BGĐ/Admin
       Response: { ...bundle, owner: {...}, history_entry }
       Side-effect: ghi history với action = "Đổi owner từ X → Y"

PATCH  /api/bundles/:id/department
       Body: { department: NEW_DEPT }
       Quyền: BGĐ/Admin
       Side-effect: auto-update owner_id theo TP của dept mới
       Response: { ...bundle, owner: {...}, prev_owner: {...} }

POST   /api/bundles/:id/reopen
       Quyền: Admin
       Body: { reason: string }
       Side-effect: status 'closed' → 'assigned', ghi history

POST   /api/projects/:id/tasks          ← tạo task độc lập (không qua bundle)
       Quyền: BGĐ/Admin (project); TP (cùng phòng assignee)
       Body: giống create task hiện tại, không cần bundle_id
```

### 13.5. Logic auto-fill owner khi đổi department

```js
// Backend (tasks.js / new file project-bundles.js)
async function changeBundleDepartment(bundleId, newDept, changedBy) {
  const bundle = getBundle(bundleId);
  if (!bundle) throw new Error('Bundle không tồn tại');

  const prevDept = bundle.department;
  const prevOwnerId = bundle.owner_id;

  // 1. Tìm TP của phòng mới
  const newDeptUsers = db.prepare(`
    SELECT u.id, u.fullname FROM users u
    JOIN user_departments ud ON ud.user_id = u.id
    WHERE ud.department = ? AND u.role = 'manager' AND u.active = 1
    LIMIT 1
  `).get(newDept);

  if (!newDeptUsers) {
    throw new Error(`Phòng "${newDept}" chưa có Trưởng phòng. Tạo TP trước.`);
  }

  const newOwnerId = newDeptUsers.id;

  // 2. Update bundle
  db.prepare(`
    UPDATE assignment_bundles
    SET department = ?, owner_id = ?, updated_at = ?
    WHERE id = ?
  `).run(newDept, newOwnerId, new Date().toISOString(), bundleId);

  // 3. Ghi history
  db.prepare(`
    INSERT INTO history (id, entity_type, entity_id, action, user_id, user_name, created_at)
    VALUES (?, 'bundle', ?, ?, ?, ?, ?)
  `).run(uuid(), bundleId,
    `Đổi phòng từ "${prevDept}" → "${newDept}" (owner: ${prevOwnerId} → ${newOwnerId})`,
    changedBy.id, changedBy.fullname, new Date().toISOString());

  return { prev_owner_id: prevOwnerId, new_owner_id: newOwnerId };
}
```

### 13.6. UI confirm popup — pattern dùng chung

```js
// Ví dụ khi đổi department trong form Bundle
async function handleDeptChange(newDept) {
  const newOwner = lookupManagerOfDept(newDept);
  if (!newOwner) {
    showToast(`Phòng "${newDept}" chưa có Trưởng phòng`, true);
    revertDeptSelect();
    return;
  }
  if (currentOwner?.id === newOwner.id) return; // không đổi

  const confirmed = await showConfirm(
    'Đổi phòng ban chủ trì?',
    `Phòng sẽ đổi từ <strong>${currentDept}</strong> → <strong>${newDept}</strong>.<br>` +
    `Trưởng phòng phụ trách sẽ đổi từ <strong>${currentOwner?.fullname || '—'}</strong> → <strong>${newOwner.fullname}</strong>.<br>` +
    `Các task trong gói vẫn giữ nguyên assignee.`
  );
  if (!confirmed) {
    revertDeptSelect();
    return;
  }
  applyDeptChange(newDept, newOwner);
}
```

### 13.7. Trước khi code — checklist backend

```
□  Schema: tạo 2 bảng mới + ALTER tasks
□  Migration script: chạy được trên DB hiện tại hoặc DB mới
□  Permission middleware: kiểm tra user có quyền trên project/bundle
□  Auto-fill owner logic: lookup TP theo department
□  Reassign owner endpoint: PATCH /api/bundles/:id/owner
□  Change department endpoint: PATCH /api/bundles/:id/department
□  Reopen bundle endpoint (admin only)
□  Create standalone task: POST /api/projects/:id/tasks
□  Rollup progress: recalc khi task đổi
□  Seed script: 8 depts + 35 users + 3 projects
□  E2E test các rule mới (đổi owner, đổi dept, reopen, task độc lập)
```

### 13.8. Trước khi code — checklist frontend

```
□  Navbar: thêm "Dự án" giữa "Tổng quan" và "Công việc"
□  Project List page: card dự án + filter status
□  Project Detail page: tab Tổng quan / Hạng mục giao / Đầu việc / Nhật ký
□  Modal Tạo dự án (BGĐ): code, tên, địa chỉ, budget, target dates
□  Modal Tạo phase (BGĐ): tên, sequence, target dates
□  Modal Tạo bundle (BGĐ): tên, phase, dept (auto-fill TP), deadline, priority, tags, collab
□  Modal Tạo task độc lập: assignee (NV hoặc TP), project (bắt buộc), deadline
□  Confirm popup "đổi dept → đổi owner" dùng chung
□  Confirm popup "đổi owner" (giữ nguyên dept)
□  Form Bundle hiển thị readonly "TP phụ trách: X (auto-fill)"
□  Bundle có badge "đã đóng" nếu status = 'closed'
□  Task có badge "độc lập" nếu không có bundle
□  Reopen button (chỉ admin thấy)
```

---

## 14. Sẵn sàng cho Sprint 1

Sau khi 8 quyết định đã rõ, model 4 tầng đã có đủ thông tin để triển khai. Bạn có thể bắt đầu Sprint 1 (Backend, 2 tuần) ngay khi sẵn sàng với:

- **Output Sprint 1:** Backend ready, có seed data, API test được qua Postman/curl.
- **Output Sprint 2:** UI hoàn chỉnh, có thể demo end-to-end cho BGĐ/TP/NV.
- **Output Sprint 3:** Production-ready với Gantt view + mobile responsive + dark mode.

Khi nào bạn nói "triển khai Sprint 1", tôi sẽ bắt đầu code.

---

*File này là đề xuất chi tiết cuối cùng trước khi code. 8 quyết định đã chốt đầy đủ ở mục 12. Implementation notes đầy đủ ở mục 13.*

