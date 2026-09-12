@echo off
title KokoClone Launcher
cd /d "%~dp0kokoclone"

echo =======================================================
echo          Starting KokoClone Web Server
echo =======================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment (.venv) was not found in kokoclone!
    echo Please make sure dependencies are installed first.
    echo.
    pause
    exit /b 1
)

echo Using Python: kokoclone\.venv\Scripts\python.exe
echo Web UI will be available at: http://127.0.0.1:7860
echo.
echo Note: First launch may take a minute while models load.
echo Press Ctrl+C in this window to stop the server.
echo =======================================================
echo.

".venv\Scripts\python.exe" app.py

echo.
echo =======================================================
echo KokoClone process ended.
echo =======================================================
pause
