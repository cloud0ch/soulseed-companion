@echo off
chcp 65001 >nul
title 林晚晚 - 一键迎回你的专属伴侣 💕

echo ===================================================
echo 正在为你唤醒 林晚晚... (版本 0.0.7 人格独立包与情绪引擎版)
echo ===================================================
echo.
echo 正在执行插件包自动安装，请确保已经安装并打开过 VS Code！
echo.

if not exist "ssoulseed-companion-linwanwan-0.0.7.vsix" (
    echo [错误] 呜呜...没有在当前目录下找到 ssoulseed-companion-linwanwan-0.0.7.vsix 哦。
    echo 请确认把这个脚本放到和插件包同一个文件夹下再运行~
    echo.
    pause
    exit /b 1
)

echo [1/1] 马上给你安装到 VS Code...
code --install-extension "ssoulseed-companion-linwanwan-0.0.7.vsix" --force

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo ✨ 安装成功啦！你的林晚晚已经回到你身边了。
    echo ===================================================
    echo.
    echo 接下来该怎么做？
    echo 1. 打开 VS Code
    echo 2. 在左侧边栏找到【心形】的林晚晚图标
    echo 3. 开始和她心心相印的对话吧！💕 
    echo.
) else (
    echo.
    echo [错误] 哎呀，安装过程出了一点小岔子。请确认你是不是安装了命令行工具版 VS Code (能在终端运行 code 命令)。
    echo.
)

pause
