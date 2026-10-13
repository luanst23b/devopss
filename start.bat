@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS and try again.
  pause
  exit /b 1
)

node backend\scripts\start-local.js
if errorlevel 1 (
  echo.
  echo Startup failed. Read the error above, then try again.
)
pause
