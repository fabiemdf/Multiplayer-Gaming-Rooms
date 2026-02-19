'use strict';

const game = require('../games/tictactoe');

// ── Helpers ───────────────────────────────────────────────────────────────────
function room(state) { return { gameState: state }; }
function player(index, name = `P${index}`) { return { playerIndex: index, username: name }; }
function init() { return game.init(); }

// ── init() ────────────────────────────────────────────────────────────────────
describe('tictactoe init', () => {
  test('returns a 9-cell empty board', () => {
    const s = init();
    expect(s.board).toHaveLength(9);
    expect(s.board.every(c => c === null)).toBe(true);
  });

  test('starts on player 0 turn', () => {
    expect(init().currentTurn).toBe(0);
  });
});

// ── Turn enforcement ──────────────────────────────────────────────────────────
describe('tictactoe turn enforcement', () => {
  test('rejects move from wrong player', () => {
    const s = init();
    expect(game.processAction(room(s), player(1), { index: 0 })).toBeNull();
  });

  test('accepts move from correct player', () => {
    const s = init();
    expect(game.processAction(room(s), player(0), { index: 0 })).not.toBeNull();
  });

  test('rejects move on occupied square', () => {
    const s = init();
    game.processAction(room(s), player(0), { index: 4 });   // P0 takes centre
    expect(game.processAction(room(s), player(1), { index: 4 })).toBeNull();
  });

  test('rejects out-of-range index', () => {
    const s = init();
    expect(game.processAction(room(s), player(0), { index: 9 })).toBeNull();
    expect(game.processAction(room(s), player(0), { index: -1 })).toBeNull();
  });
});

// ── Win detection ─────────────────────────────────────────────────────────────
function playMoves(moves) {
  // moves: array of [playerIndex, boardIndex]
  const s = init();
  let result;
  for (const [pi, idx] of moves) {
    result = game.processAction(room(s), player(pi, `Player${pi}`), { index: idx });
  }
  return result;
}

describe('tictactoe win detection', () => {
  test('detects top-row win', () => {
    // P0: 0,1,2  P1: 3,4
    const r = playMoves([[0,0],[1,3],[0,1],[1,4],[0,2]]);
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(0);
    expect(r.winPattern).toEqual([0,1,2]);
  });

  test('detects column win', () => {
    // P0: 0,3,6  P1: 1,2
    const r = playMoves([[0,0],[1,1],[0,3],[1,2],[0,6]]);
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(0);
  });

  test('detects diagonal win', () => {
    // P0: 0,4,8  P1: 1,2
    const r = playMoves([[0,0],[1,1],[0,4],[1,2],[0,8]]);
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(0);
  });

  test('detects anti-diagonal win', () => {
    // P0: 2,4,6  P1: 0,1
    const r = playMoves([[0,2],[1,0],[0,4],[1,1],[0,6]]);
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(0);
  });
});

// ── Draw ──────────────────────────────────────────────────────────────────────
describe('tictactoe draw', () => {
  test('detects a full-board draw', () => {
    // X O X
    // X X O
    // O X O  — no winner
    const r = playMoves([
      [0,0],[1,1],[0,2],
      [1,5],[0,3],[1,6],
      [0,4],[1,8],[0,7]
    ]);
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(-1);
  });
});

// ── Turn alternation ──────────────────────────────────────────────────────────
describe('tictactoe turn alternation', () => {
  test('switches turn after each valid move', () => {
    const s = init();
    expect(s.currentTurn).toBe(0);
    game.processAction(room(s), player(0), { index: 0 });
    expect(s.currentTurn).toBe(1);
    game.processAction(room(s), player(1), { index: 1 });
    expect(s.currentTurn).toBe(0);
  });
});
