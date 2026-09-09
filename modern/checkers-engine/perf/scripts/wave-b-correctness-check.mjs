import pg from 'pg';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const {Pool}=pg;const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL required');
const pool=new Pool({connectionString:url,max:2});const runId=String(process.env.WAVE_B_RUN_ID||'wave-b');
const checks=[];async function count(id,sql){const {rows}=await pool.query(sql);const value=Number(rows[0]?.count||0);checks.push({id,count:value,pass:value===0});}
try{
  await count('LOBBY_PLAYING_WITHOUT_GAME_ID',`SELECT count(*) FROM gracz_lobby_rooms WHERE status='playing' AND game_id IS NULL`);
  await count('LOBBY_CHECKERS_MISSING_GAME',`SELECT count(*) FROM gracz_lobby_rooms r WHERE r.status='playing' AND r.game_type='checkers' AND NOT EXISTS(SELECT 1 FROM gracz_game_sessions g WHERE g.game_id=r.game_id)`);
  await count('LOBBY_GOMOKU_MISSING_GAME',`SELECT count(*) FROM gracz_lobby_rooms r WHERE r.status='playing' AND r.game_type='gomoku' AND NOT EXISTS(SELECT 1 FROM gracz_gomoku_games g WHERE g.game_id=r.game_id)`);
  await count('LOBBY_THOUSAND_MISSING_GAME',`SELECT count(*) FROM gracz_lobby_rooms r WHERE r.status='playing' AND r.game_type='thousand' AND NOT EXISTS(SELECT 1 FROM gracz_thousand_games g WHERE g.game_id=r.game_id)`);
  await count('CHECKERS_NONPOSITIVE_VERSION',`SELECT count(*) FROM gracz_game_sessions WHERE version<1`);
  await count('GOMOKU_NEGATIVE_REVISION',`SELECT count(*) FROM gracz_gomoku_games WHERE revision<0`);
  await count('THOUSAND_NEGATIVE_REVISION',`SELECT count(*) FROM gracz_thousand_games WHERE revision<0`);
  await count('RANKING_INVALID_TOTALS',`SELECT count(*) FROM gracz_ranking_materialized WHERE games<0 OR wins<0 OR draws<0 OR losses<0 OR wins+draws+losses>games`);
  const report={runId,checkedAt:new Date().toISOString(),pass:checks.every(x=>x.pass),checks};const out=resolve(`perf/k6/reports/${runId}-correctness.json`);await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=2;
}finally{await pool.end()}
