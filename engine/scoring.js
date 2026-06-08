(function (global) {
  'use strict';

  const CATEGORIES = [
    { id: 'ones', section: 'upper', face: 1 },
    { id: 'twos', section: 'upper', face: 2 },
    { id: 'threes', section: 'upper', face: 3 },
    { id: 'fours', section: 'upper', face: 4 },
    { id: 'fives', section: 'upper', face: 5 },
    { id: 'sixes', section: 'upper', face: 6 },
    { id: 'threeOfKind', section: 'lower' },
    { id: 'fourOfKind', section: 'lower' },
    { id: 'fullHouse', section: 'lower' },
    { id: 'smallStraight', section: 'lower' },
    { id: 'largeStraight', section: 'lower' },
    { id: 'yatzy', section: 'lower' },
    { id: 'chance', section: 'lower' },
  ];

  const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
  const UPPER_IDS = CATEGORIES.filter((c) => c.section === 'upper').map((c) => c.id);
  const LOWER_IDS = CATEGORIES.filter((c) => c.section === 'lower').map((c) => c.id);
  const UPPER_BONUS_THRESHOLD = 63;
  const UPPER_BONUS_VALUE = 35;

  function counts(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) c[d]++;
    return c;
  }

  function sum(dice) {
    return dice.reduce((a, b) => a + b, 0);
  }

  function hasNOfKind(dice, n) {
    const c = counts(dice);
    return c.some((x) => x >= n);
  }

  function isFullHouse(dice) {
    const c = counts(dice).filter((x) => x > 0).sort();
    return c.length === 2 && c[0] === 2 && c[1] === 3;
  }

  function longestStraight(dice) {
    const present = new Set(dice);
    let best = 0;
    let cur = 0;
    for (let v = 1; v <= 6; v++) {
      if (present.has(v)) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
    return best;
  }

  function categoryScore(catId, dice) {
    if (!dice || dice.length !== 5) return 0;
    switch (catId) {
      case 'ones':
        return counts(dice)[1] * 1;
      case 'twos':
        return counts(dice)[2] * 2;
      case 'threes':
        return counts(dice)[3] * 3;
      case 'fours':
        return counts(dice)[4] * 4;
      case 'fives':
        return counts(dice)[5] * 5;
      case 'sixes':
        return counts(dice)[6] * 6;
      case 'threeOfKind':
        return hasNOfKind(dice, 3) ? sum(dice) : 0;
      case 'fourOfKind':
        return hasNOfKind(dice, 4) ? sum(dice) : 0;
      case 'fullHouse':
        return isFullHouse(dice) ? 25 : 0;
      case 'smallStraight':
        return longestStraight(dice) >= 4 ? 30 : 0;
      case 'largeStraight':
        return longestStraight(dice) >= 5 ? 40 : 0;
      case 'yatzy':
        return hasNOfKind(dice, 5) ? 50 : 0;
      case 'chance':
        return sum(dice);
      default:
        throw new Error('Unknown category: ' + catId);
    }
  }

  function columnTotals(columnCells) {
    let upper = 0;
    let lower = 0;
    for (const id of UPPER_IDS) {
      if (columnCells[id] != null) upper += columnCells[id];
    }
    for (const id of LOWER_IDS) {
      if (columnCells[id] != null) lower += columnCells[id];
    }
    const bonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_VALUE : 0;
    return { upper, bonus, lower, total: upper + bonus + lower };
  }

  function playerTotal(playerCells) {
    let total = 0;
    for (const col of playerCells) total += columnTotals(col).total;
    return total;
  }

  function isYatzyDice(dice) {
    return dice && dice.length === 5 && dice.every((d) => d === dice[0]);
  }

  const api = {
    CATEGORIES,
    CATEGORY_IDS,
    UPPER_IDS,
    LOWER_IDS,
    UPPER_BONUS_THRESHOLD,
    UPPER_BONUS_VALUE,
    categoryScore,
    columnTotals,
    playerTotal,
    isYatzyDice,
    counts,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Yatzi = global.Yatzi || {};
    global.Yatzi.scoring = api;
  }
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
