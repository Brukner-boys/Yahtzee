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

test('after first roll, holds defaults to [true,true,true,true,true] (kept by default)', () => {
  let g = newGame();
  g = state.applyMove(g, { type: 'roll', dice: [6, 6, 1, 2, 3] });
  assert.deepStrictEqual(g.holds, [true, true, true, true, true]);
});

test('toggleHold marks dice for reroll, reroll changes those positions', () => {
  let g = newGame();
  g = state.applyMove(g, { type: 'roll', dice: [6, 6, 1, 2, 3] });
  // Mark positions 2, 3, 4 for reroll (click means "I want to reroll this")
  g = state.applyMove(g, { type: 'toggleHold', dieIndex: 2 });
  g = state.applyMove(g, { type: 'toggleHold', dieIndex: 3 });
  g = state.applyMove(g, { type: 'toggleHold', dieIndex: 4 });
  // Reroll: positions 2, 3, 4 get new values; 0 and 1 are kept
  g = state.applyMove(g, { type: 'roll', dice: [1, 1, 4, 5, 6] });
  assert.strictEqual(g.dice[0], 6);
  assert.strictEqual(g.dice[1], 6);
  assert.strictEqual(g.dice[2], 4);
  assert.strictEqual(g.dice[3], 5);
  assert.strictEqual(g.dice[4], 6);
  assert.strictEqual(g.rollsTaken, 2);
  // After a reroll, holds resets to all-true again
  assert.deepStrictEqual(g.holds, [true, true, true, true, true]);
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

test('final round: triggered when first player finishes', () => {
  let g = newGame(3, 1);
  // Manually fill P0's cells except 'chance' (12/13)
  for (const id of scoring.CATEGORY_IDS) {
    if (id !== 'chance') g.cells[0][0][id] = 0;
  }
  assert.strictEqual(state.playerCellsFilled(g, 0), 12);
  assert.strictEqual(g.firstFinisherIndex, null);
  assert.strictEqual(g.finalRoundRemaining, null);

  // P0 fills last cell
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'chance' });

  assert.strictEqual(state.playerCellsFilled(g, 0), 13);
  assert.strictEqual(g.firstFinisherIndex, 0);
  assert.deepStrictEqual(g.finalRoundRemaining, [1, 2]);
  assert.strictEqual(g.gameOver, false, 'game not over yet — others must play');
  assert.strictEqual(g.currentPlayerIndex, 1);
});

test('final round: game ends after every other player plays one more turn', () => {
  let g = newGame(3, 1);
  for (const id of scoring.CATEGORY_IDS) {
    if (id !== 'chance') g.cells[0][0][id] = 0;
  }
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'chance' });

  // P1 plays one turn
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 6] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'ones' });
  assert.deepStrictEqual(g.finalRoundRemaining, [2]);
  assert.strictEqual(g.gameOver, false);
  assert.strictEqual(g.currentPlayerIndex, 2);

  // P2 plays one turn
  g = state.applyMove(g, { type: 'roll', dice: [2, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'twos' });
  assert.deepStrictEqual(g.finalRoundRemaining, []);
  assert.strictEqual(g.gameOver, true);
});

test('final round: Yatzy still grants extra turn if cells remain', () => {
  let g = newGame(2, 1);
  for (const id of scoring.CATEGORY_IDS) {
    if (id !== 'chance') g.cells[0][0][id] = 0;
  }
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'chance' });
  // P1's turn. Roll Yatzy, score elsewhere (P1 has 13 empty cells, well above 1)
  g = state.applyMove(g, { type: 'roll', dice: [3, 3, 3, 3, 3] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'ones' });
  // Extra turn — same player
  assert.strictEqual(g.currentPlayerIndex, 1);
  assert.strictEqual(g.gameOver, false);
  assert.deepStrictEqual(g.finalRoundRemaining, [1], 'still in final round, not yet ticked off');

  // P1 plays the non-Yatzy follow-up
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 6] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'twos' });
  assert.deepStrictEqual(g.finalRoundRemaining, []);
  assert.strictEqual(g.gameOver, true);
});

test('final round: first finisher rolling Yatzy on last cell does NOT grant extra turn', () => {
  let g = newGame(2, 1);
  for (const id of scoring.CATEGORY_IDS) {
    if (id !== 'yatzy') g.cells[0][0][id] = 0;
  }
  // P0's last empty cell is yatzy. Roll Yatzy and score it.
  g = state.applyMove(g, { type: 'roll', dice: [4, 4, 4, 4, 4] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'yatzy' });
  assert.strictEqual(state.playerCellsFilled(g, 0), 13);
  // No extra turn — P0 has no empty cells. Advance to P1.
  assert.strictEqual(g.currentPlayerIndex, 1);
  assert.strictEqual(g.gameOver, false);
  assert.strictEqual(g.firstFinisherIndex, 0);
});

test('final round: when last-round player has empty cells left after their turn, they get 0 in those', () => {
  let g = newGame(2, 1);
  // P0 finishes
  for (const id of scoring.CATEGORY_IDS) {
    if (id !== 'chance') g.cells[0][0][id] = 0;
  }
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'chance' });
  // P1 has all 13 cells empty. They play one turn (one cell). Game ends.
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 6] });
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'ones' });
  assert.strictEqual(g.gameOver, true);
  // P1 has 12 empty cells. They count as 0 in finalScores.
  const finals = state.finalScores(g);
  assert.strictEqual(finals[1].columns[0].lower, 0);
  // Their total should equal just the 'ones' score they filled
  const onesScore = g.cells[1][0].ones;
  assert.strictEqual(finals[1].total, onesScore);
});

test('eventSeq increments on every applyMove', () => {
  let g = newGame();
  const s0 = g.eventSeq;
  g = state.applyMove(g, { type: 'roll', dice: [1, 2, 3, 4, 5] });
  assert.strictEqual(g.eventSeq, s0 + 1);
  g = state.applyMove(g, { type: 'toggleHold', dieIndex: 0 });
  assert.strictEqual(g.eventSeq, s0 + 2);
  g = state.applyMove(g, { type: 'selectCell', columnIndex: 0, categoryId: 'chance' });
  assert.strictEqual(g.eventSeq, s0 + 3);
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
