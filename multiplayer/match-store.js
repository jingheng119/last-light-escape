// Optional PostgreSQL-backed public trial records. No account is required.
// Rankings are team runs, not verified identities. Developer skips are unranked.
export const MATCH_OUTCOMES=new Set(['victory','dead','incomplete']);
const VALID_ROLES=new Set(['scout','medic','invisibler','teleporter','illusioner','rewinder','anchor','symbiote']);
const ROLE_ACHIEVEMENTS={scout:'role_scout',medic:'role_medic',invisibler:'role_invisibler',teleporter:'role_teleporter',illusioner:'role_illusioner',rewinder:'role_rewinder',anchor:'role_anchor',symbiote:'role_symbiote'};
const ROLE_ACHIEVEMENT_TITLES={scout:'First Responder',medic:'Lifeline',invisibler:'Unseen Survivor',teleporter:'Beyond the Walls',illusioner:'Master of Deception',rewinder:'Timekeeper',anchor:'Unbreakable',symbiote:'One With the Team'};
export function achievementsForResult(result){
  if(!result?.competitive)return [];
  const badges=[];
  if(result.floorsCleared>=9)badges.push({id:'ward',title:'Ward Escape',description:'Clear Stage 1'});
  if(result.floorsCleared>=18)badges.push({id:'engine',title:'Copper Survivor',description:'Clear Stage 2'});
  if(result.outcome==='victory'&&result.floorsCleared===27)
    badges.push({id:'signal',title:'Last Light',description:'Complete the full game'});
  if(result.outcome==='victory'&&result.players.length===1)
    badges.push({id:'solo',title:'Lone Survivor',description:'Complete the game alone'});
  if(result.outcome==='victory'&&result.players.length>=2)
    badges.push({id:'team',title:'Together Through Darkness',description:'Complete the game as a team'});
  if(result.outcome==='victory'&&result.players.every(p=>p.hearts>0))
    badges.push({id:'alive',title:'Everyone Made It',description:'Finish with every teammate alive'});
  if(result.outcome==='victory'&&result.floorsCleared===27){
    for(const role of new Set(result.players.map(p=>p.role).filter(role=>VALID_ROLES.has(role))))
      badges.push({id:ROLE_ACHIEVEMENTS[role],title:ROLE_ACHIEVEMENT_TITLES[role],description:'Complete the full game as '+role});
  }
  return badges;
}
export function buildFloorProgress(room){
  const snapshot=room.engine.snapshot(false);
  if(snapshot.state!=='leveldone')return null;
  const floorsCleared=snapshot.levelIndex+1;
  if(!Number.isInteger(floorsCleared)||floorsCleared<1||floorsCleared>=27)return null;
  const eligible=!room.unranked;
  const achievements=eligible&&floorsCleared===9?
    [{id:'ward',title:'Ward Escape',description:'Clear Stage 1'}]:
    eligible&&floorsCleared===18?
    [{id:'engine',title:'Copper Survivor',description:'Clear Stage 2'}]:[];
  return {type:'floor-progress',floorsCleared,eligible,achievements};
}
export function buildMatchResult(room,{incomplete=false}={}){
  const snapshot=room.engine.snapshot(false);
  if(!MATCH_OUTCOMES.has(snapshot.state)&&(!incomplete||!room.started))return null;
  const isIncomplete=incomplete&&!MATCH_OUTCOMES.has(snapshot.state);
  // Preserve the original party size even if a teammate disconnects later.
  const players=[...(room.matchParticipants||room.members).entries()].map(([slot,member])=>{
    const role=snapshot.playerRoles?.[slot-1];
    return {
      slot,nickname:String(member.name||'Survivor '+slot).slice(0,20),
      role:VALID_ROLES.has(role)?role:'scout',
      hearts:Math.max(0,Math.min(3,Number(snapshot.players?.[slot-1]?.hp)||0))
    };
  }).sort((a,b)=>a.slot-b.slot);
  const result={
    matchId:room.matchId,
    roomName:String(room.name||'Hollow Ward').slice(0,32),
    outcome:isIncomplete?'incomplete':snapshot.state,
    floorsCleared:Math.max(0,Math.min(26,Number(snapshot.levelIndex)||0))+
      (snapshot.state==='victory'?1:0),
    elapsedSeconds:Math.max(0,Number(snapshot.overallElapsed)||0),
    competitive:!room.unranked&&snapshot.state==='victory'&&snapshot.levelIndex===26,
    isDeveloperRun:Boolean(room.unranked),
    players
  };
  // Progress badges are recorded even on incomplete legitimate runs.
  result.achievements=achievementsForResult({...result,
    competitive:!room.unranked});
  return result;
}
export function makeMatchStore({databaseUrl=process.env.DATABASE_URL,loadDriver=()=>import('pg'),log=console}={}){
  let pool=null,enabled=Boolean(databaseUrl),setupPromise=null;
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
          outcome VARCHAR(12) NOT NULL CHECK (outcome IN ('victory','dead','incomplete')),
          floors_cleared SMALLINT NOT NULL CHECK (floors_cleared BETWEEN 0 AND 27),
          elapsed_seconds DOUBLE PRECISION NOT NULL CHECK (elapsed_seconds >= 0),
          players JSONB NOT NULL,
          completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        // Upgrade installations created when the game had only 18 floors.
        await created.query(`ALTER TABLE last_light_matches
          DROP CONSTRAINT IF EXISTS last_light_matches_outcome_check`);
        await created.query(`ALTER TABLE last_light_matches ADD CONSTRAINT
          last_light_matches_outcome_check
          CHECK (outcome IN ('victory','dead','incomplete'))`);
        await created.query(`ALTER TABLE last_light_matches
          DROP CONSTRAINT IF EXISTS last_light_matches_floors_cleared_check`);
        await created.query(`ALTER TABLE last_light_matches ADD CONSTRAINT
          last_light_matches_floors_cleared_check
          CHECK (floors_cleared BETWEEN 0 AND 27)`);
        await created.query(`ALTER TABLE last_light_matches
          ADD COLUMN IF NOT EXISTS competitive BOOLEAN NOT NULL DEFAULT FALSE`);
        await created.query(`ALTER TABLE last_light_matches
          ADD COLUMN IF NOT EXISTS achievements JSONB NOT NULL DEFAULT '[]'::jsonb`);
        // Past records cannot be classified retroactively from competitive alone.
        await created.query(`ALTER TABLE last_light_matches
          ADD COLUMN IF NOT EXISTS is_developer_run BOOLEAN NOT NULL DEFAULT FALSE`);
        await created.query(`ALTER TABLE last_light_matches
          ADD COLUMN IF NOT EXISTS profile_hashes JSONB NOT NULL DEFAULT '[]'::jsonb`);
        pool=created;
        return pool;
      }catch(error){await created.end();throw error;}
    })();
    try{return await setupPromise;}
    catch(error){setupPromise=null;throw error;}
  };
  return {
    get enabled(){return enabled;},
    async save(result){
      if(!enabled||!result||result.isDeveloperRun===true)return false;
      try{
        const db=await ensure();
        await db.query(
          `INSERT INTO last_light_matches
           (match_id,room_name,outcome,floors_cleared,elapsed_seconds,players,competitive,achievements,is_developer_run,profile_hashes)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10::jsonb)
           ON CONFLICT (match_id) DO NOTHING`,
          [result.matchId,result.roomName,result.outcome,result.floorsCleared,
            result.elapsedSeconds,JSON.stringify(result.players),result.competitive,
            JSON.stringify(result.achievements||[]),result.isDeveloperRun===true,
            JSON.stringify(result.profileHashes||[])]
        );
        return true;
      }catch(error){
        log.error('Match database save failed:',error?.message||error);
        return false;
      }
    },
    async history(profileHash){
      const empty={available:false,entries:[]};
      if(!enabled||typeof profileHash!=='string'||!/^[a-f0-9]{64}$/.test(profileHash))return empty;
      try{
        const db=await ensure();
        const {rows}=await db.query(`
          SELECT m.room_name,m.outcome,m.floors_cleared,m.elapsed_seconds,
            m.completed_at,jsonb_array_length(m.players) AS party_size,
            COALESCE((
              SELECT p.player FROM jsonb_array_elements(m.players) AS p(player)
              WHERE (p.player->>'slot')::int=(
                SELECT (entry.item->>'slot')::int
                FROM jsonb_array_elements(m.profile_hashes) AS entry(item)
                WHERE entry.item->>'hash'=$1 LIMIT 1
              ) LIMIT 1
            ),'{}'::jsonb) AS survivor
          FROM last_light_matches AS m
          WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(m.profile_hashes) AS entry(item)
            WHERE entry.item->>'hash'=$1
          )
          ORDER BY m.completed_at DESC LIMIT 20
        `,[profileHash]);
        return {available:true,entries:rows.map(row=>({
          roomName:row.room_name,outcome:row.outcome,
          floorsCleared:Number(row.floors_cleared)||0,
          elapsedSeconds:Number(row.elapsed_seconds)||0,
          completedAt:row.completed_at,
          partySize:Number(row.party_size)||1,
          role:row.survivor?.role||'scout',
          nickname:row.survivor?.nickname||'Survivor'
        }))};
      }catch(error){
        log.error('Match history query failed:',error?.message||error);
        return empty;
      }
    },
    async analytics(){
      const empty={available:false,totalMatches:0,totalSelections:0,
        averageDurationSeconds:0,roles:[],roleWinRates:[],stages:[]};
      if(!enabled)return empty;
      try{
        const db=await ensure();
        const {rows}=await db.query(`
          WITH recorded AS (
            SELECT * FROM last_light_matches WHERE is_developer_run=FALSE
          ),
          player_rows AS (
            SELECT lower(player->>'role') AS role,m.outcome
            FROM recorded AS m
            CROSS JOIN LATERAL jsonb_array_elements(
              CASE WHEN jsonb_typeof(m.players)='array' THEN m.players ELSE '[]'::jsonb END
            ) AS player_entry(player)
          ),
          role_stats AS (
            SELECT role,COUNT(*)::int AS selections,
              COUNT(*) FILTER (WHERE outcome='victory')::int AS wins
            FROM player_rows GROUP BY role
          ),
          role_list(role) AS (
            VALUES ('scout'),('medic'),('invisibler'),('teleporter'),
                   ('illusioner'),('rewinder'),('anchor'),('symbiote')
          ),
          stage_list(stage,name,min_floors) AS (
            VALUES (1,'Hollow Ward',0),(2,'The Copper Engine',9),(3,'The Lost Signal',18)
          )
          SELECT
            (SELECT COUNT(*)::int FROM recorded) AS total_matches,
            (SELECT COUNT(*)::int FROM player_rows) AS total_selections,
            COALESCE((SELECT AVG(elapsed_seconds) FROM recorded),0) AS average_duration_seconds,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'role',role_list.role,'selections',COALESCE(role_stats.selections,0)
              ) ORDER BY COALESCE(role_stats.selections,0) DESC,role_list.role)
              FROM role_list LEFT JOIN role_stats USING(role)
            ),'[]'::jsonb) AS roles,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'role',role_list.role,
                'matches',COALESCE(role_stats.selections,0),
                'wins',COALESCE(role_stats.wins,0),
                'winRate',CASE WHEN COALESCE(role_stats.selections,0)=0 THEN 0
                  ELSE ROUND(role_stats.wins::numeric*100/role_stats.selections,1) END
              ) ORDER BY
                CASE WHEN COALESCE(role_stats.selections,0)=0 THEN -1
                  ELSE role_stats.wins::numeric/role_stats.selections END DESC,
                role_list.role)
              FROM role_list LEFT JOIN role_stats USING(role)
            ),'[]'::jsonb) AS role_win_rates,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'stage',stage_list.stage,'name',stage_list.name,'matches',stage_counts.matches
              ) ORDER BY stage_list.stage)
              FROM stage_list
              CROSS JOIN LATERAL (
                SELECT COUNT(*)::int AS matches FROM recorded
                WHERE floors_cleared>=stage_list.min_floors
              ) AS stage_counts
            ),'[]'::jsonb) AS stages
        `);
        const row=rows[0]||{};
        return {available:true,totalMatches:Number(row.total_matches)||0,
          totalSelections:Number(row.total_selections)||0,
          averageDurationSeconds:Number(row.average_duration_seconds)||0,
          roles:row.roles||[],roleWinRates:row.role_win_rates||[],stages:row.stages||[]};
      }catch(error){
        log.error('Analytics query failed:',error?.message||error);
        return empty;
      }
    },
    async leaderboard(category='solo'){
      // Always filter by the party that STARTED the run. This is enforced
      // against the stored original roster; clients cannot supply scores.
      if(!['solo','team'].includes(category))return {available:false,entries:[]};
      if(!enabled)return {available:false,entries:[]};
      try{
        const db=await ensure();
        const condition=category==='solo'?'= 1':'BETWEEN 2 AND 5';
        const {rows}=await db.query(`SELECT room_name,elapsed_seconds,players,
             floors_cleared,achievements,completed_at
          FROM last_light_matches
          WHERE competitive=TRUE AND is_developer_run=FALSE
            AND outcome='victory' AND floors_cleared=27
            AND jsonb_typeof(players)='array'
            AND jsonb_array_length(players) ${condition}
          ORDER BY elapsed_seconds ASC,completed_at ASC LIMIT 20`);
        return {available:true,category,entries:rows.map((row,i)=>({
          rank:i+1,roomName:row.room_name,seconds:Number(row.elapsed_seconds),
          players:row.players,achievements:row.achievements,completedAt:row.completed_at
        }))};
      }catch(error){
        log.error('Leaderboard query failed:',error?.message||error);
        return {available:false,category,entries:[]};
      }
    },
    async close(){if(pool)await pool.end();}
  };
}
