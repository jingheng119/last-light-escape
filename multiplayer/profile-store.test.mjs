import assert from 'node:assert/strict';
import {makeProfileStore,validProfileKey,profileHash} from './profile-store.js';

const key='ab'.repeat(32),other='cd'.repeat(32);
assert(validProfileKey(key));
assert(!validProfileKey('short'));
assert.equal(profileHash(key).length,64);
assert.notEqual(profileHash(key),profileHash(other));
const queries=[];
let closed=false;
const fakePool=class{
  constructor(config){assert.equal(config.connectionString,'postgres://test:pass@localhost/test');}
  async query(sql,params=[]){
    queries.push({sql,params});
    if(sql.includes('SELECT attempts,best_floors,best_time,badges'))
      return {rows:[{attempts:3,best_floors:18,best_time:580,badges:['ward','engine']}]};
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
assert.equal(queries.length,4);
assert(queries[0].sql.includes('CREATE TABLE IF NOT EXISTS last_light_profiles'));
assert(queries[1].sql.includes('CREATE TABLE IF NOT EXISTS last_light_profile_events'));
assert(queries[2].params[0]===profileHash(key));
assert.equal(await store.award(key,{eventId:'match-1:1:floor:9',floorsCleared:9,
  achievements:[{id:'ward'},{id:'unknown'}]}),true);
assert(queries.at(-1).sql.includes('ON CONFLICT DO NOTHING RETURNING event_id'));
assert.deepEqual(JSON.parse(queries.at(-1).params[5]),['ward']);
assert.equal(queries.at(-1).params[2],0);
assert.equal(await store.award(key,{eventId:'match-1:1:final',floorsCleared:27,
  finished:true,winTime:384,achievements:[{id:'signal'}]}),true);
assert.equal(queries.at(-1).params[2],1);
assert.equal(queries.at(-1).params[4],384);
assert.equal(await store.award('invalid',{eventId:'x'}),false);
await store.close();
assert(closed);
const offline=makeProfileStore({databaseUrl:''});
assert.equal((await offline.read(key)).available,false);
assert.equal(await offline.award(key,{eventId:'x'}),false);
console.log('PASS: recovery key validation, hashed storage, profile sync, safe awards, and event idempotence.');
