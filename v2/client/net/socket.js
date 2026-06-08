(function (global) {
  'use strict';

  function buildWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + location.host + '/ws';
  }

  function createClient(opts) {
    const onOpen = opts.onOpen || (() => {});
    const onClose = opts.onClose || (() => {});
    const onMessage = opts.onMessage || (() => {});
    const onStatus = opts.onStatus || (() => {});

    let ws = null;
    let reconnectTimer = null;
    let reconnectAttempt = 0;
    let intentionalClose = false;
    const queue = [];

    function emitStatus(s) { onStatus(s); }

    function connect() {
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      intentionalClose = false;
      emitStatus('connecting');
      try {
        ws = new WebSocket(buildWsUrl());
      } catch (e) {
        scheduleReconnect();
        return;
      }

      ws.addEventListener('open', () => {
        reconnectAttempt = 0;
        emitStatus('open');
        while (queue.length) {
          const item = queue.shift();
          rawSend(item);
        }
        onOpen();
      });
      ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg && typeof msg === 'object') onMessage(msg);
      });
      ws.addEventListener('close', () => {
        const wasIntentional = intentionalClose;
        ws = null;
        if (!wasIntentional) {
          emitStatus('disconnected');
          scheduleReconnect();
        } else {
          emitStatus('closed');
        }
        onClose();
      });
      ws.addEventListener('error', () => {
        try { ws && ws.close(); } catch (e) {}
      });
    }

    function scheduleReconnect() {
      if (reconnectTimer) return;
      reconnectAttempt++;
      const delay = Math.min(15000, 500 * Math.pow(2, reconnectAttempt));
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function rawSend(obj) {
      try { ws.send(JSON.stringify(obj)); } catch (e) {}
    }

    function send(obj) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        rawSend(obj);
      } else {
        if (queue.length < 32) queue.push(obj);
      }
    }

    function close() {
      intentionalClose = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (ws) {
        try { ws.close(1000, 'client close'); } catch (e) {}
      }
    }

    return { connect, send, close };
  }

  global.Yatzi = global.Yatzi || {};
  global.Yatzi.net = { createClient };
})(typeof self !== 'undefined' ? self : this);
