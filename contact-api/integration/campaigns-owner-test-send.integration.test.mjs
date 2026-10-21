import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createCampaignDraftStore} from '../campaigns/draft-store.mjs';
import {createCampaignOwnerTestSender} from '../campaigns/owner-test-send.mjs';

test('durable OWNER test attempt is unique per saved draft revision, even across restarts',
  {timeout:30000},async t=>{
    const url=process.env.DATABASE_URL;
    assertDisposableDatabaseUrl(url);
    const database=createDatabase({connectionString:url});
    t.after(async()=>{
      try{await database.query('DROP SCHEMA IF EXISTS newsletter_campaigns CASCADE');}
      finally{await database.close();}
    });
    await database.query('DROP SCHEMA IF EXISTS newsletter_campaigns CASCADE');
    for(const script of ['draft-only-manual-r1.sql','test-send-manual-r1.sql']){
      const sql=await readFile(new URL('../campaigns/'+script,import.meta.url),'utf8');
      await database.query(sql);
    }
    const drafts=createCampaignDraftStore({database});
    const {id}=await drafts.save({
      subject:'Gry gracz.pl',body:'Test tylko dla operatora gracz.pl.',
      audience:'confirmed_active_new_only'
    });
    let outbound=0;
    const config={
      database,enabled:true,apiKey:Array(16).fill('x').join(''),
      from:'gracz.pl <newsletter@gracz.pl>',
      operatorAddress:'operator@example.com',
      checkWithdrawalReady:async()=>true,
      fetchFn:async()=>{outbound++;return {
        status:201,json:async()=>({id:'test_resend_message_1234'})
      };}
    };
    // The separate instance simulates another process after Render restarts.
    const first=createCampaignOwnerTestSender(config);
    assert.equal(await first.available(),true);
    assert.equal((await first.sendTest(id)).state,'accepted');
    assert.equal((await createCampaignOwnerTestSender(config).sendTest(id)).state,'already_attempted');
    assert.equal(outbound,1);
    const attempts=await database.query(
      'SELECT state,content_sha256,provider_message_id FROM newsletter_campaigns.test_attempts');
    assert.equal(attempts.rows.length,1);
    assert.equal(attempts.rows[0].state,'accepted');
    assert.match(attempts.rows[0].content_sha256,/^[0-9a-f]{64}$/);
    assert.equal(attempts.rows[0].provider_message_id,'test_resend_message_1234');
    const revised=await drafts.update(id,{
      subject:'Gry gracz.pl',body:'Zmieniona wersja testowa newslettera gracz.pl.',
      audience:'confirmed_active_new_only'
    });
    assert.equal(revised.state,'draft');
    assert.equal((await first.sendTest(id)).state,'accepted');
    assert.equal(outbound,2);
    const stored=await database.query(
      'SELECT count(*)::int AS attempts FROM newsletter_campaigns.test_attempts');
    assert.equal(stored.rows[0].attempts,2);
    // No real recipient table or dispatch table created by the test migration.
    const dispatch=await database.query(
      "SELECT to_regclass('newsletter_campaigns.dispatches') AS present");
    assert.equal(dispatch.rows[0].present,null);
  });
