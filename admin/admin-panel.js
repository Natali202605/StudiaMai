(function () {
  'use strict';

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
  var baseTheme = { id: 'mint' };
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

  function getGithub() {
    return window.StudiaMaiGithubPublish || null;
  }

  function publishStatusLabel(prefix, result) {
    return prefix + ' Опубликовано на сайте для всех посетителей (обновление GitHub Pages — обычно 1–2 минуты).';
  }

  async function publishToSite(payload, msgId, okLocalText) {
    var gh = getGithub();
    if (!gh || !gh.isConfigured()) {
      showMsg(msgId, okLocalText + ' Чтобы изменения видели все посетители без разработчика: откройте «Настройки» → укажите GitHub-токен → сохраните настройки публикации.', false);
      return false;
    }
    showMsg(msgId, okLocalText + ' Публикация на сайт…', true);
    try {
      var result = await gh.publish(payload);
      if (result.images) {
        saveImagesState(result.images);
        renderPhotosGrid();
      }
      showMsg(msgId, publishStatusLabel(okLocalText, result), true);
      return true;
    } catch (err) {
      showMsg(msgId, okLocalText + ' Локально сохранено, но публикация не удалась: ' + (err && err.message ? err.message : err), false);
      return false;
    }
  }

  function syncBookingUrl(content) {
    if (content.booking_url && !content.footer_booking_url) {
      content.footer_booking_url = content.booking_url;
    }
    if (content.footer_booking_url && !content.booking_url) {
      content.booking_url = content.footer_booking_url;
    }
    if (content.booking_url) content.footer_booking_url = content.booking_url;
    return content;
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

  function getSchema() {
    return window.StudiaMaiCmsSchema || {};
  }

  function getImageLabels() {
    var labels = getSchema().IMAGE_LABELS || {};
    return Object.keys(labels).length ? labels : {
      logo: 'Логотип',
      hero_logo: 'Логотип в шапке главной',
      hero_studio: 'Фото студии на главной'
    };
  }

  function getImageAltDefaults() {
    return getSchema().IMAGE_ALTS || {};
  }

  function getServiceMeta() {
    return getSchema().SERVICE_META || {};
  }

  function getServiceKeys() {
    var keys = Object.keys(getServiceMeta());
    if (keys.length) return keys;
    var fromBase = Object.keys(baseServices || {});
    return fromBase.length ? fromBase : ['trichology'];
  }

  function getContentGroups() {
    return getSchema().CONTENT_GROUPS || [];
  }

  function renderFaqEditor(key, items) {
    items = Array.isArray(items) ? items : [];
    var html = '<div class="admin__list-editor" data-list-editor="faq" data-key="' + key + '">';
    var i;
    for (i = 0; i < items.length; i++) {
      html += '<div class="admin__list-item" data-list-index="' + i + '">';
      html += '<label class="admin__field admin__field--compact"><span>Вопрос</span>';
      html += '<input type="text" data-faq-q value="' + escapeHtml(items[i].q || '') + '"></label>';
      html += '<label class="admin__field admin__field--compact"><span>Ответ</span>';
      html += '<textarea data-faq-a rows="2">' + escapeHtml(items[i].a || '') + '</textarea></label>';
      html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" onclick="return studiaMaiRemoveListItem(this)">Удалить</button>';
      html += '</div>';
    }
    html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" onclick="return studiaMaiAddFaqItem(\'' + key + '\')">+ Вопрос</button>';
    html += '</div>';
    return html;
  }

  function renderReviewsEditor(key, items) {
    items = Array.isArray(items) ? items : [];
    var html = '<div class="admin__list-editor" data-list-editor="reviews" data-key="' + key + '">';
    var i;
    for (i = 0; i < items.length; i++) {
      var stars = Math.min(5, Math.max(1, Number(items[i].stars) || 5));
      html += '<div class="admin__list-item" data-list-index="' + i + '">';
      html += '<label class="admin__field admin__field--compact"><span>Автор</span>';
      html += '<input type="text" data-review-author value="' + escapeHtml(items[i].author || '') + '"></label>';
      html += '<label class="admin__field admin__field--compact"><span>Текст отзыва</span>';
      html += '<textarea data-review-text rows="3">' + escapeHtml(items[i].text || '') + '</textarea></label>';
      html += '<label class="admin__field admin__field--compact admin__field--inline"><span>Звёзды</span>';
      html += '<select data-review-stars>';
      var s;
      for (s = 1; s <= 5; s++) {
        html += '<option value="' + s + '"' + (s === stars ? ' selected' : '') + '>' + s + '</option>';
      }
      html += '</select></label>';
      html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" onclick="return studiaMaiRemoveListItem(this)">Удалить</button>';
      html += '</div>';
    }
    html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" onclick="return studiaMaiAddReviewItem(\'' + key + '\')">+ Отзыв</button>';
    html += '</div>';
    return html;
  }

  function renderContentField(field, content) {
    var val = content[field.key];
    var html = '<label class="admin__field" data-field-key="' + field.key + '"><span>' + escapeHtml(field.label) + '</span>';

    if (field.faq) {
      html += renderFaqEditor(field.key, val);
    } else if (field.reviews) {
      html += renderReviewsEditor(field.key, val);
    } else if (field.list || field.listHtml) {
      var lines = Array.isArray(val) ? val.join('\n') : (val || '');
      html += '<textarea name="' + field.key + '" rows="5" placeholder="Каждый пункт с новой строки">' + escapeHtml(lines) + '</textarea>';
      if (field.listHtml) html += '<span class="admin__field-hint">Можно использовать HTML, например &lt;span class="accent"&gt;слово&lt;/span&gt;</span>';
    } else if (field.textarea || (field.html && field.rows > 2)) {
      html += '<textarea name="' + field.key + '" rows="' + (field.rows || 4) + '">' + escapeHtml(val || '') + '</textarea>';
      if (field.html) html += '<span class="admin__field-hint">Можно использовать HTML с классом accent для выделения</span>';
    } else if (field.html) {
      html += '<input type="text" name="' + field.key + '" value="' + escapeHtml(val || '') + '">';
      html += '<span class="admin__field-hint">Можно использовать HTML с классом accent для выделения</span>';
    } else {
      html += '<input type="text" name="' + field.key + '" value="' + escapeHtml(val || '') + '">';
    }

    if (field.hint) html += '<span class="admin__field-hint">' + escapeHtml(field.hint) + '</span>';

    html += '</label>';
    return html;
  }

  function readFaqFromDom(key) {
    var box = document.querySelector('[data-list-editor="faq"][data-key="' + key + '"]');
    if (!box) return [];
    var items = [];
    var rows = box.querySelectorAll('.admin__list-item');
    var i;
    for (i = 0; i < rows.length; i++) {
      var q = (rows[i].querySelector('[data-faq-q]') || {}).value || '';
      var a = (rows[i].querySelector('[data-faq-a]') || {}).value || '';
      q = q.trim();
      a = a.trim();
      if (q || a) items.push({ q: q, a: a });
    }
    return items;
  }

  function readReviewsFromDom(key) {
    var box = document.querySelector('[data-list-editor="reviews"][data-key="' + key + '"]');
    if (!box) return [];
    var items = [];
    var rows = box.querySelectorAll('.admin__list-item');
    var i;
    for (i = 0; i < rows.length; i++) {
      var author = (rows[i].querySelector('[data-review-author]') || {}).value || '';
      var text = (rows[i].querySelector('[data-review-text]') || {}).value || '';
      var stars = Number((rows[i].querySelector('[data-review-stars]') || {}).value) || 5;
      author = author.trim();
      text = text.trim();
      if (text || author) items.push({ text: text, author: author, stars: stars });
    }
    return items;
  }

  function readContentFromForm() {
    var content = getContentState();
    var groups = getContentGroups();
    var g;
    for (g = 0; g < groups.length; g++) {
      var fields = groups[g].fields || [];
      var f;
      for (f = 0; f < fields.length; f++) {
        var field = fields[f];
        if (field.faq) {
          content[field.key] = readFaqFromDom(field.key);
          continue;
        }
        if (field.reviews) {
          content[field.key] = readReviewsFromDom(field.key);
          continue;
        }
        var input = document.querySelector('[name="' + field.key + '"]');
        if (!input) continue;
        var raw = input.value;
        if (field.list || field.listHtml) {
          content[field.key] = raw.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
        } else {
          content[field.key] = raw;
        }
      }
    }
    return content;
  }

  window.studiaMaiRemoveListItem = function (btn) {
    var item = btn && btn.closest('.admin__list-item');
    if (item) item.parentNode.removeChild(item);
    return false;
  };

  window.studiaMaiAddFaqItem = function (key) {
    var content = readContentFromForm();
    if (!Array.isArray(content[key])) content[key] = [];
    content[key].push({ q: '', a: '' });
    renderContentForm(content);
    return false;
  };

  window.studiaMaiAddReviewItem = function (key) {
    var content = readContentFromForm();
    if (!Array.isArray(content[key])) content[key] = [];
    content[key].push({ text: '', author: '', stars: 5 });
    renderContentForm(content);
    return false;
  };

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
    var ok = storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_IMAGES : 'studia_mai_cms_images', JSON.stringify(images));
    if (!ok) {
      showMsg('photosMsg', 'Фото слишком большое для браузера. Выберите другой файл.', false);
      return false;
    }
    if (window.StudiaMaiSite) window.StudiaMaiSite.applyImages(images);
    return true;
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
    var keys = getServiceKeys();
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var base = baseServices[key] || { title_html: '', desc: '', items: [] };
      var over = stored[key];
      var items = over && Array.isArray(over.items) ? over.items : (base.items || []);
      out[key] = {
        title_html: over && over.title_html != null ? over.title_html : (base.title_html || ''),
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
    var keys = getServiceKeys();
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!services[key]) services[key] = { title_html: '', desc: '', items: [] };
      var titleEl = getEl('serviceTitle_' + key);
      var descEl = getEl('serviceDesc_' + key);
      var rows = document.querySelectorAll('[data-service-row="' + key + '"]');
      if (!titleEl && !descEl && !rows.length) continue;
      if (titleEl) services[key].title_html = titleEl.value.trim();
      if (descEl) services[key].desc = descEl.value.trim();
      var items = [];
      var j;
      for (j = 0; j < rows.length; j++) {
        var row = rows[j];
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
      html += '<label class="admin__field admin__field--compact"><span>Информация в кнопке «Подробнее»</span>';
      html += '<textarea data-field="details" rows="3" placeholder="Текст, который открывается по кнопке «Подробнее»">' + escapeHtml(item.details || '') + '</textarea>';
      html += '</label>';
    }

    html += '</div>';
    return html;
  }

  function renderServicesEditor(services) {
    var box = getEl('servicesEditor');
    if (!box) return;
    services = services || getServicesState();
    var metaMap = getServiceMeta();
    var html = '';
    var keys = getServiceKeys();
    var i;
    for (i = 0; i < keys.length; i++) {
      var key = keys[i];
      var meta = metaMap[key] || { title: key, hint: '' };
      var data = services[key] || { title_html: '', desc: '', items: [] };
      html += '<div class="admin__service-card" data-service-key="' + key + '" data-search="' + escapeHtml(meta.title + ' ' + (meta.hint || '')) + '">';
      html += '<h4 class="admin__service-card__title">' + escapeHtml(meta.title) + '</h4>';
      if (meta.hint) html += '<p class="admin__msg admin__msg--compact">' + escapeHtml(meta.hint) + '</p>';
      html += '<label class="admin__field"><span>Заголовок карточки (HTML)</span>';
      html += '<input type="text" id="serviceTitle_' + key + '" value="' + escapeHtml(data.title_html || '') + '" placeholder="Например: Брови / &lt;span class=&quot;accent&quot;&gt;услуги Броволога&lt;/span&gt;">';
      html += '</label>';
      html += '<label class="admin__field"><span>Краткое описание карточки (необязательно)</span>';
      html += '<textarea id="serviceDesc_' + key + '" rows="2" placeholder="Появится под заголовком карточки">' + escapeHtml(data.desc || '') + '</textarea>';
      html += '</label>';
      html += '<div class="admin__service-list">';
      var j;
      for (j = 0; j < data.items.length; j++) {
        html += renderServiceItemRow(key, j, data.items[j], data.items.length);
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
    if (window.studiaMaiFilterEdit && getEl('editSearch')) window.studiaMaiFilterEdit(getEl('editSearch').value);
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
    publishToSite({ services: services, message: 'CMS: обновить прайс' }, 'servicesMsg', 'Прайс сохранён.');
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

  function renderContentForm(content) {
    var form = getEl('contentForm');
    if (!form) return;
    content = content || getContentState();
    var groups = getContentGroups();
    var html = '';
    var g;
    for (g = 0; g < groups.length; g++) {
      var group = groups[g];
      html += '<details class="admin__cms-group" data-search="' + escapeHtml(group.title) + '" open>';
      html += '<summary class="admin__cms-group__title">' + escapeHtml(group.title) + '</summary>';
      html += '<div class="admin__cms-group__body">';
      var fields = group.fields || [];
      var f;
      for (f = 0; f < fields.length; f++) {
        html += renderContentField(fields[f], content);
      }
      html += '</div></details>';
    }
    if (!html) {
      html = '<p class="admin__msg">Схема CMS не загружена. Проверьте подключение cms-schema.js</p>';
    }
    form.innerHTML = html;
    if (window.studiaMaiFilterEdit && getEl('editSearch')) window.studiaMaiFilterEdit(getEl('editSearch').value);
  }

  window.studiaMaiSaveContent = function () {
    var content = syncBookingUrl(readContentFromForm());
    saveContentState(content);
    publishToSite({ content: content, message: 'CMS: обновить тексты сайта' }, 'contentMsg', 'Тексты сохранены.');
    return false;
  };

  window.studiaMaiExportContent = function () {
    var blob = new Blob([JSON.stringify(getContentState(), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'content.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showMsg('contentMsg', 'Файл content.json скачан', true);
    return false;
  };

  window.studiaMaiResetContent = function () {
    storageSet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONTENT : 'studia_mai_cms_content', '{}');
    renderContentForm();
    if (window.StudiaMaiSite) window.StudiaMaiSite.applyContent(baseContent);
    showMsg('contentMsg', 'Тексты сброшены к исходным из data/content.json', true);
    return false;
  };

  function getImageFit(key) {
    var fits = getSchema().IMAGE_FIT || {};
    return fits[key] === 'contain' ? 'contain' : 'cover';
  }

  function previewSrc(src) {
    if (!src || src === '__removed__') return '';
    if (src.indexOf('data:') === 0 || src.indexOf('http') === 0 || src.indexOf('../') === 0) return src;
    return '../' + src;
  }

  function preparePhotoDataUrl(file, key) {
    var fit = getImageFit(key);
    var maxEdge = key === 'brand_title' ? 1600 : (fit === 'contain' ? 900 : 1600);
    var keepPng = fit === 'contain' && /png|webp|gif/i.test(file.type || '');
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var width = img.naturalWidth || img.width;
        var height = img.naturalHeight || img.height;
        if (!width || !height) {
          reject(new Error('Пустое изображение'));
          return;
        }
        var scale = Math.min(1, maxEdge / Math.max(width, height));
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        function draw(nextScale) {
          canvas.width = Math.max(1, Math.round(width * nextScale));
          canvas.height = Math.max(1, Math.round(height * nextScale));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (!keepPng) {
            ctx.fillStyle = '#f4f1ec';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        draw(scale);
        if (keepPng) {
          var png = canvas.toDataURL('image/png');
          if (png.length > 1200000 && scale > 0.35) {
            draw(scale * 0.72);
            png = canvas.toDataURL('image/png');
          }
          resolve(png);
          return;
        }
        var quality = 0.86;
        var jpeg = canvas.toDataURL('image/jpeg', quality);
        while (jpeg.length > 700000 && quality > 0.62) {
          quality -= 0.08;
          jpeg = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(jpeg);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Формат не открывается в браузере. Сохраните фото как JPG или PNG.'));
      };
      img.src = url;
    });
  }

  function renderPhotosGrid() {
    var grid = getEl('photosGrid');
    if (!grid) return;
    var images = getImagesState();
    var labels = getImageLabels();
    var html = '';
    var key;
    for (key in labels) {
      if (!Object.prototype.hasOwnProperty.call(labels, key)) continue;
      var src = images[key] || '';
      var removed = src === '__removed__';
      var preview = removed ? '' : previewSrc(src || baseImages[key] || '');
      var fit = getImageFit(key);
      var pathValue = (!src || src.indexOf('data:') === 0 || removed) ? '' : src;
      var changed = src && src !== baseImages[key];
      html += '<div class="admin__photo-card" data-photo-key="' + key + '" data-search="' + escapeHtml(labels[key]) + '">';
      if (preview) {
        html += '<img class="is-' + fit + '" src="' + escapeHtml(preview) + '" alt="' + escapeHtml(labels[key]) + '">';
      } else {
        html += '<div class="admin__photo-empty">Нет фото</div>';
      }
      html += '<span>' + labels[key] + '</span>';
      html += '<label class="admin__field admin__field--compact"><span>Подпись к фото</span>';
      var altDefaults = getImageAltDefaults();
      var savedAlts = (getContentState().image_alts) || {};
      var altValue = savedAlts[key] || altDefaults[key] || '';
      html += '<input type="text" data-alt-key="' + key + '" value="' + escapeHtml(altValue) + '"></label>';
      html += '<input type="text" class="admin__photo-path" data-key="' + key + '" value="' + escapeHtml(pathValue) + '" placeholder="' + (src && src.indexOf('data:') === 0 ? 'Фото загружено' : 'images/photo.jpg') + '">';
      html += '<label class="admin-btn admin-btn--ghost admin-btn--block admin__photo-upload">';
      html += (preview ? 'Заменить фото' : 'Добавить фото');
      html += '<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onchange="studiaMaiUploadPhoto(\'' + key + '\', this)">';
      html += '</label>';
      if (preview) {
        html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--block" onclick="return studiaMaiRemovePhoto(\'' + key + '\')">Удалить фото</button>';
      }
      if (changed) {
        html += '<button type="button" class="admin-btn admin-btn--ghost admin-btn--block" onclick="return studiaMaiRestorePhoto(\'' + key + '\')">Вернуть исходное</button>';
      }
      html += '</div>';
    }
    grid.innerHTML = html;
    if (window.studiaMaiFilterEdit && getEl('editSearch')) window.studiaMaiFilterEdit(getEl('editSearch').value);
  }

  function applyImageAltsToContent(content) {
    var inputs = document.querySelectorAll('[data-alt-key]');
    if (!inputs.length) return content;
    var defaults = getImageAltDefaults();
    var next = {};
    var existing = content.image_alts && typeof content.image_alts === 'object' ? content.image_alts : {};
    var key;
    for (key in existing) {
      if (Object.prototype.hasOwnProperty.call(existing, key) && existing[key]) next[key] = existing[key];
    }
    var i;
    for (i = 0; i < inputs.length; i++) {
      key = inputs[i].getAttribute('data-alt-key');
      var val = inputs[i].value.trim();
      if (!val || val === defaults[key]) delete next[key];
      else next[key] = val;
    }
    content.image_alts = next;
    return content;
  }

  window.studiaMaiUploadPhoto = function (key, input) {
    var file = input && input.files && input.files[0];
    if (!file) return false;
    if (!/^image\//i.test(file.type || '')) {
      showMsg('photosMsg', 'Нужен файл изображения JPG, PNG, WEBP или GIF.', false);
      input.value = '';
      return false;
    }
    showMsg('photosMsg', 'Фото подготавливается и встаёт в своё окно…', true);
    preparePhotoDataUrl(file, key).then(function (dataUrl) {
      var images = getImagesState();
      images[key] = dataUrl;
      if (!saveImagesState(images)) {
        input.value = '';
        return;
      }
      var content = applyImageAltsToContent(getContentState());
      saveContentState(content);
      renderPhotosGrid();
      publishToSite({ images: images, content: content, message: 'CMS: обновить фото ' + key }, 'photosMsg', 'Фото сохранено.');
    }).catch(function (err) {
      showMsg('photosMsg', err && err.message ? err.message : 'Не удалось обработать фото', false);
    });
    input.value = '';
    return false;
  };

  window.studiaMaiRemovePhoto = function (key) {
    var images = getImagesState();
    images[key] = '__removed__';
    if (!saveImagesState(images)) return false;
    renderPhotosGrid();
    publishToSite({ images: images, message: 'CMS: убрать фото ' + key }, 'photosMsg', 'Фото удалено. Окно блока сохранено.');
    return false;
  };

  window.studiaMaiRestorePhoto = function (key) {
    var storageKey = window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_IMAGES : 'studia_mai_cms_images';
    var stored = readJson(storageKey) || {};
    delete stored[key];
    storageSet(storageKey, JSON.stringify(stored));
    var images = getImagesState();
    renderPhotosGrid();
    if (window.StudiaMaiSite) window.StudiaMaiSite.applyImages(images);
    publishToSite({ images: images, message: 'CMS: вернуть фото ' + key }, 'photosMsg', 'Исходное фото возвращено.');
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
    }
    if (!saveImagesState(images)) return false;
    var content = applyImageAltsToContent(getContentState());
    saveContentState(content);
    renderPhotosGrid();
    publishToSite({ images: images, content: content, message: 'CMS: обновить фото' }, 'photosMsg', 'Фото сохранены.');
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
      publishToSite({ config: config, message: 'CMS: обновить настройки уведомлений' }, 'notifyMsg', 'Настройки уведомлений сохранены.');
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

  var THEME_KEY = 'studia_mai_theme';
  var THEME_OPTIONS = [
    { id: 'mint', name: 'Мята «Май»', text: 'Текущая палитра студии: свежая мята для ухода, бровей и трихологии.', colors: ['#00D4A8', '#007A58', '#F7FCFA', '#FFF8F2'] },
    { id: 'sage', name: 'Шалфей', text: 'Спокойный серо-зелёный оттенок. Подходит медицинскому уходу и трихологии.', colors: ['#6E9A84', '#2F5646', '#F6FAF7', '#E7F0EA'] },
    { id: 'powder', name: 'Пудра', text: 'Тёплый пудровый тон для бровей, кожи и мягкого салонного настроения.', colors: ['#C17B72', '#7A403C', '#FDF8F6', '#F6EBE7'] },
    { id: 'champagne', name: 'Шампань', text: 'Тёплое золото и слоновая кость. Спокойный премиальный вид кабинета.', colors: ['#C4A574', '#6B4E2E', '#FBF8F3', '#F4EBDD'] },
    { id: 'lavender', name: 'Лаванда', text: 'Мягкая сирень. Подчёркивает эстетику ухода и расслабляющие ритуалы.', colors: ['#8D79A8', '#4E3D66', '#F9F7FB', '#EFE8F4'] },
    { id: 'tide', name: 'Морская волна', text: 'Глубокая бирюза. Чистый клинический оттенок без неоновой мяты.', colors: ['#2A8C96', '#0E4C56', '#F5FAFA', '#E5F2F3'] },
    { id: 'silver', name: 'Серебро', text: 'Чёрный, белый и серебро. Строгий кабинет без цветного акцента.', colors: ['#8B939E', '#1A1D22', '#F7F7F8', '#E4E7EB'] },
    { id: 'pearl', name: 'Жемчуг', text: 'Светлое серебро и белый. Мягкий нейтральный фон для процедур.', colors: ['#A8B0BA', '#3E4650', '#FBFBFC', '#EEF0F2'] },
    { id: 'cocoa', name: 'Какао', text: 'Тёплый коричнево-бежевый тон для ухода за кожей и бровей.', colors: ['#A6846C', '#3E2C22', '#FBF7F4', '#F0E6DC'] },
    { id: 'noir', name: 'Чёрное серебро', text: 'Чёрный, белый и серебро. Контрастный кабинет: белый фон, чёрные блоки, серебряные кнопки.', colors: ['#C5CCD4', '#111111', '#FFFFFF', '#8E98A4'] },
    { id: 'rose', name: 'Пыльная роза', text: 'Мягкий розовый тон для бровей, кожи и спокойного салонного вида.', colors: ['#C48B95', '#6E3E48', '#FDF7F8', '#F6E8EB'] },
    { id: 'olive', name: 'Олива', text: 'Приглушённый оливковый оттенок для ухода за волосами и трихологии.', colors: ['#8A9168', '#3E4428', '#F8F8F4', '#E8E6D8'] }
  ];

  function getThemeState() {
    return readJson(THEME_KEY) || baseTheme || { id: 'mint' };
  }

  function saveThemeState(theme) {
    storageSet(THEME_KEY, JSON.stringify(theme || { id: 'mint' }));
  }

  function readThemeFromPicker() {
    var picked = document.querySelector('input[name="siteTheme"]:checked');
    var id = picked ? picked.value : (getThemeState().id || 'mint');
    var known = false;
    var i;
    for (i = 0; i < THEME_OPTIONS.length; i++) {
      if (THEME_OPTIONS[i].id === id) known = true;
    }
    return { id: known ? id : 'mint' };
  }

  function renderThemePicker() {
    var root = getEl('themePicker');
    if (!root) return;
    var current = (getThemeState() && getThemeState().id) || 'mint';
    var html = '';
    var i;
    var c;
    for (i = 0; i < THEME_OPTIONS.length; i++) {
      var theme = THEME_OPTIONS[i];
      var checked = theme.id === current;
      html += '<label class="theme-card">';
      html += '<input type="radio" name="siteTheme" value="' + theme.id + '"' + (checked ? ' checked' : '') + '>';
      html += '<span class="theme-card__swatches">';
      for (c = 0; c < theme.colors.length; c++) {
        html += '<span style="background:' + theme.colors[c] + '"></span>';
      }
      html += '</span>';
      html += '<span class="theme-card__name">' + theme.name + '</span>';
      html += '<span class="theme-card__text">' + theme.text + '</span>';
      html += '</label>';
    }
    root.innerHTML = html;
  }

  window.studiaMaiSaveTheme = function () {
    var theme = readThemeFromPicker();
    saveThemeState(theme);
    publishToSite({ theme: theme, message: 'CMS: обновить палитру сайта' }, 'themeMsg', 'Палитра сохранена.');
    return false;
  };

  window.studiaMaiResetTheme = function () {
    var theme = { id: 'mint' };
    saveThemeState(theme);
    renderThemePicker();
    publishToSite({ theme: theme, message: 'CMS: вернуть мятную палитру' }, 'themeMsg', 'Возвращена палитра «Мята».');
    return false;
  };

  function searchFold(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function itemSearchBlob(item) {
    var parts = [item.getAttribute('data-search') || ''];
    var nodes = item.querySelectorAll('summary, h4, .admin__field > span');
    var i;
    for (i = 0; i < nodes.length; i++) parts.push(nodes[i].textContent || '');
    if (item.firstElementChild && item.firstElementChild.tagName === 'SPAN') parts.push(item.firstElementChild.textContent || '');
    var label = item.querySelector(':scope > span');
    if (label) parts.push(label.textContent || '');
    return searchFold(parts.join(' '));
  }

  window.studiaMaiFilterEdit = function (raw) {
    var q = searchFold(raw);
    var panel = document.querySelector('.admin__panel[data-panel="edit"]');
    if (!panel) return false;
    var blocks = panel.querySelectorAll('.admin__edit-block');
    var visible = 0;
    var first = null;
    var i;
    var j;
    for (i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var titleEl = block.querySelector('h3');
      var title = searchFold(((titleEl && titleEl.textContent) || '') + ' ' + (block.getAttribute('data-search') || ''));
      var items = block.querySelectorAll('.admin__cms-group, .admin__service-card, .admin__photo-card');
      var titleHit = !q || title.indexOf(q) !== -1;
      var itemHit = 0;
      for (j = 0; j < items.length; j++) {
        var showItem = !q || titleHit || itemSearchBlob(items[j]).indexOf(q) !== -1;
        items[j].classList.toggle('is-search-hidden', !showItem);
        if (showItem) itemHit += 1;
      }
      var showBlock = !q || titleHit || itemHit > 0;
      block.classList.toggle('is-search-hidden', !showBlock);
      if (showBlock) {
        visible += 1;
        if (!first) first = block;
      }
    }
    var empty = getEl('editSearchEmpty');
    if (empty) empty.hidden = !q || visible > 0;
    if (q && first) first.scrollIntoView({ block: 'nearest' });
    return false;
  };

  window.studiaMaiPublishAll = function () {
    var content = syncBookingUrl(readContentFromForm());
    saveContentState(content);
    var services = readServicesFromDom();
    saveServicesState(services);
    var images = getImagesState();
    var inputs = document.querySelectorAll('.admin__photo-path');
    var i;
    for (i = 0; i < inputs.length; i++) {
      var key = inputs[i].getAttribute('data-key');
      var val = inputs[i].value.trim();
      if (val) images[key] = val;
      else if (String(images[key] || '').indexOf('data:') !== 0 && images[key] !== '__removed__') delete images[key];
    }
    saveImagesState(images);
    var config = getConfigState();
    saveConfigState(config);
    var theme = readThemeFromPicker();
    saveThemeState(theme);
    var contentWithAlts = applyImageAltsToContent(content);
    saveContentState(contentWithAlts);
    publishToSite({
      content: contentWithAlts,
      services: services,
      images: images,
      config: config,
      theme: theme,
      message: 'CMS: полная публикация сайта'
    }, 'publishAllMsg', 'Все изменения сохранены.');
    return false;
  };

  window.studiaMaiSavePublishSettings = function () {
    var config = getConfigState();
    config.githubOwner = getEl('githubOwner') ? getEl('githubOwner').value.trim() : '';
    config.githubRepo = getEl('githubRepo') ? getEl('githubRepo').value.trim() : '';
    config.githubBranch = getEl('githubBranch') ? getEl('githubBranch').value.trim() || 'main' : 'main';
    saveConfigState(config);
    var tokenEl = getEl('githubToken');
    var gh = getGithub();
    if (gh && tokenEl) {
      var tokenVal = tokenEl.value.trim();
      if (tokenVal && tokenVal !== '********') gh.setToken(tokenVal);
    }
    showMsg('publishSettingsMsg', 'Настройки публикации сохранены в этом браузере. Токен не публикуется на сайт.', true);
    renderPublishSettings();
    return false;
  };

  window.studiaMaiTestPublish = function () {
    var gh = getGithub();
    if (!gh) {
      showMsg('publishSettingsMsg', 'Модуль публикации не загружен', false);
      return false;
    }
    showMsg('publishSettingsMsg', 'Проверка доступа…', true);
    gh.testConnection().then(function (info) {
      showMsg('publishSettingsMsg', 'Доступ есть: ' + info.full_name + ' (ветка по умолчанию: ' + (info.default_branch || '—') + ')', true);
    }).catch(function (err) {
      showMsg('publishSettingsMsg', err && err.message ? err.message : String(err), false);
    });
    return false;
  };

  function renderPublishSettings() {
    var gh = getGithub();
    var defaults = gh && gh.DEFAULTS ? gh.DEFAULTS : { githubOwner: 'Natali202605', githubRepo: 'StudiaMai', githubBranch: 'main' };
    var config = getConfigState();
    var owner = getEl('githubOwner');
    var repo = getEl('githubRepo');
    var branch = getEl('githubBranch');
    var token = getEl('githubToken');
    var status = getEl('publishReadyStatus');
    if (owner) owner.value = config.githubOwner || defaults.githubOwner || '';
    if (repo) repo.value = config.githubRepo || defaults.githubRepo || '';
    if (branch) branch.value = config.githubBranch || defaults.githubBranch || 'main';
    if (token) {
      var hasToken = gh && gh.getToken && gh.getToken();
      token.value = hasToken ? '********' : '';
      token.placeholder = hasToken ? 'Токен сохранён — введите новый, чтобы заменить' : 'github_pat_... или ghp_...';
    }
    if (status) {
      if (gh && gh.isConfigured()) {
        status.textContent = 'Публикация готова: сохранение в админке сразу обновляет сайт для всех.';
        status.className = 'admin__msg admin__msg--ok';
      } else {
        status.textContent = 'Публикация не настроена: нужен GitHub Personal Access Token с правом Contents: Read and write.';
        status.className = 'admin__msg';
      }
      status.hidden = false;
    }
  }

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
      fetchJson('../data/config.json'),
      fetchJson('../data/theme.json')
    ]).then(function (results) {
      baseContent = results[0] || {};
      baseImages = results[1] || {};
      baseServices = results[2] || {};
      baseConfig = results[3] || {};
      baseTheme = results[4] && results[4].id ? { id: results[4].id } : { id: 'mint' };
      if (!baseConfig.notificationEmail) baseConfig.notificationEmail = DEFAULT_NOTIFY_EMAIL;
      if (!baseConfig.githubOwner) baseConfig.githubOwner = 'Natali202605';
      if (!baseConfig.githubRepo) baseConfig.githubRepo = 'StudiaMai';
      if (!baseConfig.githubBranch) baseConfig.githubBranch = 'main';
      saveConfigState(merge(baseConfig, readJson(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONFIG : 'studia_mai_site_config') || {}));
      saveThemeState(merge(baseTheme, readJson(THEME_KEY) || {}));
      renderThemePicker();
      renderContentForm();
      renderServicesEditor();
      renderPhotosGrid();
      renderNotifyForm();
      renderPublishSettings();
      return loadBookings();
    });
  };

})();
