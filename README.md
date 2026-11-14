# AI Music Video Director (Local)

Turn lyrics into a cinematic, scene-by-scene storyboard with camera direction and ready-to-use video-generation prompts.

**Runs 100% locally** on a Windows laptop with an RTX 3050 6GB — no cloud API keys, no subscription.

Powered by **Ollama** (GPU), **Hugging Face** models via Ollama, fully open source (MIT).

---

## Hardware target

| Component | Recommended |
|-----------|-------------|
| GPU | NVIDIA RTX 3050 6GB (or better) |
| OS | Windows 10 / 11 |
| RAM | 16 GB recommended |

---

## Quick start (Windows)

### 1. Install Ollama
https://ollama.com/download/windows → install → tray icon should appear.

```powershell
ollama --version
ollama pull llama3.2:3b
```

### 2. Install Node.js LTS
https://nodejs.org → install → **reopen PowerShell**.

```powershell
node -v
npm -v
```

### 3. Clone and setup

```powershell
git clone https://github.com/marduk111/ai-music-video-director.git
cd ai-music-video-director

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup.ps1
.\optimize-gpu.ps1
# Quit Ollama from tray, start it again, then:
.\start.ps1
```

Or double-click **`start.bat`**.

Open **http://localhost:5173**

---

## PowerShell tip

If scripts are blocked:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

See **TROUBLESHOOT_POWERSHELL.md** and **OLLAMA_CONNECTIVITY.md**.

---

## Models for 6GB VRAM

| Model | Command |
|-------|---------|
| llama3.2:3b (default) | `ollama pull llama3.2:3b` |
| qwen2.5:3b (best JSON) | `ollama pull qwen2.5:3b` |
| gemma2:2b (lightest) | `ollama pull gemma2:2b` |
| llama3.1:8b (higher quality) | `ollama pull llama3.1:8b` |

Set `OLLAMA_MODEL` in `.env`.

---

## Architecture

```
Browser → Vite (:5173) → Express proxy (:3001) → Ollama (:11434) → GPU
```

Health: http://localhost:3001/api/health  
Diagnose: `.\check-ollama.ps1`

---

## Scripts

| File | Purpose |
|------|---------|
| `setup.ps1` | First-time setup |
| `start.bat` / `start.ps1` | Launch app |
| `optimize-gpu.ps1` | Ollama GPU env for RTX 3050 |
| `check-ollama.ps1` | API connectivity check |
| `Modelfile.rtx3050` | Optional custom model profile |

---

## License

MIT
