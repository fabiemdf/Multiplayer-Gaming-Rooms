'use strict';

const express    = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path       = require('path');

// ─── Game Registry (auto-loads every file in ./games/) ────────────────────────
console.log('Loading games…');
const GameRegistry = require('./games');
console.log(`${Object.keys(GameRegistry).length} game(s) registered.\n`);

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Data Stores ──────────────────────────────────────────────────────────────
const rooms = new Map();   // roomId -> Room
const users = new Map();   // socketId -> User

// ─── Room Class ───────────────────────────────────────────────────────────────
class Room {
  constructor({ name, gameType, level, isPrivate = false, password = '' }) {
    const def = GameRegistry[gameType];
    this.id          = uuidv4();
    this.name        = name;
    this.gameType    = gameType;
    this.level       = level;
    this.maxPlayers  = def ? def.maxPlayers : 2;
    this.isPrivate   = isPrivate;
    this.password    = password;
    this.players     = [];
    this.spectators  = [];
    this.chatHistory = [];
    this.gameState   = null;
    this.gameStarted = false;
    this.createdAt   = Date.now();
  }

  toPublic() {
    const def = GameRegistry[this.gameType] || {};
    return {
      id:            this.id,
      name:          this.name,
      gameType:      this.gameType,
      gameLabel:     def.label || this.gameType,
      gameIcon:      def.icon  || '🎮',
      level:         this.level,
      maxPlayers:    this.maxPlayers,
      isPrivate:     this.isPrivate,
      playerCount:   this.players.length,
      spectatorCount:this.spectators.length,
      gameStarted:   this.gameStarted,
      createdAt:     this.createdAt
    };
  }
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // Send available game types on first connect
  socket.emit('gameTypes', getGameTypesList());

  socket.on('setUsername', ({ username, avatar }) => {
    if (!username || !username.trim()) return socket.emit('error', 'Username required');
    users.set(socket.id, { id: socket.id, username: username.trim().slice(0,20), avatar: avatar || '🎮', roomId: null });
    socket.emit('usernameSet', { success: true });
  });

  socket.on('getRooms', () => socket.emit('roomsList', getPublicRooms()));

  socket.on('createRoom', (opts) => {
    const user = users.get(socket.id);
    if (!user)        return socket.emit('error', 'Not authenticated');
    if (user.roomId)  return socket.emit('error', 'Already in a room');

    const { name, gameType, level, isPrivate, password } = opts;
    if (!name || !GameRegistry[gameType] || !LEVELS.includes(level))
      return socket.emit('error', 'Invalid room options');

    const room = new Room({ name: name.trim().slice(0,40), gameType, level, isPrivate, password });
    room.players.push(mkPlayer(user, 0));
    user.roomId = room.id;
    rooms.set(room.id, room);
    socket.join(room.id);

    socket.emit('roomJoined', {
      room: room.toPublic(), players: room.players, spectators: [],
      chatHistory: [], playerIndex: 0, isSpectator: false,
      gameState: null, gameStarted: false
    });
    broadcastRooms();
  });

  socket.on('joinRoom', ({ roomId, password }) => {
    const user = users.get(socket.id);
    if (!user)       return socket.emit('error', 'Not authenticated');
    if (user.roomId) return socket.emit('error', 'Already in a room');

    const room = rooms.get(roomId);
    if (!room)                                          return socket.emit('error', 'Room not found');
    if (room.isPrivate && room.password !== password)   return socket.emit('error', 'Wrong password');

    let playerIndex = -1, isSpectator = false;
    if (!room.gameStarted && room.players.length < room.maxPlayers) {
      playerIndex = room.players.length;
      room.players.push(mkPlayer(user, playerIndex));
    } else {
      isSpectator = true;
      room.spectators.push(mkPlayer(user, -1));
    }
    user.roomId = room.id;
    socket.join(room.id);

    socket.emit('roomJoined', {
      room: room.toPublic(), players: room.players, spectators: room.spectators,
      chatHistory: room.chatHistory, playerIndex, isSpectator,
      gameState: room.gameState, gameStarted: room.gameStarted
    });
    socket.to(room.id).emit('playerJoined', {
      player: mkPlayer(user, isSpectator ? -1 : playerIndex, isSpectator),
      players: room.players, spectators: room.spectators
    });
    broadcastRooms();
  });

  socket.on('leaveRoom', () => handleLeave(socket));

