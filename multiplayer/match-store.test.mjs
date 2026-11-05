import assert from 'node:assert/strict';
import {makeMatchStore,buildMatchResult} from './match-store.js';

const mockRoom={
  matchId:'match-123',name:'The Ward',
  members:new Map([
    [1,{name:'Captain'}],
    [2,{name:'Runner'}]
  ]),
  engine:{snapshot:()=>({
    state:'victory',levelIndex:17,overallElapsed:180.5,
    playerRoles:['medic','scout'],
    players:[{hp:2},{hp:0}]
  })}
};
const result=buildMatchResult(mockRoom);
assert.equal(result.matchId,'match-123');
assert.equal(result.outcome,'victory');
assert.equal(result.floorsCleared,18);
assert.equal(result.elapsedSeconds,180.5);
assert.deepEqual(result.players,[
  {slot:1,nickname:'Captain',role:'medic',hearts:2},
  {slot:2,nickname:'Runner',role:'scout',hearts:0}
]);
mockRoom.engine.snapshot=()=>({
  state:'playing',levelIndex:4,overallElapsed:14,
  playerRoles:['medic','scout'],players:[{hp:2},{hp:0}]
});
assert.equal(buildMatchResult(mockRoom),null,'Never record in-progress matches');
mockRoom.engine.snapshot=()=>({
  state:'dead',levelIndex:4,overallElapsed:14,
  playerRoles:['medic','scout'],players:[{hp:0},{hp:0}]
});
assert.equal(buildMatchResult(mockRoom).floorsCleared,4);
const queries=[];
let ended=false;
const fakePool=class {
  constructor(opts){assert.equal(opts.connectionString,'postgres://test:pass@localhost/test');}
  async query(sql,args){queries.push({sql,args});return {rowCount:1};}
  async end(){ended=true;}
};
const store=makeMatchStore({databaseUrl:'postgres://test:pass@localhost/test',
  loadDriver:async()=>({Pool:fakePool})});
assert.equal(store.enabled,true);
assert.equal(await store.save(result),true);
assert.equal(queries.length,2,'Create schema once and insert match result');
assert(queries[0].sql.includes('CREATE TABLE IF NOT EXISTS'));
assert(queries[1].sql.includes('ON CONFLICT (match_id) DO NOTHING'));
assert.equal(queries[1].args[0],'match-123');
assert.equal(JSON.parse(queries[1].args[5])[0].nickname,'Captain');
assert.equal(await store.save(result),true);
assert.equal(queries.length,3,'Repeated save does not recreate table');
await store.close();
assert.equal(ended,true);
const disabled=makeMatchStore({databaseUrl:''});
assert.equal(disabled.enabled,false);
assert.equal(await disabled.save(result),false);
console.log('PASS: optional PostgreSQL schema, parameterized idempotent match writes and accurate finished-match data.');
