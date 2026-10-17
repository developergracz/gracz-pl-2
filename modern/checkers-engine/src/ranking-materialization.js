export const RANKING_SCHEMA_LOCK=1_000_005_005;
export const RANKING_BACKFILL_LOCK=1_000_005_006;
export const RANKING_MATERIALIZER_LOCK=1_000_005_007;
export const RANKING_CAPTURE_LOCK=1_000_005_008;
export const RANKING_BASELINE_VERSION=1;
export const MAX_RANKING_PERIOD_EVENTS=50_000;
export const MAX_RANKING_CATCHUP_EVENTS=2_000;

const VALID_GAME_TYPES=new Set(['checkers','thousand']);
const SCOPES=new Set(['all','checkers','thousand']);
const BASELINE_READ_BATCH=1_000;
const BASELINE_WRITE_BATCH=500;

export async function ensureRankingSchema(client){
  await client.query(`
    CREATE TABLE IF NOT EXISTS gracz_ranking_events(
      event_id BIGSERIAL PRIMARY KEY,
      game_type TEXT NOT NULL CHECK(game_type IN ('checkers','thousand')),
      game_id VARCHAR(128) NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(game_type,game_id)
    );
    CREATE INDEX IF NOT EXISTS gracz_ranking_events_time_idx ON gracz_ranking_events(completed_at,event_id);
    CREATE INDEX IF NOT EXISTS gracz_ranking_events_game_time_idx ON gracz_ranking_events(game_type,completed_at,event_id);

    CREATE TABLE IF NOT EXISTS gracz_ranking_materialized(
      scope TEXT NOT NULL CHECK(scope IN ('all','checkers','thousand')),
      user_id TEXT NOT NULL,
      games INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_played TIMESTAMPTZ NULL,
      rating INTEGER NOT NULL DEFAULT 1200,
      peak_rating INTEGER NOT NULL DEFAULT 1200,
      checkers_games INTEGER NOT NULL DEFAULT 0,
      thousand_games INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(scope,user_id)
    );
    CREATE INDEX IF NOT EXISTS gracz_ranking_materialized_order_idx ON gracz_ranking_materialized(scope,rating DESC,wins DESC,losses ASC,user_id);

    CREATE TABLE IF NOT EXISTS gracz_ranking_totals(
      scope TEXT PRIMARY KEY CHECK(scope IN ('all','checkers','thousand')),
      games BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gracz_ranking_state(
      state_id SMALLINT PRIMARY KEY CHECK(state_id=1),
      legacy_backfill_complete BOOLEAN NOT NULL DEFAULT FALSE,
      legacy_backfill_version INTEGER NOT NULL DEFAULT 0,
      last_event_id BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE gracz_ranking_state ADD COLUMN IF NOT EXISTS last_event_id BIGINT NOT NULL DEFAULT 0;
    ALTER TABLE gracz_ranking_state ADD COLUMN IF NOT EXISTS legacy_backfill_version INTEGER NOT NULL DEFAULT 0;
    INSERT INTO gracz_ranking_state(state_id) VALUES(1) ON CONFLICT(state_id) DO NOTHING;
  `);
}

export async function initializeRankingSchema(pool){
  if(!pool||typeof pool.connect!=='function') throw new TypeError('Pula PostgreSQL jest wymagana dla materializacji rankingu.');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)',[RANKING_SCHEMA_LOCK]);
    await ensureRankingSchema(client);
    await installCheckersRankingTrigger(client);
    await installThousandRankingTrigger(client,{ifTableExists:true});
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
  finally{client.release()}
}

export async function installCheckersRankingTrigger(client){
  await client.query(`
    CREATE OR REPLACE FUNCTION gracz_capture_checkers_ranking_event() RETURNS TRIGGER AS $$
    DECLARE s JSONB; status TEXT; winner TEXT; white_id TEXT; black_id TEXT;
    BEGIN
      s:=NEW.state::jsonb; status:=s->'game'->>'status';
      IF status NOT IN ('won','draw') THEN RETURN NEW; END IF;
      white_id:=s->'players'->'white'->>'id'; black_id:=s->'players'->'black'->>'id'; winner:=s->'game'->>'winner';
      IF white_id IS NULL OR black_id IS NULL OR white_id=black_id THEN RETURN NEW; END IF;
      IF status='won' AND winner NOT IN ('white','black') THEN RETURN NEW; END IF;
      PERFORM pg_advisory_xact_lock_shared(${RANKING_CAPTURE_LOCK});
      INSERT INTO gracz_ranking_events(game_type,game_id,completed_at,payload)
      VALUES('checkers',NEW.game_id,NEW.updated_at,jsonb_build_object(
        'players',jsonb_build_array(white_id,black_id),
        'winnerIndex',CASE WHEN status='draw' THEN NULL WHEN winner='white' THEN 0 ELSE 1 END,
        'draw',status='draw'))
      ON CONFLICT(game_type,game_id) DO NOTHING;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS gracz_checkers_ranking_event ON gracz_game_sessions;
    CREATE TRIGGER gracz_checkers_ranking_event
      AFTER INSERT OR UPDATE OF state ON gracz_game_sessions
      FOR EACH ROW EXECUTE FUNCTION gracz_capture_checkers_ranking_event();
  `);
}

