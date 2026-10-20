import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createCampaignDraftStore} from '../campaigns/draft-store.mjs';

test('manual OWNER draft-only schema stores drafts, lists headers and contains no dispatch',{timeout:30000},async t=>{
  const url=process.env.DATABASE_URL;
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  t.after(async()=>{
    try{await db.query('DROP SCHEMA IF EXISTS newsletter_campaigns CASCADE');}
    finally{await db.close();}
  });
  await db.query('DROP SCHEMA IF EXISTS newsletter_campaigns CASCADE');
  const sql=await readFile(new URL('../campaigns/draft-only-manual-r1.sql',import.meta.url),'utf8');
  await db.query(sql);
  const store=createCampaignDraftStore({database:db});
  const record=await store.save({subject:'Gry gracz.pl',body:'Witaj w nowych grach gracz.pl.',
    audience:'confirmed_active_new_only'});
  assert.equal(record.state,'draft');
  const rows=await store.list();
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,record.id);
  assert.equal(rows[0].subject,'Gry gracz.pl');
  const persisted=await db.query('SELECT state,approved_at FROM newsletter_campaigns.campaigns WHERE id=$1',[record.id]);
  assert.equal(persisted.rows[0].state,'draft');
  assert.equal(persisted.rows[0].approved_at,null);
  const dispatch=await db.query("SELECT to_regclass('newsletter_campaigns.dispatches') AS existing");
  assert.equal(dispatch.rows[0].existing,null);
  await assert.rejects(db.query(sql));
});
