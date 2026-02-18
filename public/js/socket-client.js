/* ════════════════════════════════════════════════════════════════
   SOCKET CLIENT – All Socket.IO events
   ════════════════════════════════════════════════════════════════ */

const SocketClient = (() => {
  let socket = null;

  function connect(username, avatar) {
    socket = io();

    socket.on('connect', () => {
      socket.emit('setUsername', { username, avatar });
    });

    // Server sends available game types immediately on connect
    socket.on('gameTypes', gameList => {
      Lobby.onGameTypes(gameList);
    });

    socket.on('usernameSet', ({ success }) => {
      if (success) {
        App.showScreen('lobby');
        Lobby.init(username, avatar);
        socket.emit('getRooms');
      }
    });

    socket.on('roomsList', rooms => {
      Lobby.updateRooms(rooms);
    });

    socket.on('roomJoined', data => {
      App.state.currentRoom = data.room;
      App.state.playerIndex = data.playerIndex;
      App.state.isSpectator = data.isSpectator;
      App.state.players = data.players;
      App.state.spectators = data.spectators || [];
      App.state.gameStarted = data.gameStarted;
      App.state.gameType = data.room.gameType;
      App.state.gameState = data.gameState;
      Room.enter(data);
      App.showScreen('room');
    });

    socket.on('playerJoined', data => {
      App.state.players = data.players;
      App.state.spectators = data.spectators || [];
      Room.updatePlayers(data.players, data.spectators);
      Chat.addSystemMsg(`${data.player.username} joined the room`);
      App.toast(`${data.player.username} joined`, 'info');
    });

    socket.on('playerLeft', data => {
      App.state.players = data.players;
      App.state.spectators = data.spectators || [];
      Room.updatePlayers(data.players, data.spectators);
      Chat.addSystemMsg('A player left the room');
    });

    socket.on('playerReadyUpdate', ({ players }) => {
      App.state.players = players;
      Room.updatePlayers(players, App.state.spectators);
    });

    socket.on('gameStarted', data => {
      App.state.gameStarted = true;
      App.state.gameType = data.gameType;
      App.state.gameState = data.gameState;
      App.state.players = data.players;
      Room.onGameStarted(data);
      Chat.addSystemMsg('Game started! Good luck!');
    });

    socket.on('gameStateUpdate', result => {
      App.state.gameState = result.gameState;
      Room.onGameStateUpdate(result);
    });

    socket.on('gameAborted', ({ reason }) => {
      App.state.gameStarted = false;
      App.state.gameState = null;
      Room.onGameAborted(reason);
      App.toast(reason, 'error');
      Chat.addSystemMsg(reason);
    });

    socket.on('chatMessage', msg => {
      Chat.addMessage(msg);
    });

    socket.on('peerJoinedVideo', ({ peerId, username }) => {
      VideoManager.onPeerJoined(peerId, username);
    });

    socket.on('peerLeftVideo', ({ peerId }) => {
      VideoManager.onPeerLeft(peerId);
    });

    socket.on('webrtc-offer', async ({ fromId, offer }) => {
      await VideoManager.handleOffer(fromId, offer);
    });

    socket.on('webrtc-answer', async ({ fromId, answer }) => {
      await VideoManager.handleAnswer(fromId, answer);
    });

    socket.on('webrtc-ice-candidate', async ({ fromId, candidate }) => {
      await VideoManager.handleIceCandidate(fromId, candidate);
    });

    socket.on('rematchOffer', ({ fromName }) => {
      App.toast(`${fromName} wants a rematch!`, 'info', 5000);
    });

    socket.on('error', msg => {
      App.toast(msg, 'error');
    });

    socket.on('disconnect', () => {
      App.toast('Disconnected from server', 'error');
    });
  }

  // ── Emit helpers ─────────────────────────────────────────────
  const emit = (event, data) => socket && socket.emit(event, data);

  return {
    connect,
    get id() { return socket ? socket.id : null; },
    createRoom: opts => emit('createRoom', opts),
    joinRoom: (roomId, password = '') => emit('joinRoom', { roomId, password }),
    leaveRoom: () => emit('leaveRoom'),
    sendMessage: content => emit('sendMessage', { content }),
    playerReady: () => emit('playerReady'),
    gameAction: action => emit('gameAction', action),
    rematch: () => emit('rematch'),
    videoJoined: () => emit('videoJoined'),
    videoLeft: () => emit('videoLeft'),
    webrtcOffer: (targetId, offer) => emit('webrtc-offer', { targetId, offer }),
    webrtcAnswer: (targetId, answer) => emit('webrtc-answer', { targetId, answer }),
    webrtcIce: (targetId, candidate) => emit('webrtc-ice-candidate', { targetId, candidate })
  };
})();
