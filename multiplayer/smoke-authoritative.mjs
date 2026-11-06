import assert from 'node:assert/strict';
import { createRoomEngine } from './headless-engine.js';

// Rewinder maintains a server-only timeline and returns exactly one
// character to its three-seconds-ago position without healing.
function makeRewindRoom(){
  const room=createRoomEngine();
  room.role(1,'rewinder');room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const snap=room.snapshot(true),p=snap.player;
  for(let y=0;y<snap.grid.length;y++)
    for(let x=0;x<snap.grid[y].length;x++)
      snap.grid[y][x]=y===3&&x>=1&&x<=24?0:1;
  for(const h of snap.hollows){h.x=25;h.y=15;h.stunned=100;}
  p.x=2.5;p.y=3.5;p.hp=2;p.invincible=100;
  return {room,snap,p};
}
{
  const {room,p}=makeRewindRoom();
  room.input(1,{right:true},{x:0,y:0});
  for(let i=0;i<20;i++)room.tick(.033);
  const oldX=p.x;
  for(let i=0;i<91;i++)room.tick(.033);
  const before=p.x;
  assert(before>oldX+5,'Player must have moved after recorded position');
  assert.equal(room.snapshot(false).playerRoles[0],'rewinder');
  room.input(1,{}, {x:0,y:0});
  room.action(1,'ability');
  assert(Math.abs(p.x-oldX)<.5,'Rewinder must return to position from 3 seconds earlier');
  assert.equal(p.y,3.5,'Rewind should preserve recorded row');
  assert.equal(p.hp,2,'Rewinding must not restore health');
  assert(p.abilityCooldown>24,'Rewind must begin its 25s cooldown');
  const landed=p.x;
  room.action(1,'ability');
  assert.equal(p.x,landed,'Rewind cannot activate twice during cooldown');
}
{
  const {room,p,snap}=makeRewindRoom();
  room.input(1,{right:true},{x:0,y:0});
  for(let i=0;i<20;i++)room.tick(.033);
  const oldX=p.x;
  for(let i=0;i<91;i++)room.tick(.033);
  room.input(1,{}, {x:0,y:0});
  // Mark the exact recorded position as occupied by a stunned Hollow.
  snap.hollows[0].x=oldX;snap.hollows[0].y=3.5;
  room.action(1,'ability');
  assert(Math.hypot(p.x-oldX,p.y-3.5)<=3.01,
    'Blocked rewind must use a safe tile within three cells of recorded location');
  assert(Math.hypot(p.x-oldX,p.y-3.5)>.85,
    'Rewind must not land on top of a Hollow');
  assert.equal(snap.grid[Math.floor(p.y)][Math.floor(p.x)],0,
    'Fallback rewind must land on a walkable tile');
  assert.equal(p.hp,2,'Blocked rewind also cannot heal');
}
{
  const room=createRoomEngine();
  for(let id=2;id<=5;id++)room.join(id);
  for(let id=1;id<=5;id++)room.role(id,'rewinder');
  room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const snap=room.snapshot(false);
  assert.deepEqual(Array.from(snap.playerRoles),Array(5).fill('rewinder'),
    'All five player slots must support Rewinder role selection');
  for(const p of snap.players)p.invincible=100;
  room.action(4,'ability');
  assert(snap.players[3].abilityCooldown>24,'Fourth player can rewind');
  assert.equal(snap.players[0].abilityCooldown,0,'Other player cooldown unaffected');
  assert.equal(snap.players[4].abilityCooldown,0,'Fifth player cooldown unaffected');
  assert(!Object.hasOwn(snap.players[3],'rewindHistory'),
    'History must never be attached to network player snapshots');
}

