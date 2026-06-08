(function (global) {
  'use strict';

  function num(n) {
    if (n === null || n === undefined) return '—';
    return String(n);
  }

  function signedDelta(n) {
    if (n > 0) return '+' + n;
    return String(n);
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const api = { num, signedDelta, escapeHtml };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Yatzi = global.Yatzi || {};
    global.Yatzi.format = api;
  }
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
