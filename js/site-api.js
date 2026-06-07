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

  async function loadProcedures(select) {
    if (!select || !API) return;
    const data = await fetchJson('/api/procedures');
    if (!data?.procedures?.length) return;

    const current = select.value;
    select.innerHTML = '<option value="">Выберите процедуру</option>';
    const byCat = {};

    data.procedures.forEach(p => {
      const cat = p.category || 'Прочее';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(p);
    });

    Object.entries(byCat).forEach(([cat, items]) => {
      const group = document.createElement('optgroup');
      group.label = cat;
      items.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} — ${p.price}`;
        opt.dataset.name = p.name;
        group.appendChild(opt);
      });
      select.appendChild(group);
    });

    if (current) select.value = current;
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

  async function submitLead(form, msgEl) {
    const url = apiUrl('/api/leads');
    if (!url) {
      showFormMessage(msgEl, 'Сохранение данных доступно при запущенном сервере студии', false);
      return;
    }
    const data = getFormData(form);
    if (!data.name || !data.phone) {
      showFormMessage(msgEl, 'Заполните имя и телефон', false);
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) showFormMessage(msgEl, 'Данные сохранены. Мы свяжемся с вами.', true);
    else showFormMessage(msgEl, json.error || 'Не удалось отправить', false);
  }

  async function submitBooking(form, msgEl) {
    const url = apiUrl('/api/bookings');
    if (!url) {
      showFormMessage(msgEl, 'Онлайн-запись доступна при запущенном сервере студии', false);
      return;
    }
    const data = getFormData(form);
    const procSelect = form.querySelector('#bookingProcedure');
    const procId = procSelect?.value;
    const procOpt = procSelect?.selectedOptions[0];

    if (!data.name || !data.phone) {
      showFormMessage(msgEl, 'Заполните имя и телефон', false);
      return;
    }
    if (!procId) {
      showFormMessage(msgEl, 'Выберите процедуру', false);
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
        procedureId: procId,
        procedureName: procOpt?.dataset.name || procOpt?.textContent || '',
        preferredDate: form.querySelector('#bookingDate')?.value || '',
        comment: form.querySelector('#bookingComment')?.value?.trim() || ''
      })
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      showFormMessage(msgEl, 'Заявка на запись отправлена! Мы свяжемся для подтверждения.', true);
      form.querySelector('#bookingProcedure').value = '';
      form.querySelector('#bookingDate').value = '';
      if (form.querySelector('#bookingComment')) form.querySelector('#bookingComment').value = '';
    } else {
      showFormMessage(msgEl, json.error || 'Не удалось отправить заявку', false);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadCms();
    const form = document.getElementById('contactForm');
    const procSelect = document.getElementById('bookingProcedure');
    const msgEl = document.getElementById('bookingMessage');
    loadProcedures(procSelect);

    document.getElementById('submitBooking')?.addEventListener('click', () => submitBooking(form, msgEl));
    document.getElementById('saveLead')?.addEventListener('click', () => submitLead(form, msgEl));
  });
})();
