// Read-only private-network inventory for F-03. Never import from app startup.
// Requires DATABASE_URL injected privately in the operator's Render environment.
// Do not expose this script as HTTP, an npm lifecycle hook, or a scheduled job.
import { createHash } from 'node:crypto';
import pg from 'pg';

const code = (message) => { throw new Error(message); };
if (process.argv.length !== 2) code('INSPECTION_USAGE');
if (!process.env.DATABASE_URL) code('DATABASE_URL_NOT_CONFIGURED');
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 4000,
  idleTimeoutMillis: 1000,
  application_name: 'gracz-f03-readonly-inspection',
});
const digest = (rows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '3000ms'");
  await client.query("SET LOCAL lock_timeout = '1000ms'");
  const identity = (await client.query("SELECT current_database() AS database, current_user AS role")).rows[0];
  const relations = (await client.query(
    "SELECT c.relname, c.relpersistence FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname = ANY($1::text[]) ORDER BY c.relname",
    [['schema_migrations','newsletter_schema_migrations','newsletter_opt_in_requests','idempotency_keys']]
  )).rows;
  const registryExists = relations.some(r=>r.relname==='schema_migrations');
  // Avoid displaying operator names, credentials, contact data, email addresses or SQL errors.
  const registry = registryExists ?
    (await client.query('SELECT version,trim(checksum) AS checksum FROM public.schema_migrations ORDER BY version')).rows : [];
  const sessions = (await client.query(
    "SELECT state, count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() GROUP BY state ORDER BY state"
  )).rows;
  await client.query('ROLLBACK');
  console.log(JSON.stringify({
    inspector:'F03_READONLY_R1',
    databaseMatchesExpected: identity.database===process.env.F03_EXPECTED_DB_NAME,
    registryPresent:registryExists,
    registryVersions:registry.map(r=>r.version),
    registrySha256:registryExists?digest(registry):null,
    relations:relations.map(r=>({name:r.relname,permanent:r.relpersistence==='p'})),
    otherSessionCounts:sessions,
    warning:'Metadata only. Sessions do not independently certify writer retirement; verify backups and provider attempts separately.'
  },null,2));
} catch {
  if (client) try { await client.query('ROLLBACK'); } catch {}
  console.error('F03_READONLY_INSPECTION_FAILED');
  process.exitCode=1;
} finally {
  if (client) client.release();
  await pool.end();
}
