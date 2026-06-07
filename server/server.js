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
  { id: 'p1', category: 'Брови / броволог', name: 'SMART-коррекция бровей', price: 'от 1 500 ₽', duration: '1 час' },
  { id: 'p2', category: 'Брови / броволог', name: 'Моделирование и восстановление бровей', price: 'от 2 000 ₽', duration: '1 час 30 мин' },
  { id: 'p3', category: 'Брови / броволог', name: 'Ламинирование ресниц', price: 'от 1 700 ₽', duration: '1 час 30 мин' },
  { id: 'p4', category: 'Брови / броволог', name: 'КОМБО «Брови + Ресницы»', price: 'от 3 200 ₽', duration: '2 часа 30 мин' },
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

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const db = {
      user: { username: ADMIN_USERNAME, passwordHash: hash },
      content: {},
      images: { ...DEFAULT_IMAGES },
      procedures: [...DEFAULT_PROCEDURES],
      leads: [],
      bookings: []
    };
    saveDb(db);
    return db;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
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

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== db.user.username || !bcrypt.compareSync(password || '', db.user.passwordHash)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ role: 'admin', username }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, username });
});

app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!bcrypt.compareSync(currentPassword || '', db.user.passwordHash)) {
    return res.status(400).json({ error: 'Текущий пароль неверен' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Новый пароль — минимум 6 символов' });
  }
  db.user.passwordHash = bcrypt.hashSync(newPassword, 10);
  saveDb(db);
  res.json({ ok: true });
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
  console.log(`Логин: ${ADMIN_USERNAME} / Пароль: ${ADMIN_PASSWORD}`);
});
