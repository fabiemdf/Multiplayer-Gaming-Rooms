'use strict';

const game = require('../games/password');

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

// ── init() ────────────────────────────────────────────────────────────────────
describe('password init', () => {
  test('starts in give_clue phase', () => {
    expect(game.init().phase).toBe('give_clue');
  });

  test('clueGiver is 0, guesser is 1 at start', () => {
    const s = game.init();
    expect(s.clueGiver).toBe(0);
    expect(s.guesser).toBe(1);
  });

  test('secretWord is a non-empty string', () => {
    const s = game.init();
    expect(typeof s.secretWord).toBe('string');
    expect(s.secretWord.length).toBeGreaterThan(0);
  });

  test('scores start at zero', () => {
    const s = game.init();
    expect(s.scores).toEqual([0, 0]);
  });
});

// ── Clue giving ───────────────────────────────────────────────────────────────
describe('password giveClue', () => {
  test('guesser cannot give a clue', () => {
    const s = game.init();
    const r = game.processAction(makeRoom(s), player(1), { type: 'giveClue', clue: 'BIG' });
    expect(r).toBeNull();
  });

  test('multi-word clue is rejected', () => {
    const s = game.init();
    const r = game.processAction(makeRoom(s), player(0), { type: 'giveClue', clue: 'very big' });
    expect(r).toBeNull();
  });

  test('clue that matches secret word is rejected', () => {
    const s = game.init();
    const r = game.processAction(makeRoom(s), player(0), { type: 'giveClue', clue: s.secretWord });
    expect(r).toBeNull();
  });

  test('valid clue transitions phase to guess', () => {
    const s = game.init();
    const r = game.processAction(makeRoom(s), player(0), { type: 'giveClue', clue: 'LARGE' });
    expect(r).not.toBeNull();
    expect(r.gameState.phase).toBe('guess');
    expect(r.gameState.clues).toHaveLength(1);
    expect(r.gameState.clues[0].clue).toBe('LARGE');
  });
});

// ── Guessing ──────────────────────────────────────────────────────────────────
describe('password guess', () => {
  function afterClue(secretOverride) {
    const s = game.init();
    if (secretOverride) s.secretWord = secretOverride;
    game.processAction(makeRoom(s), player(0), { type: 'giveClue', clue: 'HINT' });
    return s;
  }

  test('clue giver cannot guess', () => {
    const s = afterClue();
    const r = game.processAction(makeRoom(s), player(0), { type: 'guess', guess: 'ANYTHING' });
    expect(r).toBeNull();
  });

  test('correct guess ends the round with points', () => {
    const s = afterClue('ELEPHANT');
    const r = game.processAction(makeRoom(s), player(1), { type: 'guess', guess: 'ELEPHANT' });
    expect(r).not.toBeNull();
    expect(r.gameState.scores[1]).toBeGreaterThan(0);
  });

  test('wrong guess swaps roles and stays in give_clue', () => {
    const s = afterClue('ELEPHANT');
    const r = game.processAction(makeRoom(s), player(1), { type: 'guess', guess: 'WRONG' });
    expect(r.gameState.phase).toBe('give_clue');
    // Roles should have swapped
    expect(r.gameState.clueGiver).toBe(1);
    expect(r.gameState.guesser).toBe(0);
  });

  test('clue history is marked correct/incorrect', () => {
    const s = afterClue('ELEPHANT');
    game.processAction(makeRoom(s), player(1), { type: 'guess', guess: 'WRONG' });
    expect(s.clues[0].correct).toBe(false);
    expect(s.clues[0].guess).toBe('WRONG');
  });

  test('scoring: earlier correct guess earns more points', () => {
    // 1st clue correct
    const s1 = game.init();
    s1.secretWord = 'MOUNTAIN';
    game.processAction(makeRoom(s1), player(0), { type: 'giveClue', clue: 'HILL' });
    const r1 = game.processAction(makeRoom(s1), player(1), { type: 'guess', guess: 'MOUNTAIN' });
    const pts1 = r1.gameState.scores[1];

    // 3rd clue correct (after 2 wrong guesses + role swaps)
    const s2 = game.init();
    s2.secretWord = 'MOUNTAIN';
    // Clue 1 from P0 → wrong guess P1 → swap
    game.processAction(makeRoom(s2), player(0), { type: 'giveClue', clue: 'HILL' });
    game.processAction(makeRoom(s2), player(1), { type: 'guess', guess: 'WRONG' });
    // Clue 2 from P1 → wrong guess P0 → swap back
    game.processAction(makeRoom(s2), player(1), { type: 'giveClue', clue: 'PEAK' });
    game.processAction(makeRoom(s2), player(0), { type: 'guess', guess: 'WRONG' });
    // Clue 3 from P0 → correct by P1
    game.processAction(makeRoom(s2), player(0), { type: 'giveClue', clue: 'ROCKY' });
    const r2 = game.processAction(makeRoom(s2), player(1), { type: 'guess', guess: 'MOUNTAIN' });
    const pts2 = r2.gameState.scores[1];

    expect(pts1).toBeGreaterThan(pts2);
  });
});

// ── Game-over on target score ─────────────────────────────────────────────────
describe('password game over', () => {
  test('triggers gameOver when a player reaches 25 points', () => {
    const s = game.init();
    s.scores = [0, 24];   // Bob needs just 1 more point
    s.secretWord = 'OCEAN';
    s.clueGiver  = 0;
    s.guesser    = 1;
    s.phase      = 'give_clue';

    game.processAction(makeRoom(s), player(0), { type: 'giveClue', clue: 'SEA' });
    const r = game.processAction(makeRoom(s), player(1), { type: 'guess', guess: 'OCEAN' });
    expect(r.gameOver).toBe(true);
    expect(r.winner).toBe(1);
  });
});

// ── Round pass after max clues ────────────────────────────────────────────────
describe('password round pass', () => {
  test('round passes after 8 clues without a correct guess', () => {
    const s = game.init();
    s.secretWord = 'XYZZY'; // obscure word nobody will guess in test
    s.clueGiver  = 0;
    s.guesser    = 1;
    s.phase      = 'give_clue';

    for (let i = 0; i < 8; i++) {
      const giver   = i % 2 === 0 ? 0 : 1;
      const guesser = 1 - giver;
      game.processAction(makeRoom(s), player(giver),   { type: 'giveClue', clue: `CLUE${i}` });
      game.processAction(makeRoom(s), player(guesser), { type: 'guess', guess: 'WRONG' });
    }

    // After 8 wrong guesses the round should have passed (new secretWord, reset clues)
    expect(s.clues).toHaveLength(0);
    expect(s.clueCount).toBe(0);
  });
});
