'use strict';
/**
 * Wheel of Fortune
 * Two players take turns spinning the wheel to earn money, then guessing
 * consonants to reveal a hidden phrase. Vowels cost $250 each.
 * First to solve the puzzle wins the round.
 *
 * Turn phases:
 *   'spin'  – current player must spin
 *   'act'   – player chose a spin value; may guess, buy vowel, or solve
 *   'solve' – player is attempting to type the full answer
 */

const WHEEL = [
  500, 600, 700, 800, 900, 1000, 1500, 2500,
  300, 400, 850, 700, 600, 500, 800, 1200,
  'BANKRUPT', 'LOSE_A_TURN', 'BANKRUPT', 'LOSE_A_TURN'
];

const VOWELS = new Set(['A','E','I','O','U']);
const VOWEL_COST = 250;

const PUZZLES = [
  { phrase: 'ELECTRIC SLIDE',         category: 'Song & Artist'     },
  { phrase: 'APPLE PIE',              category: 'Food & Drink'      },
  { phrase: 'YELLOW BRICK ROAD',      category: 'Phrase'            },
  { phrase: 'HAPPY BIRTHDAY TO YOU',  category: 'Song & Artist'     },
  { phrase: 'SUNDAY MORNING',         category: 'Thing'             },
  { phrase: 'PIZZA DELIVERY',         category: 'What Are You Doing?' },
  { phrase: 'SHOOTING STARS',         category: 'Things'            },
  { phrase: 'AROUND THE WORLD',       category: 'Phrase'            },
  { phrase: 'FRESH PRINCE OF BEL AIR',category: 'TV Show'           },
  { phrase: 'JURASSIC PARK',          category: 'Movie'             },
  { phrase: 'GOLDEN GATE BRIDGE',     category: 'Landmark'          },
  { phrase: 'CATCH A FALLING STAR',   category: 'Phrase'            },
  { phrase: 'BOARD GAME NIGHT',       category: 'Event'             },
  { phrase: 'DANCING IN THE DARK',    category: 'Song & Artist'     },
  { phrase: 'MISSION IMPOSSIBLE',     category: 'Movie'             },
  { phrase: 'CHOCOLATE CAKE',         category: 'Food & Drink'      },
  { phrase: 'ONCE UPON A TIME',       category: 'Phrase'            },
  { phrase: 'NIGHT OWL',              category: 'Person'            },
  { phrase: 'SILVER LINING',          category: 'Phrase'            },
  { phrase: 'BUCKET LIST',            category: 'Thing'             },
];

module.exports = {
  id: 'wheeloffortune',
  label: 'Wheel of Fortune',
  icon: '🎡',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    return makeRound(puzzle, [0, 0]);
  },

  processAction(room, player, action) {
    const s = room.gameState;
    if (s.currentTurn !== player.playerIndex) return null;

    switch (action.type) {
      case 'spin':      return doSpin(s, room, player);
      case 'guess':     return doGuess(s, room, player, action.letter);
      case 'buyVowel':  return doBuyVowel(s, room, player, action.letter);
      case 'solve':     return doSolve(s, room, player, action.answer);
      default:          return null;
    }
  }
};

// ── Round helpers ─────────────────────────────────────────────────────────────
function makeRound(puzzle, scores) {
  const letters = puzzle.phrase.toUpperCase().replace(/[^A-Z ]/g, '');
  const unique = [...new Set(letters.replace(/ /g,''))];
  return {
    phrase:    puzzle.phrase.toUpperCase(),
    category:  puzzle.category,
    revealed:  Array.from(puzzle.phrase.toUpperCase()).map(c => c === ' ' ? ' ' : null),
    guessed:   [],          // letters already tried
    scores,
    roundScores: [0, 0],    // earned this round (lost on bankrupt)
    currentTurn: 0,
    phase:     'spin',      // 'spin' | 'act' | 'solve'
    lastSpin:  null,
    totalLetters: unique.length,
    revealedCount: 0
  };
}

