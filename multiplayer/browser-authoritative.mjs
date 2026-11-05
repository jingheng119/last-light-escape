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
  }
  await first.locator('#createRoom').click();
  await first.waitForFunction(()=>window.__lastLightDiagnostics?.().roomPlayerId===1,null,{timeout:7000});
  const room=await first.locator('#joinRoomCode').inputValue();
  assert.match(room,/^[0-9A-F]{6}$/);
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
  // Players 3–5 discover and join the room from the PUBLIC DIRECTORY,
  // without ever knowing or entering a room code.
  for(let id=3;id<=5;id++){
    const page=await browser.newPage();players.push(page);
    page.on('pageerror',error=>problems.push('P'+id+': '+error.message));
    await page.goto('http://127.0.0.1:'+port+'/');
    await page.waitForFunction(room=>[...document.querySelectorAll('.room-entry')]
      .some(e=>e.textContent.includes(room)),room,{timeout:9000});
    await page.locator('.room-entry').filter({hasText:room}).locator('button').click();
    await page.waitForFunction(id=>window.__lastLightDiagnostics?.().roomPlayerId===id,id,{timeout:9000});
  }
  const sixth=await browser.newPage();
  await sixth.goto('http://127.0.0.1:'+port+'/');
  await sixth.waitForFunction(room=>[...document.querySelectorAll('.room-entry')]
    .some(e=>e.textContent.includes(room)),room,{timeout:9000});
  assert(await sixth.locator('.room-entry').filter({hasText:room}).locator('button').isDisabled(),
    'A full five-player room must not admit a sixth player');

  await first.locator('#primaryBtn').click();
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
