@echo off
title AI Music Video Director
cd /d "%~dp0"

echo.
echo  ========================================
echo   AI Music Video Director - Local
echo  ========================================
echo.

where ollama >nul 2>&1
if %errorlevel% neq 0 (
  echo  [!] Ollama not found in PATH.
  echo      Install from https://ollama.com/download/windows
  echo.
  pause
  exit /b 1
)

echo  [OK] Ollama found
echo.

if not exist .env (
  echo  Creating .env from .env.example ...
  copy /Y .env.example .env >nul
)

if not exist node_modules (
  echo  Installing npm packages (first run)...
  call npm install
  if %errorlevel% neq 0 (
    echo  [!] npm install failed
    pause
    exit /b 1
  )
)

echo  Starting server + frontend...
echo  Frontend: http://localhost:5173
echo  Proxy:    http://localhost:3001
echo.
echo  Close this window to stop.
echo.

call npm run dev
pause
