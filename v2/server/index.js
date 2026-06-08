'use strict';

const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');

const auth = require('./auth.js');
const protocol = require('./protocol.js');
const rooms = require('./rooms.js');
const runner = require('./game-runner.js');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const HOST = process.env.HOST || '0.0.0.0';
const PROTOCOL_VERSION = 1;

const app = express();

// Trust proxy hops only if explicitly enabled (fly.io / render set X-Forwarded-For correctly).
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// Light security headers (helmet-equivalent, no extra dep).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'interest-cohort=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
});

// Soft rate limit on HTTP endpoints. Generous — only to deter abuse, not to lock people out.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).send('rate limited'),
  }),
);

// Static client.
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { maxAge: '1h', extensions: ['html'] }));

// Engine + shared are served from sibling dirs.
app.use('/engine', express.static(path.join(__dirname, '..', '..', 'engine'), { maxAge: '1h' }));
app.use('/shared', express.static(path.join(__dirname, '..', '..', 'shared'), { maxAge: '1h' }));

// Reuse v1 board/dice modules in the v2 client too.
app.use('/v1-ui', express.static(path.join(__dirname, '..', '..', 'v1', 'ui'), { maxAge: '1h' }));

// Serve v1 standalone — visitors can play the single-screen variant at /v1/.
app.use('/v1', express.static(path.join(__dirname, '..', '..', 'v1'), { maxAge: '1h', extensions: ['html'] }));

// Health/stats endpoint (no PII).
app.get('/healthz', (req, res) => {
  res.json({ ok: true, protocol: PROTOCOL_VERSION, rooms: rooms.stats() });
});

// HTTP 404 (no body content reflected).
app.use((req, res) => res.status(404).send('not found'));

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 4096,             // limit incoming message size
  perMessageDeflate: false,     // simpler, no extra CPU; payloads are tiny
});

// Per-socket message rate limit (soft).
const SOCKET_MSG_BURST = 30;
const SOCKET_MSG_WINDOW_MS = 1000;

function attachSocketLimiter(ws) {
  let tokens = SOCKET_MSG_BURST;
  let lastRefill = Date.now();
  ws.__msgAllowed = function () {
    const now = Date.now();
    const elapsed = now - lastRefill;
    if (elapsed > 0) {
      tokens = Math.min(SOCKET_MSG_BURST, tokens + (elapsed / SOCKET_MSG_WINDOW_MS) * SOCKET_MSG_BURST);
      lastRefill = now;
    }
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

function send(ws, msg) {
  if (!ws || ws.readyState !== ws.OPEN) return;
  try { ws.send(JSON.stringify(msg)); } catch (e) {}
}

function broadcastRoom(room, msg) {
  for (const m of room.members) {
    if (m.connected && m.ws) send(m.ws, msg);
  }
}

function sendError(ws, code, message) {
  send(ws, { type: 'error', code, message });
}

function logEvent(name, extra) {
  // No PII — only event names and counts.
  const safe = extra ? { ...extra } : {};
  delete safe.ip;
  delete safe.nickname;
  delete safe.token;
  console.log('[event]', name, JSON.stringify(safe));
}

// ----- Session tokens -----
// claims: { sid, room, ver }
function issueToken(sessionId, roomCode) {
  return auth.createToken({ sid: sessionId, room: roomCode, ver: PROTOCOL_VERSION }, 60 * 60 * 6);
}

function readToken(token) {
  const claims = auth.verifyToken(token);
  if (!claims) return null;
  if (claims.ver !== PROTOCOL_VERSION) return null;
  if (typeof claims.sid !== 'string' || typeof claims.room !== 'string') return null;
  return claims;
}

// ----- WS connection -----
wss.on('connection', (ws, req) => {
  attachSocketLimiter(ws);
  ws.__sessionId = null;
  ws.__roomCode = null;
  ws.__lastActivity = Date.now();

  send(ws, { type: 'hello', protocol: PROTOCOL_VERSION });

  ws.on('message', (raw) => {
    ws.__lastActivity = Date.now();
    if (!ws.__msgAllowed()) {
      sendError(ws, 'RATE_LIMIT', 'too many messages');
      return;
    }
    const parsed = protocol.parseMessage(raw);
    if (!parsed.ok) {
      sendError(ws, 'BAD_MESSAGE', parsed.reason);
      ws.close(1003, 'bad message');
      return;
    }
    const msg = parsed.msg;
    const v = protocol.validate(msg);
    if (!v.ok) {
      sendError(ws, 'BAD_MESSAGE', v.reason);
      ws.close(1003, 'invalid');
      return;
    }

    try {
      handleMessage(ws, msg);
    } catch (e) {
      console.error('handler error:', e.message);
      sendError(ws, 'INTERNAL', 'internal error');
    }
  });

  ws.on('close', () => {
    if (ws.__roomCode && ws.__sessionId) {
      const room = rooms.getRoom(ws.__roomCode);
      if (room) {
        rooms.markDisconnected(room, ws.__sessionId);
        broadcastRoom(room, { type: 'roomUpdate', room: runner.publicView(room) });
      }
    }
  });

  ws.on('error', () => {
    // Avoid leaking error details to peer; just let close handler clean up.
  });
});

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'createRoom': return handleCreateRoom(ws, msg);
    case 'joinRoom':   return handleJoinRoom(ws, msg);
    case 'rejoin':     return handleRejoin(ws, msg);
    case 'leave':      return handleLeave(ws);
    case 'intent':     return handleIntent(ws, msg);
    case 'ping':       return send(ws, { type: 'pong' });
    default:           return sendError(ws, 'BAD_MESSAGE', 'unknown type');
  }
}

