const KEYS = {
  script: 'ai-music-video-script',
  provider: 'ai_music_video_llm_provider',
  ollamaConfig: 'ai_music_video_ollama_config',
  promptLibrary: 'ai_music_video_prompt_library_v1',
  elementLibrary: 'ai_music_video_element_library',
}

function get(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable */
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch {}
}

export const storage = {
  loadScript: () => get(KEYS.script, null),
  saveScript: (s) => set(KEYS.script, s),
  clearScript: () => removeKey(KEYS.script),
  loadProvider: () => get(KEYS.provider, 'engine'),
  saveProvider: (p) => set(KEYS.provider, p),
  loadOllamaConfig: () =>
    get(KEYS.ollamaConfig, {
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
      temperature: 0.7,
      contextLength: 8192,
      isOpenCodeMode: false,
      openCodeEndpoint: 'http://localhost:1234/v1',
      openCodeModel: 'qwen2.5-coder-7b-instruct',
      openCodeApiKey: '',
    }),
  saveOllamaConfig: (c) => set(KEYS.ollamaConfig, c),
  loadPromptLibrary: () => get(KEYS.promptLibrary, null),
  savePromptLibrary: (l) => set(KEYS.promptLibrary, l),
  loadElementLibrary: () => get(KEYS.elementLibrary, []),
  saveElementLibrary: (e) => set(KEYS.elementLibrary, e),
}

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
