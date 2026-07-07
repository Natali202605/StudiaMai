(function () {
  const API = window.STUDIA_MAI_API;
  const DATA_BASE = window.STUDIA_MAI_DATA_BASE || 'data';
  const STORAGE_CONTENT = 'studia_mai_cms_content';
  const STORAGE_IMAGES = 'studia_mai_cms_images';
  const STORAGE_CONFIG = 'studia_mai_site_config';
  const STORAGE_BOOKINGS = 'studia_mai_bookings_local';
  const DEFAULT_ADMIN_EMAIL = 'brow_studia_may@mail.ru';

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }

  function apiUrl(path) {
    if (!API) return null;
    return `${API}${path}`;
  }

  async function fetchJson(path, options) {
    const url = apiUrl(path);
    if (!url) return null;
    try {
      const res = await fetch(url, options);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function fetchDataJson(file) {
    try {
      const res = await fetch(`${DATA_BASE}/${file}?v=${Date.now()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function mergeObjects(base, override) {
    return { ...(base || {}), ...(override || {}) };
  }

  function readStorageJson(key) {
    const raw = storageGet(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  async function loadSiteConfig() {
    const fromFile = await fetchDataJson('config.json');
    const fromStorage = readStorageJson(STORAGE_CONFIG);
    const merged = mergeObjects(fromFile || {}, fromStorage || {});
    if (!merged.notificationEmail) merged.notificationEmail = DEFAULT_ADMIN_EMAIL;
    return merged;
  }

  async function loadContentData() {
    const fromApi = await fetchJson('/api/content');
    if (fromApi?.content) {
      return { content: fromApi.content, images: fromApi.images || {} };
    }
    const content = mergeObjects(await fetchDataJson('content.json'), readStorageJson(STORAGE_CONTENT));
    const images = mergeObjects(await fetchDataJson('images.json'), readStorageJson(STORAGE_IMAGES));
    return { content, images };
  }

  function applyContent(content) {
    if (!content) return;
    document.querySelectorAll('[data-cms]').forEach(el => {
      const key = el.dataset.cms;
      if (content[key] != null && content[key] !== '') {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = content[key];
        else el.textContent = content[key];
      }
    });
  }

  function applyImages(images) {
    if (!images) return;
    document.querySelectorAll('[data-cms-img]').forEach(el => {
      const key = el.dataset.cmsImg;
      if (images[key] === '__removed__') {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      if (images[key]) {
        const src = images[key].startsWith('/') && API ? API + images[key] : images[key];
        el.src = src;
      }
    });
  }

  async function loadCms() {
    const data = await loadContentData();
    applyContent(data.content);
    applyImages(data.images);
  }

  function getFormData(form) {
    const fd = new FormData(form);
    return {
      name: fd.get('name')?.trim() || '',
      surname: fd.get('surname')?.trim() || '',
      phone: fd.get('phone')?.trim() || '',
      email: fd.get('email')?.trim() || '',
      consent: form.querySelector('[name="pd_consent"]')?.checked || false,
      comment: form.querySelector('#bookingComment')?.value?.trim() || ''
    };
  }

  function showFormMessage(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.className = 'booking-form__message' + (ok ? ' booking-form__message--ok' : ' booking-form__message--err');
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 6000);
  }

  function formatBookingMessage(booking) {
    return [
      'Новая заявка — Студия «Май»',
      `Имя: ${booking.name}${booking.surname ? ' ' + booking.surname : ''}`,
      `Телефон: ${booking.phone}`,
      booking.email ? `Email: ${booking.email}` : '',
      booking.comment ? `Комментарий: ${booking.comment}` : '',
      `Дата: ${new Date(booking.createdAt).toLocaleString('ru-RU')}`
    ].filter(Boolean).join('\n');
  }

  function readLocalBookings() {
    return readStorageJson(STORAGE_BOOKINGS) || [];
  }

  function saveLocalBookings(bookings) {
    storageSet(STORAGE_BOOKINGS, JSON.stringify(bookings));
  }

  function appendLocalBooking(booking) {
    const list = readLocalBookings();
    list.unshift(booking);
    saveLocalBookings(list.slice(0, 200));
  }

  async function notifyEmail(config, subject, message) {
    const email = config.notificationEmail || DEFAULT_ADMIN_EMAIL;
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: subject,
          _captcha: 'false',
          message
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function notifyWeb3Forms(config, booking) {
    if (!config.web3formsAccessKey) return false;
    const body = new FormData();
    body.append('access_key', config.web3formsAccessKey);
    body.append('subject', 'Новая заявка — Студия «Май»');
    body.append('name', `${booking.name} ${booking.surname}`.trim());
    body.append('phone', booking.phone);
    body.append('email', booking.email || 'не указан');
    body.append('message', formatBookingMessage(booking));
    if (config.notificationEmail) body.append('replyto', config.notificationEmail);
    const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    return res.ok && json.success;
  }

  async function notifyTelegram(config, booking) {
    if (!config.telegramBotToken || !config.telegramChatId) return false;
    const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: formatBookingMessage(booking)
      })
    });
    return res.ok;
  }

  async function saveBookingRemote(config, booking) {
    if (!config.bookingsApiUrl) return false;
    const res = await fetch(config.bookingsApiUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking)
    });
    return res.ok;
  }

  async function submitBooking(form, msgEl) {
    const data = getFormData(form);

    if (!data.name || !data.phone) {
      showFormMessage(msgEl, 'Заполните имя и телефон', false);
      return;
    }
    if (!data.consent) {
      showFormMessage(msgEl, 'Подтвердите согласие на обработку данных', false);
      return;
    }

    const url = apiUrl('/api/bookings');
    if (url) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        showFormMessage(msgEl, 'Заявка на запись отправлена! Мы свяжемся для подтверждения.', true);
        form.reset();
        return;
      }
      showFormMessage(msgEl, json.error || 'Не удалось отправить заявку', false);
      return;
    }

    const booking = {
      id: `b${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      status: 'new',
      source: 'site'
    };

    const config = await loadSiteConfig();
    let delivered = false;

    try {
      if (await notifyEmail(config, 'Новая заявка — Студия «Май»', formatBookingMessage(booking))) {
        delivered = true;
      }
    } catch { /* ignore */ }

    try {
      if (await notifyWeb3Forms(config, booking)) delivered = true;
    } catch { /* ignore */ }

    try {
      if (await notifyTelegram(config, booking)) delivered = true;
    } catch { /* ignore */ }

    try {
      if (await saveBookingRemote(config, booking)) delivered = true;
    } catch { /* ignore */ }

    appendLocalBooking(booking);

    if (delivered || config.notificationEmail || config.web3formsAccessKey || config.telegramBotToken || config.bookingsApiUrl) {
      showFormMessage(msgEl, 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.', true);
      form.reset();
      return;
    }

    showFormMessage(msgEl, 'Заявка сохранена. Администратор увидит её в панели управления.', true);
    form.reset();
  }

  window.StudiaMaiSite = {
    loadCms,
    loadContentData,
    loadSiteConfig,
    applyContent,
    applyImages,
    readLocalBookings,
    saveLocalBookings,
    sendAdminEmail: (subject, message) => notifyEmail({ notificationEmail: DEFAULT_ADMIN_EMAIL }, subject, message),
    DEFAULT_ADMIN_EMAIL,
    STORAGE_CONTENT,
    STORAGE_IMAGES,
    STORAGE_CONFIG,
    STORAGE_BOOKINGS
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadCms();
    const form = document.getElementById('contactForm');
    const msgEl = document.getElementById('bookingMessage');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitBooking(form, msgEl);
    });

    document.getElementById('submitBooking')?.addEventListener('click', (e) => {
      e.preventDefault();
      submitBooking(form, msgEl);
    });
  });
})();
