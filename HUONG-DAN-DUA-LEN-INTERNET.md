# Hướng dẫn đưa Ứng dụng Phân Công Công Việc lên Internet
> **Dành cho PC chạy 24/7 tại công ty & Tên miền mua tại Mắt Bão**

---

## 🎯 Tổng quan giải pháp

Công ty có:
1. **PC chạy 24/7** đóng vai trò làm Server (chạy Backend Node.js & Cơ sở dữ liệu SQLite).
2. **Tên miền từ Mắt Bão** (ví dụ: `phancong.tencongty.vn` hoặc `tencongty.vn`).

Để mọi người ở các phòng ban (kể cả khi làm ở nhà, dùng mạng 4G hay làm ngoài công ty) truy cập được an toàn, **Giải pháp tốt nhất và an toàn nhất là sử dụng Cloudflare Tunnel (Miễn phí 100%)**.

### Tại sao chọn Cloudflare Tunnel?
- ✅ **Không cần IP Tĩnh** từ nhà mạng (FPT, Viettel, VNPT).
- ✅ **Không cần mở Port trên Router (Port Forwarding)** — Tránh nguy cơ bị hacker tấn công vào mạng nội bộ công ty.
- ✅ **Có sẵn SSL/HTTPS (ổ khóa xanh an toàn)** hoàn toàn tự động.
- ✅ **Cực kỳ dễ cài đặt** trên Windows 24/7.

---

## 🚀 QUY TRÌNH 4 BƯỚC THỰC HIỆN

### BƯỚC 1: Build Frontend trên PC 24/7

Trước khi đưa lên Internet, cần build bản chính thức của Frontend:

1. Mở **PowerShell** hoặc **Command Prompt (CMD)** tại thư mục gốc dự án (`E:\web-phancong`).
2. Chạy lệnh:
   ```bash
   npm run build
   ```
   *(Lệnh này sẽ biên dịch TypeScript và đóng gói các file web vào thư mục `E:\web-phancong\dist`)*

3. Mở file `backend\start-server.bat` và kiểm tra backend đã sẵn sàng phục vụ file tĩnh trong thư mục `dist`.

---

### BƯỚC 2: Trỏ Tên miền Mắt Bão về Cloudflare

