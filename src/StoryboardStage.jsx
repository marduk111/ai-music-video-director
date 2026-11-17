import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Images, RefreshCw, Upload, ThumbsUp, Loader2,
  AlertTriangle, CheckCircle2, Wand2, Video,
} from 'lucide-react'
import * as mesh from './lib/mesh.js'
import { meshPromptForScene, characterPhotoForScene } from './lib/scriptIO.js'

const W = 960
const H = 544

/**
 * Storyboard stage: build the character anchor keyframe and every scene's
 * start/end frames as stills first — each one can be regenerated, uploaded
 * over, or approved — before any video is rendered.
 *
 * board shape (lifted to App so it survives stage navigation):
 *   { keyframe: slot, starts: slot[], ends: slot[] }
 *   slot = { blob, url, status: 'empty'|'busy'|'ready'|'approved'|'error',
 *            prompt, note }
 */
export default function StoryboardStage({ script, mesh: meshStatus, board, setBoard, onBack, onRender }) {
  const [models, setModels] = useState([])
  const [loras, setLoras] = useState([])
  const [keyModel, setKeyModel] = useState('')
  const [lora, setLora] = useState('')
  const fileRefs = useRef({})

  const target = meshStatus?.cloud ? 'cloud' : 'local'

  useEffect(() => {
    mesh.listModels(target).then((d) => setModels(d.models || [])).catch(() => setModels([]))
    mesh.listLoras(target).then((d) => setLoras(d.loras || [])).catch(() => setLoras([]))
  }, [target])

  useEffect(() => {
    if (!models?.length) return
    setKeyModel((m) => m || pick(models, /realistic_vision/i) || pick(models, /realvis/i) || models[0])
  }, [models])

  // ---- board init / patching ----
  const initBoard = () => {
    const mk = (prompt) => ({ blob: null, url: null, status: 'empty', prompt, note: '' })
    const basePrompt = (sc) => meshPromptForScene(sc, script, { forVideo: false })
    setBoard({
      keyframe: mk(`${basePrompt(script.scenes[0])}, deep cinematic shadows, 35mm film lens, hyper-detailed, single character portrait, centered`),
      starts: script.scenes.map((sc) => mk(basePrompt(sc))),
      // END frame = the state AFTER the cut: build it from the NEXT scene's
      // content (what the cut lands on) — otherwise every end frame came out
      // as a near-copy of its start frame. Last scene resolves to stillness.
      ends: script.scenes.map((sc, i) => {
        const next = script.scenes[i + 1]
        const cut = sc.transition ? `, ${sc.transition.toLowerCase()}` : ', the cut lands'
        return mk(next
          ? `${basePrompt(next)}, final beat of shot ${sc.sceneNumber}${cut}`
          : `${basePrompt(sc)}, final image of the song, motion resolving to stillness`)
      }),
    })
  }
  useEffect(() => { if (!board) initBoard(); /* eslint-disable-line */ }, [])

  const patchSlot = (list, i, fields) =>
    setBoard((b) => ({ ...b, [list]: b[list].map((s, k) => (k === i ? { ...s, ...fields } : s)) }))

  const patchKey = (fields) => setBoard((b) => ({ ...b, keyframe: { ...b.keyframe, ...fields } }))

  const setPrompt = (list, i, prompt) => patchSlot(list, i, { prompt })
  const setKeyPrompt = (prompt) => patchKey({ prompt })

  // ---- generation ----
  // Photo reference: the character photo (if the user uploaded one) becomes
  // the seed for stills — identity comes from the photo, the prompt places
  // the shot. Video renders additionally pin it mid-shot (LTXVAddGuide).
  const scenePhoto = (sc) => characterPhotoForScene(sc, script)

  const runSlot = async (list, i, { source, strength, prompt }) => {
    const setter = list === 'keyframe' ? patchKey : (f) => patchSlot(list, i, f)
    setter({ status: 'busy', note: `i2i ${Math.round(strength * 100)}% on ${target === 'cloud' ? 'T4' : '3050'}…` })
    try {
      const res = await mesh.generate({
        prompt, length: 1, width: W, height: H, strength,
        target, model: keyModel, lora: lora || undefined, loraStrength: 0.8,
        startFile: source || await neutralFrame(W, H),
        filename: `board_${list}_${i}.png`,
      })
      await mesh.pollJob(res.job, target)
      const blob = await mesh.fetchResult(res.job, target)
      setter({ blob, url: URL.createObjectURL(blob), status: 'ready', note: res.note || '' })
    } catch (e) {
      setter({ status: 'error', note: e.message })
    }
  }

  const genKeyframe = () => {
    const photo = scenePhoto(script.scenes[0])
    if (photo) {
      // Photo reference seed: 0.78 denoise keeps the person's identity while
      // the prompt dresses the scene around them.
      return runSlot('keyframe', 0, { source: photo, strength: 0.78, prompt: board.keyframe.prompt })
    }
    return runSlot('keyframe', 0, { strength: 1.0, prompt: board.keyframe.prompt })
  }
  const genStart = (i) => {
    // scene 1's start frame IS the keyframe by default; regenerate makes a variant
    const src = i === 0 ? null : board.keyframe?.blob
    if (i > 0 && !src) { patchSlot('starts', i, { status: 'error', note: 'generate the character keyframe first' }); return }
    // 0.7 denoise: enough authority for the scene's own content, enough
    // restraint to keep the keyframe's cast/look (below ~0.6 the scene prompt
    // barely registers; the old 0.62 left every shot looking like the keyframe).
    runSlot('starts', i, { source: src, strength: i === 0 ? 1.0 : 0.7, prompt: board.starts[i].prompt })
  }
  const genEnd = (i) => {
    const src = board.starts?.[i]?.blob
    if (!src) { patchSlot('ends', i, { status: 'error', note: 'generate this scene\u2019s start frame first' }); return }
    // 0.72 denoise + a next-scene prompt: the end frame must SHOW the cut
    // landing, not re-print the start frame (the old 0.5 + same prompt did).
    runSlot('ends', i, { source: src, strength: 0.72, prompt: board.ends[i].prompt })
  }

  // scene 1's start frame defaults to the approved keyframe
  useEffect(() => {
    if (!board) return
    const kf = board.keyframe
    const s0 = board.starts?.[0]
    if (kf?.blob && kf.status !== 'busy' && s0 && !s0.blob && s0.status === 'empty') {
      patchSlot('starts', 0, { blob: kf.blob, url: kf.url, status: 'ready', note: 'using the keyframe — regenerate for a variant' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.keyframe?.status])

  const genAllStarts = async () => {
    if (!board.keyframe?.blob) { genKeyframe(); return }
    for (let i = 0; i < script.scenes.length; i++) {
      if (board.starts[i].status === 'approved') continue
      // eslint-disable-next-line no-await-in-loop
      await genStart(i)
    }
  }

  const approve = (list, i) => {
    const setter = list === 'keyframe' ? patchKey : (f) => patchSlot(list, i, f)
    setter({ status: 'approved' })
  }
  const approveAll = () => {
    setBoard((b) => ({
      ...b,
      keyframe: b.keyframe.status === 'ready' ? { ...b.keyframe, status: 'approved' } : b.keyframe,
      starts: b.starts.map((s) => (s.status === 'ready' ? { ...s, status: 'approved' } : s)),
      ends: b.ends.map((s) => (s.status === 'ready' ? { ...s, status: 'approved' } : s)),
    }))
  }

  const upload = (list, i, file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const setter = list === 'keyframe' ? patchKey : (f) => patchSlot(list, i, f)
    setter({ blob: file, url, status: 'approved', note: 'uploaded by you' })
  }

  if (!board) return null

  const readyCount = [board.keyframe, ...board.starts, ...board.ends]
    .filter((s) => s.status === 'approved' || s.status === 'ready').length
  const allCount = 1 + script.scenes.length * 2
  const keyframeReady = !!board.keyframe?.blob

  return (
    <div className="amvd-fadein" style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: 1, margin: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Images size={20} color="var(--gold)" /> STORYBOARD — {script.scenes.length} shots
          </h2>
          <button onClick={onBack} className="amvd-btn-ghost"><ArrowLeft size={14} /> Back to script</button>
        </div>
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
          Character keyframe + every shot's start/end frame, built as stills on the {target === 'cloud' ? 'cloud T4' : 'local 3050'}.
          Approve or edit each before rolling video — approved frames are what the renderer uses.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Still model (i2i)">
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
          <button onClick={genAllStarts} className="amvd-btn-ghost" disabled={!keyModel}><Wand2 size={14} /> Generate missing frames</button>
          <button onClick={approveAll} className="amvd-btn-ghost"><ThumbsUp size={14} /> Approve all ready</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>{readyCount}/{allCount} frames set</span>
        </div>
      </div>

      {/* keyframe */}
      <SlotCard
        title="CHARACTER KEYFRAME" subtitle="the anchor every shot inherits"
        slot={board.keyframe} list="keyframe" i={0}
        onGenerate={genKeyframe} onApprove={() => approve('keyframe', 0)}
        onUpload={(f) => upload('keyframe', 0, f)} onPrompt={setKeyPrompt}
        fileRefs={fileRefs} big
      />

      {/* per-scene frames */}
      <div style={{ display: 'grid', gap: 10 }}>
        {script.scenes.map((sc, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--gold)' }}>SHOT {sc.sceneNumber}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
                {fmt(sc.startTimeSeconds)}–{fmt(sc.endTimeSeconds)} · {sc.cameraAngle} · {sc.frames || 201}f
              </span>
              {sc.correspondingLyrics?.length > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)' }}>♪ {sc.correspondingLyrics[0].text}</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              <SlotCard
                title="START FRAME" slot={board.starts[i]} list="starts" i={i}
                onGenerate={() => genStart(i)} onApprove={() => approve('starts', i)}
                onUpload={(f) => upload('starts', i, f)} onPrompt={(p) => setPrompt('starts', i, p)}
                fileRefs={fileRefs}
              />
              <SlotCard
                title="END FRAME (optional)" slot={board.ends[i]} list="ends" i={i}
                onGenerate={() => genEnd(i)} onApprove={() => approve('ends', i)}
                onUpload={(f) => upload('ends', i, f)} onPrompt={(p) => setPrompt('ends', i, p)}
                fileRefs={fileRefs}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onRender}
          style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '12px 22px', borderRadius: 10, border: 0, cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold), #c99630)', color: '#161207', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: 1.2, fontSize: 15 }}
        >
          <Video size={15} /> TO RENDER {keyframeReady ? `(keyframe approved anchor)` : '(renderer auto-builds missing frames)'}
        </button>
      </div>
    </div>
  )
}

function SlotCard({ title, subtitle, slot, list, i, onGenerate, onApprove, onUpload, onPrompt, fileRefs, big }) {
  const statusIcon = slot.status === 'busy' ? <Loader2 size={14} color="var(--gold)" style={{ animation: 'spin 1s linear infinite' }} />
    : slot.status === 'error' ? <AlertTriangle size={14} color="var(--red-tally)" />
    : slot.status === 'approved' ? <CheckCircle2 size={14} color="var(--teal)" />
    : null
  return (
    <div style={{ border: `1px solid ${slot.status === 'approved' ? 'var(--teal)' : 'var(--hairline)'}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8, gridTemplateRows: 'auto auto 1fr' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {statusIcon}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold)', letterSpacing: 1 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{subtitle}</span>}
        <span style={{ flex: 1 }} />
        <input
          ref={(el) => { if (fileRefs.current) fileRefs.current[`${list}${i}`] = el }}
          type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { onUpload(e.target.files[0]); e.target.value = '' }}
        />
        <button onClick={() => fileRefs.current[`${list}${i}`]?.click()} className="amvd-btn-ghost" style={{ padding: '5px 9px', fontSize: 11 }}><Upload size={11} /></button>
        <button onClick={onGenerate} disabled={slot.status === 'busy'} className="amvd-btn-ghost" style={{ padding: '5px 9px', fontSize: 11 }}><RefreshCw size={11} /> {slot.blob ? 'Re-roll' : 'Generate'}</button>
        {slot.status === 'ready' && (
          <button onClick={onApprove} className="amvd-btn-ghost" style={{ padding: '5px 9px', fontSize: 11, borderColor: 'var(--teal)' }}><ThumbsUp size={11} /> Approve</button>
        )}
      </div>
      {slot.url && (
        <img src={slot.url} alt={title} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--hairline)', maxHeight: big ? 420 : 200, objectFit: 'cover' }} />
      )}
      <textarea
        rows={big ? 3 : 2}
        value={slot.prompt}
        onChange={(e) => onPrompt(e.target.value)}
        style={{ width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 8, color: 'var(--text)', padding: 8, fontFamily: 'var(--font-body)', fontSize: 12, resize: 'vertical' }}
      />
      {slot.note && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: slot.status === 'error' ? 'var(--red-tally)' : 'var(--text-dim)' }}>
          {slot.status === 'busy' ? slot.note : `${slot.status}: ${slot.note}`}
        </div>
      )}
    </div>
  )
}

function pick(list, re) {
  return list.find((x) => re.test(x)) || null
}

function Field({ label, children }) {
  return (
    <label style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', display: 'grid', gap: 5 }}>
      {label.toUpperCase()}
      {children}
    </label>
  )
}

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

function fmt(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(Math.round(s) % 60).padStart(2, '0')
  return `${m}:${ss}`
}
