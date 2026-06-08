(function (global) {
  'use strict';

  const i18n = global.Yatzi.i18n;
  const session = global.Yatzi.session;

  function createLobby(opts) {
    const root = opts.container;
    const onCreate = opts.onCreate;
    const onJoin = opts.onJoin;

    let mode = 'choose'; // 'choose' | 'create' | 'join'

    function render() {
      root.innerHTML = '';
      root.className = 'screen screen--menu';

      const card = document.createElement('div');
      card.className = 'card';

      const title = document.createElement('h2');
      title.className = 'card__title';
      title.textContent = i18n.t('menu.title');
      card.appendChild(title);

      if (mode === 'choose') {
        const buttons = document.createElement('div');
        buttons.className = 'lobby-buttons';

        const createBtn = document.createElement('button');
        createBtn.type = 'button';
        createBtn.className = 'btn btn--primary';
        createBtn.textContent = i18n.t('lobby.create');
        createBtn.addEventListener('click', () => { mode = 'create'; render(); });

        const joinBtn = document.createElement('button');
        joinBtn.type = 'button';
        joinBtn.className = 'btn';
        joinBtn.textContent = i18n.t('lobby.join');
        joinBtn.addEventListener('click', () => { mode = 'join'; render(); });

        buttons.appendChild(createBtn);
        buttons.appendChild(joinBtn);
        card.appendChild(buttons);
      } else if (mode === 'create') {
        renderCreateForm(card);
      } else if (mode === 'join') {
        renderJoinForm(card);
      }

      root.appendChild(card);
    }

    function renderCreateForm(card) {
      const nick = makeField({
        labelKey: 'lobby.nickname',
        type: 'text',
        maxLength: 20,
        initial: session.getNickname() || '',
        autofocus: true,
      });

      const players = makeSelect({
        labelKey: 'menu.players',
        options: [
          { v: 2, t: '2' }, { v: 3, t: '3' }, { v: 4, t: '4' },
          { v: 5, t: '5' }, { v: 6, t: '6' },
        ],
        initial: 2,
      });

      const columns = makeSelect({
        labelKey: 'menu.columns',
        options: [
          { v: 1, t: '1' }, { v: 2, t: '2' }, { v: 3, t: '3' }, { v: 4, t: '4' },
        ],
        initial: 3,
      });

      const row = document.createElement('div');
      row.className = 'field-row';
      row.appendChild(players.field);
      row.appendChild(columns.field);

      card.appendChild(nick.field);
      card.appendChild(row);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'btn btn--primary';
      go.textContent = i18n.t('lobby.create');
      go.addEventListener('click', () => {
        const nickname = nick.input.value.trim();
        if (!nickname) { nick.input.focus(); return; }
        session.setNickname(nickname);
        onCreate({
          nickname,
          maxPlayers: parseInt(players.select.value, 10),
          columnCount: parseInt(columns.select.value, 10),
        });
      });
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'btn btn--ghost';
      back.textContent = '←';
      back.addEventListener('click', () => { mode = 'choose'; render(); });
      actions.appendChild(go);
      actions.appendChild(back);
      card.appendChild(actions);
    }

    function renderJoinForm(card) {
      const nick = makeField({
        labelKey: 'lobby.nickname',
        type: 'text',
        maxLength: 20,
        initial: session.getNickname() || '',
      });

      const code = makeField({
        labelKey: 'lobby.code',
        type: 'text',
        maxLength: 6,
        initial: '',
        autofocus: true,
        extraClass: 'code-input',
        uppercase: true,
      });

      card.appendChild(nick.field);
      card.appendChild(code.field);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'btn btn--primary';
      go.textContent = i18n.t('lobby.join');
      go.addEventListener('click', () => {
        const nickname = nick.input.value.trim();
        const c = code.input.value.trim().toUpperCase();
        if (!nickname) { nick.input.focus(); return; }
        if (c.length !== 6) { code.input.focus(); return; }
        session.setNickname(nickname);
        onJoin({ nickname, code: c });
      });
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'btn btn--ghost';
      back.textContent = '←';
      back.addEventListener('click', () => { mode = 'choose'; render(); });
      actions.appendChild(go);
      actions.appendChild(back);
      card.appendChild(actions);
    }

    function makeField({ labelKey, type, maxLength, initial, autofocus, extraClass, uppercase }) {
      const field = document.createElement('label');
      field.className = 'field';
      const span = document.createElement('span');
      span.textContent = i18n.t(labelKey);
      const input = document.createElement('input');
      input.type = type;
      if (maxLength) input.maxLength = maxLength;
      input.value = initial || '';
      if (extraClass) input.classList.add(extraClass);
      if (uppercase) {
        input.addEventListener('input', () => {
          const start = input.selectionStart;
          input.value = input.value.toUpperCase();
          if (start !== null) input.setSelectionRange(start, start);
        });
      }
      field.appendChild(span);
      field.appendChild(input);
      if (autofocus) setTimeout(() => input.focus(), 0);
      return { field, input };
    }

    function makeSelect({ labelKey, options, initial }) {
      const field = document.createElement('label');
      field.className = 'field';
      const span = document.createElement('span');
      span.textContent = i18n.t(labelKey);
      const select = document.createElement('select');
      for (const o of options) {
        const opt = document.createElement('option');
        opt.value = String(o.v);
        opt.textContent = o.t;
        if (String(o.v) === String(initial)) opt.selected = true;
        select.appendChild(opt);
      }
      field.appendChild(span);
      field.appendChild(select);
      return { field, select };
    }

    return { render };
  }

  global.Yatzi.ui = global.Yatzi.ui || {};
  global.Yatzi.ui.lobby = { createLobby };
})(typeof self !== 'undefined' ? self : this);
