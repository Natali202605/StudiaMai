/** Правила приёма заявки на обратный звонок. Приём по умолчанию выключен. */

export const CONSENT_VERSION = 'draft-2026-10-11';
export const POLICY_VERSION = 'draft-2026-10-11';

export const PUBLIC_CONFIG_KEYS = ['intakeEnabled'];

const SECRET_CONFIG_KEYS = [
  'githubToken',
  'telegramBotToken',
  'telegramChatId',
  'web3formsAccessKey',
  'bookingsApiUrl',
  'notificationEmail'
];

export function consentIsTrue(value) {
  return value === true;
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+7${digits}`;
  return '';
}

export function publicConfig(config) {
  const out = {};
  const source = config && typeof config === 'object' ? config : {};
  PUBLIC_CONFIG_KEYS.forEach((key) => {
    if (source[key] === true || source[key] === false) out[key] = source[key];
  });
  return out;
}

export function configHasSecretKey(config) {
  const source = config && typeof config === 'object' ? config : {};
  return SECRET_CONFIG_KEYS.some((key) => {
    const value = source[key];
    return value != null && String(value).trim() !== '';
  });
}

export function validateCallbackRequest(body, intakeEnabled) {
  if (intakeEnabled !== true) {
    return { ok: false, status: 403, error: 'Приём заявок выключен' };
  }
  const input = body && typeof body === 'object' ? body : {};
  if (!consentIsTrue(input.consent)) {
    return { ok: false, status: 400, error: 'Нужно отдельное согласие' };
  }
  if (input.consentVersion !== CONSENT_VERSION) {
    return { ok: false, status: 400, error: 'Неизвестная версия согласия' };
  }
  if (input.policyVersion !== POLICY_VERSION) {
    return { ok: false, status: 400, error: 'Неизвестная версия политики' };
  }
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, status: 400, error: 'Укажите телефон' };
  const name = String(input.name || '').trim().slice(0, 80);
  if (input.surname || input.email || input.comment) {
    return { ok: false, status: 400, error: 'Лишние поля не принимаются' };
  }
  return {
    ok: true,
    record: {
      name,
      phone,
      consent: true,
      consentVersion: CONSENT_VERSION,
      policyVersion: POLICY_VERSION,
      formId: 'callback',
      purpose: 'callback'
    }
  };
}
