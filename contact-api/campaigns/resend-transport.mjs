import {classifyResendResult,classifyResendFailure} from './resend-result.mjs';

// Internal transport adapter. Not registered as an OWNER route or background job.
// Caller must commit the one-time dispatch claim AND verify an up-to-date opt-out
// link before invocation. Sending is gated off until approved release wiring.
export function createCampaignResendTransport({
  enabled=false, fetchFn=globalThis.fetch, apiKey, from,
}={}) {
  const ready=enabled===true && typeof fetchFn==='function' &&
    typeof apiKey==='string' && apiKey.length>8 &&
    typeof from==='string' && from.length>3;
  return Object.freeze({
    async sendOnce({dispatchId,to,subject,text,unsubscribeUrl}={}) {
      if(!ready) throw Object.assign(new Error('campaign_sending_disabled'),{code:'campaign_sending_disabled'});
      if(typeof dispatchId!=='string'||!/^[0-9a-f-]{36}$/i.test(dispatchId)||
        typeof to!=='string'||to.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||
        typeof subject!=='string'||subject.length<3||subject.length>160||
        /[\r\n]/.test(subject)||typeof text!=='string'||text.length<10||text.length>20000||
        typeof unsubscribeUrl!=='string'||!unsubscribeUrl.startsWith('https://gracz.pl/newsletter/')||
        /[\s\r\n]/.test(unsubscribeUrl))
        throw Object.assign(new Error('invalid_campaign_delivery'),{code:'invalid_campaign_delivery'});
      try {
        const response=await fetchFn('https://api.resend.com/emails',{
          method:'POST',
          headers:{
            Authorization:'Bearer '+apiKey,
            'Content-Type':'application/json',
            'Idempotency-Key':'gracz-campaign/'+dispatchId,
          },
          body:JSON.stringify({
            from,to:[to],subject,
            text:text+'\n\nWypisz się z newslettera: '+unsubscribeUrl,
            headers:{'List-Unsubscribe':'<'+unsubscribeUrl+'>'},
          }),
          signal:AbortSignal.timeout(10000),
        });
        let body=null;
        try {body=await response.json();} catch { /* unclear response */ }
        return classifyResendResult({status:response.status,body});
      } catch {
        return classifyResendFailure();
      }
    },
  });
}
