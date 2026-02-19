'use strict';

const game = require('../games/wheeloffortune');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeRoom(state) {
  return {
    gameState: state,
    players: [
      { playerIndex: 0, username: 'Alice' },
      { playerIndex: 1, username: 'Bob' },
    ]
  };
}
function player(index) {
  return { playerIndex: index, username: index === 0 ? 'Alice' : 'Bob' };
}
function init() { return game.init(); }

// ── init() ────────────────────────────────────────────────────────────────────
describe('wheeloffortune init', () => {
  test('starts in spin phase', () => {
    expect(init().phase).toBe('spin');
  });

  test('player 0 goes first', () => {
    expect(init().currentTurn).toBe(0);
  });

  test('all scores start at zero', () => {
    const s = init();
    expect(s.scores).toEqual([0, 0]);
    expect(s.roundScores).toEqual([0, 0]);
  });

  test('has a non-empty phrase with a category', () => {
    const s = init();
    expect(typeof s.phrase).toBe('string');
    expect(s.phrase.length).toBeGreaterThan(0);
    expect(typeof s.category).toBe('string');
  });

  test('revealed array matches phrase length', () => {
    const s = init();
    expect(s.revealed).toHaveLength(s.phrase.length);
  });
});

// ── Spin ──────────────────────────────────────────────────────────────────────
describe('wheeloffortune spin', () => {
  test('wrong player cannot spin', () => {
    const s = init(); // P0's turn
    expect(game.processAction(makeRoom(s), player(1), { type: 'spin' })).toBeNull();
  });

  test('cannot spin when phase is not spin', () => {
    const s = init();
    // Force phase to act
    s.phase = 'act';
    s.lastSpin = 500;
    expect(game.processAction(makeRoom(s), player(0), { type: 'spin' })).toBeNull();
  });

  test('spin returns a result', () => {
    const s = init();
    const r = game.processAction(makeRoom(s), player(0), { type: 'spin' });
    expect(r).not.toBeNull();
  });

  test('dollar spin transitions to act phase', () => {
    // Patch Math.random to always return a dollar value (index 0 = 500)
    const orig = Math.random;
    Math.random = () => 0; // WHEEL[0] = 500
    const s = init();
    const r = game.processAction(makeRoom(s), player(0), { type: 'spin' });
    Math.random = orig;
    expect(r.gameState.phase).toBe('act');
    expect(r.gameState.lastSpin).toBe(500);
  });

  test('BANKRUPT resets round score and passes turn', () => {
    const orig = Math.random;
    // Find BANKRUPT index — it's at index 16 in WHEEL (length 20)
    Math.random = () => 16 / 20; // WHEEL[16] = 'BANKRUPT'
    const s = init();
    s.roundScores[0] = 1000;
    s.currentTurn = 0;
    game.processAction(makeRoom(s), player(0), { type: 'spin' });
    Math.random = orig;
    expect(s.roundScores[0]).toBe(0);
    expect(s.currentTurn).toBe(1);
  });

  test('LOSE_A_TURN passes turn without resetting score', () => {
    const orig = Math.random;
    // LOSE_A_TURN is at index 17
    Math.random = () => 17 / 20;
    const s = init();
    s.roundScores[0] = 800;
    s.currentTurn = 0;
    game.processAction(makeRoom(s), player(0), { type: 'spin' });
    Math.random = orig;
    expect(s.roundScores[0]).toBe(800); // unchanged
    expect(s.currentTurn).toBe(1);
  });
});