// Illusioner spawns exactly one independent, invincible moving Phantom
// Double. Hollows must prioritize it over living players until it expires.
{
  const room=createRoomEngine();
  room.role(1,'illusioner');room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const snap=room.snapshot(true),p=snap.player;
  p.invincible=100;
  const h=snap.hollows[0];
  p.x=h.x;p.y=h.y;p.facing={x:1,y:0};
  const hp=p.hp;
  room.action(1,'ability');
  let state=room.snapshot(false);
  assert.equal(state.playerRoles[0],'illusioner','Illusioner is selectable');
  assert.equal(state.illusions.length,1,'Phantom Double must spawn once');
  assert.equal(state.illusions[0].life,5,'Phantom lasts five seconds');
  assert(state.player.abilityCooldown>21,'Phantom skill starts cooldown');
  assert.equal(state.illusions[0].ownerSlot,1,'Phantom has its caster slot');
  const initial={x:state.illusions[0].x,y:state.illusions[0].y};
  room.action(1,'ability');
  assert.equal(room.snapshot(false).illusions.length,1,'Cooldown prevents extra illusions');
  room.tick(.033);
  state=room.snapshot(false);
  assert(state.illusions[0].life<5,'Phantom duration must tick down');
  assert(state.illusions[0].x>=initial.x,'Phantom cannot walk backward');
  assert(state.hollows.some(ghost=>ghost.mode==='illusion'),
    'Nearby Hollows must chase an illusion rather than a real survivor');
  assert.equal(p.hp,hp,'Hollow contact with a phantom does not injure its owner');
  for(let i=0;i<155;i++)room.tick(.033);
  state=room.snapshot(false);
  assert.equal(state.illusions.length,0,'Phantom expires after five seconds');
  assert(!state.hollows.some(ghost=>ghost.mode==='illusion'),
    'Hollows must abandon expired phantoms');
}
{
  const room=createRoomEngine();
  for(let id=2;id<=5;id++)room.join(id);
  for(let id=1;id<=5;id++)room.role(id,'illusioner');
  room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const snap=room.snapshot(false);
  for(const p of snap.players){p.invincible=100;}
  assert.deepEqual(Array.from(snap.playerRoles),Array(5).fill('illusioner'),
    'Illusioner selectable for every multiplayer slot');
  room.action(4,'ability');
  const phantoms=room.snapshot(false).illusions;
  assert.equal(phantoms.length,1,'Fourth player creates one phantom');
  assert.equal(phantoms[0].ownerSlot,4,'Fourth player phantom has correct owner');
  room.action(5,'ability');
  const combined=room.snapshot(false).illusions;
  assert.equal(combined.length,2,'Teammates can each have their own phantom');
  assert.deepEqual(Array.from(combined,p=>p.ownerSlot),[4,5],
    'Each illusion belongs to the correct teammate');
}
{
  const room=createRoomEngine();
  room.role(1,'illusioner');room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const snap=room.snapshot(true),p=snap.player;
  // A right-angle maze corridor: the phantom must walk forward,
  // then turn down when the corridor bends instead of stopping.
  for(let y=0;y<snap.grid.length;y++)
    for(let x=0;x<snap.grid[y].length;x++)
      snap.grid[y][x]=(y===3&&x>=1&&x<=4)||(x===4&&y>=3&&y<=8)?0:1;
  p.x=2.5;p.y=3.5;p.facing={x:1,y:0};p.invincible=100;
  room.action(1,'ability');
  for(let i=0;i<38;i++)room.tick(.033);
  const phantom=room.snapshot(false).illusions[0];
  assert(phantom,'Phantom stays active after reaching a corner');
  assert(phantom.x>4.4&&phantom.x<4.6,
    'Phantom must align with the corner and turn instead of moving through the wall');
  assert(phantom.y>3.7,
    'Phantom must turn down into the side passage at a corner');
  assert(phantom.life>3,'Phantom remains active for its five-second duration');
  assert.equal(snap.grid[Math.floor(phantom.y)][Math.floor(phantom.x)],0,
    'Phantom must stay on walkable maze tiles');
}

