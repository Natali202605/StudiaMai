(function () {
  'use strict';

  var TOKEN = '7d8cec5e7ea8c4e3144fd7a3c5bfe13beb1407c7ddb602a65767bdbd466b';
  var MANIFEST_PATH = 'StudiaMaiCMS-10-10';
  var CHUNK = 48000;
  var API = 'https://api.telegra.ph/';

  function emptyManifest() {
    return { docs: {}, blobs: {} };
  }

  function nodeText(node) {
    if (typeof node === 'string') return node;
    if (!node || !node.children) return '';
    var out = '';
    var i;
    for (i = 0; i < node.children.length; i++) out += nodeText(node.children[i]);
    return out;
  }

  function pageText(data) {
    var content = data && data.content;
    if (!content || !content.length) return '';
    var out = '';
    var i;
    for (i = 0; i < content.length; i++) out += nodeText(content[i]);
    return out;
  }

  async function apiGet(path) {
    var res = await fetch(API + path, { cache: 'no-store' });
    var data = await res.json();
    if (!data || data.ok === false) throw new Error((data && data.error) || 'Не удалось прочитать сохранённые данные');
    return data.result || data;
  }

  async function apiPost(method, fields) {
    var body = new URLSearchParams();
    var key;
    for (key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key) && fields[key] != null) {
        body.set(key, String(fields[key]));
      }
    }
    var res = await fetch(API + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString()
    });
    var data = await res.json();
    if (!data || data.ok === false) throw new Error((data && data.error) || 'Не удалось сохранить данные');
    return data.result || {};
  }

  function nodes(text) {
    return JSON.stringify([{ tag: 'p', children: [text] }]);
  }

  async function readPage(path) {
    var data = await apiGet('getPage/' + encodeURIComponent(path) + '?return_content=true');
    return pageText(data);
  }

  async function editPage(path, text) {
    await apiPost('editPage/' + encodeURIComponent(path), {
      access_token: TOKEN,
      title: 'StudiaMai',
      content: nodes(text),
      return_content: 'false'
    });
  }

  async function createPage(title, text) {
    var result = await apiPost('createPage', {
      access_token: TOKEN,
      title: title,
      content: nodes(text),
      return_content: 'false'
    });
    if (!result.path) throw new Error('Не удалось создать хранилище для правки');
    return result.path;
  }

  async function readManifest() {
    try {
      var text = await readPage(MANIFEST_PATH);
      var data = JSON.parse(text);
      if (!data || typeof data !== 'object') return emptyManifest();
      if (!data.docs || typeof data.docs !== 'object') data.docs = {};
      if (!data.blobs || typeof data.blobs !== 'object') data.blobs = {};
      return data;
    } catch (e) {
      return emptyManifest();
    }
  }

  async function writeManifest(manifest) {
    await editPage(MANIFEST_PATH, JSON.stringify({ docs: manifest.docs || {}, blobs: manifest.blobs || {} }));
  }

  async function readSlots(paths) {
    if (!paths || !paths.length) return '';
    var parts = [];
    var i;
    for (i = 0; i < paths.length; i++) parts.push(await readPage(paths[i]));
    return parts.join('');
  }

  function parseDoc(text) {
    if (!text) return null;
    try {
      var data = JSON.parse(text);
      if (!data || typeof data !== 'object') return null;
      if (!Array.isArray(data) && !Object.keys(data).length) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  async function writeText(manifest, slot, text) {
    if (!manifest.docs) manifest.docs = {};
    if (!text) {
      manifest.docs[slot] = [];
      return;
    }
    var chunks = [];
    var i;
    for (i = 0; i < text.length; i += CHUNK) chunks.push(text.slice(i, i + CHUNK));
    var prev = manifest.docs[slot] || [];
    var next = [];
    for (i = 0; i < chunks.length; i++) {
      if (prev[i]) {
        await editPage(prev[i], chunks[i]);
        next.push(prev[i]);
      } else {
        next.push(await createPage('Mai ' + slot + ' ' + (i + 1), chunks[i]));
      }
    }
    manifest.docs[slot] = next;
  }

  function hashText(value) {
    var h = 5381;
    var i;
    for (i = 0; i < value.length; i++) h = ((h * 33) ^ value.charCodeAt(i)) >>> 0;
    return h.toString(16) + ':' + value.length;
  }

  async function writeBlob(manifest, key, text) {
    if (!manifest.blobs) manifest.blobs = {};
    var hash = hashText(text);
    var current = manifest.blobs[key];
    if (current && current.hash === hash && current.paths && current.paths.length) {
      return current.paths;
    }
    var chunks = [];
    var i;
    for (i = 0; i < text.length; i += CHUNK) chunks.push(text.slice(i, i + CHUNK));
    var prev = (current && current.paths) || [];
    var next = [];
    for (i = 0; i < chunks.length; i++) {
      if (prev[i]) {
        await editPage(prev[i], chunks[i]);
        next.push(prev[i]);
      } else {
        next.push(await createPage('Mai photo ' + key + ' ' + (i + 1), chunks[i]));
      }
    }
    manifest.blobs[key] = { hash: hash, paths: next };
    return next;
  }

  async function externalizeImages(manifest, images) {
    var out = {};
    var key;
    for (key in images) {
      if (!Object.prototype.hasOwnProperty.call(images, key)) continue;
      var val = images[key];
      if (typeof val === 'string' && val.indexOf('data:image/') === 0) {
        var paths = await writeBlob(manifest, key, val);
        out[key] = 'live:' + paths.join(',');
      } else {
        out[key] = val;
      }
    }
    return out;
  }

  async function resolveImages(images) {
    if (!images) return images;
    var out = {};
    var jobs = [];
    var key;
    for (key in images) {
      if (!Object.prototype.hasOwnProperty.call(images, key)) continue;
      out[key] = images[key];
      if (typeof images[key] === 'string' && images[key].indexOf('live:') === 0) {
        jobs.push(key);
      }
    }
    await Promise.all(jobs.map(async function (name) {
      var paths = images[name].slice(5).split(',').filter(Boolean);
      out[name] = await readSlots(paths);
    }));
    return out;
  }

  function publicConfig(config) {
    var out = {};
    var key;
    for (key in config || {}) {
      if (!Object.prototype.hasOwnProperty.call(config, key)) continue;
      if (key === 'githubToken') continue;
      out[key] = config[key];
    }
    return out;
  }

  async function readBundle() {
    var manifest = await readManifest();
    var content = parseDoc(await readSlots(manifest.docs.content));
    var services = parseDoc(await readSlots(manifest.docs.services));
    var theme = parseDoc(await readSlots(manifest.docs.theme));
    var config = parseDoc(await readSlots(manifest.docs.config));
    var images = parseDoc(await readSlots(manifest.docs.images));
    if (images) images = await resolveImages(images);
    return {
      content: content,
      services: services,
      images: images,
      theme: theme && theme.id ? theme : null,
      config: config
    };
  }

  async function publish(payload) {
    var manifest = await readManifest();
    var images = payload.images || null;
    if (payload.content) await writeText(manifest, 'content', Object.keys(payload.content).length ? JSON.stringify(payload.content) : '');
    if (payload.services) await writeText(manifest, 'services', Object.keys(payload.services).length ? JSON.stringify(payload.services) : '');
    if (payload.theme && payload.theme.id) await writeText(manifest, 'theme', JSON.stringify({ id: String(payload.theme.id) }));
    if (payload.config) await writeText(manifest, 'config', JSON.stringify(publicConfig(payload.config)));
    if (payload.images) {
      if (!Object.keys(payload.images).length) {
        await writeText(manifest, 'images', '');
      } else {
        images = await externalizeImages(manifest, payload.images);
        await writeText(manifest, 'images', JSON.stringify(images));
      }
    }
    await writeManifest(manifest);
    return { ok: true, images: payload.images || null };
  }

  window.StudiaMaiLive = {
    readBundle: readBundle,
    publish: publish,
    resolveImages: resolveImages
  };
})();