export async function installThousandRankingTrigger(client,{ifTableExists=false}={}){
  if(ifTableExists){
    const exists=Boolean((await client.query(`SELECT to_regclass('public.gracz_thousand_games') AS table_name`)).rows[0]?.table_name);
    if(!exists) return false;
  }
  await client.query(`
    CREATE OR REPLACE FUNCTION gracz_capture_thousand_ranking_event() RETURNS TRIGGER AS $$
    DECLARE winner_text TEXT;
    BEGIN
      IF NEW.state->>'status'<>'game-ended' OR jsonb_typeof(NEW.players)<>'array' OR jsonb_array_length(NEW.players)<>3 THEN RETURN NEW; END IF;
      winner_text:=NEW.state->>'winnerIndex';
      IF winner_text IS NULL OR winner_text !~ '^[0-2]$' THEN RETURN NEW; END IF;
      IF NEW.players->0->>'userId' IS NULL OR NEW.players->1->>'userId' IS NULL OR NEW.players->2->>'userId' IS NULL THEN RETURN NEW; END IF;
      PERFORM pg_advisory_xact_lock_shared(${RANKING_CAPTURE_LOCK});
      INSERT INTO gracz_ranking_events(game_type,game_id,completed_at,payload)
      VALUES('thousand',NEW.game_id,NEW.updated_at,jsonb_build_object(
        'players',jsonb_build_array(NEW.players->0->>'userId',NEW.players->1->>'userId',NEW.players->2->>'userId'),
        'winnerIndex',winner_text::int,'draw',false))
      ON CONFLICT(game_type,game_id) DO NOTHING;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS gracz_thousand_ranking_event ON gracz_thousand_games;
    CREATE TRIGGER gracz_thousand_ranking_event
      AFTER INSERT OR UPDATE OF state ON gracz_thousand_games
      FOR EACH ROW EXECUTE FUNCTION gracz_capture_thousand_ranking_event();
  `);
  return true;
}

