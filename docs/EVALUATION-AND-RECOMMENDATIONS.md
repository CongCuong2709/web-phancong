# Đánh giá & Đề xuất — Hệ thống Phân công Công việc

> **Phạm vi đánh giá:** Toàn bộ mã nguồn tại `E:\web-phancong` (frontend `src/`, backend `backend/`, schema `backend/db.js`).
> **Ngày đánh giá:** 25/09/2026.
> **Đối tượng dùng mục tiêu:** Công ty triển khai nội bộ (LAN), quy mô vài chục đến vài trăm nhân viên, 3 cấp Giám đốc → Trưởng phòng → Nhân viên.

---

## 1. Tổng quan hệ thống

| Thành phần | Công nghệ | Đánh giá nhanh |
|---|---|---|
| Frontend | TypeScript thuần + Vite + Tailwind (CDN) + Lucide icons | Nhẹ, không framework, dễ build static |
| Backend | Node.js ≥ 22.5 + Express + Helmet + JWT + bcryptjs | Tối giản, dùng `node:sqlite` (experimental) |
| CSDL | SQLite (single-file, WAL + FK) | Phù hợp LAN cỡ nhỏ; hạn chế ghi đồng thời |
| Xác thực | JWT (8h, lưu `sessionStorage`) | Cơ bản nhưng thiếu refresh/revoke |
| Phân quyền | RBAC: `admin / director / manager / employee` | Có middleware `requireRole`, đã áp dụng phần lớn |
| Domain | `Task → SubTask → DailyLog` + `history` | Mô hình phù hợp nghiệp vụ Việt Nam |

**Điểm cộng kiến trúc:**
- Phân chia module rõ ràng (`types / state / storage / api / handlers / render`).
- API client tập trung (`src/api.ts`), có xử lý 401 tự logout.
- Backend chuẩn REST, route theo resource (`/tasks`, `/users`, `/auth`).
- Dùng `WAL` + `PRAGMA foreign_keys = ON` cho SQLite — đúng cách.
- Audit log ghi mọi thay đổi task/subtask.
- Có `seedIfEmpty()` tự tạo dữ liệu mẫu.

---

## 2. Điểm mạnh đáng giữ

1. **Mô hình phân cấp Task → SubTask → DailyLog** rất phù hợp cách quản lý công việc Việt Nam (BGĐ giao dự án → TP phân việc con → NV điền nhật ký).
2. **Báo cáo ngày (Daily Report)** có expand-theo-hàng, lưu theo `subtask`, tiện cho NV cuối.
3. **Dashboard 5 thẻ động** + panel "quá hạn" + sơ đồ phòng ban — đủ thông tin cho BGĐ chớp nhoáng.
4. **Lọc + tìm kiếm** theo phòng ban / trạng thái / ưu tiên / từ khóa.
5. **Audit trail** (bảng `history`) có sẵn ở DB nhưng **chưa có UI** — đây là việc dễ "nâng tầm" ứng dụng.
6. **Phân quyền theo role khá chặt**: manager chỉ sửa task phòng mình, employee chỉ ghi log cho sub của mình.
7. **Triển khai LAN đơn giản**: 1 file `.bat`, không cần Docker, backup = copy file `.db`.
8. **Toàn bộ UI tiếng Việt**, phù hợp người dùng nội bộ.

---

## 3. Điểm yếu & đề xuất (xếp theo mức độ ưu tiên)

### 🔴 Ưu tiên CAO — cần xử lý trước khi đưa vào vận hành thật

