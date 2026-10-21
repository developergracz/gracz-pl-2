import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {checkWithdrawalProviderReadOnly} from '../operations/check-withdrawal-provider.mjs';

function fixture({off=true,badTag=false,number=1,providerFails=false}={}){
  const enc=randomBytes(32),tagKey=randomBytes(32);
  const email='synthetic@example.test',id=randomUUID(),nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',enc,nonce);
  cipher.setAAD(Buffer.from('gracz-withdrawal-recipient-v1\0'+id));
  const padded=Buffer.alloc(Math.max(16,Buffer.byteLength(email)));
  padded.write(email);
  const ciphertext=Buffer.concat([cipher.update(padded),cipher.final()]);
  const tag=createHmac('sha256',tagKey)
    .update('gracz-withdrawal-v1\0recipient\0'+email).digest('hex');
  const row={challenge_id:id,recipient_tag:badTag?'f'.repeat(64):tag,
    ciphertext,nonce,auth_tag:cipher.getAuthTag()};
  const calls=[];
  const config={
    database:{async queryBounded(sql,params,opts){
      calls.push({sql,params,opts});
      return {rows:Array.from({length:number},()=>row)};
    }},
    encryptionKey:enc.toString('base64url'),
    recipientTagKey:tagKey.toString('base64url'),
    providerApiKey:'synthetic-provider-key',
    providerFactory:()=>({
      async verifyOff(recipient){
        calls.push({recipientChecked:recipient});
        if(providerFails)throw new Error('private provider response');
        return {off};
      }
    })
  };
  return {config,calls};
}
test('one read-only SELECT and one read-only provider verification; prints no recipient',async()=>{
  const {config,calls}=fixture();
  assert.equal(await checkWithdrawalProviderReadOnly(config),'RESEND_OFF_CONFIRMED');
  assert.equal(calls.length,2);
  assert.match(calls[0].sql,/^\s*SELECT\b/i);
  assert.doesNotMatch(calls[0].sql,/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
  assert.match(calls[0].sql,/p\.challenge_id IS NULL/);
  assert.deepEqual(calls[0].params,[]);
  assert.deepEqual(calls[0].opts,{timeoutMs:3000});
  assert.equal(calls[1].recipientChecked,'synthetic@example.test');
});
test('provider explicitly not off remains blocked, not falsely confirmed',async()=>{
  const {config}=fixture({off:false});
  assert.equal(await checkWithdrawalProviderReadOnly(config),'RESEND_OFF_NOT_CONFIRMED');
});
test('missing and multiple unresolved rows, mismatched HMAC and provider failure fail closed',async()=>{
  for(const variation of [
    {number:0},{number:2},{badTag:true},{providerFails:true}
  ]){
    const {config}=fixture(variation);
    await assert.rejects(checkWithdrawalProviderReadOnly(config));
  }
});
test('keys and provider config must be valid and are never returned',async()=>{
  const {config}=fixture();
  for(const change of [
    {encryptionKey:''},
    {recipientTagKey:'bad'},
    {providerApiKey:''}
  ]) await assert.rejects(checkWithdrawalProviderReadOnly({...config,...change}));
});
