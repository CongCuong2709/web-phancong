@echo off
echo ============================================
echo    He thong Phan cong Cong viec v3
echo    Backend: http://localhost:3000
echo ============================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo [Backend] Dang cai dat dependencies...
    npm install
)

echo [Backend] Dang khoi dong server...
node --experimental-sqlite server.js
pause
