/* ════════════════════════════════════════════════════════════════
   PASSWORD – Classic TV word-guessing game client UI
   ════════════════════════════════════════════════════════════════ */

const PasswordGame = (() => {
  const TARGET_SCORE = 25;

  function render(container, state, playerIndex, isSpectator) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'pw-wrap';
    wrap.id = 'pw-wrap';

    wrap.appendChild(buildHeader(state, playerIndex));
    wrap.appendChild(buildWordArea(state, playerIndex, isSpectator));
    wrap.appendChild(buildClueHistory(state));
    wrap.appendChild(buildActionArea(state, playerIndex, isSpectator));
    wrap.appendChild(buildScores(state, playerIndex));

    container.appendChild(wrap);
  }

  function update(container, state) {
    render(container, state, App.state.playerIndex, App.state.isSpectator);
  }

  // ── Header / role banner ──────────────────────────────────────
  function buildHeader(state, playerIndex) {
    const bar = document.createElement('div');
    bar.className = 'pw-header';

    const isGiver   = state.clueGiver  === playerIndex;
    const isGuesser = state.guesser    === playerIndex;
    const players   = App.state.players || [];

    let roleText = '';
    if (isGiver)   roleText = '🗣️ <strong>You are the Clue Giver</strong> — give a one-word hint!';
    else if (isGuesser) roleText = '🤔 <strong>You are the Guesser</strong> — what is the secret word?';
    else {
      const giverName  = players[state.clueGiver]  ? esc(players[state.clueGiver].username)  : 'P1';
      const guesserName= players[state.guesser]    ? esc(players[state.guesser].username)    : 'P2';
      roleText = `${giverName} is giving clues → ${guesserName} is guessing`;
    }

    bar.innerHTML = `<div class="pw-role">${roleText}</div>
      <div class="pw-clue-count">Clue ${state.clueCount} / 8</div>`;
    return bar;
  }

  // ── Secret word display ───────────────────────────────────────
  function buildWordArea(state, playerIndex, isSpectator) {
    const div = document.createElement('div');
    div.className = 'pw-word-area';

    const isGiver = state.clueGiver === playerIndex;

    if (isGiver && !isSpectator) {
      // Show the secret word to the clue giver
      div.innerHTML = `
        <div class="pw-secret-label">The secret word is:</div>
        <div class="pw-secret-word">${esc(state.secretWord)}</div>
        <div class="pw-secret-hint">Give a <em>one-word</em> clue — you cannot say the word itself!</div>`;
    } else {
      // Show blank / partial indicator to guesser & spectators
      const letters = state.secretWord.length;
      div.innerHTML = `
        <div class="pw-secret-label">Secret word:</div>
        <div class="pw-hidden-word">${'_ '.repeat(letters).trim()}</div>
        <div class="pw-hidden-hint">${letters} letters</div>`;
    }
    return div;
  }

  // ── Clue + guess history ──────────────────────────────────────
  function buildClueHistory(state) {
    const div = document.createElement('div');
    div.className = 'pw-history';

    if (state.clues.length === 0) {
      div.innerHTML = '<div class="pw-no-clues">No clues yet — waiting for first clue…</div>';
      return div;
    }

    const players = App.state.players || [];
    state.clues.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'pw-clue-row' + (entry.correct === true ? ' correct' : entry.correct === false ? ' wrong' : '');

      const giverName = players[entry.giverIndex] ? esc(players[entry.giverIndex].username) : `P${entry.giverIndex+1}`;
      row.innerHTML = `
        <span class="pw-clue-num">#${i+1}</span>
        <span class="pw-clue-val">💬 <strong>${esc(entry.clue)}</strong></span>
        ${entry.guess !== null
          ? `<span class="pw-guess-val">${entry.correct ? '✅' : '❌'} ${esc(entry.guess)}</span>`
          : '<span class="pw-guess-pending">⏳ waiting for guess…</span>'}`;
      div.appendChild(row);
    });
    return div;
  }

  // ── Input controls ────────────────────────────────────────────
  function buildActionArea(state, playerIndex, isSpectator) {
    const div = document.createElement('div');
    div.className = 'pw-action';

    if (isSpectator) {
      div.innerHTML = '<div class="pw-waiting">👁️ Spectating</div>';
      return div;
    }

    const isGiver   = state.clueGiver  === playerIndex && state.phase === 'give_clue';
    const isGuesser = state.guesser    === playerIndex && state.phase === 'guess';

    if (isGiver) {
      const row = document.createElement('div');
      row.className = 'pw-input-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pw-text-input';
      input.placeholder = 'One word clue…';
      input.maxLength = 30;
      input.autofocus = true;

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '📤 Give Clue';
      btn.addEventListener('click', () => {
        const clue = input.value.trim();
        if (clue) { SocketClient.gameAction({ type: 'giveClue', clue }); input.value = ''; }
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

      row.appendChild(input);
      row.appendChild(btn);
      div.appendChild(row);
    } else if (isGuesser) {
      const row = document.createElement('div');
      row.className = 'pw-input-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pw-text-input';
      input.placeholder = 'Your guess…';
      input.maxLength = 30;
      input.autofocus = true;

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = '🎯 Guess';
      btn.addEventListener('click', () => {
        const guess = input.value.trim();
        if (guess) { SocketClient.gameAction({ type: 'guess', guess }); input.value = ''; }
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

      row.appendChild(input);
      row.appendChild(btn);
      div.appendChild(row);
    } else {
      div.innerHTML = '<div class="pw-waiting">⏳ Waiting for opponent…</div>';
    }
    return div;
  }

  // ── Score bar ─────────────────────────────────────────────────
  function buildScores(state, playerIndex) {
    const bar = document.createElement('div');
    bar.className = 'pw-scores';
    const players = App.state.players || [];

    [0,1].forEach(i => {
      const p = players[i];
      const name = p ? esc(p.username) : `Player ${i+1}`;
      const pct = Math.min((state.scores[i] / TARGET_SCORE) * 100, 100);
      bar.innerHTML += `
        <div class="pw-score-block${i === playerIndex ? ' me' : ''}">
          <div class="pw-score-name">${name}: <strong>${state.scores[i]}</strong> pts</div>
          <div class="pw-score-bar-outer">
            <div class="pw-score-bar-inner" style="width:${pct}%"></div>
          </div>
        </div>`;
    });

    const goal = document.createElement('div');
    goal.className = 'pw-score-goal';
    goal.textContent = `First to ${TARGET_SCORE} points wins`;
    bar.appendChild(goal);

    return bar;
  }

  // ── Helpers ───────────────────────────────────────────────────
  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Self-register
  GameRegistry.register({
    id:    'password',
    label: 'Password',
    icon:  '🔑',
    render,
    update,
    getStatus(state, playerIndex) {
      const players = App.state.players || [];
      if (state.phase === 'give_clue') {
        return state.clueGiver === playerIndex
          ? 'Your turn — give a one-word clue!'
          : `Waiting for ${players[state.clueGiver]?.username || 'opponent'} to give a clue…`;
      }
      if (state.phase === 'guess') {
        return state.guesser === playerIndex
          ? 'Your turn — what is the secret word?'
          : `Waiting for ${players[state.guesser]?.username || 'opponent'} to guess…`;
      }
      return '';
    }
  });

  return { render, update };
})();
