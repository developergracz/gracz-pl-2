export const RANKING_SCHEMA_LOCK=1_000_005_005;
export const RANKING_BACKFILL_LOCK=1_000_005_006;
export const MAX_RANKING_PERIOD_EVENTS=50_000;

const VALID_GAME_TYPES=new Set(['checkers','thousand']);
const SCOPES=new Set(['all','checkers','thousand']);

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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
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
    await client.query('COMMIT');
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{client.release()}
}

export function buildCheckersRankingEvent(session,completedAt=new Date()){
  const status=session?.game?.status;
  if(status!=='won'&&status!=='draw') return null;
  const white=cleanUserId(session?.players?.white?.id),black=cleanUserId(session?.players?.black?.id);
  if(!white||!black||white===black) return null;
  let winnerIndex=null;
  if(status==='won'){
    if(session.game.winner==='white') winnerIndex=0;
    else if(session.game.winner==='black') winnerIndex=1;
    else return null;
  }
  return normalizeEvent({
    gameType:'checkers',gameId:session.gameId,completedAt,
    payload:{players:[white,black],winnerIndex,draw:status==='draw'},
  });
}

export function buildThousandRankingEvent(record,completedAt=record?.updatedAt??new Date()){
  if(record?.state?.status!=='game-ended') return null;
  const players=Array.isArray(record.players)?record.players.map(player=>cleanUserId(player?.userId)).filter(Boolean):[];
  const winnerIndex=Number(record?.state?.winnerIndex);
  // Preserve the existing ranking contract: only the canonical 3-player Tysiąc mode is rated.
  if(players.length!==3||new Set(players).size!==3||!Number.isInteger(winnerIndex)||winnerIndex<0||winnerIndex>=players.length) return null;
  return normalizeEvent({gameType:'thousand',gameId:record.gameId,completedAt,payload:{players,winnerIndex,draw:false}});
}

