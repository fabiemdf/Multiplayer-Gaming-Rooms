/* ════════════════════════════════════════════════════════════════
   CHAT – Message rendering and emoji picker
   ════════════════════════════════════════════════════════════════ */

const Chat = (() => {
  const EMOJIS = ['😀','😂','🤣','😍','🥳','😎','🤔','😤','😠','😱','👍','👎','❤️','🔥','💯','🎉','🎮','🏆','⚔️','🛡️','💀','👻','🤖','🦁','🐉','⚡','✨','💎','🚀','🎯'];

  let emojiOpen = false;

  function init() {
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    const emojiBtn = document.getElementById('emoji-btn');
    const picker = document.getElementById('emoji-picker');

    // Populate emoji picker
    EMOJIS.forEach(em => {
      const btn = document.createElement('span');
      btn.className = 'emoji-btn-item';
      btn.textContent = em;
      btn.addEventListener('click', () => {
        chatInput.value += em;
        chatInput.focus();
      });
      picker.appendChild(btn);
    });

    sendBtn.addEventListener('click', sendMsg);
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });

    emojiBtn.addEventListener('click', () => {
      emojiOpen = !emojiOpen;
      picker.classList.toggle('hidden', !emojiOpen);
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', e => {
      if (!emojiBtn.contains(e.target) && !picker.contains(e.target)) {
        emojiOpen = false;
        picker.classList.add('hidden');
      }
    });
  }

  function sendMsg() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;
    SocketClient.sendMessage(content);
    input.value = '';
  }

  function addMessage(msg) {
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg';

    const isMe = msg.senderId === SocketClient.id;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `
      <span class="chat-msg-avatar">${escapeHtml(msg.senderAvatar)}</span>
      <div class="chat-msg-body">
        <div class="chat-msg-meta">
          <span class="chat-msg-name" style="${isMe ? 'color:var(--green)' : ''}">${escapeHtml(msg.senderName)}</span>
          <span class="chat-msg-time">${time}</span>
        </div>
        <div class="chat-msg-text">${escapeHtml(msg.content)}</div>
      </div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function addSystemMsg(text) {
    const container = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    el.innerHTML = `<div class="chat-msg-text">${escapeHtml(text)}</div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function clear() {
    document.getElementById('chat-messages').innerHTML = '';
  }

  function loadHistory(history) {
    clear();
    history.forEach(msg => addMessage(msg));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { init, addMessage, addSystemMsg, clear, loadHistory };
})();
