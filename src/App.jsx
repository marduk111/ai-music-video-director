import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Film, Download, Copy, X, Check } from 'lucide-react';
import { STYLE_DIRECTIVES, callLocalJSON, formatTime } from './amvdCore.js';
import './amvd.css';
import InputStage from './InputStage.jsx';
import ReviewStage from './ReviewStage.jsx';

export default function App() {
  const [stage, setStage] = useState('input');
  const [lyrics, setLyrics] = useState('');
  const [minutes, setMinutes] = useState('01');
  const [seconds, setSeconds] = useState('30');
  const [mood, setMood] = useState('Cinematic');
  const [analysis, setAnalysis] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState(null);
  const [statusLine, setStatusLine] = useState('');
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState(null);
  const [batchSize, setBatchSize] = useState(3);
  const cancelRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const ping = () => {
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => { if (alive) setHealth(d); })
        .catch(() => { if (alive) setHealth({ status: 'proxy_down' }); });
    };
    ping();
    const id = setInterval(ping, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const totalSeconds = parseInt(minutes || '0', 10) * 60 + parseInt(seconds || '0', 10);
  const sceneCount = totalSeconds > 0 ? Math.ceil(totalSeconds / 8) : 0;
  const numBatches = sceneCount > 0 ? Math.ceil(sceneCount / batchSize) : 0;

  const handleTimeChange = (setter) => (e) => {
    setter(e.target.value.replace(/[^0-9]/g, '').slice(0, 2));
  };

  const handleGenerate = useCallback(async () => {
    if (!lyrics.trim()) { setError('Add some lyrics before you roll camera.'); return; }
    if (totalSeconds <= 0) { setError('Set a song length greater than zero.'); return; }
    cancelRef.current = false;
    setError(null); setAnalysis(null); setScenes([]); setSelectedIndex(0);
    setStage('working'); setStatusLine('Analyzing the song...');
    const styleNote = STYLE_DIRECTIVES[mood] || '';
    let allScenes = [];
    try {
      const analysisPrompt = 'You are a music video director. Respond ONLY with JSON (no markdown): {"title":string,"overallMood":string,"bpm":number,"musicalKey":string,"dynamics":string,"instrumentation":[string],"lyricalThemes":[string],"palette":[{"hex":"#RRGGBB","reason":string}]} Song length ' + totalSeconds + 's. Style: ' + mood + ' - ' + styleNote + '. Lyrics:\n' + lyrics;
      const analysisData = await callLocalJSON(analysisPrompt);
      if (cancelRef.current) return;
      setAnalysis(analysisData);
      for (let start = 1; start <= sceneCount; start += batchSize) {
        if (cancelRef.current) return;
        const end = Math.min(start + batchSize - 1, sceneCount);
        setStatusLine('Storyboarding scenes ' + start + '-' + end + ' of ' + sceneCount + '...');
        const prevDesc = allScenes.length ? allScenes[allScenes.length - 1].description : 'Opening scene.';
        const scenePrompt = 'Storyboard VEO music video scenes. Style: ' + mood + '. Song: ' + analysisData.title + '. Mood: ' + analysisData.overallMood + '. Generate scenes ' + start + ' to ' + end + ' of ' + sceneCount + ' (8s each). Prior: "' + prevDesc + '". Lyrics:\n' + lyrics + '\nRespond ONLY JSON array: [{"sceneNumber":n,"description":string,"veoPrompt":string,"cameraAngle":string,"transition":string|null,"lyricSnippet":string}]';
        const batchData = await callLocalJSON(scenePrompt);
        const arr = Array.isArray(batchData) ? batchData : [batchData];
        const normalized = arr.map((s, i) => {
          const sceneNumber = start + i;
          return { ...s, sceneNumber, startTime: (sceneNumber - 1) * 8, endTime: Math.min(sceneNumber * 8, totalSeconds) };
        });
        allScenes = allScenes.concat(normalized);
        setScenes(allScenes.slice());
        setSelectedIndex(allScenes.length - 1);
      }
      setStage('done'); setStatusLine('');
    } catch (err) {
      console.error(err);
      setError(allScenes.length ? 'Partial script kept. Reshoot or start new.' : (err.message || 'Generation failed.'));
      setStage(allScenes.length ? 'done' : 'input');
    }
  }, [lyrics, minutes, seconds, mood, totalSeconds, sceneCount, batchSize]);

  const handleRegenerateScene = useCallback(async (index) => {
    if (!analysis) return;
    setRegeneratingIndex(index); setError(null);
    try {
      const scene = scenes[index];
      const styleNote = STYLE_DIRECTIVES[mood] || '';
      const prevDesc = index > 0 ? scenes[index - 1].description : 'Opening.';
      const nextDesc = index < scenes.length - 1 ? scenes[index + 1].description : 'Closing.';
      const prompt = 'Alternate take scene ' + scene.sceneNumber + ' (' + formatTime(scene.startTime) + '-' + formatTime(scene.endTime) + '). Style: ' + mood + ' - ' + styleNote + '. Before: "' + prevDesc + '". After: "' + nextDesc + '". ONLY JSON: {"description":string,"veoPrompt":string,"cameraAngle":string,"transition":string|null,"lyricSnippet":string}';
      const data = await callLocalJSON(prompt);
      setScenes((prev) => prev.map((s, i) => i === index ? { ...s, ...data, sceneNumber: scene.sceneNumber, startTime: scene.startTime, endTime: scene.endTime } : s));
    } catch (err) {
      setError(err.message || 'Reshoot failed.');
    } finally {
      setRegeneratingIndex(null);
    }
  }, [analysis, scenes, mood]);

  const handleStartNew = () => {
    cancelRef.current = true;
    setStage('input'); setAnalysis(null); setScenes([]); setError(null); setStatusLine('');
  };

  const buildExportText = () => {
    if (!analysis) return '';
    let out = analysis.title + '\n' + analysis.overallMood + '\n\n';
    out += 'Tempo: ' + analysis.bpm + ' BPM\nKey: ' + analysis.musicalKey + '\n\n';
    scenes.forEach((s) => {
      out += 'SCENE ' + s.sceneNumber + ' [' + formatTime(s.startTime) + '-' + formatTime(s.endTime) + ']\n';
      out += s.description + '\nLyrics: ' + (s.lyricSnippet || '') + '\nVEO: ' + s.veoPrompt + '\n\n';
    });
    return out;
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(buildExportText()); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([buildExportText()], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ((analysis && analysis.title) || 'video_script').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Film size={28} color="var(--gold)" />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, letterSpacing: 1, margin: 0, color: 'var(--gold)' }}>AI MUSIC VIDEO DIRECTOR</h1>
        </div>
        <p style={{ color: 'var(--text-dim)', margin: '0 0 12px', fontSize: 14 }}>Lyrics in. Scene-by-scene storyboard out. Local Ollama.</p>
        {health && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, fontFamily: 'var(--font-mono)', color: health.status === 'ok' ? 'var(--teal)' : 'var(--red-tally)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: health.status === 'ok' ? 'var(--teal)' : 'var(--red-tally)', display: 'inline-block' }} />
            {health.status === 'ok' && ('Ollama ready · ' + (health.model || ''))}
            {health.status === 'model_missing' && ('Model missing — ollama pull ' + (health.model || 'llama3.2:3b'))}
            {health.status === 'ollama_unreachable' && 'Ollama unreachable — start from tray'}
            {health.status === 'proxy_down' && 'Proxy down — run start.ps1'}
          </div>
        )}
        <div style={{ height: 1, background: 'var(--hairline)', marginBottom: 24 }} />
        {error && <div style={{ background: 'rgba(225,80,63,0.12)', border: '1px solid var(--red-tally)', color: 'var(--red-tally)', padding: '12px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}
        {stage === 'input' && (
          <InputStage lyrics={lyrics} setLyrics={setLyrics} minutes={minutes} setMinutes={setMinutes} seconds={seconds} setSeconds={setSeconds} mood={mood} setMood={setMood} batchSize={batchSize} setBatchSize={setBatchSize} sceneCount={sceneCount} numBatches={numBatches} handleTimeChange={handleTimeChange} handleGenerate={handleGenerate} />
        )}
        {(stage === 'working' || stage === 'done') && (
          <ReviewStage stage={stage} analysis={analysis} scenes={scenes} selectedIndex={selectedIndex} setSelectedIndex={setSelectedIndex} statusLine={statusLine} regeneratingIndex={regeneratingIndex} sceneCount={sceneCount} totalSeconds={totalSeconds} handleRegenerateScene={handleRegenerateScene} setShowExport={setShowExport} handleStartNew={handleStartNew} />
        )}
        {showExport && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 12, maxWidth: 640, width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--hairline)' }}>
                <strong style={{ color: 'var(--gold)' }}>Export Script</strong>
                <button type="button" onClick={() => setShowExport(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <pre style={{ margin: 0, padding: 16, overflow: 'auto', flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'pre-wrap' }}>{buildExportText()}</pre>
              <div style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid var(--hairline)' }}>
                <button type="button" onClick={handleCopy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid var(--hairline)', borderRadius: 8, color: 'var(--text)', padding: '9px 14px', cursor: 'pointer' }}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}</button>
                <button type="button" onClick={handleDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--gold)', color: '#141318', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, cursor: 'pointer' }}><Download size={15} /> Download .txt</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
