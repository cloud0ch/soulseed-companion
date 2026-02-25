@echo off
chcp 65001 >nul
title Lin Wanwan Installer

echo ===================================================
echo   Soulseed Companion v0.0.8
echo ===================================================
echo.

code --list-extensions 2>nul | findstr /i "ssoulseed-companion-linwanwan" >nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Lin Wanwan is already installed!
    echo.
    pause
    exit /b 0
)

echo Installing...
echo.

if not exist "ssoulseed-companion-linwanwan-0.0.8.vsix" (
    echo [ERROR] vsix file not found in current directory.
    echo.
    pause
    exit /b 1
)

code --install-extension "ssoulseed-companion-linwanwan-0.0.8.vsix" --force

echo.
echo [DONE] Installation complete!
echo Open VS Code and find the heart icon on the left sidebar.
echo.
pause
