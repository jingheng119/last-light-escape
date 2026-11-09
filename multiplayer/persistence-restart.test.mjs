import assert from 'node:assert/strict';
import {makeMatchStore,buildMatchResult} from './match-store.js';
import {makeProfileStore,profileHash} from './profile-store.js';

// Two separate store lifecycles share the fake database's persistent rows.
// This verifies our reinitialization, duplicate-event protection and read
// paths without relying on credentials or writing test data to production.
const matches=new Map(),profiles=new Map(),events=new Set();
let opened=0,closed=0;
class PersistentPool {
  constructor(){opened++;}
  async end(){closed++;}
  async query(sql,args=[]){
    if(sql.includes('INSERT INTO last_light_matches')){
      if(matches.has(args[0]))return {rowCount:0};
      matches.set(args[0],{
        match_id:args[0],room_name:args[1],outcome:args[2],
        floors_cleared:args[3],elapsed_seconds:args[4],
        players:JSON.parse(args[5]),competitive:args[6],
        achievements:JSON.parse(args[7]),
        completed_at:'2026-11-09T10:00:00Z'
      });
      return {rowCount:1};
    }
    if(sql.includes('SELECT room_name,elapsed_seconds,players')){
      const solo=sql.includes('jsonb_array_length(players) = 1');
      const rows=[...matches.values()].filter(m=>
        m.competitive&&m.outcome==='victory'&&m.floors_cleared===27&&
        (solo?m.players.length===1:m.players.length>=2&&m.players.length<=5))
        .sort((a,b)=>a.elapsed_seconds-b.elapsed_seconds).slice(0,20);
      return {rows};
    }
    if(sql.includes('INSERT INTO last_light_profiles(profile_hash)')){
      if(!profiles.has(args[0]))
        profiles.set(args[0],{attempts:0,best_floors:0,best_time:null,badges:[],legacy_progress:null});
      return {rowCount:1};
    }
    if(sql.includes('WITH event AS (')){
      const [hash,eventId,increment,floors,time,badges]=args;
      if(!events.has(eventId)){
        events.add(eventId);
        const record=profiles.get(hash);
        record.attempts+=increment;
        record.best_floors=Math.max(record.best_floors,floors);
        if(time!==null)record.best_time=record.best_time===null?time:Math.min(record.best_time,time);
        record.badges=[...new Set([...record.badges,...JSON.parse(badges)])];
      }
      return {rowCount:1};
    }
    if(sql.includes('SELECT attempts,best_floors,best_time,badges')){
      const row=profiles.get(args[0]);
      return {rows:row?[{...row}]:[]};
    }
    return {rowCount:1};
  }
}
const options={databaseUrl:'postgres://simulated/restart',
  loadDriver:async()=>({Pool:PersistentPool})};
const key='ef'.repeat(32);
const firstMatches=makeMatchStore(options),firstProfiles=makeProfileStore(options);
const solo={
  matchId:'persist-solo',roomName:'Ward Solo',outcome:'victory',
  floorsCleared:27,elapsedSeconds:420,competitive:true,
  players:[{slot:1,nickname:'Pilot',role:'symbiote',hearts:2}],
  achievements:[{id:'solo',title:'Lone Survivor'}]
};
const skipped={...solo,matchId:'persist-skip',elapsedSeconds:1,competitive:false,achievements:[]};
assert.equal(await firstMatches.save(solo),true);
assert.equal(await firstMatches.save(skipped),true);
assert.equal(await firstProfiles.award(key,{
  eventId:'persist-solo:1:final',floorsCleared:27,finished:true,winTime:420,
  achievements:[{id:'solo'},{id:'signal'}]
}),true);
// Simulate authoritative terminal snapshots for a legitimate five-player
// Stage 3 victory and an unranked developer-skipped victory. The server's
// own result builder (not a hand-crafted competitive score) determines
// ranking eligibility and achievements.
const teamRoster=new Map(Array.from({length:5},(_,i)=>[i+1,{name:'Beta '+(i+1)}]));
const teamRoom={
  matchId:'persist-five-player',name:'Copper Survivors',unranked:false,
  members:teamRoster,matchParticipants:new Map(teamRoster),
  engine:{snapshot:()=>({
    state:'victory',levelIndex:26,overallElapsed:601.25,
    playerRoles:['scout','medic','anchor','rewinder','symbiote'],
    players:[{hp:3},{hp:1},{hp:2},{hp:3},{hp:1}]
  })}
};
const winningTeam=buildMatchResult(teamRoom);
assert.equal(winningTeam.competitive,true);
assert.equal(winningTeam.players.length,5);
assert.deepEqual(winningTeam.achievements.map(a=>a.id),
  ['ward','engine','signal','team','alive']);
