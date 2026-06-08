'use strict';

const path = require('node:path');
const stateLib = require(path.join(__dirname, '..', '..', 'engine', 'state.js'));
const rulesLib = require(path.join(__dirname, '..', '..', 'engine', 'rules.js'));
const diceLib = require(path.join(__dirname, '..', '..', 'engine', 'dice.js'));

// One RNG instance shared across rooms is fine — mulberry32 is fast and deterministic per call.
// For paranoia we seed it from crypto on startup so dice are unpredictable.
const crypto = require('node:crypto');
const rootSeed = crypto.randomBytes(4).readUInt32BE(0);
const rng = diceLib.createRng(rootSeed);

function startGame(room) {
  if (room.status !== 'waiting') {
    const err = new Error('cannot start: not in waiting state');
    err.code = 'BAD_STATE';
    throw err;
  }
  if (room.members.length < 2) {
    const err = new Error('need at least 2 players');
    err.code = 'NOT_ENOUGH_PLAYERS';
    throw err;
  }
  const players = room.members.map((m) => ({
    name: m.nickname,
    color: m.color,
    kind: 'human',
    aiLevel: null,
  }));
  room.game = stateLib.createGame({ players, columnCount: room.columnCount });
  room.status = 'playing';
  room.lastActivity = Date.now();
  return room.game;
}

function applyIntent(room, actorPlayerId, intent) {
  if (room.status !== 'playing') {
    return { ok: false, reason: 'game not in progress' };
  }
  const game = room.game;
  if (!game) return { ok: false, reason: 'no game' };

  // Build the engine move from the intent. Server is authoritative for dice values.
  let move;
  if (intent.action === 'roll') {
    let newDice;
    if (game.rollsTaken === 0) {
      newDice = diceLib.rollFive(rng);
    } else {
      newDice = diceLib.reroll(rng, game.dice, game.holds);
    }
    move = { type: 'roll', dice: newDice };
  } else if (intent.action === 'toggleHold') {
    move = { type: 'toggleHold', dieIndex: intent.payload.dieIndex };
  } else if (intent.action === 'selectCell') {
    move = {
      type: 'selectCell',
      columnIndex: intent.payload.columnIndex,
      categoryId: intent.payload.categoryId,
    };
  } else {
    return { ok: false, reason: 'unknown action' };
  }

  // Authoritative legality check
  const legal = rulesLib.isLegalMove(game, move, actorPlayerId);
  if (!legal.ok) return { ok: false, reason: legal.reason };

  try {
    room.game = stateLib.applyMove(game, move);
  } catch (e) {
    return { ok: false, reason: 'apply failed: ' + e.message };
  }

  room.lastActivity = Date.now();
  if (room.game.gameOver) room.status = 'ended';
  if (room.status === 'ended') room.endedAt = Date.now();
  return { ok: true, state: room.game };
}

// What we broadcast to clients. We exclude internal-only fields if any.
function publicView(room) {
  return {
    code: room.code,
    status: room.status,
    maxPlayers: room.maxPlayers,
    columnCount: room.columnCount,
    members: room.members.map((m) => ({
      playerId: m.playerId,
      nickname: m.nickname,
      color: m.color,
      connected: m.connected,
      isOwner: m.sessionId === room.ownerSessionId,
    })),
    game: room.game,
  };
}

module.exports = { startGame, applyIntent, publicView };
