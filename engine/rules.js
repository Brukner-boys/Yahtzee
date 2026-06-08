(function (global) {
  'use strict';

  const scoring =
    typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports
      ? require('./scoring.js')
      : global.Yatzi.scoring;

  const MAX_ROLLS = 3;

  function isLegalMove(state, move, actorIndex) {
    if (!state || !move) return { ok: false, reason: 'missing arguments' };
    if (state.gameOver) return { ok: false, reason: 'game is over' };

    if (actorIndex !== undefined && actorIndex !== state.currentPlayerIndex) {
      return { ok: false, reason: 'not your turn' };
    }

    switch (move.type) {
      case 'roll': {
        if (state.rollsTaken >= MAX_ROLLS) return { ok: false, reason: 'no rolls left' };
        if (!Array.isArray(move.dice) || move.dice.length !== 5) {
          return { ok: false, reason: 'roll requires dice[5]' };
        }
        for (const d of move.dice) {
          if (!Number.isInteger(d) || d < 1 || d > 6) {
            return { ok: false, reason: 'dice must be integers 1..6' };
          }
        }
        return { ok: true };
      }
      case 'toggleHold': {
        if (state.rollsTaken === 0) return { ok: false, reason: 'must roll first' };
        if (state.rollsTaken >= MAX_ROLLS) return { ok: false, reason: 'turn is locked' };
        if (
          !Number.isInteger(move.dieIndex) ||
          move.dieIndex < 0 ||
          move.dieIndex >= 5
        ) {
          return { ok: false, reason: 'invalid dieIndex' };
        }
        return { ok: true };
      }
      case 'selectCell': {
        if (state.rollsTaken === 0) return { ok: false, reason: 'must roll before scoring' };
        if (
          !Number.isInteger(move.columnIndex) ||
          move.columnIndex < 0 ||
          move.columnIndex >= state.columnCount
        ) {
          return { ok: false, reason: 'invalid columnIndex' };
        }
        if (!scoring.CATEGORY_IDS.includes(move.categoryId)) {
          return { ok: false, reason: 'invalid categoryId' };
        }
        const cell = state.cells[state.currentPlayerIndex][move.columnIndex][move.categoryId];
        if (cell !== null) return { ok: false, reason: 'cell already filled' };
        return { ok: true };
      }
      default:
        return { ok: false, reason: 'unknown move type' };
    }
  }

  const api = { isLegalMove };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Yatzi = global.Yatzi || {};
    global.Yatzi.rules = api;
  }
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
