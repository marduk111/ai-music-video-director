# First-time setup for Windows + RTX 3050
# If blocked: powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = "Continue"
Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host " AI Music Video Director — Setup" -ForegroundColor Cyan
Write-Host " --------------------------------"
Write-Host ""

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "ollama")) {
  Write-Host " [!] Ollama is not installed." -ForegroundColor Red
  Write-Host "     Download: https://ollama.com/download/windows"
  exit 1
}
Write-Host " [OK] Ollama is installed" -ForegroundColor Green

if (-not (Test-Command "node")) {
  Write-Host " [!] Node.js not found. Install LTS from https://nodejs.org" -ForegroundColor Red
  exit 1
}
Write-Host " [OK] Node.js $(node -v)" -ForegroundColor Green

if (-not (Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  Write-Host " [OK] Created .env" -ForegroundColor Green
} else {
  Write-Host " [OK] .env already exists" -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host " Installing dependencies..."
  npm install
  if ($LASTEXITCODE -ne 0) { Write-Host " [!] npm install failed" -ForegroundColor Red; exit 1 }
} else {
  Write-Host " [OK] node_modules present" -ForegroundColor Green
}

Write-Host ""
Write-Host " Recommended model for RTX 3050 6GB: llama3.2:3b"
$pull = Read-Host " Pull llama3.2:3b now? (Y/n)"
if ($pull -eq "" -or $pull -match "^[Yy]") {
  ollama pull llama3.2:3b
}

Write-Host ""
Write-Host " Optional: .\optimize-gpu.ps1 then restart Ollama" -ForegroundColor Yellow
Write-Host " Setup complete. Run .\start.ps1 or start.bat" -ForegroundColor Green
