import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createSelfServiceWithdrawal} from '../persistence/recovery/self-service-withdrawal.mjs';

function fixture() {
  let challenge,delivery,providerEmail;
  const database={
    async transaction(work) {
      return work({
        async query(sql,params=[]) {
          if(sql.startsWith('SELECT 1 FROM newsletter_recovery.self_service_challenges'))
            return {rowCount:0,rows:[]};
          if(sql.includes('RETURNING accepted_count'))
            return {rowCount:1,rows:[{accepted_count:1}]};
          if(sql.startsWith('INSERT INTO newsletter_recovery.self_service_challenges')) {
            const [id,recipient_tag,token_tag,ciphertext,nonce,auth_tag]=params;
            if(ciphertext.length<16) {
              const e=new Error('self_service_challenges_ciphertext_check');
              e.code='23514';throw e; // mirror production CHECK
            }
            challenge={challenge_id:id,recipient_tag,token_tag,ciphertext,nonce,auth_tag};
            return {rowCount:1};
          }
          if(sql.startsWith('SELECT challenge_id,recipient_tag,token_tag,ciphertext'))
            return {rowCount:1,rows:[challenge]};
          if(sql.startsWith('SELECT 1 FROM newsletter_recovery.self_service_verified'))
            return {rowCount:0,rows:[]};
          return {rowCount:1,rows:[]};
        }
      });
    }
  };
  const withdrawal=createSelfServiceWithdrawal({
    database,
    recipientTagKey:randomBytes(32),
    challengeKey:randomBytes(32),
    encryptionKey:randomBytes(32),
    challengeMailer:{async sendChallenge(item){delivery=item;return true;}},
    providerOff:{
      async ensureOff(email){providerEmail=email;return {off:true};},
      async verifyOff(email){assert.equal(email,providerEmail);return {off:true};}
    }
  });
  return {withdrawal,get challenge(){return challenge;},get delivery(){return delivery;},
    get providerEmail(){return providerEmail;}};
}

for(const email of ['a@b.co','reader@example.com']) {
  test('withdrawal encrypted challenge supports '+(email.length<16?'short':'existing long')+' addresses',async()=>{
    const f=fixture();
    assert.deepEqual(await f.withdrawal.requestChallenge({email}),
      {state:'request_received',confirmed:false});
    assert.equal(f.delivery.email,email);
    assert.equal(f.challenge.ciphertext.length,Math.max(16,Buffer.byteLength(email)));
    assert.ok(!f.challenge.ciphertext.includes(Buffer.from(email)));
    assert.deepEqual(await f.withdrawal.confirmChallenge({
      challengeId:f.delivery.challengeId,token:f.delivery.token
    }),{state:'provider_off_verified',confirmed:false});
    assert.equal(f.providerEmail,email);
  });
}
