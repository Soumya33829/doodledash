import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { Room } from './src/Room.js'

const app = express()
const server = http.createServer(app)
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim())
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json())
const io = new Server(server, { cors: { origin: allowedOrigins, methods: ['GET','POST'], credentials: true }, transports: ['websocket','polling'] })
const rooms = new Map()
const playerRoom = new Map()

app.get('/', (_req,res) => res.json({ name:'DoodleDash API', status:'ok', activeRooms:rooms.size }))
app.get('/health', (_req,res) => res.json({ status:'ok' }))

const publicRoom = room => room.toPublicJSON()
function emitRoom(room, event, data) { io.to(room.id).emit(event, data) }
function sendError(socket, message) { socket.emit('error_message', { message }) }
function leave(socket) {
  const id=playerRoom.get(socket.id); if(!id) return
  const room=rooms.get(id); playerRoom.delete(socket.id); socket.leave(id)
  if(!room) return
  const player=room.removePlayer(socket.id)
  if(player) emitRoom(room,'player_left',{playerName:player.name,playerId:player.id,room:publicRoom(room)})
  if(room.players.length===0){room.dispose();rooms.delete(id);return}
  if(room.hostId===socket.id) room.hostId=room.players[0].id
  if(room.phase!=='lobby' && room.players.length<2){room.finishGame();emitRoom(room,'game_over',{winner:room.players[0]||null,leaderboard:room.leaderboard()})}
  emitRoom(room,'room_state',publicRoom(room))
}
io.on('connection', socket => {
  socket.on('create_room', ({hostName,settings={}}={}) => {
    if(!hostName?.trim()) return sendError(socket,'Please enter a player name.')
    if(playerRoom.has(socket.id)) leave(socket)
    let id; do { id=Math.random().toString(36).slice(2,8).toUpperCase() } while(rooms.has(id))
    const room=new Room(id,socket.id,hostName.trim(),settings)
    room._io = io
    rooms.set(id,room); playerRoom.set(socket.id,id); socket.join(id)
    socket.emit('you_joined',{player:room.getPlayer(socket.id),room:publicRoom(room)})
  })
  socket.on('join_room', ({roomId,playerName}={}) => {
    if(!playerName?.trim()) return sendError(socket,'Please enter a player name.')
    const id=String(roomId||'').trim().toUpperCase(), room=rooms.get(id)
    if(!room) return sendError(socket,'Room not found. Check the code and try again.')
    if(room.phase!=='lobby') return sendError(socket,'This game has already started.')
    if(room.players.length>=room.settings.maxPlayers) return sendError(socket,'This room is full.')
    if(playerRoom.has(socket.id)) leave(socket)
    const player=room.addPlayer(socket.id,playerName.trim())
    playerRoom.set(socket.id,id);socket.join(id)
    socket.emit('you_joined',{player,room:publicRoom(room)})
    emitRoom(room,'player_joined',{player,room:publicRoom(room)})
  })
  socket.on('start_game', () => {
    const room=rooms.get(playerRoom.get(socket.id)); if(!room) return
    if(room.hostId!==socket.id) return sendError(socket,'Only the host can start the game.')
    if(room.players.length<2) return sendError(socket,'At least two players are needed.')
    room.startGame();
    emitRoom(room,'room_state',publicRoom(room))
    emitRoom(room,'game_state',room.gameStateFor(null))
    room.beginRound(io)
  })
  socket.on('word_chosen', ({word}={}) => {
    const room=rooms.get(playerRoom.get(socket.id)); if(!room) return
    const result=room.chooseWord(socket.id,word,io)
    if(!result) return sendError(socket,'That word is not available.')
  })
  socket.on('draw_start', data => { const r=rooms.get(playerRoom.get(socket.id)); if(r?.canDraw(socket.id)) r.startStroke(socket.id,data) })
  socket.on('draw_move', data => { const r=rooms.get(playerRoom.get(socket.id)); if(r?.canDraw(socket.id)) r.moveStroke(socket.id,data) })
  socket.on('draw_end', () => { const r=rooms.get(playerRoom.get(socket.id)); if(r?.canDraw(socket.id)) r.endStroke(socket.id) })
  socket.on('canvas_clear', () => { const r=rooms.get(playerRoom.get(socket.id)); if(r?.canDraw(socket.id)) {r.clearCanvas();emitRoom(r,'canvas_cleared',{})} })
  socket.on('draw_undo', () => { const r=rooms.get(playerRoom.get(socket.id)); if(r?.canDraw(socket.id)) {r.undo();emitRoom(r,'canvas_undone',{strokes:r.strokes})} })
  socket.on('guess', ({text}={}) => { const r=rooms.get(playerRoom.get(socket.id)); if(r) r.guess(socket.id,text,io) })
  socket.on('chat', ({text}={}) => { const r=rooms.get(playerRoom.get(socket.id)); if(r) r.chat(socket.id,text,io) })
  socket.on('back_to_lobby', () => { const r=rooms.get(playerRoom.get(socket.id)); if(r?.hostId===socket.id) {r.backToLobby();emitRoom(r,'room_state',publicRoom(r))} })
  socket.on('leave_room', () => leave(socket))
  socket.on('disconnect', () => leave(socket))
})
const port=Number(process.env.PORT||3001)
server.listen(port,'0.0.0.0',()=>console.log(`DoodleDash server listening on ${port}`))