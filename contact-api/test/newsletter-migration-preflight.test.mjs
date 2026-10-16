import test from 'node:test';
import assert from 'node:assert/strict';
import {CANDIDATE_SHA256,MIGRATION_ID,EVIDENCE_KEYS,validateMigrationTarget} from '../persistence/newsletter-migration-preflight.mjs';
const now=Date.now(),codeHead='a'.repeat(40);
function approved() {
  return {mode:'production',connectionString:'postgresql://operator:secret@db.example.test:5432/newsletter',codeHead,now,
    evidence:{version:1,action:'INSTALL_NEWSLETTER_SCHEMA',codeHead,migrationId:MIGRATION_ID,sqlSha256:CANDIDATE_SHA256,
      registrySha256:'b'.repeat(64),target:{host:'db.example.test',port:5432,database:'newsletter',user:'operator'},
      issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString(),writersStoppedAt:new Date(now-2000).toISOString(),
      owner:'Owner',operator:'DB operator',evidence:Object.fromEntries(EVIDENCE_KEYS.map(k=>[k,{verified:true,reference:'restricted-release-record/'+k,sha256:'c'.repeat(64)}]))}};
}
test('F03 offline preflight accepts only bound, current and complete attestations',()=>{
  assert.match(validateMigrationTarget(approved()).evidenceDigest,/^[a-f0-9]{64}$/);
  for(const key of EVIDENCE_KEYS) {
    const o=approved();o.evidence.evidence[key].verified=false;
    assert.throws(()=>validateMigrationTarget(o),{code:'NEWSLETTER_MIGRATION_EVIDENCE_INCOMPLETE'});
  }
  for(const mutate of [o=>o.evidence.codeHead='d'.repeat(40),o=>o.evidence.sqlSha256='e'.repeat(64),o=>o.evidence.target.database='other',
    o=>o.evidence.expiresAt=new Date(now-1).toISOString(),o=>o.evidence.writersStoppedAt=new Date(now+1).toISOString(),
    o=>o.evidence.expiresAt=new Date(now+7200000).toISOString(),o=>o.evidence.owner='',o=>o.mode='unknown']) {
    const o=approved();mutate(o);assert.throws(()=>validateMigrationTarget(o));
  }
});
test('F03 target rejects ambient settings, remote disposable targets and URL overrides before connecting',()=>{
  for(const connectionString of [undefined,'postgresql://u:p@remote/gracz_test','postgresql://u:p@127.0.0.1/production',
    'postgresql://u:p@localhost/gracz_test?host=remote','postgresql://u:p@localhost/gracz_test?dbname=production',
    'postgresql://u:p@localhost/gracz_test?sslmode=disable','postgresql://u:p@localhost/gracz_test#ignored'])
    assert.throws(()=>validateMigrationTarget({mode:'disposable',connectionString}));
  assert.equal(validateMigrationTarget({mode:'disposable',connectionString:'postgresql://u:p@127.0.0.1/gracz_test'}).target.database,'gracz_test');
  assert.throws(()=>validateMigrationTarget({...approved(),evidence:undefined}));
});