  socket.on('sendMessage', ({ content }) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room) return;

    const msg = { id: uuidv4(), senderId: user.id, senderName: user.username, senderAvatar: user.avatar, content: String(content).slice(0,500), timestamp: Date.now() };
    room.chatHistory.push(msg);
    if (room.chatHistory.length > 200) room.chatHistory.shift();
    io.to(room.id).emit('chatMessage', msg);
  });

  socket.on('playerReady', () => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || room.gameStarted) return;

    const player = room.players.find(p => p.id === user.id);
    if (!player) return;
    player.isReady = !player.isReady;
    io.to(room.id).emit('playerReadyUpdate', { players: room.players });

    if (room.players.length >= 2 && room.players.every(p => p.isReady)) startGame(room);
  });

  socket.on('gameAction', (action) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || !room.gameStarted) return;

    const player = room.players.find(p => p.id === user.id);
    if (!player) return;

    const gameDef = GameRegistry[room.gameType];
    if (!gameDef) return;

    const result = gameDef.processAction(room, player, action);
    if (!result) return;

    io.to(room.id).emit('gameStateUpdate', result);
    if (result.gameOver) {
      room.gameStarted = false;
      room.players.forEach(p => { p.isReady = false; });
      broadcastRooms();
    }
  });

  socket.on('rematch', () => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || room.gameStarted) return;
    socket.to(room.id).emit('rematchOffer', { fromName: user.username });
  });

  // ── WebRTC signaling ────────────────────────────────────────────────────────
  socket.on('webrtc-offer',         ({ targetId, offer })     => io.to(targetId).emit('webrtc-offer',         { fromId: socket.id, offer }));
  socket.on('webrtc-answer',        ({ targetId, answer })    => io.to(targetId).emit('webrtc-answer',        { fromId: socket.id, answer }));
  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => io.to(targetId).emit('webrtc-ice-candidate', { fromId: socket.id, candidate }));

  socket.on('videoJoined', () => {
    const user = users.get(socket.id);
    if (user && user.roomId) socket.to(user.roomId).emit('peerJoinedVideo', { peerId: socket.id, username: user.username });
  });
  socket.on('videoLeft', () => {
    const user = users.get(socket.id);
    if (user && user.roomId) socket.to(user.roomId).emit('peerLeftVideo', { peerId: socket.id });
  });

  socket.on('disconnect', () => { handleLeave(socket); users.delete(socket.id); });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mkPlayer(user, playerIndex, isSpectator = false) {
  return { id: user.id, username: user.username, avatar: user.avatar, playerIndex, isSpectator, isReady: false };
}

function getPublicRooms() {
  return Array.from(rooms.values()).filter(r => !r.isPrivate).map(r => r.toPublic());
}

function broadcastRooms() {
  io.emit('roomsList', getPublicRooms());
}

function getGameTypesList() {
  return Object.values(GameRegistry).map(g => ({
    id:         g.id,
    label:      g.label,
    icon:       g.icon,
    maxPlayers: g.maxPlayers,
    minPlayers: g.minPlayers
  }));
}

function handleLeave(socket) {
  const user = users.get(socket.id);
  if (!user || !user.roomId) return;
  const room = rooms.get(user.roomId);
  if (!room) { user.roomId = null; return; }

  room.players   = room.players.filter(p => p.id !== user.id);
  room.spectators = room.spectators.filter(s => s.id !== user.id);

  socket.to(room.id).emit('playerLeft', { playerId: user.id, players: room.players, spectators: room.spectators });
  socket.leave(room.id);
  user.roomId = null;

  if (room.gameStarted && room.players.length < 2) {
    room.gameStarted = false;
    room.gameState   = null;
    room.players.forEach(p => { p.isReady = false; });
    io.to(room.id).emit('gameAborted', { reason: 'A player disconnected' });
  }

  if (room.players.length === 0 && room.spectators.length === 0) rooms.delete(room.id);
  broadcastRooms();
}

function startGame(room) {
  const gameDef = GameRegistry[room.gameType];
  if (!gameDef) return;
  room.gameState   = gameDef.init();
  room.gameStarted = true;
  io.to(room.id).emit('gameStarted', { gameType: room.gameType, gameState: room.gameState, players: room.players });
  broadcastRooms();
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🎮 Gaming Rooms running at http://localhost:${PORT}`));
