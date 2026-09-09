import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createGameSession, disconnectPlayer, submitGameAction } from '../src/session.js';
import { PostgresSessionStore } from '../src/postgres-session-store.js';
import { PostgresThousandRepository } from '../src/thousand-repository.js';
import { RankingService } from '../src/rankings.js';
import { applyNormalizedEvent, catchUpRankingMaterialization, emptyStat, MAX_RANKING_PERIOD_EVENTS } from '../src/ranking-materialization.js';

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;

function unique(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}

async function cleanupRanking(pool,{gameType,gameId,userIds}){
  await pool.query('DELETE FROM gracz_ranking_events WHERE game_type=$1 AND game_id=$2',[gameType,gameId]).catch(()=>{});
  await pool.query('DELETE FROM gracz_ranking_materialized WHERE user_id=ANY($1::text[])',[userIds]).catch(()=>{});
}

test('AS-CAN-F05: default/all ranking read path never scans authoritative game-state tables',async()=>{
  const source=await readFile(new URL('../src/rankings.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/FROM\s+gracz_game_sessions/i);
  assert.doesNotMatch(source,/FROM\s+gracz_thousand_games/i);
  assert.match(source,/FROM gracz_ranking_materialized/);
  assert.match(source,/FROM gracz_ranking_events/);
  assert.match(source,/MAX_RANKING_PERIOD_EVENTS\+1/);
  assert.equal(MAX_RANKING_PERIOD_EVENTS,50_000);
});

test('AS-CAN-F05: normalized checkers Elo keeps the previous 1200/32 contract',()=>{
  const stats=new Map([['alice',emptyStat('alice')],['bob',emptyStat('bob')]]);
  applyNormalizedEvent({gameType:'checkers',gameId:'f05_unit',completedAt:new Date().toISOString(),payload:{players:['alice','bob'],winnerIndex:1,draw:false}},stats);
  assert.equal(stats.get('alice').rating,1184);
  assert.equal(stats.get('bob').rating,1216);
  assert.equal(stats.get('alice').losses,1);
  assert.equal(stats.get('bob').wins,1);
});

test('AS-CAN-F05 PostgreSQL: terminal Checkers save creates one ledger event and two nodes materialize it exactly once',{skip:!databaseUrl},async()=>{
  const suffix=unique('asf05c'),gameId=`g_${suffix}`.slice(0,120),whiteId=`w_${suffix}`.slice(0,120),blackId=`b_${suffix}`.slice(0,120);
  const store=new PostgresSessionStore(databaseUrl);let rankingA,rankingB;
  try{
    await store.ready;
    rankingA=new RankingService(databaseUrl);rankingB=new RankingService(databaseUrl);
    await Promise.all([rankingA.ready,rankingB.ready]);

    const created=await store.create(createGameSession({gameId,whitePlayerId:whiteId,blackPlayerId:blackId}));
    const terminal=submitGameAction(created,{playerId:whiteId,action:'resign'});
    const saved=await store.save(terminal);

    await Promise.all([catchUpRankingMaterialization(rankingA.pool),catchUpRankingMaterialization(rankingB.pool)]);
    const eventCount=await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_ranking_events WHERE game_type='checkers' AND game_id=$1`,[gameId]);
    assert.equal(eventCount.rows[0].count,1);

    const materialized=await store.pool.query(`SELECT scope,user_id,games,wins,losses,rating FROM gracz_ranking_materialized WHERE scope IN ('all','checkers') AND user_id=ANY($1::text[]) ORDER BY scope,user_id`,[[whiteId,blackId]]);
    assert.equal(materialized.rowCount,4);
    for(const row of materialized.rows){
      assert.equal(Number(row.games),1);
      if(row.user_id===blackId){assert.equal(Number(row.rating),1216);assert.equal(Number(row.wins),1)}
      else{assert.equal(Number(row.rating),1184);assert.equal(Number(row.losses),1)}
    }

    const terminalMutation=disconnectPlayer(saved,whiteId);
    await store.save(terminalMutation);
    await catchUpRankingMaterialization(rankingA.pool);
    const afterDuplicate=await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_ranking_events WHERE game_type='checkers' AND game_id=$1`,[gameId]);
    assert.equal(afterDuplicate.rows[0].count,1);
    const games=await store.pool.query(`SELECT games FROM gracz_ranking_materialized WHERE scope='all' AND user_id=$1`,[blackId]);
    assert.equal(Number(games.rows[0].games),1);
  }finally{
    if(rankingA)await cleanupRanking(rankingA.pool,{gameType:'checkers',gameId,userIds:[whiteId,blackId]});
    await Promise.allSettled([rankingA?.close(),rankingB?.close(),store.close()]);
  }
});

test('AS-CAN-F05 PostgreSQL: Tysiąc terminal persistence is captured transactionally and remains idempotent',{skip:!databaseUrl},async()=>{
  const suffix=unique('asf05t'),gameId=`tg_${suffix}`.slice(0,90);
  const players=[0,1,2].map(index=>({userId:`t${index}_${suffix}`.slice(0,120),displayName:`T${index}`}));
  const repo=new PostgresThousandRepository(databaseUrl);
  try{
    await repo.ready;
    const created=await repo.create({gameId,players,state:{status:'game-ended',winnerIndex:1}});
    const first=await repo.pool.query(`SELECT event_id,payload FROM gracz_ranking_events WHERE game_type='thousand' AND game_id=$1`,[gameId]);
    assert.equal(first.rowCount,1);
    assert.deepEqual(first.rows[0].payload.players,players.map(player=>player.userId));
    assert.equal(first.rows[0].payload.winnerIndex,1);

    await Promise.all([catchUpRankingMaterialization(repo.pool),catchUpRankingMaterialization(repo.pool)]);
    const winner=await repo.pool.query(`SELECT games,wins,rating,thousand_games FROM gracz_ranking_materialized WHERE scope='thousand' AND user_id=$1`,[players[1].userId]);
    assert.equal(Number(winner.rows[0].games),1);
    assert.equal(Number(winner.rows[0].wins),1);
    assert.equal(Number(winner.rows[0].thousand_games),1);

    await repo.save(gameId,created.revision,{...created,state:{status:'game-ended',winnerIndex:1}});
    await catchUpRankingMaterialization(repo.pool);
    const count=await repo.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_ranking_events WHERE game_type='thousand' AND game_id=$1`,[gameId]);
    assert.equal(count.rows[0].count,1);
    const games=await repo.pool.query(`SELECT games FROM gracz_ranking_materialized WHERE scope='thousand' AND user_id=$1`,[players[1].userId]);
    assert.equal(Number(games.rows[0].games),1);
  }finally{
    await cleanupRanking(repo.pool,{gameType:'thousand',gameId,userIds:players.map(player=>player.userId)});
    await repo.pool.query('DELETE FROM gracz_thousand_games WHERE game_id=$1',[gameId]).catch(()=>{});
    await repo.close();
  }
});
