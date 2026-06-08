(function (global) {
  'use strict';

  const KEY_TOKEN = 'yatzi.v2.token';
  const KEY_NICK = 'yatzi.v2.nickname';
  const KEY_LANG = 'yatzi.v2.lang';

  function safeGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) {}
  }
  function safeRemove(key) {
    try { sessionStorage.removeItem(key); } catch (e) {}
  }

  function safeGetLocal(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSetLocal(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  const api = {
    getToken: () => safeGet(KEY_TOKEN),
    setToken: (t) => safeSet(KEY_TOKEN, t),
    clearToken: () => safeRemove(KEY_TOKEN),
    getNickname: () => safeGetLocal(KEY_NICK),
    setNickname: (n) => safeSetLocal(KEY_NICK, n),
    getLang: () => safeGetLocal(KEY_LANG),
    setLang: (l) => safeSetLocal(KEY_LANG, l),
  };

  global.Yatzi = global.Yatzi || {};
  global.Yatzi.session = api;
})(typeof self !== 'undefined' ? self : this);
