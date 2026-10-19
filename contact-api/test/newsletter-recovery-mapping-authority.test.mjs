import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createWithdrawalEvidenceVerifier} from '../persistence/recovery/withdrawal-evidence.mjs';
import {createLegacyMappingAuthority} from '../persistence/recovery/legacy-mapping-authority.mjs';
import {legacySubjectRefFromHash} from '../persistence/recovery/verified-recipient-mapping.mjs';
const mailboxKeys=generateKeyPairSync('ed25519'),mappingKeys=generateKeyPairSync('ed25519');
const email='synthetic@example.test',requestId=randomUUID(),epoch=1_800_000_000_000;
const issuerM='https://mbx.synthetic.example.test',issuerL='https://map.synthetic.example.test';
const oldSecret=Buffer.from('escrow-only-synthetic-fixture-'.repeat(3)),tagKey=Buffer.alloc(32,0x13);
const mailboxTag=createHmac('sha256',tagKey).update(
  'gracz-newsletter-recovery-mailbox-v1\0'+email).digest('hex');
const emailHash=createHmac('sha256',createHash('sha256')
  .update('newsletter-consent-subject:').update(oldSecret).digest())
  .update(email).digest('hex');
const mailbox={issuer:issuerM,audience:'mailbox-private',keyId:'test-mbx',
  publicKeyPem:mailboxKeys.publicKey.export({format:'pem',type:'spki'})};
const mapping={issuer:issuerL,audience:'mapping-private',keyId:'test-map',
  publicKeyPem:mappingKeys.publicKey.export({format:'pem',type:'spki'})};
const verifier=createWithdrawalEvidenceVerifier({mailbox,mapping,now:()=>epoch});
function mailboxToken(tag=mailboxTag){
  const h=Buffer.from(JSON.stringify({alg:'EdDSA',typ:'JWT',kid:mailbox.keyId})).toString('base64url');
  const claims={iss:issuerM,aud:mailbox.audience,purpose:'MAILBOX',request_id:requestId,
    mailbox_tag:tag,method:'independent_mailbox_challenge',
    challenge_ref:randomUUID(),jti:randomUUID(),
    iat:Math.floor(epoch/1000)-5,exp:Math.floor(epoch/1000)+180};
  const p=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const input=h+'.'+p;
  return input+'.'+sign(null,Buffer.from(input),mailboxKeys.privateKey).toString('base64url');
}
function build({subjects=1,events=1,f03=true,providerFault=false}={}){
  const db={query:async(_sql,params)=>{
    assert.deepEqual(params,[emailHash]);
    return {rowCount:1,rows:[{subjects,events,f03}]};
  }};
  const off={verifyOff:async()=>{
    if(providerFault)throw new Error('synthetic provider offline');
    return {off:false};
  }};
  const authority=createLegacyMappingAuthority({
    database:db,mailboxEvidenceVerifier:verifier,providerOff:off,
    legacyConsentSecret:oldSecret,escrowConsentSecret:oldSecret,
    mailboxTagKey:tagKey,signingPrivateKeyPem:mappingKeys.privateKey.export({format:'pem',type:'pkcs8'}),
    pinnedPublicKeyPem:mapping.publicKeyPem,issuer:issuerL,
    audience:mapping.audience,keyId:mapping.keyId,now:()=>epoch
  });
  return authority;
}
test('#282 historical mapping signer produces a second independent verified proof only from a valid mailbox token',async()=>{
  const mailboxProof=mailboxToken();
  const mappingProof=await build().issueProof({requestId,email,mailboxToken:mailboxProof});
  const result=verifier.verifyPair({mailboxToken:mailboxProof,
    mappingToken:mappingProof,expectedRequestId:requestId});
  assert.equal(result.legacySubjectRef,legacySubjectRefFromHash(emailHash));
  assert.equal(result.mailboxTag,mailboxTag);
  assert.equal(result.requestId,requestId);
});
test('#282 mapping proof refuses forged mailbox, absent history, missing F03 and uncertain provider',async()=>{
  for(const c of [{subjects:0},{events:0},{f03:false},{providerFault:true}]){
    await assert.rejects(build(c).issueProof({requestId,email,mailboxToken:mailboxToken()}),
      {code:'WITHDRAWAL_MAPPING_PROOF_DENIED'});
  }
  await assert.rejects(build().issueProof({
    requestId,email,mailboxToken:mailboxToken('b'.repeat(64))
  }),{code:'WITHDRAWAL_MAPPING_PROOF_DENIED'});
  assert.throws(()=>createLegacyMappingAuthority({
    database:{query:async()=>{}},mailboxEvidenceVerifier:verifier,
    providerOff:{verifyOff:async()=>({off:false})},
    legacyConsentSecret:oldSecret,escrowConsentSecret:Buffer.alloc(oldSecret.length,1),
    mailboxTagKey:tagKey,signingPrivateKeyPem:mappingKeys.privateKey.export({format:'pem',type:'pkcs8'}),
    pinnedPublicKeyPem:mapping.publicKeyPem,issuer:issuerL,
    audience:mapping.audience,keyId:mapping.keyId
  }),{code:'WITHDRAWAL_MAPPING_PROOF_DENIED'});
});
