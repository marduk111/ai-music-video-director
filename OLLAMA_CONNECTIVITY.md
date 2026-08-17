# Ollama API connectivity

How this app talks to Ollama and how to fix connection issues.

## Architecture

```
Browser (localhost:5173)
    → Express proxy (localhost:3001)
        → Ollama (localhost:11434)
            → RTX 3050 GPU
```

- Frontend never calls Ollama directly.
- Proxy URL: `OLLAMA_BASE_URL` in `.env` (default `http://localhost:11434`).
- Model: `OLLAMA_MODEL` (default `llama3.2:3b`).

## Diagnostic

```powershell
powershell -ExecutionPolicy Bypass -File .\check-ollama.ps1
```

Or manual:

```powershell
Get-Process ollama* -ErrorAction SilentlyContinue
Test-NetConnection localhost -Port 11434
Invoke-RestMethod http://localhost:11434/api/tags
ollama list
```

## Common fixes

| Symptom | Fix |
|---------|-----|
| Connection refused | Start Ollama (tray / `ollama serve`) |
| localhost fails | Set `OLLAMA_BASE_URL=http://127.0.0.1:11434` |
| model_missing | `ollama pull llama3.2:3b` — match `.env` exactly |
| Generate hangs | First load is slow; try smaller model / `OLLAMA_NUM_CTX=2048` |

Health: http://localhost:3001/api/health

| status | Meaning |
|--------|--------|
| ok | Ready |
| model_missing | Pull / fix model name |
| ollama_unreachable | Start Ollama / fix URL |
