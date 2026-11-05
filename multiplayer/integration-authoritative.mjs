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
  one.send(JSON.stringify({type:'create',nickname:'Captain Aurora'}));
  const joined=await waitFor(one,m=>m.type==='joined');
  assert.equal(joined.id,1);
  const hostRoster=await waitFor(one,m=>m.type==='roster'&&m.players?.length===1);
  assert.equal(hostRoster.players[0].name,'Captain Aurora');
  assert.equal(hostRoster.players[0].role,'scout');
  assert.equal(hostRoster.players[0].host,true);
  one.send(JSON.stringify({type:'start'}));
  const countdown=await waitFor(one,m=>m.type==='snapshot'&&m.snapshot.state==='countdown');
  assert.equal(Math.ceil(countdown.snapshot.countdownRemaining),5);
  one.send(JSON.stringify({type:'action',name:'dash',direction:{x:1,y:0}}));
  await sleep(200);
  const starting=await waitFor(one,m=>m.type==='snapshot'&&m.snapshot.state==='countdown'&&m.snapshot.countdownRemaining<4.9);
  assert.equal(starting.snapshot.player.dashCooldown,0);
  await waitFor(one,m=>m.type==='snapshot'&&m.snapshot.state==='playing',9000);

  two.send(JSON.stringify({type:'join',code:joined.code,nickname:'Second Survivor'}));
  const joinedTwo=await waitFor(two,m=>m.type==='joined');
  assert.equal(joinedTwo.id,2);
  two.send(JSON.stringify({type:'profile',nickname:'<Medic> Teammate'}));
  const edited=await waitFor(one,m=>m.type==='roster'&&
    m.players?.find(p=>p.id===2)?.name==='Medic Teammate');
  assert.equal(edited.players.find(p=>p.id===2).name,'Medic Teammate');
  // Class is frozen during a live game. New names can still be updated.
  two.send(JSON.stringify({type:'role',role:'medic'}));
  await sleep(150);
  const current=wsMessages.get(one).filter(m=>m.type==='roster').at(-1);
  assert.equal(current.players.find(p=>p.id===2).role,'scout');
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
  let fifthPlayer=null,fifthToken=null;
  for(let id=3;id<=5;id++){
    const newcomer=await open();
    newcomer.send(JSON.stringify({type:'join',code:joined.code}));
    const received=await waitFor(newcomer,m=>m.type==='joined');
    assert.equal(received.id,id);
    if(id===5){fifthPlayer=newcomer;fifthToken=received.reconnectToken;}
    const snap=await waitFor(newcomer,m=>m.type==='snapshot'&&
      m.snapshot.players?.filter(Boolean).length===id);
    assert.equal(snap.snapshot.players.filter(Boolean).length,id);
    newcomer.send(JSON.stringify({type:'action',name:'dash',direction:{x:1,y:0}}));
    await waitFor(newcomer,m=>m.type==='snapshot'&&m.snapshot.players?.[id-1]?.dashCooldown>0);
  }
  // A full room keeps a brief private reservation for the fifth player.
  // Its return must not create another seat or reset dash health/state.
  const fifthBefore=wsMessages.get(fifthPlayer)
    .filter(m=>m.type==='snapshot'&&m.snapshot.players?.[4]).at(-1).snapshot;
  fifthPlayer.close();
  await waitFor(two,m=>m.type==='snapshot'&&m.snapshot.players?.[4]===null);
  const fifthBack=await open();
  fifthBack.send(JSON.stringify({type:'resume',code:joined.code,token:fifthToken}));
  const fifthResumed=await waitFor(fifthBack,m=>m.type==='joined'&&m.resumed);
  assert.equal(fifthResumed.id,5);
  const fifthAfter=await waitFor(fifthBack,m=>m.type==='snapshot'&&m.snapshot.players?.[4]);
  assert.equal(fifthAfter.snapshot.players[4].hp,fifthBefore.players[4].hp);
  assert.equal(fifthAfter.snapshot.players[4].x,fifthBefore.players[4].x);
  assert.equal(fifthAfter.snapshot.playerRoles[4],fifthBefore.playerRoles[4]);
  const overflow=await open();
  overflow.send(JSON.stringify({type:'join',code:joined.code}));
  await waitFor(overflow,m=>m.type==='error'&&m.message==='Room is full');
  const beforeDisconnect=wsMessages.get(two).filter(m=>m.type==='snapshot').at(-1).snapshot;
  const originalHost=beforeDisconnect.players[0];
  const hostRole=beforeDisconnect.playerRoles[0];
  one.close();
  // A network interruption reserves the original character and slot, while
  // control of the room immediately transfers to another online player.
  await waitFor(two,m=>m.type==='snapshot'&&m.snapshot.players?.[0]===null&&
    m.snapshot.guestPlayer.hp>0);
  const transferred=await waitFor(two,m=>m.type==='roster'&&m.hostId===2);
  assert.equal(transferred.players.find(p=>p.id===2).host,true);
  assert.equal(transferred.players.find(p=>p.id===2).name,'Medic Teammate');
  const returning=await open();
  returning.send(JSON.stringify({type:'resume',code:joined.code,token:joined.reconnectToken}));
  const resumed=await waitFor(returning,m=>m.type==='joined'&&m.resumed===true);
  assert.equal(resumed.id,1,'Reconnect must reclaim the original slot');
  assert.equal(resumed.nickname,'Captain Aurora');
  assert.equal(resumed.host,false,'Host should not steal back authority after transfer');
  assert.match(resumed.reconnectToken,/^[a-f0-9]{64}$/);
  assert.notEqual(resumed.reconnectToken,joined.reconnectToken);
  const restored=await waitFor(returning,m=>m.type==='snapshot'&&m.snapshot.players?.[0]);
  assert.equal(restored.snapshot.state,'playing');
  assert.equal(restored.snapshot.playerRoles[0],hostRole);
  assert.equal(restored.snapshot.players[0].hp,originalHost.hp,'Preserve hearts on resume');
  assert.equal(restored.snapshot.players[0].x,originalHost.x,'Preserve x coordinate');
  assert.equal(restored.snapshot.players[0].y,originalHost.y,'Preserve y coordinate');
  const replay=await open();
  replay.send(JSON.stringify({type:'resume',code:joined.code,token:joined.reconnectToken}));
  await waitFor(replay,m=>m.type==='resume-error');
  // Replacing an actively connected socket is legitimate for browser refresh.
  const replacement=await open();
  replacement.send(JSON.stringify({type:'resume',code:joined.code,token:resumed.reconnectToken}));
  const takenOver=await waitFor(replacement,m=>m.type==='joined'&&m.resumed);
  assert.equal(takenOver.id,1);
  const replacementState=await waitFor(replacement,m=>m.type==='snapshot'&&m.snapshot.players?.[0]);
  assert.equal(replacementState.snapshot.players[0].hp,originalHost.hp);

  two.send(JSON.stringify({type:'skip',fullStage:true}));
  await waitFor(two,m=>m.type==='snapshot'&&m.snapshot.levelIndex===9);

  console.log('PASS: five-player multiplayer and 90-second session recovery preserving role, health, position and host handover');
}finally{
  for(const socket of sockets)try{socket.close();}catch{}
  processServer.kill('SIGTERM');
}
