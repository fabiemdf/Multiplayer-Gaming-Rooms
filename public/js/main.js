/* ════════════════════════════════════════════════════════════════
   MAIN – App State & Screen Management
   ════════════════════════════════════════════════════════════════ */

const App = (() => {
  // ── State ────────────────────────────────────────────────────
  const state = {
    username: '',
    avatar: '🎮',
    currentScreen: 'setup',
    currentRoom: null,
    playerIndex: -1,
    isSpectator: false,
    gameStarted: false,
    gameType: null,
    gameState: null,
    players: [],
    spectators: []
  };

  const AVATARS = ['🎮','🕹️','👾','🎲','🎯','🎳','🏆','⚔️','🛡️','🔮','🌟','🔥','❄️','⚡','💎','🦁','🐉','🤖','👻','🦊','🐺','🦅','🐬','🦋'];

  // ── Screen Management ────────────────────────────────────────
  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(name + '-screen');
    if (screen) screen.classList.add('active');
    state.currentScreen = name;
  }

  // ── Setup Screen ─────────────────────────────────────────────
  function initSetupScreen() {
    const grid = document.getElementById('avatar-grid');
    AVATARS.forEach((av, i) => {
      const el = document.createElement('div');
      el.className = 'avatar-opt' + (i === 0 ? ' selected' : '');
      el.textContent = av;
      el.addEventListener('click', () => {
        document.querySelectorAll('.avatar-opt').forEach(a => a.classList.remove('selected'));
        el.classList.add('selected');
        state.avatar = av;
      });
      grid.appendChild(el);
    });

    document.getElementById('enter-lobby-btn').addEventListener('click', () => {
      const uname = document.getElementById('username-input').value.trim();
      if (!uname) {
        toast('Please enter a username', 'error');
        return;
      }
      state.username = uname;
      SocketClient.connect(uname, state.avatar);
    });

    document.getElementById('username-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('enter-lobby-btn').click();
    });
  }

  // ── Toast Notifications ──────────────────────────────────────
  function toast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    initSetupScreen();
    showScreen('setup');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { state, showScreen, toast };
})();
