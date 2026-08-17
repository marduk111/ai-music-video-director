// Shared constants + local LLM helpers for AI Music Video Director
const STYLE_DIRECTIVES = {
  'Cinematic': 'narrative-driven, smooth dolly and crane moves, dramatic chiaroscuro lighting, polished film look',
  'Documentary': 'handheld, observational, natural light, candid framing, grounded realism',
  'High Energy': 'rapid cuts, whip pans, crash zooms, strobing neon, kinetic motion blur',
  'Dreamy / Surreal': 'slow motion, double exposure, floating objects, soft ethereal glow, dream-logic staging',
  'Noir': 'high-contrast black and white, venetian-blind shadows, rain-slicked streets, smoke, moral ambiguity',
  'Vaporwave': 'pastel and neon gradients, glitch artifacts, retro-futurist statuary, VHS scan lines',
  'Anime': 'cel-shaded color, dramatic speed lines, exaggerated expressive close-ups, saturated palette',
  'Minimalist': 'negative space, geometric composition, restrained monochrome palette, still framing',
  'Gothic': 'candlelit cathedrals and castles, deep shadow, desaturated palette with blood-red accents',
  'Cyberpunk': 'neon-drenched dystopian skyline, holographic signage, rain, moody teal-magenta grade',
  'Psychedelic': 'kaleidoscopic color shifts, morphing shapes, double exposure, perception-bending visuals',
  'Horror': 'claustrophobic framing, flashlight-lit dread, jarring cuts, unsettling negative space',
  'Romantic': 'soft focus, golden-hour backlight, intimate close-ups, warm tender color grade',
  'Melancholic': 'muted blue-grey palette, slow deliberate camera drift, rain and empty space',
  'Steampunk': 'brass and copper machinery, airships, Victorian dress, sepia-and-brass color grade',
  'Folk / Acoustic': 'sun-drenched landscapes, handheld intimacy, natural light, unhurried pacing',
};
const MOODS = Object.keys(STYLE_DIRECTIVES);

const PALETTE_FALLBACK = [
  { hex: '#E3B341', reason: '' },
  { hex: '#5FD6C4', reason: '' },
  { hex: '#E1503F', reason: '' },
  { hex: '#9C99A6', reason: '' },
];

const SAMPLE_LYRICS = `[Verse 1]
Harbor lights are drowning in the fog tonight
Every ship a ghost on borrowed tide
I've been reading maps of who I used to be
Folding coastlines into memory

[Chorus]
Hold the wheel, hold the wheel
Steady through the static and the steel
We were never meant to disappear
Hold the wheel till the harbor's clear

[Verse 2]
Radio dissolves to salt and rain
Static hums a half-remembered name
Every lighthouse blinks a different code
Trying to translate the only road

[Chorus]
Hold the wheel, hold the wheel
Steady through the static and the steel
We were never meant to disappear
Hold the wheel till the harbor's clear

[Instrumental]

[Bridge]
Maybe the current always wins
Maybe we drift to where the story begins
Either way I'm holding on to you
Either way the compass points to true

[Chorus]
Hold the wheel, hold the wheel
Steady through the static and the steel
We were never meant to disappear
Hold the wheel till the harbor's clear`;

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

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

function parseJSONLoose(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = cleaned.indexOf('{');
  const firstArr = cleaned.indexOf('[');
  let start = -1;
  if (first === -1) start = firstArr;
  else if (firstArr === -1) start = first;
  else start = Math.min(first, firstArr);
  const slice = start >= 0 ? cleaned.slice(start) : cleaned;
  return JSON.parse(slice);
}

async function callLocalJSON(prompt, attempt = 0) {
  const framed =
    attempt === 0
      ? 'You are a JSON API. Output ONLY valid JSON. No markdown. No explanation.\n\n' + prompt
      : prompt;
  const text = await callLocal(framed);
  try {
    return parseJSONLoose(text);
  } catch {
    if (attempt < 2) {
      return callLocalJSON(
        prompt +
          '\n\nINVALID. Respond with ONLY valid JSON. No markdown fences. No commentary. No extra text.',
        attempt + 1
      );
    }
    throw new Error('Could not parse the AI response as JSON. Try qwen2.5:3b or set OLLAMA_TEMPERATURE=0.4');
  }
}

function frameGradient(i, palette) {
  const colors = palette?.length
    ? palette.map((p) => p.hex)
    : PALETTE_FALLBACK.map((p) => p.hex);
  const c1 = colors[i % colors.length];
  const c2 = colors[(i + 1) % colors.length];
  return `linear-gradient(160deg, ${c1}66 0%, ${c2}22 100%)`;
}

export {
  STYLE_DIRECTIVES,
  MOODS,
  PALETTE_FALLBACK,
  SAMPLE_LYRICS,
  formatTime,
  callLocal,
  parseJSONLoose,
  callLocalJSON,
  frameGradient,
};
