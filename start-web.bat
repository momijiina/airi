@echo off
setlocal

echo ============================================
echo   Project AIRI - Web
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
echo Starting web dev server...
echo Open http://localhost:5173 in your browser.
echo Press Ctrl+C to stop.
echo.
call pnpm dev:web
goto :eof

:run_npx
echo Starting web dev server...
echo Open http://localhost:5173 in your browser.
echo Press Ctrl+C to stop.
echo.
call npx pnpm dev:web
goto :eof