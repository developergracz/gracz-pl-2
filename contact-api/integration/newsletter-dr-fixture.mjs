// Manual isolated pg_dump/psql drill helper. Not imported by production or migrator.
// Usage: DATABASE_URL=<loopback gracz_test> node integration/newsletter-dr-fixture.mjs seed
// Then dump/restore into a second isolated gracz_test and use: ... verify <restored-url>
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {createNewsletterProofStore} from '../persistence/newsletter-proof-store.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
const hash=()=>randomBytes(32).toString('hex');
async function connect(url){
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  const identity=await db.getConnectionIdentity();
  assert.ok(['127.0.0.1','localhost','::1'].includes(identity.host)&&identity.database==='gracz_test');
  return db;
}
const source=await connect(process.env.DATABASE_URL);
let restored;
try {
  if(process.argv[2]==='seed') {
    const store=createPersistenceRepositories(source).newsletter,proof=createNewsletterProofStore(source);
    const emailHash=hash(),requestId=randomUUID();
    await store.ensureContact({emailHash});
    await store.appendConsentEvent({eventId:randomUUID(),emailHash,eventType:'opt_in_requested',occurredAt:new Date(),source:'dr-fixture'});
    await store.claimOptInRequest({emailHash,requestId,issuedAt:new Date(),expiresAt:new Date(Date.now()+600000),supersededBefore:new Date(0)});
    await store.markOptInSending({emailHash,requestId});await store.markOptInUnknown({emailHash,requestId});
    const claim={scope:'newsletter-public-optin',emailHash,requestId:hash(),expiresAt:new Date(1)};
    await proof.claimDispatch(claim);await proof.markDispatchEffect(claim);
    const token={tokenHash:hash(),emailHash,expiresAt:new Date(Date.now()+600000)};
    await proof.issueStatusToken(token);await proof.consumeStatusToken(token);
    console.log('Synthetic DR fixture ready; no provider calls.');
  } else if(process.argv[2]==='verify') {
    restored=await connect(process.argv[3]);
    for(const table of ['schema_migrations','newsletter_contacts','newsletter_consent_events','newsletter_opt_in_requests','idempotency_keys']) {
      const sql=`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`;
      const a=(await source.query(sql)).rows,b=(await restored.query(sql)).rows;
      assert.deepEqual(b,a);console.log(table+': exact snapshot restored ('+a.length+' rows)');
    }
    const proof=createNewsletterProofStore(restored),store=createPersistenceRepositories(restored).newsletter;
    const row=(await restored.query("SELECT * FROM newsletter_opt_in_requests WHERE state='unknown' LIMIT 1")).rows[0];assert.ok(row);
    assert.equal((await store.claimOptInRequest({emailHash:row.email_hash,requestId:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+600000),supersededBefore:new Date()})).claimed,false);
    const dispatch=(await restored.query("SELECT * FROM idempotency_keys WHERE scope='newsletter-public-optin' AND state='inflight' AND response_body->>'phase'='external_effect' LIMIT 1")).rows[0];assert.ok(dispatch);
    assert.equal(await proof.claimDispatch({scope:dispatch.scope,emailHash:dispatch.key_hash,requestId:hash(),expiresAt:new Date(Date.now()+60000)}),false);
    const token=(await restored.query("SELECT * FROM idempotency_keys WHERE scope='newsletter-status-token' AND state='done' LIMIT 1")).rows[0];assert.ok(token);
    assert.equal(await proof.consumeStatusToken({tokenHash:token.key_hash,emailHash:token.fingerprint}),false);
    await assert.rejects(()=>restored.query("UPDATE newsletter_consent_events SET source='invalid'"));
    await assert.rejects(()=>store.importHistoricalOptIns({cutoverBefore:new Date(),writersStopped:true}),/writer start/);
    console.log('DR: 10 checks PASS; unknown DOI, ambiguous dispatch, spent proof, ledger trigger and closed cutover preserved');
  } else throw new Error('Expected seed or verify mode');
} finally {await source.close();await restored?.close();}
