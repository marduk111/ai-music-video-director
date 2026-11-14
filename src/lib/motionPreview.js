// Free in-browser motion simulator: animates the storyboard still with camera moves
// synced to the scene's energy, and records to .webm via MediaRecorder.

export async function renderMotionPreview({
  sourceCanvas,
  scene,
  audio,
  durationMs = 4000,
  onProgress = () => {},
}) {
  const W = 1280
  const H = 720
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')

  const stream = out.captureStream(30)
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
  const chunks = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
  })

  const intensity = scene._intensity ?? 0.5
  const zoomAmt = 0.08 + intensity * 0.18
  const panAmt = 40 + intensity * 120
  const shake = intensity > 0.62 ? 3 : 0

  recorder.start()
  const start = performance.now()
  await new Promise((resolve) => {
    const frame = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs)
      onProgress(Math.round(t * 100))
      const ease = t * t * (3 - 2 * t)
      const zoom = 1 + zoomAmt * ease
      const panX = Math.sin(ease * Math.PI) * panAmt
      const panY = Math.cos(ease * Math.PI) * panAmt * 0.4
      const sx = (Math.random() - 0.5) * shake
      const sy = (Math.random() - 0.5) * shake

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      const dw = W * zoom
      const dh = H * zoom
      ctx.drawImage(
        sourceCanvas,
        (W - dw) / 2 + panX + sx,
        (H - dh) / 2 + panY + sy,
        dw,
        dh
      )

      // Light pulse on the beat grid
      const bpm = audio?.bpm || 100
      const beatPhase = ((t * durationMs) / 1000) * (bpm / 60)
      const pulse = Math.max(0, 1 - (beatPhase % 1) * 3)
      if (pulse > 0 && intensity > 0.34) {
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.06})`
        ctx.fillRect(0, 0, W, H)
      }

      // Timecode overlay
      ctx.fillStyle = 'rgba(148,163,184,0.85)'
      ctx.font = '500 16px ui-monospace, monospace'
      ctx.fillText(
        `SCENE ${String(scene.sceneNumber).padStart(2, '0')} · MOTION SIMULATION · ${(ease * 8).toFixed(1)}s`,
        24,
        H - 20
      )

      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
  recorder.stop()
  stream.getTracks().forEach((tr) => tr.stop())
  return done
}
