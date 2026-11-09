// Dedicated authoritative rooms + public five-player lobby.
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoomEngine } from './headless-engine.js';
import { makeMatchStore, buildMatchResult, buildFloorProgress } from './match-store.js';
import { makeProfileStore,validProfileKey } from './profile-store.js';

const PORT=Number(process.env.PORT||3001);
const HOST=process.env.HOST||'0.0.0.0';
const MAX_ROOMS=16, MAX_PLAYERS=5, MAX_SPECTATORS=24;
const RECONNECT_GRACE_MS=90000;
const CHAT_HISTORY_LIMIT=50,CHAT_MAX_LENGTH=240,CHAT_MIN_INTERVAL_MS=850;
const CHAT_BURST_WINDOW_MS=10000,CHAT_BURST_LIMIT=6;
const QUICK_MESSAGES=new Set(['Help!','Follow!','Relay on!','Hollow!','Healing!','Elevator!']);
const rooms=new Map(),lobbyClients=new Set();
const matchStore=makeMatchStore();
const profileStore=makeProfileStore();
const MIME={'/':'text/html; charset=utf-8','/play':'text/html; charset=utf-8','/play/':'text/html; charset=utf-8','/game.js':'text/javascript; charset=utf-8',
  '/style.css':'text/css; charset=utf-8','/favicon.svg':'image/svg+xml'};
const FILE={'/':'index.html','/play':'index.html','/play/':'index.html','/game.js':'game.js','/style.css':'style.css','/favicon.svg':'favicon.svg'};
const send=(ws,m)=>{
  if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<192000)
    ws.send(JSON.stringify(m));
};
const safeKeys=input=>Object.fromEntries(['up','down','left','right'].map(k=>[k,input?.[k]===true]));
const safeStick=input=>({
  x:Number.isFinite(input?.x)?Math.max(-1,Math.min(1,input.x)):0,
  y:Number.isFinite(input?.y)?Math.max(-1,Math.min(1,input.y)):0
});
const safeDirection=input=>Number.isFinite(input?.x)&&Number.isFinite(input?.y)
  ?{x:Math.max(-1,Math.min(1,input.x)),y:Math.max(-1,Math.min(1,input.y))}:null;
const safeRoomName=input=>typeof input==='string'
  ?input.replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,32)||'Hollow Ward': 'Hollow Ward';
const safeNickname=(input,id)=>{
  const clean=typeof input==='string'
    ?input.replace(/[<>\u0000-\u001f\u007f]/g,'').trim().slice(0,20):'';
  return clean||'Survivor '+id;
};
const cleanChatText=input=>typeof input==='string'
  ?input.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim()
  : '';
