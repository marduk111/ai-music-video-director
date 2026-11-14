import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

const OLLAMA_BASE = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// Tuned for RTX 3050 6GB
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 4096;
const NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT) || 2048;
const TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE) || 0.65;

app.set('trust proxy', 1);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (isDev) {
  allowedOrigins.push(
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '1.5mb' }));

const generateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 80,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Give the GPU a short break.' },
});

app.get('/api/health', async (_req, res) => {
  let ollamaOk = false;
  let models = [];
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) {
      const data = await r.json();
      ollamaOk = true;
      models = (data.models || []).map((m) => m.name);
    }
  } catch {
    /* offline */
  }

  const modelPresent = models.some(
    (n) => n === OLLAMA_MODEL || n.startsWith(OLLAMA_MODEL.split(':')[0])
  );

  res.json({
    status: ollamaOk ? (modelPresent ? 'ok' : 'model_missing') : 'ollama_unreachable',
    ollama: OLLAMA_BASE,
    model: OLLAMA_MODEL,
    modelPresent,
    modelsAvailable: models,
    numCtx: NUM_CTX,
    env: isDev ? 'development' : 'production',
  });
});

app.post('/api/generate', generateLimiter, async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'A non-empty prompt is required.' });
    }
    if (prompt.length > 90_000) {
      return res.status(400).json({ error: 'Prompt too long for local context window.' });
    }

    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: TEMPERATURE,
          num_predict: NUM_PREDICT,
          num_ctx: NUM_CTX,
          top_p: 0.9,
          repeat_penalty: 1.1,
          num_gpu: Number(process.env.OLLAMA_NUM_GPU) || 99,
          num_batch: Number(process.env.OLLAMA_NUM_BATCH) || 512,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[Ollama]', response.status, errText.slice(0, 400));
      return res.status(502).json({
        error: `Ollama error (${response.status}). Is the model pulled? Try: ollama pull ${OLLAMA_MODEL}`,
        detail: errText.slice(0, 250),
      });
    }

    const data = await response.json();
    const text = data?.response ?? null;

    if (!text || !String(text).trim()) {
      return res.status(502).json({ error: 'Ollama returned empty text.' });
    }

    res.json({ text });
  } catch (err) {
    console.error('[Proxy]', err.message);
    const isConn =
      err.cause?.code === 'ECONNREFUSED' ||
      err.message?.includes('fetch failed') ||
      err.message?.includes('ECONNREFUSED');
    res.status(500).json({
      error: isConn
        ? 'Cannot reach Ollama. Start it (system tray) or run: ollama serve'
        : 'Internal proxy error',
    });
  }
});

if (!isDev) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🎬  AI Music Video Director (local / uncensored)`);
  console.log(`    → http://localhost:${PORT}`);
  console.log(`    → Ollama  ${OLLAMA_BASE}`);
  console.log(`    → Model   ${OLLAMA_MODEL}`);
  console.log(`    → ctx=${NUM_CTX}  predict=${NUM_PREDICT}  temp=${TEMPERATURE}`);
  console.log(`    → env     ${isDev ? 'development' : 'production'}\n`);
});
