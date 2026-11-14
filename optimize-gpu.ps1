# Optimize Ollama for RTX 3050 6GB (Windows)
# Run once, then quit Ollama from tray and start again.

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host " Ollama GPU optimization for RTX 3050 6GB" -ForegroundColor Cyan
Write-Host ""

$vars = @{
  "OLLAMA_FLASH_ATTENTION"   = "1"
  "OLLAMA_KV_CACHE_TYPE"     = "q8_0"
  "OLLAMA_GPU_OVERHEAD"      = "1073741824"
  "OLLAMA_MAX_LOADED_MODELS" = "1"
  "OLLAMA_NUM_PARALLEL"      = "1"
  "OLLAMA_KEEP_ALIVE"        = "30m"
  "OLLAMA_CONTEXT_LENGTH"    = "4096"
}

foreach ($name in $vars.Keys) {
  $value = $vars[$name]
  [Environment]::SetEnvironmentVariable($name, $value, "User")
  Write-Host "  Set $name = $value" -ForegroundColor Green
}

Write-Host ""
Write-Host " Done. Quit Ollama from the system tray, start it again from the Start menu." -ForegroundColor Yellow
Write-Host ""
