// Standalone operator tool only: never import from startup or expose over HTTP.
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { f03TlsOptions } from '../persistence/render-private-tls.mjs';

const requireTrue = (value) => { if (!value) throw new Error('F03_INSPECTION_REJECTED'); };
const digest = (rows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');

// Expected target must be independently bound by the operator to the Render DB ID.
// Verified TLS by default; narrow Owner-approved private Render exception is explicit and fail-closed.
export async function inspect(env, loadPg = () => import('pg')) {
  const host = env.F03_EXPECTED_DB_HOST;
  const port = env.F03_EXPECTED_DB_PORT;
  const database = env.F03_EXPECTED_DB_NAME;
  const user = env.F03_EXPECTED_DB_ROLE;
  requireTrue(host && port === '5432' && database && user && env.DATABASE_URL);
  const url = new URL(env.DATABASE_URL);
  requireTrue(['postgres:', 'postgresql:'].includes(url.protocol));
  requireTrue(!url.search && !url.hash && url.hostname === host &&
    (url.port || '5432') === port &&
    decodeURIComponent(url.pathname.slice(1)) === database &&
    decodeURIComponent(url.username) === user && url.password);
  const { default: pg } = await loadPg();
  const pool = new pg.Pool({
    // Explicit fields avoid URL options overriding the reviewed connection config.
    host, port: Number(port), database, user, password: decodeURIComponent(url.password),
    ssl: f03TlsOptions(env.DATABASE_URL, env), max: 1,
    connectionTimeoutMillis: 4000, idleTimeoutMillis: 1000,
    query_timeout: 5000,
    options: '-c default_transaction_read_only=on -c statement_timeout=3000 -c idle_in_transaction_session_timeout=10000',
    application_name: 'gracz-f03-readonly-inspection',
  });
  let client;
  let poolFailed = false;
  pool.on('error', () => { poolFailed = true; });
  try {
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '3000ms'");
    await client.query("SET LOCAL lock_timeout = '1000ms'");
    await client.query("SET LOCAL search_path = pg_catalog");
    const identity = (await client.query(
      "SELECT current_database() AS database, current_user AS role, current_setting('transaction_read_only') AS readonly, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    requireTrue(identity?.database === database && identity.role === user &&
      identity.readonly === 'on' && identity.version >= 180000 && identity.version < 190000);
    const relations = (await client.query(
      "SELECT c.relname, c.relpersistence, c.relkind FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname = ANY($1::text[]) ORDER BY c.relname",
      [['schema_migrations','newsletter_schema_migrations','newsletter_opt_in_requests','idempotency_keys']]
    )).rows;
    requireTrue(relations.every(r => r.relpersistence === 'p' && r.relkind === 'r'));
    const registryExists = relations.some(r => r.relname === 'schema_migrations');
    const registry = registryExists ? (await client.query(
      'SELECT version,trim(checksum) AS checksum FROM public.schema_migrations ORDER BY version LIMIT 101'
    )).rows : [];
    // Never print arbitrary registry content (including unexpected data).
    requireTrue(registry.length <= 100 && registry.every(r =>
      typeof r.version === 'string' && /^[0-9]{3}_[a-z0-9_]+\.sql$/.test(r.version) &&
      typeof r.checksum === 'string' && /^[a-f0-9]{64}$/.test(r.checksum)));
    const sessions = (await client.query(
      "SELECT state, count(*)::integer AS count FROM pg_catalog.pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() GROUP BY state ORDER BY state"
    )).rows;
    const allowedStates = new Set(['active','idle','idle in transaction','idle in transaction (aborted)','fastpath function call','disabled']);
    requireTrue(sessions.every(r => (r.state === null || allowedStates.has(r.state)) &&
      Number.isInteger(r.count) && r.count >= 0));
    await client.query('ROLLBACK');
    requireTrue(!poolFailed);
    return {
      inspector: 'F03_READONLY_R2', targetMatchesExpected: true,
      registryPresent: registryExists, registryVersions: registry.map(r => r.version),
      registrySha256: registryExists ? digest(registry) : null,
      relations: relations.map(r => ({ name: r.relname, permanent: true })),
      sessionVisibilityComplete: !sessions.some(r => r.state === null),
      otherSessionCounts: sessions,
      warning: 'Metadata only; no writer-retirement or recovery certificate.',
    };
  } catch (error) {
    if (client) try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    if (client) client.release(true);
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireTrue(process.argv.length === 2);
    console.log(JSON.stringify(await inspect(process.env), null, 2));
  } catch {
    // Also covers missing pg, malformed URL and target validation: no raw errors.
    console.error('F03_READONLY_INSPECTION_FAILED');
    process.exitCode = 1;
  }
}
