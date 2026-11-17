import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Film, KeyRound, Link2, Scissors, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import * as mesh from './lib/mesh.js'
import { meshPromptForScene, characterPhotoForScene } from './lib/scriptIO.js'

export default function RenderStage({ script, audio, songFile, mesh: meshStatus, board, onBack }) {
  const [target, setTarget] = useState('auto') // auto | cloud | local
  const [videoModel, setVideoModel] = useState('') // '' = auto (LTXV distilled preferred)
  const [keyModel, setKeyModel] = useState('')     // i2i model for the keyframe
  const [lora, setLora] = useState('')             // '' = none
  const [models, setModels] = useState(null)
  const [loras, setLoras] = useState([])
  const [keyframeFile, setKeyframeFile] = useState(null)   // user-provided keyframe
  const [keyframeUrl, setKeyframeUrl] = useState(null)     // preview of keyframe blob
  const [endFrameFile, setEndFrameFile] = useState(null)   // optional global closing frame
  const [jobs, setJobs] = useState([])  // per scene: {sceneNumber, status, note, job, url, ms}
  const [running, setRunning] = useState(false)
  const [finalVideo, setFinalVideo] = useState(null)
  const [assembling, setAssembling] = useState(false)
  const cancelRef = useRef(false)
  const keyRef = useRef(null)
  const endRef = useRef(null)

  const resolvedTarget = meshStatus?.cloud ? (target === 'local' ? 'local' : 'cloud')
    : target === 'cloud' ? null : 'local'

  useEffect(() => {
    if (resolvedTarget == null) return
    mesh.listModels(resolvedTarget).then((d) => setModels(d.models || [])).catch(() => setModels([]))
    mesh.listLoras(resolvedTarget).then((d) => setLoras(d.loras || [])).catch(() => setLoras([]))
  }, [resolvedTarget])

  useEffect(() => {
    if (!models?.length) return
    // Cinematic default: the 13B distilled when the target has it (cloud T4),
    // else the fastest distilled available (local 3050 runs the 2B).
    setVideoModel((m) => m
      || pick(models, /ltxv.*13b.*distilled/i)
      || pick(models, /ltxv.*distilled/i)
      || pick(models, /ltxv/i)
      || models[0])
    // Best still engine available on this target: FLUX.1-schnell > RealVisXL
    // (SDXL) > Realistic Vision (SD1.5) — same ladder as the storyboard.
    setKeyModel((m) => m
      || pick(models, /flux/i)
      || pick(models, /realvis/i)
      || pick(models, /realistic_vision/i)
      || pick(models, /dreamshaper/i)
      || models.find((x) => !/ltxv/i.test(x))
      || models[0])
  }, [models])

  const effectiveTarget = resolvedTarget
  const shape = { width: 960, height: 544 } // HQ wide 16:9-ish for the T4; 3050 handles it too

  /**
   * Generate the canonical keyframe (character + relic + palette) via i2i:
   * Realistic Vision + detail LoRA on a neutral studio frame. If the user
   * uploaded one, we skip straight to that. When a character photo reference
   * exists, it SEEDS the keyframe at 0.78 denoise — identity from the photo,
   * composition from the prompt. Otherwise neutral canvas at strength 1.0
   * (full denoise makes the source pixels irrelevant — effectively txt2img).
   */
  const makeKeyframe = async (note) => {
    if (keyframeFile) return keyframeFile
    const scene0 = script.scenes[0]
    const prompt = `${meshPromptForScene(scene0, script, { forVideo: false })}, deep cinematic shadows, 35mm film lens, cinematic lighting, hyper-detailed, single character portrait, centered`
    const photo = characterPhotoForScene(scene0, script)
    const res = await mesh.generate({
      prompt,
      length: 1, width: shape.width, height: shape.height,
      strength: photo ? 0.78 : 1.0, target: effectiveTarget,
      model: keyModel, lora: lora || undefined, loraStrength: 0.8,
      startFile: photo || await neutralFrame(shape.width, shape.height),
      filename: 'keyframe_seed.png',
    })
    note(`keyframe queued (${keyModel}${photo ? ', from photo ref' : ''}${lora ? ` + ${lora}` : ''})…`)
    const info = await mesh.pollJob(res.job, effectiveTarget)
    const blob = await mesh.fetchResult(res.job, effectiveTarget)
    return blob
  }

  /**
   * The render loop. For each scene, in order:
   *   start frame = previous scene's last frame (continuity chain)
   *   end frame   = optional user closing frame on the final scene
   *   then queue LTXV i2v on the mesh, poll, extract the last frame.
   */
  const roll = async () => {
    cancelRef.current = false
    setRunning(true)
    setFinalVideo(null)
    const results = []
    setJobs(script.scenes.map((s) => ({ sceneNumber: s.sceneNumber, status: 'queued', note: '', job: null, url: null })))
    const note = (i, patch) =>
      setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)))
    try {
      let chainFrame = null // Blob: last frame of previous scene
      for (let i = 0; i < script.scenes.length; i++) {
        if (cancelRef.current) break
        const scene = script.scenes[i]
        note(i, { status: 'keyframe' })
        let startFrame
        if (i === 0) {
          // storyboard's approved keyframe wins; auto-generate only as fallback
          if (board?.keyframe?.blob) {
            startFrame = board.keyframe.blob
            setKeyframeUrl(board.keyframe.url)
            note(i, { note: 'using approved keyframe' })
          } else {
            startFrame = await makeKeyframe((m) => note(i, { note: m }))
            setKeyframeUrl(URL.createObjectURL(startFrame))
          }
        } else {
          startFrame = board?.starts?.[i]?.blob || chainFrame
          if (board?.starts?.[i]?.blob) note(i, { note: 'using approved start frame' })
        }
        const isLast = i === script.scenes.length - 1
        const frames = scene.frames || 201 // per-scene LTXV length (8n+1)
        note(i, { status: 'rendering', note: `${frames} frames on ${effectiveTarget === 'cloud' ? 'T4' : '3050'}` })
        const t0 = Date.now()
        const res = await mesh.generate({
          prompt: meshPromptForScene(scene, script),
          length: frames, width: shape.width, height: shape.height,
          strength: 1.0, target: effectiveTarget,
          model: videoModel, lora: lora || undefined, loraStrength: 0.8,
          startFile: startFrame,
          // storyboard end frame (approved) > user closing frame > none
          endFile: board?.ends?.[i]?.blob || (isLast ? endFrameFile : undefined),
          // character photo reference — pinned mid-shot (LTXVAddGuide) so the
          // identity re-asserts itself halfway through long takes
          refFile: characterPhotoForScene(scene, script) || undefined,
          filename: `scene_${scene.sceneNumber}_start.png`,
          endFilename: 'closing_frame.png',
          refFilename: 'character_ref.png',
        })
        note(i, { job: res.job, note: res.note || '' })
        const info = await mesh.pollJob(res.job, effectiveTarget, {
          onTick: () => note(i, { note: `${Math.round((Date.now() - t0) / 1000)}s…` }),
        })
        note(i, {
          status: 'done', url: mesh.fileUrl(res.job, effectiveTarget),
          ms: Date.now() - t0, filename: info.filename,
        })
        results.push({ job: res.job, target: effectiveTarget })
        // chain continuity
        if (!isLast) {
          note(i + 1, { status: 'chaining', note: 'extracting end frame…' })
          chainFrame = await mesh.extractLastFrame(res.job, effectiveTarget)
        }
      }
      if (!cancelRef.current && results.length === script.scenes.length) {
        setAssembling(true)
        const blob = await mesh.assemble(results, songFile)
        setFinalVideo(URL.createObjectURL(blob))
        setAssembling(false)
      }
    } catch (e) {
      setJobs((js) => js.map((j) => (j.status === 'queued' || j.status === 'rendering' || j.status === 'chaining'
        ? { ...j, status: 'error', note: e.message } : j)))
    } finally {
      setRunning(false)
      setAssembling(false)
    }
  }

  const doneCount = jobs.filter((j) => j.status === 'done').length

  // Blob downloads silently fail when the anchor isn't in the DOM —
  // attach, click, remove.
  const downloadFinal = () => {
    const a = document.createElement('a')
    a.href = finalVideo
    a.download = `${(script.title || 'music-video').replace(/[^\w-]+/g, '_').toLowerCase()}_final.mp4`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="amvd-fadein" style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: 1, margin: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Film size={20} color="var(--gold)" /> RENDER — {script.scenes.length} scenes
            {script.timing === 'beats' ? ' · bar-synced' : ' · 8s blocks'}
          </h2>
          <button onClick={onBack} className="amvd-btn-ghost" disabled={running}><ArrowLeft size={14} /> Back to script</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Runs on">
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="amvd-select">
              <option value="auto">Auto (T4 preferred)</option>
              <option value="cloud">Cloud T4 (Kaggle)</option>
              <option value="local">Local RTX 3050</option>
            </select>
          </Field>
          <Field label={`Video model (LTXV)${/13b/i.test(videoModel || '') ? ' — cinematic tier, scenes take ~3-4x longer' : ''}`}>
            <select value={videoModel} onChange={(e) => setVideoModel(e.target.value)} className="amvd-select">
              {(models || []).filter((m) => /ltxv/i.test(m)).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Keyframe model (i2i)">
            <select value={keyModel} onChange={(e) => setKeyModel(e.target.value)} className="amvd-select">
              {(models || []).filter((m) => !/ltxv/i.test(m)).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="LoRA">
            <select value={lora} onChange={(e) => setLora(e.target.value)} className="amvd-select">
              <option value="">none</option>
              {loras.map((l) => <option key={l} value={l}>{l.split(/[\\/]/).pop()}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Keyframe (character anchor)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input ref={keyRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { setKeyframeFile(e.target.files[0]); setKeyframeUrl(URL.createObjectURL(e.target.files[0])) }} />
              <button onClick={() => keyRef.current?.click()} className="amvd-btn-ghost"><KeyRound size={13} /> {keyframeFile ? 'Replace' : 'Upload'}</button>
              {keyframeUrl && <img src={keyframeUrl} alt="keyframe" style={{ height: 44, borderRadius: 6, border: '1px solid var(--hairline)' }} />}
              {!keyframeFile && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>auto-generates if empty</span>}
            </div>
          </Field>
          <Field label="Closing frame (optional)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input ref={endRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => setEndFrameFile(e.target.files[0])} />
              <button onClick={() => endRef.current?.click()} className="amvd-btn-ghost"><Scissors size={13} /> {endFrameFile ? 'Replace' : 'Upload'}</button>
              {endFrameFile && <span style={{ fontSize: 11, color: 'var(--teal)' }}>pinned to last scene's end</span>}
            </div>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={running ? () => { cancelRef.current = true } : roll}
            disabled={resolvedTarget == null}
            style={{ padding: '12px 26px', borderRadius: 10, border: 0, cursor: resolvedTarget == null ? 'default' : 'pointer', background: resolvedTarget == null ? 'var(--panel-raised)' : 'linear-gradient(135deg, var(--gold), #c99630)', color: resolvedTarget == null ? 'var(--text-dim)' : '#161207', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: 1.5, fontSize: 16 }}
          >
            {resolvedTarget == null ? 'NO GPU TARGET' : running ? 'ABORT' : `ROLL (${script.scenes.length} SCENES)`}
          </button>
          {resolvedTarget == null && (
            <span style={{ color: 'var(--red-tally)', fontSize: 13 }}>Cloud T4 requested but no session is live — pick Auto or Local.</span>
          )}
          {running && doneCount > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--teal)' }}>{doneCount}/{script.scenes.length} scenes done</span>
          )}
        </div>
      </div>

      {/* scene queue */}
      <div style={{ display: 'grid', gap: 8 }}>
        {jobs.map((j, i) => {
          const scene = script.scenes[i]
          const icon = j.status === 'done' ? <CheckCircle2 size={15} color="var(--teal)" />
            : j.status === 'error' ? <AlertTriangle size={15} color="var(--red-tally)" />
            : <Loader2 size={15} color="var(--gold)" style={{ animation: 'spin 1s linear infinite' }} />
          return (
            <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {icon}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)', minWidth: 64 }}>#{scene.sceneNumber}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', minWidth: 88 }}>{fmt(scene.startTimeSeconds)}–{fmt(scene.endTimeSeconds)}</span>
              <span style={{ fontSize: 13, flex: 1, minWidth: 200, color: j.status === 'error' ? 'var(--red-tally)' : 'var(--text)' }}>
                {j.status.charAt(0).toUpperCase() + j.status.slice(1)}{j.note ? ` — ${j.note}` : ''}
              </span>
              {j.status === 'done' && j.url && (
                <video src={j.url} controls style={{ height: 64, borderRadius: 6, border: '1px solid var(--hairline)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* final video */}
      {(finalVideo || assembling) && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--gold)', borderRadius: 12, padding: 18, textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 1, margin: '0 0 12px', color: 'var(--gold)', display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <Link2 size={17} /> {assembling ? 'ASSEMBLING FINAL CUT…' : 'FINAL CUT'}
          </h3>
          {finalVideo && (
            <>
              <video src={finalVideo} controls style={{ width: '100%', maxWidth: 900, borderRadius: 10 }} />
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={downloadFinal}
                  style={{ background: 'none', border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: 'var(--teal)', fontFamily: 'var(--font-mono)', fontSize: 14 }}
                >
                  ⬇ Download final cut (with the song)
                </button>
                <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                  a copy is also saved in Desktop\AI Videos
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function pick(list, re) {
  return list.find((x) => re.test(x)) || null
}

// A neutral gradient PNG used as the (discarded) source image for keyframe
// generation at strength 1.0 — the studio's generate endpoint requires one.
function neutralFrame(width, height) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, width, height)
  g.addColorStop(0, '#181820')
  g.addColorStop(1, '#3c3744')
  x.fillStyle = g
  x.fillRect(0, 0, width, height)
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'))
}

function Field({ label, children }) {
  return (
    <label style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', display: 'grid', gap: 5 }}>
      {label.toUpperCase()}
      {children}
    </label>
  )
}

function fmt(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(Math.round(s) % 60).padStart(2, '0')
  return `${m}:${ss}`
}
