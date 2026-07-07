(function () {
  'use strict';

  var CMS_LABELS = {
    hero_text: 'Текст на главном экране',
    hero_subtext: 'Подзаголовок на главном экране',
    master_role: 'Специализация мастера',
    footer_address: 'Адрес',
    footer_entrance: 'Как пройти',
    footer_hours: 'Часы работы'
  };

  var IMAGE_LABELS = {
    logo: 'Логотип',
    hero_logo: 'Логотип в шапке главной',
    hero_studio: 'Фото студии на главной',
    service_brows: 'Услуга: брови и ресницы',
    service_cosmetology: 'Услуга: косметология',
    service_massage: 'Услуга: массаж',
    service_trichology: 'Услуга: трихология',
    service_depilation: 'Услуга: депиляция',
    master_portrait: 'Портрет мастера',
    master_card: 'Визитка мастера',
    master_certificates: 'Сертификаты'
  };

  var SERVICE_LABELS = {
    trichology: {
      title: 'Трихология — лечение и уход за волосами',
      hint: 'Карточка «Услуги Трихолога» на сайте. Позиции отображаются в том же стиле, что и остальные услуги.'
    }
  };

  var STATUS_LABELS = {
    new: 'Новая',
    done: 'Обработана',
    cancelled: 'Отменена'
  };

  var notifySaveTimer = null;
  var DEFAULT_NOTIFY_EMAIL = 'brow_studia_may@mail.ru';
  var baseContent = {};
  var baseImages = {};
  var baseServices = {};
  var baseConfig = {};
  var bookingsCache = [];
  var selectedBookingId = null;

  function getEl(id) { return document.getElementById(id); }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function readJson(key) {
    var raw = storageGet(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function merge(a, b) {
    var out = {};
    var k;
    a = a || {};
    b = b || {};
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    return out;
  }

  function fetchJson(path) {
    return fetch(path + '?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('load failed');
      return r.json();
    }).catch(function () { return null; });
  }

  function showMsg(id, text, ok) {
    var el = getEl(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'admin__msg' + (ok ? ' admin__msg--ok' : '');
    el.hidden = false;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return iso; }
  }

  function getContentState() {
    return merge(baseContent, readJson(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONTENT : 'studia_mai_cms_content'));
  }

  function getImagesState() {
    return merge(baseImages, readJson(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_IMAGES : 'studia_mai_cms_images'));
  }

  function getConfigState() {
    return merge(baseConfig, readJson(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONFIG : 'studia_mai_site_config'));
  }

  function saveContentState(content) {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONTENT : 'studia_mai_cms_content', JSON.stringify(content));
    if (window.StudiaMaiSite) window.StudiaMaiSite.applyContent(content);
  }

  function saveImagesState(images) {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_IMAGES : 'studia_mai_cms_images', JSON.stringify(images));
    if (window.StudiaMaiSite) window.StudiaMaiSite.applyImages(images);
  }

  function normalizeServiceItem(item) {
    if (!item || typeof item !== 'object') return null;
    if (item.type === 'subtitle' || (item.text && !item.name)) {
      return { type: 'subtitle', text: String(item.text || item.subtitle || '').trim() };
    }
    return {
      type: 'item',
      name: String(item.name || '').trim(),
      price: String(item.price || '').trim(),
      time: String(item.time || '').trim(),
      details: String(item.details || '').trim()
    };
  }

  function getServicesState() {
    var stored = readJson(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_SERVICES : 'studia_mai_cms_services') || {};
    var out = {};
    var key;
    for (key in SERVICE_LABELS) {
      if (!Object.prototype.hasOwnProperty.call(SERVICE_LABELS, key)) continue;
      var base = baseServices[key] || { desc: '', items: [] };
      var over = stored[key];
      var items = over && Array.isArray(over.items) ? over.items : (base.items || []);
      out[key] = {
        desc: over && over.desc != null ? over.desc : (base.desc || ''),
        items: items.map(normalizeServiceItem).filter(Boolean)
      };
    }
    return out;
  }

  function saveServicesState(services) {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_SERVICES : 'studia_mai_cms_services', JSON.stringify(services));
    if (window.StudiaMaiSite && window.StudiaMaiSite.applyServices) {
      window.StudiaMaiSite.applyServices(services);
    }
  }

  function readServicesFromDom() {
    var services = getServicesState();
    var key;
    for (key in SERVICE_LABELS) {
      if (!Object.prototype.hasOwnProperty.call(SERVICE_LABELS, key)) continue;
      var descEl = getEl('serviceDesc_' + key);
      if (descEl) services[key].desc = descEl.value.trim();
      var rows = document.querySelectorAll('[data-service-row="' + key + '"]');
      var items = [];
      var i;
      for (i = 0; i < rows.length; i++) {
        var row = rows[i];
        var rowType = row.getAttribute('data-row-type');
        if (rowType === 'subtitle') {
          var textInput = row.querySelector('[data-field="text"]');
          items.push({ type: 'subtitle', text: textInput ? textInput.value.trim() : '' });
        } else {
          items.push({
            type: 'item',
            name: (row.querySelector('[data-field="name"]') || {}).value || '',
            price: (row.querySelector('[data-field="price"]') || {}).value || '',
            time: (row.querySelector('[data-field="time"]') || {}).value || '',
            details: (row.querySelector('[data-field="details"]') || {}).value || ''
          });
        }
      }
      services[key].items = items.map(function (item) {
        item.name = item.name ? item.name.trim() : '';
        item.price = item.price ? item.price.trim() : '';
        item.time = item.time ? item.time.trim() : '';
        item.details = item.details ? item.details.trim() : '';
        item.text = item.text ? item.text.trim() : '';
        return item;
      }).filter(function (item) {
        if (item.type === 'subtitle') return Boolean(item.text);
        return Boolean(item.name || item.price || item.time || item.details);
      });
    }
    return services;
  }

  function renderServiceItemRow(key, index, item, total) {
    var html = '<div class="admin__service-item' + (item.type === 'subtitle' ? ' admin__service-item--subtitle' : '') + '" data-service-row="' + key + '" data-row-type="' + (item.type === 'subtitle' ? 'subtitle' : 'item') + '">';
    html += '<div class="admin__service-item__head">';
    html += '<span class="admin__service-item__badge">' + (item.type === 'subtitle' ? 'Раздел' : 'Услуга') + '</span>';
    html += '<div class="admin__service-item__actions">';
    if (index > 0) {
      html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" title="Выше" onclick="return studiaMaiMoveServiceItem(\'' + key + '\',' + index + ',-1)">↑</button>';
    }
    if (index < total - 1) {
      html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" title="Ниже" onclick="return studiaMaiMoveServiceItem(\'' + key + '\',' + index + ',1)">↓</button>';
    }
    html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" title="Удалить" onclick="return studiaMaiRemoveServiceItem(\'' + key + '\',' + index + ')">×</button>';
    html += '</div></div>';

    if (item.type === 'subtitle') {
      html += '<label class="admin__field admin__field--compact"><span>Название раздела</span>';
      html += '<input type="text" data-field="text" value="' + escapeHtml(item.text || '') + '" placeholder="Например: Диагностика и консультации">';
      html += '</label>';
    } else {
      html += '<div class="admin__service-item__grid">';
      html += '<label class="admin__field admin__field--compact admin__field--wide"><span>Название услуги</span>';
      html += '<input type="text" data-field="name" value="' + escapeHtml(item.name || '') + '" placeholder="Например: Консультация трихолога">';
      html += '</label>';
      html += '<label class="admin__field admin__field--compact"><span>Цена</span>';
      html += '<input type="text" data-field="price" value="' + escapeHtml(item.price || '') + '" placeholder="от 1 500 ₽">';
      html += '</label>';
      html += '<label class="admin__field admin__field--compact"><span>Время</span>';
      html += '<input type="text" data-field="time" value="' + escapeHtml(item.time || '') + '" placeholder="1 час">';
      html += '</label>';
      html += '</div>';
      html += '<label class="admin__field admin__field--compact"><span>Описание для «Подробнее» (необязательно)</span>';
      html += '<textarea data-field="details" rows="2" placeholder="Краткое описание процедуры">' + escapeHtml(item.details || '') + '</textarea>';
      html += '</label>';
    }

    html += '</div>';
    return html;
  }

  function renderServicesEditor(services) {
    var box = getEl('servicesEditor');
    if (!box) return;
    services = services || getServicesState();
    var html = '';
    var key;
    for (key in SERVICE_LABELS) {
      if (!Object.prototype.hasOwnProperty.call(SERVICE_LABELS, key)) continue;
      var meta = SERVICE_LABELS[key];
      var data = services[key] || { desc: '', items: [] };
      html += '<div class="admin__service-card" data-service-key="' + key + '">';
      html += '<h4 class="admin__service-card__title">' + escapeHtml(meta.title) + '</h4>';
      if (meta.hint) html += '<p class="admin__msg admin__msg--compact">' + escapeHtml(meta.hint) + '</p>';
      html += '<label class="admin__field"><span>Краткое описание карточки (необязательно)</span>';
      html += '<textarea id="serviceDesc_' + key + '" rows="2" placeholder="Появится под заголовком карточки, как у депиляции">' + escapeHtml(data.desc || '') + '</textarea>';
      html += '</label>';
      html += '<div class="admin__service-list">';
      var i;
      for (i = 0; i < data.items.length; i++) {
        html += renderServiceItemRow(key, i, data.items[i], data.items.length);
      }
      if (!data.items.length) {
        html += '<p class="admin__msg admin__msg--compact">Пока нет позиций. Добавьте услугу или раздел.</p>';
      }
      html += '</div>';
      html += '<div class="admin__toolbar admin__toolbar--compact">';
      html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" onclick="return studiaMaiAddServiceItem(\'' + key + '\',\'item\')">+ Услуга</button>';
      html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" onclick="return studiaMaiAddServiceItem(\'' + key + '\',\'subtitle\')">+ Раздел</button>';
      html += '</div></div>';
    }
    box.innerHTML = html;
  }

  window.studiaMaiAddServiceItem = function (key, type) {
    var services = readServicesFromDom();
    if (!services[key]) services[key] = { desc: '', items: [] };
    if (type === 'subtitle') {
      services[key].items.push({ type: 'subtitle', text: '' });
    } else {
      services[key].items.push({ type: 'item', name: '', price: '', time: '', details: '' });
    }
    renderServicesEditor(services);
    return false;
  };

  window.studiaMaiRemoveServiceItem = function (key, index) {
    var services = readServicesFromDom();
    if (!services[key] || !services[key].items[index]) return false;
    services[key].items.splice(index, 1);
    renderServicesEditor(services);
    return false;
  };

  window.studiaMaiMoveServiceItem = function (key, index, dir) {
    var services = readServicesFromDom();
    var items = services[key] ? services[key].items : [];
    var newIndex = index + dir;
    if (newIndex < 0 || newIndex >= items.length) return false;
    var tmp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = tmp;
    renderServicesEditor(services);
    return false;
  };

  window.studiaMaiSaveServices = function () {
    var services = readServicesFromDom();
    saveServicesState(services);
    renderServicesEditor(services);
    showMsg('servicesMsg', 'Прайс сохранён и применён на сайте (в этом браузере). Для всех посетителей — экспортируйте services.json и обновите сайт.', true);
    return false;
  };

  window.studiaMaiResetServices = function () {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_SERVICES : 'studia_mai_cms_services', '{}');
    renderServicesEditor();
    if (window.StudiaMaiSite && window.StudiaMaiSite.applyServices) {
      window.StudiaMaiSite.applyServices(baseServices);
    }
    showMsg('servicesMsg', 'Прайс сброшен к исходному из data/services.json', true);
    return false;
  };

  window.studiaMaiExportServices = function () {
    var blob = new Blob([JSON.stringify(getServicesState(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'services.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showMsg('servicesMsg', 'Файл services.json скачан', true);
    return false;
  };

  function saveConfigState(config) {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONFIG : 'studia_mai_site_config', JSON.stringify(config));
  }

  function countNewBookings() {
    var n = 0;
    for (var i = 0; i < bookingsCache.length; i++) {
      if (bookingsCache[i].status === 'new') n++;
    }
    return n;
  }

  function updateBookingBadge() {
    var badge = getEl('bookingsBadge');
    var stat = getEl('statBookingsCount');
    var n = countNewBookings();
    if (badge) {
      badge.textContent = String(n);
      badge.hidden = n === 0;
    }
    if (stat) stat.textContent = String(bookingsCache.length);
  }

  function normalizeBooking(item) {
    return {
      id: item.id || ('b' + Date.now() + Math.random()),
      name: item.name || '',
      surname: item.surname || '',
      phone: item.phone || '',
      email: item.email || '',
      comment: item.comment || '',
      consent: Boolean(item.consent),
      createdAt: item.createdAt || new Date().toISOString(),
      status: item.status || 'new',
      source: item.source || 'site'
    };
  }

  function dedupeBookings(list) {
    var map = {};
    var out = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var b = normalizeBooking(list[i]);
      if (!map[b.id]) {
        map[b.id] = true;
        out.push(b);
      }
    }
    out.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return out;
  }

  function loadBookings() {
    var promises = [];
    var localKey = window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_BOOKINGS : 'studia_mai_bookings_local';
    var local = readJson(localKey) || [];
    var merged = local.slice();

    promises.push(fetchJson('../data/bookings.json').then(function (data) {
      if (data && data.bookings) merged = merged.concat(data.bookings);
    }));

    var config = getConfigState();
    if (config.bookingsApiUrl) {
      promises.push(fetch(config.bookingsApiUrl + (config.bookingsApiUrl.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now(), { mode: 'cors' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          if (Array.isArray(data)) merged = merged.concat(data);
          else if (data.bookings) merged = merged.concat(data.bookings);
        })
        .catch(function () {}));
    }

    return Promise.all(promises).then(function () {
      bookingsCache = dedupeBookings(merged);
      if (window.StudiaMaiSite) window.StudiaMaiSite.saveLocalBookings(bookingsCache);
      updateBookingBadge();
      renderBookingsTable();
      renderBookingDetail();
    });
  }

  function persistBookings() {
    if (window.StudiaMaiSite) window.StudiaMaiSite.saveLocalBookings(bookingsCache);
    var config = getConfigState();
    if (!config.bookingsApiUrl) return Promise.resolve();
    return fetch(config.bookingsApiUrl, {
      method: 'PUT',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookings: bookingsCache })
    }).catch(function () {});
  }

  function renderBookingsTable() {
    var tbody = getEl('bookingsTableBody');
    if (!tbody) return;
    if (!bookingsCache.length) {
      tbody.innerHTML = '<tr><td colspan="6">Заявок пока нет. Они появятся после отправки формы на сайте.</td></tr>';
      return;
    }
    var html = '';
    var i;
    for (i = 0; i < bookingsCache.length; i++) {
      var b = bookingsCache[i];
      var statusClass = b.status === 'done' ? 'admin__status--done' : 'admin__status--new';
      var statusText = STATUS_LABELS[b.status] || b.status;
      html += '<tr class="admin__table-row' + (selectedBookingId === b.id ? ' is-selected' : '') + '" data-booking-id="' + b.id + '" onclick="studiaMaiSelectBooking(\'' + b.id + '\')">';
      html += '<td>' + formatDate(b.createdAt) + '</td>';
      html += '<td>' + escapeHtml(b.name + (b.surname ? ' ' + b.surname : '')) + '</td>';
      html += '<td>' + escapeHtml(b.phone) + '</td>';
      html += '<td>' + escapeHtml(b.email || '—') + '</td>';
      html += '<td><span class="admin__status ' + statusClass + '">' + statusText + '</span></td>';
      html += '<td><button type="button" class="admin-btn admin-btn--ghost admin-btn--small" onclick="event.stopPropagation();studiaMaiSelectBooking(\'' + b.id + '\')">Подробнее</button></td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderBookingDetail() {
    var box = getEl('bookingDetail');
    if (!box) return;
    var booking = null;
    var i;
    for (i = 0; i < bookingsCache.length; i++) {
      if (bookingsCache[i].id === selectedBookingId) booking = bookingsCache[i];
    }
    if (!booking) {
      box.innerHTML = '<p class="admin__msg">Выберите заявку в таблице, чтобы увидеть подробности.</p>';
      return;
    }
    box.innerHTML =
      '<div class="admin__detail-grid">' +
      '<p><strong>Дата:</strong> ' + formatDate(booking.createdAt) + '</p>' +
      '<p><strong>Имя:</strong> ' + escapeHtml(booking.name) + '</p>' +
      '<p><strong>Фамилия:</strong> ' + escapeHtml(booking.surname || '—') + '</p>' +
      '<p><strong>Телефон:</strong> <a href="tel:' + escapeHtml(booking.phone) + '">' + escapeHtml(booking.phone) + '</a></p>' +
      '<p><strong>Email:</strong> ' + (booking.email ? '<a href="mailto:' + escapeHtml(booking.email) + '">' + escapeHtml(booking.email) + '</a>' : '—') + '</p>' +
      '<p><strong>Комментарий:</strong> ' + escapeHtml(booking.comment || '—') + '</p>' +
      '<p><strong>Согласие на ПД:</strong> ' + (booking.consent ? 'Да' : 'Нет') + '</p>' +
      '<p><strong>Источник:</strong> ' + escapeHtml(booking.source || 'site') + '</p>' +
      '</div>' +
      '<div class="admin__detail-actions">' +
      '<label class="admin__field admin__field--inline"><span>Статус</span>' +
      '<select id="bookingStatusSelect">' +
      '<option value="new"' + (booking.status === 'new' ? ' selected' : '') + '>Новая</option>' +
      '<option value="done"' + (booking.status === 'done' ? ' selected' : '') + '>Обработана</option>' +
      '<option value="cancelled"' + (booking.status === 'cancelled' ? ' selected' : '') + '>Отменена</option>' +
      '</select></label>' +
      '<button type="button" class="admin-btn admin-btn--primary" onclick="return studiaMaiSaveBookingStatus()">Сохранить статус</button>' +
      '<button type="button" class="admin-btn admin-btn--ghost" onclick="return studiaMaiDeleteBooking()">Удалить заявку</button>' +
      '</div>';
  }

  window.studiaMaiSelectBooking = function (id) {
    selectedBookingId = id;
    renderBookingsTable();
    renderBookingDetail();
    return false;
  };

  window.studiaMaiSaveBookingStatus = function () {
    var select = getEl('bookingStatusSelect');
    if (!select || !selectedBookingId) return false;
    var i;
    for (i = 0; i < bookingsCache.length; i++) {
      if (bookingsCache[i].id === selectedBookingId) {
        bookingsCache[i].status = select.value;
        break;
      }
    }
    persistBookings().then(function () {
      updateBookingBadge();
      renderBookingsTable();
      renderBookingDetail();
      showMsg('bookingsMsg', 'Статус заявки сохранён', true);
    });
    return false;
  };

  window.studiaMaiDeleteBooking = function () {
    if (!selectedBookingId) return false;
    if (!confirm('Удалить эту заявку из списка?')) return false;
    bookingsCache = bookingsCache.filter(function (b) { return b.id !== selectedBookingId; });
    selectedBookingId = null;
    persistBookings().then(function () {
      updateBookingBadge();
      renderBookingsTable();
      renderBookingDetail();
      showMsg('bookingsMsg', 'Заявка удалена', true);
    });
    return false;
  };

  window.studiaMaiRefreshBookings = function () {
    loadBookings().then(function () {
      showMsg('bookingsMsg', 'Список заявок обновлён', true);
    });
    return false;
  };

  function renderContentForm() {
    var form = getEl('contentForm');
    if (!form) return;
    var content = getContentState();
    var html = '';
    var key;
    for (key in CMS_LABELS) {
      if (!Object.prototype.hasOwnProperty.call(CMS_LABELS, key)) continue;
      var val = content[key] || '';
      html += '<label class="admin__field"><span>' + CMS_LABELS[key] + '</span>';
      if (val.length > 90) {
        html += '<textarea name="' + key + '" rows="3">' + escapeHtml(val) + '</textarea>';
      } else {
        html += '<input type="text" name="' + key + '" value="' + escapeHtml(val) + '">';
      }
      html += '</label>';
    }
    form.innerHTML = html;
  }

  window.studiaMaiSaveContent = function () {
    var form = getEl('contentForm');
    if (!form) return false;
    var content = getContentState();
    var inputs = form.querySelectorAll('[name]');
    var i;
    for (i = 0; i < inputs.length; i++) {
      content[inputs[i].name] = inputs[i].value;
    }
    saveContentState(content);
    showMsg('contentMsg', 'Тексты сохранены и применены на сайте (в этом браузере). Для всех посетителей — экспортируйте JSON и обновите сайт.', true);
    return false;
  };

  window.studiaMaiResetContent = function () {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONTENT : 'studia_mai_cms_content', '{}');
    renderContentForm();
    if (window.StudiaMaiSite) window.StudiaMaiSite.applyContent(baseContent);
    showMsg('contentMsg', 'Тексты сброшены к исходным из data/content.json', true);
    return false;
  };

  function renderPhotosGrid() {
    var grid = getEl('photosGrid');
    if (!grid) return;
    var images = getImagesState();
    var html = '';
    var key;
    for (key in IMAGE_LABELS) {
      if (!Object.prototype.hasOwnProperty.call(IMAGE_LABELS, key)) continue;
      var src = images[key] || baseImages[key] || '';
      if (src === '__removed__') src = '';
      var preview = src ? (src.indexOf('data:') === 0 || src.indexOf('http') === 0 ? src : '../' + src) : '';
      html += '<div class="admin__photo-card" data-photo-key="' + key + '">';
      html += '<img src="' + escapeHtml(preview) + '" alt="' + escapeHtml(IMAGE_LABELS[key]) + '">';
      html += '<span>' + IMAGE_LABELS[key] + '</span>';
      html += '<input type="text" class="admin__photo-path" data-key="' + key + '" value="' + escapeHtml(src) + '" placeholder="images/photo.jpg">';
      html += '<label class="admin-btn admin-btn--ghost admin-btn--block admin__photo-upload">';
      html += 'Загрузить файл<input type="file" accept="image/*" hidden onchange="studiaMaiUploadPhoto(\'' + key + '\', this)">';
      html += '</label>';
      html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--block" onclick="return studiaMaiRemovePhoto(\'' + key + '\')">Убрать фото</button>';
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  window.studiaMaiUploadPhoto = function (key, input) {
    var file = input && input.files && input.files[0];
    if (!file) return false;
    if (file.size > 2 * 1024 * 1024) {
      showMsg('photosMsg', 'Файл больше 2 МБ. Сожмите изображение или укажите путь к файлу в папке images/.', false);
      input.value = '';
      return false;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var images = getImagesState();
      images[key] = reader.result;
      saveImagesState(images);
      renderPhotosGrid();
      showMsg('photosMsg', 'Фото загружено и применено на сайте (в этом браузере)', true);
    };
    reader.readAsDataURL(file);
    return false;
  };

  window.studiaMaiRemovePhoto = function (key) {
    var images = getImagesState();
    images[key] = '__removed__';
    saveImagesState(images);
    renderPhotosGrid();
    showMsg('photosMsg', 'Фото скрыто на сайте', true);
    return false;
  };

  window.studiaMaiSavePhotos = function () {
    var images = getImagesState();
    var inputs = document.querySelectorAll('.admin__photo-path');
    var i;
    for (i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute('data-key');
      var val = inputs[i].value.trim();
      if (val) images[key] = val;
      else delete images[key];
    }
    saveImagesState(images);
    renderPhotosGrid();
    showMsg('photosMsg', 'Пути к фото сохранены', true);
    return false;
  };

  window.studiaMaiResetPhotos = function () {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_IMAGES : 'studia_mai_cms_images', '{}');
    renderPhotosGrid();
    if (window.StudiaMaiSite) window.StudiaMaiSite.applyImages(baseImages);
    showMsg('photosMsg', 'Фото сброшены к исходным', true);
    return false;
  };

  function renderNotifyForm() {
    var config = getConfigState();
    if (!config.notificationEmail) config.notificationEmail = DEFAULT_NOTIFY_EMAIL;
    var fields = [
      ['notifyWeb3forms', 'web3formsAccessKey'],
      ['notifyEmail', 'notificationEmail'],
      ['notifyTelegramToken', 'telegramBotToken'],
      ['notifyTelegramChat', 'telegramChatId'],
      ['notifyBookingsApi', 'bookingsApiUrl']
    ];
    var i;
    for (i = 0; i < fields.length; i++) {
      var el = getEl(fields[i][0]);
      if (el) {
        el.value = config[fields[i][1]] || (fields[i][1] === 'notificationEmail' ? DEFAULT_NOTIFY_EMAIL : '');
      }
    }
    bindNotifyAutoSave();
  }

  function bindNotifyAutoSave() {
    var ids = ['notifyWeb3forms', 'notifyTelegramToken', 'notifyTelegramChat', 'notifyBookingsApi'];
    var i;
    for (i = 0; i < ids.length; i++) {
      var el = getEl(ids[i]);
      if (!el || el.getAttribute('data-autosave')) continue;
      el.setAttribute('data-autosave', '1');
      el.addEventListener('input', scheduleNotifySave);
      el.addEventListener('change', scheduleNotifySave);
    }
  }

  function scheduleNotifySave() {
    if (notifySaveTimer) clearTimeout(notifySaveTimer);
    notifySaveTimer = setTimeout(function () {
      studiaMaiSaveNotify(true);
    }, 400);
  }

  window.studiaMaiSaveNotify = function (silent) {
    var config = getConfigState();
    config.web3formsAccessKey = getEl('notifyWeb3forms') ? getEl('notifyWeb3forms').value.trim() : '';
    config.notificationEmail = DEFAULT_NOTIFY_EMAIL;
    config.telegramBotToken = getEl('notifyTelegramToken') ? getEl('notifyTelegramToken').value.trim() : '';
    config.telegramChatId = getEl('notifyTelegramChat') ? getEl('notifyTelegramChat').value.trim() : '';
    config.bookingsApiUrl = getEl('notifyBookingsApi') ? getEl('notifyBookingsApi').value.trim() : '';
    saveConfigState(config);
    if (!silent) {
      showMsg('notifyMsg', 'Настройки уведомлений сохранены', true);
    } else {
      showMsg('notifyMsg', 'Сохранено', true);
      var msg = getEl('notifyMsg');
      if (msg) {
        setTimeout(function () {
          if (msg.textContent === 'Сохранено') msg.hidden = true;
        }, 1500);
      }
    }
    return false;
  };

  window.studiaMaiExportData = function () {
    var payload = {
      content: getContentState(),
      images: getImagesState(),
      services: getServicesState(),
      config: getConfigState(),
      bookings: bookingsCache
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'studia-mai-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showMsg('notifyMsg', 'Файл экспорта скачан', true);
    return false;
  };

  window.studiaMaiAdminInit = function () {
    Promise.all([
      fetchJson('../data/content.json'),
      fetchJson('../data/images.json'),
      fetchJson('../data/services.json'),
      fetchJson('../data/config.json')
    ]).then(function (results) {
      baseContent = results[0] || {};
      baseImages = results[1] || {};
      baseServices = results[2] || {};
      baseConfig = results[3] || {};
      if (!baseConfig.notificationEmail) baseConfig.notificationEmail = DEFAULT_NOTIFY_EMAIL;
      saveConfigState(merge(baseConfig, readJson(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONFIG : 'studia_mai_site_config') || {}));
      renderContentForm();
      renderServicesEditor();
      renderPhotosGrid();
      renderNotifyForm();
      return loadBookings();
    });
  };

})();
