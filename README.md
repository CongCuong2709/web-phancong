# Hệ thống Phân công Công việc — TypeScript + Vite

Web đơn giản phục vụ Ban Giám đốc và Trưởng phòng phân công đến Nhân viên. Dữ liệu lưu trong LocalStorage (không cần backend).

Dự án được viết bằng **TypeScript thuần** (không framework), build/dev bằng **Vite**.

## 🚀 Cài đặt & chạy

Yêu cầu: **Node.js 18+**.

```bash
# Lần đầu tiên
npm install

# Chạy dev (hot reload, mở http://localhost:5173)
npm run dev

# Build production ra thư mục dist/
npm run build

# Kiểm tra kiểu TypeScript (không sinh file)
npm run type-check

# Xem thử bản build
npm run preview
```

Sau khi `npm run build`, có thể copy thư mục `dist/` lên bất kỳ web server tĩnh nào (nginx, GitHub Pages, Netlify, v.v.).

## 📁 Cấu trúc dự án

```
web-phancong/
├── index.html              # HTML gốc (Vite inject script module vào đây)
├── package.json            # scripts: dev / build / preview / type-check
├── tsconfig.json           # cấu hình TypeScript (strict mode)
├── vite.config.ts          # cấu hình Vite
├── .gitignore
└── src/
    ├── main.ts             # entry — boot state, gắn global handlers
    ├── global.d.ts         # khai báo window.lucide
    ├── types.ts            # mọi type / interface (Project, Role, ...)
    ├── utils.ts            # hằng số + utility (escapeHtml, formatDate, ...)
    ├── state.ts            # module-level state (single source of truth)
    ├── storage.ts          # wrapper cho localStorage (load/save projects)
    ├── seed.ts             # dữ liệu mẫu ban đầu
    ├── ui.ts               # helpers DOM: toast, modal, setHTML, refreshIcons
    ├── render.ts           # render HTML cho từng view
    ├── handlers.ts         # event handlers: login, CRUD, navigation
    └── styles.css          # CSS tùy chỉnh (badge, progress bar, scrollbar)
```

## 🧱 Mô hình dữ liệu

```ts
// src/types.ts
type Role = 'director' | 'manager' | 'employee';
type ProjectStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';
type Priority = 'low' | 'medium' | 'high';

interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  department: string;
  assignee: string;
  createdBy: string;
  startDate: string;        // YYYY-MM-DD
  endDate: string;
  progress: number;         // 0 - 100
  status: ProjectStatus;
  priority: Priority;
  results: string;
  notes: string;
  history: HistoryEntry[];
}
```

## 👤 Tài khoản mẫu

| Vai trò       | Tên đề xuất              | Phòng ban        | Quyền                                          |
|---------------|--------------------------|------------------|------------------------------------------------|
| Giám đốc      | Nguyễn Văn Giám đốc       | Ban Giám đốc     | Xem tất cả, tạo / sửa / xóa dự án            |
| Trưởng phòng  | Trần Thị Trưởng phòng     | Phòng IT         | Tạo / sửa / xóa dự án                          |
| Nhân viên     | Lê Văn Nhân viên         | Phòng IT         | Chỉ xem & cập nhật tiến độ công việc được giao |

> **Mẹo**: Đăng nhập bằng `Lê Văn Nhân viên` / `Phòng IT` để thấy ngay 2 dự án mẫu đã giao cho nhân viên này trong mục **Việc của tôi**.

## 🧩 Tính năng

### Ban Giám đốc / Trưởng phòng
- Tổng quan: thẻ thống kê + danh sách dự án gần đây + tiến độ theo phòng ban
- Tạo / sửa / xóa dự án (mã, tên, mô tả, phòng ban, người thực hiện, hạn, mức ưu tiên, tiến độ, kết quả...)
- Lọc theo phòng ban / trạng thái / ưu tiên, tìm kiếm theo mã / tên / người thực hiện
- Báo cáo: 4 biểu đồ — theo trạng thái, phòng ban, ưu tiên, tiến độ TB theo phòng

### Nhân viên
- **Việc của tôi**: danh sách các công việc được giao, sắp xếp quá hạn / ưu tiên cao lên đầu
- Cập nhật tiến độ (%), kết quả thực hiện, trạng thái

### Chung
- Tự nhận dự án **quá hạn** (hạn cuối < hôm nay và chưa hoàn thành)
- Lịch sử cập nhật cho mỗi dự án (audit log)
- Dữ liệu lưu trong LocalStorage — F12 → Application → Local Storage để xem / xóa

## 🛠️ Cách tổ chức TypeScript

- **`strict: true`** trong `tsconfig.json` — bật tất cả các check nghiêm ngặt
- Phân chia module theo **trách nhiệm** (types, state, storage, ui, render, handlers)
- Tất cả hàm có **return type** rõ ràng
- Type cho các đối tượng DOM (`HTMLInputElement`, `HTMLSelectElement`, ...) thay vì dùng `any`
- Event delegation qua `document.addEventListener` thay vì inline `onclick` (trừ HTML render động thì vẫn dùng `window.xxx`)

## 💡 Gợi ý mở rộng

- Thêm React / Vue / Svelte nếu muốn framework UI reactive
- Kết nối backend (Node.js + SQLite / Prisma) để dùng chung nhiều máy
- Đăng nhập thật (username/password + JWT)
- Xuất báo cáo PDF / Excel
- Gửi email thông báo khi quá hạn