| # | Vấn đề | Vị trí | Đề xuất cụ thể |
|---|---|---|---|
| 1 | **JWT secret có fallback hard-coded** | `backend/middleware/auth.js:6` | Bắt buộc fail nếu thiếu `JWT_SECRET`:<br>`if (!process.env.JWT_SECRET) throw new Error('Set JWT_SECRET')`<br>Bỏ fallback mặc định, sinh secret ngẫu nhiên khi cài đặt lần đầu. |
| 2 | **PUT subtask không qua `requireRole`** | `backend/routes/tasks.js:323` | Thêm `requireRole('admin','director','manager')` HOẶC giữ như hiện tại nhưng kiểm tra rõ: nếu là employee thì chỉ cho phép cập nhật `progress / result / status / notes` (không cho sửa tên, hạn, assignee). Hiện tại employee có thể đổi `assignee_id`, `start_date`, `end_date` — đây là lỗ hổng. |
| 3 | **Không có rate-limit cho `/api/auth/login`** | `backend/server.js` | Thêm `express-rate-limit` (ví dụ 5 lần / 15 phút / IP) để chống brute-force. |
| 4 | **Độ dài mật khẩu tối thiểu 6** | `auth.js:72`, `users.js:62` | Nâng lên **≥ 8**, thêm kiểm tra có chữ + số. |
| 5 | **Login screen hiển thị tài khoản mẫu + mật khẩu** | `index.html:49-55` | Ẩn khối "Tài khoản mẫu" trong production (biến `import.meta.env.PROD`). |
| 6 | **Không có cơ chế quên mật khẩu / đổi mật khẩu từ UI** | Chỉ có API `change-password` | Thêm modal "Đổi mật khẩu" trong dropdown user ở navbar. |
| 7 | **Không thông báo khi sắp/đã quá hạn** | Chỉ highlight trên UI | Gửi email (Nodemailer) cho người nhận + Trưởng phòng khi còn 24h đến hạn; chạy cron mỗi giờ bằng `node-cron`. |
| 8 | **Không có cơ chế khóa phiên / đăng xuất từ xa** | `auth.js` | Lưu `jti` hoặc version `tokenVersion` trên user; tăng version khi user đổi mật khẩu → token cũ tự vô hiệu. |
| 9 | **Body limit 2 MB nhỏ** | `server.js:42` | Tăng lên **10 MB** hoặc bỏ giới hạn cho route upload file đính kèm (xem mục 4). |
| 10 | **Không validate input tập trung** | Mọi route | Dùng `zod` hoặc `joi` để khai báo schema một lần, tránh kiểm tra rải rác trong từng route. |

### 🟠 Ưu tiên TRUNG BÌNH — tăng tính thực tiễn nghiệp vụ

| # | Vấn đề | Đề xuất |
|---|---|---|
| 11 | **Không có file đính kèm** | Thêm bảng `attachments(id, task_id, subtask_id, filename, mime, size, uploader_id, created_at)` + endpoint upload (multer, lưu `backend/uploads/`) + hiển thị link download. |
| 12 | **Không có bình luận / trao đổi trên task** | Thêm bảng `comments(id, task_id|subtask_id, user_id, content, created_at)`. Cho phép NV phản hồi thắc mắc ngay trong task — gần như bắt buộc trong thực tế. |
| 13 | **Không có thông báo trong app** | Thêm bảng `notifications(id, user_id, type, payload, read_at)`. Khi TP giao sub mới / nhân viên ghi log / sắp đến hạn → tạo notification. Hiển thị chuông trên navbar + dropdown. |
| 14 | **Manager không nhìn nhanh "ai đang quá tải"** | Thêm widget dashboard cho manager: danh sách NV phòng mình + số sub đang mở + deadline gần nhất. |
| 15 | **Audit log không có UI** | Thêm tab "Lịch sử" trong modal chi tiết task, liệt kê `who did what when` từ bảng `history`. |
| 16 | **Không có export PDF/Excel** | Đã liệt kê trong README. Đề xuất dùng `exceljs` cho `.xlsx` và `pdfkit` hoặc `puppeteer` cho `.pdf` — cho phép BGĐ in báo cáo tháng. |
| 17 | **Không có lịch (calendar) / Gantt** | Dùng `fullcalendar` để xem task theo tuần/tháng; Gantt đơn giản có thể dựng từ `subTasks.startDate/endDate`. |
| 18 | **Không có tags / danh mục linh hoạt** | Chỉ có `priority + department`. Bổ sung `tags TEXT[]` hoặc bảng `task_tags` để NV tự gắn nhãn (`urgent`, `audit`, `recurring`...). |
| 19 | **Không có phụ thuộc giữa task** | Bổ sung `depends_on TEXT[]` để chặn trạng thái "Hoàn thành" khi task phụ thuộc chưa xong. |
| 20 | **Không có recurring task** | Bảng `task_templates` + cron tạo task mới theo chu kỳ. |
| 21 | **Không có phân trang / infinite scroll** | Thêm phân trang ở endpoint `GET /api/tasks` (`?page=&pageSize=`). |
| 22 | **Không có bulk operation** | Tick chọn nhiều task → bulk reassign / đổi status / xóa (với quyền tương ứng). |
| 23 | **Thiếu chỉ số "tải công việc" / "burn-down"** | Thêm báo cáo theo thời gian (snapshot tuần/tháng) — cho BGĐ thấy xu hướng hoàn thành. |
| 24 | **Trạng thái "Tạm dừng" chưa rõ ngữ cảnh** | Bổ sung field `on_hold_reason TEXT` — buộc nhập lý do khi chuyển sang `on_hold`. |

