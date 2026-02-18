/* ════════════════════════════════════════════════════════════════
   LOBBY – Room listing, filtering, create/join modals.
   Game list is received dynamically from the server so adding a
   new game requires no changes to this file.
   ════════════════════════════════════════════════════════════════ */

const Lobby = (() => {
  let allRooms    = [];
  let gameList    = [];   // [{id,label,icon}] sent from server
  let pendingJoinId = null;

  const LEVEL_COLORS = { beginner: '#00e676', intermediate: '#ffd740', advanced: '#ff4444' };

  // ── Called once when game types arrive from server ────────────
  function onGameTypes(games) {
    gameList = games;
    populateGameDropdowns(games);
  }

  function populateGameDropdowns(games) {
    const filterSel = document.getElementById('filter-game');
    const createSel = document.getElementById('new-game-type');

    // Keep the "All Games" option, clear the rest
    filterSel.innerHTML = '<option value="">All Games</option>';
    createSel.innerHTML = '';

    games.forEach((g, i) => {
      filterSel.innerHTML += `<option value="${g.id}">${g.icon} ${g.label}</option>`;
      createSel.innerHTML += `<option value="${g.id}"${i === 0 ? '' : ''}>${g.icon} ${g.label}</option>`;
    });

    // Default chess if available
    const chessOpt = createSel.querySelector('option[value="chess"]');
    if (chessOpt) chessOpt.selected = true;
  }

  // ── Init (called after username is set) ───────────────────────
  function init(username, avatar) {
    document.getElementById('lobby-username').textContent = username;
    document.getElementById('lobby-avatar').textContent   = avatar;
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('create-room-btn').addEventListener('click', () => {
      document.getElementById('create-modal').classList.remove('hidden');
    });
    document.getElementById('close-create-modal').addEventListener('click', closeCreateModal);
    document.getElementById('cancel-create-btn').addEventListener('click', closeCreateModal);
    document.getElementById('confirm-create-btn').addEventListener('click', doCreateRoom);
    document.getElementById('new-room-name').addEventListener('keydown', e => { if (e.key === 'Enter') doCreateRoom(); });

    document.getElementById('new-private').addEventListener('change', e => {
      document.getElementById('password-group').style.display = e.target.checked ? '' : 'none';
    });

    document.getElementById('close-join-modal').addEventListener('click', closeJoinModal);
    document.getElementById('cancel-join-btn').addEventListener('click', closeJoinModal);
    document.getElementById('confirm-join-btn').addEventListener('click', doJoinPrivate);
    document.getElementById('join-password').addEventListener('keydown', e => { if (e.key === 'Enter') doJoinPrivate(); });

    document.getElementById('search-input').addEventListener('input', renderRooms);
    document.getElementById('filter-game').addEventListener('change', renderRooms);
    document.getElementById('filter-level').addEventListener('change', renderRooms);
  }

  function doCreateRoom() {
    const name = document.getElementById('new-room-name').value.trim();
    if (!name) { App.toast('Room name is required', 'error'); return; }
    SocketClient.createRoom({
      name,
      gameType:  document.getElementById('new-game-type').value,
      level:     document.getElementById('new-level').value,
      isPrivate: document.getElementById('new-private').checked,
      password:  document.getElementById('new-password').value
    });
    closeCreateModal();
  }

  function doJoinPrivate() {
    SocketClient.joinRoom(pendingJoinId, document.getElementById('join-password').value);
    closeJoinModal();
  }

  function closeCreateModal() {
    document.getElementById('create-modal').classList.add('hidden');
    document.getElementById('new-room-name').value   = '';
    document.getElementById('new-private').checked    = false;
    document.getElementById('new-password').value     = '';
    document.getElementById('password-group').style.display = 'none';
  }

  function closeJoinModal() {
    document.getElementById('join-modal').classList.add('hidden');
    document.getElementById('join-password').value = '';
    pendingJoinId = null;
  }

  function joinRoom(room) {
    if (room.isPrivate) {
      pendingJoinId = room.id;
      document.getElementById('join-modal').classList.remove('hidden');
    } else {
      SocketClient.joinRoom(room.id);
    }
  }

  function updateRooms(rooms) {
    allRooms = rooms;
    renderRooms();
    document.getElementById('stat-rooms').textContent   = rooms.length;
    document.getElementById('stat-players').textContent = rooms.reduce((n, r) => n + r.playerCount, 0);
  }

  function renderRooms() {
    const query       = document.getElementById('search-input').value.toLowerCase();
    const gameFilter  = document.getElementById('filter-game').value;
    const levelFilter = document.getElementById('filter-level').value;

    const filtered = allRooms.filter(r => {
      if (gameFilter  && r.gameType !== gameFilter)              return false;
      if (levelFilter && r.level    !== levelFilter)             return false;
      if (query       && !r.name.toLowerCase().includes(query))  return false;
      return true;
    });

    const grid = document.getElementById('rooms-grid');
    grid.innerHTML = '';

    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state"><p>🎲 No rooms match your search</p></div>';
      return;
    }

    filtered.forEach(room => {
      const card = document.createElement('div');
      card.className = 'room-card';
      card.innerHTML = `
        <div class="room-card-header">
          <span class="room-card-name">${esc(room.name)}</span>
          <span class="room-card-badge ${room.gameStarted ? 'badge-ingame' : 'badge-waiting'}">
            ${room.gameStarted ? 'In Game' : 'Waiting'}
          </span>
        </div>
        <div class="room-card-meta">
          <span class="meta-tag">${esc(room.gameIcon || '🎮')} ${esc(room.gameLabel)}</span>
          <span class="meta-tag" style="color:${LEVEL_COLORS[room.level] || '#888'}">${capitalize(room.level)}</span>
          ${room.isPrivate ? '<span class="meta-tag">🔒 Private</span>' : ''}
          <span class="meta-tag">👥 ${room.maxPlayers}p</span>
        </div>
        <div class="room-card-footer">
          <div class="player-pips">
            ${Array.from({ length: room.maxPlayers }, (_, i) =>
              `<div class="pip ${i < room.playerCount ? 'filled' : ''}">${i < room.playerCount ? '👤' : ''}</div>`
            ).join('')}
            ${room.spectatorCount ? `<span class="meta-tag">👁 ${room.spectatorCount}</span>` : ''}
          </div>
          <button class="btn ${room.gameStarted ? 'btn-ghost' : 'btn-primary'} btn-sm">
            ${room.gameStarted ? 'Spectate' : 'Join'}
          </button>
        </div>`;
      card.querySelector('button').addEventListener('click', e => { e.stopPropagation(); joinRoom(room); });
      card.addEventListener('click', () => joinRoom(room));
      grid.appendChild(card);
    });
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(str)      { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { init, updateRooms, onGameTypes };
})();