export async function backfillLegacyRankingHistory(pool){
  const client=await pool.connect();let backfillLockHeld=false,materializerLockHeld=false,captureLockHeld=false;
  try{
    await client.query('SELECT pg_advisory_lock($1)',[RANKING_BACKFILL_LOCK]);backfillLockHeld=true;
    const state=await client.query('SELECT legacy_backfill_complete,legacy_backfill_version FROM gracz_ranking_state WHERE state_id=1');
    if(Number(state.rows[0]?.legacy_backfill_version||0)>=RANKING_BASELINE_VERSION)return{backfilled:0,complete:true,rebuilt:false};

    await client.query('SELECT pg_advisory_lock($1)',[RANKING_MATERIALIZER_LOCK]);materializerLockHeld=true;
    await client.query('BEGIN');
    try{
      let inserted=0;
      const checkers=await client.query(`
        INSERT INTO gracz_ranking_events(game_type,game_id,completed_at,payload)
        SELECT 'checkers',game_id,updated_at,jsonb_build_object(
          'players',jsonb_build_array(state::jsonb->'players'->'white'->>'id',state::jsonb->'players'->'black'->>'id'),
          'winnerIndex',CASE WHEN state::jsonb->'game'->>'status'='draw' THEN NULL WHEN state::jsonb->'game'->>'winner'='white' THEN 0 ELSE 1 END,
          'draw',state::jsonb->'game'->>'status'='draw')
        FROM gracz_game_sessions
        WHERE (state::jsonb->'game'->>'status') IN ('won','draw')
          AND state::jsonb->'players'->'white'->>'id' IS NOT NULL
          AND state::jsonb->'players'->'black'->>'id' IS NOT NULL
          AND (state::jsonb->'game'->>'status'='draw' OR state::jsonb->'game'->>'winner' IN ('white','black'))
        ON CONFLICT(game_type,game_id) DO NOTHING
      `);inserted+=checkers.rowCount??0;

      const thousandExists=Boolean((await client.query(`SELECT to_regclass('public.gracz_thousand_games') AS table_name`)).rows[0]?.table_name);
      if(thousandExists){
        await installThousandRankingTrigger(client);
        const thousand=await client.query(`
          INSERT INTO gracz_ranking_events(game_type,game_id,completed_at,payload)
          SELECT 'thousand',game_id,updated_at,jsonb_build_object(
            'players',jsonb_build_array(players->0->>'userId',players->1->>'userId',players->2->>'userId'),
            'winnerIndex',(state->>'winnerIndex')::int,'draw',false)
          FROM gracz_thousand_games
          WHERE state->>'status'='game-ended' AND jsonb_typeof(players)='array' AND jsonb_array_length(players)=3
            AND state->>'winnerIndex' ~ '^[0-2]$'
            AND players->0->>'userId' IS NOT NULL AND players->1->>'userId' IS NOT NULL AND players->2->>'userId' IS NOT NULL
          ON CONFLICT(game_type,game_id) DO NOTHING
        `);inserted+=thousand.rowCount??0;
      }

      await client.query('SELECT pg_advisory_lock($1)',[RANKING_CAPTURE_LOCK]);captureLockHeld=true;
      const boundary=await client.query('SELECT COALESCE(MAX(event_id),0)::bigint AS max_event_id FROM gracz_ranking_events');
      const baselineMaxEventId=Number(boundary.rows[0]?.max_event_id||0);
      await client.query('SELECT pg_advisory_unlock($1)',[RANKING_CAPTURE_LOCK]);captureLockHeld=false;

      const rebuilt=await rebuildRankingBaseline(client,{maxEventId:baselineMaxEventId});
      await client.query(`UPDATE gracz_ranking_state SET legacy_backfill_complete=TRUE,legacy_backfill_version=$2,last_event_id=$3,updated_at=NOW() WHERE state_id=$1`,[1,RANKING_BASELINE_VERSION,baselineMaxEventId]);
      await client.query('COMMIT');
      return{backfilled:inserted,complete:true,rebuilt:true,baselineMaxEventId,events:rebuilt.events};
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
  }finally{
    if(captureLockHeld)await client.query('SELECT pg_advisory_unlock($1)',[RANKING_CAPTURE_LOCK]).catch(()=>{});
    if(materializerLockHeld)await client.query('SELECT pg_advisory_unlock($1)',[RANKING_MATERIALIZER_LOCK]).catch(()=>{});
    if(backfillLockHeld)await client.query('SELECT pg_advisory_unlock($1)',[RANKING_BACKFILL_LOCK]).catch(()=>{});
    client.release();
  }
}

export async function rebuildRankingBaseline(client,{maxEventId}){
  if(!Number.isInteger(maxEventId)||maxEventId<0)throw new TypeError('Granica bazowej materializacji rankingu jest nieprawidłowa.');
  const stats={all:new Map(),checkers:new Map(),thousand:new Map()};
  const totals={all:0,checkers:0,thousand:0};
  let cursor=null,events=0;
  while(true){
    const params=[maxEventId];
    let after='';
    if(cursor){
      params.push(cursor.completedAt,cursor.gameType,cursor.gameId,cursor.eventId);
      after=` AND (completed_at,game_type,game_id,event_id)>($2::timestamptz,$3::text,$4::varchar,$5::bigint)`;
    }
    params.push(BASELINE_READ_BATCH);
    const limitParam=`$${params.length}`;
    const page=await client.query(`
      SELECT event_id,game_type,game_id,completed_at,payload
      FROM gracz_ranking_events
      WHERE event_id<=$1${after}
      ORDER BY completed_at ASC,game_type ASC,game_id ASC,event_id ASC
      LIMIT ${limitParam}
    `,params);
    if(!page.rows.length)break;
    for(const row of page.rows){
      const event=eventFromLedgerRow(row);
      applyNormalizedEvent(event,stats.all);
      applyNormalizedEvent(event,stats[event.gameType]);
      totals.all+=1;totals[event.gameType]+=1;events+=1;
    }
    const last=page.rows.at(-1);
    cursor={completedAt:last.completed_at,gameType:last.game_type,gameId:last.game_id,eventId:Number(last.event_id)};
    if(page.rows.length<BASELINE_READ_BATCH)break;
  }

  await client.query('DELETE FROM gracz_ranking_materialized');
  await client.query('DELETE FROM gracz_ranking_totals');
  for(const scope of SCOPES)await writeMaterializedBaseline(client,scope,stats[scope]);
  await client.query(`INSERT INTO gracz_ranking_totals(scope,games) VALUES('all',$1),('checkers',$2),('thousand',$3)`,[totals.all,totals.checkers,totals.thousand]);
  return{events,players:stats.all.size,totals};
}

async function writeMaterializedBaseline(client,scope,stats){
  const rows=[...stats.values()];
  for(let offset=0;offset<rows.length;offset+=BASELINE_WRITE_BATCH){
    const batch=rows.slice(offset,offset+BASELINE_WRITE_BATCH),params=[];
    const values=batch.map((stat,index)=>{
      const base=index*13;
      params.push(scope,stat.userId,stat.games,stat.wins,stat.draws,stat.losses,stat.streak,stat.bestStreak,stat.lastPlayed,stat.rating,stat.peakRating,stat.checkersGames,stat.thousandGames);
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13})`;
    }).join(',');
    await client.query(`INSERT INTO gracz_ranking_materialized(scope,user_id,games,wins,draws,losses,streak,best_streak,last_played,rating,peak_rating,checkers_games,thousand_games) VALUES ${values}`,params);
  }
}

export async function catchUpRankingMaterialization(pool,{maxEvents=MAX_RANKING_CATCHUP_EVENTS,drain=false}={}){
  if(!Number.isInteger(maxEvents)||maxEvents<1) throw new TypeError('maxEvents musi być dodatnią liczbą całkowitą.');
  const client=await pool.connect();let processed=0,backlog=false;
  try{
    do{
      await client.query('BEGIN');
      try{
        await client.query('SELECT pg_advisory_xact_lock($1)',[RANKING_MATERIALIZER_LOCK]);
        const state=await client.query('SELECT last_event_id FROM gracz_ranking_state WHERE state_id=1 FOR UPDATE');
        const lastEventId=Number(state.rows[0]?.last_event_id??0);
        const limit=drain?Math.min(maxEvents,1000)+1:maxEvents+1;
        const pending=await client.query(
          `SELECT event_id,game_type,game_id,completed_at,payload FROM gracz_ranking_events WHERE event_id>$1 ORDER BY event_id ASC LIMIT $2`,
          [lastEventId,limit]
        );
        const batch=pending.rows.slice(0,limit-1);backlog=pending.rows.length>=limit;
        for(const row of batch){
          const event=eventFromLedgerRow(row);
          const participantIds=[...event.payload.players].sort();
          for(const userId of participantIds) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ranking:${userId}`]);
          for(const scope of ['all',event.gameType]) await applyEventToScope(client,scope,event);
          await client.query('UPDATE gracz_ranking_state SET last_event_id=$2,updated_at=NOW() WHERE state_id=$1',[1,Number(row.event_id)]);
          processed++;
        }
        await client.query('COMMIT');
        if(!drain) break;
      }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
    }while(backlog);
    return {processed,backlog};
  }finally{client.release()}
}

