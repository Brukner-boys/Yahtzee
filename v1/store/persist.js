(function (global) {
  'use strict';

  const KEY_GAME = 'yatzi.v1.game';
  const KEY_PREFS = 'yatzi.v1.prefs';
  const KEY_LANG = 'yatzi.v1.lang';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore quota / private mode */ }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function saveGame(state) {
    if (!state) return;
    safeSet(KEY_GAME, JSON.stringify(state));
  }
  function loadGame() {
    const raw = safeGet(KEY_GAME);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function clearGame() {
    safeRemove(KEY_GAME);
  }
  function hasSavedGame() {
    return safeGet(KEY_GAME) !== null;
  }

  function savePrefs(prefs) {
    safeSet(KEY_PREFS, JSON.stringify(prefs));
  }
  function loadPrefs() {
    const raw = safeGet(KEY_PREFS);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function saveLang(lang) { safeSet(KEY_LANG, lang); }
  function loadLang() { return safeGet(KEY_LANG); }

  const api = {
    saveGame, loadGame, clearGame, hasSavedGame,
    savePrefs, loadPrefs,
    saveLang, loadLang,
  };

  global.Yatzi = global.Yatzi || {};
  global.Yatzi.persist = api;
})(typeof self !== 'undefined' ? self : this);
