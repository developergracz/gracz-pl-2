import { createServer } from 'node:http';
import pg from 'pg';

const { Pool } = pg;
const ENDPOINT = '/__g13a_20260829_0b5e9c7e21f84ad19a6e52b3c8d472f0';
const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

if (!databaseUrl) throw new Error('DATABASE_URL is required for Gate 13A collector.');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  max: 1,
});

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET' && pathname === '/health') return send(response, 200, { status: 'ok', mode: 'gate13a-readonly' });
  if (request.method !== 'GET' || pathname !== ENDPOINT) return send(response, 404, { error: 'not_found' });
  try {
    const evidence = await collectEvidence();
    return send(response, 200, evidence);
  } catch (error) {
    console.error('[gate13a] collector error', { code: error?.code || 'ERROR', name: error?.name || 'Error' });
    return send(response, 500, { error: 'collector_failed' });
  }
});

server.listen(port, host, () => console.log(`[gate13a] read-only collector listening on ${host}:${port}`));

async function collectEvidence() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const ro = await client.query("SELECT current_setting('transaction_read_only') AS read_only, current_database() AS database_name, current_user AS current_user, version() AS server_version, NOW() AS captured_at");
    if (ro.rows[0]?.read_only !== 'on') throw new Error('transaction is not read-only');

    const checkers = rowsToObject((await client.query(`
      WITH quarantine(user_id) AS (
        VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer'),('gracz')
      ), parsed AS (
        SELECT game_id, CASE WHEN pg_input_is_valid(state, 'jsonb') THEN state::jsonb ELSE NULL END AS j, created_at, updated_at
        FROM gracz_game_sessions
      ), base AS (
        SELECT game_id,j,created_at,updated_at,j #>> '{game,status}' AS game_status,
          (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(j->'events','[]'::jsonb)) e WHERE e->>'type'='move.accepted') AS move_count
        FROM parsed
      ), classified AS (
        SELECT b.game_id,b.game_status,b.move_count,b.created_at,b.updated_at,
          COUNT(*) FILTER (WHERE q.user_id IS NOT NULL)::int AS quarantine_participants,
          COUNT(*) FILTER (WHERE a.user_id IS NOT NULL AND q.user_id IS NULL)::int AS canonical_participants,
          COUNT(*) FILTER (WHERE a.user_id IS NULL)::int AS unknown_participants
        FROM base b
        CROSS JOIN LATERAL (VALUES (lower(b.j #>> '{players,white,id}')), (lower(b.j #>> '{players,black,id}'))) p(user_id)
        LEFT JOIN gracz_accounts a ON a.user_id=p.user_id
        LEFT JOIN quarantine q ON q.user_id=p.user_id
        GROUP BY b.game_id,b.game_status,b.move_count,b.created_at,b.updated_at
      )
      SELECT metric,value FROM (
        SELECT 'active_total' AS metric, COUNT(*)::bigint AS value FROM classified WHERE game_status='active'
        UNION ALL SELECT 'active_all_quarantine', COUNT(*)::bigint FROM classified WHERE game_status='active' AND quarantine_participants=2 AND canonical_participants=0 AND unknown_participants=0
        UNION ALL SELECT 'active_all_canonical', COUNT(*)::bigint FROM classified WHERE game_status='active' AND canonical_participants=2 AND quarantine_participants=0 AND unknown_participants=0
        UNION ALL SELECT 'active_mixed_quarantine_canonical', COUNT(*)::bigint FROM classified WHERE game_status='active' AND quarantine_participants>0 AND canonical_participants>0 AND unknown_participants=0
        UNION ALL SELECT 'active_unknown_involvement', COUNT(*)::bigint FROM classified WHERE game_status='active' AND unknown_participants>0
        UNION ALL SELECT 'active_zero_moves', COUNT(*)::bigint FROM classified WHERE game_status='active' AND move_count=0
        UNION ALL SELECT 'active_with_moves', COUNT(*)::bigint FROM classified WHERE game_status='active' AND move_count>0
        UNION ALL SELECT 'updated_lt_10m', COUNT(*)::bigint FROM classified WHERE updated_at > NOW()-INTERVAL '10 minutes'
        UNION ALL SELECT 'updated_10m_to_1h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '10 minutes' AND updated_at > NOW()-INTERVAL '1 hour'
        UNION ALL SELECT 'updated_1h_to_24h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '1 hour' AND updated_at > NOW()-INTERVAL '24 hours'
        UNION ALL SELECT 'updated_ge_24h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '24 hours'
      ) x
    `)).rows);

    const thousand = rowsToObject((await client.query(`
      WITH quarantine(user_id) AS (
        VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer'),('gracz')
      ), classified AS (
        SELECT g.game_id,g.state->>'status' AS game_status,g.revision,g.created_at,g.updated_at,
          COUNT(*)::int AS participant_count,
          COUNT(*) FILTER (WHERE q.user_id IS NOT NULL)::int AS quarantine_participants,
          COUNT(*) FILTER (WHERE a.user_id IS NOT NULL AND q.user_id IS NULL)::int AS canonical_participants,
          COUNT(*) FILTER (WHERE a.user_id IS NULL)::int AS unknown_participants
        FROM gracz_thousand_games g
        CROSS JOIN LATERAL jsonb_array_elements(g.players) p(player)
        LEFT JOIN gracz_accounts a ON a.user_id=lower(p.player->>'userId')
        LEFT JOIN quarantine q ON q.user_id=lower(p.player->>'userId')
        GROUP BY g.game_id,g.state,g.revision,g.created_at,g.updated_at
      )
      SELECT metric,value FROM (
        SELECT 'nonterminal_total' AS metric, COUNT(*)::bigint AS value FROM classified WHERE game_status IN ('bidding','talon','discard','contract','playing')
        UNION ALL SELECT 'nonterminal_all_quarantine', COUNT(*)::bigint FROM classified WHERE game_status IN ('bidding','talon','discard','contract','playing') AND quarantine_participants=participant_count AND canonical_participants=0 AND unknown_participants=0
        UNION ALL SELECT 'nonterminal_all_canonical', COUNT(*)::bigint FROM classified WHERE game_status IN ('bidding','talon','discard','contract','playing') AND canonical_participants=participant_count AND quarantine_participants=0 AND unknown_participants=0
        UNION ALL SELECT 'nonterminal_mixed_quarantine_canonical', COUNT(*)::bigint FROM classified WHERE game_status IN ('bidding','talon','discard','contract','playing') AND quarantine_participants>0 AND canonical_participants>0 AND unknown_participants=0
        UNION ALL SELECT 'nonterminal_unknown_involvement', COUNT(*)::bigint FROM classified WHERE game_status IN ('bidding','talon','discard','contract','playing') AND unknown_participants>0
        UNION ALL SELECT 'revision_eq_1', COUNT(*)::bigint FROM classified WHERE revision=1
        UNION ALL SELECT 'revision_gt_1', COUNT(*)::bigint FROM classified WHERE revision>1
        UNION ALL SELECT 'revision_min', COALESCE(MIN(revision),0)::bigint FROM classified
        UNION ALL SELECT 'revision_max', COALESCE(MAX(revision),0)::bigint FROM classified
        UNION ALL SELECT 'updated_lt_10m', COUNT(*)::bigint FROM classified WHERE updated_at > NOW()-INTERVAL '10 minutes'
        UNION ALL SELECT 'updated_10m_to_1h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '10 minutes' AND updated_at > NOW()-INTERVAL '1 hour'
        UNION ALL SELECT 'updated_1h_to_24h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '1 hour' AND updated_at > NOW()-INTERVAL '24 hours'
        UNION ALL SELECT 'updated_ge_24h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '24 hours'
      ) x
    `)).rows);

    const friendships = rowsToObject((await client.query(`
      WITH quarantine(user_id) AS (
        VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer'),('gracz')
      ), classified AS (
        SELECT f.status,f.created_at,f.updated_at,
          CASE WHEN qr.user_id IS NOT NULL THEN 'Q' WHEN ar.user_id IS NOT NULL THEN 'C' ELSE 'U' END AS requester_class,
          CASE WHEN qa.user_id IS NOT NULL THEN 'Q' WHEN aa.user_id IS NOT NULL THEN 'C' ELSE 'U' END AS addressee_class
        FROM gracz_chat_friends f
        LEFT JOIN gracz_accounts ar ON ar.user_id=lower(f.requester_id)
        LEFT JOIN quarantine qr ON qr.user_id=lower(f.requester_id)
        LEFT JOIN gracz_accounts aa ON aa.user_id=lower(f.addressee_id)
        LEFT JOIN quarantine qa ON qa.user_id=lower(f.addressee_id)
        WHERE f.status='pending'
      )
      SELECT metric,value FROM (
        SELECT 'pending_total' AS metric, COUNT(*)::bigint AS value FROM classified
        UNION ALL SELECT 'pending_quarantine_quarantine', COUNT(*)::bigint FROM classified WHERE requester_class='Q' AND addressee_class='Q'
        UNION ALL SELECT 'pending_canonical_canonical', COUNT(*)::bigint FROM classified WHERE requester_class='C' AND addressee_class='C'
        UNION ALL SELECT 'pending_mixed_quarantine_canonical', COUNT(*)::bigint FROM classified WHERE (requester_class='Q' AND addressee_class='C') OR (requester_class='C' AND addressee_class='Q')
        UNION ALL SELECT 'pending_unknown_involvement', COUNT(*)::bigint FROM classified WHERE requester_class='U' OR addressee_class='U'
        UNION ALL SELECT 'updated_lt_10m', COUNT(*)::bigint FROM classified WHERE updated_at > NOW()-INTERVAL '10 minutes'
        UNION ALL SELECT 'updated_10m_to_1h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '10 minutes' AND updated_at > NOW()-INTERVAL '1 hour'
        UNION ALL SELECT 'updated_1h_to_24h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '1 hour' AND updated_at > NOW()-INTERVAL '24 hours'
        UNION ALL SELECT 'updated_ge_24h', COUNT(*)::bigint FROM classified WHERE updated_at <= NOW()-INTERVAL '24 hours'
      ) x
    `)).rows);

    const reconciliation = rowsToObject((await client.query(`
      SELECT metric,value FROM (
        SELECT 'checkers_rows' AS metric, COUNT(*)::bigint AS value FROM gracz_game_sessions
        UNION ALL SELECT 'thousand_rows', COUNT(*)::bigint FROM gracz_thousand_games
        UNION ALL SELECT 'friendship_pending_rows', COUNT(*)::bigint FROM gracz_chat_friends WHERE status='pending'
        UNION ALL SELECT 'source_accounts', COUNT(*)::bigint FROM gracz_accounts
        UNION ALL SELECT 'approved_quarantine_present', COUNT(*)::bigint FROM gracz_accounts WHERE user_id IN ('gamerpl','gamerde','gracz.pl','gamerpolska','gamer','gracz')
      ) x
    `)).rows);

    await client.query('ROLLBACK');
    return {
      test: 'gate13a-stale-nonterminal-runtime-v1',
      captureStatus: 'PASS-COLLECTOR',
      readOnly: true,
      normalApplicationStarted: false,
      meta: {
        captured_at: ro.rows[0].captured_at,
        database_name: ro.rows[0].database_name,
        current_user: ro.rows[0].current_user,
        server_version: ro.rows[0].server_version,
      },
      checkers,
      thousand,
      friendships,
      reconciliation,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function rowsToObject(rows) {
  return Object.fromEntries(rows.map(({ metric, value }) => [metric, Number(value)]));
}

function send(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(payload));
}

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => void shutdown());
