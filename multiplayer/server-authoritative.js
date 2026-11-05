// Dedicated server simulation: browser clients send input only.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { createRoomEngine } from './headless-engine.js';

const PORT=Number(process.env.PORT||3001);
const HOST=process.env.HOST||'0.0.0.0';
const rooms=new Map();
const MIME={
  '/':'text/html; charset=utf-8',
  '/game.js':'text/javascript; charset=utf-8',
  '/style.css':'text/css; charset=utf-8',
  '/favicon.svg':'image/svg+xml'
};
const FILE={'/':'index.html','/game.js':'game.js','/style.css':'style.css','/favicon.svg':'favicon.svg'};
const send=(ws,message)=>{
  if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<180000)
    ws.send(JSON.stringify(message));
};
const safeKeys=input=>Object.fromEntries(['up','down','left','right'].map(k=>[k,input?.[k]===true]));
const safeStick=input=>({
  x:Number.isFinite(input?.x)?Math.max(-1,Math.min(1,input.x)):0,
  y:Number.isFinite(input?.y)?Math.max(-1,Math.min(1,input.y)):0
});
const safeDirection=input=>{
  if(!Number.isFinite(input?.x)||!Number.isFinite(input?.y))return null;
  return {x:Math.max(-1,Math.min(1,input.x)),y:Math.max(-1,Math.min(1,input.y))};
};
function code(){
  let value;
  do{value=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(value));
  return value;
}
function publish(room,full=false){
  const snapshot=room.engine.snapshot(full);
  for(const client of room.clients.values())send(client,{type:'snapshot',snapshot});
}
function createRoom(){
  const room={code:code(),engine:createRoomEngine(),clients:new Map(),ticks:0};
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
      for(const ws of room.clients.values())send(ws,{type:'error',message:'Game simulation error'});
      clearInterval(room.timer);rooms.delete(room.code);
    }
  },33);
  return room;
}
function join(ws,room){
  if(ws.room)return send(ws,{type:'error',message:'Already joined'});
  if(!room)return send(ws,{type:'error',message:'Room not found'});
  const id=room.clients.has(1)?2:1;
  if(room.clients.has(id))return send(ws,{type:'error',message:'Room is full'});
  room.clients.set(id,ws);ws.room=room;ws.playerId=id;
  if(id===2)room.engine.join();
  send(ws,{type:'joined',code:room.code,id,host:id===1});
  for(const client of room.clients.values())
    send(client,{type:'roster',count:room.clients.size});
  publish(room,true);
}
function leave(ws){
  const room=ws.room;if(!room)return;
  room.clients.delete(ws.playerId);
  if(ws.playerId===2)room.engine.leave();
  else if(room.clients.size)room.engine.hostLeft();
  ws.room=null;
  if(!room.clients.size){clearInterval(room.timer);rooms.delete(room.code);}
  else{
    for(const client of room.clients.values())
      send(client,{type:'roster',count:room.clients.size});
    publish(room,true);
  }
}
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/health'){
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({status:'ok',rooms:rooms.size,authority:'server'}));return;
  }
  const file=FILE[pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{
    const data=await readFile(new URL(file,import.meta.url));
    res.writeHead(200,{'content-type':MIME[pathname],'cache-control':'no-store'});
    res.end(data);
  }catch(error){res.writeHead(500);res.end('Asset error');}
});
const wss=new WebSocketServer({server,maxPayload:32768});
wss.on('connection',(ws,req)=>{
  const origin=req.headers.origin;
  try{
    if(origin&&new URL(origin).host!==req.headers.host)return ws.close(1008,'Origin invalid');
  }catch{return ws.close(1008,'Origin invalid');}
  ws.on('message',raw=>{
    if(raw.length>16000)return;
    let m;try{m=JSON.parse(raw.toString());}catch{return;}
    if(!m||typeof m.type!=='string')return;
    if(m.type==='ping'&&Number.isFinite(m.at))return send(ws,{type:'pong',at:m.at});
    if(m.type==='create')return join(ws,createRoom());
    if(m.type==='join'){
      if(typeof m.code!=='string'||!/^[0-9A-F]{6}$/.test(m.code))
        return send(ws,{type:'error',message:'Invalid room code'});
      return join(ws,rooms.get(m.code));
    }
    const room=ws.room,id=ws.playerId;
    if(!room)return;
    if(m.type==='input')room.engine.input(id,safeKeys(m.keys),safeStick(m.joystick));
    else if(m.type==='action'&&['dash','interact','decoy','ability'].includes(m.name))
      room.engine.action(id,m.name,safeDirection(m.direction));
    else if(m.type==='role'&&['scout','medic'].includes(m.role))
      room.engine.role(id,m.role);
    else if(m.type==='start'&&room.engine)room.engine.start();
    else if(m.type==='next')room.engine.next();
    else if(m.type==='skip'&&id===1)room.engine.skip(m.fullStage===true);
    else if(m.type==='pause'&&id===1)room.engine.pause();
  });
  ws.on('close',()=>leave(ws));
  ws.on('error',()=>leave(ws));
});
server.listen(PORT,HOST,()=>console.log('Server-authoritative Last Light on '+HOST+':'+PORT));
