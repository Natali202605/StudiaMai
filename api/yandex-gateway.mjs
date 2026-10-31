/**
 * Серверная отправка в Яндекс.Формы (gateway postSurvey).
 * ПДн не логируются; whitelist полей и survey id.
 */

const YANDEX_GATEWAY = 'https://forms.yandex.ru/u/gateway/root/form/postSurvey';

const ALLOWED_HOSTS = new Set(['studia-mai.ru', 'www.studia-mai.ru', 'localhost', '127.0.0.1']);

export const SURVEYS = {
  booking: {
    id: '6ad643dd852af364ddc7a26c',
    page: 'https://forms.yandex.ru/u/6ad643dd852af364ddc7a26c/',
    fields: {
      answer_short_text_9008991681738688: 200,
      answer_short_text_9008991681800748: 200,
      answer_short_text_9008991681939734: 40,
      answer_short_text_9008991681974672: 2000,
      answer_boolean_9008991682017890: 0
    }
  },
  review: {
    id: '6ad64997c45c0750253c7ad8',
    page: 'https://forms.yandex.ru/u/6ad64997c45c0750253c7ad8/?iframe=1',
    fields: {
      answer_long_text_96199: 4000,
      answer_short_text_9008991683293520: 8000
    }
  }
};

const rateBuckets = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;

export function isAllowedRequest(req) {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return true;
  const origin = req.headers.origin || '';
  if (origin === 'https://studia-mai.ru' || origin === 'https://www.studia-mai.ru') return true;
  const ref = req.headers.referer || '';
  return ref.startsWith('https://studia-mai.ru') || ref.startsWith('https://www.studia-mai.ru');
}

export function rateLimitOk(ip) {
  const key = ip.replace(/[^0-9a-fA-F:.]/g, '') || '0';
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 };
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= RATE_MAX;
}

function sanitizeValues(incoming, schema) {
  if (!incoming || typeof incoming !== 'object') return null;
  const keys = Object.keys(schema);
  for (const k of Object.keys(incoming)) {
    if (!keys.includes(k)) return null;
  }
  const out = {};
  for (const [field, maxLen] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(incoming, field)) return null;
    const v = incoming[field];
    if (maxLen === 0) {
      out[field] = v === true || v === 'true' || v === 1 || v === '1';
      continue;
    }
    if (typeof v !== 'string' && typeof v !== 'number') return null;
    let s = String(v).trim();
    if (maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
    out[field] = s;
  }
  return out;
}

function normalizeStartedAt(value) {
  const now = Date.now();
  if (value == null || value === '') return now;
  const t = Number(value);
  if (!Number.isFinite(t) || t < 1_000_000_000_000) return now;
  if (t > now + 300_000) return now;
  if (t < now - 86_400_000) return now;
  return Math.floor(t);
}

function sanitizeParent(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const clipped = s.length > 512 ? s.slice(0, 512) : s;
  if (!/^https:\/\/([a-z0-9.-]*\.)?studia-mai\.ru\//i.test(clipped)) {
    return 'https://studia-mai.ru/';
  }
  return clipped;
}

function parseCsrf(html) {
  const m = html.match(/"csrfToken":"([^"]+)"/);
  return m ? m[1] : null;
}

function parseCsrfCookie(setCookieHeaders) {
  const list = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const line of list) {
    const m = String(line).match(/CSRF-TOKEN=([^;]+)/);
    if (m) return `CSRF-TOKEN=${m[1]}`;
  }
  return '';
}

async function yandexSession(pageUrl) {
  const res = await fetch(pageUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'StudiaMaiFormProxy/1.0 (+https://studia-mai.ru/)'
    },
    redirect: 'follow'
  });
  if (!res.ok) return null;
  const html = await res.text();
  const csrf = parseCsrf(html);
  if (!csrf) return null;
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie')]
        : [];
  let cookie = parseCsrfCookie(setCookies);
  if (!cookie) cookie = `CSRF-TOKEN=${encodeURIComponent(csrf)}`;
  return { csrf, cookie };
}

async function postSurvey(session, surveyId, pageUrl, body) {
  const startedAt = body.startedAt;
  const res = await fetch(YANDEX_GATEWAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRF-Token': session.csrf,
      'x-form-referer': pageUrl,
      'x-form-started-at': String(startedAt),
      'x-survey-id': surveyId,
      Cookie: session.cookie
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: res.status, parsed };
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
export async function handleYandexFormSubmit(reqBody) {
  const formKey = String(reqBody?.form || '');
  const config = SURVEYS[formKey];
  if (!config) return { ok: false, status: 400, error: 'form' };

  const values = sanitizeValues(reqBody.values, config.fields);
  if (!values) return { ok: false, status: 400, error: 'values' };

  const startedAt = normalizeStartedAt(reqBody.startedAt);
  const parent = sanitizeParent(reqBody.parent);

  const session = await yandexSession(config.page);
  if (!session) return { ok: false, status: 502, error: 'upstream' };

  const payload = {
    surveyId: config.id,
    values,
    parent,
    startedAt
  };

  const result = await postSurvey(session, config.id, config.page, payload);
  if (result.status >= 200 && result.status < 300 && result.parsed?.answer_key) {
    return { ok: true };
  }
  return { ok: false, status: 502, error: 'yandex' };
}
