(function () {
  const API = window.STUDIA_MAI_API;
  const DATA_BASE = window.STUDIA_MAI_DATA_BASE || 'data';
  const STORAGE_CONTENT = 'studia_mai_cms_content';
  const STORAGE_IMAGES = 'studia_mai_cms_images';
  const STORAGE_SERVICES = 'studia_mai_cms_services';
  const STORAGE_CONFIG = 'studia_mai_site_config';
  const STORAGE_BOOKINGS = 'studia_mai_bookings_local';
  const DEFAULT_ADMIN_EMAIL = 'brow_studia_may@mail.ru';
  const DATA_CACHE_VERSION = 'cms12';
  let cacheBust = DATA_CACHE_VERSION;
  const IS_ADMIN = /\/admin(?:\/|$)/i.test(location.pathname || '');

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

  async function resolveCacheBust() {
    try {
      const res = await fetch(`${DATA_BASE}/version.json`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.v != null) {
          cacheBust = String(data.v);
          return cacheBust;
        }
      }
    } catch { /* ignore */ }
    cacheBust = DATA_CACHE_VERSION;
    return cacheBust;
  }

  async function fetchDataJson(file) {
    try {
      const res = await fetch(`${DATA_BASE}/${file}?v=${cacheBust}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function bookingHref(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (/vk\.ru\/away\.php/i.test(raw)) return raw;
    if (!/mst\.link/i.test(raw)) return raw;
    return 'https://vk.ru/away.php?to=' + encodeURIComponent(raw) + '&utf=1';
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
    const fromStorage = IS_ADMIN ? readStorageJson(STORAGE_CONFIG) : null;
    const merged = mergeObjects(fromFile || {}, fromStorage || {});
    if (!merged.notificationEmail) merged.notificationEmail = DEFAULT_ADMIN_EMAIL;
    return merged;
  }

  async function loadContentData() {
    const fromApi = await fetchJson('/api/content');
    if (fromApi?.content) {
      return { content: fromApi.content, images: fromApi.images || {} };
    }
    const [contentFile, imagesFile] = await Promise.all([
      fetchDataJson('content.json'),
      fetchDataJson('images.json')
    ]);
    if (IS_ADMIN) {
      return {
        content: mergeObjects(contentFile, readStorageJson(STORAGE_CONTENT)),
        images: mergeObjects(imagesFile, readStorageJson(STORAGE_IMAGES))
      };
    }
    return { content: contentFile || {}, images: imagesFile || {} };
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

    function setHtml(sel, html) {
      if (html == null || html === '') return;
      const el = document.querySelector(sel);
      if (el) el.innerHTML = html;
    }
    function setText(sel, text) {
      if (text == null || text === '') return;
      const el = document.querySelector(sel);
      if (el) el.textContent = text;
    }
    function setLink(sel, href, text) {
      const el = document.querySelector(sel);
      if (!el) return;
      if (href) el.href = href;
      if (text != null && text !== '') el.textContent = text;
    }

    if (content.meta_title) document.title = content.meta_title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && content.meta_description) metaDesc.setAttribute('content', content.meta_description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && content.meta_title) ogTitle.setAttribute('content', content.meta_title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && content.meta_description) ogDesc.setAttribute('content', content.meta_description);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle && content.meta_title) twTitle.setAttribute('content', content.meta_title);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc && content.meta_description) twDesc.setAttribute('content', content.meta_description);

    setText('.logo__sub', content.brand_city);
    setText('.nav__link[href="#about"]', content.nav_about);
    setText('.nav__link[href="#consultation"]', content.nav_consultation);
    setText('.nav__link[href="#services"]', content.nav_services);
    setText('.nav__link[href="#reviews"]', content.nav_reviews);
    setText('.nav__link[href="#contacts"]', content.nav_contacts);
    setText('.nav__link--staff', content.nav_staff);
    setText('.header__admin', content.nav_staff);

    const bookUrl = content.booking_url || content.footer_booking_url || '';
    const bookHref = bookingHref(bookUrl) || bookUrl;
    if (bookHref) {
      document.querySelectorAll('[data-cms-booking]').forEach((el) => {
        el.href = bookHref;
      });
    }
    if (content.hero_cta_book != null) {
      document.querySelectorAll('[data-cms-cta="book"]').forEach((el) => {
        const icon = el.querySelector('.btn__icon');
        el.textContent = content.hero_cta_book;
        if (icon) el.insertBefore(icon, el.firstChild);
      });
    }
    if (content.hero_cta_consult != null) {
      document.querySelectorAll('[data-cms-cta="consult"]').forEach((el) => {
        el.textContent = content.hero_cta_consult;
      });
    }
    if (content.hero_cta_book_consult != null) {
      document.querySelectorAll('[data-cms-cta="book_consult"]').forEach((el) => {
        const icon = el.querySelector('.btn__icon');
        const label = content.hero_cta_book_consult;
        if (icon) {
          el.innerHTML = '';
          el.appendChild(icon);
          el.appendChild(document.createTextNode(' ' + label));
        } else {
          el.textContent = label;
        }
      });
    }
    if (content.hero_cta_services != null) {
      document.querySelectorAll('[data-cms-cta="services"]').forEach((el) => {
        el.textContent = content.hero_cta_services;
      });
    }
    if (content.consultation_cta_label != null) {
      document.querySelectorAll('[data-cms-cta="recommendations"]').forEach((el) => {
        el.textContent = content.consultation_cta_label;
      });
    }
    if (content.footer_cta_label != null) {
      document.querySelectorAll('[data-cms-cta="footer_book"]').forEach((el) => {
        el.textContent = content.footer_cta_label;
      });
    }
    if (content.footer_map_url) {
      const mapLink = document.querySelector('[data-cms-map]');
      if (mapLink) mapLink.href = content.footer_map_url;
    }

    setHtml('.hero__title--slogan', content.hero_slogan_html);
    const heroValues = document.querySelectorAll('.hero__stats .hero__stat-value');
    const heroLabels = document.querySelectorAll('.hero__stats .hero__stat-label');
    if (heroValues[0] && content.hero_stat_rating != null) heroValues[0].textContent = content.hero_stat_rating;
    if (heroLabels[0] && content.hero_stat_rating_label != null) heroLabels[0].textContent = content.hero_stat_rating_label;
    if (heroValues[1] && content.hero_stat_reviews != null) heroValues[1].textContent = content.hero_stat_reviews;
    if (heroLabels[1] && content.hero_stat_reviews_label != null) heroLabels[1].textContent = content.hero_stat_reviews_label;

    setText('#about .section__eyebrow', content.about_eyebrow);
    setHtml('#about .section__title', content.about_title_html);
    if (Array.isArray(content.about_checklist)) {
      const ul = document.querySelector('#about .checklist');
      if (ul) ul.innerHTML = content.about_checklist.map(t => `<li>${escapeHtml(t)}</li>`).join('');
    }

    function setTextIn(root, sel, text) {
      if (text == null || text === '' || !root) return;
      const el = root.querySelector(sel);
      if (el) el.textContent = text;
    }
    function setHtmlIn(root, sel, html) {
      if (html == null || html === '' || !root) return;
      const el = root.querySelector(sel);
      if (el) el.innerHTML = html;
    }
    const audSec = document.querySelector('.audience-list')?.closest('.section');
    if (audSec) {
      setTextIn(audSec, '.section__eyebrow', content.audience_eyebrow);
      setHtmlIn(audSec, '.section__title', content.audience_title_html);
      setTextIn(audSec, '.section__lead', content.audience_lead);
    }
    if (Array.isArray(content.audience_list)) {
      const ul = document.querySelector('.audience-list');
      if (ul) ul.innerHTML = content.audience_list.map(t => `<li>${escapeHtml(t)}</li>`).join('');
    }

    setText('#consultation .section__eyebrow', content.consultation_eyebrow);
    setHtml('#consultation .section__title', content.consultation_title_html);
    setHtml('.consultation-block__quote', content.consultation_quote_html);
    setText('.consultation-block__steps h3', content.consultation_steps_title);
    if (Array.isArray(content.consultation_steps)) {
      const ul = document.querySelector('.consultation-block__steps ul');
      if (ul) ul.innerHTML = content.consultation_steps.map(t => `<li>${escapeHtml(t)}</li>`).join('');
    }
    const freeCards = document.querySelectorAll('.free-card p');
    if (freeCards[0] && content.consultation_free_1 != null) freeCards[0].textContent = content.consultation_free_1;
    if (freeCards[1] && content.consultation_free_2 != null) freeCards[1].textContent = content.consultation_free_2;
    const freeLabels = document.querySelectorAll('.free-card__label');
    if (freeLabels[0] && content.format_card_1_price != null) freeLabels[0].textContent = content.format_card_1_price;
    if (freeLabels[1] && content.format_card_2_price != null) freeLabels[1].textContent = content.format_card_2_price;

    setText('.master .section__eyebrow', content.master_eyebrow);
    setHtml('.master .master__title', content.master_title_html);
    setText('.master__highlight', content.master_highlight);

    const approachSec = document.querySelector('.approach-grid')?.closest('.section');
    if (approachSec) {
      setTextIn(approachSec, '.section__eyebrow', content.approach_eyebrow);
      setHtmlIn(approachSec, '.section__title', content.approach_title_html);
      setHtmlIn(approachSec, '.section__subtitle', content.approach_subtitle_html);
      setTextIn(approachSec, '.section__lead', content.approach_lead);
      setHtmlIn(approachSec, '.approach-card__title', content.approach_card_title_html);
    }
    if (Array.isArray(content.approach_grid)) {
      const grid = document.querySelector('.approach-grid');
      if (grid) {
        grid.innerHTML = content.approach_grid.map((t) => {
          const parts = String(t).trim().split(/\s+/);
          const first = parts.shift() || '';
          const rest = parts.join(' ');
          return `<div class="approach-item"><span class="accent">${escapeHtml(first)}</span>${rest ? ' ' + escapeHtml(rest) : ''}</div>`;
        }).join('');
      }
    }
    setHtml('.approach-principles__title', content.approach_principles_title_html);
    if (Array.isArray(content.approach_principles_list_html)) {
      const ul = document.querySelector('.approach-principles ul');
      if (ul) ul.innerHTML = content.approach_principles_list_html.map(h => `<li>${h}</li>`).join('');
    }

    setText('#services .section__eyebrow', content.services_eyebrow);
    setHtml('#services .section__title', content.services_title_html);
    setText('#services .section__lead', content.services_lead);

    const benSec = document.querySelector('.benefits-list')?.closest('.section');
    if (benSec) {
      setTextIn(benSec, '.section__eyebrow', content.benefits_eyebrow);
      setHtmlIn(benSec, '.section__title', content.benefits_title_html);
      setTextIn(benSec, '.section__lead', content.benefits_lead);
    }
    if (Array.isArray(content.benefits_items)) {
      const ul = document.querySelector('.benefits-list');
      if (ul) {
        ul.innerHTML = content.benefits_items.map((t, i) => {
          const num = String(i + 1).padStart(2, '0');
          const featured = i === content.benefits_items.length - 1 ? ' benefit-card--featured' : '';
          return `<li class="benefit-card${featured}"><span class="benefit-card__num">${num}</span><span class="benefit-card__text">${escapeHtml(t)}</span></li>`;
        }).join('');
      }
    }

    const faqSec = document.querySelector('.faq-grid')?.closest('.section');
    if (faqSec) {
      setTextIn(faqSec, '.section__eyebrow', content.faq_eyebrow);
      setHtmlIn(faqSec, '.section__title', content.faq_title_html);
    }
    if (Array.isArray(content.faq_items)) {
      const grid = document.querySelector('.faq-grid');
      if (grid) {
        grid.innerHTML = content.faq_items.map(item => (
          `<div class="faq-item"><h3>${escapeHtml(item.q || '')}</h3><p>${escapeHtml(item.a || '')}</p></div>`
        )).join('');
      }
    }

    const revSec = document.querySelector('#reviews');
    if (revSec) {
      setTextIn(revSec, '.section__eyebrow', content.reviews_eyebrow);
      setHtmlIn(revSec, '.section__title', content.reviews_title_html);
      setTextIn(revSec, '.section__lead', content.reviews_lead);
    }
    if (Array.isArray(content.reviews)) {
      const track = document.getElementById('reviewsTrack');
      if (track) {
        const userCards = [...track.querySelectorAll('.review-card[data-review-id]')];
        track.innerHTML = content.reviews.map((r) => {
          const stars = '★'.repeat(Math.min(5, Math.max(1, Number(r.stars) || 5)));
          return `<div class="review-card"><span class="review-card__quote" aria-hidden="true">"</span><div class="review-card__stars">${stars}</div><p class="review-card__text">${escapeHtml(r.text || '')}</p><span class="review-card__author">${escapeHtml(r.author || '')}</span></div>`;
        }).join('');
        if (userCards.length) {
          const fragment = document.createDocumentFragment();
          userCards.forEach((card) => fragment.appendChild(card));
          track.insertBefore(fragment, track.firstChild);
        }
      }
    }

    const fmtSec = document.querySelector('.format-cards')?.closest('.section');
    if (fmtSec) {
      setTextIn(fmtSec, '.section__eyebrow', content.format_eyebrow);
      setHtmlIn(fmtSec, '.section__title', content.format_title_html);
    }
    const fmtCards = document.querySelectorAll('.format-card');
    if (fmtCards[0]) {
      if (content.format_card_1_price != null) fmtCards[0].querySelector('.format-card__price').textContent = content.format_card_1_price;
      if (content.format_card_1_text != null) fmtCards[0].querySelector('p').textContent = content.format_card_1_text;
    }
    if (fmtCards[1]) {
      if (content.format_card_2_price != null) fmtCards[1].querySelector('.format-card__price').textContent = content.format_card_2_price;
      if (content.format_card_2_text != null) fmtCards[1].querySelector('p').textContent = content.format_card_2_text;
    }
    if (fmtCards[2]) {
      const hoursText = content.format_card_3_text != null ? content.format_card_3_text : content.footer_hours;
      if (content.format_card_3_price != null) fmtCards[2].querySelector('.format-card__price').textContent = content.format_card_3_price;
      if (hoursText != null) fmtCards[2].querySelector('p').textContent = hoursText;
    }

    setHtml('#booking .section__title', content.booking_title_html);
    setText('#booking .cta-row__info > p', content.booking_text);
    if (Array.isArray(content.booking_principles)) {
      const ul = document.querySelector('.cta-principles');
      if (ul) ul.innerHTML = content.booking_principles.map(t => `<li>${escapeHtml(t)}</li>`).join('');
    }

    setText('.footer__name', content.footer_name);
    setText('.footer__master', content.footer_master);
    setText('.footer__spec', content.footer_spec);
    setText('.footer__contacts-title', content.footer_contacts_title);
    setText('[data-cms="footer_address"]', content.footer_address);
    setText('[data-cms="footer_entrance"]', content.footer_entrance);
    setText('[data-cms="footer_hours"]', content.footer_hours);
    setText('.footer__legal-note', content.footer_legal_note);
    const phoneLink = document.querySelector('.footer__contact-item a[href^="tel:"]');
    if (phoneLink) {
      if (content.footer_phone) phoneLink.href = 'tel:' + String(content.footer_phone).replace(/\s/g, '');
      if (content.footer_phone_label) phoneLink.textContent = content.footer_phone_label;
    }
    const bookingPhone = document.getElementById('bookingPhone');
    if (bookingPhone && content.footer_phone) {
      bookingPhone.href = 'tel:' + String(content.footer_phone).replace(/\s/g, '');
      bookingPhone.dataset.phone = content.footer_phone;
      bookingPhone.textContent = content.footer_phone;
    }
    const vkLink = document.querySelector('.footer__contact-item a[href*="vk.ru"], .footer__contact-item a[href*="vk.com"]');
    if (vkLink) {
      if (content.footer_vk_url) vkLink.href = content.footer_vk_url;
      if (content.footer_vk) vkLink.textContent = content.footer_vk;
    }
    const bookLink = document.querySelector('.footer__contact-item a[href*="mst.link"], .footer__contact-item a[data-cms-footer-booking]');
    if (bookLink) {
      const footerBook = content.footer_booking_url || bookUrl;
      if (footerBook) bookLink.href = bookingHref(footerBook) || footerBook;
      if (content.footer_booking_label) bookLink.textContent = content.footer_booking_label;
    }
    const siteLink = document.querySelector('.footer__contact-item a[href*="StudiaMai"], .footer__contact-item a[data-cms-footer-site]');
    if (siteLink) {
      if (content.footer_site_url) siteLink.href = content.footer_site_url;
      if (content.footer_site_label) siteLink.textContent = content.footer_site_label;
    }
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

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildPriceItemHtml(item) {
    if (item.type === 'subtitle') {
      const text = item.text || '';
      if (!text) return '';
      return `<li class="price-list__subtitle">${escapeHtml(text)}</li>`;
    }

    const name = item.name || '';
    if (!name && !item.price && !item.time && !item.details) return '';

    let priceClass = 'price-item__price';
    const price = item.price || '';
    if (/^(от\s*)?0\s*₽|бесплатн/i.test(price)) priceClass += ' price-free';

    let html = '<li class="price-item">';
    html += '<div class="price-item__row">';
    html += `<span class="price-item__name">${escapeHtml(name)}</span>`;
    if (price) html += `<span class="${priceClass}">${escapeHtml(price)}</span>`;
    html += '</div>';
    if (item.time) html += `<span class="price-item__time">${escapeHtml(item.time)}</span>`;
    if (item.details) {
      html += `<details class="price-item__details"><summary>Подробнее</summary><p>${escapeHtml(item.details)}</p></details>`;
    }
    html += '</li>';
    return html;
  }

  function normalizeServiceItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
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
    }).filter(Boolean);
  }

  function applyServices(services) {
    if (!services) return;

    document.querySelectorAll('[data-service-title]').forEach((el) => {
      const key = el.dataset.serviceTitle;
      const titleHtml = services[key]?.title_html;
      if (titleHtml) el.innerHTML = titleHtml;
    });

    document.querySelectorAll('[data-service-prices]').forEach((ul) => {
      const key = ul.dataset.servicePrices;
      const data = services[key];
      const items = normalizeServiceItems(data?.items);
      const pricesWrap = ul.closest('.service-card__prices');

      if (!items.length) {
        ul.innerHTML = '';
        if (pricesWrap) pricesWrap.classList.add('service-card__prices--pending');
        return;
      }

      ul.innerHTML = items.map(buildPriceItemHtml).filter(Boolean).join('');
      if (pricesWrap) pricesWrap.classList.remove('service-card__prices--pending');
    });

    document.querySelectorAll('[data-service-desc]').forEach((el) => {
      const key = el.dataset.serviceDesc;
      const desc = services[key]?.desc;
      if (desc) {
        el.textContent = desc;
        el.hidden = false;
      } else {
        el.textContent = '';
        el.hidden = true;
      }
    });
  }

  async function loadServicesData() {
    const fromFile = await fetchDataJson('services.json');
    if (IS_ADMIN) {
      return mergeObjects(fromFile || {}, readStorageJson(STORAGE_SERVICES) || {});
    }
    return fromFile || {};
  }

  async function loadCms() {
    await resolveCacheBust();
    const [data, services] = await Promise.all([
      loadContentData(),
      loadServicesData()
    ]);
    applyContent(data.content);
    applyImages(data.images);
    applyServices(services);
    document.dispatchEvent(new CustomEvent('studia-mai-cms-applied'));
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

  let bookingSubmitting = false;

  async function submitBooking(form, msgEl) {
    if (bookingSubmitting) return;
    const data = getFormData(form);
    const submitBtn = form.querySelector('[type="submit"], #submitBooking');

    if (!data.name || !data.phone) {
      showFormMessage(msgEl, 'Заполните имя и телефон', false);
      return;
    }
    if (!data.consent) {
      showFormMessage(msgEl, 'Подтвердите согласие на обработку данных', false);
      return;
    }

    bookingSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
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

      if (delivered) {
        showFormMessage(msgEl, 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.', true);
        form.reset();
        return;
      }

      showFormMessage(msgEl, 'Заявка сохранена локально. Не удалось отправить уведомление — попробуйте ещё раз или позвоните нам.', false);
    } finally {
      bookingSubmitting = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  window.StudiaMaiSite = {
    loadCms,
    loadContentData,
    loadServicesData,
    loadSiteConfig,
    applyContent,
    applyImages,
    applyServices,
    readLocalBookings,
    saveLocalBookings,
    sendAdminEmail: (subject, message) => notifyEmail({ notificationEmail: DEFAULT_ADMIN_EMAIL }, subject, message),
    DEFAULT_ADMIN_EMAIL,
    STORAGE_CONTENT,
    STORAGE_IMAGES,
    STORAGE_SERVICES,
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
  });
})();
