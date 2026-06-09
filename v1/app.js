(function (global) {
  'use strict';

  const Y = global.Yatzi;
  const i18n = Y.i18n;
  const state = Y.state;
  const scoring = Y.scoring;
  const rules = Y.rules;
  const persist = Y.persist;
  const ui = Y.ui;

  const app = {
    screen: 'menu',
    game: null,
    prefs: persist.loadPrefs() || ui.menu.defaultPrefs(),
    boardView: null,
    diceView: null,
    menuView: null,
    lastShownYatzySeq: 0,
  };

  function showYatzyEffect(extraTurn) {
    // Remove any pre-existing flash so a back-to-back Yatzy can re-trigger.
    document.querySelectorAll('.yatzy-flash').forEach((n) => n.remove());
    const overlay = document.createElement('div');
    overlay.className = 'yatzy-flash';
    const inner = document.createElement('div');
    inner.className = 'yatzy-flash__inner';
    inner.textContent = extraTurn ? i18n.t('board.yatzyPopExtra') : i18n.t('board.yatzyPop');
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1700);
  }

  function maybeShowYatzy() {
    if (!app.game || !app.game.lastEvent) return;
    if (app.game.eventSeq <= app.lastShownYatzySeq) return;
    if (app.game.lastEvent.type === 'scored' && app.game.lastEvent.wasYatzy) {
      app.lastShownYatzySeq = app.game.eventSeq;
      showYatzyEffect(!!app.game.lastEvent.extraTurn);
    }
  }

  function initLang() {
    const saved = persist.loadLang();
    if (saved === 'he' || saved === 'en') i18n.setLang(saved);
    applyDir();
    const btn = document.getElementById('lang-toggle');
    btn.textContent = i18n.t('lang.toggle');
    btn.addEventListener('click', toggleLang);
    refreshExitButton();
  }

  function refreshExitButton() {
    const btn = document.getElementById('exit-to-menu');
    if (!btn) return;
    const labelEl = btn.querySelector('[data-exit-label]');
    if (labelEl) labelEl.textContent = i18n.t('topbar.menu');
    btn.setAttribute('aria-label', i18n.t('topbar.menu'));
  }

  function exitToMenu() {
    if (!confirm(i18n.t('topbar.confirmExit'))) return;
    persist.clearGame();
    app.game = null;
    showScreen('menu');
  }

  function applyDir() {
    const html = document.documentElement;
    html.lang = i18n.getLang();
    html.dir = i18n.dir();
  }

  function toggleLang() {
    const next = i18n.getLang() === 'he' ? 'en' : 'he';
    i18n.setLang(next);
    persist.saveLang(next);
    applyDir();
    document.getElementById('lang-toggle').textContent = i18n.t('lang.toggle');
    refreshExitButton();
    renderCurrentScreen();
  }

  function renderCurrentScreen() {
    document.title = i18n.t('app.title');
    document.querySelectorAll('[data-screen]').forEach((el) => {
      el.hidden = el.dataset.screen !== app.screen;
    });
    const exitBtn = document.getElementById('exit-to-menu');
    if (exitBtn) exitBtn.hidden = app.screen !== 'board';
    if (app.screen === 'menu') renderMenu();
    else if (app.screen === 'board') renderBoard();
    else if (app.screen === 'end') renderEnd();
  }

  function renderMenu() {
    const root = document.getElementById('screen-menu');
    app.menuView = ui.menu.createMenu({
      container: root,
      initialPrefs: app.prefs,
      hasSavedGame: () => persist.hasSavedGame(),
      onStart: (cfg) => {
        if (persist.hasSavedGame()) {
          // Confirm before overwriting
          if (!confirm(i18n.t('menu.confirmNewGame'))) return;
        }
        app.prefs = cfg.prefsSnapshot;
        persist.savePrefs(app.prefs);
        startNewGame(cfg);
      },
      onResume: () => {
        const saved = persist.loadGame();
        if (!saved) return;
        app.game = saved;
        showScreen(saved.gameOver ? 'end' : 'board');
      },
      onDeleteSaved: () => persist.clearGame(),
    });
    app.menuView.render();
  }

  function startNewGame(cfg) {
    app.game = state.createGame({
      players: cfg.players,
      columnCount: cfg.columnCount,
    });
    persist.saveGame(app.game);
    showScreen('board');
  }

  function showScreen(name) {
    app.screen = name;
    renderCurrentScreen();
  }

  function renderBoard() {
    if (!app.game) {
      showScreen('menu');
      return;
    }
    const root = document.getElementById('screen-board');
    // Rebuild board structure
    root.innerHTML = '';
    root.className = 'screen screen--board';

    const layout = document.createElement('div');
    layout.className = 'board-layout';

    const statusEl = document.createElement('aside');
    statusEl.className = 'board-status';
    statusEl.setAttribute('aria-live', 'polite');
    layout.appendChild(statusEl);

    const tableWrap = document.createElement('div');
    layout.appendChild(tableWrap);

    const diceEl = document.createElement('section');
    diceEl.setAttribute('aria-label', 'Dice');
    layout.appendChild(diceEl);

    root.appendChild(layout);

    app.boardView = ui.board.createBoard({
      container: tableWrap,
      onSelectCell: (columnIndex, categoryId) => {
        applyMoveAndRefresh({ type: 'selectCell', columnIndex, categoryId });
      },
    });

    app.diceView = ui.dice.createDiceTray({
      container: diceEl,
      getState: () => app.game,
      // In v1 hot-seat the viewer is whoever is at the device, which IS the current player.
      getViewerCanAct: () => !app.game.gameOver,
      onRoll: (dice) => applyMoveAndRefresh({ type: 'roll', dice }),
      onToggleHold: (i) => applyMoveAndRefresh({ type: 'toggleHold', dieIndex: i }),
    });

    refreshBoard();
  }

  function refreshBoard() {
    if (!app.game) return;
    maybeShowYatzy();
    if (app.game.gameOver) {
      persist.saveGame(app.game);
      showScreen('end');
      return;
    }
    updateBoardStatus();
    app.boardView.render(app.game);
    app.diceView.render(app.game);
    // Reflect "active dice tray" with a frame
    const tray = document.querySelector('#screen-board .dice-tray');
    if (tray) tray.classList.toggle('dice-tray--active', !app.game.gameOver);
  }

  function updateBoardStatus() {
    const statusEl = document.querySelector('#screen-board .board-status');
    if (!statusEl) return;
    statusEl.innerHTML = '';
    // In v1 hot-seat the viewer is always whoever's turn it is.
    statusEl.classList.add('board-status--my-turn');

    const turn = document.createElement('div');
    turn.className = 'board-status__turn board-status__turn--mine';
    const cur = app.game.players[app.game.currentPlayerIndex];
    const badge = document.createElement('span');
    badge.className = 'board-status__player-badge board-status__player-badge--' +
      (cur.color || 'p' + app.game.currentPlayerIndex);
    badge.textContent = cur.name;
    turn.appendChild(badge);
    statusEl.appendChild(turn);

    // Rolls counter (ascending)
    const rolls = document.createElement('div');
    rolls.className = 'board-status__rolls';
    const rt = app.game.rollsTaken;
    if (rt === 0) {
      rolls.textContent = i18n.t('board.readyToRoll');
    } else if (rt >= state.MAX_ROLLS_PER_TURN) {
      rolls.textContent = i18n.t('board.rollOfThreeDone');
      rolls.classList.add('board-status__rolls--done');
    } else {
      rolls.textContent = i18n.t('board.rollOfThree', { n: rt });
    }
    statusEl.appendChild(rolls);

    if (app.game.finalRoundRemaining !== null) {
      const fr = document.createElement('div');
      fr.className = 'board-status__final';
      fr.textContent = i18n.t('board.finalRound');
      statusEl.appendChild(fr);
    }

    if (app.game.lastEvent && app.game.lastEvent.extraTurn) {
      const extra = document.createElement('div');
      extra.className = 'board-status__hint';
      extra.style.color = 'var(--warn)';
      extra.style.fontWeight = '700';
      extra.textContent = i18n.t('board.extraTurn');
      statusEl.appendChild(extra);
    } else if (rt > 0) {
      const hint = document.createElement('div');
      hint.className = 'board-status__hint';
      hint.textContent = i18n.t('board.selectCellHint');
      statusEl.appendChild(hint);
    }

    // No "New Game" button here — it lives in the topbar (#exit-to-menu) to keep
    // the in-game status area focused on the turn instructions only.
  }

  function applyMoveAndRefresh(move) {
    if (!app.game) return;
    const check = rules.isLegalMove(app.game, move, app.game.currentPlayerIndex);
    if (!check.ok) {
      // Show ephemeral error in status
      const sEl = document.querySelector('#screen-board .board-status');
      if (sEl) {
        const err = document.createElement('div');
        err.style.color = 'var(--danger)';
        err.textContent = i18n.t('errors.invalidMove') + ': ' + check.reason;
        sEl.appendChild(err);
        setTimeout(() => err.remove(), 1500);
      }
      return;
    }
    try {
      app.game = state.applyMove(app.game, move);
    } catch (e) {
      console.error('applyMove threw:', e);
      return;
    }
    persist.saveGame(app.game);
    refreshBoard();
  }

  function renderEnd() {
    if (!app.game) {
      showScreen('menu');
      return;
    }
    const root = document.getElementById('screen-end');
    root.innerHTML = '';
    root.className = 'screen screen--end';

    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h2');
    title.className = 'card__title';
    title.textContent = i18n.t('end.title');
    card.appendChild(title);

    const finals = state.finalScores(app.game);
    const winnerIdx = app.game.winner ? app.game.winner.index : 0;
    const winnerName = app.game.players[winnerIdx].name;

    const winner = document.createElement('p');
    winner.className = 'end-winner';
    winner.textContent = i18n.t('end.winner', { name: winnerName });
    card.appendChild(winner);

    const sub = document.createElement('h3');
    sub.className = 'end-scores-title';
    sub.textContent = i18n.t('end.scores');
    card.appendChild(sub);

    const table = document.createElement('table');
    table.className = 'end-scores';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.appendChild(document.createElement('th'));
    for (let c = 0; c < app.game.columnCount; c++) {
      const th = document.createElement('th');
      th.textContent = i18n.t('board.column', { n: c + 1 });
      headRow.appendChild(th);
    }
    const totalTh = document.createElement('th');
    totalTh.textContent = i18n.t('board.score');
    headRow.appendChild(totalTh);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let p = 0; p < app.game.players.length; p++) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = app.game.players[p].name;
      tr.appendChild(th);
      for (let c = 0; c < app.game.columnCount; c++) {
        const td = document.createElement('td');
        td.textContent = String(finals[p].columns[c].total);
        tr.appendChild(td);
      }
      const totTd = document.createElement('td');
      totTd.className = 'cell--total';
      totTd.textContent = String(finals[p].total);
      tr.appendChild(totTd);
      if (p === winnerIdx) tr.style.color = 'var(--good)';
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    card.appendChild(table);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'btn btn--primary';
    newBtn.textContent = i18n.t('end.newGame');
    newBtn.addEventListener('click', () => {
      persist.clearGame();
      app.game = null;
      showScreen('menu');
    });
    actions.appendChild(newBtn);
    card.appendChild(actions);

    root.appendChild(card);
  }

  function boot() {
    initLang();
    const exitBtn = document.getElementById('exit-to-menu');
    if (exitBtn) exitBtn.addEventListener('click', exitToMenu);
    // Auto-resume into board/end if a saved game exists
    const saved = persist.loadGame();
    if (saved) {
      app.game = saved;
      app.screen = saved.gameOver ? 'end' : 'board';
    }
    renderCurrentScreen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof self !== 'undefined' ? self : this);
