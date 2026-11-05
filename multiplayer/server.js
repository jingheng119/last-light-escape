import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { buildMaze, TILE, COLS, ROWS, canOccupy } from './maze.js';

const port = Number(process.env.PORT || 3001);
const rooms = new Map();
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const newCode = () => {
  let c;
  do { c = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(c));
  return c;
};
function join(ws, room) {
  if (ws.room) return send(ws, {type:'error', message:'Already in a room'});
  if (!room) return send(ws, {type:'error', message:'Room not found'});
  if (room.players.size >= 2) return send(ws, {type:'error', message:'Room is full'});
  const id = room.nextId++;
  // Spawn at separate walkable tiles near the original Stage 1 entrance.
  const spots = [];
  for (let row=1;row<ROWS-1;row++)for (let col=1;col<COLS-1;col++) {
    if (room.grid[row][col] === 0) spots.push({x:(col+.5)*TILE,y:(row+.5)*TILE, distance:Math.abs(col-1)+Math.abs(row-1)});
  }
  spots.sort((a,b)=>a.distance-b.distance);
  const spot = spots[Math.min(id-1,spots.length-1)];
  room.players.set(id, {ws, id, x:spot.x, y:spot.y, keys:{}});
  ws.room = room; ws.id = id;
  send(ws, {type:'joined', code:room.code, id, grid:room.grid, tile:TILE});
}
function leave(ws) {
  if (!ws.room) return;
  const room = ws.room;
  room.players.delete(ws.id); ws.room = null;
  if (!room.players.size) rooms.delete(room.code);
}
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = path === '/' ? 'index.html' : path === '/client.js' ? 'client.js' : null;
  if (!file) {res.writeHead(404); res.end('Not found'); return;}
  try {
    const data = await readFile(new URL(file, import.meta.url));
    res.writeHead(200, {'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html', 'x-content-type-options':'nosniff'});
    res.end(data);
  } catch {res.writeHead(500); res.end('File unavailable');}
});
const wss = new WebSocketServer({server, maxPayload:512});
wss.on('connection', (ws, request) => {
  const origin = request.headers.origin;
  if (origin) {
    try {if (new URL(origin).host !== request.headers.host) {ws.close(1008); return;}}
    catch {ws.close(1008); return;}
  }
  ws.on('message', raw => {
    let msg; try {msg = JSON.parse(raw.toString());} catch {return;}
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'create' && !ws.room) {
      const code = newCode(), room = {code, nextId:1, players:new Map(), grid:buildMaze()};
      rooms.set(code, room); join(ws, room);
    } else if (msg.type === 'join' && typeof msg.code === 'string' && /^[A-F0-9]{6}$/.test(msg.code)) {
      join(ws, rooms.get(msg.code));
    } else if (msg.type === 'input' && ws.room && msg.keys && typeof msg.keys === 'object') {
      const p = ws.room.players.get(ws.id);
      if (p) for (const k of ['up','down','left','right']) p.keys[k] = msg.keys[k] === true;
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});
setInterval(() => {
  for (const room of rooms.values()) {
    const players = [];
    for (const p of room.players.values()) {
      let dx = Number(!!p.keys.right)-Number(!!p.keys.left);
      let dy = Number(!!p.keys.down)-Number(!!p.keys.up);
      if (dx && dy) {dx *= Math.SQRT1_2;dy *= Math.SQRT1_2;}
      // Resolve axes independently so players slide along walls instead of passing through.
      const newX=p.x+dx*9, newY=p.y+dy*9;
      if(canOccupy(room.grid,newX,p.y))p.x=newX;
      if(canOccupy(room.grid,p.x,newY))p.y=newY;
      players.push({id:p.id,x:p.x,y:p.y});
    }
    for (const p of room.players.values()) send(p.ws, {type:'state',players});
  }
},50);
server.listen(port, () => console.log('Multiplayer prototype at http://localhost:'+port));
