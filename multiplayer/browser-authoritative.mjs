import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';

const port=34582;
const child=spawn(process.execPath,['server-authoritative.js'],{
  cwd:fileURLToPath(new URL('.',import.meta.url)),
  env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},
  stdio:['ignore','pipe','pipe']
});
let serverLogs='';
child.stdout.on('data',b=>serverLogs+=b.toString());
child.stderr.on('data',b=>serverLogs+=b.toString());
let browser;
const problems=[];
try{
  let ready=false;
  for(let i=0;i<60;i++){
    try{const response=await fetch('http://127.0.0.1:'+port+'/health');if(response.ok){ready=true;break;}}catch{}
    await sleep(100);
  }
  assert(ready,'Server not live: '+serverLogs);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const first=await browser.newPage(),second=await browser.newPage();
  const players=[first,second];
  for(const [p,label] of [[first,'P1'],[second,'P2']]){
    p.on('pageerror',error=>problems.push(label+': '+error.message));
    await p.goto('http://127.0.0.1:'+port+'/');
    await p.waitForFunction(()=>document.querySelector('#roomStatus')?.textContent?.includes('Connected'),null,{timeout:10000});
    assert.equal(new URL(p.url()).pathname,'/');
    assert(await p.locator('#playPage').isHidden(),'Lobby must not show game canvas');
    assert(await p.locator('#lobbyPage').isVisible(),'Dedicated lobby page should be visible');
  }
  await first.locator('#playerNickname').fill('Captain Light');
  await first.locator('#lobbyClass').selectOption('medic');
  await first.locator('#createRoom').click();
  await first.waitForFunction(()=>window.__lastLightDiagnostics?.().roomPlayerId===1,null,{timeout:7000});
  assert.equal(new URL(first.url()).pathname,'/play');
  assert(await first.locator('#playPage').isVisible());
  assert(await first.locator('#lobbyPage').isHidden());
  // Navigation is client-side: returning to lobby must retain room membership.
  await first.locator('#backToLobby').click();
  assert.equal(new URL(first.url()).pathname,'/');
  assert(await first.locator('#playPage').isHidden());
  assert.equal((await first.evaluate(()=>window.__lastLightDiagnostics())).roomPlayerId,1);
  await first.waitForFunction(()=>document.querySelector('#medicCount')?.textContent==='1',
    null,{timeout:7000});
  assert.equal(await first.locator('#scoutCount').textContent(),'0');
  assert.equal(await first.locator('#rosterCount').textContent(),'1 / 5 players');
  assert.equal(await first.locator('#lobbyRoster').count(),0,
    'The lobby must not display individual player names');
  await first.locator('#returnToGame').click();
  assert.equal(new URL(first.url()).pathname,'/play');
  assert(await first.locator('#playPage').isVisible());
  const room=await first.locator('#joinRoomCode').inputValue();
  assert.match(room,/^[0-9A-F]{6}$/);
  await second.locator('#playerNickname').fill('Shadow Runner');
  await second.locator('#joinRoomCode').fill(room);
  await second.locator('#joinRoom').click();
  await sleep(500);
  const joinState=await second.evaluate(()=>({
    status:document.querySelector('#roomStatus')?.textContent,
    code:document.querySelector('#joinRoomCode')?.value,
    role:window.__lastLightDiagnostics?.().state,
    socketStatus:document.querySelector('#networkStatus')?.textContent
  }));
  console.log('Join state:',JSON.stringify(joinState));
  await second.waitForFunction(()=>document.querySelector('#networkStatus')?.textContent?.includes('PLAYER 2'),null,{timeout:7000});
  assert.equal(new URL(second.url()).pathname,'/play');
  assert(await second.locator('#lobbyPage').isHidden());
  await first.locator('#backToLobby').click();
  await first.waitForFunction(()=>document.querySelector('#scoutCount')?.textContent==='1'&&
    document.querySelector('#medicCount')?.textContent==='1',null,{timeout:7000});
  await first.locator('#returnToGame').click();
  // Players 3–5 discover and join the room from the PUBLIC DIRECTORY,
  // without ever knowing or entering a room code.
  for(let id=3;id<=5;id++){
    const page=await browser.newPage();players.push(page);
    page.on('pageerror',error=>problems.push('P'+id+': '+error.message));
    if(id===3){
      // Opening a shared /play invite should join the existing room directly,
      // even on a fresh browser with no prior lobby socket.
      await page.goto('http://127.0.0.1:'+port+'/play?room='+room);
    }else{
      await page.goto('http://127.0.0.1:'+port+'/');
      await page.waitForFunction(room=>[...document.querySelectorAll('.room-entry')]
        .some(e=>e.textContent.includes(room)),room,{timeout:9000});
      await page.locator('.room-entry').filter({hasText:room}).locator('button').click();
    }
    if(id===3){
      await sleep(350);
      console.log('DIRECT INVITE',JSON.stringify(await page.evaluate(()=>({
        url:location.href,status:document.querySelector('#roomStatus')?.textContent,
        roomId:window.__lastLightDiagnostics?.().roomPlayerId,
        roomCode:document.querySelector('#joinRoomCode')?.value,
        roomCount:document.querySelector('#roomCount')?.textContent
      }))));
    }
    await page.waitForFunction(id=>window.__lastLightDiagnostics?.().roomPlayerId===id,id,{timeout:9000});
    assert.equal(new URL(page.url()).pathname,'/play');
  }
  const sixth=await browser.newPage();
  await sixth.goto('http://127.0.0.1:'+port+'/');
  await sixth.waitForFunction(room=>[...document.querySelectorAll('.room-entry')]
    .some(e=>e.textContent.includes(room)),room,{timeout:9000});
  assert(await sixth.locator('.room-entry').filter({hasText:room}).locator('button').isDisabled(),
    'A full five-player room must not admit a sixth player');

  // A second host creates another public room. The first host must STILL
  // see both rooms in the lobby, with the current one marked YOUR ROOM.
  await sixth.locator('#roomName').fill('Second Host Room');
  await sixth.locator('#createRoom').click();
  await sixth.waitForFunction(()=>window.__lastLightDiagnostics?.().roomPlayerId===1,null,{timeout:9000});
  const otherRoom=await sixth.locator('#joinRoomCode').inputValue();
  assert.notEqual(otherRoom,room,'Separate hosts must create separate rooms');
  await first.locator('#backToLobby').click();
  await first.waitForFunction(([a,b])=>
    [...document.querySelectorAll('.room-entry')].some(e=>e.textContent.includes(a))&&
    [...document.querySelectorAll('.room-entry')].some(e=>e.textContent.includes(b)),
    [room,otherRoom],{timeout:9000});
  assert(await first.locator('#roomList').isVisible(),'Host must still see room browser');
  assert(await first.locator('#myRoomCard').isVisible(),'Host must see pinned own-room card');
  assert.equal(await first.locator('#roomList .room-entry').count(),1,
    'Own room must not be repeated in Available Rooms');
  assert.equal(await first.locator('#myRoomCard').getByText('YOUR ROOM').count(),1);
  assert(await first.locator('#myRoomCard').textContent().then(t=>t.includes(room)));
  assert(await first.locator('#myRoomCard #returnToGame').isVisible());
  assert(await first.locator('#myRoomCard #leaveRoom').isVisible());
  await first.waitForFunction(()=>document.querySelector('#rosterCount')?.textContent==='5 / 5 players',
    null,{timeout:7000});
  assert.equal(await first.locator('#medicCount').textContent(),'1');
  assert.equal(await first.locator('#scoutCount').textContent(),'4');
  assert.equal(await first.locator('#lobbyRoster').count(),0);
  assert(await first.locator('.room-entry').filter({hasText:otherRoom}).isVisible());
  assert(await first.locator('.room-entry').filter({hasText:otherRoom}).locator('button').isDisabled(),
    'Other rooms should remain visible but not joinable until current room is left');
  await first.locator('#myRoomCard #returnToGame').click();
  assert.equal(new URL(first.url()).pathname,'/play');
  assert.equal((await first.evaluate(()=>window.__lastLightDiagnostics())).roomPlayerId,1);

  // Capture actual canvas player labels when the game starts.
  await first.evaluate(()=>{
    window.__nameplateDraws=[];
    const prototype=CanvasRenderingContext2D.prototype;
    const old=prototype.fillText;
    prototype.fillText=function(value,...args){
      const label=String(value);
      if(label.includes('Captain Light')||label.includes('Shadow Runner'))
        window.__nameplateDraws.push({label,color:this.fillStyle,
          font:this.font,shadow:this.shadowColor});
      return old.call(this,value,...args);
    };
  });
  await first.locator('#primaryBtn').click();
  for(const page of players){
    await page.waitForFunction(()=>window.__lastLightDiagnostics?.().state==='countdown',
      null,{timeout:7000});
    assert(await page.locator('#overlay').isVisible(),
      'Countdown must appear for every connected player');
    assert.equal((await page.locator('#overlayTitle').textContent()).trim(),'5');
    assert(await page.locator('#primaryBtn').isHidden(),
      'The start button must not cover the countdown');
  }
  await first.waitForFunction(()=>
    window.__nameplateDraws?.some(s=>s.label==='Captain Light'&&s.color==='#76f2d1')&&
    window.__nameplateDraws?.some(s=>s.label==='Shadow Runner'&&s.color==='#ffb36e'),
    null,{timeout:9000});
  const names=await first.evaluate(()=>window.__nameplateDraws);
  assert(!names.some(item=>item.label.includes('(YOU)')),
    'Nameplates must not display YOU');
  assert(new Set(names.map(item=>item.color)).size>=2,
    'Each connected player must have a separate visible color');
  await sleep(600);
  console.log('After Start:',JSON.stringify({
    first:await first.evaluate(()=>({diagnostics:window.__lastLightDiagnostics?.(),status:document.querySelector('#roomStatus')?.textContent,overlay:document.querySelector('#overlay')?.className})),
    second:await second.evaluate(()=>({diagnostics:window.__lastLightDiagnostics?.(),status:document.querySelector('#roomStatus')?.textContent,overlay:document.querySelector('#overlay')?.className}))
  }));
  await first.waitForFunction(()=>window.__lastLightDiagnostics?.().state==='playing',null,{timeout:7000});
  for(const page of players){
    await page.waitForFunction(()=>window.__lastLightDiagnostics?.().state==='playing',null,{timeout:12000});
    const details=await page.evaluate(()=>window.__lastLightDiagnostics());
    assert.equal(details.visibleTeammates,4,'Every player sees four teammates');
  }
  // Deterministic geometry check for the colored edge indicators.
  // Four distant teammates must create four markers, one of which is a
  // persistent soul; a teammate next to us must NOT produce an edge arrow.
  const markers=await first.evaluate(()=>{
    const p=window.__lastLightDiagnostics().playerPosition;
    const far=[
      {slot:2,x:p.x-500,y:p.y,hp:3},
      {slot:3,x:p.x+500,y:p.y,hp:3},
      {slot:4,x:p.x,y:p.y-500,hp:3},
      {slot:5,x:p.x,y:p.y+500,hp:0}
    ];
    return {
      offscreen:window.__lastLightPreviewIndicators(far),
      onscreen:window.__lastLightPreviewIndicators([
        {slot:2,x:p.x,y:p.y,hp:3}
      ]),
      dead:window.__lastLightPreviewIndicators([{slot:5,x:p.x,y:p.y+500,hp:0}])
    };
  });
  assert.equal(markers.offscreen.length,4,'Four offscreen teammates need four indicators');
  assert.equal(new Set(markers.offscreen.map(m=>m.slot)).size,4);
  assert.equal(new Set(markers.offscreen.map(m=>m.color)).size,4);
  assert.equal(markers.onscreen.length,0,'Visible teammate must have no edge marker');
  assert.equal(markers.dead.length,1,'Fallen offscreen soul remains trackable');
  assert.equal(markers.dead[0].dead,true);
  for(const m of markers.offscreen){
    assert(m.x>=14&&m.x<=978&&m.y>=84&&m.y<=624,
      'Teammate arrow must stay inside the updated near-edge HUD margins');
  }
  assert(await first.locator('#overlay').evaluate(el=>el.classList.contains('hidden')));
  assert(await second.locator('#overlay').evaluate(el=>el.classList.contains('hidden')));
  const hp1=await first.evaluate(()=>window.__lastLightDiagnostics().playerHP);
  const hp2=await second.evaluate(()=>window.__lastLightDiagnostics().playerHP);
  assert.equal(hp1,3);assert.equal(hp2,3);
  for(const page of players)assert.equal(await page.evaluate(()=>window.__lastLightDiagnostics().playerHP),3);
  await first.keyboard.down('d');await second.keyboard.down('s');
  await sleep(350);
  await first.keyboard.up('d');await second.keyboard.up('s');
  await second.keyboard.press('Space');
  await sleep(400);
  let p1=await first.evaluate(()=>window.__lastLightDiagnostics());
  let p2=await second.evaluate(()=>window.__lastLightDiagnostics());
  // Both clients must render the SAME server positions. The camera may ease
  // independently, but player coordinates and dash collision rules must not.
  const delta=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  assert(p1.allyPosition&&p2.allyPosition,'Both clients should see both players');
  assert(delta(p1.playerPosition,p2.allyPosition)<.24,
    'Player 1 diverged from the position seen by Player 2');
  assert(delta(p2.playerPosition,p1.allyPosition)<.24,
    'Player 2 diverged from the position seen by Player 1');
  assert(p2.dashCooldown>0,'Player 2 dash should be authoritative');
  await sleep(300);
  p1=await first.evaluate(()=>window.__lastLightDiagnostics());
  p2=await second.evaluate(()=>window.__lastLightDiagnostics());
  assert(delta(p1.playerPosition,p2.allyPosition)<.24);
  assert(delta(p2.playerPosition,p1.allyPosition)<.24);
  // Regression: the inactive soul has no floating "SOUL · REVIVE" text,
  // and hosts get an actionable next-floor button when the level clears.
  const gameSource=await (await fetch('http://127.0.0.1:'+port+'/game.js')).text();
  assert(!gameSource.includes(":'SOUL · REVIVE',x,y-28"),'Inactive soul label must be hidden');
  assert(gameSource.includes("button=levelIndex===STAGE_ONE_FLOORS-1?'ENTER STAGE TWO':'ENTER NEXT FLOOR'"),
    'Host floor-clear button must allow progression');
  if(problems.length)throw new Error('Browser JS errors: '+problems.join(' | '));
  console.log('PASS: All five real browsers join via lobby, enter game, render teammates and accept inputs.');
}catch(e){
  console.error(e.stack||e);
  console.error('Browser errors:',problems);
  console.error('Server logs:',serverLogs.slice(-2000));
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  child.kill('SIGTERM');
}
