import {
  VISUAL_STYLES,
  STYLE_AESTHETICS,
  CAMERA_ANGLES,
  TRANSITIONS,
  MARKER_COLORS,
} from './constants.js'
import { averageEnergy, parseLyrics, distributeLyrics, formatMMSS } from './audioAnalysis.js'

const KEY_POOL = ['A Minor', 'C Minor', 'D Minor', 'E Minor', 'F Minor', 'G Minor', 'F Major', 'C Major', 'G Major', 'D Major']
const INSTRUMENTATION_BY_PROFILE = {
  bassHeavy: ['808 sub bass', 'deep synth pads', 'punchy kick drum'],
  bright: ['shimmering synthesizers', 'hi-hats', 'airy vocal textures'],
  balanced: ['rhythmic acoustic guitar', 'warm piano chords', 'steady percussion'],
  sparse: ['ambient textures', 'minimal piano notes', 'soft atmospheric pads'],
}

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function spectralProfile(audio) {
  if (!audio) return 'balanced'
  const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
  const bass = avg(audio.bass || [0])
  const treble = avg(audio.treble || [0])
  if (bass > 0.5 && treble < 0.3) return 'bassHeavy'
  if (treble > 0.35 && bass < 0.4) return 'bright'
  if (avg(audio.energyBuckets || [0]) < 0.25) return 'sparse'
  return 'balanced'
}

function pickCameraAngle(intensity, prevAngle, seedIdx) {
  const high = ['Dynamic whip-pan shot', 'Low angle tracking shot', 'Wide cinematic landscape shot']
  const mid = ['Slow dolly push-in', 'High angle overhead view', 'Low angle tracking shot']
  const low = ['Eye-level close-up', 'Slow dolly push-in', 'Dutch angle perspective']
  const pool = intensity > 0.62 ? high : intensity > 0.34 ? mid : low
  let idx = (seedIdx + pool.indexOf(prevAngle) + 1) % pool.length
  let angle = pool[idx % pool.length]
  if (angle === prevAngle) angle = CAMERA_ANGLES[(CAMERA_ANGLES.indexOf(angle) + 1) % CAMERA_ANGLES.length]
  return angle
}

function actionVerb(intensity) {
  if (intensity > 0.62) return 'striding with'
  if (intensity > 0.34) return 'holding'
  return 'cradling'
}

function pacingPhrase(bpm) {
  if (!bpm) return ''
  if (bpm >= 128) return 'rapid beat-synced cutting rhythm'
  if (bpm >= 100) return 'driving rhythmic pacing'
  return 'slow lingering pacing'
}

function dynamicsDescription(buckets) {
  if (!buckets?.length) return 'Steady energy throughout.'
  const first = buckets.slice(0, Math.floor(buckets.length * 0.2))
  const last = buckets.slice(Math.floor(buckets.length * 0.8))
  const peak = Math.max(...buckets)
  const avg = buckets.reduce((s, v) => s + v, 0) / buckets.length
  const avgOf = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length)
  const parts = []
  parts.push(avgOf(first) < avg * 0.7 ? 'Quiet intro building steadily' : 'Confident opening')
  parts.push(peak > avg * 1.4 ? 'with explosive climactic peaks' : 'with consistent forward momentum')
  parts.push(avgOf(last) < avg * 0.75 ? 'before resolving into a subdued outro.' : 'and sustaining energy through the finale.')
  return parts.join(' ')
}

function extractThemes(parsedLyrics) {
  if (!parsedLyrics.length) return ['journey', 'longing', 'transformation']
  const stop = new Set('the a an and or but of in on at to for with is are was were i you he she it we they me my your our this that be been am as by not no so do did dont cant will would could should oh yeah na la'.split(' '))
  const freq = {}
  for (const l of parsedLyrics) {
    for (const w of l.text.toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/)) {
      if (w.length > 2 && !stop.has(w)) freq[w] = (freq[w] || 0) + 1
    }
  }
  const themes = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
  return themes.length ? themes : ['journey', 'longing', 'transformation']
}