{
  const room=createRoomEngine();
  room.role(1,'illusioner');room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const snap=room.snapshot(true),p=snap.player;
  for(let y=0;y<snap.grid.length;y++)
    for(let x=0;x<snap.grid[y].length;x++)
      snap.grid[y][x]=y===3&&x>=1&&x<=3?0:1;
  p.x=2.5;p.y=3.5;p.facing={x:1,y:0};p.invincible=100;
  room.action(1,'ability');
  for(let i=0;i<40;i++)room.tick(.033);
  const phantom=room.snapshot(false).illusions[0];
  assert(phantom,'Phantom stays alive after reaching a dead end');
  assert(phantom.x<3.5,'Phantom turns around at a dead end');
  assert(phantom.life>3,'Dead end does not shorten phantom duration');
}

// Teleporter: shield is armed for five seconds, protects exactly one hit,
// and phases through walls while landing on a safe tile within three cells.
function makeTeleporterRoom(){
  const room=createRoomEngine();
  room.role(1,'teleporter');
  room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  return room;
}
{
  const room=makeTeleporterRoom(),state=room.snapshot(true),p=state.player;
  // Clear a safe horizontal lane and place the caster at its start.
  for(let y=0;y<state.grid.length;y++)
    for(let x=0;x<state.grid[y].length;x++)
      state.grid[y][x]=x>=1&&x<=8&&y===3?0:1;
  p.x=2.5;p.y=3.5;p.facing={x:1,y:0};
  state.hollows.forEach(h=>{h.x=20;h.y=15;h.stunned=100;});
  room.action(1,'ability');
  assert.equal(p.phaseGuardTime,5,'Phase Guard must last five seconds');
  assert(p.abilityCooldown>19,'Phase Guard must begin cooldown on activation');
  const hp=p.hp;
  room.testHit(1);
  assert.equal(p.hp,hp,'Phase Guard must block the triggering damage');
  assert.equal(p.phaseGuardTime,0,'Phase Guard is consumed by first hit');
  assert(p.x>5.3&&p.x<=5.51,'A clear path teleports forward three cells');
  assert.equal(p.y,3.5,'A straight teleport must preserve the row');
  assert(p.invincible>0,'Landing grants short collision grace');
  assert(p.abilityCooldown>0,'Using protection does not reset cooldown');
}
{
  const room=makeTeleporterRoom(),state=room.snapshot(true),p=state.player;
  for(let y=0;y<state.grid.length;y++)
    for(let x=0;x<state.grid[y].length;x++)
      state.grid[y][x]=x>=1&&x<=4&&y>=2&&y<=5?0:1;
  // A wall lies between the player and the landing tile.
  // Teleport must cross it rather than stopping before it.
  state.grid[3][3]=1;
  p.x=2.5;p.y=3.5;p.facing={x:1,y:0};
  state.hollows.forEach(h=>{h.x=20;h.y=15;h.stunned=100;});
  room.action(1,'ability');const hp=p.hp;
  room.testHit(1);
  assert.equal(p.hp,hp,'Wall-blocked shield still prevents damage');
  assert.equal(state.grid[Math.floor(p.y)][Math.floor(p.x)],0,
    'Wall-crossing teleport must end on a walkable tile');
  assert(Math.hypot(p.x-2.5,p.y-3.5)<=3.15,
    'Alternate landing must remain within three cells');
  assert(p.x>3.5,
    'Teleport should cross the intervening wall and land beyond it');
}
{
  const room=makeTeleporterRoom(),state=room.snapshot(true),p=state.player;
  for(let y=0;y<state.grid.length;y++)
    for(let x=0;x<state.grid[y].length;x++)
      state.grid[y][x]=x===2&&y===3?0:x===5&&y===4?0:1;
  p.x=2.5;p.y=3.5;p.facing={x:1,y:0};
  state.hollows.forEach(h=>{h.x=20;h.y=15;h.stunned=100;});
  room.action(1,'ability');
  const hp=p.hp;
  room.testHit(1);
  assert.equal(p.hp,hp,'Blocked destination still protects from damage');
  assert.equal(state.grid[Math.floor(p.y)][Math.floor(p.x)],0,
    'Fallback destination must land on walkable ground');
  assert(p.x===2.5&&p.y===3.5,
    'With no safe landing within three cells, remain at origin');
}
{
  const room=makeTeleporterRoom(),state=room.snapshot(true),p=state.player;
  for(let y=0;y<state.grid.length;y++)
    for(let x=0;x<state.grid[y].length;x++)
      state.grid[y][x]=x===2&&y===3?0:x===5&&y===3?0:1;
  p.x=2.5;p.y=3.5;p.facing={x:1,y:0};
  state.hollows.forEach(h=>{h.x=20;h.y=15;h.stunned=100;});
  room.action(1,'ability');room.testHit(1);
  assert.equal(p.x,5.5,'Teleport can cross a sealed wall to reach a clear destination');
  assert.equal(p.y,3.5,'Phase teleport keeps the intended heading');
}
{
  const room=makeTeleporterRoom(),p=room.snapshot(false).player;
  room.action(1,'ability');
  for(let i=0;i<155;i++)room.tick(.033);
  assert.equal(p.phaseGuardTime,0,'Unused shield must expire after five seconds');
  assert(p.abilityCooldown>0,'Cooldown continues after protection expires');
}
{
  const room=createRoomEngine();
  for(let id=2;id<=5;id++)room.join(id);
  for(let id=1;id<=5;id++)room.role(id,'teleporter');
  room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  assert.deepEqual(Array.from(room.snapshot(false).playerRoles),Array(5).fill('teleporter'),
    'Teleporter must be selectable for every multiplayer slot');
  room.action(4,'ability');
  const players=room.snapshot(false).players;
  assert.equal(players[3].phaseGuardTime,5,'Fourth player can activate Phase Guard');
  assert.equal(players[0].phaseGuardTime||0,0,'Shield must not cover teammates');
  assert.equal(players[4].phaseGuardTime||0,0,'Fifth player stays unshielded');
}

