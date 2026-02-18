'use strict';

// Load env vars before anything else
require('dotenv').config();

const express    = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path       = require('path');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const bcrypt     = require('bcryptjs');

// ─── Game Registry (auto-loads every file in ./games/) ────────────────────────
console.log('Loading games…');
const GameRegistry = require('./games');
console.log(`${Object.keys(GameRegistry).length} game(s) registered.\n`);

const LEVELS = ['beginner', 'intermediate', 'advanced'];

// ─── CORS origins ─────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

const isProd = process.env.NODE_ENV === 'production';

// ─── Express + Security Middleware ────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'", 'ws:', 'wss:'],
      mediaSrc:    ["'self'"],
      frameSrc:    ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,  // needed for WebRTC
}));

// HTTP rate limiter (REST endpoints / static assets)
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '200',   10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests, please try again later.' },
}));

app.use(express.static(path.join(__dirname, 'public')));

// ─── Health endpoint ──────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    uptime:  Math.floor(process.uptime()),
    rooms:   rooms.size,
    users:   users.size,
  });
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:      ALLOWED_ORIGINS,
    methods:     ['GET', 'POST'],
    credentials: true,
  }
});

// ─── Socket rate limiter ───────────────────────────────────────────────────────
// Tracks event counts per socket; reset every WINDOW_MS
const SOCKET_RATE = {
  windowMs:  15_000,   // 15 s window
  maxEvents: 60,       // max 60 events per window
};
const socketEventCounts = new Map();  // socketId -> { count, resetAt }

function socketAllowed(socketId) {
  const now = Date.now();
  let entry = socketEventCounts.get(socketId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + SOCKET_RATE.windowMs };
    socketEventCounts.set(socketId, entry);
  }
  entry.count++;
  return entry.count <= SOCKET_RATE.maxEvents;
}

// ─── Data Stores ──────────────────────────────────────────────────────────────
const rooms = new Map();   // roomId -> Room
const users = new Map();   // socketId -> User

// ─── Room Class ───────────────────────────────────────────────────────────────
class Room {
  constructor({ name, gameType, level, isPrivate = false, passwordHash = '' }) {
    const def = GameRegistry[gameType];
    this.id           = uuidv4();
    this.name         = name;
    this.gameType     = gameType;
    this.level        = level;
    this.maxPlayers   = def ? def.maxPlayers : 2;
    this.isPrivate    = isPrivate;
    this.passwordHash = passwordHash;   // bcrypt hash, never plaintext
    this.players      = [];
    this.spectators   = [];
    this.chatHistory  = [];
    this.gameState    = null;
    this.gameStarted  = false;
    this.createdAt    = Date.now();
  }

