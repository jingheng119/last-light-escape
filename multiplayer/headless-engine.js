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
  let countdownRemaining=0;
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
    else if(id>=3&&id<=5)withExtra(id,run);
  };
  buildLevel(0);
  globalThis.__roomEngine={
    join(id){
      if(id===2&&!guestPlayer)newGuest();
      else if(id>=3&&id<=5&&!extraPlayers[id-3]){
        extraPlayers[id-3]=structuredClone(player);
        extraPlayers[id-3].x=1.5;extraPlayers[id-3].y=1.5;
        extraPlayers[id-3].hp=3;extraPlayers[id-3].dashTime=0;
        extraPlayers[id-3].dashCooldown=0;extraPlayers[id-3].trail=[];
      }
      roomCount=allPlayers().length;
    },
    leave(id){
      if(id===1){player.hp=0;player.disconnected=true;moveHeld=safeKeys();}
      else if(id===2){guestPlayer=null;remoteKeys=safeKeys();}
      else if(id>=3&&id<=5){
        extraPlayers[id-3]=null;
        extraControls[id-3].keys=safeKeys();
      }
      roomCount=allPlayers().length;
    },
    rejoinHost(){
      player.disconnected=false;
      if(player.hp<=0){player.hp=1;player.invincible=2.5;player.x=1.5;player.y=1.5;}
      roomCount=allPlayers().length;
    },
    // Temporary network loss keeps the ORIGINAL character object, hearts,
    // coordinates, role and cooldowns intact. Only inputs are reset.
    suspend(id){
      if(id===1){player.disconnected=true;moveHeld=safeKeys();joystickMove.x=0;joystickMove.y=0;}
      else if(id===2&&guestPlayer){
        guestPlayer.disconnected=true;
        remoteKeys=safeKeys();remoteStick={x:0,y:0};
      }else if(id>=3&&id<=5&&extraPlayers[id-3]){
        extraPlayers[id-3].disconnected=true;
        extraControls[id-3].keys=safeKeys();
        extraControls[id-3].stick={x:0,y:0};
      }
      roomCount=allPlayers().length;
    },
    resume(id){
      const character=id===1?player:id===2?guestPlayer:extraPlayers[id-3];
      if(!character)return false;
      character.disconnected=false;
      // Do not heal or teleport a returning soul.
      character.dashTime=0;
      roomCount=allPlayers().length;
      return true;
    },
    role(id,value){
      const role=value==='medic'?'medic':'scout';
      if(id===1)classChoice=role;
      else if(id===2)guestClassChoice=role;
      else if(id>=3&&id<=5)extraControls[id-3].role=role;
    },
    start(){
      if(!['menu','dead','victory'].includes(state))return;
      runSeed=Math.floor(Math.random()*1000000);
      overallElapsed=0;developerSkipped=false;buildLevel(0);
      countdownRemaining=5;
      state='countdown';
    },
    next(){
      if(state!=='leveldone')return;
      buildLevel(levelIndex+1);state='playing';
    },
    restart(){if(state==='playing')buildLevel(levelIndex);},
    status(){return state;},
    skip(fullStage=false){
      if(state==='playing'||state==='paused'||state==='leveldone')developerSkip(fullStage);
    },
    pause(){
      if(state==='playing'){
        state='paused';setOverlay('BREATHING ROOM','The room is paused until play resumes.','RESUME GAME');
      }else if(state==='paused')state='playing';
    },
    input(id,keys,stick){
      if(id===1){
        moveHeld=safeKeys(keys);
        const j=safeStick(stick);joystickMove.x=j.x;joystickMove.y=j.y;
      }else if(id===2&&guestPlayer){
        remoteKeys=safeKeys(keys);remoteStick=safeStick(stick);
      }else if(id>=3&&id<=5&&extraPlayers[id-3]){
        extraControls[id-3].keys=safeKeys(keys);
        extraControls[id-3].stick=safeStick(stick);
      }
    },
    action:perform,
    // Used only by local/CI engine tests. There is no WebSocket command for it.
    testHit(id){
      const hit=()=>{player.invincible=0;player.dashTime=0;damage();};
      if(id===1)hit();
      else if(id===2&&guestPlayer)asGuest(hit);
      else if(id>=3&&id<=5)withExtra(id,hit);
    },
    tick(dt){
      frameIndex++;
      const step=Math.min(.05,Math.max(0,dt));
      if(state==='countdown'){
        countdownRemaining=Math.max(0,countdownRemaining-step);
        if(countdownRemaining<=0){
          // Holding movement before the countdown finishes must not give a
          // player a head start. Inputs arriving afterwards control movement.
          moveHeld=safeKeys();
          remoteKeys=safeKeys();
          joystickMove.x=0;joystickMove.y=0;
          for(const controls of extraControls){
            controls.keys=safeKeys();controls.stick={x:0,y:0};
          }
          state='playing';
        }
        return;
      }
      if(state==='playing')update(step);
    },
    snapshot(full){
      const value={
        state,levelIndex,runSeed,elapsed,overallElapsed,clock,alertLevel,
        countdownRemaining:state==='countdown'?countdownRemaining:0,
        player,guestPlayer,players:[player.disconnected?null:player,guestPlayer?.disconnected?null:guestPlayer,...extraPlayers.map(p=>p?.disconnected?null:p)],
        playerRoles:[classChoice,guestClassChoice,...extraControls.map(c=>c.role)],
        cores,relay,exit,decoys,noiseEvents,skillWaves,survivor,technician,
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
