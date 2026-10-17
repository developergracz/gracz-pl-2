// Offline one-shot F-03 schema installation + historical import.
// Never imported by server.mjs, npm build/start/migrate or any HTTP route.
// The Owner/DB operator's real, current release-evidence file is mandatory.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {createDatabase} from '../persistence/database.mjs';
import {applyNewsletterMigration} from '../persistence/newsletter-migrator.mjs';
import {importNewsletterHistory} from '../persistence/newsletter-cutover.mjs';
import {validateMigrationTarget, refuse} from '../persistence/newsletter-migration-preflight.mjs';
import {f03TlsOptions} from '../persistence/render-private-tls.mjs';

// Based on the Owner's independent production snapshot of 2026-10-17.
// Any new event/contact requires a NEW review of the release boundary.
export const PINNED_HISTORY = Object.freeze({
  contacts: 2, events: 32, confirmed: 1,
  latest: '2026-10-15T19:29:31.474Z',
  cutoff: '2026-10-15T19:29:32.000Z',
});
const fail = code => refuse('NEWSLETTER_MIGRATION_' + code);

export function assertPinnedHistory(snapshot) {
  const last = snapshot?.latest instanceof Date
    ? snapshot.latest.toISOString() : typeof snapshot?.latest === 'string'
    ? new Date(snapshot.latest).toISOString() : null;
  if (snapshot?.contacts !== PINNED_HISTORY.contacts ||
      snapshot?.events !== PINNED_HISTORY.events ||
      snapshot?.confirmed !== PINNED_HISTORY.confirmed ||
      last !== PINNED_HISTORY.latest) fail('HISTORY_DRIFT');
  if (Date.parse(PINNED_HISTORY.cutoff) <= Date.parse(last)) fail('CUTOFF_REJECTED');
}

export function assertNoCompetingClients(row) {
  if (!row || !Number.isInteger(row.clients) || row.clients !== 0)
    fail('WRITER_SESSIONS_PRESENT');
}

const SNAPSHOT_SQL = [
  'SELECT',
  '(SELECT count(*)::int FROM public.newsletter_contacts) AS contacts,',
  '(SELECT count(*)::int FROM public.newsletter_consent_events) AS events,',
  "(SELECT count(*)::int FROM public.newsletter_consent_events WHERE event_type='opt_in_confirmed') AS confirmed,",
  '(SELECT max(occurred_at) FROM public.newsletter_consent_events) AS latest',
].join(' ');
const SESSIONS_SQL = "SELECT count(*)::int AS clients FROM pg_catalog.pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'";

async function checkStoppedDatabase(database) {
  assertNoCompetingClients((await database.query(SESSIONS_SQL)).rows[0]);
  assertPinnedHistory((await database.query(SNAPSHOT_SQL)).rows[0]);
}

// Does NOT infer writer retirement from zero DB sessions. A complete external
// writer fence, provider uncertain-inventory and DR/escrow references must have
// been independently verified before the signed evidence can exist.
export async function performF03Once(database, options, deps = {}) {
  const migrate = deps.migrate || applyNewsletterMigration;
  const importHistory = deps.importHistory || importNewsletterHistory;
  const validate = deps.validate || validateMigrationTarget;
  validate(options); // real evidence + identity + expiry, before any DB IO
  await checkStoppedDatabase(database);
  const installed = await migrate(database, options); // independently transaction-gated
  // A failed history import leaves the additive schema sealed, not 'rolled back'.
  // A fresh authorized receipt may resume; no DOI resend or writer activation.
  validate(options); // fail if approval expired during installation
  await checkStoppedDatabase(database);
  const cutoff = new Date(PINNED_HISTORY.cutoff);
  const imported = await importHistory(database, {
    cutoverBefore: cutoff, writersStopped: true,
  });
  if (!Number.isInteger(imported) || imported < 0) fail('IMPORT_RESULT_REJECTED');
  const rows = (await database.query(
    "SELECT response_body FROM public.idempotency_keys WHERE scope='newsletter-cutover' AND key_hash=repeat('0',64)"
  )).rows;
  if (rows.length !== 1 || rows[0].response_body?.imported !== true ||
      rows[0].response_body?.cutoverBefore !== PINNED_HISTORY.cutoff ||
      rows[0].response_body?.writerStarted === true) fail('IMPORT_SEAL_MISMATCH');
  assertPinnedHistory((await database.query(SNAPSHOT_SQL)).rows[0]);
  return {
    result: 'F03_SCHEMA_AND_HISTORY_READY_WRITER_STILL_DISABLED',
    schema: installed.status,
    importedLegacyPending: imported,
    historyEventsPreserved: PINNED_HISTORY.events,
    cutoffUtc: PINNED_HISTORY.cutoff,
  };
}

async function cli() {
  const [action, evidencePath] = process.argv.slice(2);
  if (!['--preflight','--execute'].includes(action) || !evidencePath ||
      process.argv.length !== 4) fail('ONE_SHOT_USAGE');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const codeHead = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if (execFileSync('git',['status','--porcelain','--untracked-files=normal'],{
    cwd:root,encoding:'utf8',
  }).trim()) fail('DIRTY_CHECKOUT');
  const evidence = JSON.parse(await readFile(evidencePath,'utf8'));
  // Explicit DB URL is required; NEVER silently fall back to DATABASE_URL.
  const connectionString = process.env.NEWSLETTER_MIGRATION_DATABASE_URL;
  const options = {
    mode:'production', connectionString, evidence, codeHead,
    contactContractSha256:evidence.contactContractSha256,
  };
  validateMigrationTarget(options);
  if (action === '--preflight') {
    console.log('F03_EVIDENCE_STRUCTURE_PASS_EXTERNAL_FACTS_NOT_INDEPENDENTLY_VERIFIED');
    return;
  }
  if (process.env.NEWSLETTER_MIGRATION_CONFIRM !== 'INSTALL_NEWSLETTER_SCHEMA')
    fail('APPROVAL_REQUIRED');
  const db = createDatabase({
    connectionString,
    poolOptions:{
      max:1,
      ssl:f03TlsOptions(connectionString),
      application_name:'gracz-newsletter-f03-one-shot',
      connectionTimeoutMillis:4000,
      query_timeout:7000,
    },
  });
  try {
    console.log(JSON.stringify(await performF03Once(db,options)));
  } finally {
    await db.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  cli().catch(error => {
    // A raw PostgreSQL/network error may include sensitive connection details.
    const code = /^NEWSLETTER_MIGRATION_[A-Z_]+$/.test(error?.code || '')
      ? error.code : 'F03_ONE_SHOT_FAILED';
    console.error(code);
    process.exitCode=1;
  });
}
