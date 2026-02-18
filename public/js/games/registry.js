/* ════════════════════════════════════════════════════════════════
   CLIENT-SIDE GAME REGISTRY
   ════════════════════════════════════════════════════════════════
   Each game module calls GameRegistry.register() at load time.
   To add a new game: create the JS file, call register(), add a
   <script> tag in index.html. Nothing else needs changing.
   ════════════════════════════════════════════════════════════════ */

const GameRegistry = (() => {
  const games = {};   // id -> { id, label, icon, render, update }

  function register(module) {
    if (!module.id) { console.warn('GameRegistry: module missing id', module); return; }
    games[module.id] = module;
  }

  function render(gameType, container, state, playerIndex, isSpectator) {
    const game = games[gameType];
    if (game && game.render) {
      game.render(container, state, playerIndex, isSpectator);
    } else {
      container.innerHTML = `<div class="empty-state"><p>⚠️ Game UI not loaded: <strong>${gameType}</strong></p></div>`;
    }
  }

  function update(gameType, container, state) {
    const game = games[gameType];
    if (game && game.update) game.update(container, state);
  }

  function getLabel(gameType) {
    return games[gameType] ? games[gameType].label : gameType;
  }

  function getIcon(gameType) {
    return games[gameType] ? games[gameType].icon : '🎮';
  }

  function all() { return Object.values(games); }

  return { register, render, update, getLabel, getIcon, all };
})();
