/* ════════════════════════════════════════════════════════════════
   CHESS – Full interactive chess UI with move highlighting
   ════════════════════════════════════════════════════════════════ */

const ChessGame = (() => {
  // Unicode chess pieces
  const PIECES = {
    white: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    black: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
  };

  let selectedSquare = null;
  let validMoves = [];
  let lastMove = null;
  let awaitingPromotion = null;

  function render(container, state, playerIndex, isSpectator) {
    selectedSquare = null;
    validMoves = [];
    lastMove = null;

    const wrap = document.createElement('div');
    wrap.className = 'chess-wrap';

    // Left info panel
    const info = document.createElement('div');
    info.className = 'chess-info';
    info.id = 'chess-info';
    info.innerHTML = buildInfoHTML(state, playerIndex);
    wrap.appendChild(info);

    // Board wrapper (for coordinate labels)
    const boardWrap = document.createElement('div');
    boardWrap.className = 'chess-board-container';

    // Row coords
    const coordsCol = document.createElement('div');
    coordsCol.className = 'chess-coords-col';
    const ranks = playerIndex === 1 ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
    ranks.forEach(r => {
      const span = document.createElement('span');
      span.className = 'chess-coord';
      span.textContent = r;
      coordsCol.appendChild(span);
    });
    boardWrap.appendChild(coordsCol);

    // Board
    const board = document.createElement('div');
    board.className = 'chess-board';
    board.id = 'chess-board';

    const rows = playerIndex === 1 ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
    const cols = playerIndex === 1 ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

    rows.forEach(r => {
      cols.forEach(c => {
        const sq = makeSquare(r, c, state, playerIndex, isSpectator);
        board.appendChild(sq);
      });
    });

    boardWrap.appendChild(board);
    wrap.appendChild(boardWrap);
    container.appendChild(wrap);
  }

  function makeSquare(r, c, state, playerIndex, isSpectator) {
    const sq = document.createElement('div');
    sq.className = `chess-square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
    sq.id = `sq-${r}-${c}`;
    sq.dataset.row = r;
    sq.dataset.col = c;

    const piece = state.board[r][c];
    if (piece) sq.textContent = PIECES[piece.color][piece.type];

    if (!isSpectator) {
      sq.addEventListener('click', () => handleSquareClick(r, c, state, playerIndex));
    }
    return sq;
  }

  function handleSquareClick(r, c, state, playerIndex) {
    if (!App.state.gameStarted) return;
    const gs = App.state.gameState;
    if (!gs || gs.currentTurn !== playerIndex) return;

    const myColor = playerIndex === 0 ? 'white' : 'black';

    if (selectedSquare) {
      // Check if clicking a valid move target
      const isValid = validMoves.some(m => m.row === r && m.col === c);
      if (isValid) {
        const from = selectedSquare;
        const piece = gs.board[from.row][from.col];

        // Pawn promotion check
        if (piece && piece.type === 'P' && ((myColor === 'white' && r === 0) || (myColor === 'black' && r === 7))) {
          awaitingPromotion = { from, to: { row: r, col: c } };
          showPromotionModal(myColor);
          return;
        }

        SocketClient.gameAction({ type: 'move', from, to: { row: r, col: c } });
        clearSelection();
        return;
      }

      // Clicking own piece: select it instead
      const newPiece = gs.board[r][c];
      if (newPiece && newPiece.color === myColor) {
        clearSelection();
        selectSquare(r, c, gs, myColor);
        return;
      }

      clearSelection();
      return;
    }

    // No selection: try to select own piece
    const piece = gs.board[r][c];
    if (piece && piece.color === myColor) {
      selectSquare(r, c, gs, myColor);
    }
  }

  function selectSquare(r, c, state, myColor) {
    selectedSquare = { row: r, col: c };
    validMoves = getClientMoves(state, r, c, myColor);

    const sq = document.getElementById(`sq-${r}-${c}`);
    if (sq) sq.classList.add('selected');

    validMoves.forEach(m => {
      const target = document.getElementById(`sq-${m.row}-${m.col}`);
      if (!target) return;
      if (state.board[m.row][m.col]) {
        target.classList.add('valid-capture');
      } else {
        target.classList.add('valid-move');
      }
    });
  }

  function clearSelection() {
    if (selectedSquare) {
      const sq = document.getElementById(`sq-${selectedSquare.row}-${selectedSquare.col}`);
      if (sq) sq.classList.remove('selected');
    }
    validMoves.forEach(m => {
      const target = document.getElementById(`sq-${m.row}-${m.col}`);
      if (target) target.classList.remove('valid-move', 'valid-capture');
    });
    selectedSquare = null;
    validMoves = [];
  }

  // Client-side move generation (mirrors server for highlighting only)
  function getClientMoves(state, row, col, myColor) {
    const piece = state.board[row][col];
    if (!piece || piece.color !== myColor) return [];
    // We'll compute pseudo-legal moves (full legality is validated server-side)
    const moves = [];
    const b = state.board;

    function slide(dirs) {
      dirs.forEach(([dr, dc]) => {
        for (let i = 1; i < 8; i++) {
          const r = row + dr * i, c = col + dc * i;
          if (r < 0 || r > 7 || c < 0 || c > 7) break;
          if (b[r][c]) { if (b[r][c].color !== myColor) moves.push({ row: r, col: c }); break; }
          moves.push({ row: r, col: c });
        }
      });
    }

    switch (piece.type) {
      case 'P': {
        const dir = myColor === 'white' ? -1 : 1;
        const startR = myColor === 'white' ? 6 : 1;
        if (!b[row+dir]?.[col]) {
          moves.push({ row: row+dir, col });
          if (row === startR && !b[row+2*dir]?.[col]) moves.push({ row: row+2*dir, col });
        }
        for (const dc of [-1, 1]) {
          const nr = row+dir, nc = col+dc;
          if (nr>=0&&nr<8&&nc>=0&&nc<8) {
            if (b[nr][nc] && b[nr][nc].color !== myColor) moves.push({ row: nr, col: nc });
            if (state.enPassant && state.enPassant.row === nr && state.enPassant.col === nc) {
              moves.push({ row: nr, col: nc });
            }
          }
        }
        break;
      }
      case 'R': slide([[0,1],[0,-1],[1,0],[-1,0]]); break;
      case 'B': slide([[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'Q': slide([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]); break;
      case 'N':
        [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => {
          const r=row+dr, c=col+dc;
          if (r>=0&&r<8&&c>=0&&c<8&&(!b[r][c]||b[r][c].color!==myColor)) moves.push({ row:r, col:c });
        });
        break;
      case 'K':
        for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
          if (!dr&&!dc) continue;
          const r=row+dr, c=col+dc;
          if (r>=0&&r<8&&c>=0&&c<8&&(!b[r][c]||b[r][c].color!==myColor)) moves.push({ row:r, col:c });
        }
        // Add castling hints
        if (!state.castling[myColor==='white'?'wKing':'bKing']) {
          if (!b[row][col+1]&&!b[row][col+2]) moves.push({ row, col: col+2 });
          if (!b[row][col-1]&&!b[row][col-2]&&!b[row][col-3]) moves.push({ row, col: col-2 });
        }
        break;
    }
    return moves;
  }

  function showPromotionModal(color) {
    const opts = document.getElementById('promo-options');
    opts.innerHTML = '';
    ['Q','R','B','N'].forEach(type => {
      const btn = document.createElement('div');
      btn.className = 'promo-piece';
      btn.textContent = PIECES[color][type];
      btn.title = { Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' }[type];
      btn.addEventListener('click', () => {
        document.getElementById('promotion-modal').classList.add('hidden');
        if (awaitingPromotion) {
          SocketClient.gameAction({ type: 'move', ...awaitingPromotion, promotion: type });
          awaitingPromotion = null;
        }
        clearSelection();
      });
      opts.appendChild(btn);
    });
    document.getElementById('promotion-modal').classList.remove('hidden');
  }

  function update(container, state) {
    clearSelection();
    // Full re-render of pieces
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.getElementById(`sq-${r}-${c}`);
        if (!sq) continue;
        sq.classList.remove('last-from', 'last-to', 'in-check', 'selected', 'valid-move', 'valid-capture');

        const piece = state.board[r][c];
        sq.textContent = piece ? PIECES[piece.color][piece.type] : '';
      }
    }

    // Highlight last move
    if (state.moves && state.moves.length > 0) {
      const last = state.moves[state.moves.length - 1];
      const fromSq = document.getElementById(`sq-${last.from.row}-${last.from.col}`);
      const toSq = document.getElementById(`sq-${last.to.row}-${last.to.col}`);
      if (fromSq) fromSq.classList.add('last-from');
      if (toSq) toSq.classList.add('last-to');
    }

    // Highlight king in check
    if (state.check) {
      const kingColor = state.currentTurn === 0 ? 'white' : 'black';
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (state.board[r][c]?.type === 'K' && state.board[r][c]?.color === kingColor) {
          const sq = document.getElementById(`sq-${r}-${c}`);
          if (sq) sq.classList.add('in-check');
        }
      }
    }

    // Update info panel
    const info = document.getElementById('chess-info');
    if (info) info.innerHTML = buildInfoHTML(state, App.state.playerIndex);
  }

  function buildInfoHTML(state, playerIndex) {
    const myColor = playerIndex === 0 ? 'white' : 'black';
    const oppColor = playerIndex === 0 ? 'black' : 'white';

    const movesHTML = (state.moves || []).slice(-20).map((m, i) => {
      const letter = String.fromCharCode(97 + m.from.col);
      const rank = 8 - m.from.row;
      const letter2 = String.fromCharCode(97 + m.to.col);
      const rank2 = 8 - m.to.row;
      return `<div class="chess-move-item">${Math.floor(i/2)+1}${i%2===0?'.':'...'} ${PIECES[m.color][m.piece]}${letter}${rank}→${letter2}${rank2}${m.captured ? '✕' : ''}</div>`;
    }).join('');

    const myCap = (state.capturedPieces?.[oppColor] || []).map(p => PIECES[oppColor][p.type]).join('');
    const oppCap = (state.capturedPieces?.[myColor] || []).map(p => PIECES[myColor][p.type]).join('');

    return `
      <div class="chess-captured">
        <div class="chess-captured-label">Captured (you)</div>
        <div class="chess-captured-pieces">${myCap || '—'}</div>
      </div>
      <div class="chess-captured">
        <div class="chess-captured-label">Captured (opp)</div>
        <div class="chess-captured-pieces">${oppCap || '—'}</div>
      </div>
      <div class="chess-moves">
        <div class="chess-moves-label">Moves</div>
        ${movesHTML || '<div class="chess-move-item" style="color:var(--dim)">No moves yet</div>'}
      </div>
    `;
  }

  return { render, update };
})();
