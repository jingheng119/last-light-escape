import assert from 'node:assert/strict';
import {makeMatchStore,buildMatchResult,achievementsForResult,buildFloorProgress} from './match-store.js';

const mockRoom={
  matchId:'match-123',name:'The Ward',unranked:false,
  members:new Map([[1,{name:'Captain'}],[2,{name:'Runner'}]]),
  matchParticipants:new Map([[1,{name:'Captain'}],[2,{name:'Runner'}]]),
  engine:{snapshot:()=>({
    state:'victory',levelIndex:26,overallElapsed:180.5,
    playerRoles:['medic','symbiote'],players:[{hp:2},{hp:1}]
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
  {slot:2,nickname:'Runner',role:'symbiote',hearts:1}
]);
assert.deepEqual(result.achievements.map(a=>a.id),
  ['ward','engine','signal','team','alive']);
mockRoom.members.delete(2);
const disconnected=buildMatchResult(mockRoom);
assert.equal(disconnected.players.length,2,
  'Starting roster prevents a disconnected team becoming a solo leaderboard entry');
mockRoom.members.set(2,{name:'Runner'});
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
// Release regression: solo and five-player records must remain distinct,
// and only genuine 27-floor victories may earn the final achievement.
{
  const roster=new Map([[1,{name:'Solo Pilot'}]]);
  const soloRoom={
    matchId:'solo-record',name:'Solo Run',unranked:false,
    members:roster,matchParticipants:new Map(roster),
    engine:{snapshot:()=>({
      state:'victory',levelIndex:26,overallElapsed:432.75,
      playerRoles:['symbiote'],players:[{hp:1}]
    })}
  };
  const soloResult=buildMatchResult(soloRoom);
  assert.equal(soloResult.competitive,true);
  assert.equal(soloResult.players.length,1);
  assert.equal(soloResult.players[0].role,'symbiote');
  assert.deepEqual(soloResult.achievements.map(a=>a.id),
    ['ward','engine','signal','solo','alive']);
  assert(!soloResult.achievements.some(a=>a.id==='team'),
    'Solo victory must never receive the team achievement');

  const teamRoster=new Map(Array.from({length:5},(_,i)=>
    [i+1,{name:'Teammate '+(i+1)}]));
  const fiveRoom={
    matchId:'five-record',name:'Five Player Run',unranked:false,
    members:teamRoster,matchParticipants:new Map(teamRoster),
    engine:{snapshot:()=>({
      state:'victory',levelIndex:26,overallElapsed:815,
      playerRoles:['scout','medic','invisibler','anchor','symbiote'],
      players:[{hp:3},{hp:2},{hp:1},{hp:0},{hp:2}]
    })}
  };
  const fiveResult=buildMatchResult(fiveRoom);
  assert.equal(fiveResult.competitive,true);
  assert.equal(fiveResult.players.length,5);
  assert.deepEqual(fiveResult.players.map(p=>p.role),
    ['scout','medic','invisibler','anchor','symbiote']);
  assert.deepEqual(fiveResult.players.map(p=>p.hearts),[3,2,1,0,2]);
  assert.deepEqual(fiveResult.achievements.map(a=>a.id),
    ['ward','engine','signal','team'],
    'Everyone Made It requires all five teammates alive');

  // Ranking eligibility is determined by the server's level and skip
  // marker, not by a client's claimed completion time or name.
  fiveRoom.unranked=true;
  const unrankedFive=buildMatchResult(fiveRoom);
  assert.equal(unrankedFive.competitive,false);
  assert.deepEqual(unrankedFive.achievements,[]);
  fiveRoom.unranked=false;
  fiveRoom.engine.snapshot=()=>({
    state:'dead',levelIndex:26,overallElapsed:815,
    playerRoles:['scout','medic','invisibler','anchor','symbiote'],
    players:[{hp:0},{hp:0},{hp:0},{hp:0},{hp:0}]
  });
  const failedFinalFloor=buildMatchResult(fiveRoom);
  assert.equal(failedFinalFloor.competitive,false,
    'Reaching the last floor without winning must not count as a victory');
  assert(!failedFinalFloor.achievements.some(a=>['signal','team','alive'].includes(a.id)),
    'A loss cannot earn victory-only achievements');
}

// Public beta gate: incomplete legitimate runs can retain stage badges,
// but may never receive victory-only achievements or ranked times.
{
  const roster=new Map([[1,{name:'Stage Tester'}]]);
  const room={
    matchId:'failed-after-stage',name:'Trial',unranked:false,
    members:roster,matchParticipants:new Map(roster),
    engine:{snapshot:()=>({
      state:'dead',levelIndex:19,overallElapsed:509,
      playerRoles:['anchor'],players:[{hp:0}]
    })}
  };
  const failed=buildMatchResult(room);
  assert.equal(failed.competitive,false);
  assert.equal(failed.floorsCleared,19);
  assert.deepEqual(failed.achievements.map(a=>a.id),['ward','engine'],
    'Legitimate failed runs retain stage achievements, not victory awards');
  room.unranked=true;
  assert.deepEqual(buildMatchResult(room).achievements,[],
    'Developer skip disqualifies every achievement');
  room.unranked=false;
  room.engine.snapshot=()=>({
    state:'victory',levelIndex:26,overallElapsed:625,
    playerRoles:['anchor'],players:[{hp:0}]
  });
  const finish=buildMatchResult(room);
  assert.equal(finish.competitive,true);
  assert.deepEqual(finish.achievements.map(a=>a.id),
    ['ward','engine','signal','solo'],
    'Finishing with zero hearts must not grant Everyone Made It');
}

const queries=[];
let ended=false;
const fakePool=class {
  constructor(opts){assert.equal(opts.connectionString,'postgres://test:pass@localhost/test');}
  async query(sql,args){
    queries.push({sql,args});
    if(sql.includes('SELECT room_name')){
      assert(sql.includes("competitive=TRUE"));
      assert(sql.includes("outcome='victory'"));
      assert(sql.includes('floors_cleared=27'));
      assert(sql.includes('jsonb_array_length(players)'));
      assert(sql.includes('ORDER BY elapsed_seconds ASC,completed_at ASC'));
      if(sql.includes('= 1'))return {rows:[{
        room_name:'Solo Escape',elapsed_seconds:120.5,
        players:[{slot:1,nickname:'Soloist',role:'rewinder',hearts:1}],
        floors_cleared:27,achievements:[{id:'solo',title:'Lone Survivor'}],
        completed_at:'2026-11-09T12:01:00Z'
      }]};
      assert(sql.includes('BETWEEN 2 AND 5'));
      return {rows:[{
        room_name:'The Ward',elapsed_seconds:180.5,players:result.players,
        floors_cleared:27,achievements:result.achievements,
        completed_at:'2026-11-09T12:00:00Z'
      }]};
    }
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
const solo=await store.leaderboard('solo');
assert.equal(solo.category,'solo');
assert.equal(solo.entries[0].seconds,120.5);
assert.equal(solo.entries[0].players[0].role,'rewinder');
assert.equal(solo.entries[0].achievements[0].id,'solo');
const team=await store.leaderboard('team');
assert.equal(team.category,'team');
assert.equal(team.entries[0].seconds,180.5);
assert.equal(team.entries[0].players.length,2);
assert.equal(team.entries[0].achievements[3].id,'team');
assert.equal((await store.leaderboard('invalid')).available,false);
assert.equal(await store.save(result),true);
assert.equal(queries.length,9,'Repeated save does not recreate schema');
await store.close();
assert.equal(ended,true);
const disabled=makeMatchStore({databaseUrl:''});
assert.equal(disabled.enabled,false);
assert.equal(await disabled.save(result),false);
assert.equal((await disabled.leaderboard()).available,false);
assert.equal((await disabled.leaderboard('team')).available,false);
console.log('PASS: solo/team leaderboards, original roster integrity, role and achievement details, and ranked-run exclusion.');
