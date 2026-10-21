import {classifyResendFailure} from './resend-result.mjs';

// Private, OFF-by-default adapter. A proof-only DOI review is NOT a send
// permit. A send attempt requires all of:
// 1) durable once-only claim, 2) existing global withdrawal send fence,
// 3) freshly verified matching recipient and current DOI within that fence.
// No public route, background task or campaign approval is installed here.
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const denied=Object.freeze({state:'suppressed',retryAllowed:false});

export function createCampaignDispatchCoordinator({
  enabled=false,claim,recordOutcome,transport,
  withSendPermit,reviewRecipient
}={}) {
  const configured=enabled===true &&
    typeof claim==='function' && typeof recordOutcome==='function' &&
    typeof withSendPermit==='function' &&
    typeof reviewRecipient==='function' &&
    typeof transport?.sendOnce==='function';
  return Object.freeze({
    async dispatch(delivery) {
      if(!configured) throw Object.assign(new Error('campaign_dispatch_disabled'),{
        code:'campaign_dispatch_disabled'
      });
      if(!delivery || typeof delivery!=='object' ||
         typeof delivery.dispatchId!=='string'||!UUID.test(delivery.dispatchId)||
         typeof delivery.campaignId!=='string'||!UUID.test(delivery.campaignId)||
         typeof delivery.emailTag!=='string'||!HEX64.test(delivery.emailTag)||
         typeof delivery.to!=='string'||delivery.to.length>254||
         delivery.to!==delivery.to.trim().toLowerCase()||!MAIL.test(delivery.to))
        throw Object.assign(new Error('invalid_dispatch'),{code:'invalid_dispatch'});
      // An attempted claim is irrevocable. Do not retry even if a later guard
      // says NO: the monotonic ledger records that non-acceptance as uncertain.
      const claimed=await claim({
        campaignId:delivery.campaignId,dispatchId:delivery.dispatchId
      });
      if(claimed!==true)return denied;

      let result=classifyResendFailure();
      try{
        result=await withSendPermit(async()=>{
          // A global shared lock remains held while fresh evidence is checked
          // and while the external Resend request is made. Withdrawals acquire
          // the matching exclusive lock. Old unresolved requests still deny.
          const proof=await reviewRecipient(delivery.emailTag,delivery.to);
          if(proof?.state!=='evidence_complete_for_review'||
             proof?.recipientMatched!==true||
             proof?.advisoryOnly!==true||proof?.maySend!==false)
            return denied;
          return transport.sendOnce(delivery);
        });
      }catch{
        // Unknown provider or fence outcome means no automatic replay.
        result=classifyResendFailure();
      }
      // Always persist a one-way result after claiming. A failure to record
      // must never trigger a new provider request.
      await recordOutcome({
        campaignId:delivery.campaignId,dispatchId:delivery.dispatchId,
        accepted:result?.state==='accepted'
      });
      return result?.state==='accepted'?result:
        result?.state==='suppressed'?denied:classifyResendFailure();
    }
  });
}
