// Exercise the production entry point through two fresh process starts.
// This verifies /health and WebSocket readiness without requiring Neon secrets.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';

const basePort=36700;
async function verifyStartup(port){
  const child=spawn(process.execPath,['server-authoritative.js'],{
    cwd:fileURLToPath(new URL('.',import.meta.url)),
    env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATABASE_URL:''},
    stdio:['ignore','pipe','pipe']
  });
  let logs='';
  child.stdout.on('data',data=>logs+=data.toString());
  child.stderr.on('data',data=>logs+=data.toString());
  try{
    const started=Date.now();
    let health=null;
    for(let attempt=0;attempt<80;attempt++){
      if(child.exitCode!==null)throw Error('Application exited: '+logs);
      try{
        const response=await fetch('http://127.0.0.1:'+port+'/health',{
          signal:AbortSignal.timeout(1000)
        });
        assert.equal(response.status,200);
        assert.match(response.headers.get('content-type')||'',/application\/json/);
        health=await response.json();
        break;
      }catch(error){
        if(attempt===79)throw new Error('Health check failed: '+error.message+'; logs: '+logs);
        await sleep(100);
      }
    }
    assert.equal(health.status,'ok');
    assert.equal(health.authority,'server');
    assert.equal(health.maxPlayers,5);
    assert.equal(health.lobby,true);
    assert.equal(health.rooms,0);
    const ws=await new Promise((resolve,reject)=>{
      const socket=new WebSocket('ws://127.0.0.1:'+port);
      const timeout=setTimeout(()=>{socket.terminate();reject(Error('WebSocket readiness timed out'));},2500);
      socket.once('open',()=>{clearTimeout(timeout);resolve(socket);});
      socket.once('error',e=>{clearTimeout(timeout);reject(e);});
    });
    try{
      const rooms=await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Error('Lobby directory timed out')),2500);
        ws.on('message',raw=>{
          try{const value=JSON.parse(raw);if(value.type==='rooms'){
            clearTimeout(timeout);resolve(value);
          }}catch{}
        });
        ws.send(JSON.stringify({type:'list'}));
      });
      assert(Array.isArray(rooms.rooms));
    }finally{ws.close();}
    console.log('STARTUP: /health and WebSocket ready in '+(Date.now()-started)+' ms');
  }finally{
    if(child.exitCode===null){
      child.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve=>child.once('exit',resolve)),
        sleep(2000).then(()=>child.kill('SIGKILL'))
      ]);
    }
  }
}
await verifyStartup(basePort);
await verifyStartup(basePort+1);
console.log('PASS: two independent production starts expose healthy HTTP and multiplayer WebSocket endpoints.');
