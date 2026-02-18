/* ════════════════════════════════════════════════════════════════
   REVERSI (OTHELLO) – Client UI
   Player 0 = black discs, Player 1 = white discs.
   ════════════════════════════════════════════════════════════════ */

const ReversiGame = (() => {
  function render(container, state, playerIndex, isSpectator) {
    const wrap = document.createElement('div');
    wrap.className = 'reversi-wrap';
    wrap.id = 'reversi-wrap';

    // Score bar
    wrap.appendChild(buildScoreBar(state, playerIndex));

    // Board
    const board = document.createElement('div');
    board.className = 'reversi-board';
    board.id = 'reversi-board';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        board.appendChild(makeCell(r, c, state, playerIndex, isSpectator));
      }
    }
    wrap.appendChild(board);
    container.appendChild(wrap);
  }

  function makeCell(r, c, state, playerIndex, isSpectator) {
    const cell = document.createElement('div');
    cell.className = 'reversi-cell';
    cell.id = `rv-${r}-${c}`;

    const piece = state.board[r][c];
    if (piece) cell.appendChild(makeDisc(piece));

    const myColor = playerIndex === 0 ? 'black' : 'white';
    const isValid = (state.validMoves || []).some(m => m.row === r && m.col === c);
    if (isValid && !isSpectator && state.currentTurn === playerIndex) {
      cell.classList.add('valid-move');
      cell.addEventListener('click', () => {
        if (App.state.gameStarted && App.state.gameState.currentTurn === playerIndex) {
          SocketClient.gameAction({ type: 'move', row: r, col: c });
        }
      });
    }
    return cell;
  }

  function makeDisc(color) {
    const d = document.createElement('div');
    d.className = `reversi-disc ${color}`;
    return d;
  }

  function buildScoreBar(state, playerIndex) {
    const bar = document.createElement('div');
    bar.className = 'reversi-score-bar';
    bar.id = 'reversi-score-bar';
    const scores = state.scores || { black: 2, white: 2 };
    bar.innerHTML = `
      <div class="rv-score">
        <div class="reversi-disc black sm"></div>
        <span>Black: <strong>${scores.black}</strong></span>
        ${playerIndex === 0 ? '<span class="you-tag">(you)</span>' : ''}
      </div>
      <div class="rv-score">
        <div class="reversi-disc white sm"></div>
        <span>White: <strong>${scores.white}</strong></span>
        ${playerIndex === 1 ? '<span class="you-tag">(you)</span>' : ''}
      </div>`;
    return bar;
  }

  function update(container, state) {
    // Update score bar
    const bar = document.getElementById('reversi-score-bar');
    if (bar) {
      const scores = state.scores || { black: 0, white: 0 };
      bar.querySelectorAll('strong')[0].textContent = scores.black;
      bar.querySelectorAll('strong')[1].textContent = scores.white;
    }

    // Update all cells
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.getElementById(`rv-${r}-${c}`);
        if (!cell) continue;
        cell.innerHTML = '';
        cell.classList.remove('valid-move');

        const piece = state.board[r][c];
        if (piece) { cell.appendChild(makeDisc(piece)); continue; }

        const isValid = (state.validMoves || []).some(m => m.row === r && m.col === c);
        const playerIndex = App.state.playerIndex;
        if (isValid && state.currentTurn === playerIndex && App.state.gameStarted) {
          cell.classList.add('valid-move');
          // Re-attach click (clone trick avoids duplicate listeners)
          const fresh = cell.cloneNode(true);
          fresh.classList.add('valid-move');
          fresh.addEventListener('click', () => {
            if (App.state.gameStarted && App.state.gameState.currentTurn === playerIndex) {
              SocketClient.gameAction({ type: 'move', row: r, col: c });
            }
          });
          cell.parentNode.replaceChild(fresh, cell);
        }
      }
    }
  }

  // Self-register into the client GameRegistry
  GameRegistry.register({
    id:     'reversi',
    label:  'Reversi',
    icon:   '⬤',
    render: render,
    update: update,
    getStatus(state, playerIndex) {
      const scores = state.scores || { black: 0, white: 0 };
      return `Black ${scores.black} – ${scores.white} White`;
    }
  });

  return { render, update };
})();
