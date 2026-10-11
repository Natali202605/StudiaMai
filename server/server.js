import express from 'express';
import { validateCallbackRequest } from './intake-policy.mjs';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const BLOCKED_SECRET_HASHES = new Set([
  '2a829bd30bf504edc68e1b4b4bedcf79febe92bf3f6d73be83cc324310b0dafe',
  '33bb5de28e42e0122c0fc4b2677ef6c5b60da5456949695094b70a758d4f9d2a',
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  '057ba03d6c44104863dc7361fe4578965d1887360f90a0895882e58a6248fc86'
]);

function isBlockedSecret(value) {
  const hash = crypto.createHash('sha256').update(String(value)).digest('hex');
  return BLOCKED_SECRET_HASHES.has(hash);
}

function assertRuntimeSecrets() {
  if (JWT_SECRET.length < 32 || isBlockedSecret(JWT_SECRET)) {
    console.error('Сервер не запущен: задайте JWT_SECRET длиной от 32 символов в окружении, не в репозитории.');
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 12 || isBlockedSecret(ADMIN_PASSWORD)) {
    console.error('Сервер не запущен: задайте ADMIN_PASSWORD длиной от 12 символов в окружении. Первый администратор создаётся только этой служебной переменной.');
    process.exit(1);
  }
}

const DEFAULT_PROCEDURES = [
  { id: 'p1', category: 'Брови / Броволог', name: 'SMART-коррекция бровей', price: 'от 1 500 ₽', duration: '1 час' },
  { id: 'p2', category: 'Брови / Броволог', name: 'Моделирование и SMART-коррекция бровей', price: 'от 2 000 ₽', duration: '1 час 30 мин' },
  { id: 'p3', category: 'Брови / Броволог', name: 'Ламинирование ресниц', price: 'от 1 700 ₽', duration: '1 час 30 мин' },
  { id: 'p4', category: 'Брови / Броволог', name: 'КОМБО «Брови + Ресницы»', price: 'от 3 200 ₽', duration: '2 часа 30 мин' },
  { id: 'p5', category: 'Косметология', name: 'Консультация косметолога', price: 'от 0 ₽', duration: '30 мин' },
  { id: 'p6', category: 'Косметология', name: 'Ультразвуковая чистка лица', price: 'от 1 500 ₽', duration: '1 час' },
  { id: 'p7', category: 'Косметология', name: 'Комбинированная / механическая чистка лица', price: 'от 2 000 ₽', duration: '1 час 30 мин' },
  { id: 'p8', category: 'Массажи лица', name: 'Классический массаж лица', price: 'от 1 500 ₽', duration: '1 час' },
  { id: 'p9', category: 'Массажи лица', name: 'Лимфодренажный массаж лица', price: 'от 1 500 ₽', duration: '1 час' },
  { id: 'p10', category: 'Женская депиляция', name: 'Депиляция воском', price: 'от 500 ₽', duration: '30 мин' },
  { id: 'p11', category: 'Женская депиляция', name: 'Шугаринг', price: 'от 600 ₽', duration: '30 мин' },
  { id: 'p12', category: 'Ритуалы ухода', name: 'Ритуал ухода за лицом', price: 'от 2 500 ₽', duration: '1 час 30 мин' }
];

const DEFAULT_IMAGES = {
  logo: 'images/logo.png',
  hero_logo: 'images/logo.png',
  hero_studio: 'images/hero-studio.png',
  service_brows: 'images/browi-resnitsy.jpg?v=lite1',
  service_cosmetology: 'images/procedury.jpg',
  service_massage: 'images/massazh.jpg?v=lite1',
  service_trichology: 'images/volosy.jpg?v=lite1',
  service_depilation: 'images/nogi.jpg?v=lite1',
  master_portrait: 'images/galina-portret.png',
  master_card: 'images/galina-bolotova.png',
  master_certificates: 'images/sertifikaty.png'
};

