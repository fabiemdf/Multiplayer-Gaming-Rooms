/* ════════════════════════════════════════════════════════════════
   GOMOKU (Five-in-a-Row) – Client UI
   15×15 grid; Player 0 = black stones, Player 1 = white stones.
   ════════════════════════════════════════════════════════════════ */

const GomokuGame = (() => {
  const SIZE = 15;
  let winCells = [];

  function render(container, state, playerIndex, isSpectator) {
    winCells = [];
    const wrap = document.createElement('div');
    wrap.className = 'gomoku-wrap';

    const legend = document.createElement('div');
    legend.className = 'gomoku-legend';
    legend.innerHTML = `
      <span class="gk-stone black"></span> Black ${playerIndex === 0 ? '(you)' : ''}
      &nbsp;
      <span class="gk-stone white"></span> White ${playerIndex === 1 ? '(you)' : ''}`;
    wrap.appendChild(legend);

    const board = document.createElement('div');
    board.className = 'gomoku-board';
    board.id = 'gomoku-board';
    board.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        board.appendChild(makeCell(r, c, state, playerIndex, isSpectator));
      }
    }
    wrap.appendChild(board);
    container.appendChild(wrap);
  }

  function makeCell(r, c, state, playerIndex, isSpectator) {
    const cell = document.createElement('div');
    cell.className = 'gomoku-cell';
    cell.id = `gk-${r}-${c}`;

    // Grid lines
    const line = document.createElement('div');
    line.className = `gk-line
      ${r === 0 ? 'top' : ''} ${r === SIZE-1 ? 'bottom' : ''}
      ${c === 0 ? 'left' : ''} ${c === SIZE-1 ? 'right' : ''}`;
    cell.appendChild(line);

    const piece = state.board[r][c];
    if (piece) cell.appendChild(makeStone(piece));

    if (!isSpectator && !state.board[r][c]) {
      cell.addEventListener('click', () => {
        if (App.state.gameStarted && App.state.gameState.currentTurn === playerIndex) {
          SocketClient.gameAction({ type: 'move', row: r, col: c });
        }
      });
    }
    return cell;
  }

  function makeStone(color) {
    const s = document.createElement('div');
    s.className = `gk-stone ${color}`;
    return s;
  }

  function update(container, state) {
    const s = state.size || SIZE;
    for (let r = 0; r < s; r++) {
      for (let c = 0; c < s; c++) {
        const cell = document.getElementById(`gk-${r}-${c}`);
        if (!cell) continue;

        // Remove existing stone (keep grid-line div)
        cell.querySelectorAll('.gk-stone').forEach(el => el.remove());

        const piece = state.board[r][c];
        if (piece) {
          const stone = makeStone(piece);
          // Highlight last move
          if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c) {
            stone.classList.add('last');
          }
          // Highlight winning stones
          if (winCells.some(([wr,wc]) => wr===r && wc===c)) {
            stone.classList.add('win');
          }
          cell.appendChild(stone);
        }
      }
    }
  }

  function setWinCells(cells) { winCells = cells || []; }

  // Self-register
  GameRegistry.register({
    id:     'gomoku',
    label:  'Gomoku',
    icon:   '⚫',
    render: render,
    update(container, state) {
      // Store win cells if present
      update(container, state);
    }
  });

  return { render, update, setWinCells };
})();
