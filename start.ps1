# AI Music Video Director — Windows launcher
# If blocked:  powershell -ExecutionPolicy Bypass -File .\start.ps1

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host " ========================================" -ForegroundColor DarkYellow
Write-Host "  AI Music Video Director - Local" -ForegroundColor DarkYellow
Write-Host " ========================================" -ForegroundColor DarkYellow
Write-Host ""

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "ollama")) {
  Write-Host " [!] Ollama not found in PATH." -ForegroundColor Red
  Write-Host "     Install: https://ollama.com/download/windows"
  Write-Host "     Then close this window, open a NEW PowerShell, and try again."
  Write-Host ""
  Read-Host "Press Enter to exit"
  exit 1
}
Write-Host " [OK] Ollama found" -ForegroundColor Green

if (-not (Test-Command "node")) {
  Write-Host " [!] Node.js not found in PATH." -ForegroundColor Red
  Write-Host "     Install LTS: https://nodejs.org"
  Write-Host "     Reopen PowerShell after installing."
  Write-Host ""
  Read-Host "Press Enter to exit"
  exit 1
}
if (-not (Test-Command "npm")) {
  Write-Host " [!] npm not found. Reinstall Node.js LTS and reopen PowerShell." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}
Write-Host " [OK] Node $(node -v) / npm $(npm -v)" -ForegroundColor Green

if (-not (Test-Path -LiteralPath ".env")) {
  if (Test-Path -LiteralPath ".env.example") {
    Copy-Item -LiteralPath ".env.example" -Destination ".env"
    Write-Host " [OK] Created .env from .env.example" -ForegroundColor Green
  } else {
    Write-Host " [!] Missing .env and .env.example" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
  }
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host " Installing npm packages (first run)..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host " [!] npm install failed. Try:" -ForegroundColor Red
    Write-Host "     Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue"
    Write-Host "     Remove-Item package-lock.json -ErrorAction SilentlyContinue"
    Write-Host "     npm install"
    Read-Host "Press Enter to exit"
    exit 1
  }
}

try {
  $tags = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 3
  $names = @($tags.models | ForEach-Object { $_.name })
  Write-Host " [OK] Ollama running. Models: $($names -join ', ')" -ForegroundColor Green
} catch {
  Write-Host " [!] Ollama not responding on localhost:11434" -ForegroundColor Yellow
  Write-Host "     Start it from the system tray or: ollama serve"
  Write-Host "     Pull a model: ollama pull llama3.2:3b"
  Write-Host ""
}

Write-Host ""
Write-Host " Starting server + frontend..."
Write-Host " Frontend: http://localhost:5173"
Write-Host " Proxy:    http://localhost:3001"
Write-Host " Health:   http://localhost:3001/api/health"
Write-Host ""
Write-Host " Close this window or press Ctrl+C to stop."
Write-Host ""

npm run dev
