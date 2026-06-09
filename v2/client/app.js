(function (global) {
  'use strict';

  const Y = global.Yatzi;
  const i18n = Y.i18n;
  const session = Y.session;
  const net = Y.net;
  const stateLib = Y.state;

  const app = {
    screen: null,                // current screen name; null until first render
    roomData: null,
    you: null,
    token: null,
    socket: null,
    lobbyView: null,
    roomView: null,
    boardView: null,
    diceView: null,
    statusEl: null,
    lastShownYatzySeq: 0,
  };

  function showYatzyEffect(extraTurn) {
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
    const game = app.roomData && app.roomData.game;
    if (!game || !game.lastEvent) return;
    if (game.eventSeq <= app.lastShownYatzySeq) return;
    if (game.lastEvent.type === 'scored' && game.lastEvent.wasYatzy) {
      app.lastShownYatzySeq = game.eventSeq;
      showYatzyEffect(!!game.lastEvent.extraTurn);
    }
  }

  function initLang() {
    const saved = session.getLang();
    if (saved === 'he' || saved === 'en') i18n.setLang(saved);
    applyDir();
    const btn = document.getElementById('lang-toggle');
    btn.textContent = i18n.t('lang.toggle');
    btn.addEventListener('click', () => {
      const next = i18n.getLang() === 'he' ? 'en' : 'he';
      i18n.setLang(next);
      session.setLang(next);
      applyDir();
      btn.textContent = i18n.t('lang.toggle');
      refreshExitButton();
      rebuildCurrentScreen();
    });
    refreshExitButton();
    const exitBtn = document.getElementById('exit-to-menu');
    if (exitBtn) exitBtn.addEventListener('click', exitToMenu);
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
    // Tell the server we're leaving so this socket can immediately participate
    // in a fresh room/game. The server replies with {type:'left'} which clears
    // local state and navigates to lobby.
    if (app.socket) app.socket.send({ type: 'leave' });
    session.clearToken();
    app.roomData = null;
    app.token = null;
    app.you = null;
    app.lastShownYatzySeq = 0;
    navigateTo('lobby');
  }

  function applyDir() {
    const html = document.documentElement;
    html.lang = i18n.getLang();
    html.dir = i18n.dir();
  }

  function connect() {
    setConnStatus('connecting');
    app.socket = net.createClient({
      onOpen: onSocketOpen,
      onClose: () => {},
      onStatus: setConnStatus,
      onMessage: onServerMessage,
    });
    app.socket.connect();
  }

  function setConnStatus(s) {
    const el = document.getElementById('conn');
    if (!el) return;
    el.dataset.status = s;
    if (s === 'open') el.textContent = i18n.t('room.connected');
    else if (s === 'connecting') el.textContent = i18n.t('room.connecting');
    else el.textContent = i18n.t('room.disconnected');
  }

  function onSocketOpen() {
    const token = session.getToken();
    if (token && !app.roomData) {
      app.socket.send({ type: 'rejoin', token });
    }
  }

  function onServerMessage(msg) {
    switch (msg.type) {
      case 'hello':
        return;
      case 'roomCreated':
      case 'roomJoined':
        app.you = msg.you;
        app.token = msg.token;
        session.setToken(msg.token);
        app.roomData = msg.room;
        navigateForRoom();
        return;
      case 'roomUpdate':
        app.roomData = msg.room;
        navigateForRoom();
        return;
      case 'left':
        session.clearToken();
        app.roomData = null;
        app.you = null;
        app.token = null;
        navigateTo('lobby');
        return;
      case 'error':
        handleServerError(msg);
        return;
      case 'pong':
        return;
    }
  }

  function navigateForRoom() {
    const room = app.roomData;
    if (!room) { navigateTo('lobby'); return; }
    let next;
    if (room.status === 'waiting') next = 'room';
    else if (room.status === 'playing') next = 'board';
    else if (room.status === 'ended') next = 'end';
    else next = 'lobby';

    if (app.screen !== next) {
      navigateTo(next);
    } else {
      refreshCurrentScreen();
    }
  }

  function navigateTo(screen) {
    app.screen = screen;
    document.querySelectorAll('[data-screen]').forEach((el) => {
      el.hidden = el.dataset.screen !== screen;
    });
    // Topbar exit is only useful when actively in a room/game, not while in the lobby
    // (already at the entry point) or after game-end (the end card has its own button).
    const exitBtn = document.getElementById('exit-to-menu');
    if (exitBtn) exitBtn.hidden = !(screen === 'room' || screen === 'board');
    rebuildCurrentScreen();
  }

  function rebuildCurrentScreen() {
    document.title = i18n.t('app.title');
    if (app.screen === 'lobby') buildLobby();
    else if (app.screen === 'room') buildRoom();
    else if (app.screen === 'board') buildBoard();
    else if (app.screen === 'end') buildEnd();
  }

  function refreshCurrentScreen() {
    if (app.screen === 'room' && app.roomView) {
      app.roomView.render(app.roomData, app.you);
    } else if (app.screen === 'board') {
      refreshBoard();
    }
  }

  function handleServerError(msg) {
    if (msg.code === 'NOT_FOUND' || msg.code === 'BAD_TOKEN') {
      session.clearToken();
      app.roomData = null;
      app.token = null;
      app.you = null;
      navigateTo('lobby');
    }
    const m = friendlyErrorMessage(msg);
    toast(m, true);
  }

  function friendlyErrorMessage(msg) {
    if (msg.code === 'NOT_FOUND') return i18n.t('room.notFound');
    if (msg.code === 'NOT_JOINABLE') return i18n.t('room.notJoinable');
    return i18n.t('room.serverError', { message: msg.message || msg.code || 'unknown' });
  }

  // ---------- LOBBY ----------
  function buildLobby() {
    const root = document.getElementById('screen-lobby');
    app.lobbyView = Y.ui.lobby.createLobby({
      container: root,
      onCreate: (cfg) => {
        app.socket.send({
          type: 'createRoom',
          nickname: cfg.nickname,
          settings: { maxPlayers: cfg.maxPlayers, columnCount: cfg.columnCount },
        });
      },
      onJoin: (cfg) => {
        app.socket.send({ type: 'joinRoom', code: cfg.code, nickname: cfg.nickname });
      },
    });
    app.lobbyView.render();
  }

  // ---------- ROOM (waiting) ----------
  function buildRoom() {
    const root = document.getElementById('screen-room');
    app.roomView = Y.ui.room.createRoomView({
      container: root,
      onStart: () => app.socket.send({ type: 'intent', action: 'startGame' }),
      onLeave: () => app.socket.send({ type: 'leave' }),
    });
    app.roomView.render(app.roomData, app.you);
  }

  // ---------- BOARD ----------
  function buildBoard() {
    if (!app.roomData || !app.roomData.game) { navigateTo('lobby'); return; }
    const root = document.getElementById('screen-board');
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

    app.boardView = Y.ui.board.createBoard({
      container: tableWrap,
      // v2: the viewer is `app.you`; the board uses this to gate cell click affordance.
      getViewerIndex: () => app.you,
      onSelectCell: (columnIndex, categoryId) => {
        if (!isMyTurn()) { toast(i18n.t('errors.notYourTurn'), true); return; }
        app.socket.send({ type: 'intent', action: 'selectCell', payload: { columnIndex, categoryId } });
      },
    });

    app.diceView = createServerDiceTray({
      container: diceEl,
      getState: () => app.roomData.game,
      isMyTurn,
      onRoll: () => app.socket.send({ type: 'intent', action: 'roll' }),
      onToggleHold: (i) =>
        app.socket.send({ type: 'intent', action: 'toggleHold', payload: { dieIndex: i } }),
    });

    app.statusEl = statusEl;
    refreshBoard();
  }

  function createServerDiceTray(opts) {
    const root = opts.container;
    const isMyTurn = opts.isMyTurn;
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
      btn.addEventListener('click', () => opts.onToggleHold(i));
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
      if (!isMyTurn()) return;
      const state = opts.getState();
      // Animate dice marked for re-roll (holds[i] === false) — or all 5 on the very first roll.
      for (let i = 0; i < 5; i++) {
        if (state.rollsTaken === 0 || !state.holds[i]) {
          dieButtons[i].classList.remove('die--rolling');
          void dieButtons[i].offsetWidth;
          dieButtons[i].classList.add('die--rolling');
        }
      }
      opts.onRoll();
    });
    actions.appendChild(rollBtn);

    root.appendChild(row);
    root.appendChild(actions);

    function render(state) {
      const hasDice = state.rollsTaken > 0;
      const mine = isMyTurn();
      const canMark = mine && hasDice && state.rollsTaken < stateLib.MAX_ROLLS_PER_TURN;

      label.hidden = !canMark;
      if (canMark) label.textContent = i18n.t('board.markToRerollHint');

      for (let i = 0; i < 5; i++) {
        const btn = dieButtons[i];
        const face = btn.firstChild;
        const value = state.dice[i];
        face.textContent = hasDice && value > 0 ? String(value) : '·';
        // INVERTED: holds[i] === false means "marked for re-roll" (the active selection).
        const markedForReroll = hasDice && !state.holds[i];
        btn.classList.toggle('die--reroll', markedForReroll);
        btn.setAttribute('aria-pressed', markedForReroll ? 'true' : 'false');
        btn.disabled = !canMark;
      }
      rollBtn.disabled = !mine || state.rollsTaken >= stateLib.MAX_ROLLS_PER_TURN || state.gameOver;
      rollBtn.textContent = state.rollsTaken === 0 ? i18n.t('board.roll') : i18n.t('board.rollAgain');
    }

    return { render };
  }

  function isMyTurn() {
    if (!app.roomData || !app.roomData.game) return false;
    return app.roomData.game.currentPlayerIndex === app.you;
  }

  function refreshBoard() {
    if (!app.roomData || !app.roomData.game) return;
    maybeShowYatzy();
    if (app.roomData.game.gameOver) {
      navigateTo('end');
      return;
    }
    updateBoardStatus();
    app.boardView.render(app.roomData.game);
    app.diceView.render(app.roomData.game);
    // Highlight dice tray when it's the viewer's turn
    const tray = document.querySelector('#screen-board .dice-tray');
    if (tray) tray.classList.toggle('dice-tray--active', isMyTurn());
  }

  function updateBoardStatus() {
    const statusEl = app.statusEl;
    if (!statusEl) return;
    const game = app.roomData.game;
    const mine = isMyTurn();
    statusEl.innerHTML = '';
    statusEl.classList.toggle('board-status--my-turn', mine);

    const turn = document.createElement('div');
    turn.className = 'board-status__turn' + (mine ? ' board-status__turn--mine' : '');
    const cur = game.players[game.currentPlayerIndex];
    const prefix = document.createElement('span');
    prefix.textContent = mine ? i18n.t('board.yourTurn') : i18n.t('board.waitingForLabel');
    turn.appendChild(prefix);
    const badge = document.createElement('span');
    badge.className = 'board-status__player-badge board-status__player-badge--' +
      (cur.color || 'p' + game.currentPlayerIndex);
    badge.textContent = cur.name;
    turn.appendChild(badge);
    statusEl.appendChild(turn);

    const rolls = document.createElement('div');
    rolls.className = 'board-status__rolls';
    const rt = game.rollsTaken;
    if (rt === 0) {
      rolls.textContent = i18n.t('board.readyToRoll');
    } else if (rt >= stateLib.MAX_ROLLS_PER_TURN) {
      rolls.textContent = i18n.t('board.rollOfThreeDone');
      rolls.classList.add('board-status__rolls--done');
    } else {
      rolls.textContent = i18n.t('board.rollOfThree', { n: rt });
    }
    statusEl.appendChild(rolls);

    if (game.finalRoundRemaining !== null) {
      const fr = document.createElement('div');
      fr.className = 'board-status__final';
      fr.textContent = i18n.t('board.finalRound');
      statusEl.appendChild(fr);
    }

    if (game.lastEvent && game.lastEvent.extraTurn) {
      const extra = document.createElement('div');
      extra.className = 'board-status__hint';
      extra.style.color = 'var(--warn)';
      extra.style.fontWeight = '700';
      extra.textContent = i18n.t('board.extraTurn');
      statusEl.appendChild(extra);
    } else if (mine && rt > 0) {
      const hint = document.createElement('div');
      hint.className = 'board-status__hint';
      hint.textContent = i18n.t('board.selectCellHint');
      statusEl.appendChild(hint);
    } else if (!mine) {
      const hint = document.createElement('div');
      hint.className = 'board-status__hint';
      hint.textContent = i18n.t('board.spectatorHint');
      statusEl.appendChild(hint);
    }
  }

  // ---------- END ----------
  function buildEnd() {
    if (!app.roomData || !app.roomData.game) { navigateTo('lobby'); return; }
    const game = app.roomData.game;
    const root = document.getElementById('screen-end');
    root.innerHTML = '';
    root.className = 'screen screen--end';

    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('h2');
    title.className = 'card__title';
    title.textContent = i18n.t('end.title');
    card.appendChild(title);

    const finals = stateLib.finalScores(game);
    const winnerIdx = game.winner ? game.winner.index : 0;
    const winnerName = game.players[winnerIdx].name;

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
    for (let c = 0; c < game.columnCount; c++) {
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
    for (let p = 0; p < game.players.length; p++) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = game.players[p].name;
      tr.appendChild(th);
      for (let c = 0; c < game.columnCount; c++) {
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
      // CRITICAL: tell the server we're leaving the (ended) room so this socket
      // can immediately create a new room. Without this, the server still considers
      // the socket "in" the room and rejects createRoom with BAD_STATE.
      app.socket.send({ type: 'leave' });
      session.clearToken();
      app.roomData = null;
      app.token = null;
      app.you = null;
      app.lastShownYatzySeq = 0;
      navigateTo('lobby');
    });
    actions.appendChild(newBtn);
    card.appendChild(actions);

    root.appendChild(card);
  }

  function toast(message, isError) {
    const node = document.createElement('div');
    node.className = 'toast' + (isError ? ' toast--error' : '');
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => { node.style.opacity = '0'; }, 2500);
    setTimeout(() => { node.remove(); }, 3000);
  }

  function boot() {
    initLang();
    navigateTo('lobby');
    connect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof self !== 'undefined' ? self : this);
