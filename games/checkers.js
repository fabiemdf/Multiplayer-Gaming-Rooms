'use strict';

module.exports = {
  id: 'checkers',
  label: 'Checkers',
  icon: '⛀',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    const board = Array(8).fill(null).map(()=>Array(8).fill(null));
    for(let r=0;r<3;r++) for(let c=0;c<8;c++) if((r+c)%2===1) board[r][c]={color:'red',isKing:false};
    for(let r=5;r<8;r++) for(let c=0;c<8;c++) if((r+c)%2===1) board[r][c]={color:'black',isKing:false};
    return { board, currentTurn: 0 };
  },

  processAction(room, player, { from, to }) {
    const s = room.gameState;
    if (s.currentTurn !== player.playerIndex) return null;
    const pColor = player.playerIndex === 0 ? 'black' : 'red';
    const piece = s.board[from.row][from.col];
    if (!piece || piece.color !== pColor) return null;
    if (!doMove(s, from, to, pColor)) return null;

    const win = checkWinner(s.board);
    if (win !== null) return { gameState: s, gameOver: true, winner: win, winnerName: room.players[win].username };
    return { gameState: s, gameOver: false };
  }
};

function doMove(s, from, to, color) {
  const board = s.board;
  const piece = board[from.row][from.col];
  const dr = to.row - from.row, dc = to.col - from.col;
  const validDir = color === 'black' ? 1 : -1;
  if (!piece.isKing && Math.sign(dr) !== validDir) return false;
  if (board[to.row]?.[to.col] !== null) return false;

  if (Math.abs(dr)===1 && Math.abs(dc)===1) {
    if (mandatoryCaptures(board,color).length>0) return false;
    board[to.row][to.col]=piece; board[from.row][from.col]=null;
  } else if (Math.abs(dr)===2 && Math.abs(dc)===2) {
    const mr=(from.row+to.row)/2, mc=(from.col+to.col)/2;
    const mid=board[mr][mc];
    if(!mid||mid.color===color) return false;
    board[to.row][to.col]=piece; board[from.row][from.col]=null; board[mr][mc]=null;
  } else { return false; }

  if((color==='black'&&to.row===7)||(color==='red'&&to.row===0)) board[to.row][to.col].isKing=true;
  s.currentTurn = 1 - s.currentTurn;
  return true;
}

function mandatoryCaptures(board, color) {
  const caps=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){const p=board[r][c];if(!p||p.color!==color)continue;
    const dirs=p.isKing?[[-1,-1],[-1,1],[1,-1],[1,1]]:(color==='black'?[[1,-1],[1,1]]:[[-1,-1],[-1,1]]);
    for(const[dr,dc]of dirs){const mr=r+dr,mc=c+dc,tr=r+dr*2,tc=c+dc*2;
      if(tr>=0&&tr<8&&tc>=0&&tc<8&&board[mr]?.[mc]&&board[mr][mc].color!==color&&!board[tr][tc])caps.push({from:{row:r,col:c},to:{row:tr,col:tc}});
    }
  }
  return caps;
}

function checkWinner(board) {
  let b=0,r=0;
  for(let row=0;row<8;row++) for(let col=0;col<8;col++){
    if(board[row][col]?.color==='black')b++;
    else if(board[row][col]?.color==='red')r++;
  }
  if(b===0)return 1; if(r===0)return 0; return null;
}
