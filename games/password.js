'use strict';
/**
 * Password – Classic TV word-guessing game.
 *
 * One player (the Clue Giver) sees the secret word and gives a
 * one-word clue. The other (the Guesser) tries to guess the word.
 * If wrong, roles swap – the Guesser now gives a clue, and so on.
 * Solving with fewer clues earns more points.
 * First to reach TARGET_SCORE points wins.
 */

const TARGET_SCORE = 25;
const MAX_CLUES_PER_ROUND = 8;  // after this the round is a pass (0 pts)

const WORDS = [
  'ELEPHANT','UMBRELLA','CHOCOLATE','TELESCOPE','LIGHTHOUSE',
  'VOLCANO','SUITCASE','CATHEDRAL','SUBMARINE','ORCHESTRA',
  'BUTTERFLY','CARNIVAL','DETECTIVE','EVERGREEN','FISHERMAN',
  'HAMBURGER','ICEBERG','JELLYFISH','KEYBOARD','LANTERN',
  'MOUNTAIN','NOTEBOOK','OCEAN','PENGUIN','QUARRY',
  'RAINBOW','SANDWICH','TORNADO','UNIVERSE','VACATION',
  'WATERFALL','XYLOPHONE','YEARBOOK','ZIPPER','ASTRONAUT',
  'BLUEPRINT','COMPASS','DIAMOND','ENVELOPE','FORTRESS',
  'GOVERNOR','HIGHWAY','ISLAND','JUNGLE','KINGDOM',
  'LIBRARY','MUSEUM','NECKLACE','ORIGAMI','PORTRAIT',
  'QUICKSAND','RIDDLE','SKELETON','THUNDER','UPSTREAM',
  'VILLAGE','WHISPER','EXPLORER','YESTERDAY','CHAMPION',
];

function pointsForClueCount(n) {
  // 10 pts for 1 clue, down to 3 pts for 8 clues
  return Math.max(10 - n + 1, 3);
}

function pickWord(used) {
  const available = WORDS.filter(w => !used.includes(w));
  const pool = available.length > 0 ? available : WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  id: 'password',
  label: 'Password',
  icon: '🔑',
  maxPlayers: 2,
  minPlayers: 2,

  init() {
    const word = pickWord([]);
    return {
      secretWord:  word,
      usedWords:   [word],
      clues:       [],           // [{ giverIndex, clue, guess, correct }]
      scores:      [0, 0],
      clueGiver:   0,            // who gives the first clue this round
      guesser:     1,
      phase:       'give_clue',  // 'give_clue' | 'guess'
      clueCount:   0,
      roundOver:   false,
      lastResult:  null,         // 'correct' | 'wrong' | 'pass'
    };
  },

  processAction(room, player, action) {
    const s = room.gameState;
    const pi = player.playerIndex;

    switch (action.type) {
      case 'giveClue': {
        if (s.phase !== 'give_clue') return null;
        if (pi !== s.clueGiver) return null;
        const clue = (action.clue || '').trim().toUpperCase();
        if (!clue || clue.split(/\s+/).length > 1) return null; // must be one word
        if (clue === s.secretWord) return null;               // can't say the word

        s.clues.push({ giverIndex: pi, clue, guess: null, correct: null });
        s.clueCount++;
        s.phase = 'guess';
        return { gameState: s, gameOver: false };
      }

      case 'guess': {
        if (s.phase !== 'guess') return null;
        if (pi !== s.guesser) return null;
        const guess = (action.guess || '').trim().toUpperCase();
        if (!guess) return null;

        const last = s.clues[s.clues.length - 1];
        last.guess = guess;

        if (guess === s.secretWord) {
          last.correct = true;
          const pts = pointsForClueCount(s.clueCount);
          s.scores[pi] += pts;
          s.lastResult = 'correct';

          if (s.scores[pi] >= TARGET_SCORE) {
            return { gameState: s, gameOver: true, winner: pi, winnerName: player.username, scores: s.scores };
          }
          // Start new round – giver/guesser swap
          return nextRound(s, room);
        } else {
          last.correct = false;
          s.lastResult = 'wrong';

          if (s.clueCount >= MAX_CLUES_PER_ROUND) {
            // Pass – no points
            s.lastResult = 'pass';
            return nextRound(s, room);
          }

          // Swap roles within the same round
          [s.clueGiver, s.guesser] = [s.guesser, s.clueGiver];
          s.phase = 'give_clue';
          return { gameState: s, gameOver: false };
        }
      }

      default: return null;
    }
  }
};

function nextRound(s, room) {
  // Roles swap for the new round
  const newGiver   = 1 - s.clueGiver;
  const newGuesser = s.clueGiver;
  const word       = pickWord(s.usedWords);
  s.usedWords.push(word);
  s.secretWord  = word;
  s.clues       = [];
  s.clueCount   = 0;
  s.clueGiver   = newGiver;
  s.guesser     = newGuesser;
  s.phase       = 'give_clue';
  s.roundOver   = false;
  return { gameState: s, gameOver: false };
}
