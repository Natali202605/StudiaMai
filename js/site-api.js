(function () {
  const API = window.STUDIA_MAI_API;
  const DATA_BASE = window.STUDIA_MAI_DATA_BASE || 'data';
  const DEFAULT_ADMIN_EMAIL = 'brow_studia_may@mail.ru';
  const DATA_CACHE_VERSION = 'cms14';
  let cacheBust = DATA_CACHE_VERSION;

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

  const THEME_IDS = ['sage', 'powder', 'champagne', 'lavender', 'tide', 'silver', 'pearl', 'cocoa', 'noir', 'rose', 'olive'];

  function applyTheme(theme) {
    const id = theme && typeof theme.id === 'string' ? theme.id : 'mint';
    const next = THEME_IDS.indexOf(id) === -1 ? '' : id;
    const current = document.documentElement.getAttribute('data-theme') || '';
    if (current !== next) {
      if (!next) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', next);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
      if (color) meta.setAttribute('content', color);
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

  function isUploadedImage(value) {
    return value === '__removed__' || (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('live:')));
  }

  function mergeImages(base, extra) {
    const out = { ...(base || {}) };
    if (!extra || typeof extra !== 'object') return out;
    Object.keys(extra).forEach((key) => {
      const value = extra[key];
      if (typeof value !== 'string' || !value) return;
      if (isUploadedImage(value) || !out[key]) out[key] = value;
    });
    return out;
  }

  function mergeServices(base, extra) {
    const out = { ...(base || {}) };
    if (!extra || typeof extra !== 'object') return out;
    Object.keys(extra).forEach((key) => {
      const next = extra[key];
      const prev = out[key];
      if (!next || typeof next !== 'object' || Array.isArray(next) || !prev || typeof prev !== 'object' || Array.isArray(prev)) {
        out[key] = next;
        return;
      }
      const merged = { ...prev, ...next };
      const nextItems = Array.isArray(next.items) ? next.items : [];
      const prevItems = Array.isArray(prev.items) ? prev.items : [];
      if (!nextItems.length && prevItems.length) {
        merged.items = prevItems;
        if (String(prev.desc || '').trim()) merged.desc = prev.desc;
        if (String(prev.title_html || '').trim()) merged.title_html = prev.title_html;
      } else {
        if (!String(next.desc || '').trim() && String(prev.desc || '').trim()) merged.desc = prev.desc;
        if (!String(next.title_html || '').trim() && String(prev.title_html || '').trim()) merged.title_html = prev.title_html;
      }
      out[key] = merged;
    });
    return out;
  }

  let liveBundlePromise = null;

  function loadLiveBundle() {
    if (!liveBundlePromise) {
      const live = window.StudiaMaiLive;
      const read = live && typeof live.readBundle === 'function'
        ? live.readBundle().catch(() => null)
        : Promise.resolve(null);
      liveBundlePromise = Promise.race([
        read,
        new Promise((resolve) => setTimeout(() => resolve(null), 800))
      ]);
    }
    return liveBundlePromise;
  }

  async function loadSiteConfig() {
    const [fromFile, live] = await Promise.all([fetchDataJson('config.json'), loadLiveBundle()]);
    const merged = mergeObjects(fromFile || {}, (live && live.config) || {});
    if (!merged.notificationEmail) merged.notificationEmail = DEFAULT_ADMIN_EMAIL;
    return merged;
  }

  async function loadContentData() {
    const fromApi = await fetchJson('/api/content');
    if (fromApi?.content) {
      return { content: fromApi.content, images: fromApi.images || {} };
    }
    const [contentFile, imagesFile, live] = await Promise.all([
      fetchDataJson('content.json'),
      fetchDataJson('images.json'),
      loadLiveBundle()
    ]);
    const content = mergeObjects(contentFile || {}, (live && live.content) || {});
    const images = mergeImages(imagesFile || {}, (live && live.images) || {});
    return { content, images };
  }

  function fillHoursList(el, text) {
    const rows = String(text || '')
      .split(/[·•|\n]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const match = part.match(/^(\S+)\s+(.+)$/);
        return match ? { day: match[1], time: match[2] } : { day: '', time: part };
      });
    const html = rows.map((row) => {
      const off = /выходн/i.test(row.time) ? ' is-off' : '';
      return `<li><span class="hours-list__day">${escapeHtml(row.day)}</span><span class="hours-list__time${off}">${escapeHtml(row.time)}</span></li>`;
    }).join('');
    const probe = document.createElement('div');
    probe.innerHTML = html;
    const next = (probe.textContent || '').replace(/\s+/g, ' ').trim();
    const current = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (current !== next) el.innerHTML = html;
  }

  function applyContent(content) {
    if (!content) return;
    document.querySelectorAll('[data-cms]').forEach(el => {
      const key = el.dataset.cms;
      if (content[key] != null && content[key] !== '') {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          if (el.value !== content[key]) el.value = content[key];
        } else if (el.tagName !== 'UL' && key !== 'master_p3' && el.textContent !== content[key]) {
          el.textContent = content[key];
        }
      }
    });

    const masterFlagship = document.querySelector('[data-cms="master_p3"]');
    if (masterFlagship && content.master_p3) {
      const desired = String(content.master_p3).replace(/трихология/ig, 'Трихология').replace(/\s+/g, ' ').trim();
      const current = masterFlagship.textContent.replace(/\s+/g, ' ').trim();
      if (current !== desired || !masterFlagship.querySelector('.master__flagship')) {
        masterFlagship.innerHTML = escapeHtml(content.master_p3).replace(
          /трихология/i,
          '<span class="master__flagship">Трихология</span>'
        );
      }
    }

    function plainText(value) {
      return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function setHtml(sel, html) {
      if (html == null || html === '') return;
      const el = document.querySelector(sel);
      if (!el || plainText(el.textContent) === plainText(html)) return;
      el.innerHTML = html;
    }
    function setText(sel, text) {
      if (text == null || text === '') return;
      const el = document.querySelector(sel);
      if (el && el.textContent !== text) el.textContent = text;
    }
    function replaceHtmlIfChanged(el, html) {
      if (!el || html == null) return;
      if (plainText(el.textContent) === plainText(html)) return;
      el.innerHTML = html;
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
        if (el.textContent.trim() === String(content.hero_cta_book).trim()) return;
        const icon = el.querySelector('.btn__icon');
        el.textContent = content.hero_cta_book;
        if (icon) el.insertBefore(icon, el.firstChild);
      });
    }
    if (content.hero_cta_consult != null) {
      document.querySelectorAll('[data-cms-cta="consult"]').forEach((el) => {
        if (el.textContent !== content.hero_cta_consult) el.textContent = content.hero_cta_consult;
      });
    }
    if (content.hero_cta_book_consult != null) {
      document.querySelectorAll('[data-cms-cta="book_consult"]').forEach((el) => {
        const label = content.hero_cta_book_consult;
        if (el.textContent.trim() === String(label).trim()) return;
        const icon = el.querySelector('.btn__icon');
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
        if (el.textContent !== content.hero_cta_services) el.textContent = content.hero_cta_services;
      });
    }
    if (content.consultation_cta_label != null) {
      document.querySelectorAll('[data-cms-cta="recommendations"]').forEach((el) => {
        if (el.textContent !== content.consultation_cta_label) el.textContent = content.consultation_cta_label;
      });
    }
    if (content.footer_cta_label != null) {
      document.querySelectorAll('[data-cms-cta="footer_book"]').forEach((el) => {
        if (el.textContent !== content.footer_cta_label) el.textContent = content.footer_cta_label;
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
    if (heroValues[1] && content.hero_stat_reviews != null && content.hero_stat_reviews !== '') {
      heroValues[1].textContent = content.hero_stat_reviews;
    }
    if (heroLabels[1] && content.hero_stat_reviews_label != null) heroLabels[1].textContent = content.hero_stat_reviews_label;

    setText('#about .section__eyebrow', content.about_eyebrow);
    setHtml('#about .section__title', content.about_title_html);
    if (Array.isArray(content.about_checklist)) {
      const ul = document.querySelector('#about .checklist');
      if (ul) replaceHtmlIfChanged(ul, content.about_checklist.map(t => `<li>${escapeHtml(t)}</li>`).join(''));
    }

    function setTextIn(root, sel, text) {
      if (text == null || text === '' || !root) return;
      const el = root.querySelector(sel);
      if (el && el.textContent !== text) el.textContent = text;
    }
    function setHtmlIn(root, sel, html) {
      if (html == null || html === '' || !root) return;
      replaceHtmlIfChanged(root.querySelector(sel), html);
    }
    const audSec = document.querySelector('.audience-list')?.closest('.section');
    if (audSec) {
      setTextIn(audSec, '.section__eyebrow', content.audience_eyebrow);
      setHtmlIn(audSec, '.section__title', content.audience_title_html);
      setTextIn(audSec, '.section__lead', content.audience_lead);
    }
    if (Array.isArray(content.audience_list)) {
      const ul = document.querySelector('.audience-list');
      if (ul) replaceHtmlIfChanged(ul, content.audience_list.map(t => `<li>${escapeHtml(t)}</li>`).join(''));
    }

    setText('#consultation .section__eyebrow', content.consultation_eyebrow);
    setHtml('#consultation .section__title', content.consultation_title_html);
    setHtml('.consultation-block__quote', content.consultation_quote_html);
    setText('.consultation-block__steps h3', content.consultation_steps_title);
    if (Array.isArray(content.consultation_steps)) {
      const ul = document.querySelector('.consultation-block__steps ul');
      if (ul) replaceHtmlIfChanged(ul, content.consultation_steps.map(t => `<li>${escapeHtml(t)}</li>`).join(''));
    }
    const freeCards = document.querySelectorAll('.free-card p');
    if (freeCards[0] && content.consultation_free_1 != null) freeCards[0].textContent = content.consultation_free_1;
    if (freeCards[1] && content.consultation_free_2 != null) freeCards[1].textContent = content.consultation_free_2;
    const freeLabels = document.querySelectorAll('.free-card__label');
    if (freeLabels[0] && content.consultation_free_label_1 != null) freeLabels[0].textContent = content.consultation_free_label_1;
    if (freeLabels[1] && content.consultation_free_label_2 != null) freeLabels[1].textContent = content.consultation_free_label_2;

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
        replaceHtmlIfChanged(grid, content.approach_grid.map((t) => {
          const parts = String(t).trim().split(/\s+/);
          const first = parts.shift() || '';
          const rest = parts.join(' ');
          return `<div class="approach-item"><span class="accent">${escapeHtml(first)}</span>${rest ? ' ' + escapeHtml(rest) : ''}</div>`;
        }).join(''));
      }
    }
    setHtml('.approach-principles__title', content.approach_principles_title_html);
    if (Array.isArray(content.approach_principles_list_html)) {
      const ul = document.querySelector('.approach-principles ul');
      if (ul) replaceHtmlIfChanged(ul, content.approach_principles_list_html.map(h => `<li>${h}</li>`).join(''));
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
        replaceHtmlIfChanged(ul, content.benefits_items.map((t, i) => {
          const num = String(i + 1).padStart(2, '0');
          const featured = i === content.benefits_items.length - 1 ? ' benefit-card--featured' : '';
          return `<li class="benefit-card${featured}"><span class="benefit-card__num">${num}</span><span class="benefit-card__text">${escapeHtml(t)}</span></li>`;
        }).join(''));
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
        replaceHtmlIfChanged(grid, content.faq_items.map(item => (
          `<div class="faq-item"><h3>${escapeHtml(item.q || '')}</h3><p>${escapeHtml(item.a || '')}</p></div>`
        )).join(''));
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
        const html = content.reviews.map((r) => {
          const stars = '★'.repeat(Math.min(5, Math.max(1, Number(r.stars) || 5)));
          return `<div class="review-card"><span class="review-card__quote" aria-hidden="true">"</span><div class="review-card__stars">${stars}</div><p class="review-card__text">${escapeHtml(r.text || '')}</p><span class="review-card__author">${escapeHtml(r.author || '')}</span></div>`;
        }).join('');
        const staticCards = [...track.querySelectorAll('.review-card:not([data-review-id])')];
        const current = staticCards.map((card) => plainText(card.textContent)).join('|');
        const probe = document.createElement('div');
        probe.innerHTML = html;
        const next = [...probe.children].map((card) => plainText(card.textContent)).join('|');
        if (current !== next) {
          const userCards = [...track.querySelectorAll('.review-card[data-review-id]')];
          track.innerHTML = html;
          if (userCards.length) {
            const fragment = document.createDocumentFragment();
            userCards.forEach((card) => fragment.appendChild(card));
            track.insertBefore(fragment, track.firstChild);
          }
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
      const priceEl = fmtCards[0].querySelector('.format-card__price');
      const textEl = fmtCards[0].querySelector('p');
      if (priceEl && content.format_card_1_price != null) priceEl.textContent = content.format_card_1_price;
      if (textEl && content.format_card_1_text != null) textEl.textContent = content.format_card_1_text;
    }
    if (fmtCards[1]) {
      const priceEl = fmtCards[1].querySelector('.format-card__price');
      const textEl = fmtCards[1].querySelector('p');
      if (priceEl && content.format_card_2_price != null) priceEl.textContent = content.format_card_2_price;
      if (textEl && content.format_card_2_text != null) textEl.textContent = content.format_card_2_text;
    }
    if (fmtCards[2]) {
      const hoursText = content.format_card_3_text != null ? content.format_card_3_text : content.footer_hours;
      const priceEl = fmtCards[2].querySelector('.format-card__price');
      const hoursEl = fmtCards[2].querySelector('.hours-list');
      const textEl = fmtCards[2].querySelector('p');
      if (priceEl && content.format_card_3_price != null) priceEl.textContent = content.format_card_3_price;
      if (hoursEl && hoursText != null) fillHoursList(hoursEl, hoursText);
      else if (textEl && hoursText != null) textEl.textContent = hoursText;
    }

    setHtml('#booking .section__title', content.booking_title_html);
    setText('#booking .cta-row__info > p', content.booking_text);
    if (Array.isArray(content.booking_principles)) {
      const ul = document.querySelector('.cta-principles');
      if (ul) replaceHtmlIfChanged(ul, content.booking_principles.map(t => `<li>${escapeHtml(t)}</li>`).join(''));
    }

    setText('.footer__name', content.footer_name);
    setText('.footer__master', content.footer_master);
    setText('.footer__spec', content.footer_spec);
    setText('.footer__contacts-title', content.footer_contacts_title);
    setText('[data-cms="footer_address"]', content.footer_address);
    setText('[data-cms="footer_entrance"]', content.footer_entrance);
    const footerHours = document.querySelector('[data-cms="footer_hours"]');
    if (footerHours && footerHours.tagName === 'UL' && content.footer_hours != null) {
      fillHoursList(footerHours, content.footer_hours);
    } else {
      setText('[data-cms="footer_hours"]', content.footer_hours);
    }
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
    const siteLink = document.querySelector('.footer__contact-item a[href*="studia-mai.ru"], .footer__contact-item a[data-cms-footer-site]');
    if (siteLink) {
      if (content.footer_site_url) siteLink.href = content.footer_site_url;
      if (content.footer_site_label) siteLink.textContent = content.footer_site_label;
    }

    function setPlaceholder(id, text) {
      if (text == null || text === '') return;
      const el = document.getElementById(id);
      if (el && el.getAttribute('placeholder') !== text) el.setAttribute('placeholder', text);
    }
    setPlaceholder('bookingName', content.booking_name_ph);
    setPlaceholder('bookingSurname', content.booking_surname_ph);
    setPlaceholder('bookingPhoneField', content.booking_phone_ph);
    setPlaceholder('bookingEmail', content.booking_email_ph);
    setPlaceholder('bookingComment', content.booking_comment_ph);
    setPlaceholder('reviewAuthor', content.review_author_ph);
    setPlaceholder('reviewText', content.review_text_ph);

    if (content.image_alts && typeof content.image_alts === 'object') {
      document.querySelectorAll('[data-cms-img]').forEach((el) => {
        const alt = content.image_alts[el.dataset.cmsImg];
        if (alt && el.alt !== alt) el.alt = alt;
      });
    }

    const ldScript = document.getElementById('siteJsonLd');
    if (ldScript) {
      try {
        const data = JSON.parse(ldScript.textContent);
        const graph = Array.isArray(data['@graph']) ? data['@graph'] : [];
        const business = graph.find((node) => {
          const type = node && node['@type'];
          return type === 'BeautySalon' || (Array.isArray(type) && type.indexOf('BeautySalon') !== -1);
        });
        if (business) {
          if (content.footer_name) business.name = content.footer_name;
          if (content.meta_description) business.description = content.meta_description;
          if (content.footer_phone) business.telephone = String(content.footer_phone).replace(/[^\d+]/g, '');
          if (content.footer_address && business.address) business.address.streetAddress = content.footer_address;
          if (content.brand_city && business.address) business.address.addressLocality = content.brand_city;
          if (content.brand_city && business.areaServed) business.areaServed.name = content.brand_city;
          if (content.footer_vk_url || content.booking_url) {
            business.sameAs = [
              content.footer_vk_url || (business.sameAs && business.sameAs[0]) || '',
              content.booking_url || content.footer_booking_url || (business.sameAs && business.sameAs[1]) || ''
            ].filter(Boolean);
          }
          if (content.footer_master && business.employee) business.employee.name = content.footer_master;
          if (content.master_role && business.employee) business.employee.jobTitle = content.master_role;
        }
        const website = graph.find((node) => node && node['@type'] === 'WebSite');
        if (website) {
          if (content.footer_name) website.name = content.footer_name;
          if (content.meta_description) website.description = content.meta_description;
        }
        const webpage = graph.find((node) => node && node['@type'] === 'WebPage');
        if (webpage) {
          if (content.meta_title) webpage.name = content.meta_title;
          if (content.meta_description) webpage.description = content.meta_description;
        }
        ldScript.textContent = JSON.stringify(data);
      } catch { /* карточка сайта остаётся как в странице */ }
    }
  }

  const EMPTY_PHOTO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  function applyImages(images) {
    if (!images) return;
    document.querySelectorAll('[data-cms-img]').forEach(el => {
      const key = el.dataset.cmsImg;
      el.style.display = '';
      if (images[key] === '__removed__') {
        el.classList.add('is-cms-empty');
        if (el.getAttribute('src') !== EMPTY_PHOTO) el.src = EMPTY_PHOTO;
        return;
      }
      el.classList.remove('is-cms-empty');
      if (images[key]) {
        const src = images[key].startsWith('/') && API ? API + images[key] : images[key];
        if (el.getAttribute('src') !== src) el.src = src;
      }
    });
  }

  function fillServiceDesc(el, desc) {
    const lines = String(desc).split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) {
      el.classList.remove('service-card__desc--points');
      if (el.textContent !== desc) el.textContent = desc;
      return;
    }
    const lead = lines[0];
    const items = lines.slice(1).map((line) => line.replace(/^[*•—–-]\s*/, '').replace(/\.$/, ''));
    const html = `<p class="service-card__desc-lead">${escapeHtml(lead)}</p><ul class="service-card__points">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    const probe = document.createElement('div');
    probe.innerHTML = html;
    const next = (probe.textContent || '').replace(/\s+/g, ' ').trim();
    const current = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (current === next && el.classList.contains('service-card__desc--points')) return;
    el.classList.add('service-card__desc--points');
    el.innerHTML = html;
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
    if (/^(от\s*)?0\s*₽|бе[сз]платн/i.test(price)) priceClass += ' price-free';

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
    if (!services || typeof services !== 'object') return;

    document.querySelectorAll('[data-service-title]').forEach((el) => {
      const key = el.dataset.serviceTitle;
      if (!Object.prototype.hasOwnProperty.call(services, key)) return;
      const titleHtml = services[key]?.title_html;
      if (!titleHtml) return;
      const probe = document.createElement('div');
      probe.innerHTML = titleHtml;
      const next = (probe.textContent || '').replace(/\s+/g, ' ').trim();
      const current = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (current !== next) el.innerHTML = titleHtml;
    });

    document.querySelectorAll('[data-service-prices]').forEach((ul) => {
      const key = ul.dataset.servicePrices;
      if (!Object.prototype.hasOwnProperty.call(services, key)) return;
      const data = services[key];
      const items = normalizeServiceItems(data?.items);
      const pricesWrap = ul.closest('.service-card__prices, .rituals__prices');

      if (!items.length) return;

      const html = items.map(buildPriceItemHtml).filter(Boolean).join('');
      const probe = document.createElement('div');
      probe.innerHTML = html;
      const next = (probe.textContent || '').replace(/\s+/g, ' ').trim();
      const current = (ul.textContent || '').replace(/\s+/g, ' ').trim();
      if (current !== next) ul.innerHTML = html;
      if (pricesWrap) pricesWrap.classList.remove('service-card__prices--pending');
    });

    document.querySelectorAll('[data-service-desc]').forEach((el) => {
      const key = el.dataset.serviceDesc;
      if (!Object.prototype.hasOwnProperty.call(services, key)) return;
      const desc = services[key]?.desc;
      if (desc) {
        fillServiceDesc(el, desc);
        el.hidden = false;
      }
    });
  }

  async function loadServicesData() {
    const [fromFile, live] = await Promise.all([fetchDataJson('services.json'), loadLiveBundle()]);
    return mergeServices(fromFile || {}, (live && live.services) || {});
  }

  async function loadCms() {
    await resolveCacheBust();
    const themeFilePromise = fetchDataJson('theme.json');
    themeFilePromise.then((themeFile) => {
      if (themeFile && themeFile.id) applyTheme(themeFile);
    });
    const [data, services, themeFile, live] = await Promise.all([
      loadContentData(),
      loadServicesData(),
      themeFilePromise,
      loadLiveBundle()
    ]);
    const liveTheme = live && live.theme;
    const liveId = liveTheme && typeof liveTheme.id === 'string' ? liveTheme.id : '';
    if (THEME_IDS.indexOf(liveId) !== -1) applyTheme(liveTheme);
    else if (themeFile && themeFile.id) applyTheme(themeFile);
    applyContent(data.content);
    applyImages(data.images);
    if (services) applyServices(services);
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

  async function notifyEmail(config, subject, message) {
    const email = config.notificationEmail || DEFAULT_ADMIN_EMAIL;
    try {
      return false;
    } catch {
      return false;
    }
  }

  async function notifyWeb3Forms() {
    return false;
  }

  async function notifyTelegram() {
    return false;
  }

  async function saveBookingRemote() {
    return false;
  }

  let bookingSubmitting = false;

  async function submitBooking(form, msgEl) {
    if (bookingSubmitting) return;
    const data = getFormData(form);
    const submitBtn = form.querySelector('[type="submit"], #submitBooking');

    bookingSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    try {
      let intakeOn = false;
      try {
        const intakeRes = await fetch(`${DATA_BASE}/intake.json?v=${Date.now()}`, { cache: 'no-store' });
        const intake = await intakeRes.json();
        intakeOn = intake && intake.enabled === true;
      } catch { /* сбор остаётся закрытым */ }

      if (!intakeOn) {
        showFormMessage(msgEl, 'Запись через сайт временно не принимается. Позвоните: +7 902 473-78-00', false);
        return;
      }

      if (!data.phone) {
        showFormMessage(msgEl, 'Укажите телефон', false);
        return;
      }
      if (data.consent !== true) {
        showFormMessage(msgEl, 'Подтвердите согласие на обработку данных', false);
        return;
      }

      const url = apiUrl('/api/bookings');
      if (!url) {
        showFormMessage(msgEl, 'Сервер заявок не подключён. Данные не отправлены. Позвоните: +7 902 473-78-00', false);
        return;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Studia-Mai': '1' },
        body: JSON.stringify({
          name: data.name,
          surname: data.surname,
          phone: data.phone,
          email: data.email,
          comment: data.comment,
          consent: true,
          consentVersion: '2026-10-22',
          policyVersion: '2026-10-22'
        })
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok === true) {
        showFormMessage(msgEl, 'Заявка записана. Мы свяжемся для подтверждения.', true);
        form.reset();
        return;
      }
      showFormMessage(msgEl, json.error || 'Заявка не записана. Позвоните: +7 902 473-78-00', false);
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
    applyTheme,
    applyImages,
    applyServices,
    mergeImages,
    mergeServices,
    sendAdminEmail: (subject, message) => notifyEmail({ notificationEmail: DEFAULT_ADMIN_EMAIL }, subject, message),
    DEFAULT_ADMIN_EMAIL
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadCms();
    const form = document.getElementById('contactForm');
    const msgEl = document.getElementById('bookingMessage');
    if (!form) return;
    /* Заявки через Яндекс.Формы обрабатывает страница (data-booking-yandex). */
    if (form.getAttribute('data-booking-yandex') === '1') return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitBooking(form, msgEl);
    });
  });
})();
