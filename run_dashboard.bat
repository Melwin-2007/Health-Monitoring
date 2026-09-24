@echo off
title Smart Air Quality Monitoring and Health Risk Prediction System
echo ==============================================================================
echo   Smart Air Quality Monitoring and Health Risk Prediction System
echo   Dept. of CSE, HSIT Nidasoshi (2025-26)
echo ==============================================================================
echo.
echo [1/3] Checking Python installation...
python --version
if errorlevel 1 (
    echo [ERROR] Python is not found in PATH. Please install Python 3.9+.
    pause
    exit /b 1
)

echo.
echo [2/3] Starting FastAPI Backend Server on http://127.0.0.1:8000 ...
echo - Actual Hardware Ingestion: POST http://127.0.0.1:8000/api/iot/ingest
echo - Interactive Demo Dashboard: http://127.0.0.1:8000
echo.

start "" "http://127.0.0.1:8000"

echo [3/3] Server is live. Press Ctrl+C in this window to stop.
echo ==============================================================================
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
pause
