import React, { useState, useRef } from 'react'
import { FileDown, FileUp, ArrowLeft, Video, Loader2 } from 'lucide-react'
import { serializeScriptText } from './lib/scriptIO.js'
import { CAMERA_ANGLES, TRANSITIONS } from './lib/constants.js'

export default function ReviewStage({
  script, setScript, audio, importInfo, mesh,
  onBack, onRender,
}) {
  const [selRaw, setSel] = useState(0)
  const sel = Math.min(selRaw, Math.max(0, script.scenes.length - 1))
  const exportRef = useRef(null)

  const updateScene = (idx, patch) => {
    setScript((s) => {
      const scenes = s.scenes.map((sc, i) => (i === idx ? { ...sc, ...patch } : sc))
      return { ...s, scenes }
    })
  }

  const updateElements = (patch) => setScript((s) => ({ ...s, consistentElements: { ...s.consistentElements, ...patch } }))

  const doExport = () => {
    const blob = new Blob([serializeScriptText(script)], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(script.title || 'music-video').replace(/[^\w-]+/g, '_').toLowerCase()}_script.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const scene = script.scenes[Math.min(sel, script.scenes.length - 1)]
  const palette = script.analysis?.suggestedColorPalette || []
  const total = script.scenes[script.scenes.length - 1]?.endTimeSeconds || 0

  return (
    <div className="amvd-fadein" style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: 0, color: 'var(--gold)', letterSpacing: 0.5 }}>{script.title}</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
            {script.overallMood} · {script.scenes.length} scenes · {Math.floor(total / 60)}:{String(total % 60).padStart(2, '0')} total
            {audio ? ` · ${audio.bpm} BPM detected` : ''}
            {importInfo ? ` · ${importInfo}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {palette.map((c, i) => (
              <div key={i} title={c.reason} style={{ width: 24, height: 24, borderRadius: 6, background: c.hex, border: '1px solid var(--hairline)' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button onClick={onBack} className="amvd-btn-ghost"><ArrowLeft size={14} /> New script</button>
          <button onClick={() => exportRef.current?.click()} className="amvd-btn-ghost"><FileDown size={14} /> Export .txt</button>
          <button onClick={doExport} style={{ display: 'none' }} />
          <button
            onClick={onRender}
            style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '10px 18px', borderRadius: 10, border: 0, cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold), #c99630)', color: '#161207', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: 1.2, fontSize: 15 }}
          >
            <Video size={15} /> ROLL RENDER
          </button>
        </div>
      </div>

      {/* filmstrip */}
      <div className="sprocket-row" />
      <div className="amvd-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 4px' }}>
        {script.scenes.map((s, i) => (
          <button
            key={i}
            className="amvd-frame"
            onClick={() => setSel(i)}
            style={{
              flex: '0 0 118px', height: 70, borderRadius: 8, cursor: 'pointer',
              background: `linear-gradient(160deg, ${palette[i % Math.max(1, palette.length)]?.hex || '#223'} 0%, var(--panel-raised) 130%)`,
              border: `2px solid ${sel === i ? 'var(--gold)' : 'var(--hairline)'}`,
              color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 10,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 7, textAlign: 'left',
            }}
          >
            <div style={{ color: 'var(--gold)' }}>#{s.sceneNumber}</div>
            <div>{fmt(s.startTimeSeconds)}–{fmt(s.endTimeSeconds)}</div>
            <div style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{s.cameraAngle}</div>
          </button>
        ))}
      </div>
      <div className="sprocket-row" />

      {/* scene editor */}
      {scene && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 1, margin: 0 }}>
              SCENE {scene.sceneNumber} <span style={{ color: 'var(--text-dim)', fontSize: 14, fontFamily: 'var(--font-mono)' }}>{fmt(scene.startTimeSeconds)} – {fmt(scene.endTimeSeconds)}</span>
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Select value={scene.cameraAngle} options={CAMERA_ANGLES} onChange={(v) => updateScene(sel, { cameraAngle: v })} label="Camera" />
              <Select
                value={scene.transition || ''}
                options={['', ...TRANSITIONS]}
                onChange={(v) => updateScene(sel, { transition: v || null })}
                label="Transition"
              />
            </div>
          </div>
          <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Shot prompt (what the generator renders)
            <textarea
              rows={3}
              value={scene.veoPrompt}
              onChange={(e) => updateScene(sel, { veoPrompt: e.target.value })}
              style={{ display: 'block', width: '100%', marginTop: 5, background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 8, color: 'var(--text)', padding: 10, fontFamily: 'var(--font-body)' }}
            />
          </label>
          {scene.correspondingLyrics?.length > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--teal)', background: 'var(--panel-raised)', borderRadius: 8, padding: '8px 12px' }}>
              ♪ {scene.correspondingLyrics.map((l) => l.text).join(' / ')}
            </div>
          )}
        </div>
      )}

      {/* consistency */}
      <ConsistencyEditor elements={script.consistentElements} onChange={updateElements} />
    </div>
  )
}

function ConsistencyEditor({ elements, onChange }) {
  const setCharacters = (i, patch) => {
    const characters = elements.characters.map((c, j) => (j === i ? { ...c, ...patch } : c))
    onChange({ characters })
  }
  const setProps = (i, patch) => {
    const props = elements.props.map((p, j) => (j === i ? { ...p, ...patch } : p))
    onChange({ props })
  }
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, padding: 18 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 1, margin: '0 0 10px', color: 'var(--gold)' }}>
        CONSISTENT ELEMENTS <span style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>— injected into every scene prompt</span>
      </h3>
      {[...elements.characters.map((c, i) => ({ kind: 'c', item: c, i })), ...elements.props.map((p, i) => ({ kind: 'p', item: p, i }))].map(({ kind, item, i }) => (
        <div key={`${kind}${i}`} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 10, marginBottom: 8 }}>
          <input
            value={item.name}
            onChange={(e) => (kind === 'c' ? setCharacters(i, { name: e.target.value }) : setProps(i, { name: e.target.value }))}
            style={{ background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 6, color: 'var(--gold)', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
          <input
            value={item.description}
            onChange={(e) => (kind === 'c' ? setCharacters(i, { description: e.target.value }) : setProps(i, { description: e.target.value }))}
            style={{ background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px' }}
          />
        </div>
      ))}
    </div>
  )
}

function Select({ value, options, onChange, label }) {
  return (
    <label style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
      {label.toUpperCase()}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ display: 'block', marginTop: 4, background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, maxWidth: 220 }}
      >
        {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </label>
  )
}

function fmt(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(Math.round(s) % 60).padStart(2, '0')
  return `${m}:${ss}`
}