// Vanish is owned by the authoritative simulation. It affects only the
// caster, expires after three seconds, and prevents Hollows selecting them.
{
  const room=createRoomEngine();
  room.role(1,'invisibler');
  room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const active=room.snapshot(false);
  const caster=active.player;
  assert.equal(active.playerRoles[0],'invisibler');
  room.action(1,'ability');
  assert.equal(caster.invisibleTime,3,'Vanish lasts exactly three seconds');
  assert(caster.abilityCooldown>17,'Successful Vanish starts its cooldown');
  assert.equal(caster.hp,3,'Vanish does not heal the caster');
  room.action(1,'ability');
  assert.equal(caster.invisibleTime,3,'Cannot refresh invisibility on cooldown');
  for(let i=0;i<29;i++)room.tick(.033);
  assert(caster.invisibleTime>1.9&&caster.invisibleTime<2.1,
    'Vanish timer must advance using game simulation time');
  assert.equal(room.snapshot(false).hollows.filter(h=>h.mode==='chase').length,0,
    'A solo invisible player cannot be acquired as a Hollow chase target');
  for(let i=0;i<65;i++)room.tick(.033);
  assert.equal(caster.invisibleTime,0,'Vanish must end automatically after three seconds');
  assert(caster.abilityCooldown>0,'Cooldown continues after Vanish expires');
}
{
  const room=createRoomEngine();
  room.join(2);room.join(3);room.join(4);room.join(5);
  for(let id=1;id<=5;id++)room.role(id,'invisibler');
  room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  assert.deepEqual(Array.from(room.snapshot(false).playerRoles),Array(5).fill('invisibler'),
    'Invisibler can be selected by every multiplayer slot');
  room.action(4,'ability');
  const players=room.snapshot(false).players;
  assert.equal(players[3].invisibleTime,3,'Fourth player can activate Vanish');
  assert.equal(players[0].invisibleTime||0,0,'Vanish does not apply to teammates');
  assert.equal(players[4].invisibleTime||0,0,'Fifth player remains visible');
}
// Medic heals the caster first, then exactly one random injured teammate
// within 5.5 cells. Failed heals must not consume the skill cooldown.
function readyMedicRoom(){
  const room=createRoomEngine();
  room.join(2);room.join(3);room.join(4);room.join(5);
  room.role(2,'medic');room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const players=room.snapshot(false).players;
  for(const p of players){p.x=3.5;p.y=3.5;p.invincible=100;}
  return {room,players};
}
{
  const {room,players}=readyMedicRoom();
  players[1].hp=2;players[0].hp=1;players[2].hp=2;
  room.action(2,'ability');
  assert.equal(players[1].hp,3,'Medic must heal themselves before teammates');
  assert.equal(players[0].hp,1,'Self-heal must not also heal a teammate');
  assert.equal(players[2].hp,2,'One activation must heal exactly one heart');
  assert(players[1].abilityCooldown>0,'Successful self-heal consumes cooldown');
}
{
  const {room,players}=readyMedicRoom();
  players[0].hp=2;players[2].hp=1;players[3].hp=2;
  players[4].hp=2;players[4].x=100;players[4].y=100;
  room.action(2,'ability');
  const newlyHealed=[players[0],players[2],players[3]].filter((p,i)=>
    p.hp>[2,1,2][i]);
  assert.equal(newlyHealed.length,1,'Only one injured teammate may be healed');
  assert.equal(players[1].hp,3,'Healthy Medic stays at full health');
  assert.equal(players[4].hp,2,'Out-of-range teammate must not be healed');
  assert(players[1].abilityCooldown>0,'Healing teammate consumes cooldown');
}
{
  const {room,players}=readyMedicRoom();
  players[0].hp=2;players[0].x=100;
  players[2].hp=0;
  room.action(2,'ability');
  assert.equal(players[0].hp,2,'Out-of-range teammate is unchanged');
  assert.equal(players[2].hp,0,'Medic skill must not revive downed players');
  assert.equal(players[1].abilityCooldown,0,'Failed heal must not consume cooldown');
  players[0].x=3.5;
  room.action(2,'ability');
  assert.equal(players[0].hp,3,'Medic can heal after an unsuccessful attempt');
}

