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
  for(const [p,label] of [[first,'P1'],[second,'P2']]){
    p.on('pageerror',error=>problems.push(label+': '+error.message));
    await p.goto('http://127.0.0.1:'+port+'/');
    await p.locator('#roomStatus').getByText(/connected/i).waitFor({timeout:10000});
  }
  await first.locator('#createRoom').click();
  await first.locator('#roomStatus').getByText(/room created/i).waitFor({timeout:7000});
  const room=await first.locator('#joinRoomCode').inputValue();
  assert.match(room,/^[0-9A-F]{6}$/);
  await second.locator('#joinRoomCode').fill(room);
  await second.locator('#joinRoom').click();
  await second.locator('#roomStatus').getByText(/room joined/i).waitFor({timeout:7000});
  await first.locator('#primaryBtn').click();
  await first.waitForFunction(()=>window.__lastLightDiagnostics?.().state==='playing',{timeout:8000});
  await second.waitForFunction(()=>window.__lastLightDiagnostics?.().state==='playing',{timeout:8000});
  assert(await first.locator('#overlay').evaluate(el=>el.classList.contains('hidden')));
  assert(await second.locator('#overlay').evaluate(el=>el.classList.contains('hidden')));
  const hp1=await first.evaluate(()=>window.__lastLightDiagnostics().playerHP);
  const hp2=await second.evaluate(()=>window.__lastLightDiagnostics().playerHP);
  assert.equal(hp1,3);assert.equal(hp2,3);
  await first.keyboard.down('d');await second.keyboard.down('s');
  await sleep(350);
  await first.keyboard.up('d');await second.keyboard.up('s');
  await second.keyboard.press('Space');
  await sleep(300);
  if(problems.length)throw new Error('Browser JS errors: '+problems.join(' | '));
  console.log('PASS: Both real browsers leave Start menu, render shared room and accept inputs.');
}catch(e){
  console.error(e.stack||e);
  console.error('Browser errors:',problems);
  console.error('Server logs:',serverLogs.slice(-2000));
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  child.kill('SIGTERM');
}
