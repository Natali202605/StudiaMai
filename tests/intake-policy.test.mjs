import assert from 'node:assert/strict';
import { consentIsTrue, normalizePhone, publicConfig, validateCallbackRequest, configHasSecretKey } from '../server/intake-policy.mjs';

assert.equal(consentIsTrue(true), true);
assert.equal(consentIsTrue(false), false);
assert.equal(consentIsTrue('false'), false);
assert.equal(consentIsTrue('true'), false);

const off = validateCallbackRequest({ consent: true, consentVersion: 'draft-2026-10-11', policyVersion: 'draft-2026-10-11', phone: '+7 902 000-00-00' }, false);
assert.equal(off.ok, false);
assert.equal(off.status, 403);

const badConsent = validateCallbackRequest({ consent: 'false', consentVersion: 'draft-2026-10-11', policyVersion: 'draft-2026-10-11', phone: '89020000000' }, true);
assert.equal(badConsent.ok, false);

const badVersion = validateCallbackRequest({ consent: true, consentVersion: 'other', policyVersion: 'draft-2026-10-11', phone: '89020000000' }, true);
assert.equal(badVersion.ok, false);

const extra = validateCallbackRequest({ consent: true, consentVersion: 'draft-2026-10-11', policyVersion: 'draft-2026-10-11', phone: '89020000000', email: 'a@b.c' }, true);
assert.equal(extra.ok, false);

const ok = validateCallbackRequest({ consent: true, consentVersion: 'draft-2026-10-11', policyVersion: 'draft-2026-10-11', phone: '8 (902) 000-00-00', name: 'Анна' }, true);
assert.equal(ok.ok, true);
assert.equal(ok.record.phone, '+79020000000');
assert.equal(ok.record.consent, true);
assert.equal(normalizePhone('123'), '');

const published = publicConfig({ intakeEnabled: false, telegramBotToken: 'secret', githubToken: 'secret' });
assert.deepEqual(published, { intakeEnabled: false });
assert.equal(configHasSecretKey({ telegramBotToken: 'x' }), true);
assert.equal(configHasSecretKey({ intakeEnabled: false }), false);

console.log('intake-policy: ok');
