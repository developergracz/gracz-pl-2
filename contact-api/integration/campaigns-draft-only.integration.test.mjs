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
  const opened=await store.get(record.id);
  assert.deepEqual(opened,{
    id:record.id,subject:'Gry gracz.pl',body:'Witaj w nowych grach gracz.pl.',
    audience:'confirmed_active_new_only'
  });
  const changed=await store.update(record.id,{
    subject:'Nowości gracz.pl',body:'Nowa wersja wiadomości newslettera.',
    audience:'confirmed_active_new_only'
  });
  assert.deepEqual(changed,{id:record.id,state:'draft'});
  const reopened=await store.get(record.id);
  assert.equal(reopened.subject,'Nowości gracz.pl');
  assert.equal(reopened.body,'Nowa wersja wiadomości newslettera.');
  const approvalContent={
    subject:reopened.subject,body:reopened.body,audience:reopened.audience
  };
  // A stale review never changes the approved state.
  assert.equal(await store.approve(record.id,{
    ...approvalContent,body:'Wiadomość zmieniona pomiędzy podglądem i potwierdzeniem.'
  }),null);
  assert.deepEqual(await store.approve(record.id,approvalContent),{
    id:record.id,state:'approved',sendingEnabled:false
  });
  assert.equal(await store.approve(record.id,approvalContent),null);
  const approved=await store.listApproved();
  assert.equal(approved.length,1);
  assert.equal(approved[0].id,record.id);
  assert.equal(approved[0].sendingEnabled,false);
  assert.equal(await store.update(record.id,{
    subject:'Nie zmieniaj',body:'Próba zmiany zatwierdzonej kampanii.',
    audience:'confirmed_active_new_only'
  }),null);
  assert.equal(await store.get(record.id),null);
  await db.query("UPDATE newsletter_campaigns.campaigns "+
    "SET state='draft',approved_at=NULL WHERE id=$1",[record.id]);
  const persisted=await db.query('SELECT state,approved_at FROM newsletter_campaigns.campaigns WHERE id=$1',[record.id]);
  assert.equal(persisted.rows[0].state,'draft');
  assert.equal(persisted.rows[0].approved_at,null);
  const dispatch=await db.query("SELECT to_regclass('newsletter_campaigns.dispatches') AS existing");
  assert.equal(dispatch.rows[0].existing,null);
  await assert.rejects(db.query(sql));
});
