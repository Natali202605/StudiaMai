export const PUBLIC_CONFIG_KEYS = ['notificationEmail'];

const SECRET_KEYS = [
  'githubToken',
  'telegramBotToken',
  'telegramChatId',
  'web3formsAccessKey',
  'bookingsApiUrl'
];

export function consentIsTrue(value) {
  return value === true;
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return '+7' + digits.slice(1);
  if (digits.length === 10) return '+7' + digits;
  return '';
}

export function publicConfig(config) {
  const out = {};
  const source = config && typeof config === 'object' ? config : {};
  PUBLIC_CONFIG_KEYS.forEach((key) => {
    if (typeof source[key] === 'string' && source[key].trim()) out[key] = source[key].trim();
  });
  return out;
}

export function configHasSecretKey(config) {
  const source = config && typeof config === 'object' ? config : {};
  return SECRET_KEYS.some((key) => Object.prototype.hasOwnProperty.call(source, key) && source[key]);
}

export function isPrivateRequestPath(urlPath) {
  const value = decodeURIComponent(String(urlPath || '')).replace(/\\/g, '/').toLowerCase();
  return (
    value.includes('..')
    || value.includes('/.env')
    || value.endsWith('.env')
    || value.includes('/server/')
    || value.startsWith('/server')
    || value.includes('db.json')
    || value.includes('/.git')
    || value.includes('backup')
    || value.includes('/node_modules/')
    || value.includes('/docs/')
  );
}

export function validateBooking(body) {
  const source = body && typeof body === 'object' ? body : {};
  if (!consentIsTrue(source.consent)) return { ok: false, status: 400, error: 'Нужно согласие на обработку данных' };
  const name = String(source.name || '').trim().slice(0, 80);
  const phone = normalizePhone(source.phone);
  if (!name || !phone) return { ok: false, status: 400, error: 'Укажите имя и телефон' };
  return {
    ok: true,
    booking: {
      name,
      surname: String(source.surname || '').trim().slice(0, 80),
      phone,
      email: String(source.email || '').trim().slice(0, 120),
      comment: String(source.comment || '').trim().slice(0, 1000),
      consent: true
    }
  };
}
