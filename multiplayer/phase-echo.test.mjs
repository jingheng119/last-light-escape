import assert from 'node:assert/strict';
import {createRoomEngine} from './headless-engine.js';

const room=createRoomEngine();
for(let id=2;id<=5;id++)room.join(id);
for(let id=1;id<=5;id++)room.role(id,'rewinder');
room.start();
for(let i=0;i<155;i++)room.tick(.033);
assert.equal(room.snapshot(false).echoAlly,null,'No Echo ally in Stage 1');
room.skip(true);
assert.equal(room.snapshot(false).echoAlly,null,'No Echo ally in Stage 2');
room.skip(true);
const stage3=room.snapshot(true);
assert.equal(stage3.levelIndex,18,'Stage 3 begins on overall floor 19');
assert.equal(stage3.echoAlly.rescued,false,'Echo starts trapped');
const team=stage3.players;
assert.equal(team.length,5);
for(let i=0;i<team.length;i++){team[i].hp=i===0?1:2;team[i].invincible=i===0?0:100;}
assert.equal(room.testRescueEcho(),true,'Stage 3 Echo ally can be rescued');
assert.equal(room.snapshot(false).echoAlly.rescued,true);
for(const p of team){
  assert.equal(p.phaseEchoCharge,1,'Rescue grants one charge to every teammate');
  assert.equal(p.phaseEchoTime,0);
}
assert.equal(room.testGhostContact(),true,'Ghost Hollow contact applies its curse first');
assert.equal(team[0].ghostTrapped,30,'Ghost curse lasts the full 30 seconds');
assert.equal(team[0].phaseEchoCharge,1,'Phase Echo charge is preserved during the curse');
assert.equal(team[0].phaseEchoTime,0,'Phase Echo does not activate on initial Ghost Hollow contact');
for(let i=0;i<601;i++)room.tick(.05);
assert.equal(team[0].ghostTrapped,0,'Ghost curse expires after 30 seconds');
assert.equal(team[0].hp,1,'Ghost curse does not remove a heart');
assert.equal(team[0].phaseEchoCharge,0,'Phase Echo charge is consumed after the curse expires');
assert.equal(team[0].phaseEchoTime,5,'Phase Echo activates automatically after the 30-second curse');
room.testHit(1);
assert.equal(team[0].hp,1,'Repeated hits during Phase Echo have no effect');
team[3].invincible=0;
room.testHit(4);
assert.equal(team[3].hp,2,'Fourth player receives own defensive trigger');
assert.equal(team[3].phaseEchoCharge,0);
assert.equal(team[1].phaseEchoCharge,1,'One player triggering does not consume another charge');
// Ghost form allows abilities and dash under the normal cooldown system.
const before=team[0].abilityCharges;
room.action(1,'ability',null,false,{kind:'player',slot:1});
assert.equal(team[0].abilityCharges,before-1,
  'A transformed player can still use their character skill');
// The ghost must cross from a genuine walkable corridor into a solid tile.
// A test that begins *inside* a wall could otherwise miss a collision bug.
const approach=room.testApproachWall(1);
assert(approach,'Stage 3 maze must have a corridor adjacent to a solid wall');
room.input(1,{right:true},{x:0,y:0});
for(let i=0;i<6;i++)room.tick(.05);
assert(Math.floor(team[0].x)>=approach.wallX,
  'Ghost must pass through the wall from the adjacent open tile');
assert.equal(room.snapshot(true).grid[Math.floor(team[0].y)][Math.floor(team[0].x)],1,
  'Phased survivor must physically occupy a solid tile while ghosted');
room.input(1,{}, {x:0,y:0});
for(let i=0;i<95;i++)room.tick(.05);
const after=room.snapshot(true);
assert.equal(team[0].phaseEchoTime,0,'Ghost transformation expires');
assert.equal(team[0].invincible,0,'Human must be vulnerable immediately after Phase Echo expires');
assert.equal(after.grid[Math.floor(team[0].y)][Math.floor(team[0].x)],0,
  'Human must reappear on a walkable tile');
assert.equal(team[0].hp,1,'Transformation does not restore or remove hearts');
// The same survivor cannot trigger a second Echo.
team[0].invincible=0;
room.testHit(1);
assert.equal(team[0].hp,0,'Second hit after consuming the charge deals normal damage');
assert.equal(team[0].phaseEchoTime,0);
assert.equal(team[0].phaseEchoCharge,0);
assert.equal(team[1].phaseEchoCharge,1,'Other teammates retain unused charges');
// A reconnect must not replenish the already consumed charge.
room.suspend(1);room.resume(1);
assert.equal(team[0].phaseEchoCharge,0);
room.suspend(2);room.resume(2);
assert.equal(team[1].phaseEchoCharge,1);
console.log('PASS: Stage 3 Echo rescues entire team, blocks one hit, phases through walls, permits skills and expires safely.');