function handleCreateRoom(ws, msg) {
  if (ws.__roomCode) { sendError(ws, 'BAD_STATE', 'already in a room'); return; }
  const sessionId = auth.randomId(16);
  let room;
  try {
    room = rooms.createRoom({
      owner: { sessionId },
      maxPlayers: msg.settings.maxPlayers,
      columnCount: msg.settings.columnCount,
    });
  } catch (e) {
    sendError(ws, e.code || 'CREATE_FAILED', 'cannot create room');
    return;
  }
  let member;
  try {
    member = rooms.joinRoom(room, { nickname: msg.nickname, sessionId, ws });
  } catch (e) {
    rooms.deleteRoom(room.code);
    sendError(ws, e.code || 'JOIN_FAILED', 'cannot join own room');
    return;
  }
  ws.__sessionId = sessionId;
  ws.__roomCode = room.code;
  const token = issueToken(sessionId, room.code);
  send(ws, { type: 'roomCreated', code: room.code, token, you: member.playerId, room: runner.publicView(room) });
  logEvent('roomCreated', { code: room.code });
}

function handleJoinRoom(ws, msg) {
  if (ws.__roomCode) { sendError(ws, 'BAD_STATE', 'already in a room'); return; }
  const room = rooms.getRoom(msg.code);
  if (!room) { sendError(ws, 'NOT_FOUND', 'room not found'); return; }
  if (!rooms.isJoinable(room)) { sendError(ws, 'NOT_JOINABLE', 'cannot join'); return; }
  const sessionId = auth.randomId(16);
  let member;
  try {
    member = rooms.joinRoom(room, { nickname: msg.nickname, sessionId, ws });
  } catch (e) {
    sendError(ws, e.code || 'JOIN_FAILED', 'cannot join');
    return;
  }
  ws.__sessionId = sessionId;
  ws.__roomCode = room.code;
  const token = issueToken(sessionId, room.code);
  send(ws, { type: 'roomJoined', code: room.code, token, you: member.playerId, room: runner.publicView(room) });
  broadcastRoom(room, { type: 'roomUpdate', room: runner.publicView(room) });
  logEvent('roomJoined', { code: room.code });
}

function handleRejoin(ws, msg) {
  if (ws.__roomCode) { sendError(ws, 'BAD_STATE', 'already in a room'); return; }
  const claims = readToken(msg.token);
  if (!claims) { sendError(ws, 'BAD_TOKEN', 'invalid token'); return; }
  const room = rooms.getRoom(claims.room);
  if (!room) { sendError(ws, 'NOT_FOUND', 'room expired'); return; }
  const member = rooms.attachSocket(room, claims.sid, ws);
  if (!member) { sendError(ws, 'NOT_FOUND', 'session gone'); return; }
  ws.__sessionId = claims.sid;
  ws.__roomCode = claims.room;
  send(ws, { type: 'roomJoined', code: room.code, token: msg.token, you: member.playerId, room: runner.publicView(room) });
  broadcastRoom(room, { type: 'roomUpdate', room: runner.publicView(room) });
}

function handleLeave(ws) {
  const room = ws.__roomCode ? rooms.getRoom(ws.__roomCode) : null;
  if (room && ws.__sessionId) {
    rooms.markDisconnected(room, ws.__sessionId);
    broadcastRoom(room, { type: 'roomUpdate', room: runner.publicView(room) });
  }
  ws.__roomCode = null;
  ws.__sessionId = null;
  send(ws, { type: 'left' });
}

function handleIntent(ws, msg) {
  const room = ws.__roomCode ? rooms.getRoom(ws.__roomCode) : null;
  if (!room) { sendError(ws, 'NOT_IN_ROOM', 'not in a room'); return; }
  const member = rooms.findMemberBySession(room, ws.__sessionId);
  if (!member) { sendError(ws, 'NOT_IN_ROOM', 'session expired'); return; }

  if (msg.action === 'startGame') {
    if (member.sessionId !== room.ownerSessionId) {
      sendError(ws, 'NOT_OWNER', 'only owner can start');
      return;
    }
    try {
      runner.startGame(room);
    } catch (e) {
      sendError(ws, e.code || 'START_FAILED', e.message);
      return;
    }
    broadcastRoom(room, { type: 'roomUpdate', room: runner.publicView(room) });
    logEvent('gameStarted', { code: room.code, players: room.members.length });
    return;
  }

  const res = runner.applyIntent(room, member.playerId, msg);
  if (!res.ok) {
    sendError(ws, 'BAD_MOVE', res.reason);
    return;
  }
  broadcastRoom(room, { type: 'roomUpdate', room: runner.publicView(room) });
  if (room.status === 'ended') {
    logEvent('gameEnded', { code: room.code });
  }
}

rooms.startSweeper();

server.listen(PORT, HOST, () => {
  console.log(`yatzi-server listening on ${HOST}:${PORT}`);
});

function shutdown() {
  console.log('shutting down');
  rooms.stopSweeper();
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
