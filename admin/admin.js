(function () {
  'use strict';

  var STORAGE_KEY = 'studia_mai_admin_simple_v2';
  var SESSION_KEY = 'studia_mai_admin_ok';
  var DEFAULT_USER = 'admin';
  var DEFAULT_PASS = 'Mai2026!';
  var memoryCreds = null;

  var loginScreen = document.getElementById('loginScreen');
  var adminApp = document.getElementById('adminApp');
  var loginForm = document.getElementById('loginForm');
  var loginError = document.getElementById('loginError');
  var loginHint = document.getElementById('loginHint');
  var welcomeMsg = document.getElementById('welcomeMsg');
  var passwordForm = document.getElementById('passwordForm');
  var passwordMsg = document.getElementById('passwordMsg');
  var logoutBtn = document.getElementById('logoutBtn');
  var resetBtn = document.getElementById('resetLoginBtn');

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function sessionGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function sessionSet(key, value) {
    try { sessionStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function sessionRemove(key) {
    try { sessionStorage.removeItem(key); return true; } catch (e) { return false; }
  }

  function loadCreds() {
    if (memoryCreds) return memoryCreds;
    var raw = storageGet(STORAGE_KEY);
    if (raw) {
      try {
        var data = JSON.parse(raw);
        var u = String(data.username || '').trim();
        var p = String(data.password || '');
        if (u && p) {
          memoryCreds = { username: u, password: p };
          return memoryCreds;
        }
      } catch (e) {}
    }
    memoryCreds = { username: DEFAULT_USER, password: DEFAULT_PASS };
    saveCreds(memoryCreds.username, memoryCreds.password);
    return memoryCreds;
  }

  function saveCreds(username, password) {
    memoryCreds = {
      username: String(username || '').trim(),
      password: String(password || '')
    };
    storageSet(STORAGE_KEY, JSON.stringify(memoryCreds));
    return memoryCreds;
  }

  function resetCreds() {
    memoryCreds = null;
    storageRemove(STORAGE_KEY);
    storageRemove('studia_mai_admin_simple_v1');
    storageRemove('studia_mai_admin_local_credentials');
    storageRemove('studia_mai_admin_token');
    sessionRemove(SESSION_KEY);
    return saveCreds(DEFAULT_USER, DEFAULT_PASS);
  }

  function checkLogin(username, password) {
    var creds = loadCreds();
    if (username === creds.username && password === creds.password) return true;
    if (username === DEFAULT_USER && password === DEFAULT_PASS) return true;
    return false;
  }

  function isLoggedIn() {
    return sessionGet(SESSION_KEY) === '1';
  }

  function setLoggedIn(value) {
    if (value) sessionSet(SESSION_KEY, '1');
    else sessionRemove(SESSION_KEY);
  }

  function showLogin() {
    if (loginScreen) {
      loginScreen.hidden = false;
      loginScreen.classList.remove('is-hidden');
    }
    if (adminApp) {
      adminApp.hidden = true;
      adminApp.classList.add('is-hidden');
    }
  }

  function showApp() {
    if (loginScreen) {
      loginScreen.hidden = true;
      loginScreen.classList.add('is-hidden');
    }
    if (adminApp) {
      adminApp.hidden = false;
      adminApp.classList.remove('is-hidden');
    }
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

  function doLogin() {
    hideError(loginError);

    var usernameInput = document.getElementById('loginUsername');
    var passwordInput = document.getElementById('loginPassword');
    var username = usernameInput ? String(usernameInput.value || '').replace(/^\s+|\s+$/g, '') : '';
    var password = passwordInput ? String(passwordInput.value || '') : '';

    if (!username || !password) {
      showError(loginError, 'Введите логин и пароль');
      return;
    }

    if (!checkLogin(username, password)) {
      showError(loginError, 'Неверный логин или пароль. Нажмите «Сбросить пароль», если забыли.');
      return;
    }

    saveCreds(username, password);
    setLoggedIn(true);
    showApp();
  }

  function handleLogout() {
    setLoggedIn(false);
    showLogin();
    if (loginForm) loginForm.reset();
    updateHint();
  }

  function handleResetLogin() {
    resetCreds();
    if (loginForm) loginForm.reset();
    hideError(loginError);
    updateHint();
    if (loginHint) {
      loginHint.textContent = 'Пароль сброшен. Логин: admin · Пароль: Mai2026!';
    }
  }

  function handlePasswordChange(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!passwordMsg) return false;

    passwordMsg.hidden = true;
    var fd = new FormData(passwordForm);
    var current = String(fd.get('currentPassword') || '');
    var newUser = String(fd.get('newUsername') || '').replace(/^\s+|\s+$/g, '');
    var newPass = String(fd.get('newPassword') || '');
    var creds = loadCreds();

    if (current !== creds.password && !(current === DEFAULT_PASS)) {
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
    loginHint.innerHTML = 'Логин: <strong>admin</strong> · Пароль: <strong>Mai2026!</strong><br>Текущий сохранённый логин: <strong>' + creds.username + '</strong>';
  }

  function init() {
    loadCreds();
    updateHint();
    initPasswordToggles();
    initTabs();

    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        doLogin();
        return false;
      });
    }

    var loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        doLogin();
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', handlePasswordChange);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', handleResetLogin);
    }

    if (isLoggedIn()) {
      showApp();
    } else {
      showLogin();
    }
  }

  window.studiaMaiAdminLogin = doLogin;
  window.studiaMaiAdminShowApp = showApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