### 🟡 Ưu tiên THẤP — UX và vận hành

| # | Vấn đề | Đề xuất |
|---|---|---|
| 25 | **Không có dark mode** | Tailwind có `dark:`; lưu preference trong `localStorage`. |
| 26 | **Không có keyboard shortcuts** | `N` = tạo task mới, `/` = focus ô tìm kiếm, `Esc` đã có — bổ sung thêm. |
| 27 | **Skeleton loading chưa có** | Thêm placeholder xám khi `state.loading = true`. |
| 28 | **Dùng `window.confirm`** | Thay bằng modal xác nhận đẹp hơn, đồng nhất với design. |
| 29 | **Toast có thể chồng chập** | Dùng hàng đợi (queue) hoặc `id` chống trùng. |
| 30 | **Thiếu print stylesheet** | Báo cáo & "Việc của tôi" cần in được — thêm `@media print {}`. |
| 31 | **Form đọc giá trị lặp lại nhiều** | `handlers.ts` dòng 197-218 — viết helper `setVal(id, value)` gọn hơn. |
| 32 | **Không có ESLint/Prettier** | Thêm `eslint`, `prettier`, cấu hình strict để giữ chất lượng khi có người mới tham gia. |
| 33 | **Không có test** | Thêm `vitest` cho frontend, `node:test` cho backend (test middleware auth, test recalcTaskProgress, test role guard). |
| 34 | **Thiếu log tập trung** | Dùng `pino` hoặc `winston`, ghi ra `backend/logs/`, rotate theo ngày. |
| 35 | **Không có graceful shutdown** | `process.on('SIGTERM', ...)` đóng server + flush DB. |
| 36 | **`--experimental-sqlite`** | Khi Node 22.x ổn định hơn có thể bỏ flag; hiện tại nên chú thích rõ trong README (đã có, tốt). |
| 37 | **Không có HTTPS** | Đã nói LAN, nhưng nếu có máy khác VPN nên dùng reverse proxy nginx + Let's Encrypt. |
| 38 | **Backup thủ công** | Đã có hướng dẫn Task Scheduler — nên đóng gói thành script PowerShell kèm retention (giữ 7 bản gần nhất). |

---

## 4. Cải tiến mã nguồn mẫu (copy–paste áp dụng được)

### 4.1. Hardening JWT secret — `backend/middleware/auth.js`
```js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET chưa được đặt. Hãy export JWT_SECRET=<random> trước khi chạy server.'
  );
}
```

