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
    const getViewerCanAct = opts.getViewerCanAct || (() => true);

    root.innerHTML = '';
    root.className = 'dice-tray';

    const label = document.createElement('div');
    label.className = 'dice-tray__label';
    root.appendChild(label);

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
      animateRoll(dieButtons, state.holds, state.rollsTaken);
      onRoll(newDice);
    });
    actions.appendChild(rollBtn);

    root.appendChild(row);
    root.appendChild(actions);

    function animateRoll(buttons, holds, rollsTaken) {
      // First roll: animate all 5. Subsequent rolls: only the ones marked for reroll.
      for (let i = 0; i < 5; i++) {
        const shouldAnimate = rollsTaken === 0 || !holds[i];
        if (shouldAnimate) {
          buttons[i].classList.remove('die--rolling');
          void buttons[i].offsetWidth;
          buttons[i].classList.add('die--rolling');
        }
      }
    }

    function render(state) {
      const hasDice = state.rollsTaken > 0;
      const viewerCanAct = getViewerCanAct();
      const canMark = hasDice && state.rollsTaken < stateLib.MAX_ROLLS_PER_TURN && viewerCanAct;

      // Show the "mark to reroll" label only when the viewer can actually mark dice.
      if (canMark) {
        label.textContent = i18n.t('board.markToRerollHint');
        label.hidden = false;
      } else {
        label.hidden = true;
      }

      for (let i = 0; i < 5; i++) {
        const btn = dieButtons[i];
        const face = btn.firstChild;
        const value = state.dice[i];
        face.textContent = hasDice && value > 0 ? String(value) : '·';
        // INVERTED: holds[i]=false now means "marked for reroll" (the active selection).
        const markedForReroll = hasDice && !state.holds[i];
        btn.classList.toggle('die--reroll', markedForReroll);
        btn.setAttribute('aria-pressed', markedForReroll ? 'true' : 'false');
        btn.setAttribute(
          'aria-label',
          i18n.t('board.toggleDie', { n: i + 1 }) +
            ' — ' +
            (hasDice ? value : '–') +
            ' — ' +
            (markedForReroll ? i18n.t('board.dieMarked') : i18n.t('board.dieKept')),
        );
        btn.disabled = !canMark;
      }

      const lockedAfterLastRoll = state.rollsTaken >= stateLib.MAX_ROLLS_PER_TURN;
      rollBtn.disabled = !viewerCanAct || lockedAfterLastRoll || state.gameOver;
      rollBtn.textContent =
        state.rollsTaken === 0 ? i18n.t('board.roll') : i18n.t('board.rollAgain');
    }

    return { render };
  }

  global.Yatzi.ui = global.Yatzi.ui || {};
  global.Yatzi.ui.dice = { createDiceTray };
})(typeof self !== 'undefined' ? self : this);
