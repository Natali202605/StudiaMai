(function () {
  'use strict';

  function apiBase() {
    var value = window.STUDIA_MAI_API || '';
    return String(value).replace(/\/$/, '');
  }

  function publicConfig(config) {
    var out = {};
    var source = config || {};
    if (typeof source.notificationEmail === 'string' && source.notificationEmail.trim()) {
      out.notificationEmail = source.notificationEmail.trim();
    }
    return out;
  }

  function readBundle() {
    return Promise.resolve({
      content: null,
      services: null,
      images: null,
      theme: null,
      config: null
    });
  }

  async function publish(payload) {
    var url = apiBase() + '/api/cms';
    var res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Studia-Mai': '1'
      },
      body: JSON.stringify({
        content: payload && payload.content || null,
        services: payload && payload.services || null,
        theme: payload && payload.theme || null,
        images: payload && payload.images || null,
        config: publicConfig(payload && payload.config)
      })
    });
    var json = await res.json().catch(function () { return {}; });
    if (!res.ok || json.ok !== true) {
      throw new Error(json.error || 'Сохранение на сайт доступно только через сервер студии. Внешнее хранилище отключено.');
    }
    return json;
  }

  window.StudiaMaiLive = {
    readBundle: readBundle,
    publish: publish,
    resolveImages: function (images) { return Promise.resolve(images); },
    publicConfig: publicConfig
  };
})();
