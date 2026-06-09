(function (global) {
  'use strict';

  const scoring =
    typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports
      ? require('./scoring.js')
      : global.Yatzi.scoring;

  const MAX_ROLLS_PER_TURN = 3;
  const DICE_COUNT = 5;

  function makeEmptyColumn() {
    const col = {};
    for (const id of scoring.CATEGORY_IDS) col[id] = null;
    return col;
  }

  function createGame(opts) {
    const players = (opts && opts.players) || [];
    const columnCount = (opts && opts.columnCount) || 3;
    if (players.length < 1 || players.length > 6) {
      throw new Error('players must be 1..6');
    }
    if (columnCount < 1 || columnCount > 4) {
      throw new Error('columnCount must be 1..4');
    }
    const cells = players.map(() => {
      const cols = [];
      for (let c = 0; c < columnCount; c++) cols.push(makeEmptyColumn());
      return cols;
    });
    return {
      players: players.map((p, i) => ({
        index: i,
        name: p.name || 'P' + (i + 1),
        color: p.color || null,
        kind: p.kind || 'human',
        aiLevel: p.aiLevel || null,
      })),
      columnCount,
      cells,
      currentPlayerIndex: 0,
      dice: [0, 0, 0, 0, 0],
      holds: [false, false, false, false, false],
      rollsTaken: 0,
      turnNumber: 1,
      playerTurnCounts: players.map(() => 0),
      playerFinishedAt: players.map(() => null),
      firstFinisherIndex: null,
      finalRoundRemaining: null,    // null = not in final round; array of player ids yet to play
      gameOver: false,
      winner: null,
      lastEvent: null,
      eventSeq: 0,
    };
  }

  function cloneState(s) {
    return {
      players: s.players,
      columnCount: s.columnCount,
      cells: s.cells.map((p) => p.map((c) => Object.assign({}, c))),
      currentPlayerIndex: s.currentPlayerIndex,
      dice: s.dice.slice(),
      holds: s.holds.slice(),
      rollsTaken: s.rollsTaken,
      turnNumber: s.turnNumber,
      playerTurnCounts: s.playerTurnCounts.slice(),
      playerFinishedAt: s.playerFinishedAt.slice(),
      firstFinisherIndex: s.firstFinisherIndex,
      finalRoundRemaining: s.finalRoundRemaining ? s.finalRoundRemaining.slice() : null,
      gameOver: s.gameOver,
      winner: s.winner,
      lastEvent: s.lastEvent,
      eventSeq: s.eventSeq || 0,
    };
  }

  function playerCellsFilled(s, playerIndex) {
    let filled = 0;
    for (const col of s.cells[playerIndex]) {
      for (const id of scoring.CATEGORY_IDS) {
        if (col[id] !== null) filled++;
      }
    }
    return filled;
  }

  function totalCellsPerPlayer(s) {
    return s.columnCount * scoring.CATEGORY_IDS.length;
  }

  function computeWinner(s) {
    let best = -Infinity;
    let winnerIdx = -1;
    for (let i = 0; i < s.players.length; i++) {
      const score = scoring.playerTotal(s.cells[i]);
      if (score > best) {
        best = score;
        winnerIdx = i;
      }
    }
    return { index: winnerIdx, score: best };
  }

  function applyMove(state, move) {
    const s = cloneState(state);
    if (s.gameOver) throw new Error('game is over');
    s.eventSeq = (s.eventSeq || 0) + 1;

    if (move.type === 'roll') {
      if (s.rollsTaken >= MAX_ROLLS_PER_TURN) {
        throw new Error('no rolls left');
      }
      if (!Array.isArray(move.dice) || move.dice.length !== DICE_COUNT) {
        throw new Error('roll requires dice[5]');
      }
      for (const d of move.dice) {
        if (!Number.isInteger(d) || d < 1 || d > 6) {
          throw new Error('dice must be integers 1..6');
        }
      }
      if (s.rollsTaken === 0) {
        s.dice = move.dice.slice();
        // INVERTED UX: default after a roll is "all dice kept", click to mark for reroll.
        s.holds = [true, true, true, true, true];
      } else {
        const next = s.dice.slice();
        for (let i = 0; i < DICE_COUNT; i++) {
          if (!s.holds[i]) next[i] = move.dice[i];
        }
        s.dice = next;
        // After a reroll, re-set everything to "kept" so the player can pick a new reroll set.
        s.holds = [true, true, true, true, true];
      }
      s.rollsTaken++;
      s.lastEvent = { type: 'rolled', rollsTaken: s.rollsTaken };
      return s;
    }

    if (move.type === 'toggleHold') {
      if (s.rollsTaken === 0) throw new Error('must roll before marking');
      if (s.rollsTaken >= MAX_ROLLS_PER_TURN) throw new Error('cannot mark after last roll');
      if (!Number.isInteger(move.dieIndex) || move.dieIndex < 0 || move.dieIndex >= DICE_COUNT) {
        throw new Error('invalid dieIndex');
      }
      s.holds = s.holds.slice();
      s.holds[move.dieIndex] = !s.holds[move.dieIndex];
      s.lastEvent = { type: 'toggledHold', dieIndex: move.dieIndex };
      return s;
    }

    if (move.type === 'selectCell') {
      if (s.rollsTaken === 0) throw new Error('must roll before scoring');
      if (
        !Number.isInteger(move.columnIndex) ||
        move.columnIndex < 0 ||
        move.columnIndex >= s.columnCount
      ) {
        throw new Error('invalid columnIndex');
      }
      if (!scoring.CATEGORY_IDS.includes(move.categoryId)) {
        throw new Error('invalid categoryId');
      }
      const pIdx = s.currentPlayerIndex;
      const cellRow = s.cells[pIdx][move.columnIndex];
      if (cellRow[move.categoryId] !== null) {
        throw new Error('cell already filled');
      }

      const wasYatzy = scoring.isYatzyDice(s.dice);
      const score = scoring.categoryScore(move.categoryId, s.dice);
      cellRow[move.categoryId] = score;

      s.playerTurnCounts[pIdx]++;
      s.lastEvent = {
        type: 'scored',
        playerIndex: pIdx,
        columnIndex: move.columnIndex,
        categoryId: move.categoryId,
        score,
        wasYatzy,
      };

      const totalCells = totalCellsPerPlayer(s);
      const playerJustFinished = playerCellsFilled(s, pIdx) === totalCells;
      if (playerJustFinished) {
        s.playerFinishedAt[pIdx] = s.turnNumber;
        // First player to finish triggers the final round.
        if (s.firstFinisherIndex === null) {
          s.firstFinisherIndex = pIdx;
          s.finalRoundRemaining = [];
          for (let i = 0; i < s.players.length; i++) {
            if (i !== pIdx) s.finalRoundRemaining.push(i);
          }
        }
      }

      // Yatzy grants an extra turn — but only if the player still has empty cells to score in.
      const hasEmptyCells = playerCellsFilled(s, pIdx) < totalCells;
      if (wasYatzy && hasEmptyCells) {
        s.dice = [0, 0, 0, 0, 0];
        s.holds = [false, false, false, false, false];
        s.rollsTaken = 0;
        s.turnNumber++;
        s.lastEvent = Object.assign({}, s.lastEvent, { extraTurn: true });
        return s;
      }

      // Non-Yatzy advance (or Yatzy but player just finished): close out this player's turn-sequence.
      if (s.finalRoundRemaining) {
        const idx = s.finalRoundRemaining.indexOf(pIdx);
        if (idx >= 0) s.finalRoundRemaining.splice(idx, 1);
        if (s.finalRoundRemaining.length === 0) {
          s.gameOver = true;
          s.winner = computeWinner(s);
          return s;
        }
      }

      // Find the next player. Skip players who have finished (no empty cells left).
      let next = (pIdx + 1) % s.players.length;
      while (s.playerFinishedAt[next] !== null && next !== pIdx) {
        next = (next + 1) % s.players.length;
      }
      if (next === pIdx) {
        // Wrapped back to self (everyone else finished). Game must be over.
        s.gameOver = true;
        s.winner = computeWinner(s);
        return s;
      }
      s.currentPlayerIndex = next;
      s.dice = [0, 0, 0, 0, 0];
      s.holds = [false, false, false, false, false];
      s.rollsTaken = 0;
      s.turnNumber++;
      return s;
    }

    throw new Error('unknown move type: ' + move.type);
  }

  function emptyCellsOf(s, playerIndex) {
    const out = [];
    for (let c = 0; c < s.columnCount; c++) {
      for (const id of scoring.CATEGORY_IDS) {
        if (s.cells[playerIndex][c][id] === null) {
          out.push({ columnIndex: c, categoryId: id });
        }
      }
    }
    return out;
  }

  function finalScores(s) {
    return s.players.map((_, i) => ({
      playerIndex: i,
      columns: s.cells[i].map((col) => scoring.columnTotals(col)),
      total: scoring.playerTotal(s.cells[i]),
      finishedAt: s.playerFinishedAt[i],
    }));
  }

  const api = {
    MAX_ROLLS_PER_TURN,
    DICE_COUNT,
    createGame,
    cloneState,
    applyMove,
    emptyCellsOf,
    playerCellsFilled,
    totalCellsPerPlayer,
    computeWinner,
    finalScores,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Yatzi = global.Yatzi || {};
    global.Yatzi.state = api;
  }
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