// ── Guess consonant ───────────────────────────────────────────────────────────
describe('wheeloffortune guess', () => {
  function afterSpin(spinVal = 500) {
    const s = init();
    // Force a known puzzle
    const phrase = 'HELLO WORLD';
    s.phrase    = phrase;
    s.revealed  = Array.from(phrase).map(c => c === ' ' ? ' ' : null);
    s.phase     = 'act';
    s.lastSpin  = spinVal;
    s.currentTurn = 0;
    return s;
  }

  test('cannot guess when phase is spin', () => {
    const s = init();
    expect(game.processAction(makeRoom(s), player(0), { type: 'guess', letter: 'H' })).toBeNull();
  });

  test('cannot guess a vowel', () => {
    const s = afterSpin();
    expect(game.processAction(makeRoom(s), player(0), { type: 'guess', letter: 'E' })).toBeNull();
  });

  test('cannot guess an already-guessed letter', () => {
    const s = afterSpin();
    s.guessed = ['H'];
    expect(game.processAction(makeRoom(s), player(0), { type: 'guess', letter: 'H' })).toBeNull();
  });

  test('correct consonant reveals letters and awards points', () => {
    const s = afterSpin(700);
    const before = s.roundScores[0];
    game.processAction(makeRoom(s), player(0), { type: 'guess', letter: 'H' });
    // H appears once in HELLO WORLD
    expect(s.roundScores[0]).toBe(before + 700);
    expect(s.revealed[0]).toBe('H');
  });

  test('wrong consonant loses the turn', () => {
    const s = afterSpin(700);
    s.currentTurn = 0;
    game.processAction(makeRoom(s), player(0), { type: 'guess', letter: 'Z' });
    expect(s.currentTurn).toBe(1);
  });

  test('letter is added to guessed list', () => {
    const s = afterSpin();
    game.processAction(makeRoom(s), player(0), { type: 'guess', letter: 'H' });
    expect(s.guessed).toContain('H');
  });
});

// ── Buy vowel ─────────────────────────────────────────────────────────────────
describe('wheeloffortune buyVowel', () => {
  function readyToBuy(roundScore = 500) {
    const s = init();
    s.phrase    = 'HELLO WORLD';
    s.revealed  = Array.from('HELLO WORLD').map(c => c === ' ' ? ' ' : null);
    s.phase     = 'act';
    s.lastSpin  = 500;
    s.currentTurn = 0;
    s.roundScores[0] = roundScore;
    return s;
  }

  test('cannot buy a consonant', () => {
    const s = readyToBuy();
    expect(game.processAction(makeRoom(s), player(0), { type: 'buyVowel', letter: 'H' })).toBeNull();
  });

  test('cannot buy an already-guessed vowel', () => {
    const s = readyToBuy();
    s.guessed = ['E'];
    expect(game.processAction(makeRoom(s), player(0), { type: 'buyVowel', letter: 'E' })).toBeNull();
  });

  test('cannot buy vowel without enough funds', () => {
    const s = readyToBuy(0); // no round score, no total score
    expect(game.processAction(makeRoom(s), player(0), { type: 'buyVowel', letter: 'E' })).toBeNull();
  });

  test('buying vowel deducts $250 and reveals vowels', () => {
    const s = readyToBuy(500);
    game.processAction(makeRoom(s), player(0), { type: 'buyVowel', letter: 'E' });
    expect(s.roundScores[0]).toBe(250);  // 500 - 250
    expect(s.revealed[1]).toBe('E');     // pos 1 in HELLO
    expect(s.guessed).toContain('E');
  });
});

// ── Solve ─────────────────────────────────────────────────────────────────────
describe('wheeloffortune solve', () => {
  function readyToSolve() {
    const s = init();
    s.phrase    = 'HELLO WORLD';
    s.revealed  = Array.from('HELLO WORLD').map(c => c === ' ' ? ' ' : null);
    s.phase     = 'act';
    s.lastSpin  = 500;
    s.currentTurn = 0;
    s.roundScores = [800, 0];
    return s;
  }

  test('wrong answer loses the turn', () => {
    const s = readyToSolve();
    const r = game.processAction(makeRoom(s), player(0), { type: 'solve', answer: 'GOODBYE WORLD' });
    expect(r.gameOver).toBe(false);
    expect(r.solveFailure).toBe(true);
    expect(s.currentTurn).toBe(1);
  });

  test('correct answer ends game and awards round score', () => {
    const s = readyToSolve();
    const r = game.processAction(makeRoom(s), player(0), { type: 'solve', answer: 'HELLO WORLD' });
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(0);
    expect(r.scores[0]).toBe(800);
  });

  test('correct answer is case-insensitive', () => {
    const s = readyToSolve();
    const r = game.processAction(makeRoom(s), player(0), { type: 'solve', answer: 'hello world' });
    expect(r.gameOver).toBe(true);
  });

  test('correct answer fully reveals the board', () => {
    const s = readyToSolve();
    game.processAction(makeRoom(s), player(0), { type: 'solve', answer: 'HELLO WORLD' });
    expect(s.revealed.every(c => c !== null)).toBe(true);
  });
});
