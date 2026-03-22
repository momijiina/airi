@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo   Project AIRI - Web版 起動
echo ============================================
echo.

:: ---- pnpm チェック ----
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [エラー] pnpm が見つかりません。
    echo 先に install.bat を実行してください。
    pause
    exit /b 1
)

:: ---- node_modules チェック ----
if not exist "node_modules" (
    echo [エラー] node_modules が見つかりません。
    echo 先に install.bat を実行してください。
    pause
    exit /b 1
)

echo Web版の開発サーバーを起動しています...
echo ブラウザで http://localhost:5173 を開いてください。
echo 終了するには Ctrl+C を押してください。
echo.

call pnpm dev:web
