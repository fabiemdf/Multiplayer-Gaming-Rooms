/* ════════════════════════════════════════════════════════════════
   ROOM – Room state display, player list, game wiring
   ════════════════════════════════════════════════════════════════ */

const Room = (() => {
  const GAME_LABELS = { tictactoe: 'Tic-Tac-Toe', connect4: 'Connect 4', chess: 'Chess', checkers: 'Checkers' };

  function enter(data) {
    const { room, players, spectators, chatHistory, playerIndex, isSpectator, gameState, gameStarted } = data;

    // Header
    document.getElementById('room-name-display').textContent = room.name;
    document.getElementById('room-meta').textContent =
      `${GAME_LABELS[room.gameType]} · ${capitalize(room.level)}`;

    // Reset UI
    document.getElementById('game-container').innerHTML = '';
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('resign-btn').classList.add('hidden');
    document.getElementById('rematch-btn').classList.add('hidden');
    document.getElementById('ready-btn').classList.remove('hidden');

    // Populate
    updatePlayers(players, spectators);
    Chat.init();
    Chat.loadHistory(chatHistory);
    VideoManager.init();

    // Controls
    bindControls(playerIndex, isSpectator);

    // If game was already in progress when we joined
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
    const readyBtn = document.getElementById('ready-btn');
    const resignBtn = document.getElementById('resign-btn');
    const rematchBtn = document.getElementById('rematch-btn');
    const leaveBtn = document.getElementById('leave-room-btn');

    // Clone to remove old listeners
    replaceBtn(readyBtn, () => SocketClient.playerReady());
    replaceBtn(resignBtn, () => {
      if (confirm('Are you sure you want to resign?')) {
        SocketClient.gameAction({ type: 'resign' });
      }
    });
    replaceBtn(rematchBtn, () => SocketClient.rematch());
    replaceBtn(leaveBtn, () => {
      SocketClient.leaveRoom();
      VideoManager.cleanup();
      App.showScreen('lobby');
    });

    if (isSpectator) readyBtn.classList.add('hidden');
  }

  function replaceBtn(btn, handler) {
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
        <span class="player-avatar">${escapeHtml(p.avatar)}</span>
        <span class="player-name">${escapeHtml(p.username)}${p.id === myId ? ' <small>(you)</small>' : ''}</span>
        <span class="player-badge ${badgeColor}">${p.playerIndex === 0 ? 'P1' : 'P2'}</span>
        ${readyBadge}
      `;
      list.appendChild(row);
    });

    // Spectators
    const specOuter = document.getElementById('spectators-list');
    const specInner = document.getElementById('spectators-inner');
    if (spectators && spectators.length > 0) {
      specOuter.classList.remove('hidden');
      specInner.innerHTML = spectators.map(s =>
        `<span class="spectator-chip" title="${escapeHtml(s.username)}">${escapeHtml(s.avatar)}</span>`
      ).join('');
    } else {
      specOuter.classList.add('hidden');
    }
  }

  function onGameStarted({ gameType, gameState, players }) {
    App.state.gameStarted = true;
    App.state.gameState = gameState;
    App.state.players = players;

    document.getElementById('ready-btn').classList.add('hidden');
    if (!App.state.isSpectator) document.getElementById('resign-btn').classList.remove('hidden');
    document.getElementById('rematch-btn').classList.add('hidden');

    renderGame(gameType, gameState, players, App.state.playerIndex, App.state.isSpectator);
    setStatusFromState(gameState, gameType, players, App.state.playerIndex);
    updatePlayers(players, App.state.spectators);
  }

  function onGameStateUpdate(result) {
    App.state.gameState = result.gameState;
    const { gameType, players, playerIndex, isSpectator } = App.state;

    updateGame(gameType, result.gameState);
    updateTurnIndicator(result.gameState, gameType, players, playerIndex);

    if (result.gameOver) {
      onGameOver(result);
    } else {
      setStatusFromState(result.gameState, gameType, players, playerIndex);
    }
  }

  function onGameOver(result) {
    App.state.gameStarted = false;

    document.getElementById('resign-btn').classList.add('hidden');
    document.getElementById('rematch-btn').classList.remove('hidden');
    document.getElementById('ready-btn').classList.remove('hidden');

    const turnEl = document.getElementById('turn-indicator');
    turnEl.classList.add('hidden');

    if (result.winner === -1) {
      setStatus('🤝 Draw!');
      App.toast("It's a draw!", 'info');
    } else if (result.winner === App.state.playerIndex) {
      setStatus('🏆 You won! ' + (result.reason ? `(${result.reason})` : ''));
      App.toast('You won! 🏆', 'success');
    } else {
      setStatus(`${result.winnerName} won! ${result.reason ? `(${result.reason})` : ''}`);
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

  function renderGame(gameType, gameState, players, playerIndex, isSpectator) {
    const container = document.getElementById('game-container');
    container.innerHTML = '';

    switch (gameType) {
      case 'tictactoe': TicTacToeGame.render(container, gameState, playerIndex, isSpectator); break;
      case 'connect4':  Connect4Game.render(container, gameState, playerIndex, isSpectator);  break;
      case 'chess':     ChessGame.render(container, gameState, playerIndex, isSpectator);     break;
      case 'checkers':  CheckersGame.render(container, gameState, playerIndex, isSpectator);  break;
    }
    updateTurnIndicator(gameState, gameType, players, playerIndex);
  }

  function updateGame(gameType, gameState) {
    const container = document.getElementById('game-container');
    switch (gameType) {
      case 'tictactoe': TicTacToeGame.update(container, gameState); break;
      case 'connect4':  Connect4Game.update(container, gameState);  break;
      case 'chess':     ChessGame.update(container, gameState);     break;
      case 'checkers':  CheckersGame.update(container, gameState);  break;
    }
  }

  function updateTurnIndicator(gameState, gameType, players, playerIndex) {
    const el = document.getElementById('turn-indicator');
    if (!gameState || !players) { el.classList.add('hidden'); return; }

    const turn = gameState.currentTurn;
    const isMyTurn = turn === playerIndex;
    const currentPlayer = players[turn];
    const name = currentPlayer ? currentPlayer.username : '?';

    el.classList.remove('hidden', 'your-turn');
    el.textContent = isMyTurn ? 'Your Turn' : `${name}'s Turn`;
    if (isMyTurn) el.classList.add('your-turn');
  }

  function setStatusFromState(gameState, gameType, players, playerIndex) {
    if (!gameState) return;
    const turn = gameState.currentTurn;
    const currentPlayer = players[turn];
    const name = currentPlayer ? currentPlayer.username : '?';

    if (gameType === 'chess') {
      if (gameState.checkmate) { setStatus(`Checkmate!`); return; }
      if (gameState.stalemate) { setStatus(`Stalemate — draw!`); return; }
      if (gameState.check)     { setStatus(`${name} is in check!`); return; }
    }
    setStatus(turn === playerIndex ? 'Your turn to move' : `Waiting for ${name}…`);
  }

  function setStatus(text) {
    document.getElementById('game-status-text').textContent = text;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { enter, updatePlayers, onGameStarted, onGameStateUpdate, onGameAborted };
})();
