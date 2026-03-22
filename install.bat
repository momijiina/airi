@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Project AIRI - Setup
echo ============================================
echo.

REM ---- Node.js check ----
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo Please install from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%

REM ---- pnpm setup ----
echo.
echo Setting up pnpm...

where pnpm >nul 2>&1
if %errorlevel% equ 0 goto pnpm_found

call corepack enable >nul 2>&1
call corepack prepare --activate >nul 2>&1
where pnpm >nul 2>&1
if %errorlevel% equ 0 goto pnpm_found

call npx pnpm --version >nul 2>&1
if %errorlevel% equ 0 goto pnpm_npx

echo [INFO] Installing pnpm via npm...
call npm install -g pnpm@latest >nul 2>&1
where pnpm >nul 2>&1
if %errorlevel% equ 0 goto pnpm_found

echo [ERROR] Failed to install pnpm.
echo Run as Administrator:
echo   corepack enable
echo   corepack prepare pnpm@latest --activate
pause
exit /b 1

:pnpm_found
for /f "tokens=*" %%v in ('pnpm --version') do set PNPM_VER=%%v
echo [OK] pnpm %PNPM_VER%
goto do_install

:pnpm_npx
for /f "tokens=*" %%v in ('npx pnpm --version') do set PNPM_VER=%%v
echo [OK] pnpm %PNPM_VER% (via npx)
goto do_install_npx

:do_install
echo.
echo ============================================
echo   Installing dependencies...
echo ============================================
echo.
call pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] pnpm install failed.
    pause
    exit /b 1
)
goto done

:do_install_npx
echo.
echo ============================================
echo   Installing dependencies...
echo ============================================
echo.
call npx pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] pnpm install failed.
    pause
    exit /b 1
)
goto done

:done
echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo Start the app with:
echo   start-web.bat       ... Web version
echo   start-desktop.bat   ... Desktop version (Electron)
echo.
pause