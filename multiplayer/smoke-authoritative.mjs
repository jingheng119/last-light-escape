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

game.join();
game.role(2,'scout');
game.input(2,{down:true},{x:0,y:0});
for(let i=0;i<12;i++)game.tick(.033);
state=game.snapshot(false);
assert(state.guestPlayer);
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
game.leave();
assert.equal(game.snapshot(false).guestPlayer,null);

console.log('PASS: original game simulation runs server-side through Stage 2, with two independent players.');
