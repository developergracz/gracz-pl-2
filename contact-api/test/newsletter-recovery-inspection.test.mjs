import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsletterOptInStore} from '../persistence/newsletter-opt-in-store.mjs';

test('recovery inspector accepts only exact HMAC identifiers and performs SELECT only',async()=>{
  const calls=[];
  const row={request_id:'00000000-0000-4000-8000-000000000001',state:'unknown',issued_at:new Date(0),expires_at:new Date(1),sent_at:null};
  const store=createNewsletterOptInStore({query:async(sql,args)=>{calls.push({sql,args});return {rows:[row]};}});
  for(const value of [null,'email@example.test','a'.repeat(63),'A'.repeat(64),"' OR 1=1 --"]){
    await assert.rejects(()=>store.inspectOptInRequest(value),TypeError);
  }
  assert.equal(calls.length,0);
  const result=await store.inspectOptInRequest('a'.repeat(64));
  assert.deepEqual(result,{requestId:row.request_id,state:'unknown',issuedAt:row.issued_at,expiresAt:row.expires_at,sentAt:null});
  assert.equal(calls.length,1);
  assert.match(calls[0].sql,/^SELECT /);
  assert.doesNotMatch(calls[0].sql,/\b(UPDATE|DELETE|INSERT|CREATE|ALTER)\b/i);
  assert.deepEqual(calls[0].args,['a'.repeat(64)]);
  assert.ok(!JSON.stringify(result).includes('a'.repeat(64)));
});
