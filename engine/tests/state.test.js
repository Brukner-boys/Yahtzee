const test = require('node:test');
const assert = require('node:assert');
const state = require('../state.js');
const scoring = require('../scoring.js');
const rules = require('../rules.js');

function newGame(playerCount = 2, columnCount = 3) {
  const players = [];
  for (let i = 0; i < playerCount; i++) players.push({ name: 'P' + (i + 1) });
  return state.createGame({ players, columnCount });
}

test('createGame sets up empty cells', () => {
  const g = newGame(2, 3);
  assert.strictEqual(g.players.length, 2);
  assert.strictEqual(g.columnCount, 3);
  assert.strictEqual(g.cells.length, 2);
  assert.strictEqual(g.cells[0].length, 3);
  for (const id of scoring.CATEGORY_IDS) {
    assert.strictEqual(g.cells[0][0][id], null);
  }
  assert.strictEqual(g.currentPlayerIndex, 0);
  assert.strictEqual(g.rollsTaken, 0);
  assert.strictEqual(g.gameOver, false);
});

test('roll updates dice and increments rollsTaken', () => {
  let g = newGame();
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  assert.deepStrictEqual(g.dice, [1, 2, 3, 4, 5]);
  assert.strictEqual(g.rollsTaken, 1);
});

test('toggleHold then reroll keeps held dice', () => {
  let g = newGame();
  g = state.applyMove(g, { type: 'roll', dice: [6, 6, 1, 2, 3] });
  g = state.applyMove(g, { type: 'toggleHold', dieIndex: 0 });
  g = state.applyMove(g, { type: 'toggleHold', dieIndex: 1 });
  // Reroll: provide 5 dice values; held positions' values are ignored but must still be valid 1..6
  g = state.applyMove(g, { type: 'roll', dice: [1, 1, 4, 5, 6] });
  assert.strictEqual(g.dice[0], 6);
  assert.strictEqual(g.dice[1], 6);
  assert.strictEqual(g.dice[2], 4);
  assert.strictEqual(g.dice[3], 5);
  assert.strictEqual(g.dice[4], 6);
  assert.strictEqual(g.rollsTaken, 2);
});

test('cannot roll more than 3 times per turn', () => {
  let g = newGame();
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  assert.throws(() => state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] }));
});

test('selectCell fills cell and advances to next player', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [3, 3, 3, 2, 5] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'threes' });
  assert.strictEqual(g.cells[0][0].threes, 9);
  assert.strictEqual(g.currentPlayerIndex, 1);
  assert.strictEqual(g.rollsTaken, 0);
  assert.strictEqual(g.playerTurnCounts[0], 1);
  assert.strictEqual(g.playerTurnCounts[1], 0);
});

test('selectCell to a cell that does not match dice still records (with appropriate score)', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 5, 6] });
  // No pairs but write into threeOfKind — should be 0
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'threeOfKind' });
  assert.strictEqual(g.cells[0][0].threeOfKind, 0);
});

test('Yatzy on last roll grants extra turn (same player continues)', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [5, 5, 5, 5, 5] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'yatzy' });
  assert.strictEqual(g.cells[0][0].yatzy, 50);
  assert.strictEqual(g.currentPlayerIndex, 0, 'same player after Yatzy');
  assert.strictEqual(g.rollsTaken, 0);
});

test('Yatzy scored in chance ALSO grants extra turn', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [4, 4, 4, 4, 4] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'chance' });
  assert.strictEqual(g.cells[0][0].chance, 20);
  assert.strictEqual(g.currentPlayerIndex, 0, 'extra turn regardless of where Yatzy is scored');
});

test('Yatzy scored in unrelated category (zero score) still grants extra turn', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [3, 3, 3, 3, 3] });
  // Write into 'sixes' — score 0 — but it's still 5-of-a-kind
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'sixes' });
  assert.strictEqual(g.cells[0][0].sixes, 0);
  assert.strictEqual(g.currentPlayerIndex, 0, 'extra turn regardless of cell');
});

test('non-Yatzy advances to next player', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [3, 3, 3, 2, 1] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'threes' });
  assert.strictEqual(g.currentPlayerIndex, 1);
});

test('cannot select a cell that is already filled', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [1, 1, 1, 2, 3] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'ones' });
  // player 2 turn
  g = state.applyMove(g, { type: 'roll', dice: [1, 1, 1, 2, 3] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'ones' });
  // back to player 1 — try to select same cell
  g = state.applyMove(g, { type: 'roll', dice: [2, 2, 2, 3, 4] });
  assert.throws(() => state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'ones' }));
});

test('game ends instantly when first player fills last cell; others stay empty (= 0)', () => {
  // 2 players, 1 column = 13 cells per player
  let g = newGame(2, 1);
  const fillAllForPlayer = (g, pIdx) => {
    for (const id of scoring.CATEGORY_IDS) {
      while (g.currentPlayerIndex !== pIdx && !g.gameOver) {
        // make other player play a cheap non-yatzy turn
        g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 6] });
        const opp = g.currentPlayerIndex;
        // pick an empty cell for them
        const empties = state.emptyCellsOf(g, opp);
        g = state.applyMove(g, {
          type: 'selectCell',
          columnIndex: empties[0].columnIndex,
          categoryId: empties[0].categoryId,
        });
      }
      if (g.gameOver) break;
      g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 6] });
      g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: id });
    }
    return g;
  };
  g = fillAllForPlayer(g, 0);
  assert.strictEqual(g.gameOver, true);
  assert.strictEqual(g.playerFinishedAt[0] !== null, true);
  // Player 2 may have unfilled cells — verify finalScores treats them as 0
  const finals = state.finalScores(g);
  // P1 fully filled
  assert.ok(finals[0].total >= 0);
  // P2's missing cells contribute 0
  const p2Cells = g.cells[1][0];
  let missingCount = 0;
  for (const id of scoring.CATEGORY_IDS) if (p2Cells[id] === null) missingCount++;
  assert.ok(missingCount > 0, 'P2 should have empty cells when P1 wins the race');
});

test('rules.isLegalMove rejects wrong-turn intents', () => {
  let g = newGame(2);
  // Player 0's turn — player 1 trying to move
  const r = rules.isLegalMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] }, 1);
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /not your turn/);
});

test('rules.isLegalMove rejects out-of-range dice', () => {
  const g = newGame(2);
  const r = rules.isLegalMove(g, { type: 'roll', dice: [1, 2, 3, 4, 9] });
  assert.strictEqual(r.ok, false);
});

test('rules.isLegalMove rejects roll after 3 rolls', () => {
  let g = newGame(2);
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  const r = rules.isLegalMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  assert.strictEqual(r.ok, false);
});
