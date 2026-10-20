import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../campaigns/schema-r1.sql',import.meta.url),'utf8');
test('campaign schema cannot send without approval or duplicate recipient',()=>{
  assert.match(sql,/CHECK \(audience = 'confirmed_active_new_only'\)/);
  assert.match(sql,/UNIQUE \(campaign_id,email_tag\)/);
  assert.match(sql,/approved_at IS NOT NULL/);
  assert.match(sql,/uncertain/);
  assert.match(sql,/REVOKE ALL ON SCHEMA newsletter_campaigns FROM PUBLIC/);
});
test('no production schema migration in draft',()=>{
  assert.match(sql,/NOT wired to automatic production migrations/);
});

test('dispatch audit is append-only and tied to one campaign recipient',()=>{
  assert.match(sql,/UNIQUE \(campaign_id,id\)/);
  assert.match(sql,/FOREIGN KEY \(campaign_id,dispatch_id\)/);
  assert.match(sql,/BEFORE UPDATE OR DELETE OR TRUNCATE ON newsletter_campaigns\.dispatch_events/);
  assert.match(sql,/REVOKE UPDATE,DELETE,TRUNCATE ON newsletter_campaigns\.dispatch_events FROM PUBLIC/);
});

test('reservation uses confirmed consent, excludes withdrawals, and is atomic',()=>{
  assert.match(sql,/CREATE FUNCTION newsletter_campaigns\.reserve_confirmed/);
  assert.match(sql,/s\.state='active'/);
  assert.match(sql,/e\.event_type='opt_in_confirmed'/);
  assert.match(sql,/NOT EXISTS \(\s*SELECT 1 FROM newsletter_new\.revocations/);
  assert.match(sql,/ON CONFLICT \(campaign_id,email_tag\) DO NOTHING/);
  assert.match(sql,/INSERT INTO newsletter_campaigns\.dispatch_events/);
  assert.match(sql,/REVOKE ALL ON FUNCTION newsletter_campaigns\.reserve_confirmed/);
});

test('pre-send transition serializes withdrawal, checks DOI again and cannot retry',()=>{
  assert.match(sql,/CREATE FUNCTION newsletter_campaigns\.claim_delivery/);
  assert.match(sql,/WHERE s\.email_tag=v_tag FOR UPDATE/);
  assert.match(sql,/NOT EXISTS \(\s*SELECT 1 FROM newsletter_new\.revocations/);
  assert.match(sql,/AND state='reserved'/);
  assert.match(sql,/SET state='inflight', attempted_at=clock_timestamp\(\)/);
  assert.match(sql,/SET state='suppressed'/);
  assert.match(sql,/REVOKE ALL ON FUNCTION newsletter_campaigns\.claim_delivery/);
});

test('delivery outcomes transition once from inflight and never reopen a send',()=>{
  assert.match(sql,/CREATE FUNCTION newsletter_campaigns\.record_delivery_result/);
  assert.match(sql,/WHERE id=p_dispatch AND campaign_id=p_campaign AND state='inflight'/);
  assert.match(sql,/CASE WHEN p_accepted THEN 'accepted' ELSE 'uncertain' END/);
  assert.match(sql,/REVOKE ALL ON FUNCTION newsletter_campaigns\.record_delivery_result/);
});
