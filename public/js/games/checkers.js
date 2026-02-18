/* ════════════════════════════════════════════════════════════════
   CHECKERS – Game UI with move highlighting
   ════════════════════════════════════════════════════════════════ */

const CheckersGame = (() => {
  let selectedSquare = null;
  let validMoves = [];

  function render(container, state, playerIndex, isSpectator) {
    selectedSquare = null;
    validMoves = [];

    const board = document.createElement('div');
    board.className = 'checkers-board';
    board.id = 'checkers-board';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = makeSquare(r, c, state, playerIndex, isSpectator);
        board.appendChild(sq);
      }
    }
    container.appendChild(board);
  }

  function makeSquare(r, c, state, playerIndex, isSpectator) {
    const isLight = (r + c) % 2 === 0;
    const sq = document.createElement('div');
    sq.className = `checkers-sq ${isLight ? 'light' : 'dark'}`;
    sq.id = `cksq-${r}-${c}`;
    sq.dataset.row = r;
    sq.dataset.col = c;

    const piece = state.board[r][c];
    if (piece) sq.appendChild(makePiece(piece));

    if (!isSpectator && !isLight) {
      sq.addEventListener('click', () => handleClick(r, c, state, playerIndex));
    }
    return sq;
  }

  function makePiece(piece) {
    const el = document.createElement('div');
    el.className = `checkers-piece ${piece.color}-p${piece.isKing ? ' king' : ''}`;
    return el;
  }

  function handleClick(r, c, state, playerIndex) {
    if (!App.state.gameStarted) return;
    const gs = App.state.gameState;
    if (!gs || gs.currentTurn !== playerIndex) return;

    const myColor = playerIndex === 0 ? 'black' : 'red';

    if (selectedSquare) {
      // Check if this is a valid move target
      const isValid = validMoves.some(m => m.row === r && m.col === c);
      if (isValid) {
        SocketClient.gameAction({ type: 'move', from: selectedSquare, to: { row: r, col: c } });
        clearSelection();
        return;
      }

      // Click another own piece
      const piece = gs.board[r][c];
      if (piece && piece.color === myColor) {
        clearSelection();
        selectSquare(r, c, gs, myColor);
        return;
      }

      clearSelection();
      return;
    }

    // No selection – select own piece
    const piece = gs.board[r][c];
    if (piece && piece.color === myColor) {
      selectSquare(r, c, gs, myColor);
    }
  }

  function selectSquare(r, c, state, myColor) {
    selectedSquare = { row: r, col: c };
    validMoves = getValidMoves(state, r, c, myColor);

    const sq = document.getElementById(`cksq-${r}-${c}`);
    if (sq) sq.classList.add('selected');

    validMoves.forEach(m => {
      const target = document.getElementById(`cksq-${m.row}-${m.col}`);
      if (target) target.classList.add('valid-move');
    });
  }

  function clearSelection() {
    if (selectedSquare) {
      const sq = document.getElementById(`cksq-${selectedSquare.row}-${selectedSquare.col}`);
      if (sq) sq.classList.remove('selected');
    }
    validMoves.forEach(m => {
      const target = document.getElementById(`cksq-${m.row}-${m.col}`);
      if (target) target.classList.remove('valid-move');
    });
    selectedSquare = null;
    validMoves = [];
  }

  function getValidMoves(state, row, col, color) {
    const board = state.board;
    const piece = board[row][col];
    if (!piece || piece.color !== color) return [];

    const dirs = piece.isKing
      ? [[-1,-1],[-1,1],[1,-1],[1,1]]
      : (color === 'black' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]]);

    const captures = [];
    const simples = [];

    dirs.forEach(([dr, dc]) => {
      const sr = row + dr, sc = col + dc;
      const jr = row + dr*2, jc = col + dc*2;

      // Capture
      if (jr>=0&&jr<8&&jc>=0&&jc<8&&board[sr]?.[sc]&&board[sr][sc].color!==color&&!board[jr][jc]) {
        captures.push({ row: jr, col: jc });
      }
      // Simple move
      if (sr>=0&&sr<8&&sc>=0&&sc<8&&!board[sr][sc]) {
        simples.push({ row: sr, col: sc });
      }
    });

    // If mandatory captures exist for any piece, only return captures
    if (hasMandatoryCaptures(board, color)) {
      return captures;
    }
    return captures.length ? captures : simples;
  }

  function hasMandatoryCaptures(board, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const dirs = p.isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (color==='black'?[[1,-1],[1,1]]:[[-1,-1],[-1,1]]);
      for (const [dr, dc] of dirs) {
        const mr = r+dr, mc = c+dc, tr = r+dr*2, tc = c+dc*2;
        if (tr>=0&&tr<8&&tc>=0&&tc<8&&board[mr]?.[mc]&&board[mr][mc].color!==color&&!board[tr][tc]) return true;
      }
    }
    return false;
  }

  function update(container, state) {
    clearSelection();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.getElementById(`cksq-${r}-${c}`);
        if (!sq) continue;
        sq.classList.remove('selected', 'valid-move');
        sq.innerHTML = '';

        const piece = state.board[r][c];
        if (piece) sq.appendChild(makePiece(piece));
      }
    }
  }

  GameRegistry.register({ id: 'checkers', label: 'Checkers', icon: '⛀', render, update });

  return { render, update };
})();
