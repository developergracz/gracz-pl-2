import {classifyResendFailure} from './resend-result.mjs';

// Internal only. No route or timer instantiates this module.
// Transactional claim MUST be durable before any request to the provider.
export function createCampaignDispatchCoordinator({
  enabled=false,claim,recordOutcome,transport
}={}) {
  const configured=enabled===true &&
    typeof claim==='function' && typeof recordOutcome==='function' &&
    typeof transport?.sendOnce==='function';
  return Object.freeze({
    async dispatch(delivery) {
      if(!configured) throw Object.assign(new Error('campaign_dispatch_disabled'),{
        code:'campaign_dispatch_disabled'
      });
      if(!delivery || typeof delivery!=='object' ||
         typeof delivery.dispatchId!=='string' ||
         typeof delivery.campaignId!=='string')
        throw Object.assign(new Error('invalid_dispatch'),{code:'invalid_dispatch'});
      // claim must commit a PostgreSQL reserved -> inflight transition,
      // rechecking active consent and withdrawal while holding row lock.
      const claimed=await claim({campaignId:delivery.campaignId,dispatchId:delivery.dispatchId});
      if(claimed!==true) return Object.freeze({state:'suppressed',retryAllowed:false});
      let result;
      try {
        result=await transport.sendOnce(delivery);
      } catch {
        result=classifyResendFailure();
      }
      // A record-outcome failure must NOT trigger a provider retry.
      await recordOutcome({
        campaignId:delivery.campaignId,dispatchId:delivery.dispatchId,
        accepted:result?.state==='accepted'
      });
      return result?.state==='accepted' ? result : classifyResendFailure();
    }
  });
}
