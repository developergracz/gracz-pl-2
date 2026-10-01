import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {PostgresAccountService} from '../src/postgres-accounts.js';
import {PostgresSessionStore} from '../src/postgres-session-store.js';
import {RankingService} from '../src/rankings.js';

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
const TEST_MESSAGE_KEY='wave-a-c2-ranking-test-message-key-2026';
function unique(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`.toLowerCase()}

test('Wave A C2 contract: personal ranking no longer delegates to leaderboard(limit:500)',async()=>{
  const source=await readFile(new URL('../src/rankings.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/player\([^)]*\)[\s\S]{0,300}leaderboard\([^)]*limit\s*:\s*500/);
  assert.match(source,/m\.scope=\$1 AND m\.user_id=\$2/);
  assert.match(source,/SELECT COUNT\(\*\)::bigint/);
});

test('Wave A C2 PostgreSQL: exact personal lookup returns ranks 500, 501 and 10,000',{skip:!databaseUrl},async()=>{
  const prefix=unique('wa_c2_exact');
  const store=new PostgresSessionStore(databaseUrl);
  const accounts=new PostgresAccountService(databaseUrl,TEST_MESSAGE_KEY,{legacyEncryptionSecret:null});
  let service;
  try{
    // Production initializes the authoritative Checkers store and accounts before
    // RankingService. Mirror that dependency ordering without weakening the
    // production LEFT JOIN contract used by personal ranking lookup.
    await Promise.all([store.ready,accounts.ready]);
    service=new RankingService(databaseUrl);
    await service.ready;

    // Use unique, near-INT_MAX ratings so unrelated ordinary ranking fixtures
    // cannot move these deterministic positions. Rating itself is the complete
    // ordering discriminator, so account/display-name tie-breaks are irrelevant.
    await service.pool.query(`
      INSERT INTO gracz_ranking_materialized(
        scope,user_id,games,wins,draws,losses,streak,best_streak,
        rating,peak_rating,checkers_games,thousand_games
      )
      SELECT
        'all',
        $1 || '_rank_' || LPAD(position::text,5,'0'),
        20,10,0,10,0,0,
        2147000000-position,
        2147000000-position,
        10,10
      FROM generate_series(1,10000) AS generated(position)
      ON CONFLICT(scope,user_id) DO UPDATE SET
        games=EXCLUDED.games,wins=EXCLUDED.wins,draws=EXCLUDED.draws,losses=EXCLUDED.losses,
        streak=EXCLUDED.streak,best_streak=EXCLUDED.best_streak,rating=EXCLUDED.rating,
        peak_rating=EXCLUDED.peak_rating,checkers_games=EXCLUDED.checkers_games,
        thousand_games=EXCLUDED.thousand_games
    `,[prefix]);

    // Guard against a regression that silently reintroduces a top-N scan.
    service.leaderboard=async()=>{throw new Error('C2 exact lookup must not delegate to leaderboard')};

    for(const expectedRank of[500,501,10000]){
      const userId=`${prefix}_rank_${String(expectedRank).padStart(5,'0')}`;
      const result=await service.player(userId,{period:'all',game:'all'});
      assert.ok(result.player,`rank ${expectedRank} player must be directly retrievable`);
      assert.equal(result.player.userId,userId);
      assert.equal(result.player.rank,expectedRank);
      assert.equal(result.player.rating,2147000000-expectedRank);
    }
  }finally{
    const pool=service?.pool??store.pool;
    await pool.query('DELETE FROM gracz_ranking_materialized WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await Promise.allSettled([service?.close(),accounts.close(),store.close()]);
  }
});
