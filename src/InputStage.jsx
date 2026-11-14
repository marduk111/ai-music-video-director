import React, { useState, useRef } from 'react'
import { Music, FileUp, Wand2, Loader2 } from 'lucide-react'
import { analyzeAudioFile } from './lib/audioAnalysis.js'
import { generateScriptWithEngine } from './lib/directorEngine.js'
import { VISUAL_STYLES } from './lib/constants.js'

export default function InputStage({ mesh, onScript, onImport }) {
  const [lyrics, setLyrics] = useState('')
  const [style, setStyle] = useState('Cinematic')
  const [audio, setAudio] = useState(null)
  const [analyzing, setAnalyzing] = useState('')
  const [duration, setDuration] = useState(90) // fallback if no song uploaded
  const [busy, setBusy] = useState(false)
  const [models, setModels] = useState(null)
  const songRef = useRef(null)
  const scriptRef = useRef(null)

  const handleSong = async (file) => {
    if (!file) return
    try {
      setAnalyzing('Decoding…')
      const a = await analyzeAudioFile(file, (s) => setAnalyzing(s))
      setAudio(a)
      setDuration(Math.max(8, Math.round(a.duration)))
      setAnalyzing('')
    } catch (e) {
      setAnalyzing('')
      alert(`Could not analyze that audio file: ${e.message}`)
    }
  }

  const generate = async () => {
    setBusy(true)
    try {
      const script = generateScriptWithEngine({
        durationSeconds: duration,
        style,
        lyricsText: lyrics,
        audio,
        songTitle: audio?.fileName?.replace(/\.[^.]+$/, '') || '',
      })
      onScript(script, audio, songRef.current?.files?.[0] || null, '')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="amvd-fadein" style={{ display: 'grid', gap: 18, maxWidth: 900, margin: '0 auto' }}>
      <Panel>
        <Head icon={<Music size={18} color="var(--teal)" />} title="1 · The song" />
        <input ref={songRef} type="file" accept="audio/*" onChange={(e) => handleSong(e.target.files[0])} style={{ color: 'var(--text-dim)' }} />
        {analyzing && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, color: 'var(--teal)', fontSize: 13 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {analyzing}
          </div>
        )}
        {audio && (
          <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
            <span>{audio.fileName}</span>
            <span style={{ color: 'var(--gold)' }}>{audio.bpm} BPM</span>
            <span>{Math.floor(audio.duration / 60)}:{String(Math.round(audio.duration % 60)).padStart(2, '0')} long</span>
            <span style={{ color: 'var(--teal)' }}>bar-synced scenes — cuts land on the beat</span>
          </div>
        )}
        {!audio && (
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
            <span>No song loaded — set a duration:</span>
            <input
              type="number" min="8" max="900" value={duration}
              onChange={(e) => setDuration(Math.max(8, +e.target.value || 8))}
              style={{ width: 90, background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontFamily: 'var(--font-mono)' }}
            />
            <span>seconds ({Math.ceil(duration / 8)}-ish scenes, fixed 8s blocks)</span>
          </div>
        )}
      </Panel>

      <Panel>
        <Head icon={<Wand2 size={18} color="var(--teal)" />} title="2 · The look" />
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 200, fontSize: 13, color: 'var(--text-dim)' }}>
            Visual style
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="amvd-input" style={{ display: 'block', marginTop: 6 }}>
              {(VISUAL_STYLES || ['Cinematic', 'Gothic', 'Cyberpunk', 'Vaporwave', 'Film Noir']).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label style={{ display: 'block', marginTop: 12, fontSize: 13, color: 'var(--text-dim)' }}>
          Lyrics <span style={{ opacity: 0.7 }}>(optional — with [mm:ss] timestamps for beat-accurate sync)</span>
          <textarea
            className="amvd-textarea"
            rows={6}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={'[Verse]\nI was born in a thunderstorm...\n\n[Chorus]\n[00:45] And I grow up again, eliza again...'}
            style={{ display: 'block', width: '100%', marginTop: 6, background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 8, color: 'var(--text)', padding: 12, fontFamily: 'var(--font-body)' }}
          />
        </label>
      </Panel>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={generate}
          disabled={busy}
          style={{ flex: 2, minWidth: 220, padding: 14, borderRadius: 10, border: 0, cursor: busy ? 'default' : 'pointer', background: 'linear-gradient(135deg, var(--gold), #c99630)', color: '#161207', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)', letterSpacing: 1.5 }}
        >
          {busy ? 'WORKING…' : 'GENERATE SCRIPT'}
        </button>
        <button
          onClick={() => scriptRef.current?.click()}
          style={{ flex: 1, minWidth: 180, padding: 14, borderRadius: 10, cursor: 'pointer', background: 'var(--panel-raised)', border: '1px solid var(--hairline)', color: 'var(--text)', fontSize: 14 }}
        >
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FileUp size={15} color="var(--gold)" /> Import script (.txt)</span>
        </button>
        <input ref={scriptRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={(e) => { onImport(e.target.files[0]); e.target.value = '' }} />
      </div>
    </div>
  )
}

function Panel({ children }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, padding: 18 }}>
      {children}
    </div>
  )
}

function Head({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
      {icon}
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 1.2, margin: 0 }}>{title}</h2>
    </div>
  )
}
