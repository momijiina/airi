@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================
echo   Project AIRI - 初回セットアップ
echo ============================================
echo.

:: ---- Node.js チェック ----
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [エラー] Node.js が見つかりません。
    echo https://nodejs.org/ からインストールしてください。
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER% を検出しました。

:: ---- corepack で pnpm を有効化 ----
echo.
echo pnpm をセットアップしています...
call corepack enable 2>nul
if %errorlevel% neq 0 (
    echo [警告] corepack enable に失敗しました。管理者権限で再試行してください。
    echo 手動で実行: corepack enable
    echo.
)

call corepack prepare --activate 2>nul

:: ---- pnpm チェック ----
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [情報] pnpm が PATH にありません。npm でインストールを試みます...
    call npm install -g pnpm@latest
    where pnpm >nul 2>&1
    if %errorlevel% neq 0 (
        echo [エラー] pnpm のインストールに失敗しました。
        echo 手動でインストールしてください: npm install -g pnpm
        pause
        exit /b 1
    )
)

for /f "tokens=*" %%v in ('pnpm --version') do set PNPM_VER=%%v
echo [OK] pnpm %PNPM_VER% を検出しました。

:: ---- 依存関係インストール ----
echo.
echo ============================================
echo   依存関係をインストールしています...
echo   （初回は時間がかかります）
echo ============================================
echo.

call pnpm install
if %errorlevel% neq 0 (
    echo.
    echo [エラー] pnpm install に失敗しました。
    echo ログを確認してください。
    pause
    exit /b 1
)

echo.
echo ============================================
echo   セットアップ完了！
echo ============================================
echo.
echo 次のバッチファイルでアプリを起動できます:
echo   start-web.bat       ... Web版を起動
echo   start-desktop.bat   ... デスクトップ版（Electron）を起動
echo.
pause
