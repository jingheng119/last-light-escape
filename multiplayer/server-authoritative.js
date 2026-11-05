// Dedicated authoritative rooms + public five-player lobby.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoomEngine } from './headless-engine.js';

const PORT=Number(process.env.PORT||3001);
const HOST=process.env.HOST||'0.0.0.0';
const MAX_ROOMS=16, MAX_PLAYERS=5;
const rooms=new Map(),lobbyClients=new Set();
const MIME={'/':'text/html; charset=utf-8','/game.js':'text/javascript; charset=utf-8',
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
function makeCode(){
  let value;
  do{value=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(value));
  return value;
}
function listRooms(){
  return [...rooms.values()].map(room=>({
    code:room.code,name:room.name,players:room.clients.size,
    capacity:MAX_PLAYERS,status:room.engine.status()==='menu'?'waiting':'in-progress',
    joinable:room.clients.size<MAX_PLAYERS
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
  for(const ws of room.clients.values())send(ws,{
    type:'roster',count:room.clients.size,capacity:MAX_PLAYERS,hostId:room.hostId
  });
  broadcastLobby();
}
function createRoom(name){
  const room={code:makeCode(),name:safeRoomName(name),engine:createRoomEngine(),
    clients:new Map(),hostId:1,ticks:0};
  rooms.set(room.code,room);
  let last=performance.now();
  room.timer=setInterval(()=>{
    const now=performance.now(),dt=Math.min(.05,(now-last)/1000);
    last=now;
    try{
      room.engine.tick(dt);
      if(++room.ticks%2===0)publish(room,room.ticks%150===0);
    }catch(error){
      console.error('Room simulation failed',room.code,error);
      for(const ws of room.clients.values()){
        send(ws,{type:'error',message:'Room simulation stopped'});
        ws.room=null;ws.playerId=null;
      }
      clearInterval(room.timer);rooms.delete(room.code);broadcastLobby();
    }
  },33);
  return room;
}
function join(ws,room){
  if(ws.room)return send(ws,{type:'error',message:'Leave your current room first'});
  if(!room)return send(ws,{type:'error',message:'Room not found'});
  if(room.clients.size>=MAX_PLAYERS)return send(ws,{type:'error',message:'Room is full'});
  const id=[1,2,3,4,5].find(id=>!room.clients.has(id));
  if(!id)return send(ws,{type:'error',message:'Room is full'});
  room.clients.set(id,ws);ws.room=room;ws.playerId=id;
  if(id===1&&room.clients.size>1)room.engine.rejoinHost();
  else if(id!==1)room.engine.join(id);
  if(room.clients.size===1)room.hostId=id;
  send(ws,{type:'joined',code:room.code,name:room.name,id,host:id===room.hostId});
  notifyRoom(room);publish(room,true);
}
function leave(ws){
  const room=ws.room;if(!room)return;
  const id=ws.playerId;
  room.clients.delete(id);
  room.engine.leave(id);
  ws.room=null;ws.playerId=null;
  send(ws,{type:'left'});
  if(!room.clients.size){
    clearInterval(room.timer);rooms.delete(room.code);broadcastLobby();
  }else{
    if(id===room.hostId)room.hostId=[...room.clients.keys()][0];
    notifyRoom(room);publish(room,true);
  }
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
    if(m.type==='create'){
      if(ws.room)return send(ws,{type:'error',message:'Leave your current room first'});
      if(rooms.size>=MAX_ROOMS)return send(ws,{type:'error',message:'All room slots are occupied'});
      return join(ws,createRoom(m.name));
    }
    if(m.type==='join'){
      if(typeof m.code!=='string'||!/^[0-9A-F]{6}$/.test(m.code))
        return send(ws,{type:'error',message:'Invalid room code'});
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
    else if(m.type==='role'&&['scout','medic'].includes(m.role))
      room.engine.role(id,m.role);
    else if(id===room.hostId){
      if(m.type==='start'){room.engine.start();publish(room,true);broadcastLobby();}
      else if(m.type==='next'){room.engine.next();publish(room,true);broadcastLobby();}
      else if(m.type==='restart'){room.engine.restart();publish(room,true);}
      else if(m.type==='skip'){room.engine.skip(m.fullStage===true);publish(room,true);}
      else if(m.type==='pause'){room.engine.pause();publish(room,true);}
    }
  });
  ws.on('close',()=>{lobbyClients.delete(ws);leave(ws);});
  ws.on('error',()=>{lobbyClients.delete(ws);leave(ws);});
});
server.listen(PORT,HOST,()=>console.log('Last Light lobby: '+MAX_PLAYERS+' players/room on '+HOST+':'+PORT));
