(function (global) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRng(seed) {
    if (seed === undefined || seed === null) {
      const buf = new Uint32Array(1);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(buf);
        seed = buf[0];
      } else {
        seed = Math.floor(Math.random() * 0xffffffff);
      }
    }
    return mulberry32(seed);
  }

  function rollOne(rng) {
    return 1 + Math.floor(rng() * 6);
  }

  function rollFive(rng) {
    return [rollOne(rng), rollOne(rng), rollOne(rng), rollOne(rng), rollOne(rng)];
  }

  function reroll(rng, dice, holds) {
    const out = new Array(5);
    for (let i = 0; i < 5; i++) {
      out[i] = holds[i] ? dice[i] : rollOne(rng);
    }
    return out;
  }

  function isYatzy(dice) {
    return dice.length === 5 && dice.every((d) => d === dice[0]);
  }

  const api = { createRng, rollOne, rollFive, reroll, isYatzy };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Yatzi = global.Yatzi || {};
    global.Yatzi.dice = api;
  }
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
