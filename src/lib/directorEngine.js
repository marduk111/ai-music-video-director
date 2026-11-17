import {
  VISUAL_STYLES,
  STYLE_AESTHETICS,
  CAMERA_ANGLES,
  TRANSITIONS,
  MARKER_COLORS,
  DIRECTOR_ENGINE_CHARACTERS,
  DIRECTOR_ENGINE_PROPS,
} from './constants.js'
import {
  averageEnergy, parseLyrics, distributeLyrics,
  beatSyncedBoundaries, barSeconds, framesForDuration,
} from './audioAnalysis.js'

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

// ---------- Lyric-driven imagery (the AI-Studio-era magic, local) ----------
// Instead of pasting lyrics under a generic template, each scene's lines are
// read for concrete imagery and the scene text is *written from* them.
const IMAGERY_CLAUSES = [
  { re: /\b(storm|thunder|lightning)\b/i, clause: 'as a thunderstorm breaks overhead, lightning silhouetting the skyline' },
  { re: /\b(rain|downpour|drizzle|umbrella)\b/i, clause: 'in driving rain, droplets catching the light, wet surfaces mirroring the scene' },
  { re: /\b(river|water|ocean|sea|tide|wave|shore|drown)\b/i, clause: 'beside wide slow water, reflections rippling and breaking apart' },
  { re: /\b(fire|burn|burning|smoke|ember|ash|flame)\b/i, clause: 'with embers and drifting smoke in the air, warm firelight against cold shadows' },
  { re: /\b(night|midnight|darkness|moon|star|stars)\b/i, clause: 'deep at night under a thin moon, halos of mist around every light' },
  { re: /\b(morning|dawn|sunrise|sunlight|daybreak)\b/i, clause: 'at first light, low golden sun flaring long across the frame' },
  { re: /\b(sing|song|sing me down|voice|melody|chorus)\b/i, clause: 'caught mid-song, head tilted back as if carrying a melody out over the dark' },
  { re: /\b(dance|dancing|spin|spinning)\b/i, clause: 'moving through a half-lit dance, fabric and shadow trailing the turn' },
  { re: /\b(city|street|streets|neon|town|sidewalk|alley)\b/i, clause: 'on a rain-washed city street, neon smear reflected in the pavement' },
  { re: /\b(road|highway|driving|car|train|leaving|leave|gone)\b/i, clause: 'along an empty road at speed, the world smearing past the window' },
  { re: /\b(born|grow|grew|child|children|young|age|old|years)\b/i, clause: 'time folded into one continuous shot — the years visible in the changing light' },
  { re: /\b(scar|wound|bruise|broken|break|bleed)\b/i, clause: 'close enough to read every scar, each one catching its own rim light' },
  { re: /\b(name|names|remember|forget|ghost|haunt)\b/i, clause: 'surrounded by half-glimpsed reflections, as if remembered faces linger at the frame edge' },
  { re: /\b(mirror|reflection|glass|window)\b/i, clause: 'framed through reflective glass, the reflection a half-beat out of sync with the body' },
]

const NOUN_STOP = new Set(('the a an and or but of in on at to for with is are was were i you he she it we they me my ' +
  'your our this that these those be been am as by not no so do did dont cant will would could should ' +
  'oh yeah na la o hey come go going get got gotta gonna every all some any just still even ever never ' +
  'down up out off again more than then when what who how why where born grew sing sang again before after').split(' '))

/**
 * Read a scene's lyric lines and return an imagery clause for the prompt, or
 * null if the lines are too abstract to visualize. Table matches first; falls
 * back to the two strongest concrete nouns.
 */
