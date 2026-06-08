'use strict';

// Strict JSON message validation. Each handler whitelists fields, types, and lengths.
// On any failure: returns { ok: false, reason: '...' } — caller closes the socket.

const NICKNAME_MAX = 20;
const NICKNAME_MIN = 1;
const ROOM_CODE_LENGTH = 6;
const TOKEN_MAX = 1024;
const ALLOWED_ACTIONS = new Set(['roll', 'toggleHold', 'selectCell', 'startGame']);
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 4;

function isString(v, min, max) {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}
function isCleanNickname(s) {
  // Allow letters (any script), digits, spaces, basic punctuation. Reject control chars and angle brackets.
  if (!isString(s, NICKNAME_MIN, NICKNAME_MAX)) return false;
  if (/[\x00-\x1f<>]/.test(s)) return false;
  return true;
}
function isRoomCode(s) {
  return typeof s === 'string' && s.length === ROOM_CODE_LENGTH && /^[A-Z2-9]+$/.test(s);
}
function isToken(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= TOKEN_MAX;
}
function isInt(v, lo, hi) {
  return Number.isInteger(v) && v >= lo && v <= hi;
}

function parseMessage(raw) {
  if (typeof raw !== 'string') {
    if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
    else return { ok: false, reason: 'binary not allowed' };
  }
  if (raw.length > 2048) return { ok: false, reason: 'too large' };
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'invalid json' }; }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return { ok: false, reason: 'not an object' };
  }
  if (typeof msg.type !== 'string' || msg.type.length > 32) {
    return { ok: false, reason: 'missing type' };
  }
  return { ok: true, msg };
}

function validate(msg) {
  switch (msg.type) {
    case 'createRoom': {
      if (!isCleanNickname(msg.nickname)) return { ok: false, reason: 'bad nickname' };
      const s = msg.settings;
      if (!s || typeof s !== 'object') return { ok: false, reason: 'bad settings' };
      if (!isInt(s.maxPlayers, MIN_PLAYERS, MAX_PLAYERS)) return { ok: false, reason: 'bad maxPlayers' };
      if (!isInt(s.columnCount, MIN_COLUMNS, MAX_COLUMNS)) return { ok: false, reason: 'bad columnCount' };
      return { ok: true };
    }
    case 'joinRoom': {
      if (!isRoomCode(msg.code)) return { ok: false, reason: 'bad code' };
      if (!isCleanNickname(msg.nickname)) return { ok: false, reason: 'bad nickname' };
      return { ok: true };
    }
    case 'rejoin': {
      if (!isToken(msg.token)) return { ok: false, reason: 'bad token' };
      return { ok: true };
    }
    case 'leave': {
      return { ok: true };
    }
    case 'intent': {
      if (!ALLOWED_ACTIONS.has(msg.action)) return { ok: false, reason: 'unknown action' };
      const p = msg.payload || {};
      if (typeof p !== 'object') return { ok: false, reason: 'bad payload' };
      if (msg.action === 'toggleHold') {
        if (!isInt(p.dieIndex, 0, 4)) return { ok: false, reason: 'bad dieIndex' };
      } else if (msg.action === 'selectCell') {
        if (!isInt(p.columnIndex, 0, MAX_COLUMNS - 1)) return { ok: false, reason: 'bad columnIndex' };
        if (typeof p.categoryId !== 'string' || p.categoryId.length > 24) return { ok: false, reason: 'bad categoryId' };
      }
      return { ok: true };
    }
    case 'ping': {
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'unknown message type' };
  }
}

module.exports = {
  parseMessage,
  validate,
  limits: { NICKNAME_MAX, ROOM_CODE_LENGTH, TOKEN_MAX, MAX_PLAYERS, MIN_PLAYERS, MIN_COLUMNS, MAX_COLUMNS },
};
