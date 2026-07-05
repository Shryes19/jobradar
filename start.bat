@echo off
title JobRadar
color 0A

:: Check setup has been run
if not exist "%~dp0backend\venv" (
    echo Run setup.bat first!
    pause & exit /b 1
)
if not exist "%~dp0frontend\node_modules" (
    echo Run setup.bat first!
    pause & exit /b 1
)

echo.
echo  ==========================================
echo   JobRadar is starting...
echo  ==========================================
echo.
echo  Backend  →  http://localhost:8000
echo  Frontend →  http://localhost:5173
echo.
echo  Both windows will open automatically.
echo  Close this window to stop everything.
echo.

:: Start backend in a new window
start "JobRadar Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --port 8000"

:: Wait 2 seconds then start frontend
timeout /t 2 /nobreak >nul
start "JobRadar Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Open browser after a short delay
timeout /t 4 /nobreak >nul
start "" "http://localhost:5173"

echo  JobRadar is running. Press any key to stop all servers.
pause >nul

:: Kill both server windows on exit
taskkill /fi "WindowTitle eq JobRadar Backend*" /f >nul 2>&1
taskkill /fi "WindowTitle eq JobRadar Frontend*" /f >nul 2>&1
