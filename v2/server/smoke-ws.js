'use strict';

// Quick end-to-end smoke test: open WS, create room, simulate a 2nd client joining,
// play one turn, then exit. Run with: node server/smoke-ws.js (server must already be up)

const WebSocket = require('ws');

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:8080/ws');
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function expect(ws, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for ' + predicate.toString())), timeoutMs || 2000);
    function onMsg(buf) {
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch (e) { return; }
      if (predicate(msg)) {
        clearTimeout(t);
        ws.off('message', onMsg);
        resolve(msg);
      }
    }
    ws.on('message', onMsg);
  });
}

(async () => {
  const a = await connect();
  await expect(a, (m) => m.type === 'hello');
  a.send(JSON.stringify({
    type: 'createRoom',
    nickname: 'Alice',
    settings: { maxPlayers: 2, columnCount: 1 },
  }));
  const created = await expect(a, (m) => m.type === 'roomCreated');
  console.log('roomCreated code=', created.code);

  const b = await connect();
  await expect(b, (m) => m.type === 'hello');
  b.send(JSON.stringify({ type: 'joinRoom', code: created.code, nickname: 'Bob' }));
  await expect(b, (m) => m.type === 'roomJoined');
  console.log('joined ok');

  // Wait for the broadcast roomUpdate that includes 2 members
  await expect(a, (m) => m.type === 'roomUpdate' && m.room.members.length === 2);

  // Owner starts the game
  a.send(JSON.stringify({ type: 'intent', action: 'startGame' }));
  const playing = await expect(a, (m) => m.type === 'roomUpdate' && m.room.status === 'playing');
  console.log('game started, current player:', playing.room.game.currentPlayerIndex);

  // Whoever is current player rolls
  const currentSocket = playing.room.game.currentPlayerIndex === 0 ? a : b;
  currentSocket.send(JSON.stringify({ type: 'intent', action: 'roll' }));
  const rolled = await expect(currentSocket, (m) => m.type === 'roomUpdate' && m.room.game.rollsTaken === 1);
  console.log('rolled:', rolled.room.game.dice);

  // Try to roll as the OTHER player — must be rejected
  const wrongSocket = playing.room.game.currentPlayerIndex === 0 ? b : a;
  wrongSocket.send(JSON.stringify({ type: 'intent', action: 'roll' }));
  const err = await expect(wrongSocket, (m) => m.type === 'error');
  console.log('rejected wrong-turn roll, code=', err.code, 'message=', err.message);

  // Try to send oversized message
  try {
    wrongSocket.send('x'.repeat(5000));
    console.log('oversized message sent (server should close)');
  } catch (e) {
    console.log('client-side error sending oversized:', e.message);
  }

  setTimeout(() => {
    a.close();
    b.close();
    process.exit(0);
  }, 500);
})().catch((e) => {
  console.error('smoke test FAILED:', e);
  process.exit(1);
});
