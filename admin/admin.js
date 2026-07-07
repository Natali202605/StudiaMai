(function () {
  'use strict';

  var STORAGE_KEY = 'studia_mai_admin_simple_v1';
  var SESSION_KEY = 'studia_mai_admin_simple_session';
  var DEFAULT_USER = 'admin';
  var DEFAULT_PASS = 'Mai2026!';

  var loginScreen = document.getElementById('loginScreen');
  var adminApp = document.getElementById('adminApp');
  var loginForm = document.getElementById('loginForm');
  var loginError = document.getElementById('loginError');
  var loginHint = document.getElementById('loginHint');
  var welcomeMsg = document.getElementById('welcomeMsg');
  var passwordForm = document.getElementById('passwordForm');
  var passwordMsg = document.getElementById('passwordMsg');
  var logoutBtn = document.getElementById('logoutBtn');

  function loadCreds() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        var u = String(data.username || '').trim();
        var p = String(data.password || '');
        if (u && p) return { username: u, password: p };
      }
    } catch (e) {}
    var defaults = { username: DEFAULT_USER, password: DEFAULT_PASS };
    saveCreds(defaults.username, defaults.password);
    return defaults;
  }

  function saveCreds(username, password) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || '')
    }));
  }

  function checkLogin(username, password) {
    var creds = loadCreds();
    return username === creds.username && password === creds.password;
  }

  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function setLoggedIn(value) {
    if (value) {
      sessionStorage.setItem(SESSION_KEY, '1');
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function showLogin() {
    if (loginScreen) loginScreen.hidden = false;
    if (adminApp) adminApp.hidden = true;
  }

  function showApp() {
    if (loginScreen) loginScreen.hidden = true;
    if (adminApp) adminApp.hidden = false;
    var creds = loadCreds();
    if (welcomeMsg) {
      welcomeMsg.textContent = 'Вы вошли как «' + creds.username + '». Упрощённая панель активна.';
    }
  }

  function showError(el, text) {
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
  }

  function hideError(el) {
    if (el) el.hidden = true;
  }

  function initPasswordToggles() {
    var buttons = document.querySelectorAll('[data-password-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var input = btn.parentElement ? btn.parentElement.querySelector('input') : null;
          if (!input) return;
          var show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          btn.textContent = show ? 'Скрыть' : 'Показать';
        });
      })(buttons[i]);
    }
  }

  function initTabs() {
    var navBtns = document.querySelectorAll('.admin__nav-btn');
    for (var i = 0; i < navBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var tab = btn.getAttribute('data-tab');
          var allBtns = document.querySelectorAll('.admin__nav-btn');
          var allPanels = document.querySelectorAll('.admin__panel');
          for (var j = 0; j < allBtns.length; j++) allBtns[j].classList.remove('is-active');
          for (var k = 0; k < allPanels.length; k++) allPanels[k].classList.remove('is-active');
          btn.classList.add('is-active');
          var panel = document.querySelector('[data-panel="' + tab + '"]');
          if (panel) panel.classList.add('is-active');
        });
      })(navBtns[i]);
    }
  }

  function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    hideError(loginError);

    var usernameInput = document.getElementById('loginUsername');
    var passwordInput = document.getElementById('loginPassword');
    var username = usernameInput ? String(usernameInput.value || '').trim() : '';
    var password = passwordInput ? String(passwordInput.value || '') : '';

    if (!username || !password) {
      showError(loginError, 'Введите логин и пароль');
      return false;
    }

    if (!checkLogin(username, password)) {
      showError(loginError, 'Неверный логин или пароль');
      return false;
    }

    setLoggedIn(true);
    showApp();
    return false;
  }

  function handleLogout() {
    setLoggedIn(false);
    showLogin();
    if (loginForm) loginForm.reset();
    updateHint();
  }

  function handlePasswordChange(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!passwordMsg) return false;

    passwordMsg.hidden = true;
    var fd = new FormData(passwordForm);
    var current = String(fd.get('currentPassword') || '');
    var newUser = String(fd.get('newUsername') || '').trim();
    var newPass = String(fd.get('newPassword') || '');
    var creds = loadCreds();

    if (current !== creds.password) {
      showError(passwordMsg, 'Текущий пароль неверен');
      passwordMsg.className = 'admin__msg';
      return false;
    }

    var nextUser = newUser || creds.username;
    var nextPass = newPass || creds.password;

    if (nextUser.length < 3) {
      showError(passwordMsg, 'Логин — минимум 3 символа');
      passwordMsg.className = 'admin__msg';
      return false;
    }

    if (nextPass.length < 6) {
      showError(passwordMsg, 'Пароль — минимум 6 символов');
      passwordMsg.className = 'admin__msg';
      return false;
    }

    saveCreds(nextUser, nextPass);
    passwordMsg.textContent = 'Настройки сохранены. Новый логин: ' + nextUser;
    passwordMsg.className = 'admin__msg admin__msg--ok';
    passwordMsg.hidden = false;
    passwordForm.reset();
    updateHint();
    if (welcomeMsg) {
      welcomeMsg.textContent = 'Вы вошли как «' + nextUser + '». Упрощённая панель активна.';
    }
    return false;
  }

  function updateHint() {
    if (!loginHint) return;
    var creds = loadCreds();
    loginHint.textContent = 'Логин по умолчанию: ' + DEFAULT_USER + ' · Пароль: ' + DEFAULT_PASS + '. Ваш текущий логин: ' + creds.username + '.';
  }

  function init() {
    loadCreds();
    updateHint();
    initPasswordToggles();
    initTabs();

    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    var loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        handleLogin(e);
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', handlePasswordChange);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    if (isLoggedIn()) {
      showApp();
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
