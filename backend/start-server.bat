@echo off
REM ============================================================
REM  He thong Phan cong Cong viec v3
REM  Backend: http://localhost:3000
REM  Yeu cau: Node.js >= 22.5 (vi dung node:sqlite experimental)
REM ============================================================
echo ============================================
echo    He thong Phan cong Cong viec v3
echo    Backend: http://localhost:3000
echo ============================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo [Backend] Dang cai dat dependencies...
    npm install
    if errorlevel 1 (
        echo [Backend] Loi cai dat dependencies!
        pause
        exit /b 1
    )
)

REM Tu dong phat hien phien ban Node de chon flag hop ly.
REM Node >= 22.5 da ho tro node:sqlite (co the can --experimental-sqlite van OK).
REM Node < 22.5 bat buoc phai co flag.
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a&set NODE_MINOR=%%b

if %NODE_MAJOR% GEQ 23 (
    set NODE_FLAG=
) else if %NODE_MAJOR% EQU 22 (
    if %NODE_MINOR% GEQ 5 (
        set NODE_FLAG=--experimental-sqlite
    ) else (
        set NODE_FLAG=--experimental-sqlite
    )
) else (
    echo [Backend] CANH BAO: Can Node.js >= 22.5 de dung node:sqlite!
    set NODE_FLAG=--experimental-sqlite
)

echo [Backend] Node version:
node -v
echo [Backend] Dang khoi dong server...
node %NODE_FLAG% server.js
pause