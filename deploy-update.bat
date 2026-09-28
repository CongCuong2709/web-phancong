@echo off
chcp 65001 > nul
echo ============================================================
echo   TỰ ĐỘNG CẬP NHẬT ỨNG DỤNG PHÂN CÔNG CÔNG VIỆC TỪ GITHUB
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/4] Đang kéo mã nguồn mới nhất từ GitHub (git pull)...
git pull origin main
if errorlevel 1 (
    echo.
    echo [LỖI] Không thể kéo code từ GitHub. Vui lòng kiểm tra kết nối Internet!
    pause
    exit /b 1
)

echo.
echo [2/4] Cài đặt thư viện mới (nếu có)...
call npm install
cd backend
call npm install
cd ..

echo.
echo [3/4] Đóng gói giao diện mới (npm run build)...
call npm run build
if errorlevel 1 (
    echo.
    echo [LỖI] Đóng gói Frontend thất bại!
    pause
    exit /b 1
)

echo.
echo [4/4] Khởi động lại Server Backend...
pm2 restart phancong-app 2>nul
if errorlevel 1 (
    echo.
    echo [THÔNG BÁO] Không tìm thấy process PM2 "phancong-app".
    echo Nếu bạn đang chạy thủ công bằng start-server.bat, hãy tắt cửa sổ cũ và chạy lại file backend\start-server.bat
) else (
    echo [THÀNH CÔNG] Đã khởi động lại server PM2!
)

echo.
echo ============================================================
echo   🎉 CẬP NHẬT NGUYÊN BẢN MỚI NHẤT THÀNH CÔNG!
echo ============================================================
pause
