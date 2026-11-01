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
import {
  addPublishedReview,
  buildReviewYandexValues,
  deletePublishedReview,
  listPublicReviews
} from './reviews-store.mjs';

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
      const body = { ok: true };
      if (result.answerKey) body.answerKey = result.answerKey;
      return res.json(body);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.status).json({ ok: false, error: result.error });
  } catch {
    return res.status(502).json({ ok: false, error: 'submit' });
  }
}

app.post('/api/yandex-form.php', yandexHandler);
app.post('/api/yandex-form', yandexHandler);

app.get('/api/reviews', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ reviews: listPublicReviews(ROOT) });
});

app.post('/api/reviews/submit', async (req, res) => {
  if (!isAllowedRequest(req)) {
    return res.status(403).json({ ok: false, error: 'origin' });
  }
  const ip = req.ip || req.socket?.remoteAddress || '0';
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }
  const text = String(req.body?.text || '').trim();
  const clientId = String(req.body?.id || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'text' });

  const yandexResult = await handleYandexFormSubmit({
    form: 'review',
    values: buildReviewYandexValues(text),
    parent: String(req.body?.parent || req.headers.referer || 'https://studia-mai.ru/'),
    startedAt: req.body?.startedAt || Date.now()
  });
  if (!yandexResult.ok) {
    return res.status(yandexResult.status || 502).json({ ok: false, error: yandexResult.error || 'yandex' });
  }

  const saved = addPublishedReview(ROOT, {
    id: clientId || undefined,
    text,
    date: req.body?.date,
    yandexAnswerKey: yandexResult.answerKey
  });
  if (!saved.ok) {
    return res.status(400).json({ ok: false, error: saved.error || 'save' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok: true,
    review: saved.review,
    deleteToken: saved.deleteToken
  });
});

app.delete('/api/reviews/:id', (req, res) => {
  if (!isAllowedRequest(req)) {
    return res.status(403).json({ ok: false, error: 'origin' });
  }
  const ip = req.ip || req.socket?.remoteAddress || '0';
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }
  const result = deletePublishedReview(ROOT, req.params.id, {
    deleteToken: req.headers['x-review-delete-token'],
    adminKey: req.headers['x-reviews-admin-key']
  });
  if (!result.ok) {
    return res.status(result.status || 400).json({ ok: false, error: result.error });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok: true,
    yandexAnswerKey: result.yandexAnswerKey,
    yandexSurveyId: result.surveyId,
    yandexHint:
      'Удалите ответ в кабинете Яндекс.Форм по ключу answer_key, если требуется снять данные у оператора формы.'
  });
});

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
