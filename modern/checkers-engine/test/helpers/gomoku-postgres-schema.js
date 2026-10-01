import pg from 'pg';

const {Pool}=pg;
export const GOMOKU_TEST_SCHEMA_LOCK=731_004_304;

/**
 * Test-only schema bootstrap for suites that exercise PostgresGomokuService.
 *
 * Production PostgresGomokuService intentionally verifies an externally
 * migrated schema and fails closed when it is absent. Node's test runner may
 * execute files in parallel, so no test file may depend on another file's
 * before() hook having created the shared test table first.
 */
export async function ensureGomokuPostgresTestSchema(databaseUrl){
  if(!databaseUrl)return;
  const pool=new Pool({connectionString:databaseUrl,ssl:isLocal(databaseUrl)?false:undefined,max:1});
  const client=await pool.connect();
  try{
    await client.query('SELECT pg_advisory_lock($1)',[GOMOKU_TEST_SCHEMA_LOCK]);
    await client.query(`CREATE TABLE IF NOT EXISTS gracz_gomoku_games (
      game_id VARCHAR(128) PRIMARY KEY,
      state JSONB NOT NULL,
      revision INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`);
  }finally{
    await client.query('SELECT pg_advisory_unlock($1)',[GOMOKU_TEST_SCHEMA_LOCK]).catch(()=>{});
    client.release();
    await pool.end();
  }
}

function isLocal(url){return url.includes('localhost')||url.includes('127.0.0.1')}
