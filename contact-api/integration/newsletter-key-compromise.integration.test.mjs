// Characterization of the #278 HOLD, not an executable identity migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {createManager, consentEmailHash} from '../test-support/newsletter-provider.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';

const url = process.env.DATABASE_URL;
test('278 legacy 2/32/1 evidence stays intact when a new HMAC cannot resolve the subject', {skip:!url}, async t => {
  assertDisposableDatabaseUrl(url);
  const db = createDatabase({connectionString:url});
  t.after(() => db.close());
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(db);
  const store = createPersistenceRepositories(db).newsletter;
  const hashes = ['recovery@example.test','withdrawn@example.test'].map(consentEmailHash);
  for (const emailHash of hashes) await store.ensureContact({emailHash});
  await store.upsertContact({emailHash:hashes[0],currentState:'subscribed',confirmedAt:new Date(1000)});
  await store.upsertContact({emailHash:hashes[1],currentState:'unsubscribed',unsubscribedAt:new Date(2000),providerBlockedAt:new Date(2000)});
  for (let i=0; i<32; i++) await store.appendConsentEvent({
    eventId:randomUUID(), emailHash:hashes[i%2],
    eventType:i===0?'opt_in_confirmed':i===31?'unsubscribe':'opt_in_requested',
    occurredAt:new Date(1000+i*1000), source:'synthetic-278',
  });
  const snapshot = async () => ({
    contacts:(await db.query('SELECT * FROM newsletter_contacts ORDER BY email_hash')).rows,
    events:(await db.query('SELECT * FROM newsletter_consent_events ORDER BY event_id')).rows,
    registry:(await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows,
  });
  const before = await snapshot();
  assert.equal(before.contacts.length,2);
  assert.equal(before.events.length,32);
  assert.equal(before.events.filter(e=>e.event_type==='opt_in_confirmed').length,1);
  // Exercise the actual manager hash derivation, aborting before any provider call.
  const manager = createManager({base:'http://127.0.0.1:1',consentStore:store}, {
    consentHashSecret:randomBytes(48).toString('hex'),
    consentStore:{...store, async getContact(hash) {
      assert.equal(hashes.includes(hash),false);
      assert.equal(await store.getContact(hash),null);
      throw Object.assign(new Error('Synthetic continuity hold'),{code:'TEST_CONTINUITY_HOLD'});
    }},
  });
  for (const email of ['recovery@example.test','withdrawn@example.test']) {
    await assert.rejects(manager.requestOptIn({email}),{code:'TEST_CONTINUITY_HOLD'});
  }
  // Emit a boolean only; failed evidence comparisons must not print whole rows.
  assert.equal(JSON.stringify(await snapshot())===JSON.stringify(before),true);
});
