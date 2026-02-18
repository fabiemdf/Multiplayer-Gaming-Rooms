'use strict';

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Data Stores ─────────────────────────────────────────────────────────────
const rooms = new Map();   // roomId -> Room
const users = new Map();   // socketId -> User

// ─── Constants ───────────────────────────────────────────────────────────────
const GAME_TYPES = ['tictactoe', 'connect4', 'chess', 'checkers'];
const GAME_LABELS = { tictactoe: 'Tic-Tac-Toe', connect4: 'Connect 4', chess: 'Chess', checkers: 'Checkers' };
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const MAX_PLAYERS = { tictactoe: 2, connect4: 2, chess: 2, checkers: 2 };

// ─── Room Class ──────────────────────────────────────────────────────────────
class Room {
  constructor({ name, gameType, level, isPrivate = false, password = '' }) {
    this.id = uuidv4();
    this.name = name;
    this.gameType = gameType;
    this.level = level;
    this.maxPlayers = MAX_PLAYERS[gameType] || 2;
    this.isPrivate = isPrivate;
    this.password = password;
    this.players = [];
    this.spectators = [];
    this.chatHistory = [];
    this.gameState = null;
    this.gameStarted = false;
    this.createdAt = Date.now();
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      gameType: this.gameType,
      gameLabel: GAME_LABELS[this.gameType],
      level: this.level,
      maxPlayers: this.maxPlayers,
      isPrivate: this.isPrivate,
      playerCount: this.players.length,
      spectatorCount: this.spectators.length,
      gameStarted: this.gameStarted,
      createdAt: this.createdAt
    };
  }
}

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  // Register user
  socket.on('setUsername', ({ username, avatar }) => {
    if (!username || username.trim().length < 1) {
      return socket.emit('error', 'Username required');
    }
    users.set(socket.id, {
      id: socket.id,
      username: username.trim().slice(0, 20),
      avatar: avatar || '🎮',
      roomId: null
    });
    socket.emit('usernameSet', { success: true });
  });

  // Fetch room list
  socket.on('getRooms', () => {
    socket.emit('roomsList', getPublicRooms());
  });

  // Create a room
  socket.on('createRoom', (opts) => {
    const user = users.get(socket.id);
    if (!user) return socket.emit('error', 'Not authenticated');
    if (user.roomId) return socket.emit('error', 'Already in a room');

    const { name, gameType, level, isPrivate, password } = opts;
    if (!name || !GAME_TYPES.includes(gameType) || !LEVELS.includes(level)) {
      return socket.emit('error', 'Invalid room options');
    }

    const room = new Room({ name: name.trim().slice(0, 40), gameType, level, isPrivate, password });
    const playerEntry = makePlayerEntry(user, 0);
    room.players.push(playerEntry);
    user.roomId = room.id;
    rooms.set(room.id, room);

    socket.join(room.id);
    socket.emit('roomJoined', {
      room: room.toPublic(),
      players: room.players,
      spectators: [],
      chatHistory: [],
      playerIndex: 0,
      isSpectator: false,
      gameState: null,
      gameStarted: false
    });
    broadcastRooms();
  });

  // Join a room
  socket.on('joinRoom', ({ roomId, password }) => {
    const user = users.get(socket.id);
    if (!user) return socket.emit('error', 'Not authenticated');
    if (user.roomId) return socket.emit('error', 'Already in a room');

    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', 'Room not found');
    if (room.isPrivate && room.password !== password) return socket.emit('error', 'Wrong password');

    let playerIndex = -1;
    let isSpectator = false;

    if (!room.gameStarted && room.players.length < room.maxPlayers) {
      playerIndex = room.players.length;
      room.players.push(makePlayerEntry(user, playerIndex));
    } else {
      isSpectator = true;
      room.spectators.push(makePlayerEntry(user, -1));
    }
    user.roomId = room.id;
    socket.join(room.id);

    socket.emit('roomJoined', {
      room: room.toPublic(),
      players: room.players,
      spectators: room.spectators,
      chatHistory: room.chatHistory,
      playerIndex,
      isSpectator,
      gameState: room.gameState,
      gameStarted: room.gameStarted
    });

    socket.to(room.id).emit('playerJoined', {
      player: makePlayerEntry(user, isSpectator ? -1 : playerIndex, isSpectator),
      players: room.players,
      spectators: room.spectators
    });
    broadcastRooms();
  });

  // Leave room
  socket.on('leaveRoom', () => handleLeave(socket));

  // Chat message
  socket.on('sendMessage', ({ content }) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room) return;

    const msg = {
      id: uuidv4(),
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      content: String(content).slice(0, 500),
      timestamp: Date.now()
    };
    room.chatHistory.push(msg);
    if (room.chatHistory.length > 200) room.chatHistory.shift();
    io.to(room.id).emit('chatMessage', msg);
  });

  // Toggle ready
  socket.on('playerReady', () => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || room.gameStarted) return;

    const player = room.players.find(p => p.id === user.id);
    if (!player) return;
    player.isReady = !player.isReady;
    io.to(room.id).emit('playerReadyUpdate', { players: room.players });

    if (room.players.length >= 2 && room.players.every(p => p.isReady)) {
      startGame(room);
    }
  });

  // Game action
  socket.on('gameAction', (action) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || !room.gameStarted) return;

    const player = room.players.find(p => p.id === user.id);
    if (!player) return;

    const result = processAction(room, player, action);
    if (result) {
      io.to(room.id).emit('gameStateUpdate', result);
      if (result.gameOver) {
        room.gameStarted = false;
        room.players.forEach(p => { p.isReady = false; });
        broadcastRooms();
      }
    }
  });

  // Offer rematch
  socket.on('rematch', () => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    const room = rooms.get(user.roomId);
    if (!room || room.gameStarted) return;
    socket.to(room.id).emit('rematchOffer', { fromName: user.username });
  });

  // ── WebRTC Signaling ──────────────────────────────────────────────────────
  socket.on('webrtc-offer', ({ targetId, offer }) => {
    io.to(targetId).emit('webrtc-offer', { fromId: socket.id, offer });
  });
  socket.on('webrtc-answer', ({ targetId, answer }) => {
    io.to(targetId).emit('webrtc-answer', { fromId: socket.id, answer });
  });
  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc-ice-candidate', { fromId: socket.id, candidate });
  });
  socket.on('videoJoined', () => {
    const user = users.get(socket.id);
    if (user && user.roomId) socket.to(user.roomId).emit('peerJoinedVideo', { peerId: socket.id, username: user.username });
  });
  socket.on('videoLeft', () => {
    const user = users.get(socket.id);
    if (user && user.roomId) socket.to(user.roomId).emit('peerLeftVideo', { peerId: socket.id });
  });

  socket.on('disconnect', () => {
    handleLeave(socket);
    users.delete(socket.id);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makePlayerEntry(user, playerIndex, isSpectator = false) {
  return { id: user.id, username: user.username, avatar: user.avatar, playerIndex, isSpectator, isReady: false };
}

function getPublicRooms() {
  return Array.from(rooms.values()).filter(r => !r.isPrivate).map(r => r.toPublic());
}

function broadcastRooms() {
  io.emit('roomsList', getPublicRooms());
}

function handleLeave(socket) {
  const user = users.get(socket.id);
  if (!user || !user.roomId) return;
  const room = rooms.get(user.roomId);
  if (!room) { user.roomId = null; return; }

  room.players = room.players.filter(p => p.id !== user.id);
  room.spectators = room.spectators.filter(s => s.id !== user.id);

  socket.to(room.id).emit('playerLeft', { playerId: user.id, players: room.players, spectators: room.spectators });
  socket.leave(room.id);
  user.roomId = null;

  // Abort in-progress game if a player left
  if (room.gameStarted && room.players.length < 2) {
    room.gameStarted = false;
    room.gameState = null;
    room.players.forEach(p => { p.isReady = false; });
    io.to(room.id).emit('gameAborted', { reason: 'A player disconnected' });
  }

  if (room.players.length === 0 && room.spectators.length === 0) {
    rooms.delete(room.id);
  }
  broadcastRooms();
}

function startGame(room) {
  switch (room.gameType) {
    case 'tictactoe': room.gameState = initTicTacToe(); break;
    case 'connect4':  room.gameState = initConnect4();  break;
    case 'chess':     room.gameState = initChess();     break;
    case 'checkers':  room.gameState = initCheckers();  break;
  }
  room.gameStarted = true;
  io.to(room.id).emit('gameStarted', { gameType: room.gameType, gameState: room.gameState, players: room.players });
  broadcastRooms();
}

function processAction(room, player, action) {
  switch (room.gameType) {
    case 'tictactoe': return processTicTacToe(room, player, action);
    case 'connect4':  return processConnect4(room, player, action);
    case 'chess':     return processChess(room, player, action);
    case 'checkers':  return processCheckers(room, player, action);
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TIC-TAC-TOE ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function initTicTacToe() {
  return { board: Array(9).fill(null), currentTurn: 0, moves: [] };
}

function processTicTacToe(room, player, { index }) {
  const s = room.gameState;
  if (s.currentTurn !== player.playerIndex) return null;
  if (index < 0 || index > 8 || s.board[index] !== null) return null;

  const sym = player.playerIndex === 0 ? 'X' : 'O';
  s.board[index] = sym;
  s.moves.push({ playerIndex: player.playerIndex, index });

  const win = tttWinner(s.board);
  if (win) return { gameState: s, gameOver: true, winner: player.playerIndex, winnerName: player.username, winPattern: win.pattern };

  const draw = s.board.every(c => c !== null);
  if (draw) return { gameState: s, gameOver: true, winner: -1, winnerName: null };

  s.currentTurn = 1 - s.currentTurn;
  return { gameState: s, gameOver: false };
}

function tttWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], pattern: [a,b,c] };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CONNECT 4 ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function initConnect4() {
  return { board: Array(6).fill(null).map(() => Array(7).fill(null)), currentTurn: 0, lastMove: null };
}

function processConnect4(room, player, { col }) {
  const s = room.gameState;
  if (s.currentTurn !== player.playerIndex) return null;
  if (col < 0 || col > 6) return null;

  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (!s.board[r][col]) { row = r; break; }
  }
  if (row === -1) return null;

  const color = player.playerIndex === 0 ? 'red' : 'yellow';
  s.board[row][col] = color;
  s.lastMove = { row, col };

  const win = c4Winner(s.board, row, col);
  if (win) return { gameState: s, gameOver: true, winner: player.playerIndex, winnerName: player.username, winCells: win.cells };

  const draw = s.board[0].every(c => c !== null);
  if (draw) return { gameState: s, gameOver: true, winner: -1, winnerName: null };

  s.currentTurn = 1 - s.currentTurn;
  return { gameState: s, gameOver: false };
}

function c4Winner(board, lastR, lastC) {
  const color = board[lastR][lastC];
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    const cells = [[lastR, lastC]];
    for (let i = 1; i < 4; i++) {
      const r = lastR + dr*i, c = lastC + dc*i;
      if (r>=0&&r<6&&c>=0&&c<7&&board[r][c]===color) cells.push([r,c]); else break;
    }
    for (let i = 1; i < 4; i++) {
      const r = lastR - dr*i, c = lastC - dc*i;
      if (r>=0&&r<6&&c>=0&&c<7&&board[r][c]===color) cells.push([r,c]); else break;
    }
    if (cells.length >= 4) return { cells };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CHESS ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function initChess() {
  return {
    board: makeChessBoard(),
    currentTurn: 0, // 0=white, 1=black
    moves: [],
    capturedPieces: { white: [], black: [] },
    check: false,
    checkmate: false,
    stalemate: false,
    enPassant: null,
    castling: { wKing: false, bKing: false, wRookA: false, wRookH: false, bRookA: false, bRookH: false }
  };
}

function makeChessBoard() {
  const b = Array(8).fill(null).map(() => Array(8).fill(null));
  const back = ['R','N','B','Q','K','B','N','R'];
  for (let i = 0; i < 8; i++) {
    b[0][i] = { type: back[i], color: 'black' };
    b[1][i] = { type: 'P', color: 'black' };
    b[7][i] = { type: back[i], color: 'white' };
    b[6][i] = { type: 'P', color: 'white' };
  }
  return b;
}

function processChess(room, player, { from, to, promotion }) {
  const s = room.gameState;
  const color = player.playerIndex === 0 ? 'white' : 'black';
  if ((s.currentTurn === 0 ? 'white' : 'black') !== color) return null;

  const piece = s.board[from.row][from.col];
  if (!piece || piece.color !== color) return null;

  const valid = getChessMoves(s, from.row, from.col);
  if (!valid.some(m => m.row === to.row && m.col === to.col)) return null;

  const captured = s.board[to.row][to.col];
  if (captured) s.capturedPieces[captured.color].push(captured);

  // En passant capture
  if (piece.type === 'P' && s.enPassant && to.row === s.enPassant.row && to.col === s.enPassant.col) {
    const cr = piece.color === 'white' ? to.row + 1 : to.row - 1;
    s.capturedPieces[s.board[cr][to.col].color].push(s.board[cr][to.col]);
    s.board[cr][to.col] = null;
  }

  // En passant target
  s.enPassant = (piece.type === 'P' && Math.abs(to.row - from.row) === 2)
    ? { row: (from.row + to.row) / 2, col: from.col } : null;

  // Pawn promotion
  if (piece.type === 'P' && (to.row === 0 || to.row === 7)) piece.type = promotion || 'Q';

  // Castling move
  if (piece.type === 'K' && Math.abs(to.col - from.col) === 2) {
    if (to.col > from.col) { // kingside
      s.board[from.row][5] = s.board[from.row][7];
      s.board[from.row][7] = null;
    } else { // queenside
      s.board[from.row][3] = s.board[from.row][0];
      s.board[from.row][0] = null;
    }
  }

  s.board[to.row][to.col] = piece;
  s.board[from.row][from.col] = null;

  // Update castling rights
  if (piece.type === 'K') { if (color === 'white') s.castling.wKing = true; else s.castling.bKing = true; }
  if (piece.type === 'R') {
    if (from.col === 0) { if (color === 'white') s.castling.wRookA = true; else s.castling.bRookA = true; }
    if (from.col === 7) { if (color === 'white') s.castling.wRookH = true; else s.castling.bRookH = true; }
  }

  s.moves.push({ from, to, piece: piece.type, color, captured: captured ? captured.type : null });
  s.currentTurn = 1 - s.currentTurn;

  const nextColor = s.currentTurn === 0 ? 'white' : 'black';
  s.check = isInCheck(s.board, nextColor);
  s.checkmate = s.check && !hasLegalMoves(s, nextColor);
  s.stalemate = !s.check && !hasLegalMoves(s, nextColor);

  if (s.checkmate || s.stalemate) {
    return {
      gameState: s, gameOver: true,
      winner: s.checkmate ? player.playerIndex : -1,
      winnerName: s.checkmate ? player.username : null,
      reason: s.checkmate ? 'checkmate' : 'stalemate'
    };
  }
  return { gameState: s, gameOver: false };
}

function getChessMoves(s, row, col) {
  const piece = s.board[row][col];
  if (!piece) return [];
  let moves = [];
  switch (piece.type) {
    case 'P': moves = pawnMoves(s, row, col, piece.color); break;
    case 'R': moves = slideMoves(s.board, row, col, piece.color, [[0,1],[0,-1],[1,0],[-1,0]]); break;
    case 'N': moves = knightMoves(s.board, row, col, piece.color); break;
    case 'B': moves = slideMoves(s.board, row, col, piece.color, [[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case 'Q': moves = [...slideMoves(s.board, row, col, piece.color, [[0,1],[0,-1],[1,0],[-1,0]]),
                       ...slideMoves(s.board, row, col, piece.color, [[1,1],[1,-1],[-1,1],[-1,-1]])]; break;
    case 'K': moves = kingMoves(s, row, col, piece.color); break;
  }
  // Filter moves that leave own king in check
  return moves.filter(m => {
    const nb = copyBoard(s.board);
    nb[m.row][m.col] = nb[row][col];
    nb[row][col] = null;
    // En passant removal
    if (piece.type === 'P' && s.enPassant && m.row === s.enPassant.row && m.col === s.enPassant.col) {
      nb[piece.color === 'white' ? m.row + 1 : m.row - 1][m.col] = null;
    }
    return !isInCheck(nb, piece.color);
  });
}

function pawnMoves(s, row, col, color) {
  const moves = [], dir = color === 'white' ? -1 : 1, startRow = color === 'white' ? 6 : 1;
  if (!s.board[row+dir]?.[col]) {
    moves.push({ row: row+dir, col });
    if (row === startRow && !s.board[row+2*dir]?.[col]) moves.push({ row: row+2*dir, col });
  }
  for (const dc of [-1,1]) {
    const nc = col+dc, nr = row+dir;
    if (nc>=0&&nc<8&&nr>=0&&nr<8) {
      if (s.board[nr][nc] && s.board[nr][nc].color !== color) moves.push({ row: nr, col: nc });
      if (s.enPassant && s.enPassant.row === nr && s.enPassant.col === nc) moves.push({ row: nr, col: nc });
    }
  }
  return moves;
}

function slideMoves(board, row, col, color, dirs) {
  const moves = [];
  for (const [dr,dc] of dirs) {
    for (let i = 1; i < 8; i++) {
      const r = row+dr*i, c = col+dc*i;
      if (r<0||r>7||c<0||c>7) break;
      if (board[r][c]) { if (board[r][c].color !== color) moves.push({row:r,col:c}); break; }
      moves.push({ row: r, col: c });
    }
  }
  return moves;
}

function knightMoves(board, row, col, color) {
  return [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
    .map(([dr,dc]) => ({ row: row+dr, col: col+dc }))
    .filter(({row:r,col:c}) => r>=0&&r<8&&c>=0&&c<8&&(!board[r][c]||board[r][c].color!==color));
}

function kingMoves(s, row, col, color) {
  const board = s.board, c = s.castling;
  const moves = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = row+dr, nc = col+dc;
      if (r>=0&&r<8&&nc>=0&&nc<8&&(!board[r][nc]||board[r][nc].color!==color)) moves.push({row:r,col:nc});
    }
  }
  // Castling
  const kMoved = color==='white'?c.wKing:c.bKing;
  if (!kMoved && !isInCheck(board, color)) {
    const rH = color==='white'?c.wRookH:c.bRookH;
    if (!rH && !board[row][col+1] && !board[row][col+2]) {
      const nb1=copyBoard(board); nb1[row][col+1]=board[row][col]; nb1[row][col]=null;
      const nb2=copyBoard(board); nb2[row][col+2]=board[row][col]; nb2[row][col]=null;
      if (!isInCheck(nb1,color) && !isInCheck(nb2,color)) moves.push({row,col:col+2,castling:'kingside'});
    }
    const rA = color==='white'?c.wRookA:c.bRookA;
    if (!rA && !board[row][col-1] && !board[row][col-2] && !board[row][col-3]) {
      const nb1=copyBoard(board); nb1[row][col-1]=board[row][col]; nb1[row][col]=null;
      const nb2=copyBoard(board); nb2[row][col-2]=board[row][col]; nb2[row][col]=null;
      if (!isInCheck(nb1,color) && !isInCheck(nb2,color)) moves.push({row,col:col-2,castling:'queenside'});
    }
  }
  return moves;
}

function pawnAttacks(row, col, color) {
  const dir = color==='white'?-1:1;
  return [-1,1].map(dc=>({row:row+dir,col:col+dc})).filter(({row:r,col:c})=>r>=0&&r<8&&c>=0&&c<8);
}

function isInCheck(board, color) {
  let kr=-1, kc=-1;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (board[r][c]&&board[r][c].type==='K'&&board[r][c].color===color) { kr=r; kc=c; }
  }
  if (kr===-1) return false;
  const enemy = color==='white'?'black':'white';
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c];
    if (!p||p.color!==enemy) continue;
    let atk=[];
    switch(p.type) {
      case 'P': atk=pawnAttacks(r,c,enemy); break;
      case 'R': atk=slideMoves(board,r,c,enemy,[[0,1],[0,-1],[1,0],[-1,0]]); break;
      case 'N': atk=knightMoves(board,r,c,enemy); break;
      case 'B': atk=slideMoves(board,r,c,enemy,[[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'Q': atk=[...slideMoves(board,r,c,enemy,[[0,1],[0,-1],[1,0],[-1,0]]),...slideMoves(board,r,c,enemy,[[1,1],[1,-1],[-1,1],[-1,-1]])]; break;
      case 'K': for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) atk.push({row:r+dr,col:c+dc}); break;
    }
    if (atk.some(m=>m.row===kr&&m.col===kc)) return true;
  }
  return false;
}

function hasLegalMoves(s, color) {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (s.board[r][c]&&s.board[r][c].color===color&&getChessMoves(s,r,c).length>0) return true;
  }
  return false;
}

function copyBoard(b) { return b.map(row=>row.map(cell=>cell?{...cell}:null)); }

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CHECKERS ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function initCheckers() {
  const board = Array(8).fill(null).map(()=>Array(8).fill(null));
  for (let r=0;r<3;r++) for (let c=0;c<8;c++) if((r+c)%2===1) board[r][c]={color:'red',isKing:false};
  for (let r=5;r<8;r++) for (let c=0;c<8;c++) if((r+c)%2===1) board[r][c]={color:'black',isKing:false};
  return { board, currentTurn: 0 };
}

function processCheckers(room, player, { from, to }) {
  const s = room.gameState;
  if (s.currentTurn !== player.playerIndex) return null;
  const pColor = player.playerIndex === 0 ? 'black' : 'red';
  const piece = s.board[from.row][from.col];
  if (!piece||piece.color!==pColor) return null;

  if (!doCheckerMove(s, from, to, pColor)) return null;

  const winner = checkersWinner(s.board);
  if (winner !== null) return { gameState: s, gameOver: true, winner, winnerName: room.players[winner].username };
  return { gameState: s, gameOver: false };
}

function doCheckerMove(s, from, to, color) {
  const board = s.board;
  const piece = board[from.row][from.col];
  const dr = to.row - from.row, dc = to.col - from.col;
  const validDir = color==='black'?1:-1;
  if (!piece.isKing && Math.sign(dr)!==validDir) return false;
  if (!board[to.row]||board[to.row][to.col]!==null) return false;

  if (Math.abs(dr)===1 && Math.abs(dc)===1) {
    // Simple move
    if (mandatoryCaptures(board, color).length > 0) return false;
    board[to.row][to.col] = piece;
    board[from.row][from.col] = null;
  } else if (Math.abs(dr)===2 && Math.abs(dc)===2) {
    // Capture
    const mr = (from.row+to.row)/2, mc = (from.col+to.col)/2;
    const mid = board[mr][mc];
    if (!mid||mid.color===color) return false;
    board[to.row][to.col] = piece;
    board[from.row][from.col] = null;
    board[mr][mc] = null;
  } else {
    return false;
  }

  // King promotion
  if ((color==='black'&&to.row===7)||(color==='red'&&to.row===0)) board[to.row][to.col].isKing=true;
  s.currentTurn = 1 - s.currentTurn;
  return true;
}

function mandatoryCaptures(board, color) {
  const caps = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c];
    if (!p||p.color!==color) continue;
    const dirs = p.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (color==='black'?[[1,-1],[1,1]]:[[-1,-1],[-1,1]]);
    for (const [dr,dc] of dirs) {
      const mr=r+dr,mc=c+dc,tr=r+dr*2,tc=c+dc*2;
      if (tr>=0&&tr<8&&tc>=0&&tc<8&&board[mr]?.[mc]&&board[mr][mc].color!==color&&!board[tr][tc]) {
        caps.push({from:{row:r,col:c},to:{row:tr,col:tc}});
      }
    }
  }
  return caps;
}

function checkersWinner(board) {
  let black=0, red=0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (board[r][c]) { if(board[r][c].color==='black') black++; else red++; }
  }
  if (black===0) return 1;
  if (red===0) return 0;
  return null;
}

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🎮 Multiplayer Gaming Rooms running at http://localhost:${PORT}`);
});
