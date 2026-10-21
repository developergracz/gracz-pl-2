import {prepareCampaignDraft} from './prepare.mjs';
import {createCampaignPgDispatchStore} from './pg-dispatch-store.mjs';
import {createCampaignDispatchCoordinator} from './dispatch-coordinator.mjs';
import {createCampaignRecipientEvidenceReview} from './recipient-evidence-review.mjs';
import {createCampaignResendTransport} from './resend-transport.mjs';
import {createWithdrawalSendFence} from '../persistence/recovery/withdrawal-send-fence.mjs';

const deny=()=>Object.assign(new Error('campaign_send_unavailable'),{code:'campaign_send_unavailable'});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Only an explicit OWNER request invokes this. No jobs, timers or automatic retry.
export function createCampaignOwnerSender({database,enabled=false,
  newEncryptionKey,newSubjectKey,withdrawalRecipientTagKey,
  apiKey,from,checkWithdrawalReady,fetchFn=globalThis.fetch
}={}){
  let review=null;
  if(enabled===true){
    try{review=createCampaignRecipientEvidenceReview({database,
      newEncryptionKey,newSubjectKey,withdrawalRecipientTagKey});}catch{}
  }
  const configured=enabled===true&&review!==null&&
    typeof checkWithdrawalReady==='function'&&typeof apiKey==='string'&&
    apiKey.length>8&&typeof from==='string'&&from.length>3;
  const store=createCampaignPgDispatchStore({database});
  const fence=createWithdrawalSendFence(database);
  const transport=createCampaignResendTransport({enabled:configured,apiKey,from,fetchFn});
  async function available(){
    if(!configured)return false;
    try{
      if(await checkWithdrawalReady()!==true||await fence.checkAvailable()!==true)return false;
      const ready=await database.queryBounded(
        "SELECT has_table_privilege(current_user,'newsletter_campaigns.dispatches','SELECT,INSERT,UPDATE') "+
        "AND has_table_privilege(current_user,'newsletter_campaigns.dispatch_events','INSERT') "+
        "AND has_function_privilege(current_user,'newsletter_campaigns.reserve_confirmed(uuid,uuid,uuid,character)','EXECUTE') "+
        "AND has_function_privilege(current_user,'newsletter_campaigns.claim_delivery(uuid,uuid,uuid)','EXECUTE') "+
        "AND has_function_privilege(current_user,'newsletter_campaigns.record_delivery_result(uuid,uuid,uuid,boolean)','EXECUTE') AS ready",
        [],{timeoutMs:3000});
      return ready.rows?.length===1&&ready.rows[0].ready===true;
    }catch{return false;}
  }
  async function send(campaignId){
    if(typeof campaignId!=='string'||!UUID.test(campaignId)||!await available())throw deny();
    const rows=await database.queryBounded(
      "SELECT subject,body,audience FROM newsletter_campaigns.campaigns WHERE id=$1 AND state='approved'",
      [campaignId],{timeoutMs:3000});
    if(rows.rows?.length!==1)throw deny();
    const draft=prepareCampaignDraft(rows.rows[0]);
    let after='',accepted=0,suppressed=0;
    // Keyset pages bound memory. A dropped response/restart never releases claims.
    for(;;){
      const candidates=await database.queryBounded(
        "SELECT s.email_tag FROM newsletter_new.subscribers s WHERE s.email_tag>$1 AND s.state='active' "+
        "AND NOT EXISTS(SELECT 1 FROM newsletter_campaigns.dispatches d WHERE d.campaign_id=$2 AND d.email_tag=s.email_tag) "+
        "ORDER BY s.email_tag LIMIT 100",[after,campaignId],{timeoutMs:3000});
      if(!Array.isArray(candidates.rows))throw deny();
      if(!candidates.rows.length)break;
      for(const {email_tag:emailTag} of candidates.rows){
        after=emailTag;
        const to=await review.resolveRecipient(emailTag);
        if(!to){suppressed++;continue;}
        const dispatchId=await store.reserve({campaignId,emailTag});
        if(!dispatchId){suppressed++;continue;}
        let currentReview;
        const coordinator=createCampaignDispatchCoordinator({enabled:true,
          claim:store.claim,transport,
          recordOutcome:async outcome=>{
            if(await store.recordOutcome(outcome)!==true)throw deny();
          },
          reviewRecipient:(tag,address)=>currentReview(tag,address),
          withSendPermit:effect=>fence.withSendPermit(async client=>{
            // Reuse the fence transaction: even a one-connection pool works.
            await client.query("SET LOCAL statement_timeout='3000ms'");
            const readDatabase={queryBounded:(sql,params)=>client.query(sql,params)};
            currentReview=createCampaignRecipientEvidenceReview({database:readDatabase,
              newEncryptionKey,newSubjectKey,withdrawalRecipientTagKey});
            // Keep content/state and recipient stable throughout fresh review + HTTP.
            const current=await client.query(
              "SELECT 1 FROM newsletter_campaigns.campaigns WHERE id=$1 AND state='approved' "+
              'AND subject=$2 AND body=$3 AND audience=$4 FOR SHARE',
              [campaignId,draft.subject,draft.body,draft.audience]);
            if(current.rowCount!==1)throw deny();
            const recipient=await client.query(
              'SELECT 1 FROM newsletter_new.subscribers WHERE email_tag=$1 FOR UPDATE',[emailTag]);
            if(recipient.rowCount!==1||await checkWithdrawalReady(readDatabase)!==true)throw deny();
            return effect();
          })
        });
        let result;
        try{result=await coordinator.dispatch({campaignId,dispatchId,emailTag,to,
          subject:draft.subject,text:draft.body,
          unsubscribeUrl:'https://gracz.pl/newsletter/#nl-withdrawal-panel'});}
        catch{return {state:'uncertain',accepted,suppressed,retryAllowed:false};}
        if(result.state==='accepted')accepted++;
        else if(result.state==='suppressed')suppressed++;
        else return {state:'uncertain',accepted,suppressed,retryAllowed:false};
      }
    }
    // No recipient identifiers, content or provider response leaves this adapter.
    return {state:'finished',accepted,suppressed,retryAllowed:false};
  }
  return Object.freeze({available,send});
}