function paletteForStyle(style) {
  const map = {
    Gothic: [
      { hex: '#1A1423', reason: 'Cathedral gloom base' },
      { hex: '#6D597A', reason: 'Baroque drapery violet' },
      { hex: '#B8C0C8', reason: 'Silver moonlight' },
      { hex: '#7B2CBF', reason: 'Romantic macabre accent' },
    ],
    Cyberpunk: [
      { hex: '#0D0221', reason: 'Night city void' },
      { hex: '#FF007F', reason: 'Neon signage magenta' },
      { hex: '#00E5FF', reason: 'Holographic cyan' },
      { hex: '#FFB703', reason: 'Sodium street amber' },
    ],
    Vaporwave: [
      { hex: '#2B0033', reason: 'Retro dusk base' },
      { hex: '#FF71CE', reason: 'Sunset chrome pink' },
      { hex: '#01CDFE', reason: 'Grid horizon cyan' },
    ],
    'Film Noir': [
      { hex: '#000000', reason: 'Absolute shadow' },
      { hex: '#FFFFFF', reason: 'Hard key highlights' },
      { hex: '#555555', reason: 'Smoke-filled midtones' },
    ],
  }
  return (
    map[style] || [
      { hex: '#0D1B2A', reason: 'Deep cinematic base' },
      { hex: '#415A77', reason: 'Cool atmospheric midtone' },
      { hex: '#E0E1DD', reason: 'Key light highlight' },
      { hex: '#7B2CBF', reason: 'Signature accent' },
    ]
  )
}

export function generateScriptWithEngine({
  durationSeconds,
  style = 'Cinematic',
  lyricsText = '',
  audio = null,
  songTitle = '',
}) {
  const total = Math.max(8, Math.round(durationSeconds))
  const sceneCount = Math.ceil(total / 8)
  const parsedLyrics = parseLyrics(lyricsText)
  const seedBase = hashString(`${songTitle}|${style}|${total}|${audio?.fileName || ''}`)

  const scenes = []
  for (let i = 0; i < sceneCount; i++) {
    const start = i * 8
    const end = i === sceneCount - 1 ? total : start + 8
    const intensity = averageEnergy(audio, start, end)
    const prevAngle = i > 0 ? scenes[i - 1].cameraAngle : null
    const cameraAngle = pickCameraAngle(intensity, prevAngle, seedBase + i)
    const transition = i === 0 ? null : TRANSITIONS[(i - 1) % TRANSITIONS.length]
    const sectionLabel =
      i === 0 ? 'opening' : i === sceneCount - 1 ? 'finale' : `section ${formatMMSS(start)}`
    const description = `Scene ${i + 1}: The camera moves with a ${cameraAngle.toLowerCase()} capturing the emotional progression during ${sectionLabel}.`
    const aesthetic = STYLE_AESTHETICS[style] || STYLE_AESTHETICS.Cinematic
    const pacing = pacingPhrase(audio?.bpm)
    const veoPrompt = `${cameraAngle} of The Protagonist ${actionVerb(intensity)} The Mysterious Relic in a cinematic environment, Deep cinematic shadows, 35mm film lens, cinematic lighting, 8k render, hyper-detailed${pacing ? `, ${pacing}` : ''}, ${aesthetic}.`
    scenes.push({
      sceneNumber: i + 1,
      startTimeSeconds: start,
      endTimeSeconds: end,
      transition,
      cameraAngle,
      description,
      veoPrompt,
      correspondingLyrics: [],
      _intensity: intensity,
    })
  }

  const lyricGroups = distributeLyrics(parsedLyrics, scenes, total)
  lyricGroups.forEach((group, i) => {
    if (group.length) {
      scenes[i].correspondingLyrics = group.map((g) => ({
        text: g.text,
        timestampSeconds: g.timestampSeconds ?? scenes[i].startTimeSeconds,
      }))
    } else {
      scenes[i].correspondingLyrics = [
        { text: 'Instrumental flow', timestampSeconds: scenes[i].startTimeSeconds },
      ]
    }
  })

  const profile = spectralProfile(audio)
  const bpm = audio?.bpm || 80 + (seedBase % 60)
  const title = songTitle
    ? `${songTitle} — Visual Treatment`
    : `${style} Study No. ${(seedBase % 89) + 10}`

  return {
    title,
    overallMood: `${style} · ${bpm >= 120 ? 'high-energy' : bpm >= 90 ? 'driving' : 'atmospheric'}`,
    analysis: {
      bpm,
      musicalKey: KEY_POOL[seedBase % KEY_POOL.length],
      instrumentation: INSTRUMENTATION_BY_PROFILE[profile],
      dynamics: dynamicsDescription(audio?.energyBuckets),
      lyricalThemes: extractThemes(parsedLyrics),
      suggestedColorPalette: paletteForStyle(style),
    },
    consistentElements: {
      characters: [
        { name: 'The Protagonist', description: 'A compelling central figure whose journey anchors the narrative' },
      ],
      props: [
        { name: 'The Mysterious Relic', description: 'An enigmatic object of significance that recurs throughout the video' },
      ],
    },
    scenes,
    generatedBy: 'director-engine',
  }
}
