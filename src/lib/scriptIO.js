// Script import/export in the "ELIZA-AGAIN" text format — the time-synced
// scene plan format the director produces and VEO renders consume.
//
// Shape:
//   Title: ELIZA-AGAIN
//   Mood: Cinematic
//   ----------------------------------------
//   SONG ANALYSIS ... (optional block)
//   ----------------------------------------
//   CONSISTENT ELEMENTS ... (optional block)
//   ========================================
//   VIDEO SCRIPT
//   ========================================
//   SCENE 1
//   Time: 00:00 - 00:08
//   Camera Angle: Low angle tracking shot
//   Description: ...
//   Lyrics: ...
//   VEO Prompt: ...
//   ---

function mmss(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(Math.round(sec) % 60).padStart(2, '0')
  return `${m}:${s}`
}

function parseClock(str) {
  const [m, s] = str.split(':').map((x) => parseInt(x, 10))
  return m * 60 + s
}

/**
 * Parse a script text file into the app's script object.
 * Tolerates both the full export and trimmed variants.
 */
export function parseScriptText(text) {
  const lines = text.split(/\r?\n/)
  const script = {
    title: 'Untitled',
    overallMood: 'Cinematic',
    analysis: null,
    consistentElements: { characters: [], props: [] },
    scenes: [],
  }
  let section = 'head'
  let current = null
  let collecting = null // 'description' | 'lyrics' | 'veo'
  const collect = []

  const flush = () => {
    if (current && collecting) {
      const joined = collect.join(' ').trim()
      if (collecting === 'veo') current.veoPrompt = joined
      else if (collecting === 'description') current.description = joined
      else if (collecting === 'lyrics') {
        current.correspondingLyrics = joined
          ? joined.split(/;\s*/).map((t) => ({ text: t, timestampSeconds: current.startTimeSeconds }))
          : [{ text: 'Instrumental flow', timestampSeconds: current.startTimeSeconds }]
      }
    }
    collecting = null
    collect.length = 0
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (/^-{5,}$/.test(line)) {
      flush()
      section = section === 'head' ? 'analysis' : 'between'
      continue
    }
    if (/^={4,}$/.test(line)) {
      flush()
      section = 'script'
      continue
    }
    if (/^---\s*$/.test(line)) {
      flush()
      if (current) script.scenes.push(current)
      current = null
      continue
    }

    const head = (re) => (section === 'head' && re.test(line) ? line.replace(re, '').trim() : null)
    let m

    if (section === 'head' || section === 'between') {
      if ((m = line.match(/^Title:\s*(.+)$/i)) && !script._titled) {
        script.title = m[1]; script._titled = true; continue
      }
      if ((m = line.match(/^Mood:\s*(.+)$/i))) { script.overallMood = m[1]; continue }
      if (/^Tempo:\s*(\d+)\s*BPM/i.test(line)) {
        script.analysis ??= {}
        script.analysis.bpm = parseInt(line.match(/(\d+)/)[1], 10)
        continue
      }
      if ((m = line.match(/^Key:\s*(.+)$/i)) && script.analysis) { script.analysis.musicalKey = m[1]; continue }
      if ((m = line.match(/^Dynamics:\s*(.+)$/i)) && script.analysis) { script.analysis.dynamics = m[1]; continue }
      if ((m = line.match(/^Instrumentation:\s*(.+)$/i)) && script.analysis) {
        script.analysis.instrumentation = m[1].split(/,\s*/); continue
      }
      if ((m = line.match(/^Lyrical Themes:\s*(.+)$/i)) && script.analysis) {
        script.analysis.lyricalThemes = m[1].split(/,\s*/); continue
      }
      if ((m = line.match(/^Suggested Color Palette:/i))) { section = 'palette'; continue }
      if (/^-\s*#([0-9A-Fa-f]{6})/.test(line) && section === 'palette') {
        script.analysis ??= { suggestedColorPalette: [] }
        script.analysis.suggestedColorPalette ??= []
        const hex = `#${line.match(/#([0-9A-Fa-f]{6})/)[1]}`
        script.analysis.suggestedColorPalette.push({ hex, reason: line.split(/:\s*(.+)$/)[1] || '' })
        continue
      }
      if ((m = line.match(/^-\s*(.+?):\s*(.+)$/)) && section === 'between') {
        const [, name, desc] = m
        if (/prop/i.test(script._lastHeader || '')) script.consistentElements.props.push({ name, description: desc })
        else script.consistentElements.characters.push({ name, description: desc })
        continue
      }
      if ((m = line.match(/^(Characters|Props):$/i))) { script._lastHeader = m[1]; continue }
      continue
    }

    // script section
    if ((m = line.match(/^SCENE\s+(\d+)$/i))) {
      flush()
      current = {
        sceneNumber: parseInt(m[1], 10),
        startTimeSeconds: 0,
        endTimeSeconds: 0,
        transition: null,
        cameraAngle: '',
        description: '',
        veoPrompt: '',
        correspondingLyrics: [],
      }
      continue
    }
    if (!current) continue
    if ((m = line.match(/^Time:\s*([\d:]+)\s*-\s*([\d:]+)/i))) {
      current.startTimeSeconds = parseClock(m[1])
      current.endTimeSeconds = parseClock(m[2])
      continue
    }
    if ((m = line.match(/^Frames:\s*(\d+)/i))) { current.frames = parseInt(m[1], 10); continue }
    if ((m = line.match(/^Transition:\s*(.+)$/i))) { current.transition = m[1]; continue }
    if ((m = line.match(/^Camera Angle:\s*(.+)$/i))) { current.cameraAngle = m[1]; continue }
    if ((m = line.match(/^Description:\s*(.*)$/i))) {
      flush()
      collecting = 'description'
      collect.push(m[1])
      continue
    }
    if ((m = line.match(/^Lyrics:\s*(.*)$/i))) {
      flush()
      collecting = 'lyrics'
      collect.push(m[1])
      continue
    }
    if ((m = line.match(/^VEO Prompt:\s*(.*)$/i))) {
      flush()
      collecting = 'veo'
      collect.push(m[1])
      continue
    }
    if (collecting && line) collect.push(line)
  }
  flush()
  if (current) script.scenes.push(current)
  delete script._titled
  delete script._lastHeader
  return script
}

