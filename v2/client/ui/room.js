(function (global) {
  'use strict';

  const i18n = global.Yatzi.i18n;
  const format = global.Yatzi.format;

  function createRoomView(opts) {
    const root = opts.container;
    const onStart = opts.onStart;
    const onLeave = opts.onLeave;

    function render(roomData, you) {
      root.innerHTML = '';
      root.className = 'screen';

      const card = document.createElement('div');
      card.className = 'card';

      const title = document.createElement('h2');
      title.className = 'card__title';
      title.textContent = i18n.t('room.waiting');
      card.appendChild(title);

      const codeBox = document.createElement('div');
      codeBox.className = 'room-code-display';
      codeBox.textContent = roomData.code;
      card.appendChild(codeBox);

      const shareNote = document.createElement('p');
      shareNote.style.textAlign = 'center';
      shareNote.style.color = 'var(--text-dim)';
      shareNote.style.fontSize = '0.9rem';
      shareNote.textContent = i18n.t('room.shareCode', { code: roomData.code });
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'copy-btn';
      copy.textContent = i18n.t('room.copy') !== 'room.copy' ? i18n.t('room.copy') : 'Copy';
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(roomData.code);
          copy.textContent = '✓';
          setTimeout(() => { copy.textContent = i18n.t('room.copy') !== 'room.copy' ? i18n.t('room.copy') : 'Copy'; }, 1500);
        } catch (e) {}
      });
      shareNote.appendChild(copy);
      card.appendChild(shareNote);

      const list = document.createElement('ul');
      list.className = 'member-list';
      for (const m of roomData.members) {
        const li = document.createElement('li');
        li.classList.add('member--' + (m.color || 'p0'));
        const name = document.createElement('span');
        name.className = 'member__name';
        name.textContent = m.nickname;          // textContent escapes
        li.appendChild(name);

        if (m.playerId === you) {
          const b = document.createElement('span');
          b.className = 'member__badge member__badge--you';
          b.textContent = i18n.t('room.you') !== 'room.you' ? i18n.t('room.you') : 'You';
          li.appendChild(b);
        }
        if (m.isOwner) {
          const b = document.createElement('span');
          b.className = 'member__badge member__badge--owner';
          b.textContent = i18n.t('room.owner') !== 'room.owner' ? i18n.t('room.owner') : 'Host';
          li.appendChild(b);
        }
        if (!m.connected) {
          const b = document.createElement('span');
          b.className = 'member__badge member__badge--offline';
          b.textContent = i18n.t('room.offline') !== 'room.offline' ? i18n.t('room.offline') : 'Offline';
          li.appendChild(b);
        }
        list.appendChild(li);
      }
      card.appendChild(list);

      const youMember = roomData.members.find((m) => m.playerId === you);
      const isOwner = youMember && youMember.isOwner;

      const actions = document.createElement('div');
      actions.className = 'actions';
      if (isOwner) {
        const startBtn = document.createElement('button');
        startBtn.type = 'button';
        startBtn.className = 'btn btn--primary';
        startBtn.textContent = i18n.t('room.startWhenReady');
        startBtn.disabled = roomData.members.length < 2;
        startBtn.addEventListener('click', () => onStart());
        actions.appendChild(startBtn);
      } else {
        const note = document.createElement('span');
        note.style.color = 'var(--text-dim)';
        note.textContent = i18n.t('room.waitingForHost') !== 'room.waitingForHost'
          ? i18n.t('room.waitingForHost')
          : 'Waiting for the host to start…';
        actions.appendChild(note);
      }
      const leave = document.createElement('button');
      leave.type = 'button';
      leave.className = 'btn btn--ghost';
      leave.textContent = i18n.t('room.leave') !== 'room.leave' ? i18n.t('room.leave') : 'Leave';
      leave.addEventListener('click', () => onLeave());
      actions.appendChild(leave);

      card.appendChild(actions);
      root.appendChild(card);
    }

    return { render };
  }

  global.Yatzi.ui = global.Yatzi.ui || {};
  global.Yatzi.ui.room = { createRoomView };
})(typeof self !== 'undefined' ? self : this);
