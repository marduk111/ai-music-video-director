// AMVD transcription sidecar — Whisper lyric auto-transcription, fully local.
// Ported from the original desktop app's server (Xenova/whisper-medium via
// transformers.js, vocal-boosted ffmpeg prepass, 30s chunking). The Vite dev
// server proxies /amvd/* to this server, so the app never needs CORS.
import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'Xenova/whisper-medium'
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_SIZE) || 52_428_800

const UPLOAD_DIR = path.join(os.tmpdir(), 'amvd-uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin'
    cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(mp3|wav|m4a|flac|ogg|opus|aac|wma|mp4|mov|mkv|webm|avi|ts|m4v)$/i
    if (allowed.test(path.extname(file.originalname))) cb(null, true)
    else cb(new Error('Unsupported format. Use MP3, WAV, M4A, FLAC, OGG, MP4, MOV, MKV, or WebM.'))
  },
})

let _whisperPipeline = null
async function getWhisperPipeline() {
  if (_whisperPipeline) return _whisperPipeline
  console.log(`[Whisper] Loading model: ${WHISPER_MODEL} (first load downloads ~150MB)...`)
  const { pipeline } = await import('@huggingface/transformers')
  _whisperPipeline = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
    device: 'cpu',
    dtype: 'fp32',
  })
  console.log('[Whisper] Model loaded.')
  return _whisperPipeline
}

async function convertToWav(inputPath) {
  const outputPath = path.join(UPLOAD_DIR, `converted_${Date.now()}.wav`)
  // vocal-boost prepass: the original's proven filter chain
  await execFileAsync('ffmpeg', [
    '-i', inputPath,
    '-ar', '16000',
    '-ac', '1',
    '-af', 'highpass=f=200,lowpass=f=3000,volume=2.0',
    '-c:a', 'pcm_s16le',
    '-f', 'wav',
    '-y',
    outputPath,
  ], { timeout: 120_000 })
  return outputPath
}

function wavToFloat32(wavPath) {
  const buf = fs.readFileSync(wavPath)
  if (buf.length < 44) throw new Error('WAV file too small')
  const sampleRate = buf.readUInt32LE(24)
  const bitsPerSample = buf.readUInt16LE(34)
  if (bitsPerSample !== 16) throw new Error(`Unsupported bit depth: ${bitsPerSample} (need 16)`)
  const dataStart = 44
  const numSamples = Math.floor((buf.length - dataStart) / 2)
  const float32 = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) float32[i] = buf.readInt16LE(dataStart + i * 2) / 32768.0
  return { audio: float32, sampleRate }
}

async function transcribeAudio(wavPath) {
  const asr = await getWhisperPipeline()
  const { audio, sampleRate } = wavToFloat32(wavPath)
  const duration = audio.length / sampleRate
  console.log(`[Whisper] Audio: ${duration.toFixed(1)}s, splitting into 30s chunks...`)

  const CHUNK_SECONDS = 30
  const chunkSamples = CHUNK_SECONDS * sampleRate
  const numChunks = Math.ceil(audio.length / chunkSamples)
  const allText = []
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSamples
    const end = Math.min(start + chunkSamples, audio.length)
    const chunk = audio.slice(start, end)
    console.log(`[Whisper] Chunk ${i + 1}/${numChunks} (${(chunk.length / sampleRate).toFixed(1)}s)...`)
    const result = await asr(chunk, {
      sampling_rate: sampleRate,
      language: 'en',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    })
    const text = result?.text?.trim()
    if (text) {
      allText.push(text)
      console.log(`[Whisper] Chunk ${i + 1}: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`)
    } else {
      console.log(`[Whisper] Chunk ${i + 1}: (no speech)`)
    }
  }
  const fullText = allText.join('\n\n')
  if (!fullText.trim()) throw new Error('Whisper returned empty transcription - no speech detected.')
  console.log(`[Whisper] Total: ${fullText.length} chars from ${numChunks} chunks`)
  return fullText.trim()
}

const jobs = new Map() // id -> {status, text?, error?}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, whisperModel: WHISPER_MODEL, whisperReady: !!_whisperPipeline, jobs: jobs.size })
})

app.get('/api/transcribe/status/:id', (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) return res.status(404).json({ error: 'no such job' })
  res.json(job)
})

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' })
  const id = `tr_${Date.now().toString(36)}`
  jobs.set(id, { status: 'working', fileName: req.file.originalname })
  res.json({ job: id })
  // run in the background — long songs take minutes on CPU
  ;(async () => {
    const input = req.file.path
    try {
      const wav = await convertToWav(input)
      const text = await transcribeAudio(wav)
      jobs.set(id, { status: 'done', text, fileName: req.file.originalname })
      fs.unlink(wav, () => {})
    } catch (e) {
      console.error('[Whisper] failed:', e.message)
      jobs.set(id, { status: 'error', error: e.message, fileName: req.file.originalname })
    } finally {
      fs.unlink(input, () => {})
    }
  })()
})

app.listen(PORT, () => {
  console.log(`[AMVD] transcription sidecar on http://127.0.0.1:${PORT}`)
})
