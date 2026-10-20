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
