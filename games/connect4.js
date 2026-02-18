'use strict';

module.exports = {
  id: 'connect4',
  label: 'Connect 4',
  icon: '🔴',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    return { board: Array(6).fill(null).map(() => Array(7).fill(null)), currentTurn: 0, lastMove: null };
  },

  processAction(room, player, action) {
    const { col } = action;
    const s = room.gameState;
    if (s.currentTurn !== player.playerIndex) return null;
    if (col < 0 || col > 6) return null;

    let row = -1;
    for (let r = 5; r >= 0; r--) { if (!s.board[r][col]) { row = r; break; } }
    if (row === -1) return null;

    const color = player.playerIndex === 0 ? 'red' : 'yellow';
    s.board[row][col] = color;
    s.lastMove = { row, col };

    const win = winnerAt(s.board, row, col);
    if (win) return { gameState: s, gameOver: true, winner: player.playerIndex, winnerName: player.username, winCells: win.cells };

    if (s.board[0].every(c => c !== null)) return { gameState: s, gameOver: true, winner: -1, winnerName: null };

    s.currentTurn = 1 - s.currentTurn;
    return { gameState: s, gameOver: false };
  }
};

function winnerAt(board, lastR, lastC) {
  const color = board[lastR][lastC];
  for (const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
    const cells = [[lastR,lastC]];
    for (let i=1;i<4;i++){const r=lastR+dr*i,c=lastC+dc*i; if(r>=0&&r<6&&c>=0&&c<7&&board[r][c]===color)cells.push([r,c]);else break;}
    for (let i=1;i<4;i++){const r=lastR-dr*i,c=lastC-dc*i; if(r>=0&&r<6&&c>=0&&c<7&&board[r][c]===color)cells.push([r,c]);else break;}
    if (cells.length >= 4) return { cells };
  }
  return null;
}
