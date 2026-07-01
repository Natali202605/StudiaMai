import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'studia-mai-dev-secret-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'mai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mai2026';

const DEFAULT_PROCEDURES = [
  { id: 'p1', category: 'Брови / Броволог', name: 'SMART-коррекция бровей', price: 'от 1 500 ₽', duration: '1 час' },
  { id: 'p2', category: 'Брови / Броволог', name: 'Моделирование и восстановление бровей', price: 'от 2 000 ₽', duration: '1 час 30 мин' },
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
  service_brows: 'images/browi-resnitsy.png',
  service_cosmetology: 'images/kosmetologiya.png',
  service_massage: 'images/massazh.png',
  service_trichology: 'images/volosy.png',
  service_depilation: 'images/massazh.png',
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
  return db;
}

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const db = normalizeDb({
      user: { username: ADMIN_USERNAME, passwordHash: hash },
      setupComplete: true,
      content: {},
      images: { ...DEFAULT_IMAGES },
      procedures: [...DEFAULT_PROCEDURES],
      leads: [],
      bookings: []
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
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/admin', express.static(path.join(ROOT, 'admin')));
app.use(express.static(ROOT));

app.get('/api/auth/status', (_req, res) => {
  res.json({
    setupComplete: Boolean(db.setupComplete),
    hasUser: Boolean(db.user?.username)
  });
});

app.get('/api/auth/session', authMiddleware, (req, res) => {
  res.json({ ok: true, username: req.user.username });
});

app.post('/api/auth/register', (req, res) => {
  if (db.setupComplete) {
    return res.status(403).json({ error: 'Регистрация уже выполнена. Войдите или смените данные в настройках.' });
  }
  const { username, password, passwordConfirm } = req.body || {};
  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (password !== passwordConfirm) {
    return res.status(400).json({ error: 'Пароли не совпадают' });
  }
  const cleanUsername = String(username).trim();
  db.user = { username: cleanUsername, passwordHash: bcrypt.hashSync(password, 10) };
  db.setupComplete = true;
  saveDb(db);
  const token = jwt.sign({ role: 'admin', username: cleanUsername }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, username: cleanUsername });
});

app.post('/api/auth/login', (req, res) => {
  if (!db.user?.username) {
    return res.status(403).json({ error: 'Сначала зарегистрируйте логин и пароль администратора' });
  }
  const { username, password } = req.body || {};
  const cleanUsername = String(username || '').trim();
  if (cleanUsername !== db.user.username || !bcrypt.compareSync(password || '', db.user.passwordHash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ role: 'admin', username: cleanUsername }, JWT_SECRET, { expiresIn: '12h' });
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

app.post('/api/images/:key', authMiddleware, upload.single('file'), (req, res) => {
  const key = req.params.key;
  if (!DEFAULT_IMAGES[key] && !db.images[key]) {
    return res.status(400).json({ error: 'Неизвестный ключ изображения' });
  }
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  db.images[key] = `/uploads/${req.file.filename}`;
  saveDb(db);
  res.json({ images: db.images });
});

app.post('/api/leads', (req, res) => {
  const { name, surname, phone, email, consent } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'Укажите имя и телефон' });
  }
  const lead = {
    id: `l${Date.now()}`,
    name: String(name).trim(),
    surname: String(surname || '').trim(),
    phone: String(phone).trim(),
    email: String(email || '').trim(),
    consent: Boolean(consent),
    createdAt: new Date().toISOString(),
    status: 'new'
  };
  db.leads.unshift(lead);
  saveDb(db);
  res.json({ ok: true, lead });
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
  const { name, surname, phone, email, procedureId, procedureName, preferredDate, consent, comment } = req.body || {};
  if (!name || !phone) {
    return res.status(400).json({ error: 'Укажите имя и телефон' });
  }
  const procedure = procedureId ? db.procedures.find(p => p.id === procedureId) : null;
  const booking = {
    id: `b${Date.now()}`,
    name: String(name).trim(),
    surname: String(surname || '').trim(),
    phone: String(phone).trim(),
    email: String(email || '').trim(),
    procedureId: procedureId || '',
    procedureName: procedureName || procedure?.name || '',
    category: procedure?.category || '',
    preferredDate: preferredDate || '',
    comment: String(comment || '').trim(),
    consent: Boolean(consent),
    createdAt: new Date().toISOString(),
    status: 'new'
  };
  db.bookings.unshift(booking);
  const lead = {
    id: `l${Date.now()}`,
    name: booking.name,
    surname: booking.surname,
    phone: booking.phone,
    email: booking.email,
    consent: booking.consent,
    createdAt: booking.createdAt,
    status: 'new',
    source: 'booking',
    bookingId: booking.id
  };
  db.leads.unshift(lead);
  saveDb(db);
  res.json({ ok: true, booking });
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
  res.json({ reviews: db.userReviews || [] });
});

app.post('/api/reviews', (req, res) => {
  const { author, text } = req.body || {};
  const cleanAuthor = String(author || '').trim();
  const cleanText = String(text || '').trim();
  if (!cleanAuthor || !cleanText) {
    return res.status(400).json({ error: 'Укажите имя и текст отзыва' });
  }
  if (cleanText.length > 2000) {
    return res.status(400).json({ error: 'Отзыв слишком длинный' });
  }
  const review = {
    id: `r${Date.now()}`,
    author: cleanAuthor,
    text: cleanText,
    date: formatReviewDate(),
    createdAt: new Date().toISOString()
  };
  if (!db.userReviews) db.userReviews = [];
  db.userReviews.unshift(review);
  saveDb(db);
  res.json({ ok: true, review });
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
  console.log(`Студия «Май» — сервер: http://localhost:${PORT}`);
  console.log(`Админ-панель: http://localhost:${PORT}/admin`);
  if (!db.setupComplete) {
    console.log('Первый вход: зарегистрируйте логин и пароль на странице входа.');
  } else {
    console.log(`Администратор: ${db.user.username}`);
  }
});