assert.equal(await firstMatches.save(winningTeam),true);
const secondKey='aa'.repeat(32);
assert.equal(await firstProfiles.award(secondKey,{
  eventId:'persist-five-player:5:final',floorsCleared:27,finished:true,
  winTime:winningTeam.elapsedSeconds,achievements:winningTeam.achievements
}),true);
teamRoom.unranked=true;
teamRoom.matchId='persist-five-player-skipped';
const skippedTeam=buildMatchResult(teamRoom);
assert.equal(skippedTeam.competitive,false);
assert.deepEqual(skippedTeam.achievements,[]);
assert.equal(await firstMatches.save(skippedTeam),false,'Developer runs must not be stored');
await firstMatches.close();await firstProfiles.close();

// Simulated restart: brand-new store objects / connection pools.
const secondMatches=makeMatchStore(options),secondProfiles=makeProfileStore(options);
const leaderboard=await secondMatches.leaderboard('solo');
assert.equal(leaderboard.available,true);
assert.equal(leaderboard.entries.length,1,'Unranked run must not appear after restart');
assert.equal(leaderboard.entries[0].roomName,'Ward Solo');
assert.equal(leaderboard.entries[0].seconds,420);
assert.equal(leaderboard.entries[0].players[0].role,'symbiote');
const teamRanking=await secondMatches.leaderboard('team');
assert.equal(teamRanking.available,true);
assert.equal(teamRanking.entries.length,1,
  'Only the legitimate five-player victory should appear on the team board');
assert.equal(teamRanking.entries[0].players.length,5);
assert.deepEqual(teamRanking.entries[0].players.map(p=>p.role),
  ['scout','medic','anchor','rewinder','symbiote']);
assert.deepEqual(teamRanking.entries[0].achievements.map(a=>a.id),
  ['ward','engine','signal','team','alive']);
assert.equal(teamRanking.entries[0].seconds,601.25);
const teamProgress=await secondProfiles.read(secondKey);
assert.equal(teamProgress.progress.runs,1);
assert.equal(teamProgress.progress.bestFloors,27);
assert.equal(teamProgress.progress.bestTime,601.25);
assert.deepEqual(new Set(teamProgress.progress.badges),
  new Set(['ward','engine','signal','team','alive']));
const restored=await secondProfiles.read(key);
assert.equal(restored.available,true);
assert.equal(restored.progress.runs,1,'Run count must persist');
assert.equal(restored.progress.bestFloors,27);
assert.equal(restored.progress.bestTime,420);
assert.deepEqual(new Set(restored.progress.badges),new Set(['solo','signal']));
assert.equal(profiles.has(profileHash(key)),true,'Only hashed profile keys belong in storage');

// Retrying the same event and match must not create duplicate records.
assert.equal(await secondMatches.save(solo),true);
assert.equal(await secondProfiles.award(key,{
  eventId:'persist-solo:1:final',floorsCleared:27,finished:true,winTime:420
}),true);
assert.equal(matches.size,3,'Only genuine results should persist');
assert.equal((await secondProfiles.read(key)).progress.runs,1);
await secondMatches.close();await secondProfiles.close();
assert.equal(opened,closed,'All database pools must close cleanly');
console.log('PASS: solo and five-player competitive victories, role/achievement persistence, restart recovery, and duplicate-event exclusion.');