function doSpin(s, room, player) {
  if (s.phase !== 'spin') return null;

  const val = WHEEL[Math.floor(Math.random() * WHEEL.length)];
  s.lastSpin = val;

  if (val === 'BANKRUPT') {
    s.roundScores[player.playerIndex] = 0;
    s.phase = 'spin';
    s.currentTurn = 1 - s.currentTurn;
  } else if (val === 'LOSE_A_TURN') {
    s.phase = 'spin';
    s.currentTurn = 1 - s.currentTurn;
  } else {
    s.phase = 'act';
  }
  return { gameState: s, gameOver: false };
}

function doGuess(s, room, player, letter) {
  if (s.phase !== 'act') return null;
  letter = (letter || '').toUpperCase();
  if (!letter || !/^[A-Z]$/.test(letter)) return null;
  if (VOWELS.has(letter) || s.guessed.includes(letter)) return null;

  s.guessed.push(letter);
  const count = revealLetter(s, letter);

  if (count === 0) {
    // No matching letters – lose turn
    s.phase = 'spin';
    s.currentTurn = 1 - s.currentTurn;
  } else {
    s.roundScores[player.playerIndex] += count * s.lastSpin;
    s.phase = 'spin'; // player may spin again OR we keep turn? Classic rules: keep turn
    // Classic WOF: correct guess = keep turn
    s.phase = 'spin';
  }

  return checkSolved(s, room, player) || { gameState: s, gameOver: false };
}

function doBuyVowel(s, room, player, letter) {
  if (s.phase !== 'act' && s.phase !== 'spin') return null;
  letter = (letter || '').toUpperCase();
  if (!VOWELS.has(letter)) return null;
  if (s.guessed.includes(letter)) return null;

  const pi = player.playerIndex;
  const totalScore = s.scores[pi] + s.roundScores[pi];
  if (totalScore < VOWEL_COST && s.roundScores[pi] < VOWEL_COST) return null;

  if (s.roundScores[pi] >= VOWEL_COST) s.roundScores[pi] -= VOWEL_COST;
  else { s.scores[pi] -= (VOWEL_COST - s.roundScores[pi]); s.roundScores[pi] = 0; }

  s.guessed.push(letter);
  revealLetter(s, letter);
  s.phase = 'spin'; // after buying vowel, player spins or solves

  return checkSolved(s, room, player) || { gameState: s, gameOver: false };
}

function doSolve(s, room, player, answer) {
  if (!answer) return null;
  const norm = answer.toUpperCase().trim().replace(/\s+/g, ' ');
  if (norm !== s.phrase) {
    // Wrong guess – lose turn
    s.phase = 'spin';
    s.currentTurn = 1 - s.currentTurn;
    s.lastSpin = null;
    return { gameState: s, gameOver: false, solveFailure: true };
  }
  // Correct!
  s.scores[player.playerIndex] += s.roundScores[player.playerIndex];
  s.phrase.split('').forEach((c, i) => { s.revealed[i] = c; });
  const total0 = s.scores[0], total1 = s.scores[1];
  const winner = total0 > total1 ? 0 : total1 > total0 ? 1 : -1;
  s.phase = 'over';
  return {
    gameState: s, gameOver: true,
    winner,
    winnerName: winner >= 0 ? room.players[winner].username : null,
    scores: s.scores
  };
}

function revealLetter(s, letter) {
  let count = 0;
  s.phrase.split('').forEach((c, i) => {
    if (c === letter) { s.revealed[i] = c; count++; }
  });
  s.revealedCount = s.revealed.filter(c => c !== null && c !== ' ').length;
  return count;
}

function checkSolved(s, room, player) {
  const solved = s.revealed.every(c => c !== null);
  if (!solved) return null;
  s.scores[player.playerIndex] += s.roundScores[player.playerIndex];
  s.phase = 'over';
  const total0 = s.scores[0], total1 = s.scores[1];
  const winner = total0 > total1 ? 0 : total1 > total0 ? 1 : -1;
  return {
    gameState: s, gameOver: true,
    winner,
    winnerName: winner >= 0 ? room.players[winner].username : null,
    scores: s.scores
  };
}
