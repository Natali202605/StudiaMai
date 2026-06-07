(function () {
  const API = (() => {
    if (typeof window.STUDIA_MAI_API === 'string') return window.STUDIA_MAI_API;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return location.port === '3000' ? '' : `http://${location.hostname}:3000`;
    }
    return '';
  })();
  const TOKEN_KEY = 'studia_mai_admin_token';

  const PHOTO_LABELS = {
    logo: 'Логотип (шапка и подвал)',
    hero_logo: 'Логотип в hero',
    hero_studio: 'Фото студии в hero',
    service_brows: 'Услуга: брови',
    service_cosmetology: 'Услуга: косметология',
    service_massage: 'Услуга: массаж',
    service_depilation: 'Услуга: депиляция',
    master_portrait: 'Портрет мастера',
    master_card: 'Визитка',
    master_certificates: 'Сертификаты'
  };

  const CONTENT_MAP = {
    hero_text: 'hero_text',
    hero_subtext: 'hero_subtext',
    footer_phone: 'footer_phone',
    footer_address: 'footer_address',
    footer_entrance: 'footer_entrance',
    footer_hours: 'footer_hours',
    master_role: 'master_role'
  };

  function token() { return localStorage.getItem(TOKEN_KEY); }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token()) headers.Authorization = `Bearer ${token()}`;
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const base = API;
    let res;
    try {
      res = await fetch(`${base}${path}`, { ...options, headers });
    } catch {
      throw new Error('Не удалось подключиться к серверу. Запустите: cd server && npm install && npm start');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404 && !base) {
        throw new Error('Админ-панель работает при запущенном сервере (npm start в папке server).');
      }
      throw new Error(data.error || 'Ошибка запроса');
    }
    return data;
  }

  function showLogin() {
    document.getElementById('loginScreen').hidden = false;
    document.getElementById('adminApp').hidden = true;
  }

  function showApp() {
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('adminApp').hidden = false;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function statusBadge(status) {
    const cls = status === 'done' ? 'admin__status--done' : 'admin__status--new';
    const label = status === 'done' ? 'Обработано' : 'Новая';
    return `<span class="admin__status ${cls}">${label}</span>`;
  }

  async function loadStats() {
    const s = await api('/api/stats');
    document.getElementById('statLeadsNew').textContent = s.leadsNew;
    document.getElementById('statBookingsNew').textContent = s.bookingsNew;
    document.getElementById('statLeadsTotal').textContent = s.leadsTotal;
    document.getElementById('statBookingsTotal').textContent = s.bookingsTotal;
    document.getElementById('badgeLeads').textContent = s.leadsNew;
    document.getElementById('badgeBookings').textContent = s.bookingsNew;
  }

  async function loadLeads() {
    const { leads } = await api('/api/leads');
    const wrap = document.getElementById('leadsTable');
    if (!leads.length) {
      wrap.innerHTML = '<p class="admin__msg">Заявок пока нет</p>';
      return;
    }
    wrap.innerHTML = `<table class="admin__table"><thead><tr>
      <th>Дата</th><th>Имя</th><th>Телефон</th><th>Email</th><th>Статус</th><th></th>
    </tr></thead><tbody>${leads.map(l => `<tr>
      <td>${formatDate(l.createdAt)}</td>
      <td>${l.name} ${l.surname || ''}</td>
      <td><a href="tel:${l.phone}">${l.phone}</a></td>
      <td>${l.email || '—'}</td>
      <td>${statusBadge(l.status)}</td>
      <td>${l.status !== 'done' ? `<button type="button" class="admin-btn admin-btn--ghost" data-done-lead="${l.id}">Готово</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>`;

    wrap.querySelectorAll('[data-done-lead]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/api/leads/${btn.dataset.doneLead}`, { method: 'PATCH', body: { status: 'done' } });
        loadLeads();
        loadStats();
      });
    });
  }

  async function loadBookings() {
    const { bookings } = await api('/api/bookings');
    const wrap = document.getElementById('bookingsTable');
    if (!bookings.length) {
      wrap.innerHTML = '<p class="admin__msg">Записей пока нет</p>';
      return;
    }
    wrap.innerHTML = `<table class="admin__table"><thead><tr>
      <th>Дата</th><th>Клиент</th><th>Телефон</th><th>Процедура</th><th>Желаемая дата</th><th>Статус</th><th></th>
    </tr></thead><tbody>${bookings.map(b => `<tr>
      <td>${formatDate(b.createdAt)}</td>
      <td>${b.name} ${b.surname || ''}</td>
      <td><a href="tel:${b.phone}">${b.phone}</a></td>
      <td>${b.procedureName}<br><small>${b.category || ''}</small></td>
      <td>${b.preferredDate || '—'}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${b.status !== 'done' ? `<button type="button" class="admin-btn admin-btn--ghost" data-done-booking="${b.id}">Готово</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>`;

    wrap.querySelectorAll('[data-done-booking]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/api/bookings/${btn.dataset.doneBooking}`, { method: 'PATCH', body: { status: 'done' } });
        loadBookings();
        loadStats();
      });
    });
  }

  async function loadContentForm() {
    const { content } = await api('/api/content');
    const form = document.getElementById('contentForm');
    Object.entries(CONTENT_MAP).forEach(([field, key]) => {
      if (form[field]) form[field].value = content[key] || '';
    });
  }

  async function loadPhotos() {
    const { images } = await api('/api/content');
    const grid = document.getElementById('photosGrid');
    grid.innerHTML = Object.entries(PHOTO_LABELS).map(([key, label]) => {
      const src = images[key] || '';
      const fullSrc = src.startsWith('/') ? (API || '') + src : '../' + src;
      return `<div class="admin__photo-card">
        <img src="${fullSrc}" alt="${label}">
        <span>${label}</span>
        <input type="file" accept="image/*" data-upload="${key}">
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-upload]').forEach(input => {
      input.addEventListener('change', async () => {
        if (!input.files[0]) return;
        const fd = new FormData();
        fd.append('file', input.files[0]);
        try {
          await api(`/api/images/${input.dataset.upload}`, { method: 'POST', body: fd });
          loadPhotos();
        } catch (e) {
          alert(e.message);
        }
      });
    });
  }

  let procedures = [];

  async function loadProcedures() {
    const data = await api('/api/procedures');
    procedures = data.procedures || [];
    renderProcedures();
  }

  function renderProcedures() {
    const list = document.getElementById('proceduresList');
    list.innerHTML = procedures.map((p, i) => `
      <div class="admin__proc-row" data-idx="${i}">
        <input type="text" value="${p.category || ''}" data-f="category" placeholder="Категория">
        <input type="text" value="${p.name || ''}" data-f="name" placeholder="Название">
        <input type="text" value="${p.price || ''}" data-f="price" placeholder="Цена">
        <input type="text" value="${p.duration || ''}" data-f="duration" placeholder="Время">
        <button type="button" class="admin__proc-del" data-del="${i}">×</button>
      </div>`).join('');

    list.querySelectorAll('[data-f]').forEach(inp => {
      inp.addEventListener('input', () => {
        const row = inp.closest('[data-idx]');
        const idx = +row.dataset.idx;
        procedures[idx][inp.dataset.f] = inp.value;
      });
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        procedures.splice(+btn.dataset.del, 1);
        renderProcedures();
      });
    });
  }

  document.getElementById('addProcedure')?.addEventListener('click', () => {
    procedures.push({ id: `p${Date.now()}`, category: '', name: '', price: '', duration: '' });
    renderProcedures();
  });

  document.getElementById('saveProcedures')?.addEventListener('click', async () => {
    try {
      await api('/api/procedures', { method: 'PUT', body: { procedures } });
      alert('Список процедур сохранён');
    } catch (e) {
      alert(e.message);
    }
  });

  document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const err = document.getElementById('loginError');
    try {
      const { token: t } = await api('/api/auth/login', {
        method: 'POST',
        body: { username: fd.get('username'), password: fd.get('password') }
      });
      localStorage.setItem(TOKEN_KEY, t);
      showApp();
      refreshAll();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  });

  document.querySelectorAll('.admin__nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin__nav-btn').forEach(b => b.classList.remove('is-active'));
      document.querySelectorAll('.admin__panel').forEach(p => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.querySelector(`[data-panel="${btn.dataset.tab}"]`)?.classList.add('is-active');
    });
  });

  document.getElementById('contentForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const content = {};
    Object.keys(CONTENT_MAP).forEach(field => {
      content[CONTENT_MAP[field]] = fd.get(field) || '';
    });
    try {
      await api('/api/content', { method: 'PUT', body: { content } });
      alert('Тексты сохранены');
    } catch (ex) {
      alert(ex.message);
    }
  });

  document.getElementById('passwordForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msg = document.getElementById('passwordMsg');
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') }
      });
      msg.textContent = 'Пароль обновлён';
      msg.className = 'admin__msg admin__msg--ok';
      msg.hidden = false;
      e.target.reset();
    } catch (ex) {
      msg.textContent = ex.message;
      msg.className = 'admin__msg';
      msg.hidden = false;
    }
  });

  async function refreshAll() {
    await loadStats();
    await loadLeads();
    await loadBookings();
    await loadContentForm();
    await loadPhotos();
    await loadProcedures();
  }

  if (token()) {
    showApp();
    refreshAll().catch(() => { localStorage.removeItem(TOKEN_KEY); showLogin(); });
  } else {
    showLogin();
  }
})();
