// Accountless, device-key based survivor profiles.
// A 32-byte secret is generated in the browser; only its SHA-256 hash is
// stored in PostgreSQL. Whoever knows the secret can restore the profile.
import {createHash} from 'node:crypto';

export const validProfileKey=key=>typeof key==='string'&&/^[a-f0-9]{64}$/.test(key);
export const profileHash=key=>validProfileKey(key)?
  createHash('sha256').update(key,'utf8').digest('hex'):null;
const allowedBadges=new Set(['ward','engine','signal','solo','team','alive']);
const normalizeBadges=value=>[...new Set((Array.isArray(value)?value:[])
  .map(b=>typeof b==='string'?b:b?.id).filter(id=>allowedBadges.has(id)))];
export function makeProfileStore({databaseUrl=process.env.DATABASE_URL,loadDriver=()=>import('pg'),log=console}={}){
  let pool,setupPromise;
  async function db(){
    if(!databaseUrl)return null;
    if(!setupPromise)setupPromise=(async()=>{
      const {Pool}=await loadDriver();
      const instance=new Pool({connectionString:databaseUrl,max:3,
        connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
      try{
        await instance.query(`CREATE TABLE IF NOT EXISTS last_light_profiles (
          profile_hash CHAR(64) PRIMARY KEY,
          attempts INTEGER NOT NULL DEFAULT 0,
          best_floors SMALLINT NOT NULL DEFAULT 0,
          best_time DOUBLE PRECISION,
          badges JSONB NOT NULL DEFAULT '[]'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        await instance.query(`CREATE TABLE IF NOT EXISTS last_light_profile_events (
          event_id TEXT PRIMARY KEY,
          profile_hash CHAR(64) NOT NULL REFERENCES last_light_profiles(profile_hash),
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        pool=instance;return instance;
      }catch(error){await instance.end();throw error;}
    })();
    try{return await setupPromise;}catch(e){setupPromise=null;throw e;}
  }
  const unavailable={available:false,progress:null};
  return {
    get enabled(){return Boolean(databaseUrl);},
    async read(key){
      const hash=profileHash(key);
      if(!hash||!databaseUrl)return unavailable;
      try{
        const conn=await db();
        await conn.query(`INSERT INTO last_light_profiles(profile_hash)
          VALUES($1) ON CONFLICT DO NOTHING`,[hash]);
        const {rows}=await conn.query(`SELECT attempts,best_floors,best_time,badges
          FROM last_light_profiles WHERE profile_hash=$1`,[hash]);
        const p=rows[0];
        return {available:true,progress:{
          runs:Number(p.attempts),bestFloors:Number(p.best_floors),
          bestTime:p.best_time===null?null:Number(p.best_time),
          badges:normalizeBadges(p.badges)
        }};
      }catch(error){log.error('Profile read failed:',error?.message||error);return unavailable;}
    },
    async award(key,{eventId,floorsCleared,achievements=[],finished=false,winTime=null}={}){
      const hash=profileHash(key);
      if(!hash||typeof eventId!=='string'||eventId.length>120||!eventId||!databaseUrl)
        return false;
      const floors=Math.max(0,Math.min(27,Math.trunc(Number(floorsCleared)||0)));
      const badges=normalizeBadges(achievements);
      const time=Number(winTime);
      const bestTime=winTime!==null&&Number.isFinite(time)&&time>0?time:null;
      try{
        const conn=await db();
        await conn.query(`INSERT INTO last_light_profiles(profile_hash)
          VALUES($1) ON CONFLICT DO NOTHING`,[hash]);
        // The event ledger ensures reconnects and retries never double-count.
        // The CTE updates only when a new event was inserted.
        await conn.query(`WITH event AS (
          INSERT INTO last_light_profile_events(event_id,profile_hash)
          VALUES($2,$1) ON CONFLICT DO NOTHING RETURNING event_id
        )
        UPDATE last_light_profiles SET
          attempts=attempts+$3,
          best_floors=GREATEST(best_floors,$4),
          best_time=CASE WHEN $5::double precision IS NULL THEN best_time
            WHEN best_time IS NULL THEN $5
            ELSE LEAST(best_time,$5) END,
          badges=(SELECT COALESCE(jsonb_agg(DISTINCT item),'[]'::jsonb)
            FROM (SELECT jsonb_array_elements_text(badges) AS item
                  UNION SELECT jsonb_array_elements_text($6::jsonb) AS item) combined),
          updated_at=NOW()
        WHERE profile_hash=$1 AND EXISTS (SELECT 1 FROM event)`,
        [hash,eventId,finished?1:0,floors,bestTime,JSON.stringify(badges)]);
        return true;
      }catch(error){log.error('Profile save failed:',error?.message||error);return false;}
    },
    async close(){if(pool)await pool.end();}
  };
}
