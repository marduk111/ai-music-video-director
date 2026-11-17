import React, { useState, useEffect, useCallback } from 'react'
import { Clapperboard, Wifi, WifiOff } from 'lucide-react'
import { meshStatus } from './lib/mesh.js'
import { parseScriptText } from './lib/scriptIO.js'
import './amvd.css'
import InputStage from './InputStage.jsx'
import ReviewStage from './ReviewStage.jsx'
import StoryboardStage from './StoryboardStage.jsx'
import RenderStage from './RenderStage.jsx'

export default function App() {
  const [stage, setStage] = useState('input') // input | review | storyboard | render
  const [script, setScript] = useState(null)
  const [audio, setAudio] = useState(null) // analysis object from audioAnalysis
  const [songFile, setSongFile] = useState(null)
  const [board, setBoard] = useState(null) // storyboard frames (approved stills)
  const [mesh, setMesh] = useState(null)
  const [error, setError] = useState(null)
  const [importInfo, setImportInfo] = useState('')

  // Poll the mesh status — cloud T4 comes and goes with Kaggle sessions.
  useEffect(() => {
    let alive = true
    const ping = () =>
      meshStatus()
        .then((s) => alive && setMesh(s))
        .catch(() => alive && setMesh({ comfy: false, local: false, cloud: false, offline: true }))
    ping()
    const id = setInterval(ping, 20000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // Dev/testing affordance: ?script=name auto-imports public/scripts/<name>.txt
  useEffect(() => {
    const name = new URLSearchParams(location.search).get('script')
    if (!name) return
    fetch(`/scripts/${name}.txt`)
      .then((r) => r.text())
      .then((t) => handleScript(parseScriptText(t), null, null, `auto-imported: ${name}`))
      .catch((e) => setError(`Auto-import failed: ${e.message}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScript = useCallback((nextScript, nextAudio, nextSong, info) => {
    setError(null)
    if (!nextScript?.scenes?.length) {
      setError('That script had no scenes in it.')
      return
    }
    setScript(nextScript)
    setAudio(nextAudio ?? null)
    setSongFile(nextSong ?? null)
    setBoard(null) // a new script means a fresh storyboard
    setImportInfo(info || '')
    setStage('review')
  }, [])

  const handleImport = useCallback(async (file) => {
    try {
      const text = await file.text()
      const parsed = parseScriptText(text)
      handleScript(parsed, audio, songFile, `Imported "${parsed.title}" — ${parsed.scenes.length} scenes`)
    } catch (e) {
      setError(`Import failed: ${e.message}`)
    }
  }, [audio, songFile, handleScript])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)', padding: '28px clamp(16px, 5vw, 56px)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clapperboard size={30} color="var(--gold)" />
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, letterSpacing: 2, margin: 0 }}>
              AI MUSIC VIDEO DIRECTOR
            </h1>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
              lyrics → timed script → mesh render (local 3050 + Kaggle T4)
            </p>
          </div>
        </div>
        <MeshBadge mesh={mesh} />
      </header>

      {error && (
        <div className="amvd-fadein" style={{ background: 'var(--panel)', border: '1px solid var(--red-tally)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red-tally)' }}>
          {error}
        </div>
      )}

      {stage === 'input' && (
        <InputStage
          mesh={mesh}
          onScript={handleScript}
          onImport={handleImport}
        />
      )}

      {stage === 'review' && script && (
        <ReviewStage
          script={script}
          setScript={setScript}
          audio={audio}
          importInfo={importInfo}
          mesh={mesh}
          onBack={() => setStage('input')}
          onRender={() => setStage('storyboard')}
        />
      )}

      {stage === 'storyboard' && script && (
        <StoryboardStage
          script={script}
          mesh={mesh}
          board={board}
          setBoard={setBoard}
          onBack={() => setStage('review')}
          onRender={() => setStage('render')}
        />
      )}

      {stage === 'render' && script && (
        <RenderStage
          script={script}
          audio={audio}
          songFile={songFile}
          mesh={mesh}
          board={board}
          onBack={() => setStage('storyboard')}
        />
      )}
    </div>
  )
}

function MeshBadge({ mesh }) {
  if (!mesh) return null
  if (mesh.offline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--red-tally)' }}>
        <WifiOff size={15} /> I2V Studio offline — start it with the desktop launcher
      </div>
    )
  }
  const cloud = mesh.cloud
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: cloud ? 'var(--teal)' : 'var(--text-dim)' }}>
      <Wifi size={15} />
      {cloud ? 'Mesh: Local 3050 + Cloud T4 live — T4 preferred' : 'Mesh: Local 3050 only (no Kaggle session)'}
    </div>
  )
}
