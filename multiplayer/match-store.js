// Optional persistent match results. Real-time rooms remain in memory.
// DATABASE_URL must be configured privately on the server (never in game.js).
export const MATCH_OUTCOMES=new Set(['victory','dead']);
export function buildMatchResult(room){
  const snapshot=room.engine.snapshot(false);
  if(!MATCH_OUTCOMES.has(snapshot.state))return null;
  const players=[...room.members.entries()].map(([slot,member])=>({
    slot,
    nickname:String(member.name||'Survivor '+slot).slice(0,20),
    role:snapshot.playerRoles?.[slot-1]==='medic'?'medic':'scout',
    hearts:Math.max(0,Math.min(3,Number(snapshot.players?.[slot-1]?.hp)||0))
  })).sort((a,b)=>a.slot-b.slot);
  return {
    matchId:room.matchId,
    roomName:String(room.name||'Hollow Ward').slice(0,32),
    outcome:snapshot.state,
    floorsCleared:Math.max(0,Math.min(18,Number(snapshot.levelIndex)||0))+
      (snapshot.state==='victory'?1:0),
    elapsedSeconds:Math.max(0,Number(snapshot.overallElapsed)||0),
    players
  };
}
export function makeMatchStore({databaseUrl=process.env.DATABASE_URL,loadDriver=()=>import('pg'),log=console}={}){
  let pool=null,enabled=Boolean(databaseUrl);
  let setupPromise=null;
  const ensure=async()=>{
    if(!enabled)return null;
    if(!setupPromise)setupPromise=(async()=>{
      const {Pool}=await loadDriver();
      const created=new Pool({connectionString:databaseUrl,max:3,
        connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
      try{
        await created.query(`CREATE TABLE IF NOT EXISTS last_light_matches (
          match_id TEXT PRIMARY KEY,
          room_name VARCHAR(32) NOT NULL,
          outcome VARCHAR(12) NOT NULL CHECK (outcome IN ('victory','dead')),
          floors_cleared SMALLINT NOT NULL CHECK (floors_cleared BETWEEN 0 AND 18),
          elapsed_seconds DOUBLE PRECISION NOT NULL CHECK (elapsed_seconds >= 0),
          players JSONB NOT NULL,
          completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        pool=created;
        return pool;
      }catch(error){
        await created.end();
        throw error;
      }
    })();
    try{return await setupPromise;}
    catch(error){
      setupPromise=null;
      throw error;
    }
  };
  return {
    get enabled(){return enabled;},
    async save(result){
      if(!enabled||!result)return false;
      try{
        const db=await ensure();
        await db.query(
          `INSERT INTO last_light_matches
           (match_id,room_name,outcome,floors_cleared,elapsed_seconds,players)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb)
           ON CONFLICT (match_id) DO NOTHING`,
          [result.matchId,result.roomName,result.outcome,
            result.floorsCleared,result.elapsedSeconds,JSON.stringify(result.players)]
        );
        return true;
      }catch(error){
        log.error('Match database save failed:',error?.message||error);
        return false;
      }
    },
    async close(){if(pool)await pool.end();}
  };
}
