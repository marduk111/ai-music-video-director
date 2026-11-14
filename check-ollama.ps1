# Diagnose Ollama API connectivity (Windows)
# Run:  powershell -ExecutionPolicy Bypass -File .\check-ollama.ps1

$ErrorActionPreference = "Continue"
Write-Host ""
Write-Host " Ollama API connectivity check" -ForegroundColor Cyan
Write-Host " ------------------------------"
Write-Host ""

$base = "http://localhost:11434"
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*OLLAMA_BASE_URL\s*=\s*(.+)\s*$') {
      $base = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}
$base = $base.TrimEnd('/')
Write-Host " Target: $base"
Write-Host ""

$proc = Get-Process -Name "ollama*" -ErrorAction SilentlyContinue
if ($proc) {
  Write-Host " [OK] Ollama process running (PID: $($proc.Id -join ', '))" -ForegroundColor Green
} else {
  Write-Host " [!] No Ollama process found" -ForegroundColor Red
  Write-Host "     Start Ollama from the Start menu or system tray."
  Write-Host "     Or run: ollama serve"
}

Write-Host ""
try {
  $tnc = Test-NetConnection -ComputerName localhost -Port 11434 -WarningAction SilentlyContinue
  if ($tnc.TcpTestSucceeded) {
    Write-Host " [OK] Port 11434 is open on localhost" -ForegroundColor Green
  } else {
    Write-Host " [!] Port 11434 is NOT accepting connections" -ForegroundColor Red
  }
} catch {
  Write-Host " [?] Could not test port" -ForegroundColor Yellow
}

Write-Host ""
$names = @()
try {
  $tags = Invoke-RestMethod -Uri "$base/api/tags" -TimeoutSec 5
  $names = @($tags.models | ForEach-Object { $_.name })
  Write-Host " [OK] API /api/tags reachable" -ForegroundColor Green
  if ($names.Count -eq 0) {
    Write-Host " [!] No models. Run: ollama pull llama3.2:3b" -ForegroundColor Yellow
  } else {
    Write-Host "     Models: $($names -join ', ')"
  }
} catch {
  Write-Host " [!] API /api/tags FAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "     Start Ollama, or try http://127.0.0.1:11434 in .env"
}

Write-Host ""
$model = "llama3.2:3b"
if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match '^\s*OLLAMA_MODEL\s*=\s*(.+)\s*$') {
      $model = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}

if ($names -and ($names -contains $model -or ($names | Where-Object { $_ -like "$($model.Split(':')[0])*" }))) {
  Write-Host " Smoke test generate with model: $model ..."
  try {
    $body = @{ model = $model; prompt = "Reply with exactly: OK"; stream = $false; options = @{ num_predict = 8 } } | ConvertTo-Json -Depth 5
    $gen = Invoke-RestMethod -Uri "$base/api/generate" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120
    $preview = ($gen.response -replace '\s+', ' ').Substring(0, [Math]::Min(80, $gen.response.Length))
    Write-Host " [OK] /api/generate responded: $preview" -ForegroundColor Green
  } catch {
    Write-Host " [!] /api/generate failed: $($_.Exception.Message)" -ForegroundColor Red
  }
} else {
  Write-Host " [skip] Model '$model' not listed — ollama pull $model"
}

Write-Host ""
try {
  $h = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 3
  Write-Host " [OK] App proxy health => $($h.status) model=$($h.model)" -ForegroundColor Green
} catch {
  Write-Host " [i] App proxy not on :3001 (start with .\start.ps1)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host " Done."
Write-Host ""