// A diagonal mobile dash must slide along an impassable wall instead of
// reversing direction or stopping on contact. Straight-on dashes still stop.
function testWallDash(direction,{touch=false,atWall=false}={}){
  const room=createRoomEngine();
  room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  const map=room.snapshot(true);
  for(let y=0;y<map.grid.length;y++)
    for(let x=0;x<map.grid[y].length;x++)
      map.grid[y][x]=x===1&&y>=1&&y<=10?0:1;
  map.player.x=atWall?1.185:1.5;map.player.y=3.5;
  room.action(1,'dash',direction,touch);
  for(let i=0;i<3;i++)room.tick(.033);
  return room.snapshot(false).player;
}
const diagonalWallDash=testWallDash({x:-1,y:1});
assert(diagonalWallDash.y>3.65,
  'Diagonal dash against a vertical wall must keep moving along its free axis');
assert(diagonalWallDash.x>=1.20,
  'Diagonal dash must not go through the wall');
// Reproduce real phone movement: walking places the character only 0.18
// tiles from a wall. DASH must keep this radius even if input lags.
const contactDiagonalDash=testWallDash({x:-1,y:1},{touch:true,atWall:true});
assert(contactDiagonalDash.y>3.65,
  'Mobile diagonal dash must slide when already flush against a wall');
assert(contactDiagonalDash.x>=1.18,
  'Mobile dash must not cross a solid wall at zero gap');
