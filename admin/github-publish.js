(function () {
  'use strict';

  var TOKEN_KEY = 'studia_mai_github_token';
  var DEFAULTS = {
    githubOwner: 'Natali202605',
    githubRepo: 'StudiaMai',
    githubBranch: 'main'
  };

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function getPublishConfig() {
    var cfg = {};
    try {
      if (window.StudiaMaiSite && typeof window.StudiaMaiSite.loadSiteConfig === 'function') {
        /* sync fallback from local storage merge happens in admin */
      }
    } catch (e) { /* ignore */ }
    try {
      var raw = storageGet(window.StudiaMaiSite ? window.StudiaMaiSite.STORAGE_CONFIG : 'studia_mai_site_config');
      if (raw) cfg = JSON.parse(raw) || {};
    } catch (e) { cfg = {}; }
    return {
      owner: String(cfg.githubOwner || DEFAULTS.githubOwner).trim(),
      repo: String(cfg.githubRepo || DEFAULTS.githubRepo).trim(),
      branch: String(cfg.githubBranch || DEFAULTS.githubBranch).trim() || 'main',
      token: String(storageGet(TOKEN_KEY) || cfg.githubToken || '').trim()
    };
  }

  function setToken(token) {
    storageSet(TOKEN_KEY, String(token || '').trim());
  }

  function getToken() {
    return getPublishConfig().token;
  }

  function isConfigured() {
    var c = getPublishConfig();
    return Boolean(c.owner && c.repo && c.token);
  }

  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var binary = '';
    var i;
    for (i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function dataUrlToBase64(dataUrl) {
    var parts = String(dataUrl || '').split(',');
    if (parts.length < 2) return null;
    return parts[1];
  }

  function extFromDataUrl(dataUrl) {
    var m = String(dataUrl || '').match(/^data:image\/([\w+.-]+);/i);
    if (!m) return 'png';
    var type = m[1].toLowerCase();
    if (type === 'jpeg') return 'jpg';
    if (type === 'svg+xml') return 'svg';
    return type.replace(/[^a-z0-9]/g, '') || 'png';
  }

  function apiHeaders(token) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function contentsUrl(owner, repo, path) {
    return 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) +
      '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  }

  async function getFileSha(cfg, path) {
    var url = contentsUrl(cfg.owner, cfg.repo, path) + '?ref=' + encodeURIComponent(cfg.branch);
    var res = await fetch(url, { headers: apiHeaders(cfg.token) });
    if (res.status === 404) return null;
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || ('GitHub: не удалось прочитать ' + path + ' (' + res.status + ')'));
    }
    var data = await res.json();
    return data.sha || null;
  }

  async function putFile(cfg, path, contentBase64, message) {
    var sha = await getFileSha(cfg, path);
    var body = {
      message: message,
      content: contentBase64,
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    var res = await fetch(contentsUrl(cfg.owner, cfg.repo, path), {
      method: 'PUT',
      headers: apiHeaders(cfg.token),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || ('GitHub: ошибка записи ' + path + ' (' + res.status + ')'));
    }
    return res.json();
  }

  async function putJson(cfg, path, obj, message) {
    var json = JSON.stringify(obj, null, 2) + '\n';
    return putFile(cfg, path, utf8ToBase64(json), message);
  }

  function publicConfig(config) {
    var out = Object.assign({}, config || {});
    delete out.githubToken;
    return out;
  }

  async function prepareImagesForPublish(images) {
    var cfg = getPublishConfig();
    var next = Object.assign({}, images || {});
    var key;
    for (key in next) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) continue;
      var val = next[key];
      if (!val || val === '__removed__') continue;
      if (String(val).indexOf('data:image/') !== 0) continue;
      var b64 = dataUrlToBase64(val);
      if (!b64) continue;
      var ext = extFromDataUrl(val);
      var path = 'images/cms-' + key + '.' + ext;
      await putFile(cfg, path, b64, 'CMS: обновить фото ' + key);
      next[key] = path;
    }
    return next;
  }

  /**
   * Публикует данные сайта в GitHub → GitHub Pages обновляется автоматически.
   * @param {{content?:object, services?:object, images?:object, config?:object, message?:string}} payload
   */
  async function publish(payload) {
    var cfg = getPublishConfig();
    if (!cfg.token) {
      throw new Error('Не задан GitHub-токен. Откройте «Настройки» и сохраните токен публикации.');
    }
    if (!cfg.owner || !cfg.repo) {
      throw new Error('Укажите владельца и название репозитория GitHub в настройках.');
    }

    var message = payload.message || 'CMS: обновление сайта из админ-панели';
    var published = [];

    if (payload.images) {
      var images = await prepareImagesForPublish(payload.images);
      await putJson(cfg, 'data/images.json', images, message + ' (фото)');
      published.push('images.json');
      payload._publishedImages = images;
    }

    if (payload.content) {
      await putJson(cfg, 'data/content.json', payload.content, message + ' (тексты)');
      published.push('content.json');
    }

    if (payload.services) {
      await putJson(cfg, 'data/services.json', payload.services, message + ' (прайс)');
      published.push('services.json');
    }

    if (payload.config) {
      await putJson(cfg, 'data/config.json', publicConfig(payload.config), message + ' (настройки)');
      published.push('config.json');
    }

    await putJson(cfg, 'data/version.json', { v: Date.now() }, message + ' (версия кэша)');
    published.push('version.json');

    return {
      ok: true,
      files: published,
      images: payload._publishedImages || payload.images || null
    };
  }

  async function testConnection() {
    var cfg = getPublishConfig();
    if (!isConfigured()) throw new Error('Сначала сохраните GitHub-токен и репозиторий.');
    var url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo);
    var res = await fetch(url, { headers: apiHeaders(cfg.token) });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || ('Нет доступа к репозиторию (' + res.status + ')'));
    }
    var data = await res.json();
    return { ok: true, full_name: data.full_name, default_branch: data.default_branch };
  }

  window.StudiaMaiGithubPublish = {
    TOKEN_KEY: TOKEN_KEY,
    DEFAULTS: DEFAULTS,
    getPublishConfig: getPublishConfig,
    setToken: setToken,
    getToken: getToken,
    isConfigured: isConfigured,
    publish: publish,
    testConnection: testConnection,
    publicConfig: publicConfig
  };
})();
