'use strict';
/**
 * Gomoku (Five-in-a-Row) – 15×15 Go-style board.
 * Player 0 = black stones, Player 1 = white stones.
 * First to place 5 stones in a row (horizontal, vertical, or diagonal) wins.
 */

const SIZE = 15;

module.exports = {
  id: 'gomoku',
  label: 'Gomoku',
  icon: '⚫',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    return {
      board: Array(SIZE).fill(null).map(() => Array(SIZE).fill(null)),
      currentTurn: 0,   // 0=black, 1=white
      size: SIZE,
      lastMove: null,
      moveCount: 0
    };
  },

  processAction(room, player, action) {
    const { row, col } = action;
    const s = room.gameState;
    if (s.currentTurn !== player.playerIndex) return null;
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    if (s.board[row][col]) return null;

    const color = player.playerIndex === 0 ? 'black' : 'white';
    s.board[row][col] = color;
    s.lastMove = { row, col };
    s.moveCount++;

    const winCells = checkWin(s.board, row, col, color);
    if (winCells) {
      return { gameState: s, gameOver: true, winner: player.playerIndex, winnerName: player.username, winCells };
    }

    if (s.moveCount === SIZE * SIZE) {
      return { gameState: s, gameOver: true, winner: -1, winnerName: null };
    }

    s.currentTurn = 1 - s.currentTurn;
    return { gameState: s, gameOver: false };
  }
};

function checkWin(board, row, col, color) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    const cells = [[row,col]];
    for (let i=1;i<5;i++){const r=row+dr*i,c=col+dc*i; if(r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r][c]===color)cells.push([r,c]);else break;}
    for (let i=1;i<5;i++){const r=row-dr*i,c=col-dc*i; if(r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r][c]===color)cells.push([r,c]);else break;}
    if (cells.length >= 5) return cells;
  }
  return null;
}
