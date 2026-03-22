@echo off
chcp 65001 >nul
setlocal

echo ============================================
echo   Project AIRI - デスクトップ版 起動
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

echo デスクトップ版（Electron）を起動しています...
echo 終了するには Ctrl+C を押すか、ウィンドウを閉じてください。
echo.

call pnpm dev:tamagotchi
