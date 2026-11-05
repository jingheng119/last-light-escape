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
assert.equal(state.state,'playing');
assert.equal(state.classChoice,'medic');

game.input(1,{right:true},{x:0,y:0});
for(let i=0;i<12;i++)game.tick(.033);
state=game.snapshot(false);
assert(state.elapsed>0);
assert(state.player.hp>0);
assert(state.hollows.length>0);

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

console.log('PASS: original game simulation runs server-side through Stage 2, with five independent players.');
