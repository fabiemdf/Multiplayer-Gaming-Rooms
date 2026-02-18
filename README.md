# 🎮 Multiplayer Gaming Rooms

A real-time multiplayer gaming hub featuring **chat**, **video calls**, and **4 classic games** across skill levels — built with Node.js, Socket.IO, and WebRTC.

---

## Features

### 🏠 Lobby
- Browse all public game rooms with live player counts
- Filter by game type and skill level
- Search rooms by name
- Create public or private (password-protected) rooms

### 🎲 Games
| Game | Players | Levels |
|------|---------|--------|
| Tic-Tac-Toe | 2 | Beginner → Advanced |
| Connect 4 | 2 | Beginner → Advanced |
| Chess | 2 | Beginner → Advanced |
| Checkers | 2 | Beginner → Advanced |

**Chess** features: full move validation, check/checkmate/stalemate detection, castling, en passant, pawn promotion, move history, captured pieces display.

**Checkers** features: mandatory capture rule, king promotion, valid move highlighting.

### 💬 Chat
- Real-time room chat via Socket.IO
- Emoji picker with 30+ emojis
- Message history (last 200 messages)

### 📹 Video Call (WebRTC)
- Peer-to-peer video using WebRTC (no server relay needed)
- Toggle camera & microphone
- Automatic peer discovery within the room
- Works with STUN servers for NAT traversal

### 🎮 Room Features
- Ready-up system (auto-starts when all players ready)
- Spectator mode (join full/in-progress rooms)
- Resign and rematch options
- Game abort on player disconnect

---

## Tech Stack

- **Backend**: Node.js · Express · Socket.IO · UUID
- **Frontend**: Vanilla JS (no build step) · CSS3
- **Video**: WebRTC (mesh topology) · Google STUN servers
- **Fonts**: Google Fonts (Inter, Orbitron)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the server (production)
npm start

# Start with hot reload (development)
npm run dev
```

Then open **http://localhost:3000** in your browser.

For video calls, HTTPS is required in production (WebRTC requirement). In development, `localhost` works without HTTPS.

---

## Project Structure

```
├── server.js              # Express + Socket.IO server, all game logic
├── public/
│   ├── index.html         # Single-page app entry point
│   ├── css/
│   │   └── main.css       # Dark gaming theme stylesheet
│   └── js/
│       ├── main.js        # App state & screen management
│       ├── socket-client.js  # Socket.IO client & event handlers
│       ├── lobby.js       # Room listing & filtering
│       ├── room.js        # In-room UI, player list, game wiring
│       ├── chat.js        # Chat component
│       ├── video.js       # WebRTC video manager
│       └── games/
│           ├── tictactoe.js
│           ├── connect4.js
│           ├── chess.js   # Full interactive chess with highlights
│           └── checkers.js
└── package.json
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | HTTP server port |

---

## License

MIT
