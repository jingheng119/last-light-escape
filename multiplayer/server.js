import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';

const PORT=Number(process.env.PORT || 3001);
const rooms=new Map();
const send=(ws,obj)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));};
function makeCode(){let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));return code;}
function broadcast(room,obj,except=null){for(const entry of room.players.values())if(entry.ws!==except)send(entry.ws,obj);}
function join(ws,room){
  if(ws.room)return send(ws,{type:'error',message:'Already in a room'});
  if(!room)return send(ws,{type:'error',message:'Room not found'});
  if(room.players.size>=2)return send(ws,{type:'error',message:'Room is full'});
  const id=room.players.size?2:1;
  room.players.set(id,{id,ws});
  ws.room=room;ws.playerId=id;
  send(ws,{type:'joined',code:room.code,id,host:id===1});
  broadcast(room,{type:'roster',count:room.players.size});
  if(id!==1&&room.lastSnapshot)send(ws,{type:'snapshot',snapshot:room.lastSnapshot});
}
function leave(ws){
  const room=ws.room;if(!room)return;
  room.players.delete(ws.playerId);ws.room=null;
  if(ws.playerId===1){
    for(const other of room.players.values()){send(other.ws,{type:'hostleft'});other.ws.room=null;}
    rooms.delete(room.code);
  }else{
    broadcast(room,{type:'playerleft',id:ws.playerId});
    broadcast(room,{type:'roster',count:room.players.size});
    if(!room.players.size)rooms.delete(room.code);
  }
}
const mime={'index.html':'text/html; charset=utf-8','game.js':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8','favicon.svg':'image/svg+xml'};
const paths={'/':'index.html','/game.js':'game.js','/style.css':'style.css','/favicon.svg':'favicon.svg'};
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=paths[pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  try{
    const location=file==='style.css'||file==='favicon.svg'?'../'+file:file;
    const buffer=await readFile(new URL(location,import.meta.url));
    res.writeHead(200,{'content-type':mime[file],'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(buffer);
  }catch(e){res.writeHead(500);res.end('Failed to load game asset');}
});
const wss=new WebSocketServer({server,maxPayload:512*1024});
wss.on('connection',(ws,req)=>{
  const origin=req.headers.origin;
  if(origin){try{if(new URL(origin).host!==req.headers.host){ws.close(1008,'Origin disallowed');return;}}catch{ws.close(1008);return;}}
  let lastInput=0,lastSnapshot=0;
  ws.on('message',raw=>{
    let msg;try{msg=JSON.parse(raw.toString());}catch{return;}
    if(!msg||typeof msg!=='object'||typeof msg.type!=='string')return;
    if(msg.type==='create'&&!ws.room){
      const room={code:makeCode(),players:new Map(),lastSnapshot:null};rooms.set(room.code,room);join(ws,room);return;
    }
    if(msg.type==='join'&&!ws.room){
      if(typeof msg.code!=='string'||!/^[0-9A-F]{6}$/.test(msg.code))return send(ws,{type:'error',message:'Invalid room code'});
      join(ws,rooms.get(msg.code));return;
    }
    const room=ws.room;if(!room)return;
    if(msg.type==='input'&&ws.playerId===2){
      if(Date.now()-lastInput<25)return;lastInput=Date.now();
      const keys=msg.keys;
      if(!keys||typeof keys!=='object')return;
      const safe={};
      for(const key of ['up','down','left','right'])safe[key]=keys[key]===true;
      const joystick=msg.joystick;
      const jx=typeof joystick?.x==='number'&&Number.isFinite(joystick.x)?Math.max(-1,Math.min(1,joystick.x)):0;
      const jy=typeof joystick?.y==='number'&&Number.isFinite(joystick.y)?Math.max(-1,Math.min(1,joystick.y)):0;
      send(room.players.get(1)?.ws,{type:'remoteInput',keys:safe,joystick:{x:jx,y:jy}});
    }else if(msg.type==='role'&&ws.playerId===2){
      if(msg.role==='medic'||msg.role==='scout')send(room.players.get(1)?.ws,{type:'remoteRole',role:msg.role});
    }else if(msg.type==='action'&&ws.playerId===2){
      if(['dash','interact','decoy','ability'].includes(msg.name))
        send(room.players.get(1)?.ws,{type:'remoteAction',name:msg.name});
    }else if(msg.type==='snapshot'&&ws.playerId===1){
      if(Date.now()-lastSnapshot<40)return;lastSnapshot=Date.now();
      if(!msg.snapshot||typeof msg.snapshot!=='object')return;
      room.lastSnapshot=msg.snapshot;
      send(room.players.get(2)?.ws,{type:'snapshot',snapshot:msg.snapshot});
    }
  });
  ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
});
server.listen(PORT,()=>console.log('Last Light unified rooms at http://localhost:'+PORT));
