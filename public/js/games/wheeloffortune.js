/* ════════════════════════════════════════════════════════════════
   WHEEL OF FORTUNE – Client UI
   ════════════════════════════════════════════════════════════════ */

const WheelOfFortuneGame = (() => {
  const VOWELS = new Set(['A','E','I','O','U']);
  const VOWEL_COST = 250;

  // ── Render (initial draw) ────────────────────────────────────
  function render(container, state, playerIndex, isSpectator) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'wof-wrap';
    wrap.id = 'wof-wrap';

    wrap.appendChild(buildScoreboard(state, playerIndex));
    wrap.appendChild(buildWheel(state));
    wrap.appendChild(buildPuzzleBoard(state));
    wrap.appendChild(buildAlphabet(state, playerIndex, isSpectator));
    if (!isSpectator) wrap.appendChild(buildControls(state, playerIndex));

    container.appendChild(wrap);
  }

  // ── Update (patch in-place) ──────────────────────────────────
  function update(container, state) {
    // Re-render the whole thing; WOF state changes significantly each action
    const playerIndex = App.state.playerIndex;
    const isSpectator = App.state.isSpectator;
    render(container, state, playerIndex, isSpectator);
  }

  // ── Scoreboard ────────────────────────────────────────────────
  function buildScoreboard(state, playerIndex) {
    const bar = document.createElement('div');
    bar.className = 'wof-scoreboard';
    const players = App.state.players || [];
    bar.innerHTML = [0,1].map(i => {
      const p = players[i];
      const name = p ? esc(p.username) : `Player ${i+1}`;
      const isMe = i === playerIndex;
      const isTurn = i === state.currentTurn;
      return `<div class="wof-score-block${isMe ? ' me' : ''}${isTurn ? ' active-turn' : ''}">
        <span class="wof-score-name">${name}${isMe ? ' <em>(you)</em>' : ''}</span>
        <span class="wof-score-total">$${state.scores[i]}</span>
        <span class="wof-score-round">Round: $${state.roundScores[i]}</span>
      </div>`;
    }).join('');
    return bar;
  }

  // ── Wheel display ─────────────────────────────────────────────
  function buildWheel(state) {
    const div = document.createElement('div');
    div.className = 'wof-wheel-area';

    let inner = '';
    if (state.phase === 'spin' && state.lastSpin) {
      inner = spinResultHtml(state.lastSpin);
    } else if (state.phase === 'act' && state.lastSpin) {
      inner = `<div class="wof-wheel-result landed">
        <span class="wof-spin-label">Spin Result</span>
        <span class="wof-spin-val">$${state.lastSpin}</span>
      </div>`;
    } else {
      inner = `<div class="wof-wheel-idle">🎡<br><small>Waiting for spin…</small></div>`;
    }
    div.innerHTML = inner;
    return div;
  }

  function spinResultHtml(val) {
    if (val === 'BANKRUPT')     return `<div class="wof-wheel-result bankrupt"><span>💸 BANKRUPT</span></div>`;
    if (val === 'LOSE_A_TURN')  return `<div class="wof-wheel-result loseturn"><span>⛔ LOSE A TURN</span></div>`;
    return `<div class="wof-wheel-result landed"><span class="wof-spin-val">$${val}</span></div>`;
  }

  // ── Puzzle board ──────────────────────────────────────────────
  function buildPuzzleBoard(state) {
    const wrap = document.createElement('div');
    wrap.className = 'wof-puzzle-wrap';

    const cat = document.createElement('div');
    cat.className = 'wof-category';
    cat.textContent = state.category;
    wrap.appendChild(cat);

    const board = document.createElement('div');
    board.className = 'wof-board';

    // Split phrase into words, render each word as a group
    const revealed = state.revealed;
    let idx = 0;
    state.phrase.split(' ').forEach(word => {
      const wordDiv = document.createElement('div');
      wordDiv.className = 'wof-word';
      for (let i = 0; i < word.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'wof-letter-cell';
        const val = revealed[idx];
        cell.textContent = val || '';
        if (val) cell.classList.add('revealed');
        wordDiv.appendChild(cell);
        idx++;
      }
      board.appendChild(wordDiv);
      idx++; // skip space
    });

    wrap.appendChild(board);
    return wrap;
  }

  // ── Alphabet keyboard ─────────────────────────────────────────
  function buildAlphabet(state, playerIndex, isSpectator) {
    const div = document.createElement('div');
    div.className = 'wof-alphabet';

    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'wof-letter-btn';
      btn.textContent = letter;

      const guessed = state.guessed.includes(letter);
      const isVowel = VOWELS.has(letter);
      if (isVowel)  btn.classList.add('vowel');
      if (guessed)  btn.classList.add('used');

      btn.disabled = true; // default disabled; enabled below if appropriate

      if (!isSpectator && !guessed && App.state.gameStarted) {
        const isTurn   = state.currentTurn === playerIndex;
        const canAct   = state.phase === 'act';
        const canSpin  = state.phase === 'spin';

        if (isTurn && canAct && !isVowel) {
          // Guess consonant
          btn.disabled = false;
          btn.addEventListener('click', () => SocketClient.gameAction({ type: 'guess', letter }));
        }
        if (isTurn && (canAct || canSpin) && isVowel) {
          // Buy vowel – check affordability
          const totalFunds = state.scores[playerIndex] + state.roundScores[playerIndex];
          if (totalFunds >= VOWEL_COST) {
            btn.disabled = false;
            btn.classList.add('buyable');
            btn.title = `Buy vowel for $${VOWEL_COST}`;
            btn.addEventListener('click', () => SocketClient.gameAction({ type: 'buyVowel', letter }));
          }
        }
      }
      div.appendChild(btn);
    });
    return div;
  }

  // ── Action controls ───────────────────────────────────────────
  function buildControls(state, playerIndex) {
    const div = document.createElement('div');
    div.className = 'wof-controls';

    const isTurn = state.currentTurn === playerIndex;

    if (isTurn && state.phase === 'spin') {
      const spinBtn = document.createElement('button');
      spinBtn.className = 'btn btn-primary wof-spin-btn';
      spinBtn.textContent = '🎡 Spin the Wheel';
      spinBtn.addEventListener('click', () => SocketClient.gameAction({ type: 'spin' }));
      div.appendChild(spinBtn);
    }

    if (isTurn && (state.phase === 'act' || state.phase === 'spin')) {
      // Solve button
      const solveWrap = document.createElement('div');
      solveWrap.className = 'wof-solve-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'wof-solve-input';
      input.placeholder = 'Type the full answer to solve…';
      input.maxLength = 60;

      const solveBtn = document.createElement('button');
      solveBtn.className = 'btn btn-success';
      solveBtn.textContent = '✔ Solve';
      solveBtn.addEventListener('click', () => {
        const answer = input.value.trim();
        if (answer) SocketClient.gameAction({ type: 'solve', answer });
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') solveBtn.click(); });

      solveWrap.appendChild(input);
      solveWrap.appendChild(solveBtn);
      div.appendChild(solveWrap);
    }

    if (!isTurn) {
      const wait = document.createElement('div');
      wait.className = 'wof-waiting';
      wait.textContent = 'Waiting for opponent…';
      div.appendChild(wait);
    }

    return div;
  }

  // ── Helpers ───────────────────────────────────────────────────
  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Self-register
  GameRegistry.register({
    id:    'wheeloffortune',
    label: 'Wheel of Fortune',
    icon:  '🎡',
    render,
    update,
    getStatus(state, playerIndex) {
      const players = App.state.players || [];
      const turnName = players[state.currentTurn] ? players[state.currentTurn].username : '?';
      if (state.phase === 'spin') return state.currentTurn === playerIndex ? 'Your turn — Spin the wheel!' : `${turnName} is spinning…`;
      if (state.phase === 'act')  return state.currentTurn === playerIndex ? `You spun $${state.lastSpin} — guess a consonant or solve!` : `${turnName} is thinking…`;
      return '';
    }
  });

  return { render, update };
})();
