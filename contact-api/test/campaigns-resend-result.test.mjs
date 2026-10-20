import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyResendResult,classifyResendFailure} from '../campaigns/resend-result.mjs';
test('only provider acceptance with message id is accepted',()=>{
  assert.deepEqual(classifyResendResult({status:200,body:{id:'abcDEFghi123'}}),{
    state:'accepted',providerMessageId:'abcDEFghi123',retryAllowed:false
  });
});
test('all ambiguous, failure and malformed results stay uncertain and not retryable',()=>{
  for(const data of [
    {},{status:200,body:{}},{status:200,body:{id:''}},
    {status:202,body:null},{status:400,body:{id:'abcDEFghi123'}},
    {status:500,body:{id:'abcDEFghi123'}},{status:200,body:{id:'bad\nvalue0000'}}
  ]){
    const r=classifyResendResult(data);
    assert.equal(r.state,'uncertain');
    assert.equal(r.retryAllowed,false);
  }
  assert.deepEqual(classifyResendFailure(),{
    state:'uncertain',providerMessageId:null,retryAllowed:false
  });
});