const contactStraightDash=testWallDash({x:-1,y:0},{touch:true,atWall:true});
assert(Math.abs(contactStraightDash.y-3.5)<.001,
  'Mobile straight wall dash must stop, never reverse direction');
const straightWallDash=testWallDash({x:-1,y:0});
assert(Math.abs(straightWallDash.y-3.5)<.001,
  'Straight wall dash must not reverse or slide sideways');
assert(straightWallDash.x>=1.20,
  'Straight dash must stop at a solid wall');

const game=createRoomEngine();
let state=game.snapshot(true);
assert.equal(state.state,'menu');
assert.equal(state.grid.length,21);
assert.equal(state.hollows.length,3);
game.role(1,'medic');
game.start();
state=game.snapshot(true);
assert.equal(state.state,'countdown');
assert.equal(Math.ceil(state.countdownRemaining),5);
assert.equal(state.classChoice,'medic');
const startPosition={x:state.player.x,y:state.player.y};
game.input(1,{right:true},{x:0,y:0});
game.action(1,'dash',{x:1,y:0});
for(let i=0;i<120;i++)game.tick(.033);
state=game.snapshot(false);
assert.equal(state.state,'countdown');
assert.equal(Math.ceil(state.countdownRemaining),2);
assert.deepEqual({x:state.player.x,y:state.player.y},startPosition,
  'No player may move during countdown');
assert.equal(state.player.dashCooldown,0,'Dashing before countdown must be ignored');
for(let i=0;i<34;i++)game.tick(.033);
state=game.snapshot(false);
assert.equal(state.state,'playing');
assert.equal(state.player.dashCooldown,0);

game.input(1,{right:true},{x:0,y:0});
for(let i=0;i<12;i++)game.tick(.033);
state=game.snapshot(false);
assert(state.elapsed>0);
assert(state.player.hp>0);
assert(state.hollows.length>0);

// A player entering an in-progress run starts with three hearts even if
// the host has taken damage. This must not heal the host or copy cooldowns.
const lateRoom=createRoomEngine();
lateRoom.start();
for(let i=0;i<155;i++)lateRoom.tick(.033);
const lateHost=lateRoom.snapshot(false).player;
lateHost.hp=1;
lateHost.dashCooldown=2.5;
lateHost.abilityCooldown=4;
lateRoom.join(2);
const lateJoined=lateRoom.snapshot(false);
assert.equal(lateJoined.players[0].hp,1,'Joining must not heal the host');
assert.equal(lateJoined.players[1].hp,3,'Late joining slot 2 starts with full hearts');
assert.equal(lateJoined.players[1].dashCooldown,0,'New teammate must not inherit host dash cooldown');
assert.equal(lateJoined.players[1].abilityCooldown,0,'New teammate must not inherit host ability cooldown');
for(let slot=3;slot<=5;slot++)lateRoom.join(slot);
assert.deepEqual(Array.from(lateRoom.snapshot(false).players.slice(1),p=>p.hp),[3,3,3,3],
  'Every late-joining teammate starts with independent full hearts');
lateRoom.snapshot(false).players[1].hp=2;
assert.equal(lateRoom.snapshot(false).players[0].hp,1,
  'Taking damage to a teammate must not change host hearts');

game.join(2);
game.join(3);
game.join(4);
game.join(5);
game.role(2,'scout');
game.input(2,{down:true},{x:0,y:0});
for(let i=0;i<12;i++)game.tick(.033);
state=game.snapshot(false);
assert(state.guestPlayer);
assert.equal(state.players.filter(Boolean).length,5,'Five players must have independent bodies');
for(let slot=3;slot<=5;slot++){
  game.role(slot,slot===4?'medic':'scout');
  game.input(slot,{right:true},{x:0,y:0});
  game.action(slot,'dash',{x:1,y:0});
}
state=game.snapshot(false);
assert(state.players.slice(2).every(p=>p?.dashCooldown>0));
assert.equal(state.playerRoles[3],'medic');

