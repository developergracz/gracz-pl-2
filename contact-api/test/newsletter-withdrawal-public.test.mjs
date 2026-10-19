import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsletterWithdrawalRoute} from '../routes/newsletter-withdrawal-route.mjs';
import {createWithdrawalChallengeMailer} from '../persistence/recovery/withdrawal-challenge-mailer.mjs';
import {randomUUID} from 'node:crypto';

function harness({enabled=true}={}) {
  const calls=[],limits=[],sends=[];
  const withdrawal={
    async requestChallenge(payload){calls.push(['request',payload]);return {state:'request_received'};},
    async confirmChallenge(payload){calls.push(['confirm',payload]);return {state:'provider_off_verified',confirmed:false};}
  };
  const route=createNewsletterWithdrawalRoute({
    allowedOrigins:new Set(['https://gracz.pl']),
    withdrawal:enabled?withdrawal:null,
    checkReady:async()=>enabled,ipBuckets:new Map(),
    rateLimit:(_b,_k,_ms,limit)=>limits.push(limit),
    hashValue:value=>value,clientIp:()=> '127.0.0.1',
    readJson:async req=>req.body,
    json:(_res,status,body)=>{sends.push({status,body});return body;},
    setCors:()=>{},normalizeEmail:email=>email
  });
  const request=async(method,path,body,origin='https://gracz.pl')=>{
    const req={method,body,headers:{origin}};
    await route(req,{},new URL('https://api.example.test'+path));
    return sends.at(-1);
  };
  return {request,calls,limits};
}
test('#283 public recipient route is disabled by default; never activates subscribe',async()=>{
  const h=harness({enabled:false});
  const ready=await h.request('GET','/newsletter/withdrawal-ready');
  assert.deepEqual(ready,{status:503,body:{ready:false,configured:false,withdrawalOnly:true,newsletterIntakeEnabled:false}});
  assert.equal((await h.request('POST','/newsletter/withdrawal-request',{email:'x@example.test'})).status,503);
  assert.equal(h.calls.length,0);
});
test('#283 verified withdrawal request has neutral response, strict origin and bounded use',async()=>{
  const h=harness();
  assert.equal((await h.request('POST','/newsletter/withdrawal-request',{email:'ok@example.test'},'https://evil.example.test')).status,403);
  assert.equal(h.calls.length,0);
  const neutral=await h.request('POST','/newsletter/withdrawal-request',{email:'ok@example.test'});
  assert.deepEqual(neutral,{status:200,body:{ok:true,state:'request_received'}});
  assert.deepEqual(h.calls,[['request',{email:'ok@example.test'}]]);
  assert.equal((await h.request('POST','/newsletter/withdrawal-confirm',{
    challengeId:randomUUID(),token:'invalid'
  })).status,400);
  assert.equal(h.calls.length,1);
  const challengeId=randomUUID(),token='a'.repeat(43);
  const result=await h.request('POST','/newsletter/withdrawal-confirm',{challengeId,token});
  assert.deepEqual(result,{status:200,body:{ok:true,state:'provider_off_verified',confirmed:false}});
  assert.equal(h.calls.length,2);
  assert.deepEqual(h.limits,[8,25]);
});
test('#283 proof-only Resend transport sends a short-lived fragment link, not marketing or query secret',async()=>{
  let outbound;
  const mailer=createWithdrawalChallengeMailer({
    apiKey:'synthetic-resend-api-key',emailFrom:'gracz.pl <kontakt@gracz.pl>',
    request:async(url,options)=>{
      outbound={url,options};
      return {status:200,json:async()=>({id:'synthetic-provider-id'})};
    }
  });
  const id=randomUUID(),token='a'.repeat(43);
  assert.equal(await mailer.sendChallenge({
    challengeId:id,token,email:'synthetic@example.test'
  }),true);
  assert.equal(outbound.url,'https://api.resend.com/emails');
  const body=JSON.parse(outbound.options.body);
  assert.equal(body.to[0],'synthetic@example.test');
  assert.equal(body.text.includes('/newsletter/?'),false);
  assert.equal(body.text.includes('/newsletter/#withdrawal='+id+'.'+token),true);
  assert.equal(outbound.options.headers['Idempotency-Key'],'gracz-withdrawal-'+id);
  assert.equal(body.subject.includes('wypisanie'),true);
});
