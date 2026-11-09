import assert from 'node:assert/strict';
import {createInputGate} from './input-rate.js';

const gate=createInputGate(20);
assert.equal(gate('idle',0),true,'First input accepted');
assert.equal(gate('idle',5),false,'Duplicate within window suppressed');
assert.equal(gate('right',6),true,'Direction pressed immediately');
assert.equal(gate('idle',7),true,'Key released immediately after press');
assert.equal(gate('left',8),true,'Opposite direction accepted immediately');
assert.equal(gate('left',10),false,'Identical repeated direction suppressed');
assert.equal(gate('left',30),true,'Held direction accepted as heartbeat');
assert.equal(gate('stick:0.5',31),true,'Joystick movement accepted immediately');
assert.equal(gate('stick:0',32),true,'Joystick return to neutral accepted immediately');
console.log('PASS: movement input deduplication preserves immediate control changes.');