export async function recordRankingCompletion(client,event){
  if(!event) return false;
  const normalized=normalizeEvent(event);
  const inserted=await client.query(
    `INSERT INTO gracz_ranking_events(game_type,game_id,completed_at,payload)
     VALUES($1,$2,$3,$4::jsonb)
     ON CONFLICT(game_type,game_id) DO NOTHING
     RETURNING event_id`,
    [normalized.gameType,normalized.gameId,normalized.completedAt,JSON.stringify(normalized.payload)],
  );
  if(inserted.rowCount===0) return false;

  const participantIds=[...normalized.payload.players].sort();
  for(const userId of participantIds){
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ranking:${userId}`]);
  }
  for(const scope of ['all',normalized.gameType]) await applyEventToScope(client,scope,normalized);
  return true;
}

export function eventFromLedgerRow(row){
  return normalizeEvent({gameType:row.game_type,gameId:row.game_id,completedAt:row.completed_at,payload:row.payload});
}

export async function backfillLegacyRankingHistory(pool){
  const client=await pool.connect();
  let lockHeld=false;
  try{
    await client.query('SELECT pg_advisory_lock($1)',[RANKING_BACKFILL_LOCK]);lockHeld=true;
    const state=await client.query('SELECT legacy_backfill_complete FROM gracz_ranking_state WHERE state_id=1');
    if(state.rows[0]?.legacy_backfill_complete) return {backfilled:0,complete:true};

    const thousandExists=Boolean((await client.query(`SELECT to_regclass('public.gracz_thousand_games') AS table_name`)).rows[0]?.table_name);
    const thousandUnion=thousandExists?`
      UNION ALL
      SELECT 'thousand'::text AS game_type,game_id::text,updated_at,
             jsonb_build_object('players',players,'state',state) AS raw
      FROM gracz_thousand_games
      WHERE state->>'status'='game-ended'`:'';
    const rows=await client.query(`
      SELECT game_type,game_id,updated_at,raw FROM (
        SELECT 'checkers'::text AS game_type,game_id::text,updated_at,state::jsonb AS raw
        FROM gracz_game_sessions
        WHERE (state::jsonb->'game'->>'status') IN ('won','draw')
        ${thousandUnion}
      ) history
      ORDER BY updated_at ASC,game_type ASC,game_id ASC
    `);

    let backfilled=0;
    const BATCH=250;
    for(let offset=0;offset<rows.rows.length;offset+=BATCH){
      await client.query('BEGIN');
      try{
        for(const row of rows.rows.slice(offset,offset+BATCH)){
          let event=null;
          if(row.game_type==='checkers') event=buildCheckersRankingEvent(row.raw,row.updated_at);
          else event=buildThousandRankingEvent({gameId:row.game_id,players:row.raw?.players,state:row.raw?.state,updatedAt:row.updated_at},row.updated_at);
          if(await recordRankingCompletion(client,event)) backfilled++;
        }
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
    }
    await client.query(`UPDATE gracz_ranking_state SET legacy_backfill_complete=TRUE,updated_at=NOW() WHERE state_id=1`);
    return {backfilled,complete:true};
  }finally{
    if(lockHeld) await client.query('SELECT pg_advisory_unlock($1)',[RANKING_BACKFILL_LOCK]).catch(()=>{});
    client.release();
  }
}

async function applyEventToScope(client,scope,event){
  if(!SCOPES.has(scope)) throw new TypeError('Nieprawidłowy zakres rankingu.');
  const ids=event.payload.players;
  for(const userId of ids){
    await client.query(
      `INSERT INTO gracz_ranking_materialized(scope,user_id) VALUES($1,$2)
       ON CONFLICT(scope,user_id) DO NOTHING`,[scope,userId]
    );
  }
  const current=await client.query(
    `SELECT user_id,games,wins,draws,losses,streak,best_streak,last_played,rating,peak_rating,checkers_games,thousand_games
     FROM gracz_ranking_materialized
     WHERE scope=$1 AND user_id=ANY($2::text[])
     ORDER BY user_id FOR UPDATE`,[scope,ids]
  );
  const stats=new Map(current.rows.map(row=>[row.user_id,fromMaterializedRow(row)]));
  applyNormalizedEvent(event,stats);
  for(const userId of ids){
    const stat=stats.get(userId);if(!stat) throw new Error('Brak materializowanego gracza rankingu.');
    await client.query(
      `UPDATE gracz_ranking_materialized SET
       games=$3,wins=$4,draws=$5,losses=$6,streak=$7,best_streak=$8,last_played=$9,
       rating=$10,peak_rating=$11,checkers_games=$12,thousand_games=$13,updated_at=NOW()
       WHERE scope=$1 AND user_id=$2`,
      [scope,userId,stat.games,stat.wins,stat.draws,stat.losses,stat.streak,stat.bestStreak,stat.lastPlayed,stat.rating,stat.peakRating,stat.checkersGames,stat.thousandGames]
    );
  }
  await client.query(
    `INSERT INTO gracz_ranking_totals(scope,games) VALUES($1,1)
     ON CONFLICT(scope) DO UPDATE SET games=gracz_ranking_totals.games+1,updated_at=NOW()`,[scope]
  );
}

export function applyNormalizedEvent(event,stats){
  const ids=event.payload.players;
  const ensure=id=>{let stat=stats.get(id);if(!stat){stat=emptyStat(id);stats.set(id,stat)}return stat};
  if(event.gameType==='checkers'){
    const [whiteId,blackId]=ids;const white=ensure(whiteId),black=ensure(blackId);
    const wr=white.rating,br=black.rating;let ws=.5,bs=.5;
    if(!event.payload.draw){if(event.payload.winnerIndex===0){ws=1;bs=0}else if(event.payload.winnerIndex===1){ws=0;bs=1}}
    const expectedWhite=1/(1+10**((br-wr)/400)),expectedBlack=1-expectedWhite,k=32;
    const newWr=Math.round(wr+k*(ws-expectedWhite)),newBr=Math.round(br+k*(bs-expectedBlack));
    for(const [stat,rating] of [[white,newWr],[black,newBr]]){
      stat.games++;stat.checkersGames++;stat.lastPlayed=event.completedAt;stat.rating=rating;stat.peakRating=Math.max(stat.peakRating,rating);
    }
    applyPairOutcome(white,black,ws,bs);return stats;
  }

  const oldRatings=ids.map(id=>ensure(id).rating),deltas=[0,0,0],k=32,winner=event.payload.winnerIndex;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    const expectedI=1/(1+10**((oldRatings[j]-oldRatings[i])/400));
    const actualI=i===winner?1:j===winner?0:.5;
    const delta=(k/2)*(actualI-expectedI);deltas[i]+=delta;deltas[j]-=delta;
  }
  ids.forEach((id,index)=>{
    const stat=ensure(id),rating=Math.round(oldRatings[index]+deltas[index]);
    stat.games++;stat.thousandGames++;stat.lastPlayed=event.completedAt;stat.rating=rating;stat.peakRating=Math.max(stat.peakRating,rating);
    if(index===winner){stat.wins++;stat.streak=Math.max(1,stat.streak+1);stat.bestStreak=Math.max(stat.bestStreak,stat.streak)}
    else{stat.losses++;stat.streak=Math.min(-1,stat.streak-1)}
  });
  return stats;
}

export function emptyStat(userId){return{userId,games:0,wins:0,draws:0,losses:0,streak:0,bestStreak:0,lastPlayed:null,rating:1200,peakRating:1200,checkersGames:0,thousandGames:0}}

function fromMaterializedRow(row){return{userId:row.user_id,games:Number(row.games),wins:Number(row.wins),draws:Number(row.draws),losses:Number(row.losses),streak:Number(row.streak),bestStreak:Number(row.best_streak),lastPlayed:row.last_played,rating:Number(row.rating),peakRating:Number(row.peak_rating),checkersGames:Number(row.checkers_games),thousandGames:Number(row.thousand_games)}}
function applyPairOutcome(w,b,ws,bs){if(ws===1){w.wins++;w.streak=Math.max(1,w.streak+1);w.bestStreak=Math.max(w.bestStreak,w.streak);b.losses++;b.streak=Math.min(-1,b.streak-1)}else if(bs===1){b.wins++;b.streak=Math.max(1,b.streak+1);b.bestStreak=Math.max(b.bestStreak,b.streak);w.losses++;w.streak=Math.min(-1,w.streak-1)}else{w.draws++;b.draws++;w.streak=0;b.streak=0}}
function cleanUserId(value){const id=String(value??'').trim();return id&&id.length<=128?id:null}
function normalizeEvent(event){
  if(!VALID_GAME_TYPES.has(event?.gameType)) throw new TypeError('Nieprawidłowy typ zdarzenia rankingowego.');
  const gameId=String(event?.gameId??'').trim();if(!/^[a-zA-Z0-9_-]{1,128}$/.test(gameId)) throw new TypeError('Nieprawidłowy gameId zdarzenia rankingowego.');
  const players=Array.isArray(event?.payload?.players)?event.payload.players.map(cleanUserId):[];
  const expected=event.gameType==='checkers'?2:3;
  if(players.length!==expected||players.some(id=>!id)||new Set(players).size!==players.length) throw new TypeError('Nieprawidłowi uczestnicy zdarzenia rankingowego.');
  const draw=Boolean(event.payload.draw);let winnerIndex=event.payload.winnerIndex;
  if(draw&&event.gameType==='checkers') winnerIndex=null;
  else{winnerIndex=Number(winnerIndex);if(!Number.isInteger(winnerIndex)||winnerIndex<0||winnerIndex>=players.length) throw new TypeError('Nieprawidłowy zwycięzca zdarzenia rankingowego.');}
  const completedAt=new Date(event.completedAt);if(Number.isNaN(completedAt.valueOf())) throw new TypeError('Nieprawidłowa data zdarzenia rankingowego.');
  return {gameType:event.gameType,gameId,completedAt:completedAt.toISOString(),payload:{players,winnerIndex,draw}};
}
