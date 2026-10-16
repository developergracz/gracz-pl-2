import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {createDatabase} from './database.mjs';
import {CANDIDATE_SHA256, MIGRATION_ID, digest, refuse, validateMigrationTarget} from './newsletter-migration-preflight.mjs';

const baseline = ['001_persistent_state.sql','002_durable_premium_reply.sql','003_newsletter_state_version.sql','004_contact_data_encryption.sql'];
const table = 'public.newsletter_opt_in_requests';
const ledger = 'public.newsletter_schema_migrations';
const ledgerSql = `CREATE TABLE public.newsletter_schema_migrations (
  version text PRIMARY KEY, checksum char(64) NOT NULL,
  evidence_sha256 char(64), applied_at timestamptz NOT NULL DEFAULT now()
)`;

// Compare server-canonical metadata against the same SQL in a temporary table.
// Constraint names/OIDs are intentionally excluded; semantics and validity aren't.
async function shape(client, relation) {
  const columns = (await client.query(`SELECT attname,format_type(atttypid,atttypmod) AS type,attnotnull,
    attidentity,attgenerated,pg_get_expr(d.adbin,d.adrelid) AS default_value
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,[relation])).rows;
  const constraints = (await client.query(`SELECT contype,convalidated,condeferrable,condeferred,
    pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass
    ORDER BY contype,definition`,[relation])).rows;
  const indexes = (await client.query(`SELECT indisunique,indisprimary,indisvalid,indisready,
    pg_get_expr(indpred,indrelid) AS predicate,
    ARRAY(SELECT pg_get_indexdef(indexrelid,n,true) FROM generate_series(1,indnatts) n) AS keys
    FROM pg_index WHERE indrelid=$1::regclass ORDER BY indisprimary,keys`,[relation])).rows;
  const extra = (await client.query(`SELECT relkind,relrowsecurity,relforcerowsecurity,
    (SELECT count(*)::int FROM pg_trigger WHERE tgrelid=c.oid AND NOT tgisinternal) AS triggers,
    (SELECT count(*)::int FROM pg_rewrite WHERE ev_class=c.oid) AS rules,
    (SELECT count(*)::int FROM pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid) AS inheritance
    FROM pg_class c WHERE oid=$1::regclass`,[relation])).rows;
  return JSON.stringify({columns,constraints,indexes,extra});
}
async function exists(client, name) {
  return (await client.query('SELECT to_regclass($1) AS name',[name])).rows[0].name !== null;
}
async function requirePermanent(client, relation) {
  const row = (await client.query('SELECT relpersistence FROM pg_class WHERE oid=$1::regclass',[relation])).rows[0];
  if (row?.relpersistence !== 'p') refuse('NEWSLETTER_MIGRATION_SCHEMA_MISMATCH');
}
async function verifyShape(client, relation, expected) {
  await requirePermanent(client,relation);
  if (await shape(client,relation) !== await shape(client,expected)) refuse('NEWSLETTER_MIGRATION_SCHEMA_MISMATCH');
}

export async function applyNewsletterMigration(database, options = {}) {
  const authorization = validateMigrationTarget(options); // before any connection
  const identity = await database.getConnectionIdentity();
  if (identity.host !== authorization.target.host || identity.database !== authorization.target.database)
    refuse('NEWSLETTER_MIGRATION_TARGET_REJECTED');
  const sql = await readFile(new URL('./candidates/005_newsletter_opt_in_requests.sql',import.meta.url),'utf8');
  if (digest(sql) !== CANDIDATE_SHA256) refuse('NEWSLETTER_MIGRATION_SQL_MISMATCH');
  const expectedBaseline = await Promise.all(baseline.map(async version => ({version,
    checksum:digest(await readFile(new URL('./migrations/'+version,import.meta.url),'utf8'))})));
  return database.transaction(async client => {
    await client.query("SET LOCAL search_path = public, pg_temp");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    const effective = client.connectionParameters;
    if (!effective || effective.host.replace(/^\[|\]$/g,'') !== authorization.target.host ||
        Number(effective.port) !== authorization.target.port || effective.database !== authorization.target.database ||
        effective.user !== authorization.target.user) refuse('NEWSLETTER_MIGRATION_TARGET_REJECTED');
    const actual = (await client.query('SELECT current_database() AS database,current_user AS username')).rows[0];
    if (actual.database !== authorization.target.database || actual.username !== authorization.target.user)
      refuse('NEWSLETTER_MIGRATION_TARGET_REJECTED');
    // Shared locks with the normal migrator and R5 cutover. Legacy writers do not
    // take these locks: external all-writer retirement remains mandatory.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('gracz-contact-api-migrations',0))");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('newsletter-cutover-v1',0))");
    if (!await exists(client,'public.schema_migrations')) refuse('NEWSLETTER_MIGRATION_BASELINE_REQUIRED');
    await requirePermanent(client,'public.schema_migrations');
    await requirePermanent(client,'public.idempotency_keys');
    await client.query('LOCK TABLE public.schema_migrations IN SHARE MODE');
    const registry = (await client.query('SELECT version,trim(checksum) AS checksum FROM public.schema_migrations ORDER BY version')).rows;
    if (JSON.stringify(registry.slice(0,4)) !== JSON.stringify(expectedBaseline) || registry.length > 5 ||
        (registry[4] && !/^005_contact_data_contract\.sql$/.test(registry[4].version)))
      refuse('NEWSLETTER_MIGRATION_BASELINE_MISMATCH');
    const registrySha256 = digest(JSON.stringify(registry));
    if (options.mode === 'production' && registrySha256 !== options.evidence.registrySha256)
      refuse('NEWSLETTER_MIGRATION_REGISTRY_MISMATCH');
    // Unknown 005 cannot be blessed by disposable mode either: pin explicitly.
    if (registry[4] && registry[4].checksum !== options.contactContractSha256)
      refuse('NEWSLETTER_MIGRATION_CONTRACT_MISMATCH');
    await client.query('LOCK TABLE public.idempotency_keys IN SHARE ROW EXCLUSIVE MODE');
    const hasTable = await exists(client,table), hasLedger = await exists(client,ledger);
    const marker = (await client.query("SELECT * FROM public.idempotency_keys WHERE scope='newsletter-cutover'")).rows;
    if (!hasLedger && (hasTable || marker.length)) refuse('NEWSLETTER_MIGRATION_PARTIAL_STATE');
    if (hasLedger && !hasTable) refuse('NEWSLETTER_MIGRATION_PARTIAL_STATE');
    // Temporary reference objects disappear on COMMIT/ROLLBACK. SQL bytes remain
    // unchanged in candidates/; the global 005 namespace is never used.
    const createTable = sql.slice(sql.indexOf('CREATE TABLE'),sql.indexOf(');')+2);
    await client.query(createTable.replace('CREATE TABLE newsletter_opt_in_requests','CREATE TEMP TABLE f03_expected_opt_in').replace(/;$/, ' ON COMMIT DROP;'));
    await client.query(ledgerSql.replace('CREATE TABLE public.newsletter_schema_migrations','CREATE TEMP TABLE f03_expected_ledger')+' ON COMMIT DROP');
    let status;
    if (hasLedger) {
      await verifyShape(client,ledger,'pg_temp.f03_expected_ledger');
      const rows = (await client.query('SELECT version,trim(checksum) AS checksum FROM public.newsletter_schema_migrations')).rows;
      if (rows.length !== 1 || rows[0].version !== MIGRATION_ID || rows[0].checksum !== CANDIDATE_SHA256)
        refuse('NEWSLETTER_MIGRATION_LEDGER_MISMATCH');
      status = 'verified';
    } else {
      await client.query(sql);
      await client.query(ledgerSql);
      await client.query('INSERT INTO public.newsletter_schema_migrations(version,checksum,evidence_sha256) VALUES($1,$2,$3)',
        [MIGRATION_ID,CANDIDATE_SHA256,authorization.evidenceDigest]);
      status = 'applied';
    }
    await verifyShape(client,table,'pg_temp.f03_expected_opt_in');
    const seals = (await client.query("SELECT * FROM public.idempotency_keys WHERE scope='newsletter-cutover'")).rows;
    const seal = seals[0];
    if (seals.length !== 1 || seal.key_hash !== '0'.repeat(64) || seal.fingerprint !== '0'.repeat(64) ||
        seal.state !== 'done' || seal.response_status !== 200 || !Number.isFinite(Date.parse(seal.response_body?.importNotAfter)) ||
        Date.parse(seal.response_body.importNotAfter) > Date.now() || seal.expires_at !== Infinity)
      refuse('NEWSLETTER_MIGRATION_SEAL_MISMATCH');
    // Restart is verification only. Never re-import, reset reservations, rewrite
    // the seal, update checksums, or recover ambiguous provider sends here.
    validateMigrationTarget(options); // approval may have expired while waiting
    return {status,migrationId:MIGRATION_ID,sqlSha256:CANDIDATE_SHA256,registrySha256};
  });
}

async function cli() {
  const [action, evidenceFile] = process.argv.slice(2);
  if (!['--preflight','--execute'].includes(action) || !evidenceFile || process.argv.length !== 4)
    refuse('NEWSLETTER_MIGRATION_USAGE');
  const root = fileURLToPath(new URL('../../',import.meta.url));
  const codeHead = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  if (execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim())
    refuse('NEWSLETTER_MIGRATION_DIRTY_CHECKOUT');
  const evidence = JSON.parse(await readFile(evidenceFile,'utf8'));
  const options = {mode:'production',connectionString:process.env.NEWSLETTER_MIGRATION_DATABASE_URL,evidence,codeHead,
    contactContractSha256:evidence.contactContractSha256};
  validateMigrationTarget(options);
  if (action === '--preflight') {console.log('Evidence structure valid; external facts NOT independently verified; no DB connection.'); return;}
  if (process.env.NEWSLETTER_MIGRATION_CONFIRM !== 'INSTALL_NEWSLETTER_SCHEMA') refuse('NEWSLETTER_MIGRATION_APPROVAL_REQUIRED');
  const db = createDatabase({connectionString:options.connectionString,poolOptions:{max:1,ssl:{rejectUnauthorized:true},application_name:'gracz-newsletter-offline-migration'}});
  try {console.log(await applyNewsletterMigration(db,options));} finally {await db.close();}
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  cli().catch(error=>{console.error({code:/^NEWSLETTER_MIGRATION_[A-Z_]+$/.test(error?.code)?error.code:'NEWSLETTER_MIGRATION_FAILED'});process.exitCode=1;});
}
