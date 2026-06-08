const test = require('node:test');
const assert = require('node:assert');
const scoring = require('../scoring.js');

test('upper section sums matching faces', () => {
  assert.strictEqual(scoring.categoryScore('ones', [1, 1, 1, 5, 6]), 3);
  assert.strictEqual(scoring.categoryScore('threes', [3, 3, 3, 5, 2]), 9);
  assert.strictEqual(scoring.categoryScore('sixes', [6, 6, 6, 6, 6]), 30);
  assert.strictEqual(scoring.categoryScore('twos', [1, 3, 4, 5, 6]), 0);
});

test('three of a kind: sum all if 3+ same', () => {
  assert.strictEqual(scoring.categoryScore('threeOfKind', [4, 4, 4, 2, 3]), 17);
  assert.strictEqual(scoring.categoryScore('threeOfKind', [4, 4, 4, 4, 3]), 19);
  assert.strictEqual(scoring.categoryScore('threeOfKind', [4, 4, 2, 1, 3]), 0);
});

test('four of a kind: sum all if 4+ same', () => {
  assert.strictEqual(scoring.categoryScore('fourOfKind', [5, 5, 5, 5, 1]), 21);
  assert.strictEqual(scoring.categoryScore('fourOfKind', [5, 5, 5, 5, 5]), 25);
  assert.strictEqual(scoring.categoryScore('fourOfKind', [5, 5, 5, 1, 2]), 0);
});

test('full house = 25 when 3+2', () => {
  assert.strictEqual(scoring.categoryScore('fullHouse', [2, 2, 3, 3, 3]), 25);
  assert.strictEqual(scoring.categoryScore('fullHouse', [5, 5, 5, 5, 5]), 0); // 5-of-kind is not 3+2
  assert.strictEqual(scoring.categoryScore('fullHouse', [1, 2, 3, 4, 5]), 0);
});

test('small straight = 30 when 4 consecutive', () => {
  assert.strictEqual(scoring.categoryScore('smallStraight', [1, 2, 3, 4, 6]), 30);
  assert.strictEqual(scoring.categoryScore('smallStraight', [2, 3, 4, 5, 5]), 30);
  assert.strictEqual(scoring.categoryScore('smallStraight', [3, 4, 5, 6, 1]), 30);
  assert.strictEqual(scoring.categoryScore('smallStraight', [1, 2, 4, 5, 6]), 0);
});

test('large straight = 40 when 5 consecutive', () => {
  assert.strictEqual(scoring.categoryScore('largeStraight', [1, 2, 3, 4, 5]), 40);
  assert.strictEqual(scoring.categoryScore('largeStraight', [2, 3, 4, 5, 6]), 40);
  assert.strictEqual(scoring.categoryScore('largeStraight', [1, 2, 3, 4, 6]), 0);
});

test('yatzy = 50 when 5 same', () => {
  assert.strictEqual(scoring.categoryScore('yatzy', [4, 4, 4, 4, 4]), 50);
  assert.strictEqual(scoring.categoryScore('yatzy', [4, 4, 4, 4, 1]), 0);
});

test('chance = sum', () => {
  assert.strictEqual(scoring.categoryScore('chance', [1, 2, 3, 4, 5]), 15);
  assert.strictEqual(scoring.categoryScore('chance', [6, 6, 6, 6, 6]), 30);
});

test('isYatzyDice', () => {
  assert.strictEqual(scoring.isYatzyDice([2, 2, 2, 2, 2]), true);
  assert.strictEqual(scoring.isYatzyDice([2, 2, 2, 2, 3]), false);
  assert.strictEqual(scoring.isYatzyDice([1, 2, 3, 4, 5]), false);
});

test('column totals + bonus at 63', () => {
  const col = {
    ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18,
    threeOfKind: 20, fourOfKind: 0, fullHouse: 25, smallStraight: 30,
    largeStraight: 0, yatzy: 50, chance: 22,
  };
  const t = scoring.columnTotals(col);
  assert.strictEqual(t.upper, 63);
  assert.strictEqual(t.bonus, 35);
  assert.strictEqual(t.lower, 147);
  assert.strictEqual(t.total, 245);
});

test('column totals: no bonus below 63', () => {
  const col = {
    ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 12,
    threeOfKind: null, fourOfKind: null, fullHouse: null,
    smallStraight: null, largeStraight: null, yatzy: null, chance: null,
  };
  const t = scoring.columnTotals(col);
  assert.strictEqual(t.upper, 57);
  assert.strictEqual(t.bonus, 0);
});

test('column totals with null cells ignored', () => {
  const col = {
    ones: null, twos: null, threes: null, fours: null, fives: null, sixes: null,
    threeOfKind: null, fourOfKind: null, fullHouse: null,
    smallStraight: null, largeStraight: null, yatzy: null, chance: 18,
  };
  const t = scoring.columnTotals(col);
  assert.strictEqual(t.upper, 0);
  assert.strictEqual(t.bonus, 0);
  assert.strictEqual(t.lower, 18);
  assert.strictEqual(t.total, 18);
});
