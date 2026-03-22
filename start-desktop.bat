@echo off
setlocal

echo ============================================
echo   Project AIRI - Desktop (Electron)
echo ============================================
echo.

if not exist "node_modules" (
    echo [ERROR] node_modules not found.
    echo Run install.bat first.
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %errorlevel% equ 0 goto run_pnpm

call npx pnpm --version >nul 2>&1
if %errorlevel% equ 0 goto run_npx

echo [ERROR] pnpm not found.
echo Run install.bat first.
pause
exit /b 1

:run_pnpm
echo Starting desktop app (Electron)...
echo Press Ctrl+C or close the window to stop.
echo.
call pnpm dev:tamagotchi
goto :eof

:run_npx
echo Starting desktop app (Electron)...
echo Press Ctrl+C or close the window to stop.
echo.
call npx pnpm dev:tamagotchi
goto :eof