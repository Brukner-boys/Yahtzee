'use strict';

const crypto = require('node:crypto');

// Alphabet excludes 0, O, 1, I, L for readability.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

// Room lifecycle
const TTL_IDLE_MS = 2 * 60 * 60 * 1000;     // 2h idle since last activity
const TTL_ENDED_MS = 10 * 60 * 1000;        // 10m after game over
const SWEEP_INTERVAL_MS = 60 * 1000;        // every minute
const MAX_ROOMS = 200;                      // hard cap on concurrent rooms

const rooms = new Map();   // code -> Room

function generateCode() {
  // Use rejection sampling on crypto bytes to get unbiased indices into the alphabet.
  for (let attempt = 0; attempt < 16; attempt++) {
    const buf = crypto.randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('failed to allocate unique room code');
}

function createRoom({ owner, maxPlayers, columnCount }) {
  if (rooms.size >= MAX_ROOMS) {
    const err = new Error('room cap reached');
    err.code = 'CAPACITY';
    throw err;
  }
  const code = generateCode();
  const now = Date.now();
  const room = {
    code,
    createdAt: now,
    lastActivity: now,
    status: 'waiting',                 // 'waiting' | 'playing' | 'ended'
    endedAt: null,
    maxPlayers,
    columnCount,
    ownerSessionId: owner.sessionId,
    members: [],                        // { sessionId, playerId, nickname, color, connected, ws }
    game: null,
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function deleteRoom(code) {
  const r = rooms.get(code);
  if (r) {
    for (const m of r.members) {
      if (m.ws && m.ws.readyState === 1 /* OPEN */) {
        try { m.ws.close(1000, 'room closed'); } catch (e) {}
      }
    }
  }
  rooms.delete(code);
}

function touch(room) {
  room.lastActivity = Date.now();
}

function isJoinable(room) {
  if (!room) return false;
  if (room.status !== 'waiting') return false;
  if (room.members.length >= room.maxPlayers) return false;
  return true;
}

function joinRoom(room, { nickname, sessionId, ws }) {
  if (!isJoinable(room)) {
    const err = new Error('room not joinable');
    err.code = 'NOT_JOINABLE';
    throw err;
  }
  if (room.members.some((m) => m.nickname === nickname)) {
    const err = new Error('nickname taken');
    err.code = 'NICK_TAKEN';
    throw err;
  }
  const playerId = room.members.length;       // index slot
  const member = {
    sessionId,
    playerId,
    nickname,
    color: 'p' + playerId,
    connected: true,
    ws,
  };
  room.members.push(member);
  touch(room);
  return member;
}

function findMemberBySession(room, sessionId) {
  return room.members.find((m) => m.sessionId === sessionId) || null;
}

function markDisconnected(room, sessionId) {
  const m = findMemberBySession(room, sessionId);
  if (m) {
    m.connected = false;
    m.ws = null;
    touch(room);
  }
}

function attachSocket(room, sessionId, ws) {
  const m = findMemberBySession(room, sessionId);
  if (!m) return null;
  m.ws = ws;
  m.connected = true;
  touch(room);
  return m;
}

function setStatus(room, status) {
  room.status = status;
  if (status === 'ended') room.endedAt = Date.now();
  touch(room);
}

function sweep(now) {
  now = now || Date.now();
  const toDelete = [];
  for (const [code, r] of rooms) {
    if (r.status === 'ended' && r.endedAt && now - r.endedAt > TTL_ENDED_MS) {
      toDelete.push(code);
      continue;
    }
    if (now - r.lastActivity > TTL_IDLE_MS) {
      toDelete.push(code);
    }
  }
  for (const code of toDelete) deleteRoom(code);
  return toDelete.length;
}

let sweepTimer = null;
function startSweeper() {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS).unref();
}
function stopSweeper() {
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = null;
}

function stats() {
  let waiting = 0, playing = 0, ended = 0;
  for (const r of rooms.values()) {
    if (r.status === 'waiting') waiting++;
    else if (r.status === 'playing') playing++;
    else if (r.status === 'ended') ended++;
  }
  return { total: rooms.size, waiting, playing, ended };
}

module.exports = {
  createRoom, getRoom, deleteRoom, joinRoom, isJoinable,
  findMemberBySession, markDisconnected, attachSocket,
  setStatus, sweep, startSweeper, stopSweeper, touch, stats,
  CODE_ALPHABET, CODE_LENGTH, MAX_ROOMS,
};
