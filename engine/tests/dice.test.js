const test = require('node:test');
const assert = require('node:assert');
const dice = require('../dice.js');

test('seeded RNG is deterministic', () => {
  const a = dice.createRng(42);
  const b = dice.createRng(42);
  for (let i = 0; i < 100; i++) {
    assert.strictEqual(dice.rollOne(a), dice.rollOne(b));
  }
});

test('rollOne stays in 1..6', () => {
  const rng = dice.createRng(1);
  for (let i = 0; i < 1000; i++) {
    const v = dice.rollOne(rng);
    assert.ok(v >= 1 && v <= 6, 'value out of range: ' + v);
  }
});

test('rollFive returns 5 dice', () => {
  const rng = dice.createRng(123);
  const r = dice.rollFive(rng);
  assert.strictEqual(r.length, 5);
  for (const v of r) assert.ok(v >= 1 && v <= 6);
});

test('reroll keeps held positions, rerolls others', () => {
  const rng = dice.createRng(7);
  const current = [6, 6, 1, 2, 3];
  const holds = [true, true, false, false, false];
  const next = dice.reroll(rng, current, holds);
  assert.strictEqual(next[0], 6);
  assert.strictEqual(next[1], 6);
  // others were rerolled — values are in 1..6
  for (let i = 2; i < 5; i++) assert.ok(next[i] >= 1 && next[i] <= 6);
});

test('isYatzy detects 5-of-a-kind', () => {
  assert.strictEqual(dice.isYatzy([4, 4, 4, 4, 4]), true);
  assert.strictEqual(dice.isYatzy([4, 4, 4, 4, 5]), false);
});

test('distribution is roughly uniform over many rolls', () => {
  const rng = dice.createRng(2024);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6000; i++) counts[dice.rollOne(rng)]++;
  // Each face should appear ~1000 times +/- some slack
  for (let v = 1; v <= 6; v++) {
    assert.ok(counts[v] > 800 && counts[v] < 1200, 'face ' + v + ' count out of expected band: ' + counts[v]);
  }
});
