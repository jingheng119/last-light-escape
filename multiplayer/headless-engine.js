// Server-authoritative adapter for the existing Last Light simulation.
// Uses the ORIGINAL game rules in a headless Node VM, not a second rewrite.
// The VM runs trusted repository code only; it is not an untrusted-code sandbox.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const original=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const cut=original.indexOf('  // Simulation must not depend on requestAnimationFrame:');
if(cut<0)throw new Error('Game source marker missing: simulation bridge must be reviewed');

const bridge=`
  roomRole='host';
  const safeKeys=(input={})=>({
    up:input.up===true,down:input.down===true,
    left:input.left===true,right:input.right===true
  });
  const safeStick=(value={})=>({
    x:Number.isFinite(value.x)?clamp(value.x,-1,1):0,
    y:Number.isFinite(value.y)?clamp(value.y,-1,1):0
  });
  const perform=(id,action,direction)=>{
    if(state!=='playing')return;
    const run=()=>{
      if(action==='dash')dash(direction);
      else if(action==='decoy')triggerDecoy();
      else if(action==='interact')interact();
      else if(action==='ability')activateAbility();
    };
    if(id===1)run();
    else if(id===2&&guestPlayer)asGuest(run);
  };
  buildLevel(0);
  globalThis.__roomEngine={
    join(){
      if(!guestPlayer){roomCount=2;newGuest();}
    },
    leave(){guestPlayer=null;roomCount=1;remoteKeys=safeKeys();},
    hostLeft(){player.hp=0;moveHeld=safeKeys();roomCount=1;},
    role(id,value){
      const role=value==='medic'?'medic':'scout';
      if(id===1)classChoice=role;
      else guestClassChoice=role;
    },
    start(){
      if(!['menu','dead','victory'].includes(state))return;
      runSeed=Math.floor(Math.random()*1000000);
      overallElapsed=0;developerSkipped=false;buildLevel(0);
      state='playing';
    },
    next(){
      if(state!=='leveldone')return;
      buildLevel(levelIndex+1);state='playing';
    },
    restart(){if(state==='playing')buildLevel(levelIndex);},
    skip(fullStage=false){
      if(state==='playing'||state==='paused'||state==='leveldone')developerSkip(fullStage);
    },
    pause(){
      if(state==='playing')state='paused';
      else if(state==='paused')state='playing';
    },
    input(id,keys,stick){
      if(id===1){
        moveHeld=safeKeys(keys);
        const j=safeStick(stick);joystickMove.x=j.x;joystickMove.y=j.y;
      }else if(id===2&&guestPlayer){
        remoteKeys=safeKeys(keys);remoteStick=safeStick(stick);
      }
    },
    action:perform,
    tick(dt){
      frameIndex++;
      if(state==='playing')update(Math.min(.05,Math.max(0,dt)));
    },
    snapshot(full){
      const value={
        state,levelIndex,runSeed,elapsed,overallElapsed,clock,alertLevel,
        player,guestPlayer,cores,relay,exit,decoys,skillWaves,survivor,technician,
        classChoice,guestClassChoice,
        hollows:hollows.map(h=>({
          x:h.x,y:h.y,angle:h.angle,variant:h.variant,
          mode:h.mode,stunned:h.stunned,wobble:h.wobble,dashTime:h.dashTime
        })),
        overlay:{title:ui.title.textContent,text:ui.text.textContent}
      };
      if(full){
        value.grid=grid;value.cells=cells;value.roomTiles=[...roomTiles];
      }
      return value;
    }
  };
})();`;
// In the headless simulation, every action runs locally in the room engine.
// The browser-only guestAction hook must never send WebSocket messages.
const codeText=original.slice(0,cut)
  .replace('function guestAction(name){','function guestAction(name){return false;')
  .replace("function developerSkip(fullStage=false){if(roomRole==='host'){sendRoom({type:'skip',fullStage});return;}","function developerSkip(fullStage=false){")
  +bridge;
const fakeElement=()=>({
  textContent:'',dataset:{},getContext:()=>({}),children:[{textContent:''},{textContent:''}],
  firstChild:{textContent:''},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  style:{setProperty(){},getPropertyValue(){return '';}},
  setAttribute(){},addEventListener(){},querySelector(){return fakeElement();}
});
const fakeDocument={
  querySelector:()=>fakeElement(),
  querySelectorAll:()=>[],
  createElement:()=>({getContext:()=>({}),width:992,height:672})
};
export function createRoomEngine(){
  const context={
    document:fakeDocument,window:{},
    localStorage:{getItem:()=>null,setItem(){}},
    performance:{now:()=>Date.now()},
    setTimeout:()=>0,clearTimeout(){},
    console,Math,Date,Number,String,Boolean,JSON,Array,Object,Set,Map,
    structuredClone,
  };
  runInNewContext(codeText,context,{filename:'headless-original-game.js',timeout:4000});
  return context.__roomEngine;
}
