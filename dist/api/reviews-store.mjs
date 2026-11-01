import crypto from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const MAX_REVIEWS = 200;
const MAX_TEXT = 4000;

export function reviewsFilePath(rootDir) {
  return process.env.REVIEWS_FILE || join(rootDir, 'data', 'published-reviews.json');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function formatReviewDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

function readRaw(filePath) {
  if (!existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.reviews) ? parsed.reviews : [];
  } catch {
    return [];
  }
}

function writeRaw(filePath, reviews) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ reviews }, null, 2) + '\n', 'utf8');
}

export function toPublicReview(record) {
  return {
    id: record.id,
    author: record.author || 'Клиент',
    text: record.text,
    date: record.date
  };
}

export function listPublicReviews(rootDir) {
  return readRaw(reviewsFilePath(rootDir)).map(toPublicReview);
}

export function addPublishedReview(rootDir, { id, text, date, yandexAnswerKey }) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return { ok: false, error: 'text' };
  if (cleanText.length > MAX_TEXT) return { ok: false, error: 'length' };

  const filePath = reviewsFilePath(rootDir);
  const reviews = readRaw(filePath);
  const reviewId =
    String(id || '').trim() ||
    `r${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  if (reviews.some((item) => item.id === reviewId)) {
    return { ok: false, error: 'duplicate' };
  }

  const deleteToken = crypto.randomBytes(24).toString('hex');
  const record = {
    id: reviewId,
    author: 'Клиент',
    text: cleanText,
    date: date || formatReviewDate(),
    createdAt: new Date().toISOString(),
    yandexAnswerKey: yandexAnswerKey ? String(yandexAnswerKey).slice(0, 120) : null,
    deleteTokenHash: hashToken(deleteToken)
  };

  reviews.unshift(record);
  writeRaw(filePath, reviews.slice(0, MAX_REVIEWS));

  return { ok: true, review: toPublicReview(record), deleteToken };
}

export function deletePublishedReview(rootDir, id, { deleteToken, adminKey }) {
  const reviewId = String(id || '').trim();
  if (!reviewId) return { ok: false, status: 400, error: 'id' };

  const envAdmin = String(process.env.REVIEWS_ADMIN_KEY || '').trim();
  const isAdmin = envAdmin.length >= 8 && adminKey === envAdmin;

  const filePath = reviewsFilePath(rootDir);
  const reviews = readRaw(filePath);
  const index = reviews.findIndex((item) => item.id === reviewId);
  if (index < 0) return { ok: false, status: 404, error: 'not_found' };

  if (!isAdmin) {
    const token = String(deleteToken || '').trim();
    if (!token || hashToken(token) !== reviews[index].deleteTokenHash) {
      return { ok: false, status: 403, error: 'forbidden' };
    }
  }

  const removed = reviews.splice(index, 1)[0];
  writeRaw(filePath, reviews);
  return {
    ok: true,
    yandexAnswerKey: removed.yandexAnswerKey || null,
    surveyId: '6ad64997c45c0750253c7ad8'
  };
}

export function buildReviewYandexValues(text) {
  const cleanText = String(text || '').trim();
  return {
    answer_long_text_96199: 'Клиент',
    answer_short_text_9008991683293520: cleanText
  };
}
