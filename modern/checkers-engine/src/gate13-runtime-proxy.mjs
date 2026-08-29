import { createServer } from 'node:http';
import pg from 'pg';

const { Pool } = pg;
const PATH = '/__g13_20260829_4f5f8c0b18bd4e12a0b9e74cc8fa43e1';
const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  max: 1,
});

const n = (row, key) => Number(row?.[key] ?? 0);

async function scalar(client, sql, key = 'c') {
  const { rows } = await client.query(sql);
  return n(rows[0], key);
}

async function grouped(client, sql, key = 'status') {
  const { rows } = await client.query(sql);
  return Object.fromEntries(rows.map((row) => [String(row[key] ?? '<null>'), Number(row.count)]));
}

async function collect() {
  const client = await pool.connect();
  let rolledBack = false;
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const readOnly = (await client.query("SELECT current_setting('transaction_read_only') AS v")).rows[0]?.v === 'on';
    if (!readOnly) throw new Error('transaction is not read-only');

    const checkers = {
      sessions_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_game_sessions'),
      invalid_json: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_game_sessions WHERE NOT pg_input_is_valid(state, 'jsonb')"),
      active_games: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_game_sessions WHERE pg_input_is_valid(state, 'jsonb') AND state::jsonb #>> '{game,status}' = 'active'"),
      terminal_games: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_game_sessions WHERE pg_input_is_valid(state, 'jsonb') AND state::jsonb #>> '{game,status}' IN ('won','draw')"),
      unknown_status: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_game_sessions WHERE pg_input_is_valid(state, 'jsonb') AND COALESCE(state::jsonb #>> '{game,status}','') NOT IN ('active','won','draw')"),
      active_with_any_connected_player: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_game_sessions WHERE pg_input_is_valid(state, 'jsonb') AND state::jsonb #>> '{game,status}'='active' AND (COALESCE(state::jsonb #>> '{players,white,connected}','false')='true' OR COALESCE(state::jsonb #>> '{players,black,connected}','false')='true')"),
      updated_last_10m: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_game_sessions WHERE updated_at > NOW()-INTERVAL '10 minutes'"),
    };

    const thousand = {
      games_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_thousand_games'),
      in_progress: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_thousand_games WHERE COALESCE(state->>'status','') IN ('bidding','talon','discard','contract','playing')"),
      awaiting_next_round_or_redeal: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_thousand_games WHERE COALESCE(state->>'status','') IN ('round-ended','redeal')"),
      game_ended: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_thousand_games WHERE COALESCE(state->>'status','')='game-ended'"),
      unknown_status: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_thousand_games WHERE COALESCE(state->>'status','') NOT IN ('bidding','talon','discard','contract','playing','round-ended','redeal','game-ended')"),
      updated_last_10m: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_thousand_games WHERE updated_at > NOW()-INTERVAL '10 minutes'"),
      status_counts: await grouped(client, "SELECT COALESCE(state->>'status','<null>') AS status, COUNT(*)::bigint AS count FROM gracz_thousand_games GROUP BY 1 ORDER BY 1"),
    };

    const tournaments = {
      tournaments_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_tournaments'),
      registration: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_tournaments WHERE status='registration'"),
      live: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_tournaments WHERE status='live'"),
      finished: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_tournaments WHERE status='finished'"),
      unknown_status: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_tournaments WHERE status NOT IN ('registration','live','finished')"),
      open_matches: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_tournament_matches WHERE status<>'completed'"),
    };

    const auth = {
      sessions_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_auth_sessions'),
      sessions_unrevoked_unexpired: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_auth_sessions WHERE revoked_at IS NULL AND expires_at>NOW()'),
      sessions_active_runtime_rule: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_auth_sessions WHERE revoked_at IS NULL AND expires_at>NOW() AND last_seen_at>NOW()-INTERVAL '30 minutes'"),
      sessions_idle_or_expired_not_revoked: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_auth_sessions WHERE revoked_at IS NULL AND NOT (expires_at>NOW() AND last_seen_at>NOW()-INTERVAL '30 minutes')"),
    };

    const identity = {
      reset_tokens_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_password_reset_tokens'),
      reset_tokens_active: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_password_reset_tokens WHERE used_at IS NULL AND expires_at>NOW()'),
      registration_codes_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_registration_codes'),
      registration_codes_active: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_registration_codes c JOIN gracz_accounts a ON a.user_id=c.user_id WHERE c.expires_at>NOW() AND c.attempts<5 AND a.contact_verified=FALSE'),
      mfa_rows_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_mfa'),
      mfa_enabled: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_mfa WHERE enabled=TRUE'),
      mfa_setup_pending: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_mfa WHERE enabled=FALSE'),
    };

    const newsletter = {
      subscribers_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_newsletter_subscribers'),
      subscribed: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_newsletter_subscribers WHERE status='subscribed'"),
      pending_confirmation_total: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_newsletter_subscribers WHERE status='pending_confirmation'"),
      pending_confirmation_unexpired: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_newsletter_subscribers WHERE status='pending_confirmation' AND confirmation_expires_at>NOW()"),
      pending_confirmation_delivery_gap: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_newsletter_subscribers WHERE status='pending_confirmation' AND confirmation_expires_at>NOW() AND confirmation_sent_at IS NULL"),
      pending_confirmation_expired: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_newsletter_subscribers WHERE status='pending_confirmation' AND (confirmation_expires_at IS NULL OR confirmation_expires_at<=NOW())"),
      unknown_status: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_newsletter_subscribers WHERE status NOT IN ('pending_confirmation','subscribed','unsubscribed')"),
      status_counts: await grouped(client, 'SELECT COALESCE(status,\'<null>\') AS status, COUNT(*)::bigint AS count FROM gracz_newsletter_subscribers GROUP BY 1 ORDER BY 1'),
    };

    const moderationSocial = {
      moderation_decisions_total: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_moderation_decisions'),
      moderation_appeals_open: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_moderation_appeals WHERE status='open'"),
      moderation_appeals_unknown_status: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_moderation_appeals WHERE status NOT IN ('open','approved','rejected','closed')"),
      chat_reports_total_without_resolution_state: await scalar(client, 'SELECT COUNT(*)::bigint c FROM gracz_global_chat_reports'),
      friend_requests_pending: await scalar(client, "SELECT COUNT(*)::bigint c FROM gracz_chat_friends WHERE status='pending'"),
    };

    const dbRuntime = {
      other_client_connections: await scalar(client, "SELECT COUNT(*)::bigint c FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()"),
      other_active_connections: await scalar(client, "SELECT COUNT(*)::bigint c FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() AND state='active'"),
      other_idle_in_transaction: await scalar(client, "SELECT COUNT(*)::bigint c FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() AND state LIKE 'idle in transaction%'"),
      other_transactions_over_30s: await scalar(client, "SELECT COUNT(*)::bigint c FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() AND xact_start IS NOT NULL AND NOW()-xact_start>INTERVAL '30 seconds'"),
      waiting_locks: await scalar(client, 'SELECT COUNT(*)::bigint c FROM pg_locks WHERE NOT granted'),
    };

    const meta = (await client.query('SELECT current_database() AS database_name, current_user, version() AS server_version, NOW() AS captured_at')).rows[0];
    await client.query('ROLLBACK');
    rolledBack = true;

    return {
      test: 'gate13-active-state-runtime-v1',
      readOnly,
      normalApplicationStarted: false,
      processLocalPreDeployStateObservable: false,
      meta,
      checkers,
      thousand,
      tournaments,
      auth,
      identity,
      newsletter,
      moderationSocial,
      dbRuntime,
      captureStatus: 'PASS-COLLECTOR',
    };
  } finally {
    if (!rolledBack) await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ status: 'ok', mode: 'gate13-readonly' }));
  }
  if (req.method !== 'GET' || url.pathname !== PATH) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ error: 'not_found' }));
  }
  try {
    const evidence = await collect();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(evidence));
  } catch (error) {
    console.error('[gate13] collector failed', { name: error?.name, code: error?.code, message: String(error?.message || '').slice(0, 240) });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ test: 'gate13-active-state-runtime-v1', readOnly: true, captureStatus: 'ERROR', code: String(error?.code || 'ERROR') }));
  }
});

server.listen(PORT, HOST, () => console.log(`[gate13] read-only collector listening on ${HOST}:${PORT}`));

async function shutdown() {
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
