(function (global) {
  'use strict';

  const i18n = global.Yatzi.i18n;
  const scoring = global.Yatzi.scoring;
  const format = global.Yatzi.format;

  const ROMAN = ['I', 'II', 'III', 'IV'];

  // Rows in display order: 6 upper, bonus row, 7 lower, total row
  // Bonus and total are computed (not directly clickable).
  function buildRows() {
    const rows = [];
    for (const id of scoring.UPPER_IDS) rows.push({ kind: 'cat', id });
    rows.push({ kind: 'bonus' });
    for (const id of scoring.LOWER_IDS) rows.push({ kind: 'cat', id });
    rows.push({ kind: 'total' });
    return rows;
  }

  function createBoard(opts) {
    const root = opts.container;
    const onSelectCell = opts.onSelectCell;
    // Optional callback: returns the index of the viewing player (used by v2 client).
    // If undefined, viewer is assumed to be the current player (v1 hot-seat).
    const getViewerIndex = opts.getViewerIndex || (() => null);
    root.innerHTML = '';
    root.className = 'board-table-wrap';

    const table = document.createElement('table');
    table.className = 'board-table';
    table.setAttribute('role', 'grid');

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    root.appendChild(table);

    let cellMap = {}; // keyed by "p:c:catId" -> <td>
    let bonusMap = {}; // keyed by "p:c" -> <td>
    let totalMap = {}; // keyed by "p" -> <td>

    function buildHeader(state) {
      thead.innerHTML = '';
      cellMap = {};
      bonusMap = {};
      totalMap = {};

      const row1 = document.createElement('tr');
      const corner = document.createElement('th');
      corner.scope = 'col';
      corner.rowSpan = 2;
      corner.className = 'board-table__corner';
      row1.appendChild(corner);

      for (let p = 0; p < state.players.length; p++) {
        const th = document.createElement('th');
        th.scope = 'colgroup';
        th.colSpan = state.columnCount;
        th.className = 'player-head player-head--p' + p;
        th.textContent = state.players[p].name;
        row1.appendChild(th);
      }
      thead.appendChild(row1);

      const row2 = document.createElement('tr');
      row2.className = 'column-head-row';
      for (let p = 0; p < state.players.length; p++) {
        for (let c = 0; c < state.columnCount; c++) {
          const th = document.createElement('th');
          th.scope = 'col';
          th.textContent = ROMAN[c] || String(c + 1);
          row2.appendChild(th);
        }
      }
      thead.appendChild(row2);
    }

    function buildBody(state) {
      tbody.innerHTML = '';
      const rows = buildRows();
      for (const row of rows) {
        const tr = document.createElement('tr');
        if (row.kind === 'bonus') tr.className = 'row-summary';
        if (row.kind === 'total') tr.className = 'row-total';

        const label = document.createElement('th');
        label.scope = 'row';
        if (row.kind === 'cat') label.textContent = i18n.t('cat.' + row.id);
        else if (row.kind === 'bonus') label.textContent = i18n.t('board.bonus');
        else label.textContent = i18n.t('board.score');
        tr.appendChild(label);

        if (row.kind === 'total') {
          for (let p = 0; p < state.players.length; p++) {
            const td = document.createElement('td');
            td.className = 'cell cell--total';
            td.colSpan = state.columnCount;
            totalMap[p] = td;
            tr.appendChild(td);
          }
        } else {
          for (let p = 0; p < state.players.length; p++) {
            for (let c = 0; c < state.columnCount; c++) {
              const td = document.createElement('td');
              td.className = 'cell';
              if (row.kind === 'cat') {
                td.dataset.player = String(p);
                td.dataset.column = String(c);
                td.dataset.category = row.id;
                if (row.id === 'yatzy') td.classList.add('cell--yatzy-slot');
                td.addEventListener('click', () => {
                  if (td.dataset.clickable === '1') {
                    onSelectCell(c, row.id);
                  }
                });
                cellMap[p + ':' + c + ':' + row.id] = td;
              } else if (row.kind === 'bonus') {
                td.classList.add('cell--summary');
                bonusMap[p + ':' + c] = td;
              }
              tr.appendChild(td);
            }
          }
        }
        tbody.appendChild(tr);
      }
    }

    function render(state) {
      const headerNeedsRebuild =
        thead.childElementCount === 0 ||
        thead.querySelectorAll('.player-head').length !== state.players.length;
      if (headerNeedsRebuild) {
        buildHeader(state);
        buildBody(state);
      } else {
        // Update header labels (in case language changed and names stable)
        const playerHeads = thead.querySelectorAll('.player-head');
        for (let p = 0; p < state.players.length; p++) {
          if (playerHeads[p]) playerHeads[p].textContent = state.players[p].name;
        }
        // Update row labels
        const rows = tbody.querySelectorAll('tr > th[scope="row"]');
        const rowDefs = buildRows();
        rows.forEach((th, idx) => {
          const def = rowDefs[idx];
          if (!def) return;
          if (def.kind === 'cat') th.textContent = i18n.t('cat.' + def.id);
          else if (def.kind === 'bonus') th.textContent = i18n.t('board.bonus');
          else th.textContent = i18n.t('board.score');
        });
      }

      const cur = state.currentPlayerIndex;
      const canScore = state.rollsTaken > 0 && !state.gameOver;
      const viewer = getViewerIndex();
      const viewerIsCurrent = viewer === null || viewer === cur;

      // Highlight the current player's column headers
      const playerHeads = thead.querySelectorAll('.player-head');
      playerHeads.forEach((h, i) => {
        h.classList.toggle('player-head--active', i === cur && !state.gameOver);
      });

      for (let p = 0; p < state.players.length; p++) {
        for (let c = 0; c < state.columnCount; c++) {
          const col = state.cells[p][c];
          for (const catId of scoring.CATEGORY_IDS) {
            const td = cellMap[p + ':' + c + ':' + catId];
            if (!td) continue;
            const val = col[catId];
            td.classList.remove('cell--available', 'cell--readonly', 'cell--current');
            td.dataset.clickable = '0';
            if (val !== null) {
              td.textContent = format.num(val);
            } else if (canScore && p === cur) {
              const preview = scoring.categoryScore(catId, state.dice);
              td.textContent = format.num(preview);
              if (viewerIsCurrent) {
                td.classList.add('cell--available');
                td.dataset.clickable = '1';
              } else {
                // Spectator view: show preview value muted, not interactive.
                td.classList.add('cell--readonly');
              }
            } else {
              td.textContent = '—';
            }
          }
          const totals = scoring.columnTotals(col);
          const bonusTd = bonusMap[p + ':' + c];
          if (bonusTd) {
            if (totals.bonus > 0) bonusTd.textContent = '+' + totals.bonus;
            else bonusTd.textContent = totals.upper + '/' + scoring.UPPER_BONUS_THRESHOLD;
          }
        }
        if (totalMap[p]) {
          totalMap[p].textContent = format.num(scoring.playerTotal(state.cells[p]));
        }
      }
    }

    return { render };
  }

  global.Yatzi.ui = global.Yatzi.ui || {};
  global.Yatzi.ui.board = { createBoard };
})(typeof self !== 'undefined' ? self : this);
