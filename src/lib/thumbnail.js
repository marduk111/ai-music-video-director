// Procedural canvas storyboard art — the offline fallback "concept still" generator.

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function renderStoryboardStill(canvas, { scene, mood, palette }) {
  const W = 1280
  const H = 720
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const seed = hashString(`${scene.sceneNumber}|${scene.veoPrompt || scene.description}`)
  let rngState = seed || 1
  const rng = () => {
    rngState ^= rngState << 13
    rngState ^= rngState >>> 17
    rngState ^= rngState << 5
    return ((rngState >>> 0) % 10000) / 10000
  }

  const colors = palette?.length ? palette.map((p) => p.hex) : ['#0D1B2A', '#415A77', '#E0E1DD', '#7B2CBF']
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, colors[0] || '#0D1B2A')
  bg.addColorStop(1, colors[1 % colors.length] || '#415A77')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Atmospheric haze blobs
  for (let i = 0; i < 14; i++) {
    const x = rng() * W
    const y = rng() * H
    const r = 60 + rng() * 260
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `${colors[i % colors.length]}55`)
    g.addColorStop(1, '#00000000')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Silhouetted horizon / architecture
  ctx.fillStyle = 'rgba(5,8,15,0.85)'
  ctx.beginPath()
  ctx.moveTo(0, H)
  let x = 0
  let y = H * (0.62 + rng() * 0.12)
  while (x < W) {
    const step = 40 + rng() * 120
    x += step
    y = Math.min(H * 0.9, Math.max(H * 0.35, y + (rng() - 0.5) * 140))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()

  // Central figure silhouette
  const cx = W * (0.42 + rng() * 0.16)
  const cy = H * 0.78
  const scale = 0.9 + rng() * 0.5
  ctx.fillStyle = 'rgba(3,6,12,0.95)'
  ctx.beginPath()
  ctx.arc(cx, cy - 150 * scale, 34 * scale, 0, Math.PI * 2) // head
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx - 46 * scale, cy)
  ctx.quadraticCurveTo(cx, cy - 140 * scale, cx + 46 * scale, cy)
  ctx.closePath()
  ctx.fill()

  // Relic glow
  const glowX = cx + (rng() - 0.5) * 120
  const glowY = cy - 90 * scale
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 70 * scale)
  glow.addColorStop(0, `${colors[colors.length - 1]}CC`)
  glow.addColorStop(1, '#00000000')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(glowX, glowY, 70 * scale, 0, Math.PI * 2)
  ctx.fill()

  // Film grain
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rng() * 0.05})`
    ctx.fillRect(rng() * W, rng() * H, 1.4, 1.4)
  }

  // HUD text
  ctx.fillStyle = 'rgba(148,163,184,0.9)'
  ctx.font = '600 22px ui-monospace, monospace'
  ctx.fillText(`SCENE ${String(scene.sceneNumber).padStart(2, '0')} // CONCEPT STORYBOARD STILL`, 36, 48)
  ctx.font = '500 16px ui-monospace, monospace'
  ctx.fillText(`MOOD: ${(mood || '').toUpperCase().slice(0, 60)}`, 36, 76)
  ctx.fillText(
    `${scene.startTimeSeconds}s → ${scene.endTimeSeconds}s   ${scene.cameraAngle}`,
    36,
    H - 32
  )
}

export function storyboardToDataUrl(params) {
  const c = document.createElement('canvas')
  renderStoryboardStill(c, params)
  return c.toDataURL('image/jpeg', 0.85)
}
