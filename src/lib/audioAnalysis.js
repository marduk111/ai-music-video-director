const ENERGY_BUCKETS = 80

let sharedCtx = null
function getCtx() {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return sharedCtx
}

async function rmsEnvelope(buffer, filterType = null, freq = 0) {
  let srcBuffer = buffer
  if (filterType) {
    const offline = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )
    const src = offline.createBufferSource()
    src.buffer = buffer
    const filter = offline.createBiquadFilter()
    if (filterType === 'lowpass') {
      filter.type = 'lowpass'
      filter.frequency.value = freq
    } else if (filterType === 'bandpass') {
      filter.type = 'bandpass'
      filter.frequency.value = freq
      filter.Q.value = 0.7
    } else {
      filter.type = 'highpass'
      filter.frequency.value = freq
    }
    src.connect(filter)
    filter.connect(offline.destination)
    src.start(0)
    srcBuffer = await offline.startRendering()
  }
  const data = srcBuffer.getChannelData(0)
  const hop = Math.max(1, Math.floor(srcBuffer.sampleRate * 0.1))
  const frames = Math.floor(data.length / hop)
  const env = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    let sum = 0
    const start = f * hop
    for (let i = 0; i < hop; i += 4) {
      const v = data[start + i]
      sum += v * v
    }
    env[f] = Math.sqrt(sum / (hop / 4))
  }
  return env
}

function normalize(arr) {
  let max = 0
  for (let i = 0; i < arr.length; i++) max = Math.max(max, arr[i])
  if (max === 0) return arr
  const out = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / max
  return out
}

function resampleToBuckets(arr, n = ENERGY_BUCKETS) {
  const out = []
  const step = arr.length / n
  for (let b = 0; b < n; b++) {
    const s = Math.floor(b * step)
    const e = Math.min(arr.length, Math.max(s + 1, Math.floor((b + 1) * step)))
    let sum = 0
    for (let i = s; i < e; i++) sum += arr[i]
    out.push(sum / (e - s))
  }
  return out
}

export function estimateBpm(env, sampleRate = 10) {
  // env: RMS envelope (~100ms frames => 10 fps). Onset flux + autocorrelation.
  const flux = new Float32Array(env.length)
  for (let i = 1; i < env.length; i++) {
    flux[i] = Math.max(0, env[i] - env[i - 1])
  }
  const minLag = Math.floor((60 / 180) * sampleRate) // 180 BPM
  const maxLag = Math.ceil((60 / 60) * sampleRate) // 60 BPM
  let bestLag = 0
  let bestScore = -1
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0
    for (let i = lag; i < flux.length; i++) score += flux[i] * flux[i - lag]
    score /= flux.length - lag
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  if (!bestLag) return 120
  let bpm = (60 * sampleRate) / bestLag
  while (bpm > 180) bpm /= 2
  while (bpm < 60) bpm *= 2
  return Math.round(bpm)
}

export function zeroCrossingRate(buffer) {
  const data = buffer.getChannelData(0)
  const limit = Math.min(data.length, buffer.sampleRate * 30)
  let crossings = 0
  for (let i = 1; i < limit; i++) {
    if ((data[i - 1] >= 0) !== (data[i] >= 0)) crossings++
  }
  return crossings / limit
}

export async function analyzeAudioFile(file, onProgress = () => {}) {
  onProgress('Decoding audio...')
  const ctx = getCtx()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0))

  onProgress('Analyzing waveform...')
  const mono = await rmsEnvelope(buffer)
  onProgress('Splitting frequency bands...')
  const [bassEnv, midEnv, trebleEnv] = await Promise.all([
    rmsEnvelope(buffer, 'lowpass', 250),
    rmsEnvelope(buffer, 'bandpass', 1500),
    rmsEnvelope(buffer, 'highpass', 6000),
  ])

  onProgress('Estimating tempo...')
  const bpm = estimateBpm(mono)
  const zcr = zeroCrossingRate(buffer)

  const normMono = normalize(mono)
  const energyBuckets = resampleToBuckets(normMono)
  const bass = resampleToBuckets(normalize(bassEnv))
  const mid = resampleToBuckets(normalize(midEnv))
  const treble = resampleToBuckets(normalize(trebleEnv))

  let peak = 0
  for (let i = 0; i < energyBuckets.length; i++) peak = Math.max(peak, energyBuckets[i])

  return {
    fileName: file.name,
    fileSize: file.size,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    bpm,
    zcr,
    energyBuckets,
    bass,
    mid,
    treble,
    peak,
  }
}

export function averageEnergy(audio, startSec, endSec) {
  if (!audio || !audio.energyBuckets?.length) return 0.5
  const dur = audio.duration || 1
  const n = audio.energyBuckets.length
  const s = Math.max(0, Math.floor((startSec / dur) * n))
  const e = Math.min(n, Math.max(s + 1, Math.ceil((endSec / dur) * n)))
  let sum = 0
  for (let i = s; i < e; i++) sum += audio.energyBuckets[i]
  return sum / (e - s)
}

