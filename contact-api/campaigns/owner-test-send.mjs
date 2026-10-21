import {createHash,randomUUID} from 'node:crypto';
import {prepareCampaignDraft} from './prepare.mjs';
import {createCampaignResendTransport} from './resend-transport.mjs';

// A recipient-free, single-operator test-send workflow.
// No scheduled jobs, bulk recipient reads, campaign approval or live send controls.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPT_OUT='https://gracz.pl/newsletter/#nl-withdrawal-panel';
const MAX_TESTS_24H=5;
const deny=(code='campaign_test_send_unavailable')=>
  Object.assign(new Error(code),{code});
const safeUuid=id=>typeof id==='string'&&UUID.test(id);

export function createCampaignOwnerTestSender({
  database,enabled=false,apiKey,from,operatorAddress,
  checkWithdrawalReady,fetchFn=globalThis.fetch
}={}){
  if(typeof database?.transaction!=='function'||
     typeof database?.queryBounded!=='function')
    throw new TypeError('durable_database_required');
  const mailbox=typeof operatorAddress==='string'&&operatorAddress.length<=254&&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operatorAddress);
  const configured=enabled===true&&mailbox&&
    typeof checkWithdrawalReady==='function'&&
    typeof apiKey==='string'&&apiKey.length>8&&
    typeof from==='string'&&from.length>3;
  const transport=createCampaignResendTransport({
    enabled:configured,apiKey,from,fetchFn
  });

  async function available(){
    if(!configured)return false;
    try{
      if(await checkWithdrawalReady()!==true)return false;
      const r=await database.queryBounded(
        "SELECT to_regclass('newsletter_campaigns.test_attempts') IS NOT NULL "+
        "AND has_schema_privilege(current_user,'newsletter_campaigns','USAGE') "+
        "AND has_table_privilege(current_user,'newsletter_campaigns.campaigns','SELECT') "+
        "AND has_table_privilege(current_user,'newsletter_campaigns.test_attempts','SELECT,INSERT,UPDATE') AS ready",
        [],{timeoutMs:3000}
      );
      return r.rows?.length===1&&r.rows[0]?.ready===true;
    }catch{return false;}
  }
  async function sendTest(id){
    if(!safeUuid(id))throw deny('invalid_campaign_id');
    if(!await available())throw deny();
    // All checks and the irreversible test attempt reservation commit before
    // the FIRST outbound provider request; never retry after uncertain effects.
    const reservation=await database.transaction(async client=>{
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('gracz-campaign-test-v1',0))"
      );
      const draftRows=await client.query(
        "SELECT subject,body,audience FROM newsletter_campaigns.campaigns "+
        "WHERE id=$1 AND state='draft' FOR UPDATE",[id]);
      if(draftRows.rows?.length!==1)return {state:'not_found'};
      const draft=prepareCampaignDraft(draftRows.rows[0]);
      const digest=createHash('sha256')
        .update('gracz-owner-test-v1\0').update(draft.subject)
        .update('\0').update(draft.body).digest('hex');
      const existing=await client.query(
        "SELECT 1 FROM newsletter_campaigns.test_attempts "+
        "WHERE campaign_id=$1 AND content_sha256=$2",[id,digest]);
      if(existing.rows?.length)return {state:'already_attempted'};
      const count=await client.query(
        "SELECT count(*)::text AS attempts FROM newsletter_campaigns.test_attempts "+
        "WHERE created_at>clock_timestamp()-interval '24 hours'");
      const number=count.rows?.[0]?.attempts;
      if(typeof number!=='string'||!/^(0|[1-9][0-9]*)$/.test(number))
        throw deny();
      if(BigInt(number)>=BigInt(MAX_TESTS_24H))return {state:'limit_reached'};
      const attemptId=randomUUID();
      const inserted=await client.query(
        "INSERT INTO newsletter_campaigns.test_attempts "+
        "(id,campaign_id,content_sha256,state) "+
        "VALUES($1,$2,$3,'inflight') ON CONFLICT DO NOTHING RETURNING id",
        [attemptId,id,digest]
      );
      if(inserted.rowCount!==1)return {state:'already_attempted'};
      return {state:'reserved',attemptId,draft};
    });
    if(reservation.state!=='reserved')return Object.freeze({
      state:reservation.state,retryAllowed:false
    });
    let result;
    try{
      result=await transport.sendOnce({
        dispatchId:reservation.attemptId,to:operatorAddress,
        subject:'[TEST] '+reservation.draft.subject.slice(0,153),
        text:reservation.draft.body,unsubscribeUrl:OPT_OUT
      });
    }catch{result={state:'uncertain'};}
    const accepted=result?.state==='accepted';
    try{
      await database.transaction(async client=>{
        const outcome=await client.query(
          "UPDATE newsletter_campaigns.test_attempts "+
          "SET state=$1,provider_message_id=$2 "+
          "WHERE id=$3 AND state='inflight'",
          [accepted?'accepted':'uncertain',
            accepted?result.providerMessageId:null,reservation.attemptId]
        );
        if(outcome.rowCount!==1)throw deny();
      });
    }catch{
      // The durable initial record is still inflight: NEVER send again.
      return Object.freeze({state:'uncertain',retryAllowed:false});
    }
    return Object.freeze({
      state:accepted?'accepted':'uncertain',retryAllowed:false
    });
  }
  return Object.freeze({available,sendTest});
}
