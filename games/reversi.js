'use strict';
/**
 * Reversi (Othello) – 8×8 disc-flipping strategy game.
 * Player 0 = black, Player 1 = white.
 * Standard starting position; black moves first.
 */

module.exports = {
  id: 'reversi',
  label: 'Reversi',
  icon: '⬤',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    board[3][3] = 'white'; board[3][4] = 'black';
    board[4][3] = 'black'; board[4][4] = 'white';
    return {
      board,
      currentTurn: 0,           // 0=black, 1=white
      scores: { black: 2, white: 2 },
      validMoves: validMoves(board, 'black')
    };
  },

  processAction(room, player, action) {
    const { row, col } = action;
    const s = room.gameState;
    if (s.currentTurn !== player.playerIndex) return null;

    const color = player.playerIndex === 0 ? 'black' : 'white';
    if (!s.validMoves.some(m => m.row === row && m.col === col)) return null;

    // Place disc and flip opponents
    s.board[row][col] = color;
    flipPieces(s.board, row, col, color);

    // Advance turn
    s.currentTurn = 1 - s.currentTurn;
    const nextColor = s.currentTurn === 0 ? 'black' : 'white';
    let nextMoves = validMoves(s.board, nextColor);

    if (nextMoves.length === 0) {
      // Current player might still have moves
      s.currentTurn = 1 - s.currentTurn;
      const prevMoves = validMoves(s.board, color);
      if (prevMoves.length === 0) {
        // Neither side can move → game over
        s.scores = countScores(s.board);
        s.validMoves = [];
        const w = s.scores.black > s.scores.white ? 0
                : s.scores.white > s.scores.black ? 1
                : -1;
        return {
          gameState: s, gameOver: true,
          winner: w,
          winnerName: w >= 0 ? room.players[w].username : null,
          scores: s.scores
        };
      }
      // Pass – opponent moves again
      nextMoves = prevMoves;
    }

    s.validMoves = nextMoves;
    s.scores = countScores(s.board);
    return { gameState: s, gameOver: false };
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const DIRS = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];

function flips(board, row, col, color) {
  const enemy = color === 'black' ? 'white' : 'black';
  const result = [];
  for (const [dr,dc] of DIRS) {
    const line = [];
    for (let i = 1; i < 8; i++) {
      const r = row+dr*i, c = col+dc*i;
      if (r<0||r>7||c<0||c>7) break;
      if (board[r][c] === enemy) { line.push([r,c]); continue; }
      if (board[r][c] === color) { result.push(...line); break; }
      break;
    }
  }
  return result;
}

function flipPieces(board, row, col, color) {
  flips(board, row, col, color).forEach(([r,c]) => { board[r][c] = color; });
}

function validMoves(board, color) {
  const moves = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (!board[r][c] && flips(board, r, c, color).length > 0) moves.push({ row: r, col: c });
  }
  return moves;
}

function countScores(board) {
  let black = 0, white = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (board[r][c] === 'black') black++;
    else if (board[r][c] === 'white') white++;
  }
  return { black, white };
}
