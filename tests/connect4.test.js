'use strict';

const game = require('../games/connect4');

function room(state) { return { gameState: state }; }
function player(index, name = `P${index}`) { return { playerIndex: index, username: name }; }
function init() { return game.init(); }

// ── init() ────────────────────────────────────────────────────────────────────
describe('connect4 init', () => {
  test('returns a 6×7 empty board', () => {
    const s = init();
    expect(s.board).toHaveLength(6);
    s.board.forEach(row => {
      expect(row).toHaveLength(7);
      expect(row.every(c => c === null)).toBe(true);
    });
  });

  test('starts on player 0 turn', () => {
    expect(init().currentTurn).toBe(0);
  });
});

// ── Gravity / column behaviour ────────────────────────────────────────────────
describe('connect4 gravity', () => {
  test('piece lands on bottom row of empty column', () => {
    const s = init();
    game.processAction(room(s), player(0), { col: 3 });
    expect(s.board[5][3]).toBe('red');
  });

  test('second piece stacks on top of first', () => {
    const s = init();
    game.processAction(room(s), player(0), { col: 3 });
    game.processAction(room(s), player(1), { col: 3 });
    expect(s.board[4][3]).toBe('yellow');
  });

  test('rejects full column', () => {
    const s = init();
    // Fill column 0 alternating
    for (let i = 0; i < 6; i++) {
      const pi = i % 2;
      const result = game.processAction(room(s), player(pi), { col: 0 });
      expect(result).not.toBeNull();
    }
    // Now column 0 is full; it's P0's turn
    expect(game.processAction(room(s), player(0), { col: 0 })).toBeNull();
  });

  test('rejects out-of-range column', () => {
    const s = init();
    expect(game.processAction(room(s), player(0), { col: -1 })).toBeNull();
    expect(game.processAction(room(s), player(0), { col: 7 })).toBeNull();
  });

  test('rejects move from wrong player', () => {
    const s = init();
    expect(game.processAction(room(s), player(1), { col: 0 })).toBeNull();
  });
});

// ── Win detection ─────────────────────────────────────────────────────────────
function playMoves(colSeq) {
  // colSeq: alternating [P0col, P1col, P0col, …]
  const s = init();
  let result;
  for (let i = 0; i < colSeq.length; i++) {
    result = game.processAction(room(s), player(i % 2, `P${i % 2}`), { col: colSeq[i] });
  }
  return result;
}

describe('connect4 win detection', () => {
  test('detects horizontal win', () => {
    // P0 fills cols 0-3 bottom row; P1 stacks in col 6
    const r = playMoves([0, 6, 1, 6, 2, 6, 3]);
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(0);
  });

  test('detects vertical win', () => {
    // P0 stacks 4 in col 0; P1 plays col 1 repeatedly
    const r = playMoves([0, 1, 0, 1, 0, 1, 0]);
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(0);
  });

  test('detects diagonal win (bottom-left to top-right)', () => {
    // Build staircase for P0: (5,0),(4,1),(3,2),(2,3)
    const s = init();
    // col heights needed: col0=1, col1=2, col2=3, col3=4
    const moves = [
      [0,1],[1,1],          // col1 height=2
      [0,2],[1,2],[0,2],    // col2 height=3 (P0 on top)
      [1,3],[0,3],[1,3],[0,3], // col3 height=4 (P0 on top)
    ];
    // Needs manual play for staircase — just verify function exists + works
    // Simpler: manually set board state
    const board = s.board;
    board[5][0] = 'red';
    board[4][1] = 'red';
    board[3][2] = 'red';
    // Drop P0 into col 3 with enough pieces below
    board[5][3] = 'yellow';
    board[4][3] = 'yellow';
    board[3][3] = 'yellow';
    s.currentTurn = 0;
    const result = game.processAction(room(s), player(0, 'P0'), { col: 3 });
    expect(result.gameOver).toBe(true);
    expect(result.winner).toBe(0);
  });

  test('returns gameOver:false while game in progress', () => {
    const s = init();
    const r = game.processAction(room(s), player(0), { col: 3 });
    expect(r.gameOver).toBe(false);
  });
});