  async checkPassword(plain) {
    if (!this.isPrivate) return true;
    if (!plain)          return false;
    return bcrypt.compare(String(plain), this.passwordHash);
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

// ─── Socket.IO connection handler ─────────────────────────────────────────────
io.on('connection', (socket) => {

  // Send available game types on first connect
  socket.emit('gameTypes', getGameTypesList());

  // Helper: reject if over rate limit
  function guard(fn) {
    return (...args) => {
      if (!socketAllowed(socket.id)) {
        socket.emit('error', 'Too many requests — slow down!');
        return;
      }
      try {
        const result = fn(...args);
        // Handle async handlers transparently
        if (result && typeof result.catch === 'function') {
          result.catch(err => {
            console.error(`[socket:${socket.id}] unhandled async error:`, err);
            socket.emit('error', 'An unexpected error occurred.');
          });
        }
      } catch (err) {
        console.error(`[socket:${socket.id}] unhandled error:`, err);
        socket.emit('error', 'An unexpected error occurred.');
      }
    };
  }

  socket.on('setUsername', guard(({ username, avatar } = {}) => {
    if (!username || !String(username).trim())
      return socket.emit('error', 'Username required');
    const clean = String(username).trim().slice(0, 20);
    users.set(socket.id, { id: socket.id, username: clean, avatar: avatar || '🎮', roomId: null });
    socket.emit('usernameSet', { success: true });
  }));

  socket.on('getRooms', guard(() => socket.emit('roomsList', getPublicRooms())));

  socket.on('createRoom', guard(async (opts = {}) => {
    const user = users.get(socket.id);
    if (!user)       return socket.emit('error', 'Not authenticated');
    if (user.roomId) return socket.emit('error', 'Already in a room');

    const { name, gameType, level, isPrivate, password } = opts;
    if (!name || !GameRegistry[gameType] || !LEVELS.includes(level))
      return socket.emit('error', 'Invalid room options');

    let passwordHash = '';
    if (isPrivate && password) {
      passwordHash = await bcrypt.hash(String(password).slice(0, 72), 10);
    }

    const room = new Room({ name: String(name).trim().slice(0, 40), gameType, level, isPrivate: !!isPrivate, passwordHash });
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
  }));

  socket.on('joinRoom', guard(async ({ roomId, password } = {}) => {
    const user = users.get(socket.id);
    if (!user)       return socket.emit('error', 'Not authenticated');
    if (user.roomId) return socket.emit('error', 'Already in a room');

    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', 'Room not found');

    const ok = await room.checkPassword(password);
    if (!ok) return socket.emit('error', 'Wrong password');

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
  }));

  socket.on('leaveRoom', guard(() => handleLeave(socket)));

  socket.on('sendMessage', guard(({ content } = {}) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room) return;

    const msg = {
      id: uuidv4(),
      senderId:     user.id,
      senderName:   user.username,
      senderAvatar: user.avatar,
      content:      String(content || '').slice(0, 500),
      timestamp:    Date.now()
    };
    room.chatHistory.push(msg);
    if (room.chatHistory.length > 200) room.chatHistory.shift();
    io.to(room.id).emit('chatMessage', msg);
  }));

  socket.on('playerReady', guard(() => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || room.gameStarted) return;

    const player = room.players.find(p => p.id === user.id);
    if (!player) return;
    player.isReady = !player.isReady;
    io.to(room.id).emit('playerReadyUpdate', { players: room.players });

    if (room.players.length >= 2 && room.players.every(p => p.isReady)) startGame(room);
  }));

  socket.on('gameAction', guard((action) => {
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
  }));

  socket.on('rematch', guard(() => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || room.gameStarted) return;
    socket.to(room.id).emit('rematchOffer', { fromName: user.username });
  }));

  // ── WebRTC signaling ────────────────────────────────────────────────────────
  socket.on('webrtc-offer',         guard(({ targetId, offer })     => io.to(targetId).emit('webrtc-offer',         { fromId: socket.id, offer })));
  socket.on('webrtc-answer',        guard(({ targetId, answer })    => io.to(targetId).emit('webrtc-answer',        { fromId: socket.id, answer })));
  socket.on('webrtc-ice-candidate', guard(({ targetId, candidate }) => io.to(targetId).emit('webrtc-ice-candidate', { fromId: socket.id, candidate })));

  socket.on('videoJoined', guard(() => {
    const user = users.get(socket.id);
    if (user && user.roomId) socket.to(user.roomId).emit('peerJoinedVideo', { peerId: socket.id, username: user.username });
  }));
  socket.on('videoLeft', guard(() => {
    const user = users.get(socket.id);
    if (user && user.roomId) socket.to(user.roomId).emit('peerLeftVideo', { peerId: socket.id });
  }));

  socket.on('disconnect', () => {
    try { handleLeave(socket); } catch (e) { console.error('[disconnect]', e); }
    users.delete(socket.id);
    socketEventCounts.delete(socket.id);
  });
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

  room.players    = room.players.filter(p => p.id !== user.id);
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

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received – shutting down gracefully`);
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  // Force-exit after 10 s if connections linger
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
httpServer.listen(PORT, () => {
  const env = process.env.NODE_ENV || 'development';
  console.log(`🎮 Gaming Rooms running at http://localhost:${PORT} [${env}]`);
  if (!isProd) console.log('   Allowed origins:', ALLOWED_ORIGINS.join(', '));
});