function ensureDirs() {
  [DATA_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function normalizeDb(raw) {
  const db = { ...raw };
  if (db.setupComplete === undefined) {
    db.setupComplete = Boolean(db.user?.username && db.user?.passwordHash);
  }
  if (!db.user) db.user = null;
  if (!Array.isArray(db.leads)) db.leads = [];
  if (!Array.isArray(db.bookings)) db.bookings = [];
  if (!Array.isArray(db.userReviews)) db.userReviews = [];
  if (!db.content) db.content = {};
  if (!db.images) db.images = { ...DEFAULT_IMAGES };
  if (!db.procedures) db.procedures = [...DEFAULT_PROCEDURES];
  if (db.user && !db.user.passwordHash && db.user.password) {
    db.user.passwordHash = bcrypt.hashSync(String(db.user.password), 10);
    delete db.user.password;
    db.setupComplete = true;
  }
  return db;
}

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
    const db = normalizeDb({
      user: { username: process.env.ADMIN_USERNAME || 'admin', passwordHash: hash },
      setupComplete: true,
      content: {},
      images: { ...DEFAULT_IMAGES },
      procedures: [...DEFAULT_PROCEDURES],
      leads: [],
      bookings: [],
      sessions: []
    });
    saveDb(db);
    return db;
  }
  return normalizeDb(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
}

function validateUsername(username) {
  const value = String(username || '').trim();
  if (value.length < 3) return 'Логин — минимум 3 символа';
  if (value.length > 64) return 'Логин — не более 64 символов';
  return null;
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 6) return 'Пароль — минимум 6 символов';
  if (value.length > 128) return 'Пароль — не более 128 символов';
  return null;
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

assertRuntimeSecrets();
let db = loadDb();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

const app = express();
const allowedOrigins = String(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const attempts = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = (attempts.get(key) || []).filter(ts => now - ts < windowMs);
  bucket.push(now);
  attempts.set(key, bucket);
  return bucket.length <= limit;
}

app.use((req, res, next) => {
  const target = decodeURIComponent(req.path || '');
  if (/(^|\/)(\.env|server|backup|db\.json|\.git)(\/|$)/i.test(target)) {
    return res.status(404).end();
  }
  next();
});

app.use('/css', express.static(path.join(ROOT, 'css')));
app.use('/js', express.static(path.join(ROOT, 'js')));
app.use('/images', express.static(path.join(ROOT, 'images')));
app.use('/admin', express.static(path.join(ROOT, 'admin')));
app.get(/^\/data\/(content|services|images|theme|version|intake|config)\.json$/, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, req.path));
});
['/', '/index.html', '/privacy.html', '/personal-data-consent.html', '/public-offer.html'].forEach((route) => {
  app.get(route, (_req, res) => {
    const file = route === '/' ? 'index.html' : route.slice(1);
    res.sendFile(path.join(ROOT, file));
  });
});

app.get('/api/auth/status', (_req, res) => {
  res.json({
    setupComplete: Boolean(db.setupComplete),
    hasUser: Boolean(db.user?.username)
  });
});

app.get('/api/auth/session', authMiddleware, (req, res) => {
  res.json({ ok: true, username: req.user.username });
});

app.post('/api/auth/register', (_req, res) => {
  return res.status(403).json({ error: 'Открытая регистрация администратора отключена' });
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'local';
  if (!rateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много попыток входа' });
  }
  const origin = req.get('origin');
  const allowed = String(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && allowed.length && !allowed.includes(origin)) {
    return res.status(403).json({ error: 'Источник запроса не разрешён' });
  }
  if (!db.user?.username || !db.user?.passwordHash) {
    return res.status(403).json({ error: 'Администратор не создан' });
  }
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim();
  const passwordOk = bcrypt.compareSync(String(password || ''), db.user.passwordHash);
  if (cleanUsername !== db.user.username || !passwordOk) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ role: 'admin', username: cleanUsername, sid: Date.now() }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, username: cleanUsername });
});

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword, newUsername } = req.body || {};
  if (!bcrypt.compareSync(currentPassword || '', db.user.passwordHash)) {
    return res.status(400).json({ error: 'Текущий пароль неверен' });
  }
  if (newUsername) {
    const usernameError = validateUsername(newUsername);
    if (usernameError) return res.status(400).json({ error: usernameError });
    db.user.username = String(newUsername).trim();
  }
  if (newPassword) {
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });
    db.user.passwordHash = bcrypt.hashSync(newPassword, 10);
  }
  if (!newUsername && !newPassword) {
    return res.status(400).json({ error: 'Укажите новый логин и/или новый пароль' });
  }
  saveDb(db);
  res.json({ ok: true, username: db.user.username });
});

