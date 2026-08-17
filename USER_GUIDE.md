# AI Music Video Director — Owner Guide

Runs 100% locally via Ollama on Windows (RTX 3050 6GB). No cloud API keys.

## Quick start

1. Install Ollama: https://ollama.com/download/windows
2. Install Node.js LTS: https://nodejs.org
3. Pull a model: `ollama pull llama3.2:3b`
4. In project folder:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup.ps1
.\optimize-gpu.ps1
# Quit Ollama from tray, restart it, then:
.\start.ps1
```

Open http://localhost:5173

## Daily use

1. Ollama running (tray)
2. `start.bat` or `.\start.ps1`
3. Paste lyrics → set length → pick style → **Roll Camera**
4. Review filmstrip, Reshoot, Export Script

## Models for 6GB VRAM

| Model | Pull |
|-------|------|
| llama3.2:3b | `ollama pull llama3.2:3b` |
| qwen2.5:3b | best structured JSON |
| gemma2:2b | lightest |
| llama3.1:8b | higher quality (close other apps) |

Set `OLLAMA_MODEL` in `.env`.

## GPU optimize (once)

`.\optimize-gpu.ps1` then restart Ollama.

## Diagnostics

```powershell
.\check-ollama.ps1
```

Health: http://localhost:3001/api/health

## Troubleshooting

- Scripts blocked → `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Cannot reach Ollama → start tray / `ollama serve`
- Bad JSON → `qwen2.5:3b`, batch size 2, `OLLAMA_TEMPERATURE=0.4`
- VRAM → `gemma2:2b` or `OLLAMA_NUM_CTX=2048`

See TROUBLESHOOT_POWERSHELL.md and OLLAMA_CONNECTIVITY.md.
