import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHmac} from 'node:crypto';
import {createNewOnlyAdminReader} from '../admin-r1/new-only-reader.mjs';
import {createNewOnlySummary} from '../admin-r1/summary.mjs';
import {createNewOnlyTrendDetail} from '../admin-r1/trend-detail.mjs';

const scopedJoin=/LEFT JOIN newsletter_new\.revocations r ON r\.email_tag=s\.email_tag\s+AND r\.recorded_at>=s\.requested_at/;

test('OWNER views use current consent, preserving a historical withdrawal',async()=>{
  const email='renewed@example.test';
  const encryptionKey=Buffer.alloc(32,7);
  const subjectKey=Buffer.alloc(32,8);
  const emailTag=createHmac('sha256',subjectKey)
    .update('gracz-new-only:email\n'+email).digest('hex');
  const nonce=Buffer.alloc(12,9);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey,nonce);
  cipher.setAAD(Buffer.from('gracz-newsletter-new:'+emailTag));
  const ciphertext=Buffer.concat([cipher.update(email,'utf8'),cipher.final()]);
  const row={
    email_tag:emailTag,ciphertext,nonce,auth_tag:cipher.getAuthTag(),
    state:'active',revoked:false,revoked_at:null,source:'newsletter_page',
    consent_version:'newsletter-new-only-2026-10-20',delivery_state:'sent',
    requested_at:new Date('2026-10-21T09:02:08Z'),
    confirmed_at:new Date('2026-10-21T09:04:00Z')
  };
  let verified=0;
  const db={queryBounded:async(sql)=>{
    if(sql.includes('LEFT JOIN newsletter_new.revocations r')){
      assert.match(sql,scopedJoin);
      verified++;
    }
    if(sql.includes('ORDER BY s.email_tag DESC LIMIT 101'))
      return {rows:[row]};
    if(sql.includes('WITH snap AS'))
      return {rows:[{...row,total24:'1',total2:'1'}]};
    if(sql.includes('SELECT s.state,s.confirmed_at,s.source,s.consent_version'))
      return {rows:[row]};
    if(sql.includes('FROM newsletter_new.consent_events WHERE email_tag'))
      return {rows:[
        {type:'opt_in_confirmed',at:row.confirmed_at,source:row.source,consent_version:row.consent_version},
        {type:'unsubscribed',at:new Date('2026-10-20T09:00:00Z'),source:null,consent_version:null}
      ]};
    throw Error('unexpected query');
  }};
  const reader=createNewOnlyAdminReader({database:db,encryptionKey,subjectKey});
  assert.equal((await reader.adapter.readPage()).items[0].state,'active');
  assert.equal((await reader.readRecent()).items[0].state,'active');
  const consent=await reader.readConsent(emailTag);
  assert.equal(consent.state,'subscribed');
  assert.deepEqual(consent.events.map(e=>e.type),['opt_in_confirmed','unsubscribed']);
  assert.equal(verified,3,'all three OWNER reads must scope revocation to the current request');

  for(const run of [
    ()=>createNewOnlySummary({database:{queryBounded:async(sql)=>{
      assert.match(sql,scopedJoin);throw Error('verified_summary');
    }}})(),
    ()=>createNewOnlyTrendDetail({database:{queryBounded:async(sql)=>{
      assert.match(sql,scopedJoin);throw Error('verified_trend');
    }}})({from:'2026-10-21',to:'2026-10-21'})
  ])await assert.rejects(run(),/verified_(summary|trend)/);
});
