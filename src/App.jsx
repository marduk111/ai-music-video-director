import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Film, Sparkles, Loader2, Download, Copy, X, Check, RefreshCw } from 'lucide-react';

/**
 * Full UI source is large; if this placeholder is present, replace with the complete
 * App.jsx from the local project package (or pull the latest commit that includes it).
 * This minimal shell still wires /api/generate so you can verify Ollama connectivity.
 */

async function callLocal(prompt) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${response.status})`);
  }
  const data = await response.json();
  if (!data.text) throw new Error('The AI returned no text.');
  return data.text;
}

export default function App() {
  const [lyrics, setLyrics] = useState('');
  const [out, setOut] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth({ status: 'proxy_down' }));
  }, []);

  const run = useCallback(async () => {
    setBusy(true); setErr(null); setOut('');
    try {
      const text = await callLocal(
        'You are a music video director. Given these lyrics, reply with a short JSON object: {"title":string,"overallMood":string,"scenes":[{"description":string,"veoPrompt":string}]}. Lyrics:\n' +
          lyrics
      );
      setOut(text);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [lyrics]);

  return (
    <div style={{ background: '#0B0B0D', color: '#EDEAE2', minHeight: '100vh', fontFamily: 'system-ui', padding: 24 }}>
      <h1 style={{ color: '#E3B341' }}>AI Music Video Director</h1>
      <p style={{ color: '#9C99A6' }}>
        Local Ollama edition. Health: <code>{health ? JSON.stringify(health.status) : '…'}</code>
      </p>
      <p style={{ color: '#E1503F', fontSize: 13 }}>
        This is a connectivity shell. Replace <code>src/App.jsx</code> with the full UI from the complete project package for the filmstrip storyboard experience.
      </p>
      <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={8} style={{ width: '100%', background: '#1E1D24', color: '#EDEAE2', border: '1px solid #302E37', borderRadius: 8, padding: 12 }} placeholder="Paste lyrics…" />
      <button onClick={run} disabled={busy || !lyrics.trim()} style={{ marginTop: 12, background: '#E3B341', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
        {busy ? 'Working…' : 'Test generate'}
      </button>
      {err && <pre style={{ color: '#E1503F' }}>{err}</pre>}
      {out && <pre style={{ marginTop: 16, background: '#16151A', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{out}</pre>}
    </div>
  );
}
