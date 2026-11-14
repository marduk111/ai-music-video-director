// Local LLM client: Ollama native API + OpenAI-compatible endpoints (LM Studio, llama.cpp server, vLLM...)

export async function listModels(config) {
  if (config.isOpenCodeMode) {
    const res = await fetch(`${config.openCodeEndpoint.replace(/\/$/, '')}/models`)
    if (!res.ok) throw new Error(`Model list failed (${res.status})`)
    const data = await res.json()
    return (data.data || []).map((m) => m.id)
  }
  const res = await fetch(`${config.endpoint.replace(/\/$/, '')}/api/tags`)
  if (!res.ok) throw new Error(`Ollama model list failed (${res.status})`)
  const data = await res.json()
  return (data.models || []).map((m) => m.name)
}

function buildScriptSystemPrompt(sceneCount, durationSeconds) {
  const mm = Math.floor(durationSeconds / 60)
  const ss = String(durationSeconds % 60).padStart(2, '0')
  return (
    'You are a world-class Music Video Director and Creative Cinematographer. ' +
    'Your job is to analyze song lyrics/audio characteristics and produce a complete, compelling music video script in STRICT JSON format. ' +
    `The music video must be divided into exactly ${sceneCount} sequential 8-second scenes to match a total song duration of ${durationSeconds} seconds (${mm}:${ss}). ` +
    'CRITICAL REQUIREMENTS: 1. Output MUST be 100% valid JSON matching the specified schema. ' +
    `2. Produce exactly ${sceneCount} scenes; scene N starts at (N-1)*8 seconds; the final scene ends exactly at ${durationSeconds}. ` +
    '3. Each scene MUST have: sceneNumber, startTimeSeconds, endTimeSeconds, transition (e.g. "Cut to:", "Dissolve to:", "Fade in:", "Match cut to:", "Flash to:", "Whip pan to:"; null for scene 1), cameraAngle, description, veoPrompt, correspondingLyrics (array of {text, timestampSeconds}). ' +
    'veoPrompt must be a dense, photorealistic, 8-second cinematic generation prompt detailing subject motion, lighting, camera movement, film stock (35mm / anamorphic), color grade, and atmosphere. ' +
    'Top level schema: {title, overallMood, analysis:{bpm:int, musicalKey:"<NOTE> Major|Minor", instrumentation:[], dynamics, lyricalThemes:[], suggestedColorPalette:[{hex,reason}]}, consistentElements:{characters:[{name,description}], props:[{name,description}]}, scenes:[...]}. ' +
    'Use exact consistentElements names inside veoPrompts for visual consistency. Output ONLY the JSON object.'
  )
}

export function buildScriptUserPrompt({ durationSeconds, style, lyricsText }) {
  const sceneCount = Math.ceil(durationSeconds / 8)
  return (
    `Analyze this song and create a bespoke ${sceneCount}-scene music video script.\n` +
    `Song Duration: ${durationSeconds} seconds\n` +
    `Aesthetic / Mood Preset: ${style}\n` +
    `Song Lyrics / Track Info:\n"""\n${lyricsText || '(no lyrics provided — instrumental piece)'}\n"""\n` +
    `Please output the complete JSON object now with all ${sceneCount} scenes.`
  )
}

async function callOllamaGenerate(config, system, user) {
  const res = await fetch(`${config.endpoint.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt: user,
      system,
      format: 'json',
      stream: false,
      options: {
        temperature: config.temperature,
        num_ctx: config.contextLength,
      },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.response
}

async function callOpenAiCompatible(config, system, user) {
  const headers = { 'Content-Type': 'application/json' }
  if (config.openCodeApiKey) headers.Authorization = `Bearer ${config.openCodeApiKey}`
  const res = await fetch(`${config.openCodeEndpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.openCodeModel,
      temperature: config.temperature,
      max_tokens: config.contextLength,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LLM server error ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content
}

export async function generateScriptWithLlm(config, params) {
  const sceneCount = Math.ceil(params.durationSeconds / 8)
  const system = buildScriptSystemPrompt(sceneCount, params.durationSeconds)
  const user = buildScriptUserPrompt(params)
  const raw = config.isOpenCodeMode
    ? await callOpenAiCompatible(config, system, user)
    : await callOllamaGenerate(config, system, user)

  let jsonStr = raw.trim()
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonStr = fence[1].trim()
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)

  let script
  try {
    script = JSON.parse(jsonStr)
  } catch (err) {
    throw new Error(`Local model returned invalid JSON: ${err.message}`)
  }
  if (!Array.isArray(script.scenes) || !script.scenes.length) {
    throw new Error('Local model returned a script without scenes.')
  }
  script.generatedBy = config.isOpenCodeMode ? `opencode:${config.openCodeModel}` : `ollama:${config.model}`
  return script
}

const ENHANCER_SYSTEM =
  'You are an expert AI Video Prompt Engineer specializing in Stable Diffusion, AnimateDiff, Wan 2.1, and Runway Gen-3. ' +
  "Turn the user's scene description into an ultra-dense, photorealistic 8-second video generation prompt. " +
  'Include: Subject motion, camera framing & lens, lighting style, color grading, film texture, and atmosphere. ' +
  'Output ONLY the final prompt text. Do not output markdown, prefixes, or explanations.'

export async function enhancePromptWithLlm(config, { sceneNumber, cameraAngle, description, mood, existingPrompt }) {
  const user =
    `Scene Number: ${sceneNumber}\n` +
    `Camera Angle: ${cameraAngle || 'Cinematic'}\n` +
    `Scene Description: ${description}\n` +
    `Overall Aesthetic: ${mood}\n` +
    `Existing Prompt: ${existingPrompt}\n` +
    'Generate the enhanced cinematic prompt now:'
  const raw = config.isOpenCodeMode
    ? await callOpenAiCompatible(config, ENHANCER_SYSTEM, user)
    : await callOllamaGenerate(config, ENHANCER_SYSTEM, user)
  return raw.trim().replace(/^["']|["']$/g, '')
}

export function synthesizeEnhancedPrompt({ cameraAngle, description, mood }) {
  return `${cameraAngle ? cameraAngle + '. ' : ''}${description}. Highly detailed cinematic scene with ${mood} atmosphere, 35mm lens, volumetric lighting, 8k resolution render.`
}

export async function testInference(config) {
  const testPrompt = 'Create a 1-sentence surreal music video scene with neon lights and rain.'
  const raw = config.isOpenCodeMode
    ? await callOpenAiCompatible(config, 'You are a helpful assistant.', testPrompt)
    : await callOllamaGenerate(config, 'You are a helpful assistant.', testPrompt)
  return raw.trim()
}
