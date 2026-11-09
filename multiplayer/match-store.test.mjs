import assert from 'node:assert/strict';
import {makeMatchStore,buildMatchResult,achievementsForResult,buildFloorProgress} from './match-store.js';

const mockRoom={
  matchId:'match-123',name:'The Ward',unranked:false,
  members:new Map([[1,{name:'Captain'}],[2,{name:'Runner'}]]),
  engine:{snapshot:()=>({
    state:'victory',levelIndex:26,overallElapsed:180.5,
    playerRoles:['medic','infester'],players:[{hp:2},{hp:1}]
  })}
};
const result=buildMatchResult(mockRoom);
assert.equal(result.matchId,'match-123');
assert.equal(result.outcome,'victory');
assert.equal(result.floorsCleared,27);
assert.equal(result.elapsedSeconds,180.5);
assert.equal(result.competitive,true);
assert.deepEqual(result.players,[
  {slot:1,nickname:'Captain',role:'medic',hearts:2},
  {slot:2,nickname:'Runner',role:'infester',hearts:1}
]);
assert.deepEqual(result.achievements.map(a=>a.id),
  ['ward','engine','signal','team','alive']);
mockRoom.engine.snapshot=()=>({
  state:'playing',levelIndex:4,overallElapsed:14,
  playerRoles:['medic','scout'],players:[{hp:2},{hp:0}]
});
assert.equal(buildMatchResult(mockRoom),null,'Never record in-progress matches');
mockRoom.engine.snapshot=()=>({
  state:'dead',levelIndex:17,overallElapsed:140,
  playerRoles:['medic','scout'],players:[{hp:0},{hp:0}]
});
assert.equal(buildMatchResult(mockRoom).floorsCleared,17);
mockRoom.unranked=true;
mockRoom.engine.snapshot=()=>({
  state:'victory',levelIndex:26,overallElapsed:18,
  playerRoles:['medic','scout'],players:[{hp:3},{hp:3}]
});
const skipped=buildMatchResult(mockRoom);
assert.equal(skipped.competitive,false,'Developer skip must never qualify for ranking');
assert.deepEqual(skipped.achievements,[],'Developer skip cannot earn achievements');
assert.deepEqual(achievementsForResult({...result,competitive:false}),[]);
// Floor-by-floor progression survives runs that never reach the ending.
const progressRoom={
  unranked:false,
  engine:{snapshot:()=>({state:'leveldone',levelIndex:8})}
};
assert.deepEqual(buildFloorProgress(progressRoom).achievements.map(a=>a.id),['ward']);
progressRoom.engine.snapshot=()=>({state:'leveldone',levelIndex:17});
assert.deepEqual(buildFloorProgress(progressRoom).achievements.map(a=>a.id),['engine']);
progressRoom.engine.snapshot=()=>({state:'leveldone',levelIndex:10});
assert.deepEqual(buildFloorProgress(progressRoom).achievements,[]);
progressRoom.unranked=true;
progressRoom.engine.snapshot=()=>({state:'leveldone',levelIndex:8});
assert.equal(buildFloorProgress(progressRoom).eligible,false);
assert.deepEqual(buildFloorProgress(progressRoom).achievements,[]);
progressRoom.engine.snapshot=()=>({state:'playing',levelIndex:8});
assert.equal(buildFloorProgress(progressRoom),null);
progressRoom.engine.snapshot=()=>({state:'leveldone',levelIndex:26});
assert.equal(buildFloorProgress(progressRoom),null,'Final floor completes as a victory, not leveldone');
const queries=[];
let ended=false;
const fakePool=class {
  constructor(opts){assert.equal(opts.connectionString,'postgres://test:pass@localhost/test');}
  async query(sql,args){
    queries.push({sql,args});
    if(sql.includes('SELECT room_name'))return {rows:[{
      room_name:'The Ward',elapsed_seconds:180.5,players:result.players,
      floors_cleared:27,achievements:result.achievements,
      completed_at:'2026-11-09T12:00:00Z'
    }]};
    return {rowCount:1};
  }
  async end(){ended=true;}
};
const store=makeMatchStore({databaseUrl:'postgres://test:pass@localhost/test',
  loadDriver:async()=>({Pool:fakePool})});
assert.equal(store.enabled,true);
assert.equal(await store.save(result),true);
assert.equal(queries.length,6,'Schema upgrades and insert run once');
assert(queries[0].sql.includes('CREATE TABLE IF NOT EXISTS'));
assert(queries[1].sql.includes('DROP CONSTRAINT IF EXISTS'));
assert(queries[2].sql.includes('BETWEEN 0 AND 27'));
assert(queries[5].sql.includes('ON CONFLICT (match_id) DO NOTHING'));
assert.equal(queries[5].args[0],'match-123');
assert.equal(JSON.parse(queries[5].args[5])[0].nickname,'Captain');
assert.equal(queries[5].args[6],true);
assert.equal((await store.leaderboard()).entries[0].seconds,180.5);
assert(queries[6].sql.includes('WHERE competitive=TRUE'));
assert.equal(await store.save(result),true);
assert.equal(queries.length,8,'Repeated save does not recreate schema');
await store.close();
assert.equal(ended,true);
const disabled=makeMatchStore({databaseUrl:''});
assert.equal(disabled.enabled,false);
assert.equal(await disabled.save(result),false);
assert.equal((await disabled.leaderboard()).available,false);
console.log('PASS: 27-floor match persistence, schema migrations, achievements, ranked leaderboard and skip exclusion.');
