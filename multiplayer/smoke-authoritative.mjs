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

game.hostLeft();
state=game.snapshot(false);
assert.equal(state.player.hp,0);
assert(state.guestPlayer.hp>0);
game.leave(2);
assert.equal(game.snapshot(false).guestPlayer,null);
assert.equal(game.snapshot(false).players.filter(Boolean).length,4);

console.log('PASS: original game simulation runs server-side through Stage 2, with two independent players.');
