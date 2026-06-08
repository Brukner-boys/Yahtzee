(function (global) {
  'use strict';

  const i18n = global.Yatzi.i18n;
  const stateLib = global.Yatzi.state;
  const diceLib = global.Yatzi.dice;

  let rng = null;
  function getRng() {
    if (!rng) rng = diceLib.createRng();
    return rng;
  }

  function createDiceTray(opts) {
    const root = opts.container;
    const onRoll = opts.onRoll;
    const onToggleHold = opts.onToggleHold;

    root.innerHTML = '';
    root.className = 'dice-tray';

    const row = document.createElement('div');
    row.className = 'dice-row';
    const dieButtons = [];
    for (let i = 0; i < 5; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'die';
      btn.dataset.index = String(i);
      const face = document.createElement('span');
      face.className = 'die__face';
      btn.appendChild(face);
      btn.addEventListener('click', () => onToggleHold(i));
      dieButtons.push(btn);
      row.appendChild(btn);
    }

    const actions = document.createElement('div');
    actions.className = 'dice-actions';
    const rollBtn = document.createElement('button');
    rollBtn.type = 'button';
    rollBtn.className = 'btn btn--primary btn--roll';
    rollBtn.addEventListener('click', () => {
      if (rollBtn.disabled) return;
      const state = opts.getState();
      const newDice =
        state.rollsTaken === 0
          ? diceLib.rollFive(getRng())
          : diceLib.reroll(getRng(), state.dice, state.holds);
      animateRoll(dieButtons, state.holds);
      onRoll(newDice);
    });
    actions.appendChild(rollBtn);

    root.appendChild(row);
    root.appendChild(actions);

    function animateRoll(buttons, holds) {
      for (let i = 0; i < 5; i++) {
        if (!holds[i]) {
          buttons[i].classList.remove('die--rolling');
          // Force reflow so we can re-trigger the animation
          void buttons[i].offsetWidth;
          buttons[i].classList.add('die--rolling');
        }
      }
    }

    function render(state) {
      const hasDice = state.rollsTaken > 0;
      for (let i = 0; i < 5; i++) {
        const btn = dieButtons[i];
        const face = btn.firstChild;
        const value = state.dice[i];
        face.textContent = hasDice && value > 0 ? String(value) : '·';
        btn.classList.toggle('die--held', !!state.holds[i]);
        btn.setAttribute('aria-pressed', state.holds[i] ? 'true' : 'false');
        btn.setAttribute(
          'aria-label',
          i18n.t('board.holdDie', { n: i + 1 }) +
            ' — ' +
            (hasDice ? value : '–') +
            ' — ' +
            (state.holds[i] ? i18n.t('board.dieHeld') : i18n.t('board.dieFree')),
        );
        // Can only toggle hold between rolls (rollsTaken in 1..2)
        btn.disabled = !(hasDice && state.rollsTaken < stateLib.MAX_ROLLS_PER_TURN);
      }
      rollBtn.disabled = state.rollsTaken >= stateLib.MAX_ROLLS_PER_TURN || state.gameOver;
      rollBtn.textContent =
        state.rollsTaken === 0 ? i18n.t('board.roll') : i18n.t('board.rollAgain');
    }

    return { render };
  }

  global.Yatzi.ui = global.Yatzi.ui || {};
  global.Yatzi.ui.dice = { createDiceTray };
})(typeof self !== 'undefined' ? self : this);
