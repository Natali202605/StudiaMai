(function () {
  const API = window.STUDIA_MAI_API;

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
      if (images[key]) {
        const src = images[key].startsWith('/') && API ? API + images[key] : images[key];
        el.src = src;
      }
    });
  }

  async function loadCms() {
    if (!API) return;
    const data = await fetchJson('/api/content');
    if (!data) return;
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
      consent: form.querySelector('[name="pd_consent"]')?.checked || false
    };
  }

  function showFormMessage(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.className = 'booking-form__message' + (ok ? ' booking-form__message--ok' : ' booking-form__message--err');
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 5000);
  }

  async function submitBooking(form, msgEl) {
    const url = apiUrl('/api/bookings');
    if (!url) {
      showFormMessage(msgEl, 'Онлайн-запись доступна при запущенном сервере студии', false);
      return;
    }
    const data = getFormData(form);

    if (!data.name || !data.phone) {
      showFormMessage(msgEl, 'Заполните имя и телефон', false);
      return;
    }
    if (!data.consent) {
      showFormMessage(msgEl, 'Подтвердите согласие на обработку данных', false);
      return;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        comment: form.querySelector('#bookingComment')?.value?.trim() || ''
      })
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      showFormMessage(msgEl, 'Заявка на запись отправлена! Мы свяжемся для подтверждения.', true);
      if (form.querySelector('#bookingComment')) form.querySelector('#bookingComment').value = '';
    } else {
      showFormMessage(msgEl, json.error || 'Не удалось отправить заявку', false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCms();
    const form = document.getElementById('contactForm');
    const msgEl = document.getElementById('bookingMessage');

    document.getElementById('submitBooking')?.addEventListener('click', () => submitBooking(form, msgEl));
  });
})();
