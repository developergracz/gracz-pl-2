import { createServer } from 'node:http';
import pg from 'pg';

const { Pool } = pg;
const ENDPOINT = '/__g13_20260829_4f5f8c0b18bd4e12a0b9e74cc8fa43e1';
const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const Q = "'gamerpl','gamerde','gracz.pl','gamerpolska','gamer','gracz'";

if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const pool = new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }, max: 1 });

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && path === '/health') return send(res, 200, { status: 'ok', mode: 'gate13a-readonly' });
  if (req.method !== 'GET' || path !== ENDPOINT) return send(res, 404, { error: 'not_found' });
  try { return send(res, 200, await collect()); }
  catch (e) { console.error('[gate13a] collector error', { code: e?.code || 'ERROR', name: e?.name || 'Error' }); return send(res, 500, { error: 'collector_failed' }); }
});

server.listen(port, host, () => console.log(`[gate13a] compatibility collector on ${host}:${port}`));

async function collect() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN TRANSACTION READ ONLY');
    const meta = (await c.query("SELECT current_setting('transaction_read_only') ro,current_database() db,current_user usr,version() ver,NOW() captured_at")).rows[0];
    if (meta.ro !== 'on') throw new Error('not read only');

    const checkers = obj((await c.query(`
      WITH p AS (
        SELECT game_id,j,updated_at,
          lower(j#>>'{players,white,id}') w,lower(j#>>'{players,black,id}') b,
          j#>>'{game,status}' status,
          (SELECT count(*) FROM jsonb_array_elements(COALESCE(j->'events','[]'::jsonb)) e WHERE e->>'type'='move.accepted') moves
        FROM (SELECT game_id,CASE WHEN pg_input_is_valid(state,'jsonb') THEN state::jsonb END j,updated_at FROM gracz_game_sessions) s
      ), x AS (
        SELECT *,
          ((w IN (${Q}))::int + (b IN (${Q}))::int) qn,
          ((EXISTS(SELECT 1 FROM gracz_accounts a WHERE a.user_id=w))::int + (EXISTS(SELECT 1 FROM gracz_accounts a WHERE a.user_id=b))::int) known
        FROM p
      ) SELECT metric,value FROM (
        SELECT 'active_total' metric,count(*)::bigint value FROM x WHERE status='active'
        UNION ALL SELECT 'active_all_quarantine',count(*)::bigint FROM x WHERE status='active' AND qn=2 AND known=2
        UNION ALL SELECT 'active_all_canonical',count(*)::bigint FROM x WHERE status='active' AND qn=0 AND known=2
        UNION ALL SELECT 'active_mixed_quarantine_canonical',count(*)::bigint FROM x WHERE status='active' AND qn=1 AND known=2
        UNION ALL SELECT 'active_unknown_involvement',count(*)::bigint FROM x WHERE status='active' AND known<2
        UNION ALL SELECT 'active_zero_moves',count(*)::bigint FROM x WHERE status='active' AND moves=0
        UNION ALL SELECT 'active_with_moves',count(*)::bigint FROM x WHERE status='active' AND moves>0
        UNION ALL SELECT 'updated_lt_10m',count(*)::bigint FROM x WHERE updated_at>NOW()-interval '10 minutes'
        UNION ALL SELECT 'updated_10m_to_1h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '10 minutes' AND updated_at>NOW()-interval '1 hour'
        UNION ALL SELECT 'updated_1h_to_24h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '1 hour' AND updated_at>NOW()-interval '24 hours'
        UNION ALL SELECT 'updated_ge_24h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '24 hours'
      ) z
    `)).rows);

    const thousand = obj((await c.query(`
      WITH x AS (
        SELECT game_id,state->>'status' status,revision,updated_at,jsonb_array_length(players) n,
          (SELECT count(*) FROM jsonb_array_elements(players) p WHERE lower(p->>'userId') IN (${Q})) qn,
          (SELECT count(*) FROM jsonb_array_elements(players) p WHERE EXISTS(SELECT 1 FROM gracz_accounts a WHERE a.user_id=lower(p->>'userId'))) known
        FROM gracz_thousand_games
      ) SELECT metric,value FROM (
        SELECT 'nonterminal_total' metric,count(*)::bigint value FROM x WHERE status IN ('bidding','talon','discard','contract','playing')
        UNION ALL SELECT 'nonterminal_all_quarantine',count(*)::bigint FROM x WHERE status IN ('bidding','talon','discard','contract','playing') AND qn=n AND known=n
        UNION ALL SELECT 'nonterminal_all_canonical',count(*)::bigint FROM x WHERE status IN ('bidding','talon','discard','contract','playing') AND qn=0 AND known=n
        UNION ALL SELECT 'nonterminal_mixed_quarantine_canonical',count(*)::bigint FROM x WHERE status IN ('bidding','talon','discard','contract','playing') AND qn>0 AND qn<n AND known=n
        UNION ALL SELECT 'nonterminal_unknown_involvement',count(*)::bigint FROM x WHERE status IN ('bidding','talon','discard','contract','playing') AND known<n
        UNION ALL SELECT 'revision_eq_1',count(*)::bigint FROM x WHERE revision=1
        UNION ALL SELECT 'revision_gt_1',count(*)::bigint FROM x WHERE revision>1
        UNION ALL SELECT 'revision_min',COALESCE(min(revision),0)::bigint FROM x
        UNION ALL SELECT 'revision_max',COALESCE(max(revision),0)::bigint FROM x
        UNION ALL SELECT 'updated_lt_10m',count(*)::bigint FROM x WHERE updated_at>NOW()-interval '10 minutes'
        UNION ALL SELECT 'updated_10m_to_1h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '10 minutes' AND updated_at>NOW()-interval '1 hour'
        UNION ALL SELECT 'updated_1h_to_24h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '1 hour' AND updated_at>NOW()-interval '24 hours'
        UNION ALL SELECT 'updated_ge_24h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '24 hours'
      ) z
    `)).rows);

    const friendships = obj((await c.query(`
      WITH x AS (
        SELECT updated_at,
          CASE WHEN lower(requester_id) IN (${Q}) THEN 'Q' WHEN EXISTS(SELECT 1 FROM gracz_accounts a WHERE a.user_id=lower(requester_id)) THEN 'C' ELSE 'U' END r,
          CASE WHEN lower(addressee_id) IN (${Q}) THEN 'Q' WHEN EXISTS(SELECT 1 FROM gracz_accounts a WHERE a.user_id=lower(addressee_id)) THEN 'C' ELSE 'U' END a
        FROM gracz_chat_friends WHERE status='pending'
      ) SELECT metric,value FROM (
        SELECT 'pending_total' metric,count(*)::bigint value FROM x
        UNION ALL SELECT 'pending_quarantine_quarantine',count(*)::bigint FROM x WHERE r='Q' AND a='Q'
        UNION ALL SELECT 'pending_canonical_canonical',count(*)::bigint FROM x WHERE r='C' AND a='C'
        UNION ALL SELECT 'pending_mixed_quarantine_canonical',count(*)::bigint FROM x WHERE (r='Q' AND a='C') OR (r='C' AND a='Q')
        UNION ALL SELECT 'pending_unknown_involvement',count(*)::bigint FROM x WHERE r='U' OR a='U'
        UNION ALL SELECT 'updated_lt_10m',count(*)::bigint FROM x WHERE updated_at>NOW()-interval '10 minutes'
        UNION ALL SELECT 'updated_10m_to_1h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '10 minutes' AND updated_at>NOW()-interval '1 hour'
        UNION ALL SELECT 'updated_1h_to_24h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '1 hour' AND updated_at>NOW()-interval '24 hours'
        UNION ALL SELECT 'updated_ge_24h',count(*)::bigint FROM x WHERE updated_at<=NOW()-interval '24 hours'
      ) z
    `)).rows);

    const reconciliation = obj((await c.query(`SELECT metric,value FROM (
      SELECT 'checkers_rows' metric,count(*)::bigint value FROM gracz_game_sessions
      UNION ALL SELECT 'thousand_rows',count(*)::bigint FROM gracz_thousand_games
      UNION ALL SELECT 'friendship_pending_rows',count(*)::bigint FROM gracz_chat_friends WHERE status='pending'
      UNION ALL SELECT 'source_accounts',count(*)::bigint FROM gracz_accounts
      UNION ALL SELECT 'approved_quarantine_present',count(*)::bigint FROM gracz_accounts WHERE user_id IN (${Q})
    ) z`)).rows);

    await c.query('ROLLBACK');
    return {
      test: 'gate13-active-state-runtime-v1',
      gate13aTest: 'gate13a-stale-nonterminal-runtime-v1',
      captureStatus: 'PASS-COLLECTOR', readOnly: true, normalApplicationStarted: false,
      meta: { captured_at: meta.captured_at, database_name: meta.db, current_user: meta.usr, server_version: meta.ver },
      checkers, thousand, friendships, reconciliation
    };
  } catch (e) { await c.query('ROLLBACK').catch(()=>{}); throw e; }
  finally { c.release(); }
}

function obj(rows){ return Object.fromEntries(rows.map(r=>[r.metric,Number(r.value)])); }
function send(res,status,payload){ res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(payload)); }
let closing=false; async function shutdown(){ if(closing)return; closing=true; server.close(async()=>{ await pool.end().catch(()=>{}); process.exit(0); }); }
for(const s of ['SIGTERM','SIGINT']) process.once(s,()=>void shutdown());