// ---------- Beat-synced scene timing (the mesh/LTXV plan) ----------
// LTXV generates any 8n+1 frame count at 25fps, so instead of VEO's fixed
// 8-second blocks, scene boundaries land on musical bars and each shot's
// length breathes with the song's energy: 2 bars on peaks, 8 in calm.
export function barSeconds(bpm) {
  if (!bpm || bpm < 40) return 2 // fallback: 120 BPM bar
  return (60 / bpm) * 4
}

export function framesForDuration(seconds) {
  // snap to the nearest valid LTXV length (8n+1 frames @ 25fps), min 1 bar-ish
  const n = Math.max(1, Math.round((seconds * 25 - 1) / 8))
  return 8 * n + 1
}

/**
 * Walk the song and cut scenes on bar lines with energy-adaptive lengths.
 * @returns {Array<{start, end, bars, intensity}>} boundaries aligned to bars;
 *          the final scene absorbs any tail shorter than its own bar budget.
 */
export function beatSyncedBoundaries(audio, totalSeconds, { minBars = 2, maxBars = 8 } = {}) {
  const bar = barSeconds(audio?.bpm)
  const out = []
  let start = 0
  while (start < totalSeconds - 0.01) {
    const remaining = totalSeconds - start
    const intensity = averageEnergy(audio, start, Math.min(start + bar * minBars, totalSeconds))
    let bars = intensity > 0.62 ? minBars : intensity > 0.34 ? Math.round((minBars + maxBars) / 2) : maxBars
    // tail: if what's left fits inside one scene's budget, absorb it
    if (remaining <= bars * bar * 1.05) {
      out.push({ start, end: totalSeconds, bars: Math.max(1, Math.round(remaining / bar)), intensity })
      break
    }
    // don't leave a sliver scene behind: if the next scene would be shorter
    // than a minimum cut, stretch this one to swallow the rest
    if (remaining - bars * bar < minBars * bar) {
      out.push({ start, end: totalSeconds, bars: Math.max(1, Math.round(remaining / bar)), intensity })
      break
    }
    out.push({ start, end: start + bars * bar, bars, intensity })
    start += bars * bar
  }
  if (!out.length) out.push({ start: 0, end: totalSeconds, bars: maxBars, intensity: 0.5 })
  return out
}

// ---------- Lyrics ----------

export function parseLyrics(text) {
  const lines = text.split('\n')
  const result = []
  let currentSection = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const sectionMatch = line.match(/^\[([^\]]+)\]$/i)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      continue
    }
    const tsMatch = line.match(/^\[(\d{1,2}):(\d{2})\]\s*(.*)$/)
    if (tsMatch) {
      result.push({
        text: tsMatch[3] || line,
        timestampSeconds: parseInt(tsMatch[1], 10) * 60 + parseInt(tsMatch[2], 10),
        section: currentSection,
      })
      continue
    }
    result.push({ text: line, timestampSeconds: null, section: currentSection })
  }
  return result
}

export function distributeLyrics(parsedLyrics, scenes, totalDuration) {
  const hasTimestamps = parsedLyrics.some((l) => l.timestampSeconds !== null)
  const out = scenes.map(() => [])
  if (!parsedLyrics.length) return out

  if (hasTimestamps) {
    for (const lyric of parsedLyrics) {
      const t = lyric.timestampSeconds ?? 0
      const idx = scenes.findIndex(
        (s) => t >= s.startTimeSeconds && t < s.endTimeSeconds
      )
      const target = idx >= 0 ? idx : scenes.length - 1
      out[target].push({
        text: lyric.text,
        timestampSeconds: t,
        section: lyric.section,
      })
    }
    return out
  }

  // Proportional distribution preserving section grouping
  const groups = []
  for (const lyric of parsedLyrics) {
    const last = groups[groups.length - 1]
    if (last && last.section === lyric.section) last.lines.push(lyric.text)
    else groups.push({ section: lyric.section, lines: [lyric.text] })
  }
  const totalLines = parsedLyrics.length
  let lineCursor = 0
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const groupStartFrac = lineCursor / totalLines
    lineCursor += group.lines.length
    const groupEndFrac = lineCursor / totalLines
    const startIdx = Math.floor(groupStartFrac * scenes.length)
    const endIdx = Math.max(startIdx + 1, Math.round(groupEndFrac * scenes.length))
    const span = Math.min(scenes.length, endIdx) - startIdx
    const per = Math.max(1, Math.ceil(group.lines.length / Math.max(1, span)))
    let li = 0
    for (let si = startIdx; si < Math.min(scenes.length, endIdx); si++) {
      const chunk = group.lines.slice(li, li + per)
      li += per
      for (const text of chunk) {
        out[si].push({
          text,
          timestampSeconds: Math.round(
            scenes[si].startTimeSeconds +
              ((si - startIdx) / Math.max(1, span)) *
                (scenes[si].endTimeSeconds - scenes[si].startTimeSeconds)
          ),
          section: group.section,
        })
      }
    }
  }
  return out
}

export function formatTimecode(seconds, fps = 25) {
  const s = Math.max(0, seconds)
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(Math.floor(s % 60)).padStart(2, '0')
  const ff = String(Math.floor((s % 1) * fps)).padStart(2, '0')
  return `${hh}:${mm}:${ss}:${ff}`
}

export function formatMMSS(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${mm}:${ss}`
}
