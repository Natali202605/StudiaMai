/**
 * Timeweb App Platform (Node.js): статика dist/ + POST /api/yandex-form(.php)
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleYandexFormSubmit,
  isAllowedRequest,
  rateLimitOk
} from './yandex-gateway.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;

const BLOCKED_PREFIXES = [
  '/server',
  '/backend',
  '/ops',
  '/docs',
  '/operator-docs',
  '/operator-ops'
];

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const p = req.path;
  if (BLOCKED_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
    return res.status(404).end();
  }
  next();
});

async function yandexHandler(req, res) {
  if (!isAllowedRequest(req)) {
    return res.status(403).json({ ok: false, error: 'origin' });
  }
  const ip = req.ip || req.socket?.remoteAddress || '0';
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }
  try {
    const result = await handleYandexFormSubmit(req.body);
    if (result.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ ok: true });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.status).json({ ok: false, error: result.error });
  } catch {
    return res.status(502).json({ ok: false, error: 'submit' });
  }
}

app.post('/api/yandex-form.php', yandexHandler);
app.post('/api/yandex-form', yandexHandler);

app.use(
  express.static(ROOT, {
    index: 'index.html',
    dotfiles: 'deny',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.php')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    }
  })
);

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`studia-mai listening on ${PORT}`);
});
