# DoodleDash — Skribbl.io Clone

A real-time multiplayer draw-and-guess game built to match the supplied intern assignment. Frontend: React + Vite + HTML Canvas. Backend: Node.js + Express + Socket.IO. The backend owns rooms, turns, words, hints, timers and scoring.

## Features
- Create a private room and join with a room code or invite URL
- Configurable player limit, rounds, drawing time, word choices and hints
- Lobby with host controls and live player list
- Drawer-only word choices; secret word is sent only to the drawer
- Live drawing with pen, colors, brush size, eraser, undo and clear
- Real-time guesses/chat, scoring, hint reveal, timer, leaderboard and winner
- Responsive layout for desktop and mobile

## Requirements
- Node.js 20 LTS or newer recommended
- npm
- Two browser windows/devices to test multiplayer

## Run locally
1. Install Node.js from https://nodejs.org/ if not installed.
2. Extract this ZIP and open a terminal in the extracted `skribbl-clone` folder.
3. Install root tools:
   ```bash
   npm install
   ```
4. Install client and server dependencies:
   ```bash
   npm --prefix client install
   npm --prefix server install
   ```
5. Create `server/.env` by copying `server/.env.example`. For local development keep:
   ```env
   PORT=3001
   CLIENT_ORIGIN=http://localhost:5173
   ```
6. Start frontend and backend together:
   ```bash
   npm run dev
   ```
7. Open http://localhost:5173. Use two separate browser windows; create a room in one and join using the room code in the other.

API health check: http://localhost:3001/health

## Deploy
Vercel hosts the Vite frontend; deploy the persistent Socket.IO server separately to Render or Railway. Vercel serverless functions are not suitable for this in-memory persistent WebSocket server.

### 1. Push to GitHub
Create an empty GitHub repository, then run from this project folder:
```bash
git init
git add .
git commit -m "Build DoodleDash multiplayer drawing game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```
Replace the remote URL with your own repository URL.

### 2. Deploy backend on Render
- Push the project to GitHub.
- In Render, create **New → Web Service** and select the repository.
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- Add environment variable `CLIENT_ORIGIN` = your Vercel URL (for example `https://your-app.vercel.app`). If you later use a custom domain, add it comma-separated.
- Deploy and copy the backend URL, e.g. `https://your-server.onrender.com`.
- Test `https://your-server.onrender.com/health`.

### 3. Deploy frontend on Vercel
- Import the same GitHub repository into Vercel.
- Root Directory: `client`
- Framework preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Add environment variable `VITE_SERVER_URL` = your deployed backend URL, e.g. `https://your-server.onrender.com` (no trailing slash).
- Deploy. After getting the final Vercel URL, update the backend `CLIENT_ORIGIN` to that exact URL and redeploy the backend.
- Test the live game with two browsers/devices. If using a Render free service, its first request may take a little time after sleeping.

## Important production notes
- This starter stores rooms and scores in server memory. Rooms disappear when the backend restarts and are not persisted to a database.
- Only share invite links with people you want in the room. This assignment clone is not a hardened public service; add rate limiting, moderation and stronger input validation before a broad public launch.
- The assignment lists public matchmaking, moderation, replay and multilingual word lists as optional/nice-to-have. This implementation focuses on the required private room/game loop and core drawing/chat/score features.
- Live URL: add your deployed Vercel URL here after deployment.

## Architecture
1. React creates Socket.IO connection to the Node server.
2. Socket events are validated by server-side room/game logic in `server/src/Room.js`.
3. Drawer stroke coordinates are normalized (0–1) so the canvas can render at different screen sizes. `draw_data` events are broadcast to everyone in the room.
4. Guess matching trims input, ignores case and punctuation, and compares the whole normalized word.
5. The server controls round progression and scoring; the browser never decides whether a guess is correct.

## Main Socket.IO events
`create_room`, `join_room`, `player_joined`, `player_left`, `start_game`, `round_start`, `word_options`, `word_chosen`, `draw_start`, `draw_move`, `draw_end`, `draw_data`, `canvas_clear`, `draw_undo`, `guess`, `guess_result`, `chat`, `chat_message`, `hint_update`, `timer`, `round_end`, `game_over`.

## Troubleshooting
- **Cannot connect:** ensure backend is running on port 3001 and frontend uses `http://localhost:3001`.
- **CORS error:** set `CLIENT_ORIGIN` to the exact frontend origin and restart backend.
- **Vercel deployed but room fails:** verify `VITE_SERVER_URL` is set to the Render/Railway backend URL, redeploy Vercel after changing environment variables, and check backend logs.
