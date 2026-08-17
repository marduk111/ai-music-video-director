import React from 'react';
import { Sparkles } from 'lucide-react';
import { MOODS, SAMPLE_LYRICS } from './amvdCore.js';

export default function InputStage({
  lyrics, setLyrics, minutes, setMinutes, seconds, setSeconds,
  mood, setMood, batchSize, setBatchSize, sceneCount, numBatches,
  handleTimeChange, handleGenerate,
}) {
  return (
          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--hairline)',
              borderRadius: 10,
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Lyrics
              </label>
              <button
                onClick={() => setLyrics(SAMPLE_LYRICS)}
                style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                Load sample lyrics
              </button>
            </div>
            <textarea
              className="amvd-textarea"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={'[Verse]\nYour lyrics here...\n\n[Chorus]\n...\n\n[Instrumental]'}
              rows={10}
              style={{
                width: '100%', background: 'var(--panel-raised)', border: '1px solid var(--hairline)',
                borderRadius: 8, color: 'var(--text)', padding: 14, fontFamily: 'var(--font-mono)',
                fontSize: 13.5, resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 20 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                  Song Length
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 20 }}>
                  <input value={minutes} onChange={handleTimeChange(setMinutes)} style={{ width: 44, background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 6, color: 'var(--gold)', padding: '6px 4px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 20, outline: 'none' }} />
                  <span style={{ color: 'var(--text-dim)' }}>:</span>
                  <input value={seconds} onChange={handleTimeChange(setSeconds)} style={{ width: 44, background: 'var(--panel-raised)', border: '1px solid var(--hairline)', borderRadius: 6, color: 'var(--gold)', padding: '6px 4px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 20, outline: 'none' }} />
                </div>
                {sceneCount > 0 && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6 }}>
                    ≈ {sceneCount} scenes · {numBatches} AI calls (batch {batchSize})
                  </p>
                )}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                  Scenes per call
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setBatchSize(n)} style={{
                      padding: '6px 14px', borderRadius: 6,
                      border: `1px solid ${batchSize === n ? 'var(--gold)' : 'var(--hairline)'}`,
                      background: batchSize === n ? 'var(--gold)' : 'transparent',
                      color: batchSize === n ? '#141318' : 'var(--text-dim)',
                      fontWeight: batchSize === n ? 700 : 500, cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontSize: 13,
                    }}>{n}</button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Use 2 if small models break JSON</p>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                Visual Style
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MOODS.map((m) => (
                  <button key={m} onClick={() => setMood(m)} style={{
                    padding: '7px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    border: `1px solid ${mood === m ? 'var(--gold)' : 'var(--hairline)'}`,
                    background: mood === m ? 'var(--gold)' : 'transparent',
                    color: mood === m ? '#141318' : 'var(--text-dim)',
                    fontWeight: mood === m ? 700 : 500,
                  }}>{m}</button>
                ))}
              </div>
            </div>
            <button onClick={handleGenerate} style={{
              marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--gold)', color: '#141318', border: 'none', borderRadius: 8,
              padding: '12px 22px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}>
              <Sparkles size={17} /> Roll Camera
            </button>
          </div>
  );
}
