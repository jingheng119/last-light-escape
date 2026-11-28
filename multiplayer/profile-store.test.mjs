import assert from 'node:assert/strict';
import {makeProfileStore,validProfileKey,profileHash,normalizeLegacyProgress} from './profile-store.js';

const key='ab'.repeat(32),other='cd'.repeat(32);
assert(validProfileKey(key));
assert(!validProfileKey('short'));
assert.equal(profileHash(key).length,64);
assert.notEqual(profileHash(key),profileHash(other));
const queries=[];
let storedLegacy=null;
let closed=false;
const fakePool=class{
  constructor(config){assert.equal(config.connectionString,'postgres://test:pass@localhost/test');}
  async query(sql,params=[]){
    queries.push({sql,params});
    if(sql.includes('SET legacy_progress=')&&storedLegacy===null){storedLegacy=JSON.parse(params[1]);return {rowCount:1};}
    if(sql.includes('SET legacy_progress='))return {rowCount:0};
    if(sql.includes('SELECT attempts,best_floors,best_time,badges'))
      return {rows:[{attempts:3,best_floors:18,best_time:580,badges:['ward','engine'],legacy_progress:storedLegacy}]};
    return {rows:[],rowCount:1};
  }
  async end(){closed=true;}
};
const store=makeProfileStore({databaseUrl:'postgres://test:pass@localhost/test',
  loadDriver:async()=>({Pool:fakePool})});
const read=await store.read(key);
assert.equal(read.available,true);
assert.deepEqual(read.progress,{runs:3,bestFloors:18,bestTime:580,
  badges:['ward','engine']});
assert.equal(queries.length,5);
assert(queries[0].sql.includes('CREATE TABLE IF NOT EXISTS last_light_profiles'));
assert(queries[1].sql.includes('CREATE TABLE IF NOT EXISTS last_light_profile_events'));
assert(queries[3].params[0]===profileHash(key));
assert.equal(normalizeLegacyProgress({runs:2,bestFloors:5,bestTime:null,badges:[]}).bestFloors,5);
assert.equal(normalizeLegacyProgress({runs:2,bestFloors:50,bestTime:null,badges:[]}),null);
assert.equal(normalizeLegacyProgress({runs:-1,bestFloors:2,bestTime:null,badges:[]}),null);
assert.equal(await store.importLegacy(key,{runs:2,bestFloors:5,bestTime:null,badges:['ward']}),true);
assert.equal(await store.importLegacy(key,{runs:999,bestFloors:27,bestTime:1,badges:['signal']}),false,
  'Legacy import must not overwrite an existing historical record');
assert.deepEqual((await store.read(key)).legacyProgress,
  {runs:2,bestFloors:5,bestTime:null,badges:['ward']});
assert.equal(await store.award(key,{eventId:'match-1:1:floor:3',floorsCleared:3,
  achievements:[{id:'ward'},{id:'unknown'}]}),true);
assert(queries.at(-1).sql.includes('ON CONFLICT DO NOTHING RETURNING event_id'));
assert(!queries.at(-1).sql.includes('legacy_progress'), 'Verified event ledger is independent of browser import');
assert.deepEqual(JSON.parse(queries.at(-1).params[5]),['ward']);
assert.equal(queries.at(-1).params[2],0);
assert.equal(await store.award(key,{eventId:'match-1:1:final',floorsCleared:12,
  finished:true,winTime:384,achievements:[{id:'signal'}]}),true);
assert.equal(queries.at(-1).params[2],1);
assert.equal(queries.at(-1).params[4],384);
assert.equal(await store.award('invalid',{eventId:'x'}),false);
await store.close();
assert(closed);
const offline=makeProfileStore({databaseUrl:''});
assert.equal((await offline.read(key)).available,false);
assert.equal(await offline.award(key,{eventId:'x'}),false);
console.log('PASS: profile recovery, one-time legacy browser-history migration, and verified awards isolation.');