function imageryForLines(lines) {
  if (!lines?.length) return null
  const joined = lines.join(' ').toLowerCase()
  const hits = IMAGERY_CLAUSES.filter((c) => c.re.test(joined)).slice(0, 2)
  if (hits.length) return hits.map((h) => h.clause).join(', ')
  const nouns = joined
    .replace(/[^a-z\s']/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !NOUN_STOP.has(w))
  const seen = new Set()
  const picked = []
  for (const w of nouns) {
    if (!seen.has(w)) { seen.add(w); picked.push(w) }
    if (picked.length >= 2) break
  }
  return picked.length ? `evoking ${picked.join(' and ')}` : null
}

function energyWord(intensity) {
  if (intensity > 0.62) return 'builds toward a peak'
  if (intensity > 0.34) return 'simmers and swells'
  return 'breathes, quiet and slow'
}

// a/an helper for angle names in prose
function an(word) {
  return (/^[aeiou]/i.test(word) ? 'an' : 'a')
}

/**
 * "Reshoot": regenerate ONE scene's text as an alternate take, aware of its
 * neighbors (ported from the original app's reshoot prompt) — the new text
 * must bridge what came before and what comes after.
 */
export function reshootScene(script, idx) {
  const scenes = script.scenes
  const sc = scenes[idx]
  if (!sc) return script
  const prev = scenes[idx - 1]
  const next = scenes[idx + 1]
  const ce = script.consistentElements
  const character = ce?.characters?.[0]?.name || 'the artist'
  const props = (ce?.props || []).map((p) => p.name).join(' and ')
  const aesthetic = STYLE_AESTHETICS[style_of(script)] || STYLE_AESTHETICS.Cinematic

  const sungLines = (sc.correspondingLyrics || [])
    .map((l) => l.text)
    .filter((t) => t && t !== 'Instrumental flow')
  const imagery = imageryForLines(sungLines)
  const before = prev ? (prev.correspondingLyrics?.[0]?.text || prev.cameraAngle) : 'the opening'
  const after = next ? (next.correspondingLyrics?.[0]?.text || next.cameraAngle) : 'the finale'

  // a fresh angle, different from both neighbors
  const used = new Set([prev?.cameraAngle, next?.cameraAngle, sc.cameraAngle])
  const pool = CAMERA_ANGLES.filter((a) => !used.has(a))
  let h = 0
  for (const ch of (sc.veoPrompt || '') + sc.sceneNumber + Date.now()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const angle = pool.length ? pool[h % pool.length] : sc.cameraAngle
  const intensity = sc._intensity ?? 0.5

  const patch = { cameraAngle: angle }
  if (imagery) {
    patch.veoPrompt = `${angle} of ${character} ${actionVerb(intensity)} ${props}, ${imagery}, ${aesthetic}.`
    patch.description = `Scene ${sc.sceneNumber} (alternate take): The line "${(sungLines[0] || '').slice(0, 61)}" now drives ${an(angle)} ${angle.toLowerCase()} — ${imagery}. Bridges "${before}" into "${after}".`
  } else {
    patch.veoPrompt = `${angle} of ${character} ${actionVerb(intensity)} ${props} in a cinematic environment, ${aesthetic}.`
    patch.description = `Scene ${sc.sceneNumber} (alternate take): ${an(angle)} ${angle.toLowerCase()} that ${energyWord(intensity)}, bridging "${before}" into "${after}".`
  }
  return {
    ...script,
    scenes: scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
  }
}

function style_of(script) {
  // scripts remember their style via the analysis mood string ("Cinematic · …")
  const m = String(script?.overallMood || '')
  const key = m.split('·')[0].trim()
  return STYLE_AESTHETICS[key] ? key : 'Cinematic'
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
  const freq = {}
  for (const l of parsedLyrics) {
    for (const w of l.text.toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/)) {
      if (w.length > 3 && !NOUN_STOP.has(w)) freq[w] = (freq[w] || 0) + 1
    }
  }
  const themes = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
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
  timing = 'beats', // 'beats' = bar-aligned adaptive (mesh plan) | 'fixed8' = VEO blocks
}) {
  const total = Math.max(8, Math.round(durationSeconds))
  const parsedLyrics = parseLyrics(lyricsText)
  const seedBase = hashString(`${songTitle}|${style}|${total}|${audio?.fileName || ''}`)
  // Per-song cast: rotate through the archetype pools by seed so different
  // songs get different consistent elements. Themes flavor the descriptions.
  const themes = extractThemes(parsedLyrics)
  const character = DIRECTOR_ENGINE_CHARACTERS[seedBase % DIRECTOR_ENGINE_CHARACTERS.length]
  const propA = DIRECTOR_ENGINE_PROPS[(seedBase >> 3) % DIRECTOR_ENGINE_PROPS.length]
  const propB = DIRECTOR_ENGINE_PROPS[(seedBase >> 6) % DIRECTOR_ENGINE_PROPS.length]
  const props = [propA]
  if (propB.name !== propA.name && total >= 48) props.push(propB)
  const themeNote = themes[0] ? ` carrying the song's ${themes.slice(0, 2).join(' and ')} arc` : ''

  // Scene timing: beat-synced bars when audio analysis is available (cuts land
  // on musical bars, length breathes with energy); fixed 8s blocks otherwise.
  let spans
  if (timing === 'beats' && audio?.bpm) {
    spans = beatSyncedBoundaries(audio, total)
  } else {
    spans = []
    for (let s = 0; s < total; s += 8) {
      spans.push({ start: s, end: Math.min(total, s + 8), intensity: averageEnergy(audio, s, s + 8) })
    }
  }

  const scenes = []
  for (let i = 0; i < spans.length; i++) {
    const { start, end, intensity } = spans[i]
    const prevAngle = i > 0 ? scenes[i - 1].cameraAngle : null
    const cameraAngle = pickCameraAngle(intensity, prevAngle, seedBase + i)
    const transition = i === 0 ? null : TRANSITIONS[(i - 1) % TRANSITIONS.length]
    const aesthetic = STYLE_AESTHETICS[style] || STYLE_AESTHETICS.Cinematic
    const pacing = pacingPhrase(audio?.bpm)
    // base prompt; the lyric pass below rewrites these with real imagery
    const veoPrompt = `${cameraAngle} of ${character.name} ${actionVerb(intensity)} ${props.map((p) => p.name).join(' and ')} in a cinematic environment, ${aesthetic}${pacing ? `, ${pacing}` : ''}.`
    scenes.push({
      sceneNumber: i + 1,
      startTimeSeconds: Math.round(start * 100) / 100,
      endTimeSeconds: Math.round(end * 100) / 100,
      transition,
      cameraAngle,
      description: '',
      veoPrompt,
      correspondingLyrics: [],
      // mesh render metadata: exact LTXV frame count for this shot
      frames: framesForDuration(end - start),
      bars: spans[i].bars ?? null,
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

  // ---------- lyric pass: scene text written FROM the lyrics ----------
  const hasAnyLyrics = parsedLyrics.length > 0
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i]
    const aesthetic = STYLE_AESTHETICS[style] || STYLE_AESTHETICS.Cinematic
    const pacing = pacingPhrase(audio?.bpm)
    const angle = sc.cameraAngle.toLowerCase()
    const sungLines = sc.correspondingLyrics
      .map((l) => l.text)
      .filter((t) => t && t !== 'Instrumental flow')
    const imagery = imageryForLines(sungLines)
    const base = `${sc.cameraAngle} of ${character.name} ${actionVerb(sc._intensity)} ${props.map((p) => p.name).join(' and ')}`

    if (imagery) {
      // the lyric paints the shot
      sc.veoPrompt = `${base}, ${imagery}, ${aesthetic}${pacing ? `, ${pacing}` : ''}.`
      const firstLine = sungLines[0]
      sc.description = firstLine
        ? `Scene ${sc.sceneNumber}: The line "${firstLine.length > 64 ? firstLine.slice(0, 61) + '…' : firstLine}" drives ${an(angle)} ${angle} — ${imagery}.`
        : `Scene ${sc.sceneNumber}: ${an(angle)} ${angle} — ${imagery}.`
    } else if (hasAnyLyrics) {
      // instrumental gap inside a lyrical song: hold the motif, let it breathe
      const motif = themes.filter((t) => t.length > 3).slice(0, 2).join(' and ')
      sc.veoPrompt = `${base} in a cinematic environment${motif ? `, echoing the song's ${motif}` : ''}, ${aesthetic}${pacing ? `, ${pacing}` : ''}.`
      sc.description = `Scene ${sc.sceneNumber}: Instrumental passage — ${an(angle)} ${angle} that ${energyWord(sc._intensity)} while the arrangement carries the story.`
    } else {
      // no lyrics at all: neutral treatment
      sc.veoPrompt = `${base} in a cinematic environment, ${aesthetic}${pacing ? `, ${pacing}` : ''}.`
      sc.description = `Scene ${sc.sceneNumber}: ${an(angle)} ${angle} that ${energyWord(sc._intensity)}.`
    }
  }

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
      lyricalThemes: themes,
      suggestedColorPalette: paletteForStyle(style),
    },
    consistentElements: {
      characters: [{ ...character, description: `${character.description}${themeNote}` }],
      props: props.map((p) => ({ ...p })),
    },
    scenes,
    generatedBy: 'director-engine',
    timing: timing === 'beats' && audio?.bpm ? 'beats' : 'fixed8',
    bpm,
    barSeconds: barSeconds(audio?.bpm),
  }
}
