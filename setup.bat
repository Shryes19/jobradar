@echo off
title JobRadar — First-Time Setup
color 0A
echo.
echo  ==========================================
echo   JobRadar — First-Time Setup
echo  ==========================================
echo.

:: ── Backend setup ───────────────────────────────────────────────
echo [1/4] Setting up Python virtual environment...
cd /d "%~dp0backend"
if not exist "venv" (
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Python not found. Install Python 3.10+ from https://python.org
        pause & exit /b 1
    )
)

echo [2/4] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo ERROR: Failed to install Python packages.
    pause & exit /b 1
)

:: ── Create .env if missing ───────────────────────────────────────
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo.
    echo  IMPORTANT: Open backend\.env and add your API keys:
    echo    GROQ_API_KEY   — get free at https://console.groq.com/keys
    echo    APIFY_API_KEY  — get free at https://console.apify.com/account/integrations
    echo.
)

:: ── Frontend setup ───────────────────────────────────────────────
cd /d "%~dp0frontend"
echo [3/4] Installing Node.js dependencies...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause & exit /b 1
)
call npm install --silent
if errorlevel 1 (
    echo ERROR: npm install failed.
    pause & exit /b 1
)

echo [4/4] Setup complete!
echo.
echo  Next steps:
echo   1. Open backend\.env and add your API keys (or use Settings inside the app)
echo   2. Run start.bat to launch JobRadar
echo.
pause
