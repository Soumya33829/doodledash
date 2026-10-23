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

