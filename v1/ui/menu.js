(function (global) {
  'use strict';

  const i18n = global.Yatzi.i18n;

  const PLAYER_COLORS = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];

  function defaultPrefs() {
    return {
      mode: 'hotseat',
      playerCount: 2,
      columnCount: 3,
      aiLevel: 'medium',
      playerNames: ['', '', '', '', '', ''],
    };
  }

  function mergePrefs(saved) {
    const p = defaultPrefs();
    if (!saved) return p;
    return {
      mode: saved.mode === 'vsAi' ? 'vsAi' : 'hotseat',
      playerCount: clamp(saved.playerCount, 2, 6, 2),
      columnCount: clamp(saved.columnCount, 1, 4, 3),
      aiLevel: ['easy', 'medium', 'hard'].includes(saved.aiLevel) ? saved.aiLevel : 'medium',
      playerNames: Array.isArray(saved.playerNames)
        ? saved.playerNames.slice(0, 6).concat(['', '', '', '', '', '']).slice(0, 6)
        : p.playerNames,
    };
  }

  function clamp(v, lo, hi, fallback) {
    if (!Number.isFinite(v)) return fallback;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function createMenu(opts) {
    const root = opts.container;
    const onStart = opts.onStart;
    const onResume = opts.onResume;
    const hasSavedGame = opts.hasSavedGame || (() => false);

    let prefs = mergePrefs(opts.initialPrefs);

    function defaultPlayerName(i) {
      return i18n.t('menu.playerName', { n: i + 1 });
    }

    function render() {
      root.innerHTML = '';
      root.className = 'screen screen--menu';

      const card = document.createElement('div');
      card.className = 'card';

      const title = document.createElement('h2');
      title.className = 'card__title';
      title.textContent = i18n.t('menu.title');
      card.appendChild(title);

      // Mode
      const modeGroup = document.createElement('fieldset');
      modeGroup.className = 'field-group';
      const legend = document.createElement('legend');
      legend.textContent = i18n.t('menu.mode.label') !== 'menu.mode.label' ? i18n.t('menu.mode.label') : '';
      modeGroup.appendChild(legend);

      [
        { value: 'hotseat', labelKey: 'menu.mode.hotseat' },
        { value: 'vsAi', labelKey: 'menu.mode.vsAi' },
      ].forEach((m) => {
        const lab = document.createElement('label');
        lab.className = 'radio';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'yatzi-mode';
        radio.value = m.value;
        radio.checked = prefs.mode === m.value;
        radio.addEventListener('change', () => {
          if (radio.checked) {
            prefs.mode = m.value;
            // In vs AI mode force playerCount to 2 (human + AI)
            if (m.value === 'vsAi') prefs.playerCount = 2;
            render();
          }
        });
        const span = document.createElement('span');
        span.textContent = i18n.t(m.labelKey);
        lab.appendChild(radio);
        lab.appendChild(span);
        modeGroup.appendChild(lab);
      });
      card.appendChild(modeGroup);

      // Row of selects
      const row = document.createElement('div');
      row.className = 'field-row';

      const playersField = makeSelectField({
        labelKey: 'menu.players',
        options: prefs.mode === 'vsAi' ? [{ v: 2, t: '2' }] : [
          { v: 2, t: '2' }, { v: 3, t: '3' }, { v: 4, t: '4' }, { v: 5, t: '5' }, { v: 6, t: '6' },
        ],
        value: prefs.playerCount,
        onChange: (v) => {
          prefs.playerCount = parseInt(v, 10);
          render();
        },
      });
      row.appendChild(playersField);

      const columnsField = makeSelectField({
        labelKey: 'menu.columns',
        options: [
          { v: 1, t: '1' }, { v: 2, t: '2' }, { v: 3, t: '3' }, { v: 4, t: '4' },
        ],
        value: prefs.columnCount,
        onChange: (v) => { prefs.columnCount = parseInt(v, 10); },
      });
      row.appendChild(columnsField);

      if (prefs.mode === 'vsAi') {
        const aiField = makeSelectField({
          labelKey: 'menu.aiLevel',
          options: [
            { v: 'easy', t: i18n.t('menu.aiLevel.easy') },
            { v: 'medium', t: i18n.t('menu.aiLevel.medium') },
            { v: 'hard', t: i18n.t('menu.aiLevel.hard') },
          ],
          value: prefs.aiLevel,
          onChange: (v) => { prefs.aiLevel = v; },
        });
        row.appendChild(aiField);
      }
      card.appendChild(row);

      // Player names
      const namesWrap = document.createElement('div');
      namesWrap.className = 'player-names';
      for (let i = 0; i < prefs.playerCount; i++) {
        const lab = document.createElement('label');
        lab.className = 'field';
        const span = document.createElement('span');
        const isAiSlot = prefs.mode === 'vsAi' && i === 1;
        span.textContent = isAiSlot
          ? (i18n.t('menu.aiSlotLabel') !== 'menu.aiSlotLabel'
              ? i18n.t('menu.aiSlotLabel')
              : 'AI')
          : i18n.t('menu.playerName', { n: i + 1 });
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 20;
        if (isAiSlot) {
          input.value = '🤖 ' + i18n.t('menu.aiLevel.' + prefs.aiLevel);
          input.disabled = true;
        } else {
          input.value = prefs.playerNames[i] || defaultPlayerName(i);
        }
        input.addEventListener('input', () => {
          prefs.playerNames[i] = input.value;
        });
        lab.appendChild(span);
        lab.appendChild(input);
        namesWrap.appendChild(lab);
      }
      card.appendChild(namesWrap);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'actions';
      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'btn btn--primary';
      startBtn.textContent = i18n.t('menu.start');
      startBtn.addEventListener('click', () => {
        const players = [];
        for (let i = 0; i < prefs.playerCount; i++) {
          const isAi = prefs.mode === 'vsAi' && i === 1;
          players.push({
            name: isAi
              ? '🤖 ' + i18n.t('menu.aiLevel.' + prefs.aiLevel)
              : (prefs.playerNames[i] && prefs.playerNames[i].trim()) || defaultPlayerName(i),
            color: PLAYER_COLORS[i] || PLAYER_COLORS[0],
            kind: isAi ? 'ai' : 'human',
            aiLevel: isAi ? prefs.aiLevel : null,
          });
        }
        onStart({
          players,
          columnCount: prefs.columnCount,
          mode: prefs.mode,
          aiLevel: prefs.aiLevel,
          prefsSnapshot: copyPrefs(prefs),
        });
      });
      actions.appendChild(startBtn);

      if (hasSavedGame()) {
        const resumeBtn = document.createElement('button');
        resumeBtn.type = 'button';
        resumeBtn.className = 'btn btn--ghost';
        resumeBtn.textContent = i18n.t('menu.resume');
        resumeBtn.addEventListener('click', () => onResume && onResume());
        actions.appendChild(resumeBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn--ghost';
        delBtn.textContent = i18n.t('menu.deleteSaved');
        delBtn.addEventListener('click', () => {
          if (opts.onDeleteSaved) opts.onDeleteSaved();
          render();
        });
        actions.appendChild(delBtn);
      }
      card.appendChild(actions);

      root.appendChild(card);
    }

    function makeSelectField({ labelKey, options, value, onChange }) {
      const lab = document.createElement('label');
      lab.className = 'field';
      const span = document.createElement('span');
      span.textContent = i18n.t(labelKey);
      const sel = document.createElement('select');
      for (const o of options) {
        const opt = document.createElement('option');
        opt.value = String(o.v);
        opt.textContent = o.t;
        if (String(o.v) === String(value)) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => onChange(sel.value));
      lab.appendChild(span);
      lab.appendChild(sel);
      return lab;
    }

    return {
      render,
      getPrefs: () => copyPrefs(prefs),
    };
  }

  function copyPrefs(p) {
    return {
      mode: p.mode,
      playerCount: p.playerCount,
      columnCount: p.columnCount,
      aiLevel: p.aiLevel,
      playerNames: p.playerNames.slice(),
    };
  }

  global.Yatzi.ui = global.Yatzi.ui || {};
  global.Yatzi.ui.menu = { createMenu, defaultPrefs, mergePrefs };
})(typeof self !== 'undefined' ? self : this);
