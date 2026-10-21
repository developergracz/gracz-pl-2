import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {reconcileOneProviderWithdrawal} from '../operations/reconcile-withdrawal-provider.mjs';
import {WITHDRAWAL_EGRESS_LOCK} from '../persistence/recovery/withdrawal-send-fence.mjs';

function fixture({pending=1,providerOff=true,readback=true,
  providerError=false,insertFails=false,badTag=false}={}){
  const encryptionKey=randomBytes(32),recipientTagKey=randomBytes(32);
  const address='synthetic@example.test',id=randomUUID(),nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey,nonce);
  cipher.setAAD(Buffer.from('gracz-withdrawal-recipient-v1\0'+id));
  const plaintext=Buffer.alloc(Math.max(16,Buffer.byteLength(address)));
  plaintext.write(address);
  const row={
    challenge_id:id,nonce,
    ciphertext:Buffer.concat([cipher.update(plaintext),cipher.final()]),
    auth_tag:cipher.getAuthTag(),
    recipient_tag:createHmac('sha256',recipientTagKey)
      .update('gracz-withdrawal-v1\0recipient\0'+address).digest('hex')
  };
  if(badTag)row.recipient_tag='f'.repeat(64);
  const trace=[];
  const database={
    transaction:async callback=>{
      trace.push('begin');
      const res=await callback({query:async(sql,params=[])=>{
        if(sql.includes('pg_advisory_xact_lock')){
          assert.deepEqual(params,WITHDRAWAL_EGRESS_LOCK);
          trace.push('lock');
          return {rowCount:1};
        }
        if(sql.includes('SELECT c.challenge_id')){
          trace.push('select');
          assert.match(sql,/self_service_provider_intents/);
          assert.match(sql,/self_service_provider_verified/);
          assert.match(sql,/FOR UPDATE OF v/);
          return {rows:Array.from({length:pending},()=>row)};
        }
        if(sql.includes('INSERT INTO newsletter_recovery.self_service_provider_verified')){
          trace.push('insert');
          assert.deepEqual(params,[id]);
          if(insertFails)throw Error('private db error');
          return {rowCount:1};
        }
        assert.fail('Unexpected SQL');
      }});
      trace.push('commit');
      return res;
    }
  };
  const params={
    database,encryptionKey:encryptionKey.toString('base64url'),
    recipientTagKey:recipientTagKey.toString('base64url'),
    providerApiKey:'synthetic-provider-key',
    providerFactory:()=>({
      async ensureOff(email){
        assert.equal(email,address);
        trace.push('ensure');
        if(providerError)throw Error('private provider error');
        return {off:providerOff};
      },
      async verifyOff(email){
        assert.equal(email,address);
        trace.push('verify');
        return {off:readback};
      }
    })
  };
  return {params,trace};
}

test('one confirmed withdrawal is suppressed then verified and durably recorded under exclusive lock',async()=>{
  const {params,trace}=fixture();
  assert.deepEqual(await reconcileOneProviderWithdrawal(params),
    {state:'PROVIDER_OFF_VERIFIED_AND_RECORDED'});
  assert.deepEqual(trace,['begin','lock','select','ensure','verify','insert','commit']);
});
test('no pending records causes no provider mutation or DB insert',async()=>{
  const {params,trace}=fixture({pending:0});
  assert.deepEqual(await reconcileOneProviderWithdrawal(params),
    {state:'NO_PENDING_CONFIRMATION'});
  assert.deepEqual(trace,['begin','lock','select','commit']);
});
test('multiple records and mismatched evidence deny provider access',async()=>{
  for(const opts of [{pending:2},{badTag:true}]){
    const {params,trace}=fixture(opts);
    await assert.rejects(reconcileOneProviderWithdrawal(params));
    assert.equal(trace.includes('ensure'),false);
    assert.equal(trace.includes('insert'),false);
  }
});
test('uncertain provider result or failed insert never claims reconciliation',async()=>{
  for(const opts of [
    {providerError:true},{providerOff:false},{readback:false},{insertFails:true}
  ]){
    const {params,trace}=fixture(opts);
    await assert.rejects(reconcileOneProviderWithdrawal(params));
    if(!opts.insertFails)assert.equal(trace.includes('insert'),false);
  }
});
test('requires configured database and provider',async()=>{
  await assert.rejects(reconcileOneProviderWithdrawal({}),/WITHDRAWAL_RECONCILIATION_UNAVAILABLE/);
});