/**
 * Serialize the script object back to the export format.
 */
export function serializeScriptText(script) {
  const out = []
  out.push(`Title: ${script.title || 'Untitled'}`)
  out.push(`Mood: ${script.overallMood || 'Cinematic'}`)
  out.push('')
  out.push('----------------------------------------')
  const a = script.analysis || {}
  out.push('SONG ANALYSIS')
  out.push('----------------------------------------')
  out.push(`Tempo: ${a.bpm || 120} BPM`)
  if (a.musicalKey) out.push(`Key: ${a.musicalKey}`)
  if (a.dynamics) out.push(`Dynamics: ${a.dynamics}`)
  if (a.instrumentation?.length) out.push(`Instrumentation: ${a.instrumentation.join(', ')}`)
  if (a.lyricalThemes?.length) out.push(`Lyrical Themes: ${a.lyricalThemes.join(', ')}`)
  if (a.suggestedColorPalette?.length) {
    out.push('')
    out.push('Suggested Color Palette:')
    for (const c of a.suggestedColorPalette) out.push(`- ${c.hex}: ${c.reason || ''}`)
  }
  out.push('')
  out.push('----------------------------------------')
  out.push('CONSISTENT ELEMENTS')
  out.push('----------------------------------------')
  const ce = script.consistentElements || { characters: [], props: [] }
  out.push('Characters:')
  for (const c of ce.characters || []) out.push(`- ${c.name}: ${c.description || ''}`)
  out.push('')
  out.push('Props:')
  for (const p of ce.props || []) out.push(`- ${p.name}: ${p.description || ''}`)
  out.push('')
  out.push('========================================')
  out.push('VIDEO SCRIPT')
  out.push('========================================')
  for (const s of script.scenes || []) {
    out.push(`SCENE ${s.sceneNumber}`)
    out.push(`Time: ${mmss(s.startTimeSeconds)} - ${mmss(s.endTimeSeconds)}`)
    if (s.frames) out.push(`Frames: ${s.frames}`)
    if (s.transition) out.push(`Transition: ${s.transition}`)
    if (s.cameraAngle) out.push(`Camera Angle: ${s.cameraAngle}`)
    out.push('')
    out.push(`Description: ${s.description || ''}`)
    out.push('')
    out.push('Lyrics:')
    const lyr = s.correspondingLyrics?.length
      ? s.correspondingLyrics.map((l) => l.text).join('; ')
      : 'Instrumental flow'
    out.push(lyr)
    out.push('')
    out.push(`VEO Prompt: ${s.veoPrompt || ''}`)
    out.push('')
    out.push('---')
    out.push('')
  }
  return out.join('\n')
}

/**
 * Turn a VEO prompt + scene into a mesh-ready prompt for the render target.
 * Appends the consistency block (characters/props/style) so every shot
 * keeps the same cast and look.
 */
export function meshPromptForScene(scene, script, { forVideo = true } = {}) {
  const ce = script?.consistentElements
  const parts = []
  let body = forVideo
    ? (scene.veoPrompt || scene.description || '').replace(/\s*8k render,?\s*/i, '')
    : scene.veoPrompt || scene.description || ''
  // @-mention character consistency (from the VEO AI Studio app): writing
  // @Name in a scene prompt injects that character's full definition — and
  // when that character has a photo reference, the video model gets it pinned
  // as an identity guide, so say so in the text too.
  if (ce?.characters?.length) {
    for (const c of ce.characters) {
      if (!c.name) continue
      const refNote = c.photo ? ', as in the attached reference image' : ''
      const re = new RegExp(`@${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      body = body.replace(re, `(the character '${c.name}' defined as: ${c.description}${refNote})`)
    }
  }
  parts.push(body)
  if (ce) {
    const names = [
      ...(ce.characters || []).map((c) => c.name),
      ...(ce.props || []).map((p) => p.name),
    ]
    if (names.length) parts.push(`consistent appearance of ${names.join(', ')} across all shots`)
    const styles = [...(ce.characters || []), ...(ce.props || [])].map((x) => x.description).filter(Boolean)
    if (styles.length) parts.push(styles.join(', '))
  }
  return parts.filter(Boolean).join(', ')
}

/**
 * The photo reference a scene should render with: the first character whose
 * @-mention (or plain name) appears in the scene's prompt and has a photo,
 * else the first photographed character. Returns the dataURL or null.
 */
export function characterPhotoForScene(scene, script) {
  const ce = script?.consistentElements
  const chars = (ce?.characters || []).filter((c) => c.photo)
  if (!chars.length) return null
  const text = `${scene?.veoPrompt || ''} ${scene?.description || ''}`
  for (const c of chars) {
    if (c.name && new RegExp(`@?${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      return c.photo
    }
  }
  return chars[0].photo
}
