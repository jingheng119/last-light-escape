const canvas = document.querySelector('#arena');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const roomLabel = document.querySelector('#room');
const joinCode = document.querySelector('#code');
const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
let me = 0, players = [], joined = false, maze = null, tileSize = 32;
const keys = {up:false,down:false,left:false,right:false};
const keyMap = {w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
const initialCode = new URLSearchParams(location.search).get('room');
if (initialCode && /^[a-f0-9]{6}$/i.test(initialCode)) joinCode.value = initialCode.toUpperCase();
function send(data) {if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));}
ws.addEventListener('open', () => status.textContent = 'Connected. Create or join a room.');
ws.addEventListener('close', () => status.textContent = 'Disconnected. Refresh to reconnect.');
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.type === 'error') status.textContent = m.message;
  if (m.type === 'joined') {
    me = m.id; joined = true;
    maze = m.grid; tileSize = m.tile;
    roomLabel.textContent = m.code;
    const link = new URL(location.href); link.searchParams.set('room', m.code);
    document.querySelector('#invite').textContent = 'Invite link: ' + link.href;
    document.querySelector('#actions').hidden = true;
  }
  if (m.type === 'state') {
    players = m.players;
    status.textContent = players.length + '/2 players connected' + (players.length === 2 ? ' — Play together!' : ' — Waiting for teammate');
  }
});
document.querySelector('#create').onclick = () => {if (!joined) send({type:'create'});};
document.querySelector('#join').onclick = () => {
  const code = joinCode.value.trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(code)) {status.textContent = 'Enter the six-character room code';return;}
  if (!joined) send({type:'join',code});
};
addEventListener('keydown', e => {
  const key = keyMap[e.key.toLowerCase()];
  if (key && document.activeElement !== joinCode) {keys[key] = true; e.preventDefault();}
});
addEventListener('keyup', e => {
  const key = keyMap[e.key.toLowerCase()];
  if (key) {keys[key] = false; e.preventDefault();}
});
addEventListener('blur', () => {for(const k of Object.keys(keys)) keys[k]=false;});
setInterval(() => {if (joined) send({type:'input',keys});},50);
function draw() {
  ctx.fillStyle='#081923';ctx.fillRect(0,0,992,672);
  if (maze) {
    // Both browsers draw the identical authoritative maze supplied by their room.
    for(let row=0;row<maze.length;row++)for(let col=0;col<maze[row].length;col++){
      const x=col*tileSize,y=row*tileSize;
      if(maze[row][col]===1){
        ctx.fillStyle='#152832';ctx.fillRect(x,y,tileSize,tileSize);
        ctx.strokeStyle='#24414a';ctx.strokeRect(x+.5,y+.5,tileSize-1,tileSize-1);
      }else{
        ctx.fillStyle='#102c34';ctx.fillRect(x,y,tileSize,tileSize);
        ctx.strokeStyle='#1a3a40';ctx.strokeRect(x+.5,y+.5,tileSize-1,tileSize-1);
      }
    }
  }
  for(const p of players){
    const color = p.id === me ? '#79f3cc' : '#ffa96e';
    ctx.shadowColor=color;ctx.shadowBlur=20;ctx.fillStyle=color;
    ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#effffb';ctx.textAlign='center';ctx.font='bold 15px sans-serif';
    ctx.fillText(p.id===me?'YOU':'ALLY',p.x,p.y-23);
  }
  requestAnimationFrame(draw);
}
draw();