1. Đăng ký tài khoản miễn phí tại [cloudflare.com](https://www.cloudflare.com).
2. Bấm **Add a Site** → Gõ tên miền của công ty bạn (Ví dụ: `tencongty.vn`) → Chọn gói **Free**.
3. Cloudflare sẽ cấp cho bạn **2 địa chỉ Nameserver** (ví dụ: `abc.ns.cloudflare.com` và `xyz.ns.cloudflare.com`).
4. Đăng nhập trang quản trị **Mắt Bão** (`id.matbao.net`):
   - Vào **Quản lý tên miền** → Chọn tên miền của bạn.
   - Tìm mục **Thay đổi Nameserver (NS)**.
   - Thay đổi 2 địa chỉ NS mặc định của Mắt Bão thành 2 địa chỉ NS của Cloudflare cấp.
   - Lưu lại *(Chờ từ 5 - 15 phút để DNS cập nhật)*.

---

### BƯỚC 3: Tạo Cloudflare Tunnel trên PC 24/7

1. Truy cập [dash.cloudflare.com](https://dash.cloudflare.com) → Chọn mục **Zero Trust** bên menu trái (Đăng ký Zero Trust miễn phí nếu lần đầu truy cập).
2. Chọn **Networks** → **Tunnels** → Bấm **Create a Tunnel**.
3. Đặt tên Tunnel (ví dụ: `server-phancong-congty`) → Bấm **Save tunnel**.
4. Chọn môi trường **Windows**:
   - Cloudflare sẽ hiển thị lệnh cài đặt `cloudflared` kèm mã Token riêng cho PC của bạn.
   - Mở **PowerShell (Run as Administrator)** trên PC 24/7, copy lệnh Cloudflare cung cấp và dán vào chạy.
   - Lệnh dạng:
     ```powershell
     cloudflared.exe service install <TOKEN-CUẢ-BẠN>
     ```
   - Sau khi chạy xong, `cloudflared` sẽ trở thành một **Windows Service** tự động chạy ngầm mỗi khi máy tính khởi động.

5. Cấu hình đường dẫn truy cập (**Public Hostname**):
   - **Subdomain**: `phancong` (nếu muốn truy cập qua `phancong.tencongty.vn`) hoặc để trống.
   - **Domain**: Chọn `tencongty.vn`.
   - **Type**: Chọn `HTTP`.
   - **URL**: Gõ `localhost:3000`.
6. Bấm **Save Hostname**.

🎉 **XONG!** Từ lúc này, mọi người có thể gõ `https://phancong.tencongty.vn` trên máy tính hoặc điện thoại di động để truy cập hệ thống từ bất kỳ đâu.

---

### BƯỚC 4: Cấu hình PC 24/7 Tự Động Khởi Động Server khi bật máy

Để phòng trường hợp PC 24/7 bị khởi động lại hoặc mất điện, hãy cài đặt Server Node.js tự động chạy dưới dạng Service ngầm.

#### Cách 1: Dùng PM2 (Khuyên dùng - chuyên nghiệp)

1. Mở CMD (Admin) trên PC 24/7, cài đặt PM2:
   ```cmd
   npm install -g pm2
   npm install -g pm2-windows-startup
   pm2-startup install
   ```
2. Chạy ứng dụng bằng PM2 với biến môi trường `production`:
   ```cmd
   cd E:\web-phancong\backend
   set NODE_ENV=production
   pm2 start server.js --name "phancong-backend"
   pm2 save
   ```

#### Cách 2: Dùng Windows Task Scheduler (Không cần cài thêm thư viện)

1. Bấm phím `Windows + R`, gõ `taskschd.msc` rồi nhấn Enter.
2. Chọn **Create Basic Task...** → Đặt tên: `Phan Cong Server AutoStart`.
3. Trigger: Chọn **When the computer starts**.
4. Action: Chọn **Start a program**.
5. Program/script: Chọn file `E:\web-phancong\backend\start-server.bat`.
6. Bấm Finish.

---

## 🔒 LƯU Ý VỀ BẢO MẬT & VẬN HÀNH

1. **Thay đổi mật khẩu mặc định**:
   - Yêu cầu tất cả nhân viên đổi mật khẩu ngay sau lần đăng nhập đầu tiên.
2. **Sao lưu dữ liệu định kỳ**:
   - File cơ sở dữ liệu duy nhất nằm tại: `E:\web-phancong\backend\data\phancong.db`.
   - Nên copy file này ra USB hoặc lưu lên Google Drive/OneDrive 1 tuần 1 lần.
3. **Mặt định cài đặt Firewall trên PC 24/7**:
   - Khi dùng Cloudflare Tunnel, bạn **không cần mở Port 3000 out ngoài Internet**, giữ cho firewall PC an toàn tuyệt đối.

---

## 🛠️ PHƯƠNG ÁN PHỤ: MỞ PORT ROUTER (PORT FORWARDING)
*(Chỉ dùng nếu không muốn đổi Nameserver Mắt Bão về Cloudflare)*

1. Đăng ký gói **IP Tĩnh** với nhà mạng (FPT/Viettel/VNPT) hoặc cài phần mềm **DDNS (NO-IP)**.
2. Truy cập Router Wifi công ty (thường là `192.168.1.1`), vào mục **Port Forwarding**:
   - Trỏ Port `3000` (hoặc Port `80`) về IP nội bộ của PC 24/7 (Ví dụ: `192.168.1.150`).
3. Đăng nhập trang quản trị DNS của **Mắt Bão**:
   - Tạo bản ghi **A Record**: tên `@` hoặc `phancong` → Giá trị: IP Công cộng của công ty.