function sendChatHistory(room,ws){
  send(ws,{type:'chat-history',messages:room.chatHistory});
}
function receiveChat(room,ws,input){
  if(room.clients.get(ws.playerId)!==ws)return;
  const text=cleanChatText(input.text);
  if(!text||text.length>CHAT_MAX_LENGTH){
    send(ws,{type:'chat-error',message:'Message must be 1–240 characters.'});return;
  }
  if(input.quick===true&&!QUICK_MESSAGES.has(text)){
    send(ws,{type:'chat-error',message:'Invalid quick message.'});return;
  }
  const now=Date.now();
  const recent=Array.isArray(ws.chatTimes)?ws.chatTimes.filter(t=>now-t<CHAT_BURST_WINDOW_MS):[];
  if(now-(ws.lastChatAt||0)<CHAT_MIN_INTERVAL_MS||recent.length>=CHAT_BURST_LIMIT){
    send(ws,{type:'chat-error',message:'Slow down — wait before sending another message.'});return;
  }
  ws.chatTimes=[...recent,now];ws.lastChatAt=now;
  const message={id:++room.chatSerial,playerId:ws.playerId,
    name:room.members.get(ws.playerId)?.name||safeNickname(ws.nickname,ws.playerId),
    text,at:now,quick:input.quick===true};
  room.chatHistory.push(message);
  if(room.chatHistory.length>CHAT_HISTORY_LIMIT)room.chatHistory.shift();
  for(const client of room.clients.values())send(client,{type:'chat-message',message});
}
function postSystemChat(room,text){
  const message={id:++room.chatSerial,playerId:0,name:'SYSTEM',text,at:Date.now(),quick:false};
  room.chatHistory.push(message);
  if(room.chatHistory.length>CHAT_HISTORY_LIMIT)room.chatHistory.shift();
  for(const ws of [...room.clients.values(),...room.spectators])
    send(ws,{type:'chat-message',message});
}
function syncCountdownChat(room){
  const snapshot=room.engine.snapshot(false);
  if(snapshot.state==='countdown'){
    const number=Math.max(1,Math.min(5,Math.ceil(snapshot.countdownRemaining||0)));
    if(room.chatCountdown!==number){
      const first=room.chatCountdown===null?5:room.chatCountdown-1;
      for(let n=first;n>=number;n--)postSystemChat(room,'GAME STARTS IN '+n+'…');
      room.chatCountdown=number;
    }
  }else if(room.chatCountdown!==null){
    if(snapshot.state==='playing')postSystemChat(room,'GAME START!');
    room.chatCountdown=null;
  }
}
function makeCode(){
  let value;
  do{value=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(value));
  return value;
}
function listRooms(){
  return [...rooms.values()].map(room=>({
    code:room.code,name:room.name,players:room.clients.size,
    spectators:room.spectators.size,
    capacity:MAX_PLAYERS,status:room.started?'in-progress':'waiting',
    joinable:room.started?room.spectators.size<MAX_SPECTATORS:room.members.size<MAX_PLAYERS,
    spectatorOnly:room.started
  })).sort((a,b)=>Number(b.status==='waiting')-Number(a.status==='waiting'));
}
function broadcastLobby(){
  const msg={type:'rooms',rooms:listRooms()};
  for(const client of lobbyClients)send(client,msg);
}
function publish(room,full=false){
  // A single authoritative snapshot is identical for every room participant.
  // Serialize once instead of repeating expensive JSON work up to 29 times
  // for five players and 24 spectators. Skip a congested socket rather than
  // queue old positions that would turn into visible movement lag.
  const packet=JSON.stringify({type:'snapshot',snapshot:room.engine.snapshot(full)});
  for(const ws of [...room.clients.values(),...room.spectators]){
    if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<96000)
      ws.send(packet);
  }
}
function notifyRoom(room){
  const roles=room.engine.snapshot(false).playerRoles;
  const players=[...room.clients.entries()].map(([id,ws])=>({
    id,name:ws.nickname||'Survivor '+id,role:roles[id-1]||'scout',
    host:id===room.hostId
  })).sort((a,b)=>a.id-b.id);
  const update={type:'roster',count:room.clients.size,
    capacity:MAX_PLAYERS,hostId:room.hostId,players};
  for(const ws of room.clients.values())send(ws,update);
  for(const ws of room.spectators)send(ws,update);
  broadcastLobby();
}
function publishFloorProgress(room){
  if(!room.started)return;
  const progress=buildFloorProgress(room);
  if(!progress||progress.floorsCleared<=room.progressLastFloor)return;
  room.progressLastFloor=progress.floorsCleared;
  for(const ws of room.clients.values()){
    send(ws,progress);
    if(progress.eligible&&ws.profileKey)
      void profileStore.award(ws.profileKey,{eventId:room.matchId+':'+ws.playerId+':floor:'+progress.floorsCleared,
        floorsCleared:progress.floorsCleared,achievements:progress.achievements});
  }
}
function persistCompletedMatch(room){
  const result=buildMatchResult(room);
  if(!result)return;
  // Player progression stays available even without DATABASE_URL. Each
  // browser stores only its own run result; public rankings use PostgreSQL.
  if(!room.matchAnnounced){
    room.matchAnnounced=true;
    for(const [slot,ws] of room.clients){
      send(ws,{type:'match-result',result:{
        floorsCleared:result.floorsCleared,outcome:result.outcome,
        elapsedSeconds:result.elapsedSeconds,
        competitive:result.competitive,eligible:!room.unranked,
        achievements:result.achievements,slot
      }});
      if(!room.unranked&&ws.profileKey)
        void profileStore.award(ws.profileKey,{eventId:room.matchId+':'+slot+':final',
          floorsCleared:result.floorsCleared,achievements:result.achievements,
          finished:true,winTime:result.competitive?result.elapsedSeconds:null});
    }
  }
  if(!matchStore.enabled||room.matchRecorded||room.matchRecording||
    Date.now()<(room.matchRetryAt||0))return;
  room.matchRecording=true;
  void matchStore.save(result).then(saved=>{
    if(saved)room.matchRecorded=true;
    else room.matchRetryAt=Date.now()+30000;
  }).finally(()=>{room.matchRecording=false;});
}
function createRoom(name){
  const room={code:makeCode(),name:safeRoomName(name),engine:createRoomEngine(),
    clients:new Map(),members:new Map(),spectators:new Set(),started:false,hostId:1,ticks:0,
    chatHistory:[],chatSerial:0,chatCountdown:null,
    matchId:randomUUID(),matchRecorded:false,matchRecording:false,matchRetryAt:0,matchAnnounced:false,progressLastFloor:0,unranked:false};
  rooms.set(room.code,room);
  let last=performance.now();
  room.timer=setInterval(()=>{
    const now=performance.now(),dt=Math.min(.05,(now-last)/1000);
    last=now;
    try{
      if(!room.clients.size)return;
      room.engine.tick(dt);
      syncCountdownChat(room);
      publishFloorProgress(room);
      persistCompletedMatch(room);
      if(++room.ticks%2===0)publish(room,room.ticks%150===0);
    }catch(error){
      console.error('Room simulation failed',room.code,error);
      for(const ws of [...room.clients.values(),...room.spectators]){
        send(ws,{type:'error',message:'Room simulation stopped'});
        ws.room=null;ws.playerId=null;ws.isSpectator=false;
      }
      for(const member of room.members.values())clearTimeout(member.timer);
      clearInterval(room.timer);rooms.delete(room.code);broadcastLobby();
    }
  },33);
  return room;
}
function destroyRoom(room){
  for(const member of room.members.values())clearTimeout(member.timer);
  for(const ws of room.spectators){
    send(ws,{type:'left',message:'The room has closed.'});
    ws.room=null;ws.playerId=null;ws.isSpectator=false;
  }
  room.spectators.clear();
  clearInterval(room.timer);rooms.delete(room.code);broadcastLobby();
}
function expireMember(room,id){
  const member=room.members.get(id);
  if(!member||room.clients.has(id))return;
  room.members.delete(id);room.engine.leave(id);
  if(room.hostId===id)
    room.hostId=room.clients.keys().next().value||room.members.keys().next().value||1;
  if(!room.members.size)destroyRoom(room);
  else notifyRoom(room);
}
function joinSpectator(ws,room){
  if(ws.room)return send(ws,{type:'error',message:'Leave your current room first'});
  if(!room)return send(ws,{type:'error',message:'Room not found'});
  if(room.spectators.size>=MAX_SPECTATORS)
    return send(ws,{type:'error',message:'Spectator seats are full'});
  ws.room=room;ws.playerId=null;ws.isSpectator=true;
  room.spectators.add(ws);
  send(ws,{type:'spectator-joined',code:room.code,name:room.name});
  sendChatHistory(room,ws);
  notifyRoom(room);publish(room,true);
}
function join(ws,room){
  if(ws.room)return send(ws,{type:'error',message:'Leave your current room first'});
  if(!room)return send(ws,{type:'error',message:'Room not found'});
  // After first start, every new arrival is a spectator, even a former player.
  if(room.started)return joinSpectator(ws,room);
  if(room.members.size>=MAX_PLAYERS)return send(ws,{type:'error',message:'Room is full'});
  const id=[1,2,3,4,5].find(id=>!room.members.has(id));
  if(!id)return send(ws,{type:'error',message:'Room is full'});
  const token=randomBytes(32).toString('hex');
  ws.nickname=safeNickname(ws.pendingNickname,id);
  room.members.set(id,{token,name:ws.nickname,timer:null});
  room.clients.set(id,ws);ws.room=room;ws.playerId=id;ws.isSpectator=false;
  if(id===1&&room.members.size>1)room.engine.rejoinHost();
  else if(id!==1)room.engine.join(id);
  if(room.members.size===1)room.hostId=id;
  send(ws,{type:'joined',code:room.code,name:room.name,id,
    host:id===room.hostId,nickname:ws.nickname,reconnectToken:token,resumed:false});
  sendChatHistory(room,ws);
  notifyRoom(room);publish(room,true);
}
function resume(ws,code,token){
  if(ws.room)return send(ws,{type:'error',message:'Already in a room'});
  if(typeof code!=='string'||!/^[0-9A-F]{6}$/.test(code)||
    typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))
    return send(ws,{type:'resume-error',message:'Invalid reconnect session'});
  const room=rooms.get(code);
  const match=room&&[...room.members.entries()]
    .find(([,member])=>member.token===token);
  if(!match)return send(ws,{type:'resume-error',message:'Session expired or game server restarted'});
  const [id,member]=match;
  clearTimeout(member.timer);member.timer=null;
  const previous=room.clients.get(id);
  if(previous&&previous!==ws){
    previous.room=null;previous.playerId=null;
    previous.close(4000,'Session resumed elsewhere');
  }
  ws.nickname=member.name;
  room.clients.set(id,ws);ws.room=room;ws.playerId=id;ws.isSpectator=false;
  if(!room.engine.resume(id)){
    room.clients.delete(id);ws.room=null;ws.playerId=null;
    expireMember(room,id);
    return send(ws,{type:'resume-error',message:'Character is no longer available'});
  }
  member.token=randomBytes(32).toString('hex');
  send(ws,{type:'joined',code:room.code,name:room.name,id,
    host:id===room.hostId,nickname:ws.nickname,reconnectToken:member.token,resumed:true});
  sendChatHistory(room,ws);
  notifyRoom(room);publish(room,true);
}
function leave(ws,temporary=false){
  const room=ws.room;
  if(!room)return;
  if(ws.isSpectator){
    room.spectators.delete(ws);
    ws.room=null;ws.playerId=null;ws.isSpectator=false;
    if(!temporary)send(ws,{type:'left'});
    notifyRoom(room);
    return;
  }
  if(room.clients.get(ws.playerId)!==ws)return;
  const id=ws.playerId;
  ws.room=null;ws.playerId=null;
  room.clients.delete(id);
  const member=room.members.get(id);
  if(temporary&&member){
    room.engine.suspend(id);
    member.timer=setTimeout(()=>expireMember(room,id),RECONNECT_GRACE_MS);
    member.timer.unref?.();
  }else{
    if(member)clearTimeout(member.timer);
    room.members.delete(id);room.engine.leave(id);
    send(ws,{type:'left'});
  }
  if(id===room.hostId&&room.clients.size)
    room.hostId=room.clients.keys().next().value;
  else if(id===room.hostId&&!room.members.has(id))
    room.hostId=room.clients.keys().next().value||room.members.keys().next().value||1;
  if(!room.members.size)destroyRoom(room);
  else{notifyRoom(room);publish(room,true);}
}
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/health'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({status:'ok',authority:'server',rooms:rooms.size,
      maxPlayers:MAX_PLAYERS,lobby:true}));return;
  }
  if(pathname==='/api/leaderboard'&&req.method==='GET'){
    const result=await matchStore.leaderboard();
    res.writeHead(result.available?200:503,{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(result));return;
  }
  const file=FILE[pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{
    const data=await readFile(new URL(file,import.meta.url));
    res.writeHead(200,{'content-type':MIME[pathname],'cache-control':'no-store',
      'x-content-type-options':'nosniff'});res.end(data);
  }catch{res.writeHead(500);res.end('Asset error');}
});
const wss=new WebSocketServer({server,maxPayload:32768});
wss.on('connection',(ws,req)=>{
  const origin=req.headers.origin;
  try{
    if(origin&&new URL(origin).host!==req.headers.host)
      return ws.close(1008,'Origin invalid');
  }catch{return ws.close(1008,'Origin invalid');}
  lobbyClients.add(ws);send(ws,{type:'rooms',rooms:listRooms()});
  let lastInputAt=0;
  ws.on('message',raw=>{
    if(raw.length>16000)return;
    let m;try{m=JSON.parse(raw.toString());}catch{return;}
    if(!m||typeof m.type!=='string')return;
    if(m.type==='ping'&&Number.isFinite(m.at))
      return send(ws,{type:'pong',at:m.at});
    if(m.type==='list')return send(ws,{type:'rooms',rooms:listRooms()});
    if(m.type==='profile-key'){
      if(!validProfileKey(m.key))return send(ws,{type:'profile-error',message:'Invalid recovery key.'});
      ws.profileKey=m.key;
      // Never send the secret back in a server response or room broadcast.
      void profileStore.read(m.key).then(data=>send(ws,{
        type:'profile-data',available:data.available,progress:data.progress}));
      return;
    }
    if(m.type==='resume')return resume(ws,m.code,m.token);
    if(m.type==='create'){
      if(ws.room)return send(ws,{type:'error',message:'Leave your current room first'});
      if(rooms.size>=MAX_ROOMS)return send(ws,{type:'error',message:'All room slots are occupied'});
      ws.pendingNickname=m.nickname;
      return join(ws,createRoom(m.name));
    }
    if(m.type==='join'){
      if(typeof m.code!=='string'||!/^[0-9A-F]{6}$/.test(m.code))
        return send(ws,{type:'error',message:'Invalid room code'});
      ws.pendingNickname=m.nickname;
      return join(ws,rooms.get(m.code));
    }
    if(m.type==='leave')return leave(ws);
    const room=ws.room,id=ws.playerId;
    if(!room)return;
    if(ws.isSpectator)return; // Read-only: no character commands, chat, or host controls.
    if(m.type==='chat')return receiveChat(room,ws,m);
    if(m.type==='input'){
      const now=Date.now();
      if(now-lastInputAt<20)return;
      lastInputAt=now;
      room.engine.input(id,safeKeys(m.keys),safeStick(m.joystick));
    }else if(m.type==='action'&&['dash','interact','decoy','ability'].includes(m.name))
      room.engine.action(id,m.name,safeDirection(m.direction),m.name==='dash'&&m.touch===true,
         m.name==='ability'&&m.target&&typeof m.target==='object'&&(
           (m.target.kind==='player'&&Number.isInteger(m.target.slot)&&m.target.slot>=1&&m.target.slot<=5)||
           (m.target.kind==='hollow'&&Number.isInteger(m.target.index)&&m.target.index>=0&&m.target.index<100)
         )?{kind:m.target.kind,...(m.target.kind==='player'?{slot:m.target.slot}:{index:m.target.index})}:null);
    else if(m.type==='role'&&['scout','medic','invisibler','teleporter','illusioner','rewinder','anchor','infester'].includes(m.role)){
      if(['menu','dead','victory'].includes(room.engine.status())){
        room.engine.role(id,m.role);
        notifyRoom(room);
      }
    }else if(m.type==='profile'){
      ws.nickname=safeNickname(m.nickname,id);
      const member=room.members.get(id);
      if(member)member.name=ws.nickname;
      notifyRoom(room);
    }else if(id===room.hostId){
      if(m.type==='start'){
        const previous=room.engine.status();
        room.engine.start();
        if(room.engine.status()==='countdown'&&previous!=='countdown'){
          room.started=true;
          room.chatCountdown=null;
          syncCountdownChat(room);
          room.matchId=randomUUID();room.matchRecorded=false;room.matchRetryAt=0;room.matchAnnounced=false;room.progressLastFloor=0;room.unranked=false;
        }
        publish(room,true);broadcastLobby();
      }
      else if(m.type==='next'){room.engine.next();publish(room,true);broadcastLobby();}
      else if(m.type==='restart'){room.engine.restart();publish(room,true);}
      else if(m.type==='skip'){room.unranked=true;room.engine.skip(m.fullStage===true);publish(room,true);}
      else if(m.type==='pause'){room.engine.pause();publish(room,true);}
    }
  });
  ws.on('close',()=>{lobbyClients.delete(ws);leave(ws,true);});
  ws.on('error',()=>{lobbyClients.delete(ws);leave(ws,true);});
});
server.listen(PORT,HOST,()=>console.log('Last Light lobby: '+MAX_PLAYERS+' players/room on '+HOST+':'+PORT));
