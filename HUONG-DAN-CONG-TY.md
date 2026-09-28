# Hướng dẫn cài đặt & vận hành

## Cấu trúc project
```
web-phancong/
├── backend/         ← Server Node.js (chạy trên PC công ty)
│   ├── data/        ← File database phancong.db (TẠO TỰ ĐỘNG)
│   ├── server.js    ← Server chính
│   ├── seed.js      ← Dữ liệu mẫu ban đầu
│   └── start-server.bat  ← Click đúp để chạy server
├── src/             ← Frontend TypeScript
├── dist/            ← Frontend đã build (TẠO SAU KHI BUILD)
└── index.html
```

## Bước 1: Cài đặt (LẦN ĐẦU)

### Cài Node.js
Tải từ https://nodejs.org (LTS version) → Cài đặt bình thường.

### Cài dependencies backend
```
cd E:\web-phancong\backend
npm install
```

### Build frontend
```
cd E:\web-phancong
npm install
npm run build
```

## Bước 2: Chạy Server

**Cách 1 (đơn giản):** Double-click file `backend\start-server.bat`

**Cách 2 (PowerShell/CMD):**
```
cd E:\web-phancong\backend
node server.js
```

Server sẽ chạy tại `http://0.0.0.0:3000`

## Bước 3: Nhân viên truy cập

### Truy cập nội bộ (LAN):
1. Tìm IP của PC server: mở CMD → gõ `ipconfig` → xem IPv4 Address
2. Nhân viên mở trình duyệt → vào `http://192.168.x.x:3000`

### Truy cập qua Internet (Tên miền Mắt Bão & PC 24/7):
👉 Xem chi tiết tại [HUONG-DAN-DUA-LEN-INTERNET.md](file:///e:/web-phancong/HUONG-DAN-DUA-LEN-INTERNET.md) (Sử dụng Cloudflare Tunnel miễn phí, an toàn & không cần mở port).

## Danh sách tài khoản mặc định (Khởi tạo từ hệ thống cũ)

### 1. Quản trị hệ thống
- **Username**: `admin` | **Mật khẩu**: `admin123` | **Vai trò**: Quản trị (Admin)

### 2. Ban Giám đốc (Role: Director)
| Username / Email | Mật khẩu | Họ tên / Chức danh | Phòng ban |
|---|---|---|---|
| `tienanhkinhbac@gmail.com` | `123456` | Tổng giám đốc Tiến Anh | Ban Giám đốc |
| `tag.dndung@gmail.com` | `123456` | Tổng giám đốc Đ.N. Dũng | Ban Giám đốc |
| `cuong0169c@gmail.com` | `123456` | Tổng giám đốc Cường | Ban Giám đốc |

### 3. Trưởng phòng (Role: Manager)
| Username / Email | Mật khẩu | Họ tên / Chức danh | Phòng ban quản lý |
|---|---|---|---|
| `81nham@gmail.com` | `123456` | Trưởng phòng HCNS (81nham) | HCNS |
| `damvanluan1403@gmail.com` | `123456` | Đàm Văn Luận | HCNS |
| `huyduongsishust5059@gmail.com` | `123456` | Huy Dương | HCNS, Kế toán |
| `caocuong17479@gmail.com` | `123456` | Cao Cường | Kế toán, Thu mua |
| `bintemp05@gmail.com` | `123456` | Trưởng phòng Thu mua (bintemp05) | Thu mua |

### 4. Nhân viên (Role: Employee)
| Username / Email | Mật khẩu | Họ tên | Phòng ban |
|---|---|---|---|
| `tag.hcns8@gmail.com` | `123456` | Đỗ Thị Ánh Nguyệt | HCNS |
| `nhinguyen.tag1@gmail.com` | `123456` | Nguyễn Thảo Nhi | HCNS |
| `tag.thitruong@gmail.com` | `123456` | Bùi Quang Tú | Thu mua |
| `tag.ketoan1@gmail.com` | `123456` | Nguyễn Thị Hằng | Kế toán |

*(Lưu ý: Có thể đăng nhập bằng email đầy đủ hoặc phần trước dấu `@`, ví dụ `tag.hcns8` hoặc `tag.hcns8@gmail.com` đều được)*

**⚠️ Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên!**

## Backup dữ liệu

Toàn bộ dữ liệu nằm trong file:
```
E:\web-phancong\backend\data\phancong.db
```

**Backup thủ công:** Copy file này ra USB hoặc folder chia sẻ mạng.

**Backup tự động (tùy chọn):** Tạo Task Scheduler Windows chạy hằng ngày:
```batch
copy /Y "E:\web-phancong\backend\data\phancong.db" "\\server\backup\phancong-%DATE%.db"
```

## Firewall

Nếu máy khác không kết nối được, mở port 3000 trong Windows Firewall:
1. Windows Firewall → Inbound Rules → New Rule
2. Port → TCP → 3000
3. Allow the connection → Đặt tên "Phancong App"

## Thêm nhân viên mới

Đăng nhập bằng tài khoản `admin` → (tính năng Admin panel — sẽ bổ sung)

Hoặc tạm thời dùng SQLite browser (DB Browser for SQLite — tải miễn phí):
1. Mở file `phancong.db`
2. Thêm record vào bảng `users`
3. Password phải được hash bằng bcrypt (dùng https://bcrypt.online)
