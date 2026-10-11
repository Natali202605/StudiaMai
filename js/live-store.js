(function () {
  'use strict';

  var PUBLIC_CONFIG_KEYS = { intakeEnabled: true };

  function publicConfig(config) {
    var out = {};
    var key;
    var source = config || {};
    for (key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      if (PUBLIC_CONFIG_KEYS[key] && (source[key] === true || source[key] === false)) out[key] = source[key];
    }
    return out;
  }

  function readBundle() {
    return Promise.resolve({ content: null, services: null, images: null, theme: null, config: null });
  }

  function publish() {
    return Promise.reject(new Error('Запись настроек во внешнее хранилище отключена. Публичный контент меняется только согласованной выкладкой.'));
  }

  window.StudiaMaiLive = {
    readBundle: readBundle,
    publish: publish,
    resolveImages: function (images) { return Promise.resolve(images || {}); },
    publicConfig: publicConfig
  };
})();
