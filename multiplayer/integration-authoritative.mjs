import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import WebSocket from 'ws';
import { fileURLToPath } from 'node:url';

const PORT=34579;
const processServer=spawn(process.execPath,['server-authoritative.js'],{
  cwd:fileURLToPath(new URL('.',import.meta.url)),
  env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1'},
  stdio:['ignore','pipe','pipe']
});
let logs='';
processServer.stdout.on('data',d=>{logs+=d.toString();});
processServer.stderr.on('data',d=>{logs+=d.toString();});
const sockets=[];
const wsMessages=new Map();
const waitFor=async(ws,predicate,ms=5000)=>{
  const start=Date.now();
  while(Date.now()-start<ms){
    const match=(wsMessages.get(ws)||[]).find(predicate);
    if(match)return match;
    await sleep(25);
  }
  throw new Error('Timed out waiting for server message; logs: '+logs.slice(-500));
};
const open=()=>new Promise((resolve,reject)=>{
  const ws=new WebSocket('ws://127.0.0.1:'+PORT);
  wsMessages.set(ws,[]);sockets.push(ws);
  ws.on('message',raw=>{
    try{wsMessages.get(ws).push(JSON.parse(raw.toString()));}catch{}
  });
  ws.once('open',()=>resolve(ws));ws.once('error',reject);
});
try{
  let ready=false;
  for(let i=0;i<70;i++){
    if(processServer.exitCode!==null)throw Error('Server exited before ready: '+logs);
    try{
      const response=await fetch('http://127.0.0.1:'+PORT+'/health');
      const health=await response.json();
      assert.equal(health.authority,'server');
      ready=true;break;
    }catch{await sleep(100);}
  }
  assert(ready,'Server did not start: '+logs);
  const one=await open(),two=await open();
  one.send(JSON.stringify({type:'create'}));
  const joined=await waitFor(one,m=>m.type==='joined');
  assert.equal(joined.id,1);
  one.send(JSON.stringify({type:'start'}));
  await waitFor(one,m=>m.type==='snapshot'&&m.snapshot.state==='playing');

  two.send(JSON.stringify({type:'join',code:joined.code}));
  const joinedTwo=await waitFor(two,m=>m.type==='joined');
  assert.equal(joinedTwo.id,2);
  const snap=await waitFor(two,m=>m.type==='snapshot'&&
    m.snapshot.state==='playing'&&m.snapshot.guestPlayer);
  assert.equal(snap.snapshot.player.hp,3);
  assert.equal(snap.snapshot.guestPlayer.hp,3);

  two.send(JSON.stringify({type:'input',keys:{right:true}}));
  two.send(JSON.stringify({type:'action',name:'dash',direction:{x:1,y:0}}));
  await waitFor(two,m=>m.type==='snapshot'&&m.snapshot.guestPlayer?.dashCooldown>0);

  // Live lobby must list the room, then accept exactly five players.
  const catalog=await open();
  catalog.send(JSON.stringify({type:'list'}));
  const listing=await waitFor(catalog,m=>m.type==='rooms'&&m.rooms.some(x=>x.code===joined.code));
  assert(listing.rooms.find(x=>x.code===joined.code).capacity===5);
  for(let id=3;id<=5;id++){
    const newcomer=await open();
    newcomer.send(JSON.stringify({type:'join',code:joined.code}));
    const received=await waitFor(newcomer,m=>m.type==='joined');
    assert.equal(received.id,id);
    const snap=await waitFor(newcomer,m=>m.type==='snapshot'&&
      m.snapshot.players?.filter(Boolean).length===id);
    assert.equal(snap.snapshot.players.filter(Boolean).length,id);
    newcomer.send(JSON.stringify({type:'action',name:'dash',direction:{x:1,y:0}}));
    await waitFor(newcomer,m=>m.type==='snapshot'&&m.snapshot.players?.[id-1]?.dashCooldown>0);
  }
  const overflow=await open();
  overflow.send(JSON.stringify({type:'join',code:joined.code}));
  await waitFor(overflow,m=>m.type==='error'&&m.message==='Room is full');
  one.close();
  await waitFor(two,m=>m.type==='snapshot'&&m.snapshot.player.hp===0&&
    m.snapshot.guestPlayer.hp>0);

  console.log('PASS: five-player rooms, live lobby, sixth-player rejection, authoritative dash and host departure');
}finally{
  for(const socket of sockets)try{socket.close();}catch{}
  processServer.kill('SIGTERM');
}
