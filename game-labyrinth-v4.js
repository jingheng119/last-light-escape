/* LAST LIGHT: THE HOLLOW WARD
 * Original, dependency-free HTML Canvas survival / maze game.
 * All artwork is generated using Canvas primitives. No external assets or requests.
 */
(() => {
  'use strict';
  const COLS = 31, ROWS = 21, TILE = 32, W = COLS * TILE, H = ROWS * TILE;
  const CONFIGS = [
    { name: 'THE FIRST DESCENT', seed: 1709, cores: 2, enemies: 3, loops: 0.16, speed: 1.12, note: 'Hollows can see along corridors. Break line of sight to escape a pursuit.' },
    { name: 'THE DARK CIRCUIT', seed: 2911, cores: 3, enemies: 5, loops: 0.20, speed: 1.33, note: 'Tap Q to throw a sound decoy. Nearby Hollows will investigate the noise.' },
    { name: 'THE LAST ELEVATOR', seed: 4207, cores: 3, enemies: 7, loops: 0.22, speed: 1.48, note: 'Dash with Space to slip through danger. It briefly protects you from contact.' }
  ];
  const $ = s => document.querySelector(s);
  const canvas = $('#game'), ctx = canvas.getContext('2d');
  const darknessCanvas = document.createElement('canvas');
  darknessCanvas.width = W; darknessCanvas.height = H;
  const darkCtx = darknessCanvas.getContext('2d');
  const ui = {
    health: $('#health'), cores: $('#cores'), relay: $('#relay'), timer: $('#timer'), threat: $('#threat'),
    dash: $('#dashStatus'), decoys: $('#decoys'), label: $('#missionLabel'), level: $('#missionLevel'),
    note: $('#fieldNote'), overlay: $('#overlay'), title: $('#overlayTitle'), text: $('#overlayText'),
    classSelect: $('#classSelect'), classStatus: $('#classStatus'), survivorStatus: $('#survivorStatus'), abilityStatus: $('#abilityStatus'),
    button: $('#primaryBtn'), hint: $('#overlayHint'), toast: $('#toast'), flash: $('#screenFlash'), sound: $('#soundBtn')
  };
  let state = 'menu', levelIndex = 0, grid, cells, player, cores, relay, exit, hollows, decoys, particles = [];
  let roomTiles = new Set(), noiseEvents = [], survivor = null;
  let runSeed=0;
  let classChoice = 'scout';
  let elapsed = 0, overallElapsed = 0, clock = 0, toastUntil = 0, hitFlash = 0, alertLevel = 0;
  let lastFrame = 0, audioCtx = null, soundEnabled = false, best = 0;
  let moveHeld = { up: false, down: false, left: false, right: false }, frameIndex = 0;
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
    const roomCount=3+Math.floor(rand()*3);
    const rooms=[];
    for(let attempt=0;attempt<85&&rooms.length<roomCount;attempt++){
      const w=3+Math.floor(rand()*2),h=3+Math.floor(rand()*2);
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
    for(let i=0;i<12;i++){
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
  function buildLevel(index) {
    levelIndex=index;const cfg=CONFIGS[index];buildMaze(cfg.seed+runSeed,cfg.loops);
    const start={x:1,y:1}, distances=distanceMap(start), reserved=[start];
    exit=selectSpot(reserved,18,distances);reserved.push(exit);
    cores=[];
    for(let i=0;i<cfg.cores;i++) {const p=selectSpot(reserved,8,distances,i===0);reserved.push(p);cores.push({...TILE_CENTER(p.x,p.y),collected:false});}
    const switchSpot=selectSpot(reserved,7,distances,false);reserved.push(switchSpot);
    relay={...TILE_CENTER(switchSpot.x,switchSpot.y),active:false};
    exit={...TILE_CENTER(exit.x,exit.y)};
    const survivorSpot=selectSpot(reserved,7,distances,false);reserved.push(survivorSpot);
    survivor={...TILE_CENTER(survivorSpot.x,survivorSpot.y),rescued:false,extracted:false,followPath:[],followIndex:0,repath:0};
    player={...TILE_CENTER(1,1),hp:3,invincible:0,dashCooldown:0,dashTime:0,dashDir:{x:1,y:0},decoys:3,facing:{x:1,y:0},trail:[],abilityCooldown:0};
    hollows=[];
    for(let i=0;i<cfg.enemies;i++) {
      const p=selectSpot(reserved,5,distances,false);reserved.push(p);
      hollows.push({x:p.x+.5,y:p.y+.5,home:{x:p.x,y:p.y},speed:cfg.speed*(.9+rand()*.18),
        path:[],pathIndex:0,repath:0,mode:'patrol',chaseUntil:0,target:null,angle:rand()*6.28,
        wobble:rand()*10,patrolWait:rand()*1.6,searchPoints:0,heardAt:-100});
    }
    decoys=[];noiseEvents=[];elapsed=0;alertLevel=0;hitFlash=0;particles=[];
    ui.label.textContent=cfg.name;ui.level.textContent=`FLOOR 0${index+1} / 0${CONFIGS.length}`;ui.note.textContent=cfg.note;
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
  function moveEntity(e,dx,dy,r=.26) {
    if(canStand(e.x+dx,e.y,r))e.x+=dx;
    if(canStand(e.x,e.y+dy,r))e.y+=dy;
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
  function notify(msg,seconds=2.7) {ui.toast.textContent=msg;toastUntil=clock+seconds;ui.toast.classList.add('show');}
  function setOverlay(title,text,button,hint='WASD / ARROWS TO MOVE · SPACE TO DASH') {
    ui.title.textContent=title;ui.text.textContent=text;ui.button.firstChild.textContent=button+' ';ui.hint.textContent=hint;
    ui.overlay.classList.remove('hidden');
  }
  function hideOverlay(){ui.overlay.classList.add('hidden');}
  function startGame(){classChoice=ui.classSelect.value==='medic'?'medic':'scout';runSeed=Math.floor(Math.random()*1000000);overallElapsed=0;buildLevel(0);state='playing';hideOverlay();notify('Rescue the survivor, collect cores, and reach the elevator.');beep(560,.16);}
  function advance() {
    if(state==='menu'||state==='victory'||state==='dead'){startGame();return;}
    if(state==='leveldone') {buildLevel(levelIndex+1);state='playing';hideOverlay();notify('New floor. Stay quiet.');return;}
    if(state==='paused') {state='playing';hideOverlay();return;}
  }
  function pause(){if(state==='playing'){state='paused';setOverlay('BREATHING ROOM','The ward is silent. Your position is safe until you resume.','RESUME GAME');}else if(state==='paused'){state='playing';hideOverlay();}}
  function triggerDecoy(){
    if(state!=='playing'||player.decoys<=0)return;
    player.decoys--;const p={x:player.x+player.facing.x*3.3,y:player.y+player.facing.y*3.3};
    const nearest=cells.filter(c=>dist({x:c.x+.5,y:c.y+.5},p)<4).sort((a,b)=>dist({x:a.x+.5,y:a.y+.5},p)-dist({x:b.x+.5,y:b.y+.5},p))[0];
    if(!nearest){player.decoys++;return;}
    decoys.push({...TILE_CENTER(nearest.x,nearest.y),life:5,age:0});
    noiseEvents.push({x:nearest.x+.5,y:nearest.y+.5,radius:11,expires:clock+1.7});
    notify('Sound decoy deployed — they heard it!');beep(850,.22,'square',.016);
    updateUI();
  }
  function dash(){if(state!=='playing'||player.dashCooldown>0)return;player.dashCooldown=3.5;player.dashTime=.24;
    let vx=(moveHeld.right?1:0)-(moveHeld.left?1:0),vy=(moveHeld.down?1:0)-(moveHeld.up?1:0);
    if(vx||vy){const len=Math.hypot(vx,vy);player.dashDir={x:vx/len,y:vy/len};}else player.dashDir={...player.facing};
    noiseEvents.push({x:player.x,y:player.y,radius:8,expires:clock+.45});
    beep(220,.17,'sawtooth',.019);updateUI();
  }
  function interact(){if(state!=='playing')return;
    if(!survivor.rescued&&dist(player,survivor)<1.5){survivor.rescued=true;survivor.repath=0;notify('SURVIVOR RESCUED — guide them to the elevator!');beep(730,.22);updateUI();return;}
    if(dist(player,relay)<1.55){if(!relay.active){relay.active=true;notify('Relay activated! Emergency elevator online if all cores are found.');beep(740,.21);beep(920,.23);}else notify('Relay already active.');updateUI();return;}
    if(dist(player,exit)<1.45){if(cores.every(c=>c.collected)&&relay.active&&survivor.rescued&&dist(survivor,exit)<2.0)completeLevel();else notify(!survivor.rescued?'RESCUE THE SURVIVOR FIRST':survivor.rescued&&dist(survivor,exit)>=2?'WAIT FOR YOUR SURVIVOR':'ELEVATOR LOCKED — collect cores and activate the relay.');return;}
    notify('Get closer to the survivor, relay, or elevator.');
  }
  function activateAbility(){
    if(state!=='playing'||player.abilityCooldown>0)return;
    if(classChoice==='medic'){
      if(player.hp>=3){notify('Already at full health.');return;}
      player.hp=Math.min(3,player.hp+1);player.abilityCooldown=16;notify('MEDIC — one health restored!');beep(880,.25);
    }else{
      const stunned=hollows.filter(h=>dist(h,player)<5.5);
      for(const h of stunned){h.stunned=2.5;h.mode='search';h.target=null;h.path=[];h.repath=0;h.chaseUntil=clock+3;}
      player.abilityCooldown=13;notify('SCOUT — '+stunned.length+' Hollows stunned!');beep(1160,.23);
    }
    updateUI();
  }
  function updateSurvivor(dt){
    if(!survivor||!survivor.rescued||survivor.extracted)return;
    if(dist(survivor,player)<1.05)return;
    survivor.repath-=dt;
    if(survivor.repath<=0){survivor.followPath=pathTo(survivor,player);survivor.followIndex=0;survivor.repath=.32;}
    if(survivor.followIndex<survivor.followPath.length){
      const stepTo=survivor.followPath[survivor.followIndex],d=dist(survivor,stepTo);
      if(d<.08)survivor.followIndex++;
      else{const speed=Math.min(3.1*dt,d);moveEntity(survivor,(stepTo.x-survivor.x)/d*speed,(stepTo.y-survivor.y)/d*speed,.22);}
    }
  }
  function completeLevel(){
    beep(950,.4,'sine',.06);beep(1180,.48,'sine',.03);
    if(levelIndex===CONFIGS.length-1){state='victory';if(best===0||overallElapsed<best){best=overallElapsed;try{localStorage.setItem('last-light-best',String(best));}catch(e){}}setOverlay('YOU FOUND THE LIGHT',`All three floors escaped in ${formatTime(overallElapsed)}. The elevator doors close behind you. Best escape: ${formatTime(best)}.`,'PLAY AGAIN','THE WARD WILL BE WAITING');}
    else {state='leveldone';setOverlay('FLOOR CLEARED',`You restored the relay, collected every core, and escaped ${CONFIGS[levelIndex].name.toLowerCase()} in ${formatTime(elapsed)}.`,'DESCEND DEEPER','THE NEXT FLOOR IS MORE DANGEROUS');}
  }
  function damage(){if(player.invincible>0||player.dashTime>0||state!=='playing')return;
    player.hp--;player.invincible=1.8;hitFlash=.45;beep(100,.3,'sawtooth',.048);notify('A Hollow touched you! Keep moving.',1.5);
    // Reposition player to start to prevent repeated contact hits.
    player.x=1.5;player.y=1.5;player.dashTime=0;
    hollows.forEach(h=>{h.mode='patrol';h.chaseUntil=0;h.path=[];h.repath=0;h.target=null;h.searchPoints=0;});
    noiseEvents=[];
    if(player.hp<=0){state='dead';setOverlay('SIGNAL LOST','The ward has taken another survivor. Try a new route, save your decoys, and break line of sight.','TRY AGAIN','THE MAZE REMAINS THE SAME — YOU CAN LEARN IT');}
    updateUI();
  }
  function updatePlayer(dt){
    player.invincible=Math.max(0,player.invincible-dt);player.dashCooldown=Math.max(0,player.dashCooldown-dt);
    player.abilityCooldown=Math.max(0,player.abilityCooldown-dt);
    let vx=(moveHeld.right?1:0)-(moveHeld.left?1:0),vy=(moveHeld.down?1:0)-(moveHeld.up?1:0);
    if(vx||vy){const len=Math.hypot(vx,vy);vx/=len;vy/=len;player.facing={x:vx,y:vy};}
    if(player.dashTime>0){player.dashTime-=dt;moveEntity(player,player.dashDir.x*9*dt,player.dashDir.y*9*dt,.24);
      if(Math.random()<.8)player.trail.push({x:player.x,y:player.y,life:.36});}
    else if(vx||vy)moveEntity(player,vx*3.5*dt,vy*3.5*dt);
    player.trail=player.trail.filter(p=>(p.life-=dt)>0);
    for(const c of cores)if(!c.collected&&dist(player,c)<.58){c.collected=true;notify('POWER CORE RECOVERED');beep(660,.17);setTimeout(()=>beep(990,.19),90);updateUI();}
    for(const h of hollows)if(!(h.stunned>0)&&dist(player,h)<.52)damage();
  }
  function updateHollows(dt){
    let danger=0;
    for(const h of hollows){
      if(h.stunned>0){h.stunned=Math.max(0,h.stunned-dt);h.wobble+=dt*5;continue;}
      const distance=dist(h,player);
      const lookX=Math.cos(h.angle),lookY=Math.sin(h.angle);
      const dot=distance>0?((player.x-h.x)*lookX+(player.y-h.y)*lookY)/distance:1;
      // A Hollow can notice a nearby player in any direction, but sees further ahead.
      const visible=distance<1.7||(distance<(h.mode==='chase'?8:6.6)&&dot>.12&&clearLine(h,player));
      const heard=noiseEvents.filter(n=>n.expires>clock&&dist(h,n)<n.radius)
        .sort((a,b)=>dist(h,a)-dist(h,b))[0];
      if(visible){
        h.mode='chase';h.target={x:player.x,y:player.y};
        h.chaseUntil=clock+2.8;h.repath=0;h.searchPoints=0;
      } else if(h.mode==='chase'&&clock>h.chaseUntil){
        // Investigate the last seen location rather than knowing where the player moved.
        h.mode='search';h.chaseUntil=clock+4.5;h.searchPoints=0;h.repath=0;
      }
      if(!visible&&heard&&h.mode!=='chase'&&(h.mode!=='lure'||h.heardAt<clock-0.65)){
        h.mode='lure';h.target={x:heard.x,y:heard.y};h.heardAt=clock;
        h.chaseUntil=clock+3.5;h.repath=0;h.searchPoints=0;
      }
      if(h.mode==='lure'&&(clock>h.chaseUntil||h.target&&dist(h,h.target)<.5)){
        h.mode='search';h.chaseUntil=clock+3.3;h.searchPoints=0;h.repath=0;
      }
      if(h.mode==='search'&&clock>h.chaseUntil){
        h.mode='patrol';h.target=null;h.repath=0;
      }
      if(h.mode==='search'&&h.target&&dist(h,h.target)<.6&&h.searchPoints<2){
        // Check neighboring passages before returning to patrol.
        const pos=tileAt(h), candidates=cells.filter(p=>Math.abs(p.x-pos.x)+Math.abs(p.y-pos.y)>=2&&Math.abs(p.x-pos.x)+Math.abs(p.y-pos.y)<=5);
        const chosen=candidates[Math.floor(rand()*candidates.length)];
        if(chosen){h.target=TILE_CENTER(chosen.x,chosen.y);h.repath=0;h.searchPoints++;}
      }
      if(h.mode==='chase')danger=Math.max(danger,distance<3.5?2:1);
      if(h.mode==='lure'&&distance<5)danger=Math.max(danger,1);
      if(h.repath<=0){
        let target=h.mode==='patrol'?null:h.target;
        if(!target){
          const pos=tileAt(h);
          const opts=cells.filter(p=>Math.abs(p.x-pos.x)+Math.abs(p.y-pos.y)>4&&Math.abs(p.x-h.home.x)+Math.abs(p.y-h.home.y)<12);
          const chosen=opts[Math.floor(rand()*opts.length)]||h.home;
          target=TILE_CENTER(chosen.x,chosen.y);
        }
        if(target)h.path=pathTo(h,target);
        h.pathIndex=0;h.repath=h.mode==='chase'?.23:(h.mode==='lure'?.65:1.25);
      }else h.repath-=dt;
      if(h.pathIndex<h.path.length){
        const p=h.path[h.pathIndex],delta=dist(h,p);
        if(delta<.07)h.pathIndex++;
        else{
          const speed=h.speed*(h.mode==='chase'?1.55:1)*(h.mode==='lure'?1.20:1);
          const step=Math.min(speed*dt,delta);
          h.angle=Math.atan2(p.y-h.y,p.x-h.x);
          h.x+=Math.cos(h.angle)*step;h.y+=Math.sin(h.angle)*step;
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
    ui.classStatus.textContent=classChoice==='medic'?'MEDIC':'SCOUT';
    ui.survivorStatus.textContent=survivor.rescued?'FOLLOWING':'TRAPPED';
    ui.abilityStatus.textContent=player.abilityCooldown<=0?(classChoice==='medic'?'HEAL READY':'PULSE READY'):`ABILITY ${player.abilityCooldown.toFixed(1)}s`;
    ui.dash.textContent=player.dashCooldown<=0?'DASH READY':`DASH ${player.dashCooldown.toFixed(1)}s`;
    ui.threat.textContent=['LOW','ALERT','PURSUIT'][alertLevel];ui.threat.className=['threat-calm','threat-alert','threat-danger'][alertLevel];
  }
  function update(dt){
    clock+=dt;if(toastUntil<clock)ui.toast.classList.remove('show');
    hitFlash=Math.max(0,hitFlash-dt);ui.flash.style.opacity=(hitFlash*.4).toFixed(2);
    if(state!=='playing')return;
    elapsed+=dt;overallElapsed+=dt;updatePlayer(dt);if(state!=='playing')return;
    updateSurvivor(dt);updateHollows(dt);
    for(const d of decoys){d.life-=dt;d.age+=dt;}decoys=decoys.filter(d=>d.life>0);
    noiseEvents=noiseEvents.filter(n=>n.expires>clock);
    if(dist(player,exit)<.58&&relay.active&&cores.every(c=>c.collected)&&survivor.rescued&&dist(survivor,exit)<2.0)completeLevel();
    if(frameIndex%8===0)updateUI();
  }
  function roundedRect(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function drawFloor(x,y){
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
    for(const d of decoys){const x=d.x*TILE,y=d.y*TILE,rad=(d.age*50)%80;ctx.strokeStyle=`rgba(244,191,101,${Math.min(.7,d.life/5)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x,y,Math.max(0,rad-24),0,Math.PI*2);ctx.stroke();diamond(x,y,7,'#ffd179');}
  }
  function drawHollows(){for(const h of hollows){let x=h.x*TILE,y=h.y*TILE,red=h.mode==='chase'&&!(h.stunned>0);
    halo(x,y,red?62:38,h.stunned>0?'#6dbeff3f':red?'#ff465b35':'#fa8f6a16');ctx.save();ctx.translate(x,y);
    ctx.fillStyle=h.stunned>0?'#79c2e7':red?'#ff5767':'#b87c83';ctx.beginPath();ctx.ellipse(0,1+Math.sin(h.wobble)*1.5,10,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#4c202d';ctx.beginPath();ctx.arc(0,-2,7,0,Math.PI*2);ctx.fill();ctx.fillStyle=red?'#ffecdc':'#ffc4bd';ctx.fillRect(-5,-4,3,3);ctx.fillRect(3,-4,3,3);
    ctx.strokeStyle=red?'#f66f78':'#92535b';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-8,6);ctx.lineTo(-12,11+Math.sin(h.wobble)*3);ctx.moveTo(8,6);ctx.lineTo(12,11-Math.sin(h.wobble)*3);ctx.stroke();
    if(red){ctx.strokeStyle='#ff546c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.stroke();}
    ctx.restore();}}
  function drawPlayer(){for(const p of player.trail){ctx.fillStyle=`rgba(110,255,218,${p.life*.55})`;ctx.beginPath();ctx.arc(p.x*TILE,p.y*TILE,8,0,Math.PI*2);ctx.fill();}
    const x=player.x*TILE,y=player.y*TILE,flicker=player.invincible>0&&Math.sin(clock*31)>0;
    if(flicker)return;
    halo(x,y,70,'#70fce319');ctx.fillStyle='#061d23';ctx.beginPath();ctx.ellipse(x,y+6,12,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=player.dashTime>0?'#dcfff7':'#8cead5';ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0d3940';ctx.beginPath();ctx.arc(x,y-2,5,0,Math.PI*2);ctx.fill();
    const fx=player.facing.x,fy=player.facing.y;ctx.strokeStyle='#e6fff7';ctx.lineWidth=2.7;ctx.beginPath();ctx.moveTo(x+fx*6,y+fy*6);ctx.lineTo(x+fx*14,y+fy*14);ctx.stroke();
    ctx.strokeStyle=player.dashTime>0?'#f0fffb':'#56bcaa';ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.stroke();
  }
  function drawDarkness(){
    const c=darkCtx;
    c.clearRect(0,0,W,H);
    c.fillStyle='rgba(0,8,13,0.63)';c.fillRect(0,0,W,H);
    c.globalCompositeOperation='destination-out';
    const lights=[{x:player.x*TILE,y:player.y*TILE,r:205,alpha:1},...cores.filter(c=>!c.collected).map(c=>({x:c.x*TILE,y:c.y*TILE,r:72,alpha:.42})),{x:relay.x*TILE,y:relay.y*TILE,r:58,alpha:.30},{x:exit.x*TILE,y:exit.y*TILE,r:52,alpha:.30},...decoys.map(d=>({x:d.x*TILE,y:d.y*TILE,r:145,alpha:.70}))];
    for(const l of lights){const g=c.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);g.addColorStop(0,`rgba(0,0,0,${l.alpha})`);g.addColorStop(.35,`rgba(0,0,0,${l.alpha*.85})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);}
    c.globalCompositeOperation='source-over';
    ctx.drawImage(darknessCanvas,0,0);
  }
  function drawMarker(x,y,clr,label){const a=clock*2;ctx.save();ctx.translate(x,y);ctx.strokeStyle=clr;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,12+Math.sin(a)*2,0,Math.PI*2);ctx.stroke();ctx.fillStyle=clr;ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText(label,0,-19);ctx.restore();}
  function objectiveDirection(){return cores.find(c=>!c.collected)||(!survivor.rescued?survivor:!relay.active?relay:exit);}
  function drawDirectionalHUD(){if(!player)return;const target=objectiveDirection(),angle=Math.atan2(target.y-player.y,target.x-player.x),x=W-52,y=53;
    roundedRect(W-168,12,156,73,11,'#07191fd9');ctx.strokeStyle='#2e5f61';ctx.lineWidth=1;ctx.strokeRect(W-168+.5,12.5,155,72);
    ctx.fillStyle='#81deca';ctx.font='bold 10px monospace';ctx.textAlign='left';ctx.fillText(cores.some(c=>!c.collected)?'FIND THE CORES':!survivor.rescued?'RESCUE THE ALLY':!relay.active?'ACTIVATE RELAY':'REACH THE EXIT',W-158,33);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#a5ffe3';ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(-7,-8);ctx.lineTo(-2,0);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.restore();
    ctx.fillStyle='#7aadb0';ctx.font='10px monospace';ctx.textAlign='left';ctx.fillText(`${Math.round(dist(player,target))}m away`,W-158,60);
  }
  function drawInteractPrompts(){ctx.font='bold 11px monospace';ctx.textAlign='center';
    let message='';if(!survivor.rescued&&dist(player,survivor)<1.5)message='[ E ] RESCUE SURVIVOR';else if(dist(player,relay)<1.55&&!relay.active)message='[ E ] ACTIVATE RELAY';else if(dist(player,exit)<1.5)message=relay.active&&cores.every(c=>c.collected)&&survivor.rescued&&dist(survivor,exit)<2?'[ E ] ESCAPE':'ELEVATOR / ALLY NOT READY';
    if(message){roundedRect(W/2-111,H-54,222,30,7,'#071c23e8');ctx.strokeStyle='#43786e';ctx.strokeRect(W/2-111,H-54,222,30);ctx.fillStyle='#d4fff2';ctx.fillText(message,W/2,H-35);}
  }
  function draw(){
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#07171d';ctx.fillRect(0,0,W,H);
    if(!grid){ctx.fillStyle='#13292e';for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if((x+y)%3===0)ctx.fillRect(x*TILE+2,y*TILE+2,27,27);return;}
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)(grid[y][x]===1?drawWall:drawFloor)(x,y);
    drawItems();drawHollows();drawPlayer();drawDarkness();drawDirectionalHUD();drawInteractPrompts();
    if(alertLevel>0&&state==='playing'){ctx.fillStyle=alertLevel===2?'#e44d6411':'#ffc17c07';ctx.fillRect(0,0,W,H);}
    // Deliberately subtle CRT-style scanlines, original and purely procedural.
    ctx.fillStyle='#0000000a';for(let y=0;y<H;y+=4)ctx.fillRect(0,y,W,1);
  }
  function tick(timestamp){const dt=Math.min(.045,Math.max(0,(timestamp-lastFrame)/1000||0));lastFrame=timestamp;frameIndex++;update(dt);draw();requestAnimationFrame(tick);}
  const keyMap={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  document.addEventListener('keydown', e => {
    const k=e.key.toLowerCase();if(keyMap[k]||[' ','e','q','f','p','escape','enter','r'].includes(k))e.preventDefault();
    if(keyMap[k])moveHeld[keyMap[k]]=true;
    if(e.repeat)return;
    if(k===' ')dash();else if(k==='q')triggerDecoy();else if(k==='e')interact();else if(k==='f')activateAbility();else if(k==='p'||k==='escape')pause();else if(k==='enter'&&state!=='playing')advance();else if(k==='r'&&state==='playing'){buildLevel(levelIndex);notify('Floor restarted.');}
  });
  document.addEventListener('keyup', e => {const dir=keyMap[e.key.toLowerCase()];if(dir)moveHeld[dir]=false;});
  window.addEventListener('blur',()=>{moveHeld={up:false,down:false,left:false,right:false};if(state==='playing')pause();});
  $('#primaryBtn').addEventListener('click',advance);
  $('#touchDash').addEventListener('click',dash);$('#touchInteract').addEventListener('click',interact);$('#touchDecoy').addEventListener('click',triggerDecoy);$('#touchAbility').addEventListener('click',activateAbility);$('#touchPause').addEventListener('click',pause);
  for(const b of document.querySelectorAll('[data-dir]')){
    const d=b.dataset.dir;
    b.addEventListener('pointerdown',e=>{e.preventDefault();moveHeld[d]=true;b.setPointerCapture(e.pointerId);});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{moveHeld[d]=false;});
  }
  ui.sound.addEventListener('click',()=>{soundEnabled=!soundEnabled;ui.sound.textContent=soundEnabled?'♪ ON':'♪ OFF';if(soundEnabled)beep(650,.12);});
  // Build the first level behind the menu so the player sees the environment before starting.
  buildLevel(0);requestAnimationFrame(tick);
  // Expose read-only diagnostics for smoke tests, not used by gameplay.
  window.__lastLightDiagnostics=()=>({state,level:levelIndex,mazeSize:[COLS,ROWS],floorTiles:cells.length,roomTiles:roomTiles.size,cores:cores.length,enemies:hollows.length,playerHP:player.hp,characterClass:classChoice,survivorRescued:survivor.rescued,abilityCooldown:player.abilityCooldown});
})();
