(function (global) {
  'use strict';

  // Tokens live in LOCALSTORAGE so the same browser can rejoin even if the tab
  // was killed by mobile OS during a screen-lock. Token has an exp claim (6h) so
  // it self-invalidates server-side anyway.
  const KEY_TOKEN = 'yatzi.v2.token';
  const KEY_NICK = 'yatzi.v2.nickname';
  const KEY_LANG = 'yatzi.v2.lang';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  const api = {
    getToken: () => safeGet(KEY_TOKEN),
    setToken: (t) => safeSet(KEY_TOKEN, t),
    clearToken: () => safeRemove(KEY_TOKEN),
    getNickname: () => safeGet(KEY_NICK),
    setNickname: (n) => safeSet(KEY_NICK, n),
    getLang: () => safeGet(KEY_LANG),
    setLang: (l) => safeSet(KEY_LANG, l),
  };

  global.Yatzi = global.Yatzi || {};
  global.Yatzi.session = api;
})(typeof self !== 'undefined' ? self : this);
