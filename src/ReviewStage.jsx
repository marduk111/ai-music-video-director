import React from 'react';
import { Film, Loader2, Download, RefreshCw } from 'lucide-react';
import { formatTime, frameGradient } from './amvdCore.js';

export default function ReviewStage({
  stage, analysis, scenes, selectedIndex, setSelectedIndex,
  statusLine, regeneratingIndex, sceneCount, totalSeconds,
  handleRegenerateScene, setShowExport, handleStartNew,
}) {
  const selected = scenes[selectedIndex];
  const palette = analysis?.palette || [];
  return (
    <div>
      {analysis && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: 0, color: 'var(--gold)', letterSpacing: 0.5 }}>
                {analysis.title}
              </h2>
              <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 14 }}>{analysis.overallMood}</p>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                <span>{analysis.bpm} BPM</span>
                <span>{analysis.musicalKey}</span>
                {analysis.instrumentation && <span>{analysis.instrumentation.join(', ')}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(analysis.palette || []).map((c, i) => (
                <div key={i} title={c.reason} style={{ width: 28, height: 28, borderRadius: 6, background: c.hex, border: '1px solid var(--hairline)' }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === 'working' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, color: 'var(--teal)', fontSize: 14 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          {statusLine || 'Working…'}
        </div>
      )}

      {scenes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="sprocket-row" />
          <div className="amvd-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '12px 4px' }}>
            {scenes.map((s, i) => (
              <button
                key={i}
                type="button"
                className="amvd-frame"
                onClick={() => setSelectedIndex(i)}
                style={{
                  flex: '0 0 120px', height: 72, borderRadius: 8, cursor: 'pointer',
                  background: frameGradient(i, palette),
                  border: `2px solid ${selectedIndex === i ? 'var(--gold)' : 'var(--hairline)'}`,
                  color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11,
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', padding: 8,
                }}
              >
                <span>S{String(s.sceneNumber).padStart(2, '0')}</span>
                <span style={{ opacity: 0.8 }}>{formatTime(s.startTime)}</span>
              </button>
            ))}
            {stage === 'working' && scenes.length < sceneCount && (
              <div style={{ flex: '0 0 120px', height: 72, borderRadius: 8, border: '1px dashed var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                …
              </div>
            )}
          </div>
          <div className="sprocket-row" />
        </div>
      )}

      {selected && (
        <div className="amvd-fadein" style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
              SCENE {String(selected.sceneNumber).padStart(2, '0')} · {formatTime(selected.startTime)}–{formatTime(selected.endTime)}
              {selected.transition ? ` · ${selected.transition}` : ''}
              {selected.cameraAngle ? ` · ${selected.cameraAngle}` : ''}
            </div>
            <button
              type="button"
              onClick={() => handleRegenerateScene(selectedIndex)}
              disabled={regeneratingIndex !== null || stage === 'working'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'transparent', border: '1px solid var(--hairline)', borderRadius: 6,
                color: 'var(--text-dim)', padding: '6px 10px', cursor: 'pointer', fontSize: 12,
              }}
            >
              {regeneratingIndex === selectedIndex ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              Reshoot
            </button>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.5 }}>{selected.description}</p>
          {selected.lyricSnippet && (
            <p style={{ margin: '0 0 12px', fontStyle: 'italic', color: 'var(--teal)', fontSize: 14 }}>
              "{selected.lyricSnippet}"
            </p>
          )}
          <div style={{ background: 'var(--panel-raised)', borderRadius: 8, padding: 12, border: '1px solid var(--hairline)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: 0.5, marginBottom: 6 }}>VEO PROMPT</div>
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.45 }}>{selected.veoPrompt}</p>
          </div>
        </div>
      )}

      {stage === 'done' && analysis && (
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setShowExport(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: '#141318',
            border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer',
          }}>
            <Download size={15} /> Export Script
          </button>
          <button type="button" onClick={handleStartNew} style={{
            background: 'transparent', border: '1px solid var(--hairline)', borderRadius: 8,
            color: 'var(--text-dim)', padding: '10px 16px', cursor: 'pointer',
          }}>
            Start New
          </button>
        </div>
      )}
    </div>
  );
}
