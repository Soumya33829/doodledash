import React, { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { Palette, Users, Trophy, Clock3, Pencil, Eraser, Undo2, Trash2, Send, Copy, DoorOpen, Sparkles, Crown, Volume2 } from 'lucide-react'

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || 'https://server-five-henna-66.vercel.app').replace(/\/$/, '')
const socket = io(SERVER_URL, { autoConnect: false, transports: ['polling', 'websocket'] })
const defaults = { maxPlayers: 8, rounds: 3, drawTime: 80, wordCount: 3, hints: 2, isPrivate: true }
const colors = ['#22223b','#f94144','#f3722c','#f9c74f','#90be6d','#43aa8b','#277da1','#577590','#9b5de5','#f15bb5','#ffffff']
const initials = n => (n || '?').trim().slice(0,1).toUpperCase()

export default function App() {
  const [connected, setConnected] = useState(socket.connected)
  const [screen, setScreen] = useState('home')
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [room, setRoom] = useState(null)
  const [me, setMe] = useState(null)
  const [settings, setSettings] = useState(defaults)
  const [wordOptions, setWordOptions] = useState([])
  const [secretWord, setSecretWord] = useState('')
  const [game, setGame] = useState(null)
  const [messages, setMessages] = useState([])
  const [guess, setGuess] = useState('')
  const [toast, setToast] = useState('')
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#22223b')
  const [size, setSize] = useState(5)
  const [timeLeft, setTimeLeft] = useState(0)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const chatEnd = useRef(null)
  const isDrawer = game?.drawerId === me?.id && game?.phase === 'drawing'

  const notify = useCallback((s) => { setToast(s); window.setTimeout(() => setToast(''), 2600) }, [])
  useEffect(() => {
    socket.connect()
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect)
    socket.on('room_state', data => { setRoom(data); setScreen(data.phase === 'lobby' ? 'lobby' : 'game'); if (data.strokes) setTimeout(() => redrawStrokes(data.strokes), 50) })
    socket.on('you_joined', data => { setMe(data.player); setRoom(data.room); setScreen(data.room.phase === 'lobby' ? 'lobby' : 'game'); if (data.room.strokes) setTimeout(() => redrawStrokes(data.room.strokes), 100) })
    socket.on('player_joined', data => { setRoom(data.room); addMessage({kind:'system', text:`${data.player.name} joined the room`}) })
    socket.on('player_left', data => { setRoom(data.room); addMessage({kind:'system', text:`${data.playerName} left the room`}) })
    socket.on('game_state', data => {
      setGame(data)
      setRoom(prev => ({ ...(prev || {}), phase: data.phase, round: data.round, totalRounds: data.totalRounds, drawerId: data.drawerId, hint: data.hint }))
      setScreen(data.phase === 'lobby' ? 'lobby' : 'game')
      setTimeLeft(data.timeLeft || 0)
      if (data.phase !== 'drawing') setSecretWord('')
    })
    socket.on('round_start', data => { setGame(g => ({...(g||{}), ...data})); setWordOptions(data.wordOptions || []); setSecretWord(''); setTimeLeft(data.drawTime); clearLocalCanvas() })
    socket.on('word_options', data => setWordOptions(data.options || []))
    socket.on('word_chosen', data => { setSecretWord(data.secretWord || ''); setWordOptions([]); setGame(g => ({...(g||{}), phase:'drawing', wordLength:data.wordLength, drawerId:data.drawerId, timeLeft:data.drawTime})); setTimeLeft(data.drawTime); clearLocalCanvas() })
    socket.on('draw_data', data => renderStroke(data))
    socket.on('canvas_cleared', clearLocalCanvas)
    socket.on('canvas_undone', data => redrawStrokes(data.strokes || []))
    socket.on('chat_message', data => addMessage(data))
    socket.on('guess_result', data => { if (data.correct) addMessage({kind:'correct', text:`${data.playerName} guessed the word! +${data.points} points`}); else if (data.text) addMessage({kind:'chat', playerName:data.playerName, text:data.text, playerId:data.playerId}) })
    socket.on('round_end', data => { setSecretWord(data.word || ''); setGame(g => ({...(g||{}), ...data, phase:'roundEnd'})); setTimeLeft(0); addMessage({kind:'system', text:`The word was “${data.word}”`}) })
    socket.on('game_over', data => { setGame(g => ({...(g||{}), ...data, phase:'gameOver'})); setScreen('game'); setTimeLeft(0) })
    socket.on('error_message', data => notify(data.message || 'Something went wrong'))
    socket.on('room_closed', () => { setRoom(null); setGame(null); setScreen('home'); notify('The room was closed by the host') })
    socket.on('hint_update', data => setGame(g => ({...(g||{}), hint:data.hint})))
    socket.on('timer', data => setTimeLeft(data.timeLeft))
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.disconnect() }
  }, [notify])
  useEffect(() => { chatEnd.current?.scrollIntoView({behavior:'smooth'}) }, [messages])
  const addMessage = m => setMessages(prev => [...prev.slice(-99), {...m, key:Date.now()+Math.random()}])
  const clearLocalCanvas = () => { const c=canvasRef.current; if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height)} }
  const redrawStrokes = strokes => { clearLocalCanvas(); strokes.forEach(renderStroke) }
  const renderStroke = stroke => {
    const c=canvasRef.current; if(!c || !stroke) return
    const ctx=c.getContext('2d'); const w=c.clientWidth || c.width; const h=c.clientHeight || c.height
    const x1=stroke.x1*w, y1=stroke.y1*h, x2=stroke.x2*w, y2=stroke.y2*h
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=stroke.color || '#22223b'
    ctx.lineWidth=stroke.size || 5; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke()
  }
  const joinRoom = (code) => {
    if (!name.trim()) { notify('Enter your player name first'); return }
    socket.emit('join_room', {roomId:code.trim().toUpperCase(), playerName:name.trim()})
  }
  const createRoom = () => {
    if (!name.trim()) { notify('Enter your player name first'); return }
    socket.emit('create_room', {hostName:name.trim(), settings})
  }
  const startGame = () => socket.emit('start_game')
  const chooseWord = word => { socket.emit('word_chosen', {word}); setWordOptions([]) }
  const sendGuess = e => { e?.preventDefault(); if (!guess.trim()) return; socket.emit('guess', {text:guess.trim()}); setGuess('') }
  const sendChat = e => { e?.preventDefault(); if (!guess.trim()) return; socket.emit('chat', {text:guess.trim()}); setGuess('') }
  const pointFromEvent = e => { const r=canvasRef.current.getBoundingClientRect(); return {x:(e.clientX-r.left)/r.width, y:(e.clientY-r.top)/r.height} }
  const pointerDown = e => {
    if (!isDrawer) return
    e.currentTarget.setPointerCapture(e.pointerId); drawing.current=true; last.current=pointFromEvent(e)
    socket.emit('draw_start', {...last.current, color:tool==='eraser'?'#ffffff':color, size:tool==='eraser'?22:size})
  }
  const pointerMove = e => {
    if (!drawing.current || !isDrawer || !last.current) return
    const p=pointFromEvent(e); const stroke={x1:last.current.x,y1:last.current.y,x2:p.x,y2:p.y,color:tool==='eraser'?'#ffffff':color,size:tool==='eraser'?22:size}
    renderStroke(stroke); socket.emit('draw_move', {x:p.x,y:p.y}); last.current=p
  }
  const pointerUp = () => { if(drawing.current){drawing.current=false;last.current=null;socket.emit('draw_end')} }
  const copyInvite = async () => { try { await navigator.clipboard.writeText(`${location.origin}/?room=${room?.id}`); setCopied(true); setTimeout(()=>setCopied(false),1800) } catch { notify(`Room code: ${room?.id}`) } }
  useEffect(() => { const c=new URLSearchParams(location.search).get('room'); if(c) setRoomCode(c.toUpperCase()) }, [])
  useEffect(() => { const c=canvasRef.current; if(c){ const resize=()=>{const old=c.toDataURL(); const w=c.clientWidth,h=c.clientHeight;c.width=w*devicePixelRatio;c.height=h*devicePixelRatio;const ctx=c.getContext('2d');ctx.scale(devicePixelRatio,devicePixelRatio);const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,w,h);img.src=old}; const ro=new ResizeObserver(resize);ro.observe(c);return()=>ro.disconnect()} }, [screen, room?.id])

  if (screen === 'home') return <main className="home">
    <nav className="topbar"><a className="brand" href="#"><span className="brand-icon"><Pencil size={20}/></span> DoodleDash</a><div className="status"><span className={connected?'dot':'dot offline'} />{connected?'Server connected':'Connecting to server…'}</div></nav>
    <section className="hero"><div className="eyebrow"><Sparkles size={15}/> THE ONLINE DRAWING PARTY</div><h1>Draw it.<br/><span>Guess it.</span> Win it.</h1><p className="hero-copy">A little creativity, a little chaos, and a lot of fun.<br/>Play drawing games with friends in real time.</p>
      <div className="join-card"><label htmlFor="playerName">YOUR PLAYER NAME</label><input id="playerName" value={name} maxLength={18} onChange={e=>setName(e.target.value)} placeholder="e.g. doodle_master" onKeyDown={e=>e.key==='Enter'&&createRoom()}/><button className="primary wide" onClick={createRoom}><Pencil size={17}/> Create a room</button><div className="or"><span/>OR<span/></div><div className="join-row"><input value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} placeholder="Enter room code" maxLength={6} onKeyDown={e=>e.key==='Enter'&&joinRoom(roomCode)}/><button className="secondary" onClick={()=>joinRoom(roomCode)} disabled={!roomCode.trim()}><DoorOpen size={16}/> Join</button></div>
      <div className="settings-mini"><div className="field"><label>ROUNDS</label><select value={settings.rounds} onChange={e=>setSettings({...settings,rounds:+e.target.value})}>{[2,3,4,5,6,7,8,9,10].map(n=><option key={n}>{n}</option>)}</select></div><div className="field"><label>DRAW TIME</label><select value={settings.drawTime} onChange={e=>setSettings({...settings,drawTime:+e.target.value})}>{[30,60,80,100,120,180,240].map(n=><option value={n} key={n}>{n}s</option>)}</select></div><div className="field"><label>WORDS</label><select value={settings.wordCount} onChange={e=>setSettings({...settings,wordCount:+e.target.value})}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></div></div><label className="checkline"><input type="checkbox" checked={settings.isPrivate} onChange={e=>setSettings({...settings,isPrivate:e.target.checked})}/> Private room — only friends with the code can join</label>
      </div>
      <div className="hero-stats"><div><Users size={17}/><b>2–20 players</b></div><div><Palette size={17}/><b>Live drawing</b></div><div><Trophy size={17}/><b>Friendly rivalry</b></div></div>
    </section><footer>Made for doodlers, daydreamers & terrible artists. <span>✦</span></footer>{toast&&<div className="toast">{toast}</div>}
  </main>

  if (screen === 'lobby') return <main className="app-shell"><header className="game-header"><a className="brand" href="#" onClick={e=>{e.preventDefault();socket.emit('leave_room');setScreen('home')}}><span className="brand-icon"><Pencil size={20}/></span>DoodleDash</a><div className="room-chip">ROOM <b>{room?.id}</b><button onClick={copyInvite} title="Copy invite"><Copy size={14}/></button></div><div className="status"><span className={connected?'dot':'dot offline'}/>{connected?'Connected':'Reconnecting'}</div></header><section className="lobby-layout"><div className="lobby-card"><div className="lobby-kicker"><Sparkles size={15}/> ROOM LOBBY</div><h1>Ready, set, <span>doodle!</span></h1><p>Invite your friends and get ready to guess.</p><div className="invite-box"><div><small>ROOM CODE</small><strong>{room?.id}</strong></div><button className="secondary" onClick={copyInvite}><Copy size={15}/>{copied?'Copied!':'Copy invite link'}</button></div><h3>Players <span className="count">{room?.players?.length||0}/{room?.settings?.maxPlayers||8}</span></h3><div className="player-grid">{(room?.players||[]).map((p,i)=><div className="player-tile" key={p.id}><div className={`avatar avatar-${i%6}`}>{initials(p.name)}</div><div><b>{p.name}{p.id===room?.hostId&&<Crown size={13} className="crown"/>}</b><small>{p.id===room?.hostId?'HOST':p.id===me?.id?'YOU':'PLAYER'}</small></div><span className="ready-dot"/></div>)}</div><div className="lobby-bottom">{room?.hostId===me?.id?<button className="primary wide" onClick={startGame} disabled={(room?.players?.length||0)<2}>Start game <span>→</span></button>:<div className="waiting"><span className="pulse"/> Waiting for the host to start the game…</div>}<small>{(room?.players?.length||0)<2?'At least 2 players are needed to start.':'Everyone is in. Let the doodling begin!'}</small></div></div><aside className="rules-card"><div className="rules-icon"><Trophy size={22}/></div><h3>How to play</h3><ol><li><span>01</span>One player gets a secret word and draws it.</li><li><span>02</span>Everyone else types their best guess.</li><li><span>03</span>Guess faster to earn more points.</li><li><span>04</span>Take turns drawing and climb the leaderboard.</li></ol><div className="rule-settings"><div><span>Rounds</span><b>{room?.settings?.rounds}</b></div><div><span>Draw time</span><b>{room?.settings?.drawTime}s</b></div><div><span>Word choices</span><b>{room?.settings?.wordCount}</b></div></div></aside></section>{toast&&<div className="toast">{toast}</div>}</main>

  return <main className="app-shell game-screen"><header className="game-header"><a className="brand" href="#" onClick={e=>{e.preventDefault();socket.emit('leave_room');setScreen('home')}}><span className="brand-icon"><Pencil size={20}/></span>DoodleDash</a><div className="round-chip">ROUND <b>{game?.round||1}</b><span>/ {game?.totalRounds||room?.settings?.rounds||3}</span></div><div className={`timer ${timeLeft<15?'urgent':''}`}><Clock3 size={17}/><b>{timeLeft}s</b></div><div className="room-chip">ROOM <b>{room?.id}</b><button onClick={copyInvite}><Copy size={14}/></button></div></header>
    <div className="game-layout"><aside className="side-panel players-panel"><div className="panel-heading"><Users size={17}/> PLAYERS <span>{room?.players?.length||0}</span></div><div className="score-list">{(room?.players||[]).slice().sort((a,b)=>(b.score||0)-(a.score||0)).map((p,i)=><div className={`score-player ${p.id===game?.drawerId?'drawing-player':''}`} key={p.id}><div className={`avatar avatar-${i%6}`}>{initials(p.name)}</div><div className="score-name"><b>{p.name}{p.id===me?.id?' (you)':''}</b><small>{p.id===game?.drawerId?'✏️ Drawing':p.guessed?'✓ Guessed':'Guessing'}</small></div><strong>{p.score||0}</strong></div>)}</div><div className="drawer-note"><span>✦</span><div><b>{game?.phase==='drawing'?(isDrawer?'Your turn to draw':`${room?.players?.find(p=>p.id===game?.drawerId)?.name||'Someone'} is drawing`):'Next up'}</b><small>{isDrawer?'Make it clear, make it fun!':'Type your guess in the chat'}</small></div></div></aside>
      <section className="board-section"><div className="word-banner">{isDrawer?<><span>YOUR WORD</span><strong>{secretWord||'Choose a word below'}</strong></>:<><span>GUESS THE WORD</span><strong className="masked">{game?.hint||Array.from({length:game?.wordLength||5},()=> '_').join(' ')}</strong></>}<small>{game?.phase==='roundEnd'?'Round complete!':game?.phase==='gameOver'?'Game complete!':isDrawer?'Draw clues, not letters!':'You got this!'}</small></div>
        {isDrawer&&wordOptions.length>0&&<div className="word-pick"><b>Pick a word to draw</b>{wordOptions.map(w=><button key={w} onClick={()=>chooseWord(w)}>{w}</button>)}</div>}
        {game?.phase==='gameOver'?<div className="end-overlay"><div className="trophy-big">🏆</div><h2>Game over!</h2><p>Winner: <b>{game?.winner?.name||'—'}</b></p><div className="final-scores">{(game?.leaderboard||[]).map((p,i)=><div key={p.id}><span>#{i+1}</span><b>{p.name}</b><strong>{p.score} pts</strong></div>)}</div><button className="primary" onClick={()=>{socket.emit('back_to_lobby');setMessages([])}}>Back to lobby</button></div>:game?.phase==='roundEnd'?<div className="round-overlay"><span>THE WORD WAS</span><h2>{game?.word||secretWord}</h2><p>Get ready for the next round…</p></div>:null}
        <div className="canvas-wrap"><canvas ref={canvasRef} className={!isDrawer?'readonly':''} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/>{!isDrawer&&game?.phase==='drawing'&&<div className="canvas-watermark">DoodleDash ✦</div>}</div>
        <div className={`toolbar ${!isDrawer?'toolbar-disabled':''}`}><div className="tool-buttons"><button className={tool==='pen'?'selected':''} onClick={()=>setTool('pen')} disabled={!isDrawer} title="Pen"><Pencil size={17}/></button><button className={tool==='eraser'?'selected':''} onClick={()=>setTool('eraser')} disabled={!isDrawer} title="Eraser"><Eraser size={17}/></button><button onClick={()=>socket.emit('draw_undo')} disabled={!isDrawer} title="Undo"><Undo2 size={17}/></button><button onClick={()=>socket.emit('canvas_clear')} disabled={!isDrawer} title="Clear canvas"><Trash2 size={17}/></button></div><div className="palette">{colors.map(c=><button key={c} aria-label={`Color ${c}`} className={`${color===c&&tool==='pen'?'active-color':''} ${c==='#ffffff'?'white-color':''}`} style={{background:c}} onClick={()=>{setColor(c);setTool('pen')}} disabled={!isDrawer}/>)}</div><div className="brush-size"><span>SIZE</span><input type="range" min="2" max="18" value={size} onChange={e=>setSize(+e.target.value)} disabled={!isDrawer}/></div></div>
      </section>
      <aside className="side-panel chat-panel"><div className="panel-heading"><span className="chat-dot"/> LIVE CHAT <span className="live-label">LIVE</span></div><div className="messages">{messages.map(m=><div key={m.key} className={`message ${m.kind||'chat'}`}>{m.kind==='system'?<i>{m.text}</i>:m.kind==='correct'?<div className="correct-message">✦ {m.text}</div>:<><b>{m.playerName||'Player'}</b><p>{m.text}</p></>}</div>)}<div ref={chatEnd}/></div><form className="chat-form" onSubmit={sendGuess}><input value={guess} onChange={e=>setGuess(e.target.value)} placeholder={isDrawer?'Chat with players…':'Type your guess…'} maxLength={120} disabled={game?.phase==='gameOver'}/><button aria-label="Send message" type="submit" disabled={!guess.trim()}><Send size={17}/></button></form><small className="chat-tip">{isDrawer?'You can chat while others guess.':'Correct guesses are checked automatically.'}</small></aside>
    </div>{toast&&<div className="toast">{toast}</div>}
  </main>
}