game.action(1,'dash',{x:1,y:0});
game.action(2,'dash',{x:0,y:1});
state=game.snapshot(false);
assert(state.player.dashCooldown>0);
assert(state.guestPlayer.dashCooldown>0);

game.skip(true);
state=game.snapshot(true);
assert.equal(state.levelIndex,9);
assert.equal(state.grid.length,41);
assert(state.hollows.length>=12);
game.skip(true);
state=game.snapshot(true);
assert.equal(state.levelIndex,17);
assert.equal(state.grid.length,41);
assert.equal(state.players.filter(Boolean).length,5);
// Five-player revival: a nearby teammate can restore a downed teammate.
for(let slot=1;slot<=5;slot++)game.input(slot,{}, {x:0,y:0});
for(const h of state.hollows)h.stunned=999;
const soul=state.players[4],rescuer=state.players[3];
soul.hp=0;soul.x=rescuer.x;soul.y=rescuer.y;
for(let i=0;i<165;i++)game.tick(.033);
state=game.snapshot(false);
assert.equal(state.players[4].hp,1,'Teammates should revive a fifth player');
// Every living player must reach the exit, not just the room creator.
const exitSpot=state.exit;
for(const p of state.players.filter(Boolean)){p.x=exitSpot.x;p.y=exitSpot.y;}
state.players[4].x=1.5;state.players[4].y=1.5;
state.relay.active=true;state.cores.forEach(c=>{c.collected=true;});
state.survivor.rescued=true;state.survivor.x=exitSpot.x;state.survivor.y=exitSpot.y;
state.technician.rescued=true;state.technician.x=exitSpot.x;state.technician.y=exitSpot.y;
game.tick(.033);
assert.equal(game.snapshot(false).state,'playing','Fifth player must be at elevator');
state.players[4].x=exitSpot.x;state.players[4].y=exitSpot.y;
game.tick(.033);
assert.equal(game.snapshot(false).state,'victory','All five players should escape together');

game.leave(1);
state=game.snapshot(false);
assert.equal(state.player.hp,0);
assert(state.guestPlayer.hp>0);
game.leave(2);
assert.equal(game.snapshot(false).guestPlayer,null);
assert.equal(game.snapshot(false).players.filter(Boolean).length,3);

// A non-host player reaching zero hearts must become a revivable soul,
// not end the room while any other connected teammate is alive.
for(const downedSlot of [2,3,4,5]){
  const room=createRoomEngine();
  room.join(2);room.join(3);room.join(4);room.join(5);room.start();
  for(let i=0;i<155;i++)room.tick(.033);
  for(let hit=0;hit<3;hit++)room.testHit(downedSlot);
  const snap=room.snapshot(false);
  assert.equal(snap.state,'playing','Player '+downedSlot+' death must not end a living team run');
  assert.equal(snap.players[downedSlot-1].hp,0,'Player '+downedSlot+' must become a soul');
  assert(snap.players[0].hp>0,'Host must remain alive');
  // Host can also become a soul while a teammate remains active.
  for(let hit=0;hit<3;hit++)room.testHit(1);
  assert.equal(room.snapshot(false).state,'playing','Host death must not end team while others remain');
}
const duet=createRoomEngine();
duet.join(2);duet.start();
for(let i=0;i<155;i++)duet.tick(.033);
for(let hit=0;hit<3;hit++)duet.testHit(2);
assert.equal(duet.snapshot(false).state,'playing','Second player down, first alive');
assert.equal(duet.snapshot(false).guestPlayer.hp,0);
for(let hit=0;hit<3;hit++)duet.testHit(1);
assert.equal(duet.snapshot(false).state,'dead','Only end when all connected players are down');

console.log('PASS: original game simulation runs server-side through Stage 2, with five independent players and correct co-op death conditions.');
