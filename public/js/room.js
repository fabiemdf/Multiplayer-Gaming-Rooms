/* ════════════════════════════════════════════════════════════════
   ROOM – Room state display, player list, game wiring
   Uses GameRegistry so no hardcoded game references exist here.
   ════════════════════════════════════════════════════════════════ */

const Room = (() => {

  function enter(data) {
    const { room, players, spectators, chatHistory, playerIndex, isSpectator, gameState, gameStarted } = data;

    // Header
    document.getElementById('room-name-display').textContent = room.name;
    document.getElementById('room-meta').textContent =
      `${GameRegistry.getLabel(room.gameType)} · ${capitalize(room.level)}`;

    // Reset UI
    document.getElementById('game-container').innerHTML = '';
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('resign-btn').classList.add('hidden');
    document.getElementById('rematch-btn').classList.add('hidden');
    document.getElementById('ready-btn').classList.remove('hidden');

    updatePlayers(players, spectators);
    Chat.init();
    Chat.loadHistory(chatHistory);
    VideoManager.init();
    bindControls(playerIndex, isSpectator);

    if (gameStarted && gameState) {
      renderGame(room.gameType, gameState, players, playerIndex, isSpectator);
      setStatusFromState(gameState, room.gameType, players, playerIndex);
      document.getElementById('ready-btn').classList.add('hidden');
      if (!isSpectator) document.getElementById('resign-btn').classList.remove('hidden');
    } else {
      setStatus('Waiting for players to ready up…');
    }
  }

  function bindControls(playerIndex, isSpectator) {
    replaceBtn('ready-btn',   () => SocketClient.playerReady());
    replaceBtn('resign-btn',  () => { if (confirm('Resign this game?')) SocketClient.gameAction({ type: 'resign' }); });
    replaceBtn('rematch-btn', () => SocketClient.rematch());
    replaceBtn('leave-room-btn', () => {
      SocketClient.leaveRoom();
      VideoManager.cleanup();
      App.showScreen('lobby');
    });
    if (isSpectator) document.getElementById('ready-btn').classList.add('hidden');
  }

  function replaceBtn(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', handler);
  }

  function updatePlayers(players, spectators = []) {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    const myId = SocketClient.id;

    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-row' + (p.id === myId ? ' you' : '');
      const badgeColor = p.playerIndex === 0 ? 'badge-p1' : 'badge-p2';
      const readyBadge = p.isReady
        ? '<span class="player-badge badge-ready">Ready</span>'
        : '<span class="player-badge badge-waiting-p">Not Ready</span>';
      row.innerHTML = `
        <span class="player-avatar">${esc(p.avatar)}</span>
        <span class="player-name">${esc(p.username)}${p.id === myId ? ' <small>(you)</small>' : ''}</span>
        <span class="player-badge ${badgeColor}">${p.playerIndex === 0 ? 'P1' : 'P2'}</span>
        ${readyBadge}`;
      list.appendChild(row);
    });

    const specOuter = document.getElementById('spectators-list');
    const specInner = document.getElementById('spectators-inner');
    if (spectators && spectators.length > 0) {
      specOuter.classList.remove('hidden');
      specInner.innerHTML = spectators.map(s => `<span class="spectator-chip" title="${esc(s.username)}">${esc(s.avatar)}</span>`).join('');
    } else {
      specOuter.classList.add('hidden');
    }
  }

  function onGameStarted({ gameType, gameState, players }) {
    App.state.gameStarted = true;
    App.state.gameState   = gameState;
    App.state.players     = players;

    document.getElementById('ready-btn').classList.add('hidden');
    document.getElementById('rematch-btn').classList.add('hidden');
    if (!App.state.isSpectator) document.getElementById('resign-btn').classList.remove('hidden');

    renderGame(gameType, gameState, players, App.state.playerIndex, App.state.isSpectator);
    setStatusFromState(gameState, gameType, players, App.state.playerIndex);
    updatePlayers(players, App.state.spectators);
  }

  function onGameStateUpdate(result) {
    App.state.gameState = result.gameState;
    const { gameType, players, playerIndex } = App.state;

    updateGame(gameType, result.gameState);
    updateTurnIndicator(result.gameState, players, playerIndex);

    if (result.gameOver) onGameOver(result);
    else setStatusFromState(result.gameState, gameType, players, playerIndex);
  }

  function onGameOver(result) {
    App.state.gameStarted = false;
    document.getElementById('resign-btn').classList.add('hidden');
    document.getElementById('rematch-btn').classList.remove('hidden');
    document.getElementById('ready-btn').classList.remove('hidden');
    document.getElementById('turn-indicator').classList.add('hidden');

    if (result.winner === -1) {
      setStatus('🤝 Draw!');
      App.toast("It's a draw!", 'info');
    } else if (result.winner === App.state.playerIndex) {
      setStatus('🏆 You won!' + (result.reason ? ` (${result.reason})` : ''));
      App.toast('You won! 🏆', 'success');
    } else {
      setStatus(`${result.winnerName} won!` + (result.reason ? ` (${result.reason})` : ''));
      App.toast(`${result.winnerName} wins!`, 'info');
    }
  }

  function onGameAborted(reason) {
    App.state.gameStarted = false;
    setStatus(reason || 'Game aborted');
    document.getElementById('resign-btn').classList.add('hidden');
    document.getElementById('rematch-btn').classList.add('hidden');
    document.getElementById('ready-btn').classList.remove('hidden');
    document.getElementById('turn-indicator').classList.add('hidden');
    document.getElementById('game-container').innerHTML = '';
  }

  // ── Game rendering (fully delegated to GameRegistry) ───────────────────────
  function renderGame(gameType, gameState, players, playerIndex, isSpectator) {
    const container = document.getElementById('game-container');
    container.innerHTML = '';
    GameRegistry.render(gameType, container, gameState, playerIndex, isSpectator);
    updateTurnIndicator(gameState, players, playerIndex);
  }

  function updateGame(gameType, gameState) {
    const container = document.getElementById('game-container');
    GameRegistry.update(gameType, container, gameState);
  }

  function updateTurnIndicator(gameState, players, playerIndex) {
    const el = document.getElementById('turn-indicator');
    if (!gameState || !players) { el.classList.add('hidden'); return; }

    const turn = gameState.currentTurn;
    const currentPlayer = players[turn];
    const name = currentPlayer ? currentPlayer.username : '?';
    const isMyTurn = turn === playerIndex;

    el.classList.remove('hidden', 'your-turn');
    el.textContent = isMyTurn ? 'Your Turn' : `${name}'s Turn`;
    if (isMyTurn) el.classList.add('your-turn');
  }

  function setStatusFromState(gameState, gameType, players, playerIndex) {
    if (!gameState) return;
    const turn = gameState.currentTurn;
    const name = players[turn] ? players[turn].username : '?';

    // Let game modules expose a status string via getStatus()
    const gameMod = GameRegistry.all().find(g => g.id === gameType);
    if (gameMod && gameMod.getStatus) {
      const s = gameMod.getStatus(gameState, playerIndex);
      if (s) { setStatus(s); return; }
    }

    // Default: chess special states
    if (gameType === 'chess') {
      if (gameState.checkmate) { setStatus('Checkmate!'); return; }
      if (gameState.stalemate) { setStatus('Stalemate — draw!'); return; }
      if (gameState.check)     { setStatus(`${name} is in check!`); return; }
    }
    setStatus(turn === playerIndex ? 'Your turn to move' : `Waiting for ${name}…`);
  }

  function setStatus(text) { document.getElementById('game-status-text').textContent = text; }
  function capitalize(s)   { return s.charAt(0).toUpperCase() + s.slice(1); }
  function esc(str)        { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  return { enter, updatePlayers, onGameStarted, onGameStateUpdate, onGameAborted };
})();