app.get('/api/content', (_req, res) => {
  res.json({ content: db.content, images: db.images });
});

app.put('/api/content', authMiddleware, (req, res) => {
  db.content = { ...db.content, ...(req.body.content || {}) };
  saveDb(db);
  res.json({ content: db.content });
});

app.get('/api/procedures', (_req, res) => {
  res.json({ procedures: db.procedures });
});

app.put('/api/procedures', authMiddleware, (req, res) => {
  if (!Array.isArray(req.body.procedures)) {
    return res.status(400).json({ error: 'Некорректный список процедур' });
  }
  db.procedures = req.body.procedures;
  saveDb(db);
  res.json({ procedures: db.procedures });
});

const IMAGE_SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }
];

app.post('/api/images/:key', authMiddleware, upload.single('file'), (req, res) => {
  const key = req.params.key;
  if (!DEFAULT_IMAGES[key] && !db.images[key]) {
    return res.status(400).json({ error: 'Неизвестный ключ изображения' });
  }
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const sample = fs.readFileSync(req.file.path);
  const allowed = IMAGE_SIGNATURES.some(sig => sig.bytes.every((byte, i) => sample[i] === byte));
  const name = req.file.originalname.toLowerCase();
  if (!allowed || name.endsWith('.svg') || name.endsWith('.html') || name.endsWith('.htm')) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Допустимы только JPEG, PNG и WEBP' });
  }
  db.images[key] = `/uploads/${req.file.filename}`;
  saveDb(db);
  res.json({ images: db.images });
});

app.post('/api/leads', (req, res) => {
  const decision = validateCallbackRequest(req.body, false);
  return res.status(decision.status || 403).json({ ok: false, error: decision.error || 'Приём заявок выключен' });
});

app.get('/api/leads', authMiddleware, (_req, res) => {
  res.json({ leads: db.leads });
});

app.patch('/api/leads/:id', authMiddleware, (req, res) => {
  const lead = db.leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Заявка не найдена' });
  if (req.body.status) lead.status = req.body.status;
  saveDb(db);
  res.json({ lead });
});

app.post('/api/bookings', (req, res) => {
  if (!rateLimit(`booking:${req.ip || 'local'}`, 5, 60 * 60 * 1000)) {
    return res.status(429).json({ ok: false, error: 'Слишком много заявок. Позвоните в студию.' });
  }
  const decision = validateCallbackRequest(req.body, false);
  if (!decision.ok) {
    return res.status(decision.status).json({ ok: false, error: decision.error });
  }
  return res.status(403).json({ ok: false, error: 'Приём заявок выключен до отдельного включения оператором' });
});

app.get('/api/bookings', authMiddleware, (_req, res) => {
  res.json({ bookings: db.bookings });
});

app.patch('/api/bookings/:id', authMiddleware, (req, res) => {
  const booking = db.bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (req.body.status) booking.status = req.body.status;
  saveDb(db);
  res.json({ booking });
});

function formatReviewDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

app.get('/api/reviews', (_req, res) => {
  res.json({ reviews: [] });
});

app.post('/api/reviews', (_req, res) => {
  return res.status(403).json({ ok: false, error: 'Публикация отзыва без модерации отключена' });
});

app.get('/api/stats', authMiddleware, (_req, res) => {
  res.json({
    leadsNew: db.leads.filter(l => l.status === 'new').length,
    bookingsNew: db.bookings.filter(b => b.status === 'new').length,
    leadsTotal: db.leads.length,
    bookingsTotal: db.bookings.length
  });
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'index.html'));
});

ensureDirs();
app.listen(PORT, () => {
  console.log(`Студия «Май» — сервер слушает порт ${PORT}`);
});
