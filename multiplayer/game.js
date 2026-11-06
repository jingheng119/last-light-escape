/* LAST LIGHT: THE HOLLOW WARD
 * Original, dependency-free HTML Canvas survival / maze game.
 * All artwork is generated using Canvas primitives. No external assets or requests.
 */
(() => {
  'use strict';
  // Fixed render viewport, variable world dimensions by stage.
  const TILE=32,W=992,H=672;
  let COLS=31,ROWS=21;
  const STAGE_ONE_FLOORS=9,STAGE_TWO_SIZE={cols:61,rows:41};
  const CONFIGS = [
    { name: 'THE FIRST DESCENT', seed: 1709, cores: 2, enemies: 3, loops: 0.16, speed: 1.12, note: 'Hollows can see along corridors. Break line of sight to escape a pursuit.' },
    { name: 'THE DARK CIRCUIT', seed: 2911, cores: 3, enemies: 4, loops: 0.19, speed: 1.23, note: 'Tap Q to throw a sound decoy. Nearby Hollows will investigate the noise.' },
    { name: 'THE BROKEN WARD', seed: 4207, cores: 3, enemies: 5, loops: 0.21, speed: 1.34, note: 'The final normally lit floor. Learn to use cover and your class ability.' },
    { name: 'THE LOWER PASSAGES', seed: 5849, cores: 3, enemies: 5, loops: 0.19, speed: 1.37, note: 'The lights are fading. Stay close to your survivor.' },
    { name: 'THE SILENT BLOCK', seed: 6691, cores: 3, enemies: 6, loops: 0.18, speed: 1.40, note: 'Dim corridors hide moving Hollows. Use decoys strategically.' },
    { name: 'THE SHADOW ENGINE', seed: 7313, cores: 4, enemies: 6, loops: 0.20, speed: 1.43, note: 'Darkness deepens. Do not dash blindly into corridors.' },
    { name: 'THE BLACK ARCHIVE', seed: 8269, cores: 3, enemies: 6, loops: 0.18, speed: 1.43, note: 'Emergency lighting at 10%. Watch for enemies at close range.' },
    { name: 'THE LOST DEPTHS', seed: 9539, cores: 4, enemies: 7, loops: 0.20, speed: 1.46, note: 'Only your immediate surroundings are visible. Protect the survivor.' },
    { name: 'THE FINAL ASCENT', seed: 10867, cores: 4, enemies: 7, loops: 0.22, speed: 1.49, note: 'Find the last elevator and bring everyone into the light.' },
    // Stage II is ready for future Hollow and ally variants via metadata.
    { name:'THE COPPER ENGINE',seed:12419,cores:5,enemies:12,loops:0.24,speed:1.50,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 01 / 09.' },
    { name:'THE COPPER ENGINE',seed:13773,cores:5,enemies:12,loops:0.25,speed:1.52,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 02 / 09.' },
    { name:'THE COPPER ENGINE',seed:15131,cores:5,enemies:13,loops:0.26,speed:1.54,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 03 / 09.' },
    { name:'THE COPPER ENGINE',seed:16807,cores:5,enemies:13,loops:0.27,speed:1.56,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 04 / 09.' },
    { name:'THE COPPER ENGINE',seed:18061,cores:6,enemies:14,loops:0.23,speed:1.58,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 05 / 09.' },
    { name:'THE COPPER ENGINE',seed:19937,cores:6,enemies:14,loops:0.26,speed:1.60,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 06 / 09.' },
    { name:'THE COPPER ENGINE',seed:21401,cores:6,enemies:15,loops:0.25,speed:1.61,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 07 / 09.' },
    { name:'THE COPPER ENGINE',seed:23549,cores:6,enemies:15,loops:0.29,speed:1.63,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 08 / 09.' },
    { name:'THE COPPER ENGINE',seed:25717,cores:7,enemies:16,loops:0.28,speed:1.65,stage:2,architecture:'engine',enemyVariant:'standard',allyVariant:'survivor',theme:{floor:'#231b18',wall:'#130f10',trim:'#684a36',line:'#735845',glow:'#6f5641'},note:'STAGE II · Copper Engine · Sector 09 / 09.' },
  ];
  const $ = s => document.querySelector(s);
  const canvas = $('#game'), ctx = canvas.getContext('2d');
  const darknessCanvas = document.createElement('canvas');
  darknessCanvas.width = W; darknessCanvas.height = H;
  const darkCtx = darknessCanvas.getContext('2d');
  const ui = {
    health: $('#health'), cores: $('#cores'), relay: $('#relay'), timer: $('#timer'), threat: $('#threat'),
    dash: $('#dashStatus'), decoys: $('#decoys'), skillCD: $('#skillCD'), dashCD: $('#dashCD'), decoyCD: $('#decoyCD'), level: $('#missionLevel'), stageCard: $('#stageInfoCard'), mobileStage: $('#mobileStageInfo'),
    note: $('#fieldNote'), overlay: $('#overlay'), title: $('#overlayTitle'), text: $('#overlayText'),
    classSelect: $('#classSelect'), classStatus: $('#classStatus'), survivorStatus: $('#survivorStatus'), abilityStatus: $('#abilityStatus'),
    allyLabel: $('#allyStatusLabel'), rescueObjective: $('#rescueObjective'),
    button: $('#primaryBtn'), hint: $('#overlayHint'), toast: $('#toast'), flash: $('#screenFlash'),
    roleOptions: $('#roleOptions'), roleLocked: $('#roleLocked'), lockedRoleText: $('#lockedRoleText'), roleLabel: $('#roleChoiceLabel')
  };
  let state = 'menu', levelIndex = 0, grid, cells, player, cores, relay, exit, hollows, decoys, particles = [];
  let roomTiles = new Set(), noiseEvents = [], illusions = [], survivor = null, technician = null;
  // Slots 3–5 are simulated on the server, with the same original rules.
  // Browser snapshots use remotePlayers to render every teammate.
  let extraPlayers=[null,null,null],remotePlayers=[],roomPlayerId=0;
  let roomIdentity=new Map();
  // The two screens share a single live WebSocket connection. Switching
  // screens never removes a player from their server-side room.
  let activePage='lobby';
  let lastCountdownNumber=0;
  function showPage(target,push=true){
    const page=target==='play'&&roomRole!=='none'?'play':'lobby';
    activePage=page;
    $('#lobbyPage').hidden=page!=='lobby';
    $('#playPage').hidden=page!=='play';
    document.body.classList.toggle('show-lobby',page==='lobby');
    document.body.classList.toggle('show-play',page==='play');
    const url=new URL(location.href);
    url.pathname=page==='play'?'/play':'/';
    if(page==='play')url.searchParams.set('room',$('#joinRoomCode').value.trim().toUpperCase());
    else url.searchParams.delete('room');
    // Keep invitations clean: unrelated query parameters are not propagated.
    url.search='';
    if(page==='play')url.searchParams.set('room',$('#joinRoomCode').value.trim().toUpperCase());
    const next=url.pathname+url.search;
    if(push&&location.pathname+location.search!==next)history.pushState({screen:page},'',next);
    if(!push&&location.pathname+location.search!==next)history.replaceState({screen:page},'',next);
    document.title=page==='lobby'?'Survivor Lobby — Last Light':'Last Light — The Hollow Ward';
    if(page==='play'){
      $('#gameRoomName').textContent=$('#currentRoomName').textContent;
      $('#gameRoomCount').textContent=roomCount+' / 5 SURVIVORS';
      requestAnimationFrame(()=>updateCamera(0,true));
    }else stopMusic();
  }
  let runSeed=0;
  let roomRole='none',roomSocket=null,roomCount=0,guestPlayer=null,lastSync=0,lastInput=0,lastLevel=-1,lastSentStaticLevel=-1,lastFullSnapshot=0,remotePingAt=0,remotePingMs=null,lastGuestUIAt=0;
  let remoteKeys={up:false,down:false,left:false,right:false},remoteStick={x:0,y:0},guestClassChoice='scout',guestContextHost=null;
  let localDashUntil=0,localDashDir=null,hostInputClock=0,hostLastGuestInput=0;
  let guestPreviousHP=null,guestWasPlaying=false;
  let clientToastUntil=0,clientHitFlashUntil=0;
  let hollowVisualSample=0,hollowVisualVelocity=[];
  function guestInputPacket(){
    const packet={type:'input',keys:moveHeld,joystick:joystickMove};
    if(player&&roomRole!=='none'&&state==='playing')
      packet.pos={x:player.x,y:player.y};
    return packet;
  }
  // Small, wall-validated correction lets host-side collisions and abilities
  // stay close to where the remote player actually sees their character.
  function reconcileRemotePosition(pos){
    if(roomRole!=='host'||!guestPlayer||guestPlayer.hp<=0||state!=='playing')return;
    if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y))return;
    if(!canStand(pos.x,pos.y,.21)||!clearLine(guestPlayer,pos))return;
    const dx=pos.x-guestPlayer.x,dy=pos.y-guestPlayer.y,d=Math.hypot(dx,dy);
    if(d<=.01||d>1.6)return;
    const now=performance.now();
    const delta=hostLastGuestInput?Math.min(.12,(now-hostLastGuestInput)/1000):.05;
    hostLastGuestInput=now;
    const maxStep=(guestPlayer.dashTime>0?9:3.5)*delta+.15;
    const amount=Math.min(d,maxStep);
    moveEntity(guestPlayer,dx/d*amount,dy/d*amount,.21);
  }
  const sendRoom=m=>{if(roomSocket?.readyState===WebSocket.OPEN)roomSocket.send(JSON.stringify(m));};
  function showNetworkStatus(){
    const status=$('#networkStatus');
    if(!status)return;
    const label=remotePingMs===null?'measuring…':Math.round(remotePingMs)+' ms';
    const healthy=remotePingMs!==null&&remotePingMs<180;
    status.textContent=(roomRole==='host'?'HOST':'PLAYER '+roomPlayerId)+' · SERVER '+label+
      (remotePingMs!==null&&remotePingMs>250?' · HIGH LATENCY':'');
    status.style.color=remotePingMs===null?'#b1d4d0':healthy?'#8ee8d0':'#ffd19b';
  }
  function newGuest(){guestPlayer=structuredClone(player);guestPlayer.slot=2;guestPlayer.x=1.5;guestPlayer.y=1.5;guestPlayer.hp=3;guestPlayer.invincible=0;guestPlayer.dashTime=0;guestPlayer.dashCooldown=0;guestPlayer.decoys=3;guestPlayer.decoyCooldown=0;guestPlayer.abilityCooldown=0;guestPlayer.abilityCharges=SKILL_MAX_CHARGES[guestClassChoice];guestPlayer.anchor=null;guestPlayer.trail=[];}
  let extraContextGuest=null;
  function allPlayers(){
    // A player action temporarily swaps the global 'player' reference.
    // Preserve the host AND the original second player when actions or
    // collisions are evaluated for slots 2–5. Otherwise the second player's
    // death can incorrectly appear to be the last survivor.
    const originalHost=guestContextHost||player;
    const originalSecond=extraContextGuest||guestPlayer;
    return [...new Set([originalHost,originalSecond,...extraPlayers]
      .filter(p=>p&&!p.disconnected))];
  }
  function withExtra(slot,fn){
    const i=slot-3,extra=extraPlayers[i];
    if(!extra)return;
    const originalGuest=guestPlayer,originalKeys=remoteKeys,originalStick=remoteStick,
      originalRole=guestClassChoice,previousExtraContext=extraContextGuest;
    extraContextGuest=originalGuest;
    guestPlayer=extra;
    remoteKeys=extraControls[i]?.keys||{up:false,down:false,left:false,right:false};
    remoteStick=extraControls[i]?.stick||{x:0,y:0};
    guestClassChoice=extraControls[i]?.role||'scout';
    try{asGuest(fn);}
    finally{
      extraPlayers[i]=guestPlayer;guestPlayer=originalGuest;remoteKeys=originalKeys;
      remoteStick=originalStick;guestClassChoice=originalRole;
      extraContextGuest=previousExtraContext;
    }
  }
  let extraControls=[0,1,2].map(()=>({
    keys:{up:false,down:false,left:false,right:false},stick:{x:0,y:0},role:'scout'
  }));
  function asGuest(fn){
    if(!guestPlayer)return;
    const own=player,keys=moveHeld,jx=joystickMove.x,jy=joystickMove.y,ownClass=classChoice;
    guestContextHost=own;player=guestPlayer;moveHeld=remoteKeys;joystickMove.x=remoteStick.x;joystickMove.y=remoteStick.y;classChoice=guestClassChoice;
    try{fn();}finally{guestPlayer=player;player=own;moveHeld=keys;joystickMove.x=jx;joystickMove.y=jy;classChoice=ownClass;guestContextHost=null;}
  }
  // Only movement is predicted locally. Combat, pickups, health, objectives
  // and all victory conditions continue to come from the host's snapshots.
  function predictGuestMovement(dt){
    if(roomRole==='none'||state!=='playing'||!player||player.hp<=0||!grid)return;
    let vx=(moveHeld.right?1:0)-(moveHeld.left?1:0)+joystickMove.x;
    let vy=(moveHeld.down?1:0)-(moveHeld.up?1:0)+joystickMove.y;
    const magnitude=Math.hypot(vx,vy);
    if(magnitude>1){vx/=magnitude;vy/=magnitude;}
    if(magnitude>.08)player.facing={x:vx/Math.hypot(vx,vy),y:vy/Math.hypot(vx,vy)};
    if(performance.now()<localDashUntil&&localDashDir){
      player.dashDir={...localDashDir};
      player.dashTime=Math.max(player.dashTime,(localDashUntil-performance.now())/1000);
    }
    if(player.dashTime>0){
      const step=Math.min(player.dashTime,dt);
      player.dashTime=Math.max(0,player.dashTime-step);
      const hitWall=moveEntity(player,player.dashDir.x*9*step,player.dashDir.y*9*step,.21,.32);
      if(hitWall)player.dashTime=0;
    }else if(vx||vy){
      const touchSteering=Math.hypot(joystickMove.x,joystickMove.y)>.08;
      moveEntity(player,vx*3.5*dt,vy*3.5*dt,touchSteering?.18:.21,.30);
    }
  }
  function guestAction(name,touch=false,target=null){
    if(roomRole==='none')return false;
    // The authoritative server owns movement and dash activation. Do NOT
    // move the character or start a local dash before server confirmation:
    // that created visible desync around walls and Hollow collisions.
    const action={type:'action',name};
    if(name==='dash'){
      const vx=(moveHeld.right?1:0)-(moveHeld.left?1:0)+joystickMove.x;
      const vy=(moveHeld.down?1:0)-(moveHeld.up?1:0)+joystickMove.y;
      const magnitude=Math.hypot(vx,vy);
      const facing=player?.facing||{x:1,y:0};
      // Preserve the exact joystick heading, including diagonal input.
      // Wall contact is resolved by the server's axis-by-axis collision.
      action.direction=magnitude>.08?{x:vx/magnitude,y:vy/magnitude}:{x:facing.x,y:facing.y};
    }
    if(name==='dash'&&touch)action.touch=true;
    if(name==='ability'&&target)action.target=target;
    sendRoom(action);
    return true;
  }

  // Temporary developer shortcut. Skipped runs never enter the best-time record.
  let rewindTargeting=false,rewindTargetIndex=0;
  let developerSkipped=false;
  let classChoice = 'scout';
  let elapsed = 0, overallElapsed = 0, clock = 0, toastUntil = 0, hitFlash = 0, alertLevel = 0;
  let lastFrame = 0, audioCtx = null, soundEnabled = false, best = 0;
  let musicBus=null,musicNextAt=0,musicStep=0,musicStage=0;
  let nextAmbientAt = 0, nextWarningAt = 0, previousThreat = 0;
  const CAMERA_ZOOM = 1.65;
  const SCOUT_STUN_RADIUS = 5.5;
  const MEDIC_HEAL_RADIUS = 5.5;
  const SKILL_COOLDOWN = {scout:13,medic:26,invisibler:14,teleporter:16,illusioner:27,rewinder:29,anchor:10};
  const SKILL_MAX_CHARGES = {scout:1,medic:2,invisibler:1,teleporter:1,illusioner:2,rewinder:2,anchor:1};
  const ROLE_DETAILS={
    scout:{label:'SCOUT',skill:'STUN SHOCKWAVE',ready:'PULSE READY'},
    medic:{label:'MEDIC',skill:'HEALING BURST',ready:'HEAL READY'},
    invisibler:{label:'INVISIBLER',skill:'VANISH · 3 SECONDS',ready:'VANISH READY'},
    teleporter:{label:'TELEPORTER',skill:'PHASE GUARD · 5 SECONDS',ready:'GUARD READY'},
    illusioner:{label:'ILLUSIONER',skill:'PHANTOM DOUBLE · 5 SECONDS',ready:'PHANTOM READY'},
    rewinder:{label:'REWINDER',skill:'TARGET REWIND · 5.5 TILES',ready:'REWIND READY'},
    anchor:{label:'ANCHOR',skill:'PLACE ANCHOR · RETURN',ready:'ANCHOR READY'}
  };
  const ROLE_DESCRIPTIONS={
    scout: "Release a shockwave that stuns Hollows within 5.5 tiles for 2.5 seconds.",
    medic: "Restore 1 heart to yourself. At full health, heal one randomly chosen injured teammate within 5.5 tiles. No charge is spent if nobody needs healing.",
    invisibler: "Become invisible for 3 seconds, breaking Hollow pursuit and hiding your trail.",
    teleporter: "Activate Phase Guard for 5 seconds. If a Hollow strikes during this period, teleport to safety.",
    illusioner: "Summon an invincible roaming phantom that distracts Hollows for 5 seconds. Two phantoms can roam at once without replacing each other.",
    rewinder: "Choose yourself, a teammate, or a Hollow within 5.5 tiles; return that target to its position 3 seconds ago. Players gain 2 seconds of protection.",
    anchor: "Press Skill once to place an anchor. Press again to teleport back through walls with 2 seconds of protection. The charge is spent on return."
};
  function skillDescription(role){
    const charges=SKILL_MAX_CHARGES[role];
    return `${charges} ${charges===1?'CHARGE':'CHARGES'} · ${SKILL_COOLDOWN[role]}s COOLDOWN`;
  }
  function refreshActionDescription(action){
    const details=$('#skillTooltip');
    if(!details)return;
    const role=validRole(classChoice);
    const descriptions={
      skill:{title:ROLE_DETAILS[role].skill.split(' · ')[0],
        body:ROLE_DESCRIPTIONS[role],
        meta:skillDescription(role)},
      dash:{title:'DASH · QUICK ESCAPE',
        body:'Surge in your movement or facing direction for 0.24 seconds at 2.5 tiles. Dashing makes noise unless you are invisible.',
        meta:'3.5s COOLDOWN · DIRECTIONAL'},
      decoy:{title:'DECOY · SOUND DISTRACTION',
        body:'Throw a sound decoy about 3.3 tiles ahead to lure Hollows. It lasts 5 seconds and creates a noise pulse with an 11-tile radius.',
        meta:'3 CHARGES · 2s COOLDOWN · 11-TILE NOISE RADIUS'},
      use:{title:'USE · INTERACT',
        body:'Interact with nearby survivors, the technician, and the relays.',
        meta:'RANGE: ABOUT 1.5 TILES · NO COOLDOWN'}
    };
    const info=descriptions[action]||descriptions.skill;
    details.querySelector('.skill-description-title').textContent=info.title;
    details.querySelector('.skill-description-body').textContent=info.body;
    details.querySelector('.skill-description-meta').textContent=info.meta+
      (technician?.rescued&&action!=='use'?' · TECHNICIAN: 30% FASTER':'');
  }
  const validRole=role=>Object.hasOwn(ROLE_DETAILS,role)?role:'scout';
  const TECHNICIAN_COOLDOWN_FACTOR=.70;
  const cooldownFactor=()=>technician?.rescued?TECHNICIAN_COOLDOWN_FACTOR:1;
  const alliesReady=()=>survivor.rescued&&dist(survivor,exit)<2.0&&(!technician||(technician.rescued&&dist(technician,exit)<2.0));
  // A room with one player has one exit requirement; a room with two
  // players requires BOTH survivors to reach the elevator together.
  // All living players must reach the elevator; a downed player spectates.
  const playersAtExit=()=>allPlayers().every(p=>p.hp<=0||dist(p,exit)<1.1);
  let skillWaves = [];
  // Histories live only on the authoritative simulation, never in network snapshots.
  const rewindHistory=new WeakMap();
  const REWIND_SECONDS=3,REWIND_RADIUS=5.5;
  const hollowRewindHistory=new WeakMap();
  const camera = {x:0,y:0};
  let moveHeld = { up: false, down: false, left: false, right: false }, frameIndex = 0;
  const joystickMove={x:0,y:0};
  let rand = () => Math.random();
  try { best = Number(localStorage.getItem('last-light-best') || 0) || 0; } catch (e) { /* storage optional */ }
  const TILE_CENTER = (x, y) => ({ x: x + .5, y: y + .5 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const keyOf = (x, y) => y * COLS + x;
  const tileAt = p => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const floorAt = (x, y) => inBounds(x, y) && grid[y][x] === 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rng = seed => () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  const shuffle = arr => { for (let i=arr.length-1;i>0;i--) { const j=Math.floor(rand()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };
  const neighbors = (x,y) => dirs.map(([dx,dy])=>({x:x+dx,y:y+dy})).filter(p=>floorAt(p.x,p.y));

  function buildMaze(seed, extraLoops) {
    // A twisting, interconnected labyrinth with irregular chambers, side paths,
    // occasional two-wide passages and multiple alternate routes.
    rand=rng(seed);
    grid=Array.from({length:ROWS},()=>Array(COLS).fill(1));
    roomTiles=new Set();
    const carve=(x,y,room=false)=>{
      if(x<1||y<1||x>=COLS-1||y>=ROWS-1)return;
      grid[y][x]=0;
      if(room)roomTiles.add(keyOf(x,y));
    };
    // Start with a fully connected depth-first maze, not a sparse chain of rooms.
    const stack=[[1,1]];carve(1,1);
    while(stack.length){
      const [x,y]=stack[stack.length-1];
      const options=shuffle(dirs.map(([dx,dy])=>({x:x+2*dx,y:y+2*dy,mx:x+dx,my:y+dy})))
        .filter(p=>p.x>0&&p.y>0&&p.x<COLS-1&&p.y<ROWS-1&&grid[p.y][p.x]===1);
      if(!options.length){stack.pop();continue;}
      const n=options[0];carve(n.mx,n.my);carve(n.x,n.y);stack.push([n.x,n.y]);
    }
    // Broaden selected passages to create varied junctions and escape routes.
    for(let y=2;y<ROWS-2;y++)for(let x=2;x<COLS-2;x++){
      if(grid[y][x]!==1)continue;
      const horizontal=grid[y][x-1]===0&&grid[y][x+1]===0;
      const vertical=grid[y-1][x]===0&&grid[y+1][x]===0;
      if((horizontal||vertical)&&rand()<extraLoops*.65)carve(x,y);
    }
    // Irregular chambers are carved into the maze without sealing any corridors.
    // Their floors are contiguous but sizes and placements vary by floor/seed.
    const roomCount=levelIndex<STAGE_ONE_FLOORS?3+Math.floor(rand()*3):12+Math.floor(rand()*5);
    const rooms=[];
    for(let attempt=0;attempt<(levelIndex<STAGE_ONE_FLOORS?85:300)&&rooms.length<roomCount;attempt++){
      const w=levelIndex<STAGE_ONE_FLOORS?3+Math.floor(rand()*2):4+Math.floor(rand()*4);
      const h=levelIndex<STAGE_ONE_FLOORS?3+Math.floor(rand()*2):4+Math.floor(rand()*3);
      const x=2+Math.floor(rand()*(COLS-w-4));
      const y=2+Math.floor(rand()*(ROWS-h-4));
      if(x<5&&y<5)continue;
      if(rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y))continue;
      rooms.push({x,y,w,h});
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)carve(xx,yy,true);
      // Add a staggered alcove to some rooms for less rectangular layouts.
      if(rand()<.55){
        const side=Math.floor(rand()*4);
        const ax=side===0?x-1:side===1?x+w:x+Math.floor(w/2);
        const ay=side===2?y-1:side===3?y+h:y+Math.floor(h/2);
        carve(ax,ay,true);
      }
    }
    // Short side corridors and extra crossroads add navigational layers.
    for(let i=0;i<(levelIndex<STAGE_ONE_FLOORS?12:42);i++){
      const x=2+Math.floor(rand()*(COLS-4)),y=2+Math.floor(rand()*(ROWS-4));
      if(grid[y][x]!==1)continue;
      const open=dirs.filter(([dx,dy])=>grid[y+dy][x+dx]===0).length;
      if(open>=2&&rand()<.45)carve(x,y);
    }
    // Remove only one-tile isolated pillars inside walkable rooms. Long wall
    // structures and maze branches remain intact.
    for(let pass=0;pass<2;pass++){
      const singles=[];
      for(let y=2;y<ROWS-2;y++)for(let x=2;x<COLS-2;x++){
        if(grid[y][x]!==1)continue;
        if(dirs.every(([dx,dy])=>grid[y+dy][x+dx]===0))singles.push([x,y]);
      }
      for(const [x,y] of singles)carve(x,y);
    }
    cells=[];
    for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)
      if(grid[y][x]===0)cells.push({x,y});
  }
  function distanceMap(from) {
    const result = new Int16Array(COLS*ROWS).fill(-1), queue=[from], k=keyOf(from.x,from.y);result[k]=0;
    for(let head=0;head<queue.length;head++){
      const p=queue[head];for(const n of neighbors(p.x,p.y)){
        const id=keyOf(n.x,n.y);if(result[id]!==-1)continue;
        result[id]=result[keyOf(p.x,p.y)]+1;queue.push(n);
      }
    }
    return result;
  }
  function selectSpot(avoid, minimum, distances, bias=true) {
    const choices=cells.filter(p=>avoid.every(a=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)>=minimum));
    const pool=choices.length?choices:cells.filter(p=>avoid.every(a=>!(a.x===p.x&&a.y===p.y)));
    if(!pool.length)return {x:1,y:1};
    const ordered=pool.slice().sort((a,b)=>distances[keyOf(b.x,b.y)]-distances[keyOf(a.x,a.y)]);
    return ordered[Math.floor(rand()*Math.max(1,Math.round(ordered.length*(bias?.28:1))))];
  }
  function cameraTarget(){
    const viewW=W/CAMERA_ZOOM,viewH=H/CAMERA_ZOOM;
    // Eliminated players spectate their surviving teammate.
    const focus=player.hp<=0?(remotePlayers.find(p=>p.hp>0)||guestPlayer||player):player;
    return {
      x:clamp(focus.x*TILE-viewW/2,0,Math.max(0,COLS*TILE-viewW)),
      y:clamp(focus.y*TILE-viewH/2,0,Math.max(0,ROWS*TILE-viewH))
    };
  }
  function updateCamera(dt, snap=false){
    if(!player)return;
    const target=cameraTarget();
    const ease=snap?1:1-Math.exp(-9*dt);
    camera.x+=(target.x-camera.x)*ease;
    camera.y+=(target.y-camera.y)*ease;
  }
  function buildLevel(index) {
    // Hearts carry across floors in the same run. A fresh run (floor 1)
    // always starts with three hearts. Only the Medic skill restores health.
    // A downed player returns with one heart at the start of the next floor.
    const hostDisconnected=!!player?.disconnected;
    const carriedHealth=index>0&&player?Math.max(1,Math.min(3,player.hp)):3;
    const guestCarriedHealth=index>0&&guestPlayer?Math.max(1,Math.min(3,guestPlayer.hp)):3;
    const extraCarriedHealth=extraPlayers.map(p=>index>0&&p?Math.max(1,Math.min(3,p.hp)):3);
    const extraActive=extraPlayers.map(Boolean);
    levelIndex=index;const cfg=CONFIGS[index];
    COLS=cfg.stage===2?STAGE_TWO_SIZE.cols:31;
    ROWS=cfg.stage===2?STAGE_TWO_SIZE.rows:21;
    buildMaze(cfg.seed+runSeed,cfg.loops);
    const start={x:1,y:1}, distances=distanceMap(start), reserved=[start];
    exit=selectSpot(reserved,cfg.stage===2?35:18,distances);reserved.push(exit);
    cores=[];
    for(let i=0;i<cfg.cores;i++) {const p=selectSpot(reserved,cfg.stage===2?13:8,distances,i===0);reserved.push(p);cores.push({...TILE_CENTER(p.x,p.y),collected:false});}
    const switchSpot=selectSpot(reserved,cfg.stage===2?13:7,distances,false);reserved.push(switchSpot);
    relay={...TILE_CENTER(switchSpot.x,switchSpot.y),active:false};
    exit={...TILE_CENTER(exit.x,exit.y)};
    const survivorSpot=selectSpot(reserved,cfg.stage===2?13:7,distances,false);reserved.push(survivorSpot);
    survivor={...TILE_CENTER(survivorSpot.x,survivorSpot.y),variant:cfg.allyVariant||'survivor',rescued:false,extracted:false,followPath:[],followIndex:0,repath:0};
    technician=null;
    if(cfg.stage===2){
      const techSpot=selectSpot(reserved,13,distances,false);reserved.push(techSpot);
      technician={...TILE_CENTER(techSpot.x,techSpot.y),variant:'technician',rescued:false,extracted:false,followPath:[],followIndex:0,repath:0};
    }
    player={slot:1,...TILE_CENTER(1,1),hp:hostDisconnected?0:carriedHealth,disconnected:hostDisconnected,invincible:0,dashCooldown:0,dashTime:0,dashDir:{x:1,y:0},decoys:3,decoyCooldown:0,facing:{x:1,y:0},trail:[],abilityCooldown:0,abilityCharges:SKILL_MAX_CHARGES[classChoice],anchor:null};
    if(roomRole==='host'&&guestPlayer){newGuest();guestPlayer.hp=guestCarriedHealth;}
    for(let i=0;i<3;i++){
      if(extraActive[i]){
        extraPlayers[i]=structuredClone(player);
        extraPlayers[i].slot=i+3;
        extraPlayers[i].abilityCharges=SKILL_MAX_CHARGES[extraControls[i].role];
        extraPlayers[i].hp=extraCarriedHealth[i];
      }
    }
    hollows=[];
    for(let i=0;i<cfg.enemies;i++) {
      const p=selectSpot(reserved,cfg.stage===2?8:5,distances,false);reserved.push(p);
      const variant=cfg.stage===2?(i===0?'hunter':i<=5?'dasher':'standard'):(cfg.enemyVariant||'standard');
      hollows.push({x:p.x+.5,y:p.y+.5,variant,home:{x:p.x,y:p.y},speed:cfg.speed*(.9+rand()*.18)*(variant==='hunter'?1.27:1),
        path:[],pathIndex:0,repath:0,mode:'patrol',chaseUntil:0,target:null,angle:rand()*6.28,
        wobble:rand()*10,patrolWait:rand()*1.6,searchPoints:0,heardAt:-100,stunned:0,
        dashCooldown:variant==='dasher'?2+rand()*1.5:0,dashTime:0,dashDir:{x:0,y:0}});
    }
    decoys=[];illusions=[];noiseEvents=[];skillWaves=[];elapsed=0;alertLevel=0;hitFlash=0;particles=[];
    nextAmbientAt=clock+2;nextWarningAt=clock;previousThreat=0;
    updateCamera(0,true);
    ui.level.textContent=`BROWSER GAME V4.19 · STAGE ${cfg.stage===2?'02':'01'} · FLOOR ${String(index%STAGE_ONE_FLOORS+1).padStart(2,'0')} / 09`;
    ui.stageCard.textContent=ui.level.textContent;
    ui.mobileStage.children[0].textContent='BROWSER GAME V4.19';
    ui.mobileStage.children[1].textContent=`STAGE ${cfg.stage===2?'02':'01'} · FLOOR ${String(index%STAGE_ONE_FLOORS+1).padStart(2,'0')} / 09`;
    ui.note.textContent=cfg.note;
    ui.allyLabel.textContent=cfg.stage===2?'ALLIES':'SURVIVOR';
    ui.rescueObjective.textContent=cfg.stage===2?'✚ Rescue both allies':'✚ Rescue the survivor';
    const gameShell=$('.game-shell');
    gameShell.classList.toggle('stage-two',cfg.stage===2);
    gameShell.style.setProperty('--stage-accent',cfg.theme?.glow||'#7ae3c5');
    updateUI();
  }
  function pathTo(from,to) {
    const start=tileAt(from), end=tileAt(to);
    if(!floorAt(end.x,end.y) || !floorAt(start.x,start.y))return [];
    const previous = new Int32Array(COLS*ROWS).fill(-1), startKey=keyOf(start.x,start.y), endKey=keyOf(end.x,end.y);
    const queue=[startKey];previous[startKey]=startKey;
    for(let head=0;head<queue.length;head++){
      const k=queue[head];if(k===endKey)break;
      const x=k%COLS,y=Math.floor(k/COLS);
      for(const n of neighbors(x,y)) {const nk=keyOf(n.x,n.y);if(previous[nk]!==-1)continue;previous[nk]=k;queue.push(nk);}
    }
    if(previous[endKey]===-1)return [];
    const result=[];let current=endKey;
    while(current!==startKey) {result.push(TILE_CENTER(current%COLS,Math.floor(current/COLS)));current=previous[current];}
    return result.reverse();
  }
  function canStand(x,y,r=.26) {
    for(const dx of [-r,r])for(const dy of [-r,r])if(!floorAt(Math.floor(x+dx),Math.floor(y+dy)))return false;
    return true;
  }
  function moveEntity(e,dx,dy,r=.26,assist=0) {
    // Continuous short steps preserve solid-wall collision even at dash speed.
    // Sliding keeps the free axis moving; doorway assist smoothly centers the
    // player into an open lane instead of requiring pixel-perfect steering.
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.07));
    const sx=dx/steps,sy=dy/steps;
    let stalled=0;
    // Limit automatic sideways steering per frame so controls still feel manual.
    let correctionBudget=Math.min(assist*.28,.075);
    function moveAxis(axis,delta) {
      if(!delta)return false;
      if(canStand(e.x+(axis==='x'?delta:0),e.y+(axis==='y'?delta:0),r)){
        e[axis]+=delta;return true;
      }
      let lo=0,hi=1;
      for(let k=0;k<9;k++){
        const mid=(lo+hi)/2;
        if(canStand(e.x+(axis==='x'?delta*mid:0),
                    e.y+(axis==='y'?delta*mid:0),r))lo=mid;
        else hi=mid;
      }
      if(lo>.001){e[axis]+=delta*lo;return true;}
      return false;
    }
    function enterOpenLane() {
      if(assist<=0||correctionBudget<=.001)return false;
      const alongX=Math.abs(sx)>=Math.abs(sy);
      const forward=alongX?sx:sy;
      if(!forward)return false;
      const major=alongX?'x':'y',sideAxis=alongX?'y':'x';
      // Only help when forward motion is blocked, and no strong steering
      // toward a different corridor was requested.
      const secondary=alongX?sy:sx;
      if(Math.abs(secondary)>Math.abs(forward)*.70)return false;
      const initial=e[sideAxis],ahead=Math.sign(forward)*.12;
      let target=null;
      for(let offset=.04;offset<=assist+.0001;offset+=.04){
        for(const dir of [1,-1]){
          if(secondary && Math.sign(secondary)!==dir)continue;
          const candidate=initial+dir*offset;
          // The side movement and the forward opening must both be clear.
          let safe=true;
          for(let d=.04;d<=offset+.00001;d+=.04){
            const t=initial+dir*Math.min(d,offset);
            if(!canStand(alongX?e.x:t,alongX?t:e.y,r)){safe=false;break;}
          }
          if(!safe)continue;
          if(!canStand(alongX?e.x+ahead:candidate,
                        alongX?candidate:e.y+ahead,r))continue;
          target=candidate;break;
        }
        if(target!==null)break;
      }
      if(target===null)return false;
      // Gradual nudge, capped per substep, avoids snapping through corners.
      const delta=Math.sign(target-initial)*Math.min(Math.abs(target-initial),.025,correctionBudget);
      const before=e[sideAxis];
      const moved=moveAxis(sideAxis,delta);
      correctionBudget-=Math.abs(e[sideAxis]-before);
      return moved;
    }
    for(let i=0;i<steps;i++){
      const beforeX=e.x,beforeY=e.y;
      if(canStand(e.x+sx,e.y+sy,r)){e.x+=sx;e.y+=sy;continue;}
      const majorX=Math.abs(sx)>=Math.abs(sy);
      const first=majorX?'x':'y',second=majorX?'y':'x';
      const forward=majorX?sx:sy;
      const advanced=moveAxis(first,forward);
      moveAxis(second,majorX?sy:sx);
      if(!advanced){
        // When a doorway is slightly off-center, gently steer toward the
        // nearest collision-free entrance while preserving the intended heading.
        if(enterOpenLane())moveAxis(first,forward);
      }
      if(Math.hypot(e.x-beforeX,e.y-beforeY)<.001)stalled++;
    }
    return stalled>=Math.max(1,Math.ceil(steps*.70));
  }
  function clearLine(a,b) {
    const len=dist(a,b), steps=Math.max(1,Math.ceil(len*7));
    for(let i=1;i<steps;i++) {const t=i/steps;if(!floorAt(Math.floor(a.x+(b.x-a.x)*t),Math.floor(a.y+(b.y-a.y)*t)))return false;}
    return true;
  }
  function beep(freq=440,duration=.12,type='sine',volume=.035) {
    if(!soundEnabled)return;
    try {audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,audioCtx.currentTime);g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);osc.connect(g).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);}catch(e){}
  }
  // One short cue per server-confirmed countdown number, not per render
  // frame or snapshot. A brighter final tone signals the start is imminent.
  function countdownBeep(number){
    if(!soundEnabled||activePage!=='play'||number<1||number>5)return;
    const frequency=[0,880,740,660,587,523][number];
    beep(frequency,number===1?.32:.16,number===1?'triangle':'sine',
      number===1?.065:.045);
  }
  // Original generative dark-ambient score. All notes are composed here and
  // synthesized locally; no third-party recordings or background downloads.
  // Stage I is restrained and ominous; Stage II adds brighter circuitry and
  // a stronger electronic pulse. Sound starts only after a user click.
  const MUSIC_SCALE={
    1:{bass:[55.00,55.00,51.91,48.99],notes:[164.81,146.83,155.56,130.81],beat:.88},
    2:{bass:[65.41,61.74,58.27,61.74],notes:[196.00,207.65,174.61,185.00],beat:.70}
  };
  function stopMusic(){
    if(!musicBus)return;
    try{
      const t=audioCtx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setTargetAtTime(0,t,.045);
    }catch(e){}
    musicBus=null;musicNextAt=0;
  }
  function musicTone(freq,at,duration,type,volume,filterFrequency=0){
    if(!audioCtx||!musicBus)return;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type;
    o.frequency.setValueAtTime(freq,at);
    g.gain.setValueAtTime(.0001,at);
    g.gain.linearRampToValueAtTime(volume,at+Math.min(.18,duration*.22));
    g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    if(filterFrequency){
      const f=audioCtx.createBiquadFilter();
      f.type='lowpass';f.frequency.value=filterFrequency;
      o.connect(f);f.connect(g);
    }else o.connect(g);
    g.connect(musicBus);
    o.start(at);o.stop(at+duration+.03);
  }
  function updateMusic(){
    if(!soundEnabled||state!=='playing'||!player){
      stopMusic();return;
    }
    try{
      audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')return;
      const stage=CONFIGS[levelIndex].stage===2?2:1;
      if(!musicBus||musicStage!==stage){
        stopMusic();
        musicBus=audioCtx.createGain();
        // Use a normal master gain. Individual score voices are mixed
        // audibly at the source, rather than amplifying a near-silent mix.
        musicBus.gain.value=1.0;
        musicBus.connect(audioCtx.destination);
        musicStage=stage;musicStep=0;musicNextAt=audioCtx.currentTime+.07;
      }
      const score=MUSIC_SCALE[stage];
      // Schedule only a short look-ahead. No accumulating timers or intervals.
      let scheduled=0;
      while(musicNextAt<audioCtx.currentTime+.12&&scheduled++<3){
        const beat=score.beat,step=musicStep++,t=musicNextAt;
        const group=Math.floor(step/8)%score.bass.length;
        if(step%8===0){
          // The low bass (49–65 Hz) is hard to hear on phone speakers.
          // Give it audible harmonics without losing the dark foundation.
          musicTone(score.bass[group],t,beat*7.9,'sine',.060,420);
          musicTone(score.bass[group]*2,t+.04,beat*6.6,'triangle',.042,700);
          musicTone(score.bass[group]*4,t+.08,beat*5.2,'sine',.020,1100);
        }
        // Soft pulsing rhythm that becomes more urgent when Hollows pursue.
        const pulse=alertLevel===2?.045:alertLevel===1?.035:.025;
        musicTone(stage===1?146.84:196,t,beat*.36,'triangle',pulse,620);
        if(step%4===2){
          const note=score.notes[(Math.floor(step/4)+group)%score.notes.length];
          musicTone(note,t,beat*3.3,'triangle',stage===1?.065:.070,1250);
          musicTone(note*2,t+.08,beat*2.6,'sine',.030,1800);
          musicTone(note*.5,t+.12,beat*3.1,'sine',.018,560);
        }
        musicNextAt+=beat*(alertLevel===2?.88:1);
      }
      if(musicNextAt<audioCtx.currentTime-.5)musicNextAt=audioCtx.currentTime+.05;
    }catch(e){stopMusic();}
  }
  function ambientAudio() {
    // All audio is generated locally with Web Audio and remains off by default.
    if(!soundEnabled||state!=='playing')return;
    if(clock>=nextAmbientAt){
      // Sparse low-frequency pulses create a distant industrial ambience.
      beep(67+Math.random()*15,.7,'sine',.009);
      nextAmbientAt=clock+5+Math.random()*4;
    }
    if(alertLevel>0&&clock>=nextWarningAt){
      const severe=alertLevel===2;
      beep(severe?105:165,severe?.17:.12,'triangle',severe?.035:.019);
      nextWarningAt=clock+(severe?.75:1.9);
    }
    if(alertLevel===2&&previousThreat<2)beep(380,.12,'square',.017);
    previousThreat=alertLevel;
  }
  function notify(msg,seconds=2.7) {
    ui.toast.textContent=msg;
    toastUntil=clock+seconds;
    if(roomRole!=='none')clientToastUntil=performance.now()+seconds*1000;
    ui.toast.classList.add('show');
  }
  function refreshRoleSelection(){
    // Only the initial/new-run menu permits choosing a class. Paused and
    // cleared floors display the locked role instead of editable choices.
    const choosing=state==='menu'||state==='dead'||state==='victory';
    ui.roleOptions.hidden=!choosing;
    ui.roleLocked.hidden=choosing;
    ui.roleLabel.firstChild.textContent=choosing?'CHOOSE YOUR ROLE ':'YOUR ROLE ';
    ui.lockedRoleText.textContent=ROLE_DETAILS[classChoice].label+' · '+ROLE_DETAILS[classChoice].skill;
    if($('#lobbyClass'))$('#lobbyClass').value=classChoice;
    document.querySelectorAll('.role-option').forEach(card=>{
      const selected=card.dataset.role===classChoice;
      card.classList.toggle('is-selected',selected);
      card.setAttribute('aria-pressed',String(selected));
    });
  }
  function setOverlay(title,text,button,hint='WASD / ARROWS TO MOVE · SPACE TO DASH') {
    refreshRoleSelection();
    ui.title.textContent=title;ui.text.textContent=text;ui.button.firstChild.textContent=button+' ';ui.hint.textContent=hint;
    ui.overlay.classList.remove('hidden');
  }
  function hideOverlay(){ui.overlay.classList.add('hidden');}
  function unlockGameAudio(){
    // Only initiate audio on a player-initiated Start / Resume action.
    // Browser autoplay policies require an actual user gesture.
    soundEnabled=true;
    if(!audioCtx){try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){soundEnabled=false;return;}}
    try{if(audioCtx.state==='suspended')audioCtx.resume();}catch(e){}
    nextAmbientAt=clock+.5;nextWarningAt=clock;
  }
  function startGame(){if(roomRole==='none'){notify('Create a room first.');return;}unlockGameAudio();sendRoom({type:'start'});return;developerSkipped=false;runSeed=Math.floor(Math.random()*1000000);overallElapsed=0;buildLevel(0);state='playing';hideOverlay();notify('Rescue the survivor, collect cores, and reach the elevator.');beep(560,.16);}
  function advance() {
    if(roomRole!=='none'){
      unlockGameAudio();
      if(roomRole!=='host')return;
      if(state==='menu'||state==='victory'||state==='dead')sendRoom({type:'start'});
      else if(state==='leveldone')sendRoom({type:'next'});
      else if(state==='paused')sendRoom({type:'pause'});
      return;
    }
    if(roomRole!=='host'){notify('Create a room first.');return;}
    unlockGameAudio();
    if(state==='menu'||state==='victory'||state==='dead'){startGame();return;}
    if(state==='leveldone') {buildLevel(levelIndex+1);state='playing';hideOverlay();notify('New floor. Stay quiet.');return;}
    if(state==='paused') {state='playing';hideOverlay();return;}
  }
  function developerSkip(fullStage=false){if(roomRole==='host'){sendRoom({type:'skip',fullStage});return;}if(roomRole!=='host')return;
    if(state!=='playing'&&state!=='paused'&&state!=='leveldone')return;
    developerSkipped=true;
    // M advances one floor; Shift+M jumps from Stage I to Stage II,
    // or to Stage II's final floor for endgame testing.
    const target=fullStage?(levelIndex<STAGE_ONE_FLOORS?STAGE_ONE_FLOORS:CONFIGS.length-1):levelIndex+1;
    if(target>=CONFIGS.length){
      state='victory';
      setOverlay('DEVELOPER TEST COMPLETE','You reached the end using the test shortcut. This run will not record a best time.','PLAY AGAIN','TEST MODE · PROGRESSION CHECK');
      return;
    }
    buildLevel(target);
    state='playing';hideOverlay();
    notify(fullStage?'DEV · Stage jump':'DEV · Floor skipped');
  }
  function pause(){if(roomRole!=='none'){if(roomRole==='host')sendRoom({type:'pause'});return;}if(state==='playing'){state='paused';setOverlay('BREATHING ROOM','The ward is silent. Your position is safe until you resume.','RESUME GAME');}else if(state==='paused'){unlockGameAudio();state='playing';hideOverlay();}}
  function triggerDecoy(){if(roomRole!=='none'&&player?.hp<=0)return;if(guestAction('decoy'))return;
    if(state!=='playing'||player.hp<=0||player.decoys<=0||player.decoyCooldown>0)return;
    player.decoys--;const p={x:player.x+player.facing.x*3.3,y:player.y+player.facing.y*3.3};
    const nearest=cells.filter(c=>dist({x:c.x+.5,y:c.y+.5},p)<4).sort((a,b)=>dist({x:a.x+.5,y:a.y+.5},p)-dist({x:b.x+.5,y:b.y+.5},p))[0];
    if(!nearest){player.decoys++;return;}
    player.decoyCooldown=2*cooldownFactor();
    decoys.push({...TILE_CENTER(nearest.x,nearest.y),life:5,age:0});
    noiseEvents.push({x:nearest.x+.5,y:nearest.y+.5,radius:11,expires:clock+1.7});
    notify('Sound decoy deployed — they heard it!');beep(850,.22,'square',.016);
    updateUI();
  }
  function dash(directionOverride=null,touch=false){if(roomRole!=='none'&&player?.hp<=0)return;if(guestAction('dash',touch))return;if(state!=='playing'||player.hp<=0||player.dashCooldown>0)return;player.dashCooldown=3.5*cooldownFactor();player.dashTime=.24;
    // Keep the mobile collision radius for the whole dash, even if the
    // joystick's next input packet arrives after the DASH action.
    player.dashTouch=touch===true;
    const vx=(moveHeld.right?1:0)-(moveHeld.left?1:0)+joystickMove.x;
    const vy=(moveHeld.down?1:0)-(moveHeld.up?1:0)+joystickMove.y;
    if(directionOverride&&Number.isFinite(directionOverride.x)&&Number.isFinite(directionOverride.y)&&Math.hypot(directionOverride.x,directionOverride.y)>.1){
      const len=Math.hypot(directionOverride.x,directionOverride.y);
      player.dashDir={x:directionOverride.x/len,y:directionOverride.y/len};
    }else if(vx||vy){const len=Math.hypot(vx,vy);player.dashDir={x:vx/len,y:vy/len};}else player.dashDir={...player.facing};
    if(!(player.invisibleTime>0))
      noiseEvents.push({x:player.x,y:player.y,radius:8,expires:clock+.45});
    beep(220,.17,'sawtooth',.019);updateUI();
  }
  function interact(){if(roomRole!=='none'&&player?.hp<=0)return;if(guestAction('interact'))return;if(state!=='playing'||player.hp<=0)return;
    if(!survivor.rescued&&dist(player,survivor)<1.5){survivor.rescued=true;survivor.repath=0;notify('SURVIVOR RESCUED — guide them to the elevator!');beep(730,.22);updateUI();return;}
    if(technician&&!technician.rescued&&dist(player,technician)<1.5){
      technician.rescued=true;technician.repath=0;
      // Existing timers shrink immediately; future uses get 30% shorter cooldowns.
      player.dashCooldown*=TECHNICIAN_COOLDOWN_FACTOR;
      player.abilityCooldown*=TECHNICIAN_COOLDOWN_FACTOR;
      player.decoyCooldown*=TECHNICIAN_COOLDOWN_FACTOR;
      notify('TECHNICIAN RESCUED — ALL COOLDOWNS 30% FASTER!',2.3);
      beep(970,.24);updateUI();return;
    }
    if(dist(player,relay)<1.55){if(!relay.active){relay.active=true;notify('Relay activated! Emergency elevator online if all cores are found.');beep(740,.21);beep(920,.23);}else notify('Relay already active.');updateUI();return;}
    if(dist(player,exit)<1.45){
      if(cores.every(c=>c.collected)&&relay.active&&alliesReady()&&playersAtExit())completeLevel();
      else notify(!survivor.rescued?'RESCUE THE SURVIVOR FIRST':technician&&!technician.rescued?'RESCUE THE TECHNICIAN FIRST':!alliesReady()?'WAIT FOR BOTH ALLIES':!cores.every(c=>c.collected)||!relay.active?'ELEVATOR LOCKED — collect cores and activate the relay.':'WAIT FOR YOUR TEAMMATE AT THE ELEVATOR');
      return;
    }
    notify('Get closer to an ally, relay, or elevator.');
  }
  function recordPosition(historyMap,entity){
    let samples=historyMap.get(entity);
    if(!samples){samples=[];historyMap.set(entity,samples);}
    samples.push({t:clock,x:entity.x,y:entity.y});
    while(samples.length>1&&samples[1].t<clock-REWIND_SECONDS-.15)
      samples.shift();
  }
  function recordRewindPosition(p){recordPosition(rewindHistory,p);}
  function rewindDestination(p,historyMap=rewindHistory){
    const history=historyMap.get(p)||[];
    const cutoff=clock-REWIND_SECONDS;
    const prior=[...history].reverse().find(sample=>sample.t<=cutoff)||
      history[0]||{x:p.x,y:p.y};
    // Return to the recorded position even when another entity occupies it.
    return {x:prior.x,y:prior.y};
  }
  function rewindChoices(){
    if(!player||state!=='playing')return [];
    const self={kind:'player',slot:roomPlayerId||1,entity:player,label:'SELF'};
    const allies=remotePlayers.filter(p=>p.hp>0&&!p.disconnected&&dist(p,player)<=REWIND_RADIUS)
      .map(p=>({kind:'player',slot:p.slot,entity:p,label:'ALLY '+p.slot}));
    const enemies=hollows.map((h,index)=>({kind:'hollow',index,entity:h,label:'HOLLOW'}))
      .filter(t=>dist(t.entity,player)<=REWIND_RADIUS);
    return [self,...allies,...enemies];
  }
  function chosenRewindTarget(){
    const choices=rewindChoices();
    if(!choices.length)return null;
    rewindTargetIndex=((rewindTargetIndex%choices.length)+choices.length)%choices.length;
    return choices[rewindTargetIndex];
  }
  function cancelRewindTarget(){rewindTargeting=false;}
  function commitRewindTarget(choice){
    if(!choice)return;
    rewindTargeting=false;
    activateAbility({kind:choice.kind,...(choice.kind==='hollow'?{index:choice.index}:{slot:choice.slot})});
  }
  function maxSkillCharges(role=classChoice){return SKILL_MAX_CHARGES[role]||1;}
  function skillCharges(p=player,role=classChoice){
    return Number.isFinite(p.abilityCharges)?
      Math.max(0,Math.min(maxSkillCharges(role),p.abilityCharges)):maxSkillCharges(role);
  }
  function canUseSkill(){return player&&skillCharges()>0;}
  function consumeSkillCharge(){
    const before=skillCharges();
    if(before<=0)return false;
    player.abilityCharges=before-1;
    // Server-authoritative activation counter for reliable sound playback,
    // including second charges while the first recharge is running.
    player.abilityUseSerial=(player.abilityUseSerial||0)+1;
    // Sequential recharge: a second use queues behind the first timer.
    if(before===maxSkillCharges())player.abilityCooldown=SKILL_COOLDOWN[classChoice]*cooldownFactor();
    return true;
  }
  function requestAbility(){
    if(classChoice!=='rewinder'){activateAbility();return;}
    if(state!=='playing'||!player||player.hp<=0||!canUseSkill())return;
    if(!rewindTargeting){
      rewindTargeting=true;rewindTargetIndex=0;
      notify('REWINDER — tap a target, or TAB to choose and F/ENTER to confirm.',3);
    }else commitRewindTarget(chosenRewindTarget());
  }
  function activateAbility(rewindTarget=null){if(roomRole!=='none'&&player?.hp<=0)return;if(guestAction('ability',false,rewindTarget))return;
    if(state!=='playing'||player.hp<=0||(!canUseSkill()&&!(classChoice==='anchor'&&player.anchor)))return;
    if(classChoice==='medic'){
      // Self-healing always takes priority. When healthy, heal exactly one
      // randomly selected injured, connected, living teammate in range.
      const target=player.hp<3?player:(()=>{
        const candidates=allPlayers().filter(p=>p!==player&&p.hp>0&&p.hp<3&&
          dist(p,player)<=MEDIC_HEAL_RADIUS);
        return candidates.length?candidates[Math.floor(Math.random()*candidates.length)]:null;
      })();
      if(!target){notify('MEDIC — no injured teammate within range.');return;}
      target.hp=Math.min(3,target.hp+1);
      consumeSkillCharge();
      skillWaves.push({x:player.x,y:player.y,healX:target.x,healY:target.y,
        radius:MEDIC_HEAL_RADIUS,age:0,duration:.7,color:'medic'});
      notify(target===player?'MEDIC — one health restored!':
        'MEDIC — teammate healed for one heart!');
      beep(880,.25);
    }else if(classChoice==='invisibler'){
      player.invisibleTime=3;
      consumeSkillCharge();
      // Break pursuit immediately: Hollows must not retain the caster's
      // prior position as a target while invisibility is active.
      for(const h of hollows){
        if(h.mode==='chase'&&h.chasedPlayer===player){
          h.mode='search';h.target=null;h.chasedPlayer=null;
          h.path=[];h.pathIndex=0;
          h.repath=0;h.chaseUntil=clock;
          if(h.variant==='dasher')h.dashTime=0;
        }
      }
      notify('INVISIBLER — Hollows lost your trail for 3 seconds!');
      beep(1040,.24,'triangle',.024);
    }else if(classChoice==='teleporter'){
      player.phaseGuardTime=5;
      consumeSkillCharge();
      notify('TELEPORTER — Phase Guard active for 5 seconds!');
      beep(700,.24,'triangle',.025);
    }else if(classChoice==='rewinder'){
      // A single explicitly chosen target. The authoritative simulation checks
      // distance again so clients cannot target out-of-range enemies or allies.
      const chosen=rewindTarget&&rewindTarget.kind==='hollow'&&Number.isInteger(rewindTarget.index)
        ?hollows[rewindTarget.index]
        :rewindTarget&&rewindTarget.kind==='player'&&Number.isInteger(rewindTarget.slot)
          ?allPlayers().find(p=>p.slot===rewindTarget.slot):null;
      if(!chosen||chosen.disconnected||chosen.hp===0||
         dist(chosen,player)>REWIND_RADIUS){
        notify('REWINDER — select a valid target within range.');return;
      }
      const isHollow=rewindTarget.kind==='hollow';
      const destination=rewindDestination(chosen,isHollow?hollowRewindHistory:rewindHistory);
      const from={x:chosen.x,y:chosen.y};
      chosen.x=destination.x;chosen.y=destination.y;
      chosen.dashTime=0;
      if(isHollow){
        chosen.path=[];chosen.pathIndex=0;chosen.repath=0;
        chosen.target=null;chosen.chasedPlayer=null;chosen.chaseUntil=clock;
        chosen.mode='search';
        hollowRewindHistory.set(chosen,[{t:clock,x:chosen.x,y:chosen.y}]);
      }else{
        chosen.invincible=Math.max(chosen.invincible,2);
        rewindHistory.set(chosen,[{t:clock,x:chosen.x,y:chosen.y}]);
      }
      consumeSkillCharge();
      skillWaves.push({x:from.x,y:from.y,radius:.8,age:0,duration:.5,color:'rewinder'});
      skillWaves.push({x:chosen.x,y:chosen.y,radius:1.3,age:0,duration:.55,color:'rewinder'});
      notify('REWINDER — target returned 3 seconds!'+(isHollow?'':' 2s protection.'));
      beep(1080,.22,'triangle',.028);
    }else if(classChoice==='anchor'){
      if(!player.anchor){
        player.anchor={x:player.x,y:player.y};
        notify('ANCHOR — placed. Press F again to return!');
        beep(760,.18,'triangle',.024);
      }else{
        const destination=player.anchor;
        // Anchor records a walkable position. Return bypasses wall paths,
        // and invulnerability applies before the next collision test.
        player.x=destination.x;player.y=destination.y;
        player.anchor=null;
        player.invincible=Math.max(player.invincible,2);
        player.dashTime=0;
        consumeSkillCharge();
        skillWaves.push({x:player.x,y:player.y,radius:1.6,age:0,duration:.6,color:'teleporter'});
        notify('ANCHOR — returned! Invincible for 2 seconds.');
        beep(1040,.23,'triangle',.03);
      }
    }else if(classChoice==='illusioner'){
      // The illusion is independent of its caster: it never takes damage,
      // collects objectives, or blocks real survivors.
      const heading=Math.hypot(player.facing.x,player.facing.y)||1;
      const ownerSlot=allPlayers().indexOf(player)+1;
      // Each charge summons its own phantom; existing phantoms keep moving
      // and expire individually after their original five seconds.
      const axisX=Math.abs(player.facing.x)>=Math.abs(player.facing.y);
      const facing=axisX?{x:Math.sign(player.facing.x)||1,y:0}:
        {x:0,y:Math.sign(player.facing.y)||1};
      illusions.push({x:player.x,y:player.y,
        direction:facing,waypoint:null,life:5,ownerSlot});
      consumeSkillCharge();
      notify('ILLUSIONER — Phantom Double deployed!');
      beep(920,.25,'triangle',.026);
    }else{
      const stunned=hollows.filter(h=>dist(h,player)<SCOUT_STUN_RADIUS);
      for(const h of stunned){h.stunned=2.5;h.mode='search';h.target=null;h.path=[];h.repath=0;h.chaseUntil=clock+3;}
      consumeSkillCharge();
      skillWaves.push({x:player.x,y:player.y,radius:SCOUT_STUN_RADIUS,age:0,duration:.62,color:'scout'});
      notify('SCOUT — '+stunned.length+' Hollows stunned!');beep(1160,.23);
    }
    updateUI();
  }
  function followAlly(ally,dt){
    if(!ally)return;
    const living=allPlayers().filter(p=>p.hp>0);
    const target=living.sort((a,b)=>dist(a,ally)-dist(b,ally))[0];
    if(!target||!ally.rescued||ally.extracted||dist(ally,target)<1.05)return;
    ally.repath-=dt;
    if(ally.repath<=0){ally.followPath=pathTo(ally,target);ally.followIndex=0;ally.repath=.32;}
    if(ally.followIndex<ally.followPath.length){
      const stepTo=ally.followPath[ally.followIndex],d=dist(ally,stepTo);
      if(d<.08)ally.followIndex++;
      else{const speed=Math.min(3.1*dt,d);moveEntity(ally,(stepTo.x-ally.x)/d*speed,(stepTo.y-ally.y)/d*speed,.22);}
    }
  }
  function updateSurvivor(dt){followAlly(survivor,dt);followAlly(technician,dt);}
  function completeLevel(){
    beep(950,.4,'sine',.06);beep(1180,.48,'sine',.03);
    if(levelIndex===CONFIGS.length-1){state='victory';if(!developerSkipped&&(best===0||overallElapsed<best)){best=overallElapsed;try{localStorage.setItem('last-light-best',String(best));}catch(e){}}setOverlay('YOU FOUND THE LIGHT',`All ${CONFIGS.length} floors escaped in ${formatTime(overallElapsed)}. The elevator doors close behind you. Best escape: ${formatTime(best)}.`,'PLAY AGAIN','THE WARD WILL BE WAITING');}
    else {state='leveldone';
      if(levelIndex===STAGE_ONE_FLOORS-1){
        setOverlay('STAGE ONE COMPLETE',`You survived all nine floors of the Hollow Ward. Your ${player.hp} remaining ${player.hp===1?'heart carries':'hearts carry'} into a much larger outer complex.`,'ENTER STAGE TWO','NINE EXPANDED FLOORS AWAIT');
      }else setOverlay('FLOOR CLEARED',`You restored the relay, collected every core, and escaped ${CONFIGS[levelIndex].name.toLowerCase()} in ${formatTime(elapsed)}.`,'DESCEND DEEPER','THE NEXT FLOOR IS MORE DANGEROUS');
    }
  }
  const REVIVE_SECONDS=5;
  const REVIVE_RADIUS=1.5; // Measured in maze tiles, not pixels.
  function updateSoulRevival(dt){
    if(state!=='playing')return;
    const alive=allPlayers().filter(p=>p.hp>0);
    for(const soul of allPlayers()){
      if(soul.hp>0)continue;
      const nearby=alive.some(rescuer=>dist(soul,rescuer)<=REVIVE_RADIUS&&clearLine(soul,rescuer));
      if(!nearby){soul.reviveProgress=0;continue;}
      soul.reviveProgress=Math.min(REVIVE_SECONDS,(soul.reviveProgress||0)+dt);
      if(soul.reviveProgress>=REVIVE_SECONDS){
        soul.hp=1;soul.invincible=2.5;soul.dashTime=0;soul.dashCooldown=0;
        soul.reviveProgress=0;soul.trail=[];
        notify('SOUL REVIVED — ONE HEART RESTORED!',3);
        beep(930,.35,'sine',.038);updateUI();
      }
    }
  }
  function drawSoul(soul){
    const x=soul.x*TILE,y=soul.y*TILE,progress=Math.min(1,(soul.reviveProgress||0)/REVIVE_SECONDS);
    const bob=Math.sin(clock*3)*4;
    halo(x,y,52,'#8ef5ff55');
    ctx.save();
    ctx.translate(x,y+bob);
    ctx.globalAlpha=.75+.15*Math.sin(clock*4);
    ctx.fillStyle='#a9f8ff';
    ctx.beginPath();
    ctx.arc(0,-5,9,Math.PI,0);
    ctx.quadraticCurveTo(12,8,6,15);
    ctx.quadraticCurveTo(3,10,0,14);
    ctx.quadraticCurveTo(-3,10,-6,15);
    ctx.quadraticCurveTo(-12,8,-9,-5);
    ctx.fill();
    ctx.fillStyle='#123742';
    ctx.beginPath();ctx.arc(-3,-5,1.8,0,Math.PI*2);ctx.arc(3,-5,1.8,0,Math.PI*2);ctx.fill();
    ctx.restore();
    ctx.strokeStyle='#6b929d';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y,18,0,Math.PI*2);ctx.stroke();
    if(progress>0){
      ctx.strokeStyle='#a9fff3';ctx.lineWidth=3.5;
      ctx.beginPath();ctx.arc(x,y,18,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);ctx.stroke();
    }
    ctx.font='bold 10px monospace';ctx.fillStyle='#e6fbff';ctx.textAlign='center';
    // The soul artwork stays visible; only show a timer during an active revive.
    if(progress>0)ctx.fillText('REVIVING '+(REVIVE_SECONDS-(soul.reviveProgress||0)).toFixed(1)+'s',x,y-28);
  }
  // Phase Guard passes through walls along the facing direction. Only the
  // landing position must be walkable and clear of nearby Hollows.
  function phaseGuardDestination(origin,direction){
    const size=Math.hypot(direction?.x||0,direction?.y||0);
    const facing=size>.01?{x:direction.x/size,y:direction.y/size}:{x:1,y:0};
    const target={x:origin.x+facing.x*3,y:origin.y+facing.y*3};
    const clear=(p)=>canStand(p.x,p.y,.21)&&
      hollows.every(h=>dist(p,h)>.85);
    if(clear(target))return target;

    // If the intended landing is inside a wall or Hollow, choose the
    // nearest safe floor tile to that target. Crossing a wall is allowed,
    // but never place the player inside one or more than 3 cells away.
    const candidates=[];
    for(let y=Math.max(0,Math.floor(target.y)-3);y<=Math.min(ROWS-1,Math.ceil(target.y)+3);y++){
      for(let x=Math.max(0,Math.floor(target.x)-3);x<=Math.min(COLS-1,Math.ceil(target.x)+3);x++){
        const p=TILE_CENTER(x,y);
        if(dist(origin,p)>3.001||!clear(p))continue;
        candidates.push(p);
      }
    }
    candidates.sort((a,b)=>dist(a,target)-dist(b,target)||
      dist(b,origin)-dist(a,origin));
    return candidates[0]||{x:origin.x,y:origin.y};
  }
  function damage(){if(player.hp<=0||player.disconnected||player.invincible>0||player.dashTime>0||state!=='playing')return;
    if(player.phaseGuardTime>0){
      player.phaseGuardTime=0;
      const from={x:player.x,y:player.y};
      const to=phaseGuardDestination(from,player.facing);
      player.x=to.x;player.y=to.y;
      // A short arrival grace prevents the same Hollow from immediately
      // inflicting damage on the next server tick.
      player.invincible=Math.max(player.invincible,1);
      player.dashTime=0;
      skillWaves.push({x:from.x,y:from.y,radius:1.2,age:0,duration:.45,color:'teleporter'});
      skillWaves.push({x:to.x,y:to.y,radius:1.2,age:0,duration:.45,color:'teleporter'});
      notify('TELEPORTER — Phase Guard triggered!');
      beep(1320,.23,'triangle',.035);
      updateUI();
      return;
    }
    player.hp--;player.invincible=1.8;hitFlash=.45;beep(100,.3,'sawtooth',.048);notify('A Hollow touched you! Keep moving.',1.5);
    // On the final hit, keep the soul at the exact place the player fell.
    // Surviving players are still teleported to start as in the original game.
    player.dashTime=0;
    if(player.hp>0){
      player.x=1.5;player.y=1.5;
      hollows.forEach(h=>{h.mode='patrol';h.chaseUntil=0;h.path=[];h.repath=0;h.target=null;h.searchPoints=0;});
      noiseEvents=[];
    }
    if(player.hp<=0){
      player.hp=0;
      player.reviveProgress=0;
      const others=allPlayers().filter(p=>p!==player&&p.hp>0);
      if(!others.length){
        state='dead';
        setOverlay('SIGNAL LOST','All players have lost their hearts. Try again together.','TRY AGAIN','THE MAZE REMAINS THE SAME — YOU CAN LEARN IT');
      }else{
        notify('A PLAYER IS DOWN — TEAMMATE STILL ALIVE!',3);
      }
    }
    updateUI();
  }
  function updatePlayer(dt){
    if(player.hp<=0||player.disconnected)return;
    player.invincible=Math.max(0,player.invincible-dt);player.dashCooldown=Math.max(0,player.dashCooldown-dt);
    // Recharge one charge at a time, preserving elapsed progress if a large
    // simulation step finishes a charge mid-frame.
    if(!Number.isFinite(player.abilityCharges))
      player.abilityCharges=SKILL_MAX_CHARGES[classChoice];
    const maximum=maxSkillCharges();
    if(player.abilityCharges<maximum){
      player.abilityCooldown-=dt;
      const recharge=SKILL_COOLDOWN[classChoice]*cooldownFactor();
      while(player.abilityCooldown<=0&&player.abilityCharges<maximum){
        player.abilityCharges++;
        player.abilityCooldown+=recharge;
      }
      if(player.abilityCharges===maximum)player.abilityCooldown=0;
    }else player.abilityCooldown=0;
    player.invisibleTime=Math.max(0,(player.invisibleTime||0)-dt);
    player.phaseGuardTime=Math.max(0,(player.phaseGuardTime||0)-dt);
    player.decoyCooldown=Math.max(0,player.decoyCooldown-dt);
    let vx=(moveHeld.right?1:0)-(moveHeld.left?1:0)+joystickMove.x;
    let vy=(moveHeld.down?1:0)-(moveHeld.up?1:0)+joystickMove.y;
    const magnitude=Math.hypot(vx,vy);
    if(magnitude>1){vx/=magnitude;vy/=magnitude;}
    if(magnitude>.08)player.facing={x:vx/magnitude,y:vy/magnitude};
    if(player.dashTime>0){
      player.dashTime=Math.max(0,player.dashTime-dt);
      const touchDash=Math.hypot(joystickMove.x,joystickMove.y)>.08;
      const beforeX=player.x,beforeY=player.y;
      const hitWall=moveEntity(player,player.dashDir.x*9*dt,player.dashDir.y*9*dt,
        player.dashTouch||touchDash?.18:.21,.32);
      // When dashing diagonally into a wall, the open axis should keep
      // moving along the wall. Stop only when both axes are blocked.
      // Straight-on wall collisions still end the dash immediately.
      const diagonal=Math.abs(player.dashDir.x)>.08&&Math.abs(player.dashDir.y)>.08;
      const stuck=Math.hypot(player.x-beforeX,player.y-beforeY)<.001;
      if(hitWall&&(!diagonal||stuck))player.dashTime=0;
      if(Math.random()<.8)player.trail.push({x:player.x,y:player.y,life:.36});
    }
    else if(vx||vy){
      // A slightly smaller mobile hitbox eases narrow passages. The verified
      // v3.11 keyboard/desktop wall-slide parameters are preserved.
      const touchSteering=Math.hypot(joystickMove.x,joystickMove.y)>.08;
      moveEntity(player,vx*3.5*dt,vy*3.5*dt,touchSteering?.18:.21,.30);
    }
    player.trail=player.trail.filter(p=>(p.life-=dt)>0);
    recordRewindPosition(player);
    for(const c of cores)if(!c.collected&&dist(player,c)<.58){c.collected=true;notify('POWER CORE RECOVERED');beep(660,.17);setTimeout(()=>beep(990,.19),90);updateUI();}
  }
  function checkGhostContact(){
    if(state!=='playing'||player.hp<=0||player.disconnected||player.invincible>0||player.dashTime>0)return;
    // Hollows follow tile-centre paths; allow contact at their visible edge,
    // including when the player is stationary off-centre inside the same tile.
    // Require a clear path to avoid hitting through a wall.
    if(hollows.some(h=>!(h.stunned>0)&&dist(player,h)<.80&&clearLine(player,h)))damage();
  }
  function updateIllusions(dt){
    for(const illusion of illusions){
      illusion.life=Math.max(0,illusion.life-dt);
      if(illusion.life<=0)continue;
      let remaining=3.5*dt;
      // Follow tile centres so a phantom can turn 90 degrees at corners.
      // Continue forward at intersections whenever possible, then choose
      // a side passage; reverse only at a dead end.
      for(let steps=0;steps<8&&remaining>.0001;steps++){
        if(!illusion.waypoint){
          const tile=tileAt(illusion);
          const middle=TILE_CENTER(tile.x,tile.y);
          if(dist(illusion,middle)>.04){
            illusion.waypoint=middle;
          }else{
            const forward=illusion.direction;
            const options=dirs.filter(([dx,dy])=>floorAt(tile.x+dx,tile.y+dy));
            const straight=options.find(([dx,dy])=>dx===forward.x&&dy===forward.y);
            const nonReverse=options.filter(([dx,dy])=>dx!==-forward.x||dy!==-forward.y);
            const sideways=nonReverse.length?nonReverse:options;
            const chosen=straight||sideways[Math.floor(rand()*sideways.length)];
            if(!chosen)break;
            illusion.direction={x:chosen[0],y:chosen[1]};
            illusion.waypoint=TILE_CENTER(tile.x+chosen[0],tile.y+chosen[1]);
          }
        }
        const target=illusion.waypoint,d=dist(illusion,target);
        if(d<.001){illusion.x=target.x;illusion.y=target.y;illusion.waypoint=null;continue;}
        const move=Math.min(remaining,d);
        illusion.x+=(target.x-illusion.x)/d*move;
        illusion.y+=(target.y-illusion.y)/d*move;
        remaining-=move;
        if(move>=d-.0001){illusion.x=target.x;illusion.y=target.y;illusion.waypoint=null;}
      }
    }
    illusions=illusions.filter(illusion=>illusion.life>0);
  }
  function updateHollows(dt){
    let danger=0;
    for(const h of hollows){
      // Illusions are decoys that take precedence over real survivors
      // within their attraction radius. A Hollow cannot destroy one.
      const phantom=illusions.filter(i=>dist(h,i)<=8)
        .sort((a,b)=>dist(h,a)-dist(h,b))[0]||null;
      // Ignore downed or invisible survivors as regular chase targets.
      const nearest=allPlayers().filter(p=>p.hp>0&&!(p.invisibleTime>0))
        .sort((a,b)=>dist(h,a)-dist(h,b))[0]||null;
      if(!phantom&&h.mode==='illusion'){
        h.mode='search';h.target=null;h.path=[];h.pathIndex=0;
        h.chaseUntil=clock;h.repath=0;
      }
      if(h.stunned>0){h.stunned=Math.max(0,h.stunned-dt);h.dashTime=0;h.wobble+=dt*5;continue;}
      // Five Stage II Dashers lunge along their movement/chase direction.
      if(h.variant==='dasher'){
        if(h.dashTime>0){
          const step=Math.min(h.dashTime,dt)*8.2;
          h.dashTime=Math.max(0,h.dashTime-dt);
          const x=h.x,y=h.y;
          moveEntity(h,h.dashDir.x*step,h.dashDir.y*step,.13);
          h.angle=Math.atan2(h.dashDir.y,h.dashDir.x);
          if(Math.hypot(h.x-x,h.y-y)<step*.75)h.dashTime=0;
          if(h.dashTime===0){
            // Rebuild patrol/chase navigation from the new position.
            h.path=[];h.pathIndex=0;h.repath=0;
          }
          h.wobble+=dt*10;
          if(nearest&&dist(h,nearest)<3)danger=Math.max(danger,1);
          continue;
        }
        h.dashCooldown-=dt;
        // Start any burst only after the chase/patrol route is updated below,
        // so the lunge follows the Hollow's actual movement direction.
      }
      const distance=nearest?dist(h,nearest):Infinity;
      const lookX=Math.cos(h.angle),lookY=Math.sin(h.angle);
      const dot=nearest&&distance>0?((nearest.x-h.x)*lookX+(nearest.y-h.y)*lookY)/distance:1;
      // A Hollow can notice a nearby nearest in any direction, but sees further ahead.
      const visible=!!nearest&&(h.variant==='hunter'||distance<1.7||
        (distance<(h.mode==='chase'?8:6.6)&&dot>.12&&clearLine(h,nearest)));
      const heard=noiseEvents.filter(n=>n.expires>clock&&dist(h,n)<n.radius)
        .sort((a,b)=>dist(h,a)-dist(h,b))[0];
      if(phantom){
        const prior=h.target;
        const tileChanged=!prior||Math.floor(prior.x)!==Math.floor(phantom.x)||
          Math.floor(prior.y)!==Math.floor(phantom.y);
        h.mode='illusion';h.chasedPlayer=null;
        h.target={x:phantom.x,y:phantom.y};
        h.chaseUntil=clock+1;
        h.searchPoints=0;
        if(tileChanged)h.repath=0;
      }else if(visible){
        // Repath when the nearest changes tile, not every animation frame:
        // resetting pathIndex every frame leaves chasing ghosts circling.
        const prior=h.target;
        const tileChanged=!prior||Math.floor(prior.x)!==Math.floor(nearest.x)||
          Math.floor(prior.y)!==Math.floor(nearest.y);
        h.mode='chase';h.target={x:nearest.x,y:nearest.y};
        h.chasedPlayer=nearest;
        h.chaseUntil=clock+2.8;
        if(tileChanged)h.repath=0;
        h.searchPoints=0;
      } else if(h.mode==='chase'&&clock>h.chaseUntil){
        // Investigate the last seen location rather than knowing where the nearest moved.
        h.mode='search';h.chasedPlayer=null;
        h.chaseUntil=clock+4.5;h.searchPoints=0;h.repath=0;
      }
      if(!phantom&&!visible&&heard&&h.mode!=='chase'&&(h.mode!=='lure'||h.heardAt<clock-0.65)){
        h.mode='lure';h.chasedPlayer=null;h.target={x:heard.x,y:heard.y};h.heardAt=clock;
        h.chaseUntil=clock+3.5;h.repath=0;h.searchPoints=0;
      }
      if(h.mode==='lure'&&(clock>h.chaseUntil||h.target&&dist(h,h.target)<.5)){
        h.mode='search';h.chaseUntil=clock+3.3;h.searchPoints=0;h.repath=0;
      }
      if(h.mode==='search'&&clock>h.chaseUntil){
        h.mode='patrol';h.target=null;h.chasedPlayer=null;h.repath=0;
      }
      if(h.mode==='search'&&h.target&&dist(h,h.target)<.6&&h.searchPoints<2){
        // Check neighboring passages before returning to patrol.
        const pos=tileAt(h), candidates=cells.filter(p=>Math.abs(p.x-pos.x)+Math.abs(p.y-pos.y)>=2&&Math.abs(p.x-pos.x)+Math.abs(p.y-pos.y)<=5);
        const chosen=candidates[Math.floor(rand()*candidates.length)];
        if(chosen){h.target=TILE_CENTER(chosen.x,chosen.y);h.repath=0;h.searchPoints++;}
      }
      if(h.mode==='chase')danger=Math.max(danger,distance<3.5?2:1);
      if(h.mode==='lure'&&distance<5)danger=Math.max(danger,1);
      if(h.mode==='illusion'&&phantom&&dist(h,phantom)<1.5&&clearLine(h,phantom)){
        const d=dist(h,phantom);
        const step=Math.min(h.speed*1.55*dt,Math.max(0,d-.13));
        h.angle=Math.atan2(phantom.y-h.y,phantom.x-h.x);
        moveEntity(h,Math.cos(h.angle)*step,Math.sin(h.angle)*step,.13);
        h.wobble+=dt*5;
        continue;
      }
      if(h.mode==='chase'&&distance<1.5&&clearLine(h,nearest)){
        // When a Hollow reaches the nearest's tile, navigate to the nearest,
        // not just the tile centre. This also works when the nearest is still.
        const speed=h.speed*1.55;
        h.angle=Math.atan2(nearest.y-h.y,nearest.x-h.x);
        const step=Math.min(speed*dt,Math.max(0,distance-.13));
        moveEntity(h,Math.cos(h.angle)*step,Math.sin(h.angle)*step,.13);
        h.wobble+=dt*5;
        continue;
      }
      if(h.repath<=0){
        let target=h.mode==='patrol'?null:h.target;
        if(!target){
          const pos=tileAt(h);
          const opts=cells.filter(p=>Math.abs(p.x-pos.x)+Math.abs(p.y-pos.y)>4&&Math.abs(p.x-h.home.x)+Math.abs(p.y-h.home.y)<12);
          const chosen=opts[Math.floor(rand()*opts.length)]||h.home;
          target=TILE_CENTER(chosen.x,chosen.y);
        }
        if(target)h.path=pathTo(h,target);
        h.pathIndex=0;h.repath=h.mode==='chase'||h.mode==='illusion'?.23:(h.mode==='lure'?.65:1.25);
      }else h.repath-=dt;
      if(h.variant==='dasher'&&h.dashCooldown<=0){
        // If the nearest is visible, dash right at them; otherwise lunge along
        // the next path waypoint (including around corners rather than walls).
        const canAimAtPlayer=!!nearest&&h.mode==='chase'&&clearLine(h,nearest);
        const dashTarget=canAimAtPlayer?nearest:h.path[h.pathIndex];
        if(dashTarget){
          const distanceToTarget=dist(h,dashTarget);
          if(distanceToTarget>.28){
            const nx=(dashTarget.x-h.x)/distanceToTarget;
            const ny=(dashTarget.y-h.y)/distanceToTarget;
            // Walk speed remains identical to a Standard Hollow. Dashing is
            // the only burst of speed. Extend the lunge beyond a nearby path
            // waypoint, but never across solid walls or diagonal corners.
            const maxDash=canAimAtPlayer?Math.min(2.75,distanceToTarget):2.75;
            let clearance=0;
            for(let check=.15;check<=maxDash+.001;check+=.15){
              const distance=Math.min(check,maxDash);
              if(!canStand(h.x+nx*distance,h.y+ny*distance,.13))break;
              clearance=distance;
            }
            if(clearance>=.6){
              h.dashDir={x:nx,y:ny};h.dashTime=Math.min(.34,clearance/8.2);
              h.dashCooldown=2.5+rand()*1.0;
              h.angle=Math.atan2(ny,nx);
              // Rebuild path after the dash; no random steering.
            }else h.dashCooldown=.35;
          }else h.dashCooldown=.35;
        }else h.dashCooldown=.35;
      }
      if(h.pathIndex<h.path.length){
        const p=h.path[h.pathIndex],delta=dist(h,p);
        if(delta<.07)h.pathIndex++;
        else{
          const speed=h.speed*((h.mode==='chase'||h.mode==='illusion')?1.55:1)*(h.mode==='lure'?1.20:1);
          const step=Math.min(speed*dt,delta);
          h.angle=Math.atan2(p.y-h.y,p.x-h.x);
          if(h.variant==='dasher'){
            const x=h.x,y=h.y;
            moveEntity(h,Math.cos(h.angle)*step,Math.sin(h.angle)*step,.13,.25);
            // Recover from a blocked waypoint instead of pushing into its wall.
            if(Math.hypot(h.x-x,h.y-y)<.001){h.repath=0;h.path=[];h.pathIndex=0;}
          }else{h.x+=Math.cos(h.angle)*step;h.y+=Math.sin(h.angle)*step;}
        }
      } else if(h.repath>.2&&h.mode==='patrol')h.repath=.2;
      h.wobble+=dt*5;
    }
    alertLevel=danger;
  }
  function formatTime(seconds){const n=Math.floor(seconds);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
  function updateUI(){
    if(!player)return;
    ui.health.textContent=Array.from({length:3},(_,i)=>i<player.hp?'♥':'♡').join(' ');
    ui.cores.textContent=`${cores.filter(c=>c.collected).length} / ${cores.length}`;
    ui.relay.textContent=relay.active?'ACTIVE':'OFFLINE';ui.relay.style.color=relay.active?'#78e8bc':'#d6f4ee';
    ui.decoys.textContent=`DECOYS × ${player.decoys}`;ui.timer.textContent=formatTime(elapsed);
    ui.classStatus.textContent=ROLE_DETAILS[classChoice].label;
    ui.survivorStatus.textContent=technician
      ?`${Number(survivor.rescued)+Number(technician.rescued)} / 2 ALLIES`
      :(survivor.rescued?'FOLLOWING':'TRAPPED');
    const available=skillCharges();
    const maximum=maxSkillCharges();
    ui.abilityStatus.textContent=rewindTargeting&&classChoice==='rewinder'?'SELECT TARGET · TAB / F':
      player.phaseGuardTime>0?'PHASE GUARD · '+player.phaseGuardTime.toFixed(1)+'s':
      player.invisibleTime>0?'VANISH ACTIVE · '+player.invisibleTime.toFixed(1)+'s':
      classChoice==='anchor'&&player.anchor?'ANCHOR PLACED · F TO RETURN':
      classChoice==='illusioner'&&illusions.some(i=>i.ownerSlot===allPlayers().indexOf(player)+1)?
        'PHANTOM DOUBLE ACTIVE':
      available>0?ROLE_DETAILS[classChoice].ready:'ABILITY RECHARGING';
    if(technician?.rescued)ui.abilityStatus.textContent+=' · CD -30%';
    ui.dash.textContent=player.dashCooldown<=0?'DASH READY':`DASH ${player.dashCooldown.toFixed(1)}s`;
    const skillTotal=SKILL_COOLDOWN[classChoice]*cooldownFactor();
    const refill=Math.max(0,Math.min(1,1-player.abilityCooldown/skillTotal));
    // Inner ring = first charge; outer ring = second charge.
    // 0 charge: inner refills; 1 charge: outer refills.
    const inner=available>0?1:refill;
    const outer=maximum===2?(available===2?1:available===1?refill:0):0;
    const skillButton=$('#touchAbility');
    skillButton.style.setProperty('--skill-charge',`${inner.toFixed(3)}turn`);
    skillButton.style.setProperty('--skill-charge-outer',`${outer.toFixed(3)}turn`);
    skillButton.classList.toggle('two-charges',maximum===2);
    ui.skillCD.textContent='';
    skillButton.setAttribute('aria-label',rewindTargeting?'Confirm rewind target':available===0&&!(classChoice==='anchor'&&player.anchor)?
      'Skill recharging':classChoice==='anchor'&&player.anchor?'Return to anchor':'Use skill');
    const dashCharge=Math.max(0,Math.min(1,1-player.dashCooldown/(3.5*cooldownFactor())));
    const decoyCharge=Math.max(0,Math.min(1,1-player.decoyCooldown/(2*cooldownFactor())));
    $('#touchDash').style.setProperty('--skill-charge',`${dashCharge.toFixed(3)}turn`);
    $('#touchDecoy').style.setProperty('--skill-charge',`${decoyCharge.toFixed(3)}turn`);
    ui.dashCD.textContent='';
    ui.decoyCD.textContent=`×${player.decoys}`;
    $('#touchDash').setAttribute('aria-label',player.dashCooldown>0?'Dash recharging':'Dash ready');
    $('#touchDecoy').setAttribute('aria-label',player.decoyCooldown>0?'Decoy recharging':`Decoy, ${player.decoys} remaining`);
    $('#touchAbility').classList.toggle('on-cooldown',available===0&&!(classChoice==='anchor'&&player.anchor));
    $('#touchDash').classList.toggle('on-cooldown',player.dashCooldown>0);
    $('#touchDecoy').classList.toggle('on-cooldown',player.decoyCooldown>0||player.decoys===0);
    ui.threat.textContent=['LOW','ALERT','PURSUIT'][alertLevel];ui.threat.className=['threat-calm','threat-alert','threat-danger'][alertLevel];
  }
  function update(dt){
    clock+=dt;if(toastUntil<clock)ui.toast.classList.remove('show');
    hitFlash=Math.max(0,hitFlash-dt);ui.flash.style.opacity=(hitFlash*.4).toFixed(2);
    if(state!=='playing')return;
    elapsed+=dt;overallElapsed+=dt;
    updatePlayer(dt);
    if(guestPlayer)asGuest(()=>updatePlayer(dt));
    for(let slot=3;slot<=5;slot++)withExtra(slot,()=>updatePlayer(dt));
    if(state!=='playing')return;
    updateSurvivor(dt);updateIllusions(dt);updateHollows(dt);
    // Record Hollow histories on the authoritative simulation each frame.
    for(const h of hollows)recordPosition(hollowRewindHistory,h);
    for(const wave of skillWaves)wave.age+=dt;
    skillWaves=skillWaves.filter(wave=>wave.age<wave.duration);
    // Check AFTER ghosts move, including when the player is stationary.
    checkGhostContact();
    if(guestPlayer)asGuest(()=>checkGhostContact());
    for(let slot=3;slot<=5;slot++)withExtra(slot,()=>checkGhostContact());
    if(state!=='playing')return;
    updateSoulRevival(dt);
    ambientAudio();
    for(const d of decoys){d.life-=dt;d.age+=dt;}decoys=decoys.filter(d=>d.life>0);
    noiseEvents=noiseEvents.filter(n=>n.expires>clock);
    if(playersAtExit()&&relay.active&&cores.every(c=>c.collected)&&alliesReady())completeLevel();
    if(frameIndex%8===0)updateUI();
  }
  function roundedRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawOuterFloor(x,y){
    // Stage II: colored technical panels, not the brickwork of the Ward.
    const theme=CONFIGS[levelIndex].theme,kind=CONFIGS[levelIndex].architecture;
    const px=x*TILE,py=y*TILE,room=roomTiles.has(keyOf(x,y));
    const code=(x*13+y*23+levelIndex*17)%11;
    // Walkable tiles are always the same visibly lighter surface. Room
    // metadata adds only subtle markings, never another apparent wall type.
    ctx.fillStyle=theme.floor;ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle=theme.glow;ctx.globalAlpha=room?.065:.025;
    ctx.fillRect(px+2,py+2,TILE-4,TILE-4);
    ctx.globalAlpha=1;
    ctx.strokeStyle=theme.line;ctx.globalAlpha=.12;ctx.lineWidth=.75;
    ctx.strokeRect(px+2.5,py+2.5,TILE-5,TILE-5);
    ctx.globalAlpha=.30;ctx.strokeStyle=theme.trim;ctx.lineWidth=.9;
    ctx.beginPath();
    if(kind==='circuit'||kind==='network'){
      ctx.moveTo(px+4,py+16);ctx.lineTo(px+17,py+16);ctx.lineTo(px+17,py+5);
      ctx.moveTo(px+22,py+27);ctx.lineTo(px+22,py+18);ctx.lineTo(px+29,py+18);
    }else if(kind==='vault'||kind==='sanctum'){
      ctx.moveTo(px+5,py+5);ctx.lineTo(px+27,py+5);
      ctx.moveTo(px+5,py+27);ctx.lineTo(px+27,py+27);
      if(code%3===0){ctx.moveTo(px+16,py+9);ctx.lineTo(px+16,py+23);}
    }else if(kind==='reactor'||kind==='engine'){
      ctx.moveTo(px+3,py+9);ctx.lineTo(px+29,py+9);
      ctx.moveTo(px+3,py+24);ctx.lineTo(px+29,py+24);
      if(code%2===0){ctx.moveTo(px+12,py+9);ctx.lineTo(px+12,py+24);}
    }else if(kind==='array'||kind==='prism'){
      ctx.moveTo(px+16,py+5);ctx.lineTo(px+27,py+16);ctx.lineTo(px+16,py+27);ctx.lineTo(px+5,py+16);ctx.closePath();
    }else if(kind==='foundry'){
      ctx.moveTo(px+6,py+8);ctx.lineTo(px+26,py+8);
      ctx.moveTo(px+6,py+16);ctx.lineTo(px+26,py+16);
      ctx.moveTo(px+6,py+24);ctx.lineTo(px+26,py+24);
    }else{
      ctx.moveTo(px+4,py+4);ctx.lineTo(px+28,py+28);
      ctx.moveTo(px+28,py+4);ctx.lineTo(px+4,py+28);
    }
    ctx.stroke();ctx.globalAlpha=1;
    if(code===1||code===8){
      ctx.fillStyle=theme.glow;ctx.globalAlpha=.39;
      ctx.fillRect(px+14,py+14,4,4);ctx.globalAlpha=1;
    }
  }
  function drawOuterWall(x,y){
    const theme=CONFIGS[levelIndex].theme,kind=CONFIGS[levelIndex].architecture;
    const px=x*TILE,py=y*TILE,pattern=(x*7+y*11+levelIndex)%5;
    // Solid walls have one continuous dark material; bright outlines only
    // face corridors, avoiding false-looking wall blocks inside open rooms.
    ctx.fillStyle=theme.wall;ctx.fillRect(px,py,TILE,TILE);
    ctx.fillStyle='#000';ctx.globalAlpha=.12;ctx.fillRect(px+3,py+3,26,26);
    ctx.globalAlpha=1;
    ctx.strokeStyle=theme.trim;ctx.lineWidth=.7;
    ctx.globalAlpha=.12;
    ctx.strokeRect(px+3.5,py+3.5,25,25);
    ctx.beginPath();
    if(kind==='circuit'||kind==='array'||kind==='network'){
      ctx.moveTo(px+16,py+3);ctx.lineTo(px+16,py+29);
      if(pattern%2===0){ctx.moveTo(px+3,py+16);ctx.lineTo(px+29,py+16);}
    }else if(kind==='reactor'||kind==='foundry'||kind==='engine'){
      const yy=py+(pattern%2?11:20);
      ctx.moveTo(px+3,yy);ctx.lineTo(px+29,yy);
      ctx.moveTo(px+8,py+3);ctx.lineTo(px+8,py+29);
    }else if(kind==='prism'){
      ctx.moveTo(px+3,py+3);ctx.lineTo(px+29,py+29);
      ctx.moveTo(px+29,py+3);ctx.lineTo(px+3,py+29);
    }else{
      ctx.moveTo(px+4,py+16);ctx.lineTo(px+28,py+16);
      ctx.moveTo(px+16,py+4);ctx.lineTo(px+16,py+28);
    }
    ctx.stroke();ctx.globalAlpha=1;
    // Brighter edges make collision boundaries readable in every palette.
    ctx.strokeStyle=theme.line;ctx.lineWidth=2;
    ctx.beginPath();
    if(floorAt(x,y-1)){ctx.moveTo(px,py+1);ctx.lineTo(px+TILE,py+1);}
    if(floorAt(x,y+1)){ctx.moveTo(px,py+TILE-1);ctx.lineTo(px+TILE,py+TILE-1);}
    if(floorAt(x-1,y)){ctx.moveTo(px+1,py);ctx.lineTo(px+1,py+TILE);}
    if(floorAt(x+1,y)){ctx.moveTo(px+TILE-1,py);ctx.lineTo(px+TILE-1,py+TILE);}
    ctx.stroke();
  }
  function drawFloor(x,y){
    if(CONFIGS[levelIndex].stage===2){drawOuterFloor(x,y);return;}
    const px=x*TILE,py=y*TILE;
    const isRoom=roomTiles.has(keyOf(x,y));
    // Walkable areas are clearly brighter than solid walls.
    ctx.fillStyle='#244048';
    ctx.fillRect(px,py,TILE,TILE);
    ctx.strokeStyle='rgba(139,190,196,.08)';
    ctx.lineWidth=.5;
    ctx.strokeRect(px+.5,py+.5,TILE-1,TILE-1);
    if((x*7+y*13)%19===0){
      ctx.fillStyle='rgba(161,219,211,.10)';
      ctx.fillRect(px+7,py+22,9,1);
    }
  }
  function drawWall(x,y){
    if(CONFIGS[levelIndex].stage===2){drawOuterWall(x,y);return;}
    const px=x*TILE,py=y*TILE;
    ctx.fillStyle='#142831';ctx.fillRect(px,py,TILE,TILE);
    ctx.save();ctx.beginPath();ctx.rect(px,py,TILE,TILE);ctx.clip();
    ctx.strokeStyle='rgba(112,157,164,.17)';ctx.lineWidth=.75;ctx.beginPath();
    for(let row=Math.floor(py/8);row<=Math.floor((py+TILE)/8)+1;row++){
      const yy=row*8+.5;
      if(yy>=py&&yy<=py+TILE){ctx.moveTo(px,yy);ctx.lineTo(px+TILE,yy);}
      const offset=(row%2)*8;
      for(let col=Math.floor((px-offset)/16)-1;col<=Math.ceil((px+TILE-offset)/16)+1;col++){
        const xx=col*16+offset+.5;
        if(xx>=px&&xx<=px+TILE){
          ctx.moveTo(xx,Math.max(py,row*8));
          ctx.lineTo(xx,Math.min(py+TILE,(row+1)*8));
        }
      }
    }
    ctx.stroke();ctx.restore();
    ctx.strokeStyle='rgba(109,184,187,.46)';ctx.lineWidth=2;ctx.beginPath();
    if(floorAt(x,y-1)){ctx.moveTo(px,py+1);ctx.lineTo(px+TILE,py+1);}
    if(floorAt(x,y+1)){ctx.moveTo(px,py+TILE-1);ctx.lineTo(px+TILE,py+TILE-1);}
    if(floorAt(x-1,y)){ctx.moveTo(px+1,py);ctx.lineTo(px+1,py+TILE);}
    if(floorAt(x+1,y)){ctx.moveTo(px+TILE-1,py);ctx.lineTo(px+TILE-1,py+TILE);}
    ctx.stroke();
  }
  function halo(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function diamond(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();}
  function drawItems(){
    let t=clock;
    // Elevator, red before the power and green when ready.
    {const ready=relay.active&&cores.every(c=>c.collected);const x=exit.x*TILE,y=exit.y*TILE;
      halo(x,y,54,ready?'#6cf5af3a':'#fa7c7c18');roundedRect(x-12,y-14,24,28,4,'#05161c');ctx.strokeStyle=ready?'#7cfed1':'#cf6971';ctx.lineWidth=3;ctx.strokeRect(x-10,y-12,20,24);ctx.fillStyle=ready?'#82ffd0':'#d26e75';ctx.fillRect(x-2,y-10,4,20);ctx.fillRect(x-7,y-17,14,3);
      if(ready){ctx.fillStyle='#91ffe2';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText('EXIT',x,y-26);}}
    // Relay switch.
    {const x=relay.x*TILE,y=relay.y*TILE;halo(x,y,47,relay.active?'#54f2c32c':'#eabc5320');roundedRect(x-11,y-11,22,22,5,'#07171d');ctx.strokeStyle=relay.active?'#74f5c2':'#e9b864';ctx.lineWidth=2;ctx.strokeRect(x-10,y-10,20,20);ctx.fillStyle=relay.active?'#63e6b7':'#d5a14b';ctx.fillRect(x-4,y-5,8,10);ctx.fillStyle='#d0e7df';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(relay.active?'ON':'E',x,y-16);}
    cores.forEach((c,i)=>{if(c.collected)return;const x=c.x*TILE,y=c.y*TILE+Math.sin(t*2+i)*3;halo(x,y,60,'#56f2dd3b');ctx.save();ctx.translate(x,y);ctx.rotate(t*.7);diamond(0,0,10,'#67f7df');diamond(0,0,5,'#d9fff5');ctx.restore();});
    if(survivor){const x=survivor.x*TILE,y=survivor.y*TILE;halo(x,y,54,survivor.rescued?'#5ac9ff28':'#ffc86d30');ctx.fillStyle=survivor.rescued?'#79ccff':'#ffc66a';ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#172b38';ctx.lineWidth=2;ctx.strokeRect(x-4,y-3,8,5);ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='#e8fbff';ctx.fillText(survivor.rescued?'ALLY':'HELP',x,y-18);}
    if(technician){const x=technician.x*TILE,y=technician.y*TILE;
      halo(x,y,62,technician.rescued?'#9ffe9538':'#ffd56a38');
      ctx.fillStyle=technician.rescued?'#a5fcb0':'#ffe182';ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#15372d';ctx.fillRect(x-6,y-2,12,4);ctx.fillRect(x-2,y-6,4,12);
    }
    for(const d of decoys){const x=d.x*TILE,y=d.y*TILE,rad=(d.age*50)%80;ctx.strokeStyle=`rgba(244,191,101,${Math.min(.7,d.life/5)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x,y,Math.max(0,rad-24),0,Math.PI*2);ctx.stroke();diamond(x,y,7,'#ffd179');}
  }
  function drawAnchors(){
    const people=roomRole==='none'?[player]:[player,...remotePlayers];
    for(const p of people){
      if(!p?.anchor||p.hp<=0)continue;
      const x=p.anchor.x*TILE,y=p.anchor.y*TILE;
      const pulse=1+Math.sin(clock*4)*.12;
      ctx.save();halo(x,y,40,'#6be7ff3f');ctx.translate(x,y);ctx.rotate(Math.PI/4);
      ctx.strokeStyle='#80eaff';ctx.lineWidth=2.5;ctx.strokeRect(-9*pulse,-9*pulse,18*pulse,18*pulse);
      ctx.fillStyle='#a9f9ff';ctx.fillRect(-4,-4,8,8);ctx.restore();
    }
  }
  function drawHollows(){for(let i=0;i<hollows.length;i++){const h=hollows[i];
    let x=h.x*TILE,y=h.y*TILE,red=h.mode==='chase'&&!(h.stunned>0);
    const hunter=h.variant==='hunter',dasher=h.variant==='dasher';
    const glow=h.stunned>0?'#6dbeff3f':hunter?'#fa4c8c48':dasher?'#edaa3540':red?'#ff465b35':'#fa8f6a16';
    halo(x,y,hunter?70:dasher?52:red?62:38,glow);ctx.save();ctx.translate(x,y);
    ctx.fillStyle=h.stunned>0?'#79c2e7':hunter?'#ee5e9d':dasher?'#ffc064':red?'#ff5767':'#b87c83';
    ctx.beginPath();ctx.ellipse(0,1+Math.sin(h.wobble)*1.5,hunter?12:10,hunter?14:12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=hunter?'#602245':dasher?'#633b1b':'#4c202d';
    ctx.beginPath();ctx.arc(0,-2,7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=red||hunter||dasher?'#fff2dd':'#ffc4bd';ctx.fillRect(-5,-4,3,3);ctx.fillRect(3,-4,3,3);
    ctx.strokeStyle=hunter?'#ff8fc1':dasher?'#ffce70':red?'#f66f78':'#92535b';
    ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-8,6);ctx.lineTo(-12,11+Math.sin(h.wobble)*3);ctx.moveTo(8,6);ctx.lineTo(12,11-Math.sin(h.wobble)*3);ctx.stroke();
    if(red||hunter){ctx.strokeStyle=hunter?'#ff5caa':dasher?'#efad4c':'#ff546c';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(0,0,hunter?17:15,0,Math.PI*2);ctx.stroke();}
    ctx.restore();}}
  // Stable server slot colors: everyone sees the same player in the same color.
  // Mint, amber, blue, pink and gold are distinguishable on both stage themes.
  const PLAYER_COLORS=['#76f2d1','#ffb36e','#91b7ff','#f49edb','#f5d778'];
  const colorForPlayer=slot=>PLAYER_COLORS[Math.max(0,Math.min(4,(slot||1)-1))];
  function drawPlayer(){
    if(player.hp<=0){
      drawSoul(player);
      return;
    }
    for(const p of player.trail){ctx.fillStyle=`rgba(110,255,218,${p.life*.55})`;ctx.beginPath();ctx.arc(p.x*TILE,p.y*TILE,8,0,Math.PI*2);ctx.fill();}
    const x=player.x*TILE,y=player.y*TILE,flicker=player.invincible>0&&Math.sin(clock*31)>0;
    const color=colorForPlayer(roomPlayerId);
    if(flicker)return;
    ctx.save();
    if(player.invisibleTime>0)ctx.globalAlpha=.28;
    if(player.phaseGuardTime>0){
      ctx.strokeStyle='#a1baff';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.arc(x,y,18+Math.sin(clock*10)*1.5,0,Math.PI*2);ctx.stroke();
    }
    halo(x,y,70,color+'25');ctx.fillStyle='#061d23';ctx.beginPath();ctx.ellipse(x,y+6,12,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0d3940';ctx.beginPath();ctx.arc(x,y-2,5,0,Math.PI*2);ctx.fill();
    const fx=player.facing.x,fy=player.facing.y;ctx.strokeStyle='#e6fff7';ctx.lineWidth=2.7;ctx.beginPath();ctx.moveTo(x+fx*6,y+fy*6);ctx.lineTo(x+fx*14,y+fy*14);ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=player.dashTime>0?3:1.7;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  function drawIllusions(){
    for(const illusion of illusions){
      const x=illusion.x*TILE,y=illusion.y*TILE;
      const color=colorForPlayer(illusion.ownerSlot);
      ctx.save();
      ctx.globalAlpha=Math.min(.54,.2+illusion.life*.065);
      halo(x,y,50,color+'50');
      ctx.setLineDash([3,4]);
      ctx.strokeStyle='#b9c7ff';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=color;
      ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#122d45';
      ctx.beginPath();ctx.arc(x,y-2,5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#e7f5ff';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(x+illusion.direction.x*6,y+illusion.direction.y*6);
      ctx.lineTo(x+illusion.direction.x*14,y+illusion.direction.y*14);ctx.stroke();
      ctx.restore();
    }
  }
  function drawOtherPlayer(){
    for(let i=0;i<remotePlayers.length;i++){
      const teammate=remotePlayers[i];
      if(!teammate)continue;
      if(teammate.hp<=0){drawSoul(teammate);continue;}
      const x=teammate.x*TILE,y=teammate.y*TILE,color=colorForPlayer(teammate.slot);
      ctx.save();
      if(teammate.invisibleTime>0)ctx.globalAlpha=.28;
      if(teammate.phaseGuardTime>0){
        ctx.strokeStyle='#a1baff';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.arc(x,y,17+Math.sin(clock*10)*1.5,0,Math.PI*2);ctx.stroke();
      }
      halo(x,y,30,color+'36');
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  }
  function drawNameplates(){
    // Unboxed names in the same stable color as their respective character.
    // No (YOU) suffix: the local player is already centered by the camera.
    if(roomRole==='none')return;
    for(const person of [{...player,slot:roomPlayerId},...remotePlayers]){
      if(!person||!person.slot)continue;
      const identity=roomIdentity.get(person.slot);
      const name=(identity?.name||'Survivor '+person.slot).slice(0,20);
      const x=person.x*TILE,y=person.y*TILE-29;
      ctx.save();
      ctx.font='bold 11px monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='rgba(0,8,13,.95)';
      ctx.shadowBlur=5;
      ctx.shadowOffsetY=1;
      ctx.fillStyle=colorForPlayer(person.slot);
      if(person.invisibleTime>0)ctx.globalAlpha=.40;
      ctx.fillText(name,x,y);
      ctx.restore();
    }
  }
  function drawDarkness(){
    const c=darkCtx;
    c.clearRect(0,0,W,H);
    // Apply the same three-tier darkness curve independently in both stages.
    const floorWithinStage=levelIndex%STAGE_ONE_FLOORS;
    const darkness=floorWithinStage<3?.63:floorWithinStage<6?.76:.90;
    c.fillStyle=`rgba(0,8,13,${darkness})`;c.fillRect(0,0,W,H);
    c.globalCompositeOperation='destination-out';
    const lights=[
      ...[player,...remotePlayers].filter(Boolean).map(p=>({
        x:p.x*TILE,y:p.y*TILE,r:p.hp>0?(p===player?205:155):72,
        alpha:p.hp>0?(p===player?1:.90):.58
      })),
      ...cores.filter(c=>!c.collected).map(c=>({x:c.x*TILE,y:c.y*TILE,r:72,alpha:.42})),
      {x:relay.x*TILE,y:relay.y*TILE,r:58,alpha:.30},
      {x:exit.x*TILE,y:exit.y*TILE,r:52,alpha:.30},
      ...(technician?[{x:technician.x*TILE,y:technician.y*TILE,r:68,alpha:.42}]:[]),
      ...decoys.map(d=>({x:d.x*TILE,y:d.y*TILE,r:145,alpha:.70}))
    ];
    for(const l of lights){const lx=l.x-camera.x,ly=l.y-camera.y;
      const g=c.createRadialGradient(lx,ly,0,lx,ly,l.r);g.addColorStop(0,`rgba(0,0,0,${l.alpha})`);g.addColorStop(.35,`rgba(0,0,0,${l.alpha*.85})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(lx-l.r,ly-l.r,l.r*2,l.r*2);}
    c.globalCompositeOperation='source-over';
    ctx.drawImage(darknessCanvas,camera.x,camera.y);
  }
  function drawMarker(x,y,clr,label){const a=clock*2;ctx.save();ctx.translate(x,y);ctx.strokeStyle=clr;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,12+Math.sin(a)*2,0,Math.PI*2);ctx.stroke();ctx.fillStyle=clr;ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText(label,0,-19);ctx.restore();}
  function objectiveDirection(){return cores.find(c=>!c.collected)||(!survivor.rescued?survivor:technician&&!technician.rescued?technician:!relay.active?relay:exit);}
  function drawDirectionalHUD(){if(!player)return;const target=objectiveDirection(),angle=Math.atan2(target.y-player.y,target.x-player.x),x=W-52,y=53;
    roundedRect(W-168,12,156,73,11,'#07191fd9');ctx.strokeStyle='#2e5f61';ctx.lineWidth=1;ctx.strokeRect(W-168+.5,12.5,155,72);
    ctx.fillStyle='#81deca';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText(cores.some(c=>!c.collected)?'FIND THE CORES':!survivor.rescued?'RESCUE THE ALLY':technician&&!technician.rescued?'FIND TECHNICIAN':!relay.active?'ACTIVATE RELAY':'REACH THE EXIT',W-158,33);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#a5ffe3';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(-7,-8);ctx.lineTo(-2,0);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle='#7aadb0';ctx.font='10px monospace';ctx.textAlign='left';ctx.fillText(`${Math.round(dist(player,target))}m away`,W-158,60);
  }
  // World-to-screen teammate tracking. The server already broadcasts all
  // player positions and souls, so these markers need no additional packets.
  function getTeammateIndicators(teammates=remotePlayers){
    if(roomRole==='none'||!teammates.length||!grid)return [];
    // Keep markers just inside the four game-window borders (the arrow tip
    // extends up to 14 px, so 18 px prevents clipping).
    const view={left:18,top:18,right:W-18,bottom:H-18};
    const center={x:W/2,y:H/2};
    const markers=[];
    for(const teammate of teammates){
      if(!teammate||!Number.isFinite(teammate.x)||!Number.isFinite(teammate.y))continue;
      const screenX=(teammate.x*TILE-camera.x)*CAMERA_ZOOM;
      const screenY=(teammate.y*TILE-camera.y)*CAMERA_ZOOM;
      // Only mark teammates who are genuinely outside the game viewport,
      // not those merely hidden by darkness or close to the HUD edge.
      if(screenX>=0&&screenX<=W&&screenY>=0&&screenY<=H)continue;
      const dx=screenX-center.x,dy=screenY-center.y;
      if(!dx&&!dy)continue;
      const factor=Math.min(
        dx>0?(view.right-center.x)/dx:dx<0?(view.left-center.x)/dx:Infinity,
        dy>0?(view.bottom-center.y)/dy:dy<0?(view.top-center.y)/dy:Infinity
      );
      markers.push({
        slot:teammate.slot,dead:teammate.hp<=0,
        name:(roomIdentity.get(teammate.slot)?.name||'Survivor '+teammate.slot).slice(0,12),
        color:colorForPlayer(teammate.slot),
        x:center.x+dx*factor,y:center.y+dy*factor,
        angle:Math.atan2(dy,dx),
        edge:Math.abs(center.x+dx*factor-view.left)<1?'left':
          Math.abs(center.x+dx*factor-view.right)<1?'right':
          dy<0?'top':'bottom'
      });
    }
    // Spread nearby arrows on the same edge so up to four remain distinct.
    for(const edge of ['left','right','top','bottom']){
      const group=markers.filter(m=>m.edge===edge)
        .sort((a,b)=>edge==='left'||edge==='right'?a.y-b.y:a.x-b.x);
      const vertical=edge==='left'||edge==='right';
      const axis=vertical?'y':'x';
      const min=vertical?view.top:view.left,max=vertical?view.bottom:view.right;
      const spacing=42;
      for(let i=0;i<group.length;i++){
        const desired=group[i][axis];
        group[i][axis]=Math.max(min+i*spacing,Math.min(max-(group.length-1-i)*spacing,desired));
        if(i&&group[i][axis]<group[i-1][axis]+spacing)
          group[i][axis]=group[i-1][axis]+spacing;
      }
      if(group.length&&group[group.length-1][axis]>max){
        const shift=group[group.length-1][axis]-max;
        for(const m of group)m[axis]-=shift;
      }
    }
    return markers;
  }

  function drawTeammateIndicators(){
    for(const m of getTeammateIndicators()){
      ctx.save();
      ctx.translate(m.x,m.y);
      ctx.rotate(m.angle);
  
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(14,0);
      ctx.lineTo(-8,-7);
      ctx.lineTo(-2,0);
      ctx.lineTo(-8,7);
      ctx.closePath();
      ctx.fill();
  
      // optional small soul dot if teammate is dead
      if(m.dead){
        ctx.fillStyle = '#e8fdff';
        ctx.beginPath();
        ctx.arc(-12,0,3.5,0,Math.PI*2);
        ctx.fill();
      }
  
      ctx.restore();
    }
  }
  
  function drawInteractPrompts(){ctx.font='bold 11px monospace';ctx.textAlign='center';
    let message='';
    const fallen=remotePlayers.find(p=>p.hp<=0&&dist(player,p)<=REVIVE_RADIUS&&clearLine(player,p));
    if(player.hp>0&&fallen)
      message='REVIVING TEAMMATE · '+Math.max(0,REVIVE_SECONDS-(fallen.reviveProgress||0)).toFixed(1)+'s';
    if(player.hp<=0&&remotePlayers.some(p=>p.hp>0))
      message='SOUL DOWN · WAIT FOR TEAMMATE';
    if(!message){if(!survivor.rescued&&dist(player,survivor)<1.5)message='[ E ] RESCUE SURVIVOR';else if(technician&&!technician.rescued&&dist(player,technician)<1.5)message='[ E ] RESCUE TECHNICIAN';else if(dist(player,relay)<1.55&&!relay.active)message='[ E ] ACTIVATE RELAY';else if(dist(player,exit)<1.5)message=relay.active&&cores.every(c=>c.collected)&&alliesReady()?(playersAtExit()?'[ E ] ESCAPE':'WAIT FOR TEAMMATE'):'ELEVATOR / ALLIES NOT READY';
    }
    if(message){roundedRect(W/2-111,H-54,222,30,7,'#071c23e8');ctx.strokeStyle='#43786e';ctx.strokeRect(W/2-111,H-54,222,30);ctx.fillStyle='#d4fff2';ctx.fillText(message,W/2,H-35);}
  }
  function drawSkillWaves(){
    // Render in world space after darkness so the full skill radius is visible.
    for(const wave of skillWaves){
      const t=Math.min(1,wave.age/wave.duration);
      const x=wave.x*TILE,y=wave.y*TILE;
      if(wave.color==='medic'){
        // Show the full actual healing range around the Medic, with the
        // healing-cross animation on the character who receives the heart.
        ctx.save();
        const ease=1-Math.pow(1-t,2);
        const opacity=Math.pow(1-t,1.1);
        const ringRadius=wave.radius*TILE*(.05+.95*ease);
        ctx.globalAlpha=opacity;
        ctx.fillStyle='rgba(118,255,202,.09)';
        ctx.strokeStyle='#7dffd0';ctx.lineWidth=3.5-t*2;
        ctx.beginPath();ctx.arc(x,y,ringRadius,0,Math.PI*2);
        ctx.fill();ctx.stroke();
        ctx.globalAlpha=1;
        const healX=(wave.healX??wave.x)*TILE;
        const healY=(wave.healY??wave.y)*TILE;
        const cross=(px,py,size,alpha)=>{
          ctx.save();
          ctx.globalAlpha=alpha;
          ctx.shadowColor='#8fffd0';ctx.shadowBlur=size*.9;
          ctx.fillStyle='#a5ffda';
          const thick=Math.max(2,size*.34);
          ctx.fillRect(px-thick/2,py-size/2,thick,size);
          ctx.fillRect(px-size/2,py-thick/2,size,thick);
          ctx.restore();
        };
        const centerSize=(25+13*Math.sin(Math.min(1,t*2)*Math.PI/2))*(1-.18*t);
        cross(healX,healY-7*t,centerSize,opacity);
        for(let i=0;i<6;i++){
          const angle=i*Math.PI/3-Math.PI/2;
          const distance=(18+i%2*8)+ease*(38+i%3*10);
          const px=healX+Math.cos(angle)*distance;
          const py=healY+Math.sin(angle)*distance-14*ease;
          cross(px,py,9+(i%2)*3,opacity*(.74-.17*(i%3)/2));
        }
        ctx.restore();
        continue;
      }
      const radius=wave.radius*TILE*(.035+.965*(1-Math.pow(1-t,2)));
      const alpha=Math.pow(1-t,.8);
      const rgb=wave.color==='rewinder'?'170,153,255':'110,255,223';
      ctx.save();
      ctx.globalAlpha=alpha;
      ctx.fillStyle=`rgba(${rgb},.075)`;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=`rgba(${rgb},.93)`;
      ctx.lineWidth=3.5-t*2;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=`rgba(${rgb},.25)`;
      ctx.lineWidth=10-t*6;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
  }
  function drawAtmosphere(){
    // Deterministic dust specks drift gently across the existing labyrinth.
    // They are visual only; movement and collision rules are untouched.
    ctx.save();
    for(let i=0;i<22;i++){
      const x=((i*179+Math.sin(clock*.16+i*2.1)*17)%W+W)%W;
      const y=((i*97+clock*(1.4+i%3))%H+H)%H;
      const alpha=.045+.025*(1+Math.sin(clock*.6+i));
      ctx.fillStyle='rgba(155,214,207,'+alpha.toFixed(3)+')';
      ctx.fillRect(x,y,i%4===0?2:1,i%4===0?2:1);
    }
    if(state==='playing'&&alertLevel===2){
      const pulse=.035+.025*(1+Math.sin(clock*8));
      ctx.fillStyle='rgba(205,46,68,'+pulse.toFixed(3)+')';
      ctx.fillRect(0,0,W,H);
    }
    ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle=CONFIGS[levelIndex]?.stage===2?'#101928':'#07171d';ctx.fillRect(0,0,W,H);
    if(!grid)return;
    // Render the world through a smoothly moving, clamped follow camera.
    // Controls, collisions and lighting remain in world coordinates.
    ctx.save();
    ctx.scale(CAMERA_ZOOM,CAMERA_ZOOM);
    ctx.translate(-camera.x,-camera.y);
    const x0=Math.max(0,Math.floor(camera.x/TILE)-1);
    const y0=Math.max(0,Math.floor(camera.y/TILE)-1);
    const x1=Math.min(COLS,Math.ceil((camera.x+W/CAMERA_ZOOM)/TILE)+1);
    const y1=Math.min(ROWS,Math.ceil((camera.y+H/CAMERA_ZOOM)/TILE)+1);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)
      (grid[y][x]===1?drawWall:drawFloor)(x,y);
    drawItems();drawAnchors();drawHollows();drawIllusions();drawPlayer();drawOtherPlayer();drawDarkness();drawSkillWaves();drawAtmosphere();drawNameplates();
    if(rewindTargeting&&classChoice==='rewinder'){
      const selected=chosenRewindTarget(),cx=player.x*TILE,cy=player.y*TILE;
      ctx.save();ctx.strokeStyle='rgba(175,153,255,.86)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(cx,cy,REWIND_RADIUS*TILE,0,Math.PI*2);ctx.stroke();
      for(const choice of rewindChoices()){
        const x=choice.entity.x*TILE,y=choice.entity.y*TILE;
        ctx.strokeStyle=selected&&choice.kind===selected.kind&&choice.slot===selected.slot&&choice.index===selected.index?'#fff3ac':'#b9a7ff';
        ctx.lineWidth=selected&&choice.kind===selected.kind&&choice.slot===selected.slot&&choice.index===selected.index?4:2;
        ctx.beginPath();ctx.arc(x,y,choice===selected?18:14,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    // Fixed screen-space HUD must never drift with the camera.
    drawDirectionalHUD();drawInteractPrompts();drawTeammateIndicators();
    if(alertLevel>0&&state==='playing'){
      ctx.fillStyle=alertLevel===2?'#e44d6411':'#ffc17c07';
      ctx.fillRect(0,0,W,H);
    }
    ctx.fillStyle='#0000000a';
    for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,1);
  }
  // Simulation must not depend on requestAnimationFrame: browsers throttle
  // inactive tabs, which previously froze the host whenever the guest tab
  // was being controlled on the same computer.
  let simulationLast=performance.now();
  setInterval(()=>{
    const now=performance.now();
    const dt=Math.min(.10,Math.max(0,(now-simulationLast)/1000));
    simulationLast=now;
    if(roomRole!=='none'&&now-remotePingAt>2000){
      remotePingAt=now;sendRoom({type:'ping',at:now});
    }
    if(roomRole!=='none'&&now-lastInput>=35){
      lastInput=now;
      sendRoom(guestInputPacket());
    }
  },35);
  function tick(timestamp){
    const dt=Math.min(.045,Math.max(0,(timestamp-lastFrame)/1000||0));
    lastFrame=timestamp;frameIndex++;
    // Rendering follows the authoritative server positions. Client prediction
    // is intentionally disabled to avoid walking/dashing through the server's
    // true walls or away from the real Hollow collision hitbox.
    if(roomRole!=='none'){
      const now=performance.now();
      if(clientToastUntil&&now>=clientToastUntil){
        clientToastUntil=0;ui.toast.classList.remove('show');
      }
      if(clientHitFlashUntil){
        const left=Math.max(0,(clientHitFlashUntil-now)/450);
        ui.flash.style.opacity=(left*.18).toFixed(2);
        if(left<=0)clientHitFlashUntil=0;
      }
    }
    if(activePage==='play'){
      updateMusic();
      if(roomRole!=='none')ambientAudio();
      if(state==='playing')updateCamera(dt);
      draw();
    }
    requestAnimationFrame(tick);
  }
  const keyMap={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  document.addEventListener('keydown', e => {
    if(activePage!=='play')return;
    if(e.target instanceof HTMLElement&&e.target.closest('input, textarea, select, [contenteditable="true"]'))return;
    if(!soundEnabled)unlockGameAudio();
    const k=e.key.toLowerCase();if(keyMap[k]||[' ','e','q','f','p','escape','enter','r','m'].includes(k)||(rewindTargeting&&k==='tab'))e.preventDefault();
    if(keyMap[k]){moveHeld[keyMap[k]]=true;if(roomRole!=='none')sendRoom(guestInputPacket());}
    if(e.repeat)return;
    if(rewindTargeting&&k==='escape'){cancelRewindTarget();return;}
    if(rewindTargeting&&k==='tab'){rewindTargetIndex++;return;}
    if(rewindTargeting&&k==='enter'){commitRewindTarget(chosenRewindTarget());return;}
    if(k==='m'){if(roomRole==='host')developerSkip(e.shiftKey);return;}
    if(k===' ')dash();else if(k==='q')triggerDecoy();else if(k==='e')interact();else if(k==='f')requestAbility();else if(k==='p'||k==='escape')pause();else if(k==='enter'&&state!=='playing')advance();else if(k==='r'&&state==='playing'&&roomRole==='host'){sendRoom({type:'restart'});}
  });
  document.addEventListener('keyup', e => {const dir=keyMap[e.key.toLowerCase()];if(dir){moveHeld[dir]=false;if(roomRole!=='none')sendRoom(guestInputPacket());}});
  window.addEventListener('blur',()=>{moveHeld={up:false,down:false,left:false,right:false};if(state==='playing'&&roomRole==='none')pause();});
  $('#primaryBtn').addEventListener('click',advance);
  document.querySelectorAll('.role-option').forEach(card=>{
    card.addEventListener('click',()=>{
      if(state!=='menu'&&state!=='dead'&&state!=='victory')return;
      classChoice=validRole(card.dataset.role);
      refreshRoleSelection();
      if(roomRole!=='none')sendRoom({type:'role',role:classChoice});
    });
  });
  refreshRoleSelection();
  // Touch games need independent pointerdown actions: mobile browsers may
  // suppress click on a second finger while the joystick finger remains held.
  // Never require isPrimary here, since action taps are usually secondary touches.
  function bindGameAction(selector,action){
    const button=$(selector);
    let lastTouchAt=-Infinity;
    button.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse')return;
      e.preventDefault();
      lastTouchAt=Date.now();
      action();
    });
    // Keep mouse and keyboard activation, without double-triggering touch taps.
    button.addEventListener('click',e=>{
      if(e.detail!==0 && Date.now()-lastTouchAt<650)return;
      action();
    });
  }
  // Tooltip for all four actions: mouse hover or one-second touch hold.
  // Short touches activate on release. Long holds never spend resources.
  const actionTooltip=$('#skillTooltip');
  let activeActionHelp=null;
  const hideActionTooltip=(button=null)=>{
    if(button&&activeActionHelp!==button)return;
    activeActionHelp=null;
    actionTooltip.classList.remove('is-visible');
    actionTooltip.setAttribute('aria-hidden','true');
  };
  const showActionTooltip=(button,actionName)=>{
    if(activePage!=='play'||state!=='playing')return;
    activeActionHelp=button;
    refreshActionDescription(actionName);
    actionTooltip.classList.add('is-visible');
    actionTooltip.setAttribute('aria-hidden','false');
  };
  function bindDescribedAction(selector,actionName,activate){
    const button=$(selector);
    let touchPointer=null,holdTimer=null,held=false,suppressClickUntil=0;
    const clearHold=()=>{
      if(holdTimer!==null){clearTimeout(holdTimer);holdTimer=null;}
    };
    button.addEventListener('pointerenter',e=>{
      if(e.pointerType==='mouse')showActionTooltip(button,actionName);
    });
    button.addEventListener('pointerleave',e=>{
      if(e.pointerType==='mouse')hideActionTooltip(button);
    });
    button.addEventListener('focus',()=>showActionTooltip(button,actionName));
    button.addEventListener('blur',()=>hideActionTooltip(button));
    button.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse')return;
      e.preventDefault();
      if(touchPointer!==null)return;
      touchPointer=e.pointerId;
      held=false;
      suppressClickUntil=Date.now()+1500;
      try{button.setPointerCapture(e.pointerId);}catch(_){}
      clearHold();
      holdTimer=setTimeout(()=>{
        holdTimer=null;
        if(touchPointer===e.pointerId){
          held=true;
          showActionTooltip(button,actionName);
        }
      },1000);
    });
    const finish=(e,cancelled=false)=>{
      if(touchPointer!==e.pointerId)return;
      const wasHeld=held;
      touchPointer=null;held=false;
      clearHold();hideActionTooltip(button);
      suppressClickUntil=Date.now()+800;
      if(!cancelled&&!wasHeld)activate();
    };
    button.addEventListener('pointerup',e=>finish(e));
    button.addEventListener('pointercancel',e=>finish(e,true));
    button.addEventListener('lostpointercapture',e=>finish(e,true));
    button.addEventListener('click',e=>{
      if(e.detail!==0&&Date.now()<suppressClickUntil)return;
      activate();
    });
  }
  bindDescribedAction('#touchAbility','skill',requestAbility);
  bindDescribedAction('#touchDash','dash',()=>dash(null,true));
  bindDescribedAction('#touchDecoy','decoy',triggerDecoy);
  bindDescribedAction('#touchInteract','use',interact);
  bindGameAction('#touchPause',pause);
  // Tap/click the selected character or Hollow while Rewinder is targeting.
  canvas.addEventListener('pointerdown',event=>{
    if(!rewindTargeting||state!=='playing'||classChoice!=='rewinder')return;
    event.preventDefault();
    const rect=canvas.getBoundingClientRect();
    const px=(event.clientX-rect.left)*W/rect.width;
    const py=(event.clientY-rect.top)*H/rect.height;
    const wx=(px/CAMERA_ZOOM+camera.x)/TILE;
    const wy=(py/CAMERA_ZOOM+camera.y)/TILE;
    const choices=rewindChoices();
    const closest=choices.sort((a,b)=>
      Math.hypot(a.entity.x-wx,a.entity.y-wy)-
      Math.hypot(b.entity.x-wx,b.entity.y-wy))[0];
    if(closest&&Math.hypot(closest.entity.x-wx,closest.entity.y-wy)<.65)
      commitRewindTarget(closest);
  });
  const joystick=$('#joystick'),stick=$('#joystickKnob');
  let joystickPointer=null;
  function resetJoystick(){
    joystickPointer=null;joystickMove.x=0;joystickMove.y=0;
    stick.style.transform='translate(0px,0px)';
    joystick.classList.remove('is-active');
  }
  function moveJoystick(e){
    if(e.pointerId!==joystickPointer)return;
    const bounds=joystick.getBoundingClientRect();
    const maxRange=Math.max(1,(Math.min(bounds.width,bounds.height)-stick.offsetWidth)/2-5);
    const dx=e.clientX-(bounds.left+bounds.width/2),dy=e.clientY-(bounds.top+bounds.height/2);
    const length=Math.hypot(dx,dy);
    const factor=length>maxRange?maxRange/length:1;
    const x=dx*factor,y=dy*factor;
    stick.style.transform=`translate(${x}px,${y}px)`;
    const deadZone=.12;
    const strength=Math.hypot(x,y)/maxRange;
    const amount=strength<deadZone?0:(strength-deadZone)/(1-deadZone);
    let ux=length?dx/length:0,uy=length?dy/length:0;
    // Small off-axis thumb movements should not steer the player into a wall.
    // Preserve deliberate diagonal movement and the joystick's analog speed.
    if(Math.abs(ux)<.30){ux=0;uy=Math.sign(uy);}
    else if(Math.abs(uy)<.30){uy=0;ux=Math.sign(ux);}
    joystickMove.x=ux*amount;
    joystickMove.y=uy*amount;
  }
  joystick.addEventListener('pointerdown',e=>{
    if(joystickPointer!==null)return;
    e.preventDefault();joystickPointer=e.pointerId;
    joystick.classList.add('is-active');
    joystick.setPointerCapture(e.pointerId);
    moveJoystick(e);
  });
  joystick.addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer){e.preventDefault();moveJoystick(e);}});
  for(const eventName of ['pointerup','pointercancel','lostpointercapture']){
    joystick.addEventListener(eventName,e=>{if(e.pointerId===joystickPointer)resetJoystick();});
  }
  window.addEventListener('blur',resetJoystick);
  const fullscreenButton=$('#touchFullscreen');
  const gamePanel=$('.game-shell');
  const syncFullscreenButton=()=>{
    const active=document.fullscreenElement===gamePanel;
    fullscreenButton.textContent='⛶';
    fullscreenButton.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
    fullscreenButton.setAttribute('aria-pressed',String(active));
  };
  fullscreenButton.addEventListener('click',()=>{
    if(document.fullscreenElement===gamePanel){
      if(document.exitFullscreen)document.exitFullscreen().catch(()=>notify('Could not exit fullscreen.'));
      return;
    }
    if(!gamePanel.requestFullscreen){
      notify('This browser does not support in-game fullscreen. Try Add to Home Screen.');
      return;
    }
    try{
      const result=gamePanel.requestFullscreen();
      if(result&&typeof result.catch==='function')result.catch(()=>notify('Fullscreen unavailable here. Try Add to Home Screen.'));
    }catch(e){
      notify('Fullscreen unavailable here. Try Add to Home Screen.');
    }
  });
  document.addEventListener('fullscreenchange',syncFullscreenButton);
  // Prototype authority: the host runs the full original game.
  // Guests render synced state and send only controls and actions.
  function sendSnapshot(){
    if(roomRole!=='host'||!grid||!player)return;
    // Static map data changes only when the floor changes; sending it
    // 20 times a second wastes bandwidth for remote internet players.
    const full=lastSentStaticLevel!==levelIndex||performance.now()-lastFullSnapshot>5000;
    const snapshot={
      state,levelIndex,runSeed,elapsed,overallElapsed,clock,alertLevel,
      player,guestPlayer,cores,relay,exit,
      // Only visual, mutable Hollow fields are needed by the remote renderer.
      // Paths/targets/home and navigation arrays remain inside the host AI.
      hollows:hollows.map(h=>({x:h.x,y:h.y,angle:h.angle,variant:h.variant,
        mode:h.mode,stunned:h.stunned,wobble:h.wobble,dashTime:h.dashTime})),
      decoys,skillWaves,survivor,technician,
      overlay:{title:ui.title.textContent,text:ui.text.textContent}
    };
    if(full){
      snapshot.grid=grid;snapshot.cells=cells;snapshot.roomTiles=[...roomTiles];
      lastSentStaticLevel=levelIndex;lastFullSnapshot=performance.now();
    }
    sendRoom({type:'snapshot',snapshot});
  }
  function applySnapshot(d){
    if(roomRole==='none'||!d)return;
    if(!Number.isInteger(d.levelIndex)||d.levelIndex<0||d.levelIndex>=CONFIGS.length)return;
    if(lastLevel!==d.levelIndex||runSeed!==d.runSeed){
      // A fresh run can restart on the SAME floor with a new maze seed.
      // Do not apply movement or objectives until the matching map arrives.
      if(!Array.isArray(d.grid)||!Array.isArray(d.cells))return;
      lastLevel=d.levelIndex;runSeed=d.runSeed;buildLevel(d.levelIndex);
    }
    const previous=state;
    const priorAudioPlayer=previous==='playing'&&player&&
      lastLevel===d.levelIndex?player:null;
    if(Array.isArray(d.grid))grid=d.grid;
    if(Array.isArray(d.cells))cells=d.cells;
    if(Array.isArray(d.roomTiles))roomTiles=new Set(d.roomTiles);
    // One true position, generated by the dedicated room simulation.
    // Never overwrite incoming server coordinates with client estimates.
    // Every browser has its own assigned slot (1–5) in the SAME server room.
    const occupants=Array.isArray(d.players)?d.players:[d.player,d.guestPlayer];
    const authoritative=occupants[roomPlayerId-1];
    if(!authoritative)return;
    if(guestPreviousHP!==null&&authoritative.hp<guestPreviousHP){
      clientHitFlashUntil=performance.now()+450;
      beep(100,.24,'sawtooth',.038);
      notify(authoritative.hp>0?'A HOLLOW HIT YOU!':'SIGNAL LOST — WAIT FOR RESCUE',1.5);
    }
    guestPreviousHP=authoritative.hp;
    // In multiplayer the server executes actions, so browser-side dash(),
    // interact() and skill() return before their sound effects. Play local
    // feedback only after the server confirms the action in a snapshot.
    // Never predict cooldowns or movement here.
    if(priorAudioPlayer&&d.state==='playing'&&soundEnabled&&activePage==='play'){
      if(authoritative.dashTime>0&&priorAudioPlayer.dashTime<=0&&
         authoritative.dashCooldown>priorAudioPlayer.dashCooldown+.05)
        beep(220,.17,'sawtooth',.019);
      if((authoritative.abilityUseSerial||0)>(priorAudioPlayer.abilityUseSerial||0))
        beep(classChoice==='medic'?740:620,.20,'triangle',.018);
      if(authoritative.decoys<priorAudioPlayer.decoys)
        beep(850,.22,'square',.016);
    }
    player=authoritative;
    remotePlayers=occupants.map((p,i)=>p&&i!==roomPlayerId-1?{...p,slot:i+1}:null).filter(Boolean);
    guestPlayer=remotePlayers[0]||null;
    if(Array.isArray(d.playerRoles)){
      const actualRole=d.playerRoles[roomPlayerId-1];
      if(Object.hasOwn(ROLE_DETAILS,actualRole))classChoice=actualRole;
    }
    cores=d.cores;relay=d.relay;exit=d.exit;
    // Hollows must be drawn where the server checks their collisions.
    // No visual extrapolation that can put their sprites ahead of the hitbox.
    if(Array.isArray(d.hollows))hollows=d.hollows;
    illusions=Array.isArray(d.illusions)?d.illusions:[];
    decoys=d.decoys;
    noiseEvents=Array.isArray(d.noiseEvents)?d.noiseEvents:[];
    skillWaves=d.skillWaves||[];survivor=d.survivor;technician=d.technician;
    elapsed=d.elapsed;overallElapsed=d.overallElapsed;clock=d.clock;alertLevel=d.alertLevel;
    state=d.state;
    if(state==='countdown'){
      const number=Math.max(1,Math.ceil(d.countdownRemaining||0));
      if(number!==lastCountdownNumber||previous!=='countdown'){
        lastCountdownNumber=number;
        countdownBeep(number);
        setOverlay(''+number,'GET READY · THE WARD OPENS SOON','STARTING…',
          'ALL SURVIVORS BEGIN TOGETHER');
      }
      ui.overlay.classList.add('countdown-active');
      ui.button.disabled=true;
    }else{
      lastCountdownNumber=0;
      ui.overlay.classList.remove('countdown-active');
      ui.button.disabled=false;
    }
    if(state==='playing')hideOverlay();
    else if(state==='menu'&&previous!=='menu')setOverlay('THE HOLLOW WARD','Ready to begin a new run.','START GAME');
    else if(state!=='menu'&&state!=='countdown'&&state!==previous){
      // The server owns floor progression, but only the room creator can
      // advance. Show that player the actual action instead of WAIT FOR HOST.
      const host=roomRole==='host';
      let button='WAIT FOR HOST';
      if(host){
        if(state==='leveldone')
          button=levelIndex===STAGE_ONE_FLOORS-1?'ENTER STAGE TWO':'ENTER NEXT FLOOR';
        else if(state==='paused')button='RESUME GAME';
        else if(state==='dead'||state==='victory')button='PLAY AGAIN';
      }
      setOverlay(d.overlay?.title||'THE HOLLOW WARD',
        d.overlay?.text||'Waiting for the next floor.',button);
    }
    // UI updates are costly when snapshots arrive 20 times per second.
    const now=performance.now();
    if(now-lastGuestUIAt>120||previous!==state){
      lastGuestUIAt=now;updateUI();
    }
    // Smooth camera motion in the render loop, not per network packet.
  }
  function setupRoomChat(){
    const panel=$('#roomChat'),log=$('#chatMessages');
    const input=$('#chatInput'),form=$('#chatForm'),feedback=$('#chatFeedback');
    let messages=[];
    // The chat is in the empty right gutter, outside the centered maze.
    // Measure that gutter because the canvas size changes with aspect ratio,
    // screen height, and fullscreen mode.
    const positionChat=()=>{
      const shell=$('.game-shell'),canvas=$('#game');
      if(!shell||!canvas)return;
      const sr=shell.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
      // object-fit:contain can leave a wide unused gutter INSIDE the
      // canvas element in landscape fullscreen. Measure the painted maze.
      const paintedWidth=Math.min(cr.width,cr.height*(canvas.width/canvas.height));
      const mazeRight=cr.left+(cr.width+paintedWidth)/2;
      const gap=Math.max(0,sr.right-mazeRight);
      // On touch/mobile the chat sits 8px from the right edge. Reserve another
      // 3px before the painted maze (with an 8px right offset); desktop retains wider clearance.
      const mobileChat=window.matchMedia('(max-width:650px), (hover:none) and (pointer:coarse)').matches;
      panel.style.setProperty('--chat-gutter-width',Math.max(0,Math.floor(gap-(mobileChat?11:24)))+'px');
      panel.classList.toggle('chat-no-gutter',gap<180);
    };
    window.addEventListener('resize',positionChat,{passive:true});
    document.addEventListener('fullscreenchange',positionChat);
    if(typeof ResizeObserver!=='undefined'){
      const observer=new ResizeObserver(positionChat);
      observer.observe($('#gameWrapper'));
      observer.observe($('.game-shell'));
    }
    requestAnimationFrame(positionChat);
    const clear=()=>{
      messages=[];feedback.textContent='';input.value='';render();
    };
    const render=()=>{
      const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<35;
      log.replaceChildren();
      if(!messages.length){
        const empty=document.createElement('p');
        empty.className='chat-placeholder';
        empty.textContent='Chat with your teammates in this room.';
        log.appendChild(empty);
      }
      for(const message of messages){
        const item=document.createElement('div');
        item.className='chat-item'+(message.playerId===roomPlayerId?' is-self':'');
        const author=document.createElement('span');
        author.className='chat-author';
        author.textContent=message.name+(message.playerId===roomPlayerId?' (you)':'');
        const body=document.createElement('span');
        body.className='chat-text';
        body.textContent=message.text;
        item.append(author,body);log.appendChild(item);
      }
      if(nearBottom)log.scrollTop=log.scrollHeight;
    };
    const validMessage=m=>m&&Number.isInteger(m.id)&&
      Number.isInteger(m.playerId)&&typeof m.name==='string'&&
      typeof m.text==='string'&&m.text.length<=240;
    const receive=message=>{
      if(!validMessage(message)||messages.some(m=>m.id===message.id))return;
      messages.push(message);
      if(messages.length>50)messages.shift();
      render();
    };
    const send=(text,quick=false)=>{
      const value=String(text||'').replace(/\s+/g,' ').trim();
      if(!value||value.length>240||roomRole==='none')return;
      if(roomSocket?.readyState!==WebSocket.OPEN){
        feedback.textContent='Not connected. Reconnecting…';return;
      }
      feedback.textContent='';
      sendRoom({type:'chat',text:value,quick});
      input.value='';
    };
    form.addEventListener('submit',e=>{e.preventDefault();send(input.value);});
    for(const button of panel.querySelectorAll('[data-quick-chat]')){
      button.addEventListener('click',()=>send(button.dataset.quickChat,true));
    }
    input.addEventListener('focus',()=>{
      moveHeld={up:false,down:false,left:false,right:false};
      if(roomRole!=='none')sendRoom(guestInputPacket());
    });
    return {
      clear,
      history:entries=>{
        messages=Array.isArray(entries)?entries.filter(validMessage).slice(-50):[];
        feedback.textContent='';render();
        log.scrollTop=log.scrollHeight;
      },
      receive,
      error:text=>{feedback.textContent=String(text||'Please slow down.').slice(0,120)}
    };
  }
  function connectRoom(){
    const chat=setupRoomChat();
    const status=$('#roomStatus'),invite=$('#roomInvite'),
      create=$('#createRoom'),join=$('#joinRoom'),code=$('#joinRoomCode'),
      roomName=$('#roomName'),directory=$('#roomList'),roomBrowser=$('#roomBrowser'),
      myRoomCard=$('#myRoomCard'),roomCountLabel=$('#roomCount'),
      nicknameInput=$('#playerNickname'),lobbyClass=$('#lobbyClass'),
      rosterCountLabel=$('#rosterCount');
    nicknameInput.value=sessionStorage.getItem('lastLightNickname')||'';
    let savedPlayers=[];
    const SESSION_KEY='lastLightPlayerSession';
    let reconnectAttempts=0,reconnectTimer=null;
    let invited=new URLSearchParams(location.search).get('room');
    const readSession=()=>{
      try{
        const value=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
        return value&&/^[0-9A-F]{6}$/.test(value.code)&&
          /^[0-9a-f]{64}$/.test(value.token)?value:null;
      }catch{return null;}
    };
    const saveSession=(code,token)=>{
      if(/^[0-9A-F]{6}$/.test(code)&&/^[0-9a-f]{64}$/.test(token))
        sessionStorage.setItem(SESSION_KEY,JSON.stringify({code,token}));
    };
    const clearSession=()=>sessionStorage.removeItem(SESSION_KEY);
    const nameForServer=()=>nicknameInput.value.trim().slice(0,20);
    const joinRequest=code=>sendRoom({type:'join',code,nickname:nameForServer()});
    const renderRoster=players=>{
      savedPlayers=players;
      roomIdentity=new Map(players.map(person=>[person.id,person]));
      const scouts=players.filter(person=>person.role==='scout').length;
      const medics=players.filter(person=>person.role==='medic').length;
      const teleporters=players.filter(person=>person.role==='teleporter').length;
      const invisiblers=players.filter(person=>person.role==='invisibler').length;
      const illusioners=players.filter(person=>person.role==='illusioner').length;
      const rewinders=players.filter(person=>person.role==='rewinder').length;
      const anchors=players.filter(person=>person.role==='anchor').length;
      $('#scoutCount').textContent=String(scouts);
      $('#medicCount').textContent=String(medics);
      $('#teleporterCount').textContent=String(teleporters);
      $('#invisiblerCount').textContent=String(invisiblers);
      $('#illusionerCount').textContent=String(illusioners);
      $('#rewinderCount').textContent=String(rewinders);
      $('#anchorCount').textContent=String(anchors);
      $('#rosterCount').textContent=players.length+' / 5 players';
    };
    nicknameInput.addEventListener('change',()=>{
      nicknameInput.value=nameForServer();
      sessionStorage.setItem('lastLightNickname',nicknameInput.value);
      if(roomRole!=='none')sendRoom({type:'profile',nickname:nicknameInput.value});
    });
    nicknameInput.addEventListener('blur',()=>{
      if(roomRole!=='none'){
        nicknameInput.value=nameForServer();
        sessionStorage.setItem('lastLightNickname',nicknameInput.value);
        sendRoom({type:'profile',nickname:nicknameInput.value});
      }
    });
    lobbyClass.addEventListener('change',()=>{
      if(!['menu','dead','victory'].includes(state)){
        lobbyClass.value=classChoice;return;
      }
      classChoice=validRole(lobbyClass.value);
      refreshRoleSelection();
      if(roomRole!=='none')sendRoom({type:'role',role:classChoice});
    });
    const setJoined=joined=>{
      // A host still needs to browse other active rooms. Keep the directory
      // visible; only hide room creation / code-entry while already joined.
      roomBrowser.hidden=false;
      roomBrowser.classList.toggle('has-active-room',joined);
      myRoomCard.hidden=!joined;
      $('#leaveRoom').disabled=!joined;
      $('#returnToGame').disabled=!joined;
      create.disabled=joined;
      join.disabled=joined;
      code.disabled=joined;
      // Refresh labels such as YOUR ROOM and JOIN (after leaving).
      if(joined)renderRoster(savedPlayers);
      else{savedPlayers=[];roomIdentity.clear();
        $('#scoutCount').textContent='0';$('#medicCount').textContent='0';
        rosterCountLabel.textContent='0 / 5 players';}
      sendRoom({type:'list'});
    };
    const drawRooms=rooms=>{
      directory.replaceChildren();
      roomCountLabel.textContent=rooms.length+' '+(rooms.length===1?'room':'rooms');
      // Our room already has its pinned card above the list: never duplicate it.
      const others=rooms.filter(entry=>!(roomRole!=='none'&&entry.code===code.value));
      if(!others.length){
        const p=document.createElement('p');
        p.className='room-empty';
        p.textContent=roomRole!=='none'?'No other rooms available.':'No rooms yet. Create one and invite your friends!';
        directory.appendChild(p);return;
      }
      for(const entry of others){
        const card=document.createElement('div');
        card.className='room-entry';
        const description=document.createElement('div');
        description.className='room-description';
        const title=document.createElement('strong');
        title.textContent=entry.name||'Hollow Ward';
        const metadata=document.createElement('span');
        metadata.textContent=entry.code+' · '+entry.players+' / 5 players · '+
          (entry.status==='waiting'?'Waiting for players':'In progress');
        description.append(title,metadata);
        const button=document.createElement('button');
        button.type='button';
        button.textContent=!entry.joinable?'Full':roomRole!=='none'?'Leave to join':'Join room';
        button.disabled=!entry.joinable||roomRole!=='none';
        button.title=roomRole!=='none'?'Leave your current room before joining another':'';
        button.addEventListener('click',()=>joinRequest(entry.code));
        card.append(description,button);directory.appendChild(card);
      }
    };
    const connectSocket=()=>{
      if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null;}
      const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
      roomSocket=socket;
    socket.addEventListener('open',()=>{
      if(socket!==roomSocket)return;
      reconnectAttempts=0;
      sendRoom({type:'list'});sendRoom({type:'ping',at:performance.now()});
      const saved=readSession();
      if(saved){
        status.textContent='Restoring your last room and character…';
        sendRoom({type:'resume',code:saved.code,token:saved.token});
      }else if(invited&&/^[0-9A-F]{6}$/i.test(invited)){
        joinRequest(invited.toUpperCase());
        invited=null;
      }else{
        status.textContent='Connected · Choose an available room or create one.';
      }
    });
    socket.addEventListener('close',()=>{
      if(socket!==roomSocket)return;
      status.textContent='Connection interrupted. Reconnecting automatically…';
      $('#gameRoomCount').textContent='RECONNECTING…';
      const delay=Math.min(8000,600*Math.pow(2,Math.min(4,reconnectAttempts++)));
      reconnectTimer=setTimeout(connectSocket,delay);
    });
    socket.addEventListener('message',event=>{
      if(socket!==roomSocket)return;
      let m;try{m=JSON.parse(event.data);}catch{return;}
      if(m.type==='pong'&&typeof m.at==='number'){
        const ms=Math.max(0,performance.now()-m.at);
        remotePingMs=remotePingMs===null?ms:remotePingMs*.72+ms*.28;
        showNetworkStatus();
      }
      if(m.type==='error')status.textContent=m.message;
      if(m.type==='chat-history')chat.history(m.messages);
      if(m.type==='chat-message')chat.receive(m.message);
      if(m.type==='chat-error')chat.error(m.message);
      if(m.type==='resume-error'){
        chat.clear();clearSession();roomRole='none';roomPlayerId=0;roomCount=0;
        setJoined(false);state='menu';showPage('lobby',true);
        status.textContent=m.message+'. Please join a room again.';
      }
      if(m.type==='rooms'&&Array.isArray(m.rooms))drawRooms(m.rooms);
      if(m.type==='joined'){
        chat.clear();roomPlayerId=m.id;roomRole=m.host?'host':'guest';roomCount=1;
        if(m.reconnectToken)saveSession(m.code,m.reconnectToken);
        code.value=m.code;showNetworkStatus();
        if(m.resumed&&typeof m.nickname==='string')nicknameInput.value=m.nickname;
        nicknameInput.value=nicknameInput.value.trim().slice(0,20);
        sessionStorage.setItem('lastLightNickname',nicknameInput.value);
        const url=new URL(location.origin);
        url.pathname='/play';url.searchParams.set('room',m.code);
        invite.textContent='ROOM '+m.code+' · Invite link: '+url.href;
        $('#currentRoomName').textContent=(m.name||'Hollow Ward')+' · ROOM '+m.code;
        setJoined(true);showPage('play');
        sendRoom({type:'list'});
        status.textContent=m.resumed?'Reconnected to your original character.':
          m.host?'Room created. Press START GAME to begin!':'Room joined. Waiting for host.';
        // The browser requires a gesture for audio; don't initialize it during
        // an unsolicited network message. The player can enable it by clicking.
        if(!m.resumed)sendRoom({type:'role',role:classChoice});
        if(roomRole==='guest'&&!m.resumed)
          setOverlay('JOINED THE WARD','Waiting for the room host to start.','WAIT FOR HOST');
      }else if(m.type==='roster'&&roomPlayerId){
        roomCount=m.count;
        roomRole=m.hostId===roomPlayerId?'host':'guest';
        if(Array.isArray(m.players))renderRoster(m.players);
        showNetworkStatus();
        status.textContent=roomCount+' / 5 players connected'+
          (roomRole==='host'?' · You are the host':'');
        $('#gameRoomCount').textContent=roomCount+' / 5 SURVIVORS';
        lobbyClass.disabled=!['menu','dead','victory'].includes(state);
        if(state==='menu'){
          ui.button.firstChild.textContent=roomRole==='host'?'START GAME ':'WAIT FOR HOST ';
        }else if(state==='leveldone'){
          ui.button.firstChild.textContent=roomRole==='host'?
            (levelIndex===STAGE_ONE_FLOORS-1?'ENTER STAGE TWO ':'ENTER NEXT FLOOR '):
            'WAIT FOR HOST ';
        }
      }else if(m.type==='left'){
        chat.clear();clearSession();roomRole='none';roomPlayerId=0;roomCount=0;
        guestPlayer=null;remotePlayers=[];
        lastLevel=-1;guestPreviousHP=null;
        setJoined(false);
        status.textContent='You left the room. Join another or create your own.';
        invite.textContent='';
        showPage('lobby',true);
        state='menu';
        setOverlay('THE HOLLOW WARD','Choose a room to play with your team.','START GAME');
        showNetworkStatus();sendRoom({type:'list'});
      }else if(m.type==='snapshot'&&roomRole!=='none')applySnapshot(m.snapshot);
    });
    };
    connectSocket();
    create.addEventListener('click',()=>{
      if(roomRole!=='none')return;
      unlockGameAudio();
      sendRoom({type:'create',name:roomName.value.trim()||'Hollow Ward',
        nickname:nameForServer()});
    });
    join.addEventListener('click',()=>{
      unlockGameAudio();
      const value=code.value.trim().toUpperCase();
      if(!/^[0-9A-F]{6}$/.test(value)){
        status.textContent='Enter a valid six-character room code.';return;
      }
      joinRequest(value);
    });
    $('#refreshRooms').addEventListener('click',()=>sendRoom({type:'list'}));
    $('#leaveRoom').addEventListener('click',()=>{clearSession();sendRoom({type:'leave'});});
    $('#leaveGameRoom').addEventListener('click',()=>{clearSession();sendRoom({type:'leave'});});
    $('#backToLobby').addEventListener('click',()=>showPage('lobby'));
    $('#returnToGame').addEventListener('click',()=>{unlockGameAudio();showPage('play');});
    // Room cards and invitation links may join directly without using the
    // Join by Code button. Unlock sound on their actual click gesture too.
    directory.addEventListener('click',event=>{
      if(event.target.closest('button'))unlockGameAudio();
    });
    // Direct invite/reconnect visitors can unlock sound with their first
    // in-game input. Do not attempt autoplay on unsolicited socket messages.
    document.addEventListener('pointerdown',()=>{
      if(activePage==='play'&&!soundEnabled)unlockGameAudio();
    },{capture:true});
    window.addEventListener('popstate',()=>{
      showPage(location.pathname==='/play'?'play':'lobby',false);
    });
    setJoined(false);
    showPage('lobby',false);
  }
  connectRoom();
  // Build the first level behind the menu so the player sees the environment before starting.
  buildLevel(0);requestAnimationFrame(tick);
  // Expose read-only diagnostics for smoke tests, not used by gameplay.
  // Read-only geometry diagnostic used by five-player browser regression tests.
  window.__lastLightPreviewIndicators=teammates=>getTeammateIndicators(teammates)
    .map(m=>({slot:m.slot,dead:m.dead,x:m.x,y:m.y,edge:m.edge,color:m.color}));
  window.__lastLightDiagnostics=()=>({state,roomPlayerId,roomRole,roomCount,visibleTeammates:remotePlayers.length,teammateIndicators:getTeammateIndicators().map(m=>({slot:m.slot,dead:m.dead,x:m.x,y:m.y,angle:m.angle,edge:m.edge})),level:levelIndex,mazeSize:[COLS,ROWS],floorTiles:cells.length,roomTiles:roomTiles.size,cores:cores.length,enemies:hollows.length,playerHP:player.hp,playerPosition:{x:player.x,y:player.y},allyPosition:guestPlayer?{x:guestPlayer.x,y:guestPlayer.y}:null,dashCooldown:player.dashCooldown,characterClass:classChoice,survivorRescued:survivor.rescued,abilityCooldown:player.abilityCooldown});
})();
