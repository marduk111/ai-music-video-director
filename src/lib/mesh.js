// Mesh render bridge — talks to the I2V Studio backend (port 8189), which
// fronts both GPUs: cloud T4 (preferred when live) and local RTX 3050.
// Handles: mesh status, script-driven generation with start/end frames,
// progress polling, file proxying, last-frame extraction and final assembly.

const STUDIO = 'http://127.0.0.1:8189'

export async function meshStatus() {
  const res = await fetch(`${STUDIO}/api/status`)
  if (!res.ok) throw new Error(`Studio responded ${res.status}`)
  return res.json() // { comfy, local, cloud, comfyLabel }
}

// Choose the target automatically: cloud when live, else local.
export function pickTarget(status, preferred) {
  if (preferred && preferred !== 'auto') return preferred
  return status?.cloud ? 'cloud' : 'local'
}

export async function listModels(target) {
  const res = await fetch(`${STUDIO}/api/models?target=${target}`)
  if (!res.ok) throw new Error(`Model list failed (${res.status})`)
  return res.json() // { models: [...] }
}

export async function listLoras(target) {
  const res = await fetch(`${STUDIO}/api/loras?target=${target}`)
  if (!res.ok) return { loras: [] }
  return res.json()
}

function b64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

/** Shared payload builder for generate / dry-run export. */
function genBody(opts) {
  return {
    prompt: opts.prompt,
    negative: opts.negative,
    length: opts.length,
    width: opts.width,
    height: opts.height,
    strength: opts.strength,
    target: opts.target,
    model: opts.model,
    lora: opts.lora,
    lora_strength: opts.loraStrength,
    pose: opts.pose,
    pose_strength: opts.poseStrength,
  }
}

/**
 * Queue one generation through the mesh.
 * @param {object} opts - prompt, negative?, length (frames), width, height,
 *   strength (denoise for i2i / motion for i2v), target ('cloud'|'local'),
 *   model, lora, loraStrength, pose, poseStrength,
 *   startFile (File|Blob) and/or endFile (File|Blob) for start/end conditioning.
 * @returns {{job, kind, model, note}}
 */
export async function generate(opts) {
  const body = genBody(opts)
  if (opts.startFile) {
    body.image_b64 = await b64(opts.startFile)
    body.filename = opts.filename || 'start_frame.png'
  }
  if (opts.endFile) {
    body.end_image_b64 = await b64(opts.endFile)
    body.end_filename = opts.endFilename || 'end_frame.png'
  }
  const res = await fetch(`${STUDIO}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

/**
 * Build (but don't queue) the ComfyUI workflow for one scene — download it
 * and tweak that shot by hand in the ComfyUI GUI. Returns {workflow, model, kind, note}.
 */
export async function exportWorkflow(opts) {
  const body = { ...genBody(opts), dry_run: true }
  const res = await fetch(`${STUDIO}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

/**
 * Poll a job until done/error. Returns {status, video_url, filename, kind}.
 * @param {number} timeoutMs default 20 min (an 8s 201-frame T4 render is ~2-4 min)
 */
export async function pollJob(job, target, { intervalMs = 3000, timeoutMs = 20 * 60000, onTick } = {}) {
  const started = Date.now()
  for (;;) {
    const res = await fetch(`${STUDIO}/api/progress?job=${job}&target=${target}`)
    const info = await res.json()
    onTick?.(info, Date.now() - started)
    if (info.status === 'done') return info
    if (info.status === 'error') throw new Error(info.error || 'Mesh job failed')
    if (Date.now() - started > timeoutMs) throw new Error('Mesh job timed out')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

// Proxied result URL (never touches Cloudflare tunnels directly).
export function fileUrl(job, target) {
  return `${STUDIO}/api/file?job=${encodeURIComponent(job)}&target=${target}`
}

// Fetch a finished result as a Blob (for chaining: last frame extraction, previews).
export async function fetchResult(job, target) {
  const res = await fetch(fileUrl(job, target))
  if (!res.ok) throw new Error(`Result fetch failed (${res.status})`)
  return await res.blob()
}

/**
 * Extract the last frame of a rendered clip as a PNG Blob via the studio's
 * ffmpeg helper — used to seed the next scene (continuity chaining).
 */
export async function extractLastFrame(job, target) {
  const res = await fetch(`${STUDIO}/api/lastframe?job=${encodeURIComponent(job)}&target=${encodeURIComponent(target)}`)
  if (!res.ok) throw new Error(`Last-frame extraction failed (${res.status})`)
  return await res.blob()
}

/**
 * Concatenate per-scene MP4s and mux the song. Returns the final video Blob.
 * @param {Array<{job, target}>} scenes in order
 * @param {File} songFile original audio (muxed into the final video)
 */
export async function assemble(scenes, songFile) {
  const body = {
    scenes: scenes.map((s) => ({ job: s.job, target: s.target })),
  }
  if (songFile) {
    body.audio_b64 = await b64(songFile)
    body.audio_name = songFile.name
  }
  const res = await fetch(`${STUDIO}/api/assemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Assembly failed (${res.status})`)
  }
  return await res.blob()
}
