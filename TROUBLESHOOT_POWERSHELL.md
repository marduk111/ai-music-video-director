# Troubleshoot PowerShell execution errors

## Error: running scripts is disabled

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

Or one-shot:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Or double-click `start.bat`.

## Error: not digitally signed

```powershell
Unblock-File .\start.ps1
Unblock-File .\setup.ps1
Unblock-File .\optimize-gpu.ps1
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

## Error: term not recognized

Wrong directory or PATH not refreshed. Open PowerShell **in** the project folder (Explorer address bar → `powershell`). After installing Ollama/Node, close **all** terminals and open a new one.

## Error: ollama / node not recognized

Reinstall with PATH, reopen PowerShell, or reboot once.

## npm EPERM

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install
```

## Port in use

Change `PORT=3002` in `.env`, or kill the process using 3001/5173.

## Manual start (no scripts)

```powershell
cd path\to\ai-music-video-director
npm install
copy .env.example .env
ollama pull llama3.2:3b
npm run dev
```

Open http://localhost:5173
