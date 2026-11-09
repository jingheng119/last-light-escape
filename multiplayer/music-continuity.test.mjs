import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Exercise the actual browser music scheduler with a minimal Web Audio stub.
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const start=source.indexOf('  function updateMusic(){');
const end=source.indexOf('  function ambientAudio()',start);
assert(start>=0&&end>start,'Music scheduler source must be locatable');
const scheduler=source.slice(start,end);
const ctx={
  soundEnabled:true,state:'playing',player:{},levelIndex:0,
  CONFIGS:[{stage:1},{stage:1},{stage:2},{stage:3}],
  MUSIC_SCALE:{1:{beat:.88},2:{beat:.70},3:{beat:.70}},
  musicBus:null,musicStage:0,musicStep:0,musicNextAt:0,musicMuted:false,alertLevel:0,
  audioCtx:{
    currentTime:0,state:'running',
    destination:{},
    createGain(){return {gain:{value:0,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}},connect(){}};}
  },
  // updateMusic calls stopMusic() as an unbound function; this is undefined
  // inside ES module mocks, so update the explicit VM context instead.
  stopMusic(){ctx.musicBus=null;ctx.musicNextAt=0;ctx.musicMuted=false;},
  scheduleWardBar(){},scheduleCopperBar(){},scheduleSignalBar(){},
  musicTone(){},window:{},
};
runInNewContext(scheduler+'\nthis.advanceMusic=updateMusic;',ctx);
ctx.advanceMusic();
const bus=ctx.musicBus;
assert(bus,'Playing starts background music');
const initialStep=ctx.musicStep;
for(const next of ['leveldone','paused','countdown','playing']){
  ctx.state=next;
  ctx.audioCtx.currentTime+=.55;
  ctx.advanceMusic();
  assert.strictEqual(ctx.musicBus,bus,'Music bus must remain the same during '+next);
  assert.equal(ctx.musicMuted,next==='countdown',
    'Only the countdown should mute the existing soundtrack');
  assert.equal(ctx.musicBus.gain.value,next==='countdown'?0:1,
    'Countdown must be silent; other game states remain audible');
}
assert(ctx.musicStep>initialStep,'Score timeline advances through silent countdown and pauses');
ctx.levelIndex=1;ctx.audioCtx.currentTime+=.5;ctx.advanceMusic();
assert.strictEqual(ctx.musicBus,bus,'Next floor of same stage must not restart music');
ctx.levelIndex=2;ctx.audioCtx.currentTime+=.5;ctx.advanceMusic();
assert.notStrictEqual(ctx.musicBus,bus,'New stage must switch to its own theme');
assert.equal(ctx.musicStage,2);
ctx.state='dead';ctx.advanceMusic();
assert.equal(ctx.musicBus,null,'Death stops background music');
console.log('PASS: music continues across floors and pauses, stays silent during countdown, and changes at new stage.');