export function eventFromLedgerRow(row){return normalizeEvent({gameType:row.game_type,gameId:row.game_id,completedAt:row.completed_at,payload:row.payload})}

export function applyNormalizedEvent(event,stats){
  const ids=event.payload.players;const ensure=id=>{let stat=stats.get(id);if(!stat){stat=emptyStat(id);stats.set(id,stat)}return stat};
  if(event.gameType==='checkers'){
    const [whiteId,blackId]=ids,white=ensure(whiteId),black=ensure(blackId),wr=white.rating,br=black.rating;let ws=.5,bs=.5;
    if(!event.payload.draw){if(event.payload.winnerIndex===0){ws=1;bs=0}else{ws=0;bs=1}}
    const expectedWhite=1/(1+10**((br-wr)/400)),newWr=Math.round(wr+32*(ws-expectedWhite)),newBr=Math.round(br+32*(bs-(1-expectedWhite)));
    for(const [stat,rating] of [[white,newWr],[black,newBr]]){stat.games++;stat.checkersGames++;stat.lastPlayed=event.completedAt;stat.rating=rating;stat.peakRating=Math.max(stat.peakRating,rating)}
    applyPairOutcome(white,black,ws,bs);return stats;
  }
  const oldRatings=ids.map(id=>ensure(id).rating),deltas=[0,0,0],winner=event.payload.winnerIndex;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    const expectedI=1/(1+10**((oldRatings[j]-oldRatings[i])/400)),actualI=i===winner?1:j===winner?0:.5,delta=16*(actualI-expectedI);deltas[i]+=delta;deltas[j]-=delta;
  }
  ids.forEach((id,index)=>{const stat=ensure(id),rating=Math.round(oldRatings[index]+deltas[index]);stat.games++;stat.thousandGames++;stat.lastPlayed=event.completedAt;stat.rating=rating;stat.peakRating=Math.max(stat.peakRating,rating);if(index===winner){stat.wins++;stat.streak=Math.max(1,stat.streak+1);stat.bestStreak=Math.max(stat.bestStreak,stat.streak)}else{stat.losses++;stat.streak=Math.min(-1,stat.streak-1)}});
  return stats;
}

