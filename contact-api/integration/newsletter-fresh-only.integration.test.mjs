import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {createFreshNewsletter} from '../persistence/fresh-newsletter.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';

const url=process.env.DATABASE_URL;
const schemaSql=await readFile(new URL('../persistence/candidates/001_fresh_only_consents.sql',import.meta.url),'utf8');

test('fresh opt-in schema: real PostgreSQL16/18, short address, proof, immutable consent and no duplicate mail',
  {timeout:30000},async t=>{
    assertDisposableDatabaseUrl(url);
    const db=createDatabase({connectionString:url});
    t.after(async()=>{await db.query('DROP SCHEMA IF EXISTS newsletter_fresh CASCADE');await db.close();});
    await db.query('DROP SCHEMA IF EXISTS newsletter_fresh CASCADE');
    await db.query(schemaSql);
    let sent=null,mailCount=0,providerCount=0;
    const manager=createFreshNewsletter({
      database:db,rootKey:randomBytes(32),
      mailer:{async send(item){sent=item;mailCount++;return true;}},
      provider:{
        async isEligible(){return true;},
        async enroll(email){assert.equal(email,'a@b.co');providerCount++;return true;}
      }
    });
    assert.equal(await manager.readiness(),true);
    assert.deepEqual(await manager.request({email:'a@b.co'}),{state:'request_received'});
    assert.ok(sent?.token);
    assert.equal(mailCount,1);
    const row=(await db.query('SELECT ciphertext,nonce,auth_tag,mail_state FROM newsletter_fresh.challenges')).rows[0];
    assert.equal(row.ciphertext.length,'a@b.co'.length);
    assert.equal(row.nonce.length,12);
    assert.equal(row.auth_tag.length,16);
    assert.equal(row.mail_state,'sent');
    assert.deepEqual(await manager.confirm({id:sent.id,token:sent.token}),
      {state:'subscribed',confirmed:true});
    assert.equal(providerCount,1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_fresh.consent_events')).rows[0].n,1);
    assert.equal((await db.query("SELECT state FROM newsletter_fresh.provider_intents")).rows[0].state,'active');
    await assert.rejects(manager.confirm({id:sent.id,token:sent.token}),{code:'FRESH_PROOF_REJECTED'});
    await manager.request({email:'a@b.co'});
    assert.equal(mailCount,1);
    await assert.rejects(db.query('DELETE FROM newsletter_fresh.consent_events'),{code:'P0001'});
    await assert.rejects(db.query('TRUNCATE newsletter_fresh.consent_events'),{code:'P0001'});
  });
