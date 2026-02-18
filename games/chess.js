'use strict';

module.exports = {
  id: 'chess',
  label: 'Chess',
  icon: '♟️',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    return {
      board: makeBoard(),
      currentTurn: 0,
      moves: [],
      capturedPieces: { white: [], black: [] },
      check: false, checkmate: false, stalemate: false,
      enPassant: null,
      castling: { wKing:false, bKing:false, wRookA:false, wRookH:false, bRookA:false, bRookH:false }
    };
  },

  processAction(room, player, { from, to, promotion }) {
    const s = room.gameState;
    const color = player.playerIndex === 0 ? 'white' : 'black';
    if ((s.currentTurn === 0 ? 'white' : 'black') !== color) return null;

    const piece = s.board[from.row][from.col];
    if (!piece || piece.color !== color) return null;
    if (!getMoves(s, from.row, from.col).some(m => m.row===to.row && m.col===to.col)) return null;

    const captured = s.board[to.row][to.col];
    if (captured) s.capturedPieces[captured.color].push(captured);

    // En passant capture
    if (piece.type==='P' && s.enPassant && to.row===s.enPassant.row && to.col===s.enPassant.col) {
      const cr = piece.color==='white'?to.row+1:to.row-1;
      s.capturedPieces[s.board[cr][to.col].color].push(s.board[cr][to.col]);
      s.board[cr][to.col] = null;
    }

    s.enPassant = (piece.type==='P' && Math.abs(to.row-from.row)===2)
      ? { row:(from.row+to.row)/2, col:from.col } : null;

    if (piece.type==='P' && (to.row===0||to.row===7)) piece.type = promotion||'Q';

    if (piece.type==='K' && Math.abs(to.col-from.col)===2) {
      if (to.col>from.col) { s.board[from.row][5]=s.board[from.row][7]; s.board[from.row][7]=null; }
      else                  { s.board[from.row][3]=s.board[from.row][0]; s.board[from.row][0]=null; }
    }

    s.board[to.row][to.col] = piece;
    s.board[from.row][from.col] = null;

    if (piece.type==='K') { if(color==='white')s.castling.wKing=true; else s.castling.bKing=true; }
    if (piece.type==='R') {
      if(from.col===0){if(color==='white')s.castling.wRookA=true;else s.castling.bRookA=true;}
      if(from.col===7){if(color==='white')s.castling.wRookH=true;else s.castling.bRookH=true;}
    }

    s.moves.push({ from, to, piece:piece.type, color, captured: captured?captured.type:null });
    s.currentTurn = 1 - s.currentTurn;

    const nc = s.currentTurn===0?'white':'black';
    s.check     = isInCheck(s.board, nc);
    s.checkmate = s.check && !hasLegal(s, nc);
    s.stalemate = !s.check && !hasLegal(s, nc);

    if (s.checkmate||s.stalemate) return {
      gameState: s, gameOver: true,
      winner: s.checkmate ? player.playerIndex : -1,
      winnerName: s.checkmate ? player.username : null,
      reason: s.checkmate ? 'checkmate' : 'stalemate'
    };
    return { gameState: s, gameOver: false };
  }
};

// ── Board setup ───────────────────────────────────────────────────────────────
function makeBoard() {
  const b = Array(8).fill(null).map(()=>Array(8).fill(null));
  const back = ['R','N','B','Q','K','B','N','R'];
  for (let i=0;i<8;i++) {
    b[0][i]={type:back[i],color:'black'}; b[1][i]={type:'P',color:'black'};
    b[7][i]={type:back[i],color:'white'}; b[6][i]={type:'P',color:'white'};
  }
  return b;
}

// ── Move generation ───────────────────────────────────────────────────────────
function getMoves(s, row, col) {
  const piece = s.board[row][col];
  if (!piece) return [];
  let moves=[];
  switch(piece.type) {
    case 'P': moves=pawnMoves(s,row,col,piece.color); break;
    case 'R': moves=slide(s.board,row,col,piece.color,[[0,1],[0,-1],[1,0],[-1,0]]); break;
    case 'N': moves=knight(s.board,row,col,piece.color); break;
    case 'B': moves=slide(s.board,row,col,piece.color,[[1,1],[1,-1],[-1,1],[-1,-1]]); break;
    case 'Q': moves=[...slide(s.board,row,col,piece.color,[[0,1],[0,-1],[1,0],[-1,0]]),
                     ...slide(s.board,row,col,piece.color,[[1,1],[1,-1],[-1,1],[-1,-1]])]; break;
    case 'K': moves=kingMoves(s,row,col,piece.color); break;
  }
  return moves.filter(m => {
    const nb=copyBoard(s.board);
    nb[m.row][m.col]=nb[row][col]; nb[row][col]=null;
    if(piece.type==='P'&&s.enPassant&&m.row===s.enPassant.row&&m.col===s.enPassant.col)
      nb[piece.color==='white'?m.row+1:m.row-1][m.col]=null;
    return !isInCheck(nb,piece.color);
  });
}