export function emptyStat(userId){return{userId,games:0,wins:0,draws:0,losses:0,streak:0,bestStreak:0,lastPlayed:null,rating:1200,peakRating:1200,checkersGames:0,thousandGames:0}}

async function applyEventToScope(client,scope,event){
  if(!SCOPES.has(scope)) throw new TypeError('Nieprawidłowy zakres rankingu.');
  const ids=event.payload.players;
  for(const userId of ids) await client.query(`INSERT INTO gracz_ranking_materialized(scope,user_id) VALUES($1,$2) ON CONFLICT(scope,user_id) DO NOTHING`,[scope,userId]);
  const current=await client.query(`SELECT user_id,games,wins,draws,losses,streak,best_streak,last_played,rating,peak_rating,checkers_games,thousand_games FROM gracz_ranking_materialized WHERE scope=$1 AND user_id=ANY($2::text[]) ORDER BY user_id FOR UPDATE`,[scope,ids]);
  const stats=new Map(current.rows.map(row=>[row.user_id,fromMaterializedRow(row)]));applyNormalizedEvent(event,stats);
  for(const userId of ids){const stat=stats.get(userId);await client.query(`UPDATE gracz_ranking_materialized SET games=$3,wins=$4,draws=$5,losses=$6,streak=$7,best_streak=$8,last_played=$9,rating=$10,peak_rating=$11,checkers_games=$12,thousand_games=$13,updated_at=NOW() WHERE scope=$1 AND user_id=$2`,[scope,userId,stat.games,stat.wins,stat.draws,stat.losses,stat.streak,stat.bestStreak,stat.lastPlayed,stat.rating,stat.peakRating,stat.checkersGames,stat.thousandGames])}
  await client.query(`INSERT INTO gracz_ranking_totals(scope,games) VALUES($1,1) ON CONFLICT(scope) DO UPDATE SET games=gracz_ranking_totals.games+1,updated_at=NOW()`,[scope]);
}

function fromMaterializedRow(row){return{userId:row.user_id,games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),streak:Number(row.streak),bestStreak:Number(row.best_streak),lastPlayed:row.last_played,rating:Number(row.rating),peakRating:Number(row.peak_rating),checkersGames:Number(row.checkers_games),thousandGames:Number(row.thousand_games)}}
function applyPairOutcome(w,b,ws,bs){if(ws===1){w.wins++;w.streak=Math.max(1,w.streak+1);w.bestStreak=Math.max(w.bestStreak,w.streak);b.losses++;b.streak=Math.min(-1,b.streak-1)}else if(bs===1){b.wins++;b.streak=Math.max(1,b.streak+1);b.bestStreak=Math.max(b.bestStreak,b.streak);w.losses++;w.streak=Math.min(-1,w.streak-1)}else{w.draws++;b.draws++;w.streak=0;b.streak=0}}
function cleanUserId(value){const id=String(value??'').trim();return id&&id.length<=128?id:null}
function normalizeEvent(event){
  if(!VALID_GAME_TYPES.has(event?.gameType)) throw new TypeError('Nieprawidłowy typ zdarzenia rankingowego.');
  const gameId=String(event?.gameId??'').trim();if(!/^[a-zA-Z0-9_-]{1,128}$/.test(gameId)) throw new TypeError('Nieprawidłowy gameId zdarzenia rankingowego.');
  const players=Array.isArray(event?.payload?.players)?event.payload.players.map(cleanUserId):[],expected=event.gameType==='checkers'?2:3;
  if(players.length!==expected||players.some(id=>!id)||new Set(players).size!==players.length) throw new TypeError('Nieprawidłowi uczestnicy zdarzenia rankingowego.');
  const draw=Boolean(event.payload.draw);let winnerIndex=event.payload.winnerIndex;
  if(draw&&event.gameType==='checkers') winnerIndex=null;else{winnerIndex=Number(winnerIndex);if(!Number.isInteger(winnerIndex)||winnerIndex<0||winnerIndex>=players.length) throw new TypeError('Nieprawidłowy zwycięzca zdarzenia rankingowego.');}
  const completedAt=new Date(event.completedAt);if(Number.isNaN(completedAt.valueOf())) throw new TypeError('Nieprawidłowa data zdarzenia rankingowego.');
  return{gameType:event.gameType,gameId,completedAt:completedAt.toISOString(),payload:{players,winnerIndex,draw}};
}