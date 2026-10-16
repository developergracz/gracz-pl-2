import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { inspect } from '../operations/f03-readonly-inspect.mjs';

const env = {
  DATABASE_URL:'postgresql://reader:secret@dpg-example-a/db',
  F03_EXPECTED_DB_HOST:'dpg-example-a', F03_EXPECTED_DB_PORT:'5432',
  F03_EXPECTED_DB_NAME:'db', F03_EXPECTED_DB_ROLE:'reader',
};
function fixture(overrides = {}, registry = null) {
  const queries = [];
  let connected = false;
  let ended = false;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('SELECT current_database')) return {rows:[{
        database:'db', role:'reader', readonly:'on', version:180000, ...overrides,
      }]};
      if (sql.includes('pg_class')) return {rows:registry === null ? [] : [{relname:'schema_migrations',relpersistence:'p',relkind:'r'}]};
      if (sql.includes('FROM public.schema_migrations')) return {rows:registry};
      if (sql.includes('pg_stat_activity')) return {rows:[{state:null,count:1}]};
      return {rows:[]};
    },
    release() {},
  };
  return {queries, get connected(){return connected;}, get ended(){return ended;},
    loadPg:async()=>({default:{Pool:class {
      constructor(config) { assert.equal(config.ssl.rejectUnauthorized,true); }
      async connect(){connected=true;return client;}
      async end(){ended=true;}
      on(){}
    }}})};
}
test('rejects missing/mismatched target and URL overrides before connecting', async()=>{
  for (const change of [
    {F03_EXPECTED_DB_HOST:''}, {F03_EXPECTED_DB_ROLE:''},
    {F03_EXPECTED_DB_NAME:'wrong'}, {F03_EXPECTED_DB_HOST:'wrong'},
    {DATABASE_URL:env.DATABASE_URL+'?host=other'},
    {DATABASE_URL:env.DATABASE_URL+'#fragment'},
    {F03_EXPECTED_DB_PORT:'5433'},
  ]) {
    const f=fixture();
    await assert.rejects(()=>inspect({...env,...change}, f.loadPg));
    assert.equal(f.connected,false);
  }
});
test('server identity or readonly mismatch aborts before metadata and rolls back',async()=>{
  for (const mismatch of [{database:'other'},{role:'other'},{readonly:'off'},{version:160000}]) {
    const f=fixture(mismatch);
    await assert.rejects(()=>inspect(env,f.loadPg));
    assert.equal(f.queries.some(q=>q.includes('pg_class')),false);
    assert.equal(f.queries.at(-1),'ROLLBACK');
    assert.equal(f.ended,true);
  }
});
test('metadata succeeds only inside readonly transaction and contains no URL/role',async()=>{
  const f=fixture();
  const result=await inspect(env,f.loadPg);
  assert.equal(f.queries[0],'BEGIN READ ONLY');
  assert.equal(f.queries.at(-1),'ROLLBACK');
  assert.equal(result.targetMatchesExpected,true);
  assert.equal(result.sessionVisibilityComplete,false);
  assert.equal(result.registrySha256,null);
  assert.doesNotMatch(JSON.stringify(result),/secret|reader|postgresql/);
  assert.equal(f.ended,true);
});
test('driver failure is propagated for fixed-code CLI handling',async()=>{
  await assert.rejects(()=>inspect(env,async()=>{throw new Error('missing driver');}));
});
test('registry digest includes checksums but output rejects arbitrary registry text',async()=>{
  const good=fixture({},[{version:'001_initial.sql',checksum:'a'.repeat(64)}]);
  const result=await inspect(env,good.loadPg);
  assert.match(result.registrySha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(result.registryVersions,['001_initial.sql']);
  for (const registry of [[{version:'email@example.test',checksum:'a'.repeat(64)}],
    [{version:'001_initial.sql',checksum:'secret'}]]) {
    const f=fixture({},registry);
    await assert.rejects(()=>inspect(env,f.loadPg));
    assert.equal(f.queries.at(-1),'ROLLBACK');
  }
});
test('CLI emits fixed error without URL, credentials or stack on invalid target',(t)=>{
  const r=spawnSync(process.execPath,[new URL('../operations/f03-readonly-inspect.mjs',import.meta.url).pathname],{
    encoding:'utf8',env:{...process.env, DATABASE_URL:'postgresql://SECRET:SECRET@wrong/db', F03_EXPECTED_DB_HOST:''},
  });
  if (r.error?.code === 'EPERM') return t.skip('Executor denies child processes; run CLI directly and in CI');
  assert.equal(r.status,1);
  assert.equal(r.stdout,'');
  assert.equal(r.stderr.trim(),'F03_READONLY_INSPECTION_FAILED');
});
