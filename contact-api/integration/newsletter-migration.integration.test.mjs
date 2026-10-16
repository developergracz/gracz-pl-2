import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../persistence/database.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {applyNewsletterMigration} from '../persistence/newsletter-migrator.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
const url=process.env.DATABASE_URL;
test('F03 isolated install, repeat and checksum refusal', {skip:!url}, async t=>{
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});t.after(()=>db.close());
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(db);
  const before=(await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows;
  assert.equal((await db.query("SELECT to_regclass('newsletter_opt_in_requests') AS name")).rows[0].name,null);
  const options={mode:'disposable',connectionString:url};
  assert.equal((await applyNewsletterMigration(db,options)).status,'applied');
  assert.equal((await applyNewsletterMigration(db,options)).status,'verified');
  assert.deepEqual((await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows,before);
  await db.query("UPDATE newsletter_schema_migrations SET checksum=repeat('f',64)");
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_LEDGER_MISMATCH'});
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
});

async function fixture(t) {
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(db);
  t.after(async()=>{await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');await db.close();});
  return {db,options:{mode:'disposable',connectionString:url}};
}
test('F03 concurrent installers serialize; normal migrator never claims newsletter identity', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  const results=await Promise.all(Array.from({length:5},()=>applyNewsletterMigration(db,options)));
  assert.equal(results.filter(r=>r.status==='applied').length,1);
  assert.equal(results.filter(r=>r.status==='verified').length,4);
  assert.deepEqual((await applyMigrations(db)).applied,[]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,4);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_schema_migrations')).rows[0].n,1);
});
test('F03 unknown baseline/005 checksums and missing baseline refuse without candidate writes', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  await db.query("UPDATE schema_migrations SET checksum=repeat('f',64) WHERE version LIKE '003%'");
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_BASELINE_MISMATCH'});
  assert.equal((await db.query("SELECT to_regclass('newsletter_opt_in_requests') AS name")).rows[0].name,null);
});
test('F03 future CONTACT005 namespace coexists before or after isolated newsletter install', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  // Simulated future ledger identity, NOT the unapproved destructive CONTACT SQL.
  await db.query("INSERT INTO schema_migrations(version,checksum) VALUES('005_contact_data_contract.sql',repeat('a',64))");
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_CONTRACT_MISMATCH'});
  options.contactContractSha256='a'.repeat(64);
  assert.equal((await applyNewsletterMigration(db,options)).status,'applied');
  await db.query("DELETE FROM schema_migrations WHERE version LIKE '005%'");
  assert.equal((await applyNewsletterMigration(db,options)).status,'verified');
  await db.query("INSERT INTO schema_migrations(version,checksum) VALUES('005_contact_data_contract.sql',repeat('b',64))");
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_CONTRACT_MISMATCH'});
  options.contactContractSha256='b'.repeat(64);
  assert.equal((await applyNewsletterMigration(db,options)).status,'verified');
  await db.query("UPDATE schema_migrations SET version='005_newsletter_opt_in_requests.sql' WHERE version LIKE '005%'");
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_BASELINE_MISMATCH'});
});
test('F03 refuses orphan schema, stale seal and drift without repair', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  await db.query('CREATE TABLE newsletter_opt_in_requests(x integer)');
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_PARTIAL_STATE'});
  await db.query('DROP TABLE newsletter_opt_in_requests');
  await applyNewsletterMigration(db,options);
  await db.query('ALTER TABLE newsletter_opt_in_requests ALTER COLUMN request_id DROP NOT NULL');
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_SCHEMA_MISMATCH'});
  await db.query('ALTER TABLE newsletter_opt_in_requests ALTER COLUMN request_id SET NOT NULL');
  await db.query("UPDATE idempotency_keys SET response_body='{}' WHERE scope='newsletter-cutover'");
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_SEAL_MISMATCH'});
  await db.query('DROP TABLE newsletter_opt_in_requests');
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_PARTIAL_STATE'});
});
test('F03 actual disconnect before commit rolls back table, seal and ledger; fresh process can retry', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  const {spawn}=await import('node:child_process');
  const {once}=await import('node:events');
  const child=spawn(process.execPath,['--input-type=module','-e',`
    import {createDatabase} from './contact-api/persistence/database.mjs';
    import {applyNewsletterMigration} from './contact-api/persistence/newsletter-migrator.mjs';
    const db=createDatabase({connectionString:process.env.DATABASE_URL});
    const wrapped={...db,transaction:fn=>db.transaction(async c=>{const result=await fn(c);console.log('BEFORE_COMMIT');await new Promise(()=>{});return result;})};
    await applyNewsletterMigration(wrapped,{mode:'disposable',connectionString:process.env.DATABASE_URL});
  `],{cwd:new URL('../../',import.meta.url),env:{PATH:process.env.PATH,DATABASE_URL:url},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);
  t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
  for(let i=0;i<200&&!output.includes('BEFORE_COMMIT');i++)await new Promise(r=>setTimeout(r,25));
  assert.match(output,/BEFORE_COMMIT/);
  const exit=once(child,'exit');child.kill('SIGKILL');await exit;
  assert.equal((await db.query("SELECT to_regclass('newsletter_opt_in_requests') AS name")).rows[0].name,null);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM idempotency_keys WHERE scope='newsletter-cutover'")).rows[0].n,0);
  assert.equal((await applyNewsletterMigration(db,options)).status,'applied');
  // New pool/process state, equivalent to uncertain/lost success response: verify only.
  const restarted=createDatabase({connectionString:url});t.after(()=>restarted.close());
  const before=(await db.query('SELECT * FROM idempotency_keys')).rows;
  assert.equal((await applyNewsletterMigration(restarted,options)).status,'verified');
  assert.deepEqual((await db.query('SELECT * FROM idempotency_keys')).rows,before);
});

