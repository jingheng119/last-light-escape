// Dedicated authoritative rooms + public five-player lobby.
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoomEngine } from './headless-engine.js';
import { makeMatchStore, buildMatchResult } from './match-store.js';

const PORT=Number(process.env.PORT||3001);
const HOST=process.env.HOST||'0.0.0.0';
const MAX_ROOMS=16, MAX_PLAYERS=5;
const RECONNECT_GRACE_MS=90000;
const rooms=new Map(),lobbyClients=new Set();
const matchStore=makeMatchStore();
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
function makeCode(){
  let value;
  do{value=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(value));
  return value;
}
function listRooms(){
  return [...rooms.values()].map(room=>({
    code:room.code,name:room.name,players:room.clients.size,
    capacity:MAX_PLAYERS,status:room.engine.status()==='menu'?'waiting':'in-progress',
    joinable:room.members.size<MAX_PLAYERS
  })).sort((a,b)=>Number(b.status==='waiting')-Number(a.status==='waiting'));
}
function broadcastLobby(){
  const msg={type:'rooms',rooms:listRooms()};
  for(const client of lobbyClients)send(client,msg);
}
function publish(room,full=false){
  const snapshot=room.engine.snapshot(full);
  for(const ws of room.clients.values())send(ws,{type:'snapshot',snapshot});
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
  broadcastLobby();
}
function persistCompletedMatch(room){
  if(!matchStore.enabled||room.matchRecorded||room.matchRecording||
    Date.now()<(room.matchRetryAt||0))return;
  const result=buildMatchResult(room);
  if(!result)return;
  room.matchRecording=true;
  void matchStore.save(result).then(saved=>{
    if(saved)room.matchRecorded=true;
    else room.matchRetryAt=Date.now()+30000;
  }).finally(()=>{room.matchRecording=false;});
}
function createRoom(name){
  const room={code:makeCode(),name:safeRoomName(name),engine:createRoomEngine(),
    clients:new Map(),members:new Map(),hostId:1,ticks:0,
    matchId:randomUUID(),matchRecorded:false,matchRecording:false,matchRetryAt:0};
  rooms.set(room.code,room);
  let last=performance.now();
  room.timer=setInterval(()=>{
    const now=performance.now(),dt=Math.min(.05,(now-last)/1000);
    last=now;
    try{
      if(!room.clients.size)return;
      room.engine.tick(dt);
      persistCompletedMatch(room);
      if(++room.ticks%2===0)publish(room,room.ticks%150===0);
    }catch(error){
      console.error('Room simulation failed',room.code,error);
      for(const ws of room.clients.values()){
        send(ws,{type:'error',message:'Room simulation stopped'});
        ws.room=null;ws.playerId=null;
      }
      for(const member of room.members.values())clearTimeout(member.timer);
      clearInterval(room.timer);rooms.delete(room.code);broadcastLobby();
    }
  },33);
  return room;
}
function destroyRoom(room){
  for(const member of room.members.values())clearTimeout(member.timer);
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
function join(ws,room){
  if(ws.room)return send(ws,{type:'error',message:'Leave your current room first'});
  if(!room)return send(ws,{type:'error',message:'Room not found'});
  if(room.members.size>=MAX_PLAYERS)return send(ws,{type:'error',message:'Room is full'});
  const id=[1,2,3,4,5].find(id=>!room.members.has(id));
  if(!id)return send(ws,{type:'error',message:'Room is full'});
  const token=randomBytes(32).toString('hex');
  ws.nickname=safeNickname(ws.pendingNickname,id);
  room.members.set(id,{token,name:ws.nickname,timer:null});
  room.clients.set(id,ws);ws.room=room;ws.playerId=id;
  if(id===1&&room.members.size>1)room.engine.rejoinHost();
  else if(id!==1)room.engine.join(id);
  if(room.members.size===1)room.hostId=id;
  send(ws,{type:'joined',code:room.code,name:room.name,id,
    host:id===room.hostId,nickname:ws.nickname,reconnectToken:token,resumed:false});
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
  room.clients.set(id,ws);ws.room=room;ws.playerId=id;
  if(!room.engine.resume(id)){
    room.clients.delete(id);ws.room=null;ws.playerId=null;
    expireMember(room,id);
    return send(ws,{type:'resume-error',message:'Character is no longer available'});
  }
  member.token=randomBytes(32).toString('hex');
  send(ws,{type:'joined',code:room.code,name:room.name,id,
    host:id===room.hostId,nickname:ws.nickname,reconnectToken:member.token,resumed:true});
  notifyRoom(room);publish(room,true);
}
function leave(ws,temporary=false){
  const room=ws.room;
  if(!room||room.clients.get(ws.playerId)!==ws)return;
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
    if(m.type==='input'){
      const now=Date.now();
      if(now-lastInputAt<20)return;
      lastInputAt=now;
      room.engine.input(id,safeKeys(m.keys),safeStick(m.joystick));
    }else if(m.type==='action'&&['dash','interact','decoy','ability'].includes(m.name))
      room.engine.action(id,m.name,safeDirection(m.direction));
    else if(m.type==='role'&&['scout','medic'].includes(m.role)){
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
          room.matchId=randomUUID();room.matchRecorded=false;room.matchRetryAt=0;
        }
        publish(room,true);broadcastLobby();
      }
      else if(m.type==='next'){room.engine.next();publish(room,true);broadcastLobby();}
      else if(m.type==='restart'){room.engine.restart();publish(room,true);}
      else if(m.type==='skip'){room.engine.skip(m.fullStage===true);publish(room,true);}
      else if(m.type==='pause'){room.engine.pause();publish(room,true);}
    }
  });
  ws.on('close',()=>{lobbyClients.delete(ws);leave(ws,true);});
  ws.on('error',()=>{lobbyClients.delete(ws);leave(ws,true);});
});
server.listen(PORT,HOST,()=>console.log('Last Light lobby: '+MAX_PLAYERS+' players/room on '+HOST+':'+PORT));
