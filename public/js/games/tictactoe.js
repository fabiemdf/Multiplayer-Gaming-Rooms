/* ════════════════════════════════════════════════════════════════
   TIC-TAC-TOE – Game UI
   ════════════════════════════════════════════════════════════════ */

const TicTacToeGame = (() => {
  function render(container, state, playerIndex, isSpectator) {
    const board = document.createElement('div');
    board.className = 'ttt-board';
    board.id = 'ttt-board';

    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'ttt-cell';
      cell.dataset.index = i;
      setCell(cell, state.board[i]);
      if (!isSpectator) {
        cell.addEventListener('click', () => {
          if (App.state.gameStarted && App.state.gameState.currentTurn === playerIndex && !state.board[i]) {
            SocketClient.gameAction({ type: 'move', index: i });
          }
        });
      }
      board.appendChild(cell);
    }

    container.appendChild(board);
    applyWinPattern(state);
  }

  function update(container, state) {
    const board = document.getElementById('ttt-board');
    if (!board) return;

    const cells = board.querySelectorAll('.ttt-cell');
    cells.forEach((cell, i) => {
      setCell(cell, state.board[i]);
    });
    applyWinPattern(state);
  }

  function setCell(cell, value) {
    if (value === 'X') {
      cell.textContent = '✕';
      cell.classList.add('x', 'taken');
    } else if (value === 'O') {
      cell.textContent = '○';
      cell.classList.add('o', 'taken');
    } else {
      cell.textContent = '';
      cell.classList.remove('x', 'o', 'taken', 'win');
    }
  }

  function applyWinPattern(state) {
    // Win pattern comes from server in gameStateUpdate result; re-render handles it
    // Nothing extra needed here unless we store win pattern in state
  }

  GameRegistry.register({ id: 'tictactoe', label: 'Tic-Tac-Toe', icon: '✕○', render, update });

  return { render, update };
})();