test('F03 failure after table creation is atomic and missing ledger cannot be adopted', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  await db.query(`CREATE FUNCTION f03_reject_seal() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.scope='newsletter-cutover' THEN RAISE EXCEPTION 'test-only seal failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER f03_reject_seal BEFORE INSERT ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION f03_reject_seal()`);
  await assert.rejects(applyNewsletterMigration(db,options),{code:'P0001'});
  assert.equal((await db.query("SELECT to_regclass('newsletter_opt_in_requests') AS name")).rows[0].name,null);
  assert.equal((await db.query("SELECT to_regclass('newsletter_schema_migrations') AS name")).rows[0].name,null);
  await db.query('DROP TRIGGER f03_reject_seal ON idempotency_keys; DROP FUNCTION f03_reject_seal()');
  await applyNewsletterMigration(db,options);
  await db.query('DROP TABLE newsletter_schema_migrations');
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_PARTIAL_STATE'});
});
test('F03 effective port mismatch rejected and unknown ledger rows are never ignored', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  const substituted=new URL(url);substituted.port=String(Number(substituted.port)+1);
  await assert.rejects(applyNewsletterMigration(db,{...options,connectionString:String(substituted)}),{code:'NEWSLETTER_MIGRATION_TARGET_REJECTED'});
  await applyNewsletterMigration(db,options);
  await db.query("INSERT INTO newsletter_schema_migrations(version,checksum) VALUES('newsletter/002_unknown',repeat('a',64))");
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_LEDGER_MISMATCH'});
});

test('F03 refuses unlogged control state and ledger after restart', {skip:!url},async t=>{
  const {db,options}=await fixture(t);
  await applyNewsletterMigration(db,options);
  await db.query('ALTER TABLE newsletter_opt_in_requests SET UNLOGGED');
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_SCHEMA_MISMATCH'});
  await db.query('ALTER TABLE newsletter_opt_in_requests SET LOGGED');
  await db.query('ALTER TABLE newsletter_schema_migrations SET UNLOGGED');
  await assert.rejects(applyNewsletterMigration(db,options),{code:'NEWSLETTER_MIGRATION_SCHEMA_MISMATCH'});
});
