import assert from 'node:assert/strict';
import { createRoomEngine } from './headless-engine.js';

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
