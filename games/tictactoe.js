'use strict';

module.exports = {
  id: 'tictactoe',
  label: 'Tic-Tac-Toe',
  icon: '✕○',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    return { board: Array(9).fill(null), currentTurn: 0, moves: [] };
  },

  processAction(room, player, action) {
    const { index } = action;
    const s = room.gameState;
    if (s.currentTurn !== player.playerIndex) return null;
    if (index < 0 || index > 8 || s.board[index] !== null) return null;

    const sym = player.playerIndex === 0 ? 'X' : 'O';
    s.board[index] = sym;
    s.moves.push({ playerIndex: player.playerIndex, index });

    const win = winner(s.board);
    if (win) return { gameState: s, gameOver: true, winner: player.playerIndex, winnerName: player.username, winPattern: win.pattern };

    if (s.board.every(c => c !== null)) return { gameState: s, gameOver: true, winner: -1, winnerName: null };

    s.currentTurn = 1 - s.currentTurn;
    return { gameState: s, gameOver: false };
  }
};

function winner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { pattern: [a,b,c] };
  }
  return null;
}
