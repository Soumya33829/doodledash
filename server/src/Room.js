const WORDS = ['airplane','apple','astronaut','avocado','backpack','balloon','banana','basketball','beach','bicycle','birthday','blender','book','bridge','butterfly','camera','campfire','candle','carrot','castle','cat','caterpillar','cheese','chicken','clock','cloud','computer','cookie','crown','dinosaur','dolphin','donut','dragon','drum','elephant','envelope','firefighter','fireworks','fish','flower','football','frog','guitar','hamburger','helicopter','ice cream','island','jellyfish','kangaroo','key','kite','ladder','lamp','lighthouse','lion','mermaid','microscope','moon','mountain','mushroom','octopus','pancake','penguin','piano','pizza','planet','popcorn','rainbow','robot','sandcastle','sandwich','shark','skateboard','snowman','spaceship','spider','starfish','strawberry','submarine','suitcase','sunflower','sunglasses','telescope','tiger','toothbrush','tornado','train','turtle','umbrella','volcano','watermelon','waterfall','whale','wizard','zebra']
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||min))
export class Room {
  constructor(id,hostId,hostName,settings={}) {
    this.id=id;this.hostId=hostId;this.players=[];this.phase='lobby';this.round=0;this.drawerIndex=-1;this.drawerId=null;this.word=null;this.wordOptions=[];this.hint='';this.strokes=[];this.currentStroke=null;this.guessed=new Set();this.timer=null;this.hintTimer=null;this.roundEndTimer=null;this.roundStartedAt=0;this.settings={maxPlayers:clamp(settings.maxPlayers,2,20),rounds:clamp(settings.rounds,2,10),drawTime:clamp(settings.drawTime,15,240),wordCount:clamp(settings.wordCount,1,5),hints:clamp(settings.hints,0,5),isPrivate:settings.isPrivate!==false}
    this.addPlayer(hostId,hostName)
  }
  addPlayer(id,name){const p={id,name:name.slice(0,18),score:0,guessed:false};this.players.push(p);return p}
  getPlayer(id){return this.players.find(p=>p.id===id)}
  removePlayer(id){const i=this.players.findIndex(p=>p.id===id);if(i<0)return null;const [p]=this.players.splice(i,1);if(i<=this.drawerIndex)this.drawerIndex--;if(this.drawerId===id&&this.phase==='drawing')this.endRound(null);return p}
  toPublicJSON(){return {id:this.id,hostId:this.hostId,players:this.players.map(p=>({...p})),phase:this.phase,settings:this.settings,round:this.round,totalRounds:this.settings.rounds,drawerId:this.drawerId,hint:this.hint,wordLength:this.word?.length||0,strokes:this.strokes}}
  gameStateFor(socketId){return {phase:this.phase,round:this.round,totalRounds:this.settings.rounds,drawerId:this.drawerId,wordLength:this.word?.length||0,hint:this.hint,timeLeft:this.phase==='drawing'?Math.max(0,Math.ceil((this.roundStartedAt+this.settings.drawTime*1000-Date.now())/1000)):0,strokes:this.strokes}}
  startGame(){this.players.forEach(p=>{p.score=0;p.guessed=false});this.round=0;this.drawerIndex=-1;this.phase='playing'}
  beginRound(io){
    this.clearTimers();if(this.players.length<2){this.finishGame();return}
    if(this.round>=this.settings.rounds){this.finishGame();io.to(this.id).emit('game_over',{winner:this.leaderboard()[0]||null,leaderboard:this.leaderboard()});return}
    this.round++;this.drawerIndex=(this.drawerIndex+1)%this.players.length;this.drawerId=this.players[this.drawerIndex].id;this.word=null;this.hint='';this.guessed.clear();this.strokes=[];this.currentStroke=null;this.players.forEach(p=>p.guessed=false);this.phase='choosing'
    const pool=[...WORDS].sort(()=>Math.random()-.5);this.wordOptions=pool.slice(0,this.settings.wordCount)
    io.to(this.id).emit('round_start',{round:this.round,totalRounds:this.settings.rounds,drawerId:this.drawerId,wordOptions:[],drawTime:this.settings.drawTime,wordLength:0})
    io.to(this.drawerId).emit('word_options',{options:this.wordOptions})
    io.to(this.id).emit('game_state',this.gameStateFor(null))
    this.chooseTimeout=setTimeout(()=>{if(this.phase==='choosing')this.chooseWord(this.drawerId,this.wordOptions[0],io)},20000)
  }
  chooseWord(playerId,word,io){
    if(playerId!==this.drawerId||this.phase!=='choosing'||!this.wordOptions.includes(String(word)))return false
    clearTimeout(this.chooseTimeout);this.word=String(word);this.wordOptions=[];this.phase='drawing';this.roundStartedAt=Date.now();this.hint=this.word.split('').map(c=>c===' '?' ':'_').join(' ')
    io.to(this.id).emit('word_chosen',{drawerId:this.drawerId,wordLength:this.word.length,drawTime:this.settings.drawTime})
    io.to(this.drawerId).emit('word_chosen',{drawerId:this.drawerId,secretWord:this.word,wordLength:this.word.length,drawTime:this.settings.drawTime})
    this.timer=setTimeout(()=>this.endRound(io),this.settings.drawTime*1000)
    if(this.settings.hints>0){for(let i=1;i<=this.settings.hints;i++){const delay=Math.floor(this.settings.drawTime*1000*(i/(this.settings.hints+1)));const t=setTimeout(()=>{if(this.phase==='drawing'&&this.word){this.revealHint();io.to(this.id).emit('hint_update',{hint:this.hint})}},delay);this.hintTimers??=[];this.hintTimers.push(t)}}
    this.tickTimer(io);return true
  }
  tickTimer(io){this.timerTick=setInterval(()=>{if(this.phase!=='drawing'){clearInterval(this.timerTick);return}const timeLeft=Math.max(0,Math.ceil((this.roundStartedAt+this.settings.drawTime*1000-Date.now())/1000));io.to(this.id).emit('timer',{timeLeft});if(timeLeft<=0)clearInterval(this.timerTick)},1000)}
  revealHint(){const letters=this.word.split('');const hidden=letters.map((c,i)=>c!==' '&&this.hint.split(' ')[i]==='_ '?i:-1).filter(i=>i>=0);const unrevealed=[];let pos=0;for(const c of letters){if(c!==' '&&this.hint.split(' ')[pos]==='_')unrevealed.push(pos);pos++}if(unrevealed.length){const idx=unrevealed[Math.floor(Math.random()*unrevealed.length)];let n=0;this.hint=letters.map(c=>{const v=n++;return c===' '? ' ':v===idx?c:(this.hint.split(' ')[v]||'_')}).join(' ')}}
  canDraw(id){return this.phase==='drawing'&&id===this.drawerId}
  startStroke(id,data){this.currentStroke={x1:Number(data.x)||0,y1:Number(data.y)||0,x2:Number(data.x)||0,y2:Number(data.y)||0,color:String(data.color||'#22223b').slice(0,20),size:clamp(data.size,1,30)};this.strokes.push(this.currentStroke);this.broadcastDraw('draw_data',this.currentStroke)}
  moveStroke(id,data){if(!this.currentStroke)return;this.currentStroke={...this.currentStroke,x1:this.currentStroke.x2,y1:this.currentStroke.y2,x2:clamp(data.x,0,1),y2:clamp(data.y,0,1)};this.strokes[this.strokes.length-1]=this.currentStroke;this.broadcastDraw('draw_data',this.currentStroke)}
  endStroke(){this.currentStroke=null}
  broadcastDraw(event,data){if(this.io){};this._io?.to(this.id).emit(event,data)}
  clearCanvas(){this.strokes=[];this.currentStroke=null}
  undo(){this.strokes.pop();this.currentStroke=null}
  guess(id,text,io){
    const p=this.getPlayer(id);if(!p||this.phase!=='drawing'||!String(text||'').trim())return
    const value=String(text).trim().slice(0,120)
    if(id===this.drawerId){this.chat(id,value,io);return}
    if(this.guessed.has(id)){this.chat(id,value,io);return}
    const correct=value.toLowerCase().replace(/[^a-z0-9]/g,'')===this.word.toLowerCase().replace(/[^a-z0-9]/g,'')
    if(correct){const remaining=Math.max(0,this.roundStartedAt+this.settings.drawTime*1000-Date.now());const points=Math.max(50,Math.round(500*remaining/(this.settings.drawTime*1000)));p.score+=points;p.guessed=true;this.guessed.add(id);const drawer=this.getPlayer(this.drawerId);if(drawer)drawer.score+=Math.max(10,Math.round(points*.25));io.to(this.id).emit('guess_result',{correct:true,playerId:id,playerName:p.name,points});io.to(this.id).emit('game_state',this.gameStateFor(null));if(this.guessed.size>=this.players.length-1)this.endRound(io)}
    else {io.to(this.id).emit('guess_result',{correct:false,playerId:id,playerName:p.name,text:value})}
  }
  chat(id,text,io){const p=this.getPlayer(id);const value=String(text||'').trim().slice(0,120);if(!p||!value)return;io.to(this.id).emit('chat_message',{playerId:id,playerName:p.name,text:value})}
  endRound(io){if(this.phase!=='drawing'&&this.phase!=='choosing')return;this.clearTimers();this.phase='roundEnd';const word=this.word||'';if(io)io.to(this.id).emit('round_end',{word,scores:this.leaderboard(),nextDrawer:this.players[(this.drawerIndex+1)%Math.max(1,this.players.length)]?.id});if(io)this.roundEndTimer=setTimeout(()=>this.beginRound(io),3500)}
  leaderboard(){return [...this.players].sort((a,b)=>b.score-a.score).map(p=>({...p}))}
  finishGame(){this.clearTimers();this.phase='gameOver';this.word=null}
  backToLobby(){this.clearTimers();this.phase='lobby';this.round=0;this.drawerIndex=-1;this.drawerId=null;this.word=null;this.players.forEach(p=>{p.score=0;p.guessed=false});this.strokes=[]}
  clearTimers(){clearTimeout(this.timer);clearTimeout(this.chooseTimeout);clearTimeout(this.roundEndTimer);clearInterval(this.timerTick);(this.hintTimers||[]).forEach(clearTimeout);this.hintTimers=[]}
  dispose(){this.clearTimers()}
}