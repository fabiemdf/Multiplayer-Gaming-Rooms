/* ════════════════════════════════════════════════════════════════
   CONNECT 4 – Game UI
   ════════════════════════════════════════════════════════════════ */

const Connect4Game = (() => {
  let winCells = [];

  function render(container, state, playerIndex, isSpectator) {
    winCells = [];
    const wrap = document.createElement('div');
    wrap.className = 'c4-board-wrap';
    wrap.id = 'c4-wrap';

    // Column drop buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'c4-col-buttons';
    btnRow.id = 'c4-col-buttons';
    for (let c = 0; c < 7; c++) {
      const btn = document.createElement('button');
      btn.className = 'c4-col-btn';
      btn.textContent = '▼';
      btn.dataset.col = c;
      if (!isSpectator) {
        btn.addEventListener('click', () => {
          if (App.state.gameStarted && App.state.gameState.currentTurn === playerIndex) {
            SocketClient.gameAction({ type: 'move', col: c });
          }
        });
      } else {
        btn.disabled = true;
      }
      btnRow.appendChild(btn);
    }
    wrap.appendChild(btnRow);

    // Board
    const board = document.createElement('div');
    board.className = 'c4-board';
    board.id = 'c4-board';
    for (let r = 0; r < 6; r++) {
      const row = document.createElement('div');
      row.className = 'c4-row';
      for (let c = 0; c < 7; c++) {
        const cell = document.createElement('div');
        cell.className = 'c4-cell';
        cell.id = `c4-${r}-${c}`;
        applyColor(cell, state.board[r][c]);
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
    wrap.appendChild(board);
    container.appendChild(wrap);
  }

  function update(container, state) {
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = document.getElementById(`c4-${r}-${c}`);
        if (cell) applyColor(cell, state.board[r][c]);
      }
    }
    // Highlight winning cells if any stored
    if (winCells.length) {
      winCells.forEach(([r, c]) => {
        const cell = document.getElementById(`c4-${r}-${c}`);
        if (cell) cell.classList.add('win');
      });
    }
    // Disable buttons if game over
    if (!App.state.gameStarted) {
      document.querySelectorAll('.c4-col-btn').forEach(b => { b.disabled = true; });
    }
  }

  function applyColor(cell, color) {
    cell.className = 'c4-cell';
    if (color) cell.classList.add(color);
  }

  // Called from Room when result has winCells
  function setWinCells(cells) {
    winCells = cells || [];
  }

  GameRegistry.register({ id: 'connect4', label: 'Connect 4', icon: '🔴', render, update });

  return { render, update, setWinCells };
})();
