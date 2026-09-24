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

1. Tìm IP của PC server: mở CMD → gõ `ipconfig` → xem IPv4 Address
2. Nhân viên mở trình duyệt → vào `http://192.168.x.x:3000`

## Tài khoản mặc định

| Username | Mật khẩu | Vai trò |
|---|---|---|
| admin | admin123 | Quản trị |
| giamdoc | giamdoc123 | Giám đốc |
| tp.it | 123456 | Trưởng phòng IT |
| tp.ns | 123456 | Trưởng phòng NS |
| tp.kt | 123456 | Trưởng phòng KT |
| nv.it01 | 123456 | Nhân viên IT |
| nv.it02 | 123456 | Nhân viên IT |
| nv.ns01 | 123456 | Nhân viên NS |

**⚠️ Đổi mật khẩu ngay sau khi deploy!**

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