function pawnMoves(s,row,col,color) {
  const moves=[],dir=color==='white'?-1:1,startR=color==='white'?6:1;
  if(!s.board[row+dir]?.[col]){
    moves.push({row:row+dir,col});
    if(row===startR&&!s.board[row+2*dir]?.[col]) moves.push({row:row+2*dir,col});
  }
  for(const dc of[-1,1]){const nr=row+dir,nc=col+dc;if(nr>=0&&nr<8&&nc>=0&&nc<8){
    if(s.board[nr][nc]&&s.board[nr][nc].color!==color) moves.push({row:nr,col:nc});
    if(s.enPassant&&s.enPassant.row===nr&&s.enPassant.col===nc) moves.push({row:nr,col:nc});
  }}
  return moves;
}

function slide(board,row,col,color,dirs) {
  const moves=[];
  for(const[dr,dc]of dirs){for(let i=1;i<8;i++){const r=row+dr*i,c=col+dc*i;
    if(r<0||r>7||c<0||c>7)break;
    if(board[r][c]){if(board[r][c].color!==color)moves.push({row:r,col:c});break;}
    moves.push({row:r,col:c});
  }}
  return moves;
}

function knight(board,row,col,color) {
  return[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
    .map(([dr,dc])=>({row:row+dr,col:col+dc}))
    .filter(({row:r,col:c})=>r>=0&&r<8&&c>=0&&c<8&&(!board[r][c]||board[r][c].color!==color));
}

function kingMoves(s,row,col,color) {
  const board=s.board,c=s.castling,moves=[];
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const r=row+dr,nc=col+dc;
    if(r>=0&&r<8&&nc>=0&&nc<8&&(!board[r][nc]||board[r][nc].color!==color))moves.push({row:r,col:nc});}
  const km=color==='white'?c.wKing:c.bKing;
  if(!km&&!isInCheck(board,color)){
    if(!(color==='white'?c.wRookH:c.bRookH)&&!board[row][col+1]&&!board[row][col+2]){
      const nb1=copyBoard(board);nb1[row][col+1]=board[row][col];nb1[row][col]=null;
      const nb2=copyBoard(board);nb2[row][col+2]=board[row][col];nb2[row][col]=null;
      if(!isInCheck(nb1,color)&&!isInCheck(nb2,color))moves.push({row,col:col+2});
    }
    if(!(color==='white'?c.wRookA:c.bRookA)&&!board[row][col-1]&&!board[row][col-2]&&!board[row][col-3]){
      const nb1=copyBoard(board);nb1[row][col-1]=board[row][col];nb1[row][col]=null;
      const nb2=copyBoard(board);nb2[row][col-2]=board[row][col];nb2[row][col]=null;
      if(!isInCheck(nb1,color)&&!isInCheck(nb2,color))moves.push({row,col:col-2});
    }
  }
  return moves;
}

function pawnAtk(row,col,color){const dir=color==='white'?-1:1;return[-1,1].map(dc=>({row:row+dir,col:col+dc})).filter(({row:r,col:c})=>r>=0&&r<8&&c>=0&&c<8);}

function isInCheck(board,color){
  let kr=-1,kc=-1;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){if(board[r][c]?.type==='K'&&board[r][c].color===color){kr=r;kc=c;}}
  if(kr===-1)return false;
  const en=color==='white'?'black':'white';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=board[r][c];if(!p||p.color!==en)continue;
    let atk=[];
    switch(p.type){
      case'P':atk=pawnAtk(r,c,en);break;
      case'R':atk=slide(board,r,c,en,[[0,1],[0,-1],[1,0],[-1,0]]);break;
      case'N':atk=knight(board,r,c,en);break;
      case'B':atk=slide(board,r,c,en,[[1,1],[1,-1],[-1,1],[-1,-1]]);break;
      case'Q':atk=[...slide(board,r,c,en,[[0,1],[0,-1],[1,0],[-1,0]]),...slide(board,r,c,en,[[1,1],[1,-1],[-1,1],[-1,-1]])];break;
      case'K':for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc)atk.push({row:r+dr,col:c+dc});break;
    }
    if(atk.some(m=>m.row===kr&&m.col===kc))return true;
  }
  return false;
}

function hasLegal(s,color){
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){if(s.board[r][c]?.color===color&&getMoves(s,r,c).length>0)return true;}
  return false;
}

function copyBoard(b){return b.map(row=>row.map(c=>c?{...c}:null));}