### 4.2. Giới hạn quyền sửa subtask — `backend/routes/tasks.js` (route PUT subtask)
```js
router.put('/:taskId/subtasks/:subId', (req, res) => {
  const sub = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?')
    .get(req.params.subId, req.params.taskId);
  if (!sub) return res.status(404).json({ error: 'Không tìm thấy công việc con' });

  // Employee chỉ được sửa subtask của mình VÀ chỉ các field tiến độ
  if (req.user.role === 'employee') {
    if (sub.assignee_id !== req.user.id)
      return res.status(403).json({ error: 'Không có quyền' });
    // Loại bỏ field quản lý khỏi body
    delete req.body.assigneeId;
    delete req.body.startDate;
    delete req.body.endDate;
    delete req.body.priority;
  }
  // ... phần cập nhật giữ nguyên
});
```

### 4.3. Rate-limit cho login
```js
// backend/server.js
const rateLimit = require('express-rate-limit');
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Quá nhiều lần thử. Vui lòng đợi 15 phút.' },
  standardHeaders: true, legacyHeaders: false,
}));
```

### 4.4. Validate input tập trung với `zod` (snippet minh họa)
```js
const { z } = require('zod');
const TaskCreateSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  department: z.string().optional(),
  collaboratingDepts: z.array(z.string()).optional(),
  assigneeId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority:  z.enum(['low','medium','high']).optional(),
});
// trong route:
const parsed = TaskCreateSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
```

### 4.5. Helper gọn cho form — `src/handlers.ts`
```ts
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const val = (id: string, fallback = '') => ($<HTMLInputElement>(id)?.value ?? fallback).trim();
const num = (id: string, fallback = 0) => Number($<HTMLInputElement>(id)?.value ?? fallback);
// Sau đó: const code = val('fCode'); const progress = num('fProgress');
```

### 4.6. Ẩn tài khoản mẫu khi production — `index.html`
```html
<div class="mt-6 p-4 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1"
     x-show="false" th:if="${import.meta.env.PROD === false}">
  <!-- block demo accounts -->
</div>
```

---

## 5. Đề xuất lộ trình triển khai

| Giai đoạn | Thời gian | Nội dung |
|---|---|---|
| **GĐ1 — An toàn vận hành (1–2 tuần)** | Ngay | Mục 🔴 1–10: secret, rate-limit, password policy, fix quyền subtask, ẩn demo, đổi mật khẩu UI, body limit, validate input, log cơ bản. |
| **GĐ2 — Nghiệp vụ cốt lõi (3–4 tuần)** | Sau GĐ1 | Mục 🟠 11–15: file đính kèm, bình luận, thông báo, widget tải công việc, UI audit log. |
| **GĐ3 — Báo cáo & lập kế hoạch (3–4 tuần)** | Sau GĐ2 | Export Excel/PDF, lịch/Gantt, tags, phụ thuộc, recurring. |
| **GĐ4 — Polish (2 tuần)** | Cuối | Mục 🟡 25–38: dark mode, keyboard, skeleton, ESLint, test, log tập trung, backup tự động. |

---

## 6. Tóm tắt

- **Hệ thống đã có nền tảng vững**: kiến trúc gọn, phân quyền đúng hướng, mô hình dữ liệu sát nghiệp vụ, triển khai LAN đơn giản.
- **Để "thực tiễn" hơn** cần tập trung 3 trục:
  1. **Bảo mật & vận hành** (không có lỗ hổng lớn, có backup/log/restore).
  2. **Nghiệp vụ cộng tác** (file đính kèm, bình luận, thông báo, deadline cảnh báo).
  3. **Báo cáo & trực quan** (Excel/PDF, lịch, theo dõi tải công việc).
- Sau khi hoàn thành GĐ1–GĐ2, ứng dụng hoàn toàn đủ tư cách thay thế các hệ thống Excel/giấy tờ hiện tại của một công ty cỡ vừa tại Việt Nam.

> Tài liệu này có thể bổ sung thêm khi nhận feedback từ người dùng pilot (TP và NV đầu tiên) — đặc biệt là mục 13 (notifications) và 16 (export) nên được ưu tiên xác nhận yêu cầu trước khi code.