import {
  createHash,createHmac,createPrivateKey,createPublicKey,
  randomUUID,sign,timingSafeEqual
} from 'node:crypto';
import {legacySubjectRefFromHash} from './verified-recipient-mapping.mjs';

// Private, independently signed MAPPING authority. A fresh mailbox-control
// proof signed by ANOTHER issuer must exist before it can attest an old
// HMAC-backed subject. Does not create consent, send email or activate marketing.
function refuse(){
  const e=new Error('WITHDRAWAL_MAPPING_PROOF_DENIED');
  e.code='WITHDRAWAL_MAPPING_PROOF_DENIED';return e;
}
function normalize(email){
  if(typeof email!=='string'||email!==email.trim().toLowerCase()||email.length>254||
     !/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email))
    throw refuse();
  return email;
}
export function createLegacyMappingAuthority({
  database,mailboxEvidenceVerifier,providerOff,
  legacyConsentSecret,escrowConsentSecret,mailboxTagKey,
  signingPrivateKeyPem,pinnedPublicKeyPem,
  issuer,audience,keyId,now=()=>Date.now()
}={}){
  if(typeof database?.query!=='function'||
     typeof mailboxEvidenceVerifier?.verifyMailbox!=='function'||
     typeof providerOff?.verifyOff!=='function'||
     !Buffer.isBuffer(legacyConsentSecret)||legacyConsentSecret.length<32||
     !Buffer.isBuffer(escrowConsentSecret)||escrowConsentSecret.length<32||
     !Buffer.isBuffer(mailboxTagKey)||mailboxTagKey.length<32||
     typeof issuer!=='string'||!issuer.startsWith('https://')||
     typeof audience!=='string'||!audience||typeof keyId!=='string'||!keyId||
     typeof now!=='function')throw new TypeError('Independent private mailbox, escrow, mapping signer and provider evidence required');
  if(legacyConsentSecret.length!==escrowConsentSecret.length||
     !timingSafeEqual(legacyConsentSecret,escrowConsentSecret))throw refuse();
  const privateKey=createPrivateKey(signingPrivateKeyPem);
  const publicKey=createPublicKey(pinnedPublicKeyPem);
  if(privateKey.asymmetricKeyType!=='ed25519'||publicKey.asymmetricKeyType!=='ed25519'||
     !createPublicKey(privateKey).export({format:'der',type:'spki'})
       .equals(publicKey.export({format:'der',type:'spki'})))throw new TypeError('Pinned private mapping issuer key mismatch');
  const key=createHash('sha256').update('newsletter-consent-subject:','utf8')
    .update(legacyConsentSecret).digest();
  const hash=email=>createHmac('sha256',key).update(email,'utf8').digest('hex');
  const tag=email=>createHmac('sha256',mailboxTagKey)
    .update('gracz-newsletter-recovery-mailbox-v1\0'+email).digest('hex');
  return Object.freeze({
    async issueProof({requestId,email,mailboxToken}={}) {
      if(typeof requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(requestId))throw refuse();
      const recipient=normalize(email),subjectHash=hash(recipient),mailboxTag=tag(recipient);
      // This verifies a signed, fresh MAILBOX claim from the independently
      // pinned issuer; an operator-entered email or old n1/ns1 token cannot pass.
      try {mailboxEvidenceVerifier.verifyMailbox({
        mailboxToken,expectedRequestId:requestId,expectedMailboxTag:mailboxTag
      });}catch{throw refuse();}
      const result=await database.query(
        "SELECT to_regclass('public.newsletter_opt_in_requests') IS NOT NULL AS f03, " +
        "(SELECT count(*)::int FROM public.newsletter_contacts WHERE email_hash=$1) AS subjects," +
        "(SELECT count(*)::int FROM public.newsletter_consent_events WHERE email_hash=$1) AS events",
        [subjectHash]
      );
      if(result.rowCount!==1||result.rows[0]?.f03!==true||
         result.rows[0]?.subjects!==1||!Number.isInteger(result.rows[0]?.events)||
         result.rows[0].events<1)throw refuse();
      // This is a read-only confirmation that the provider's current
      // suppression/contact state could be inspected; off:false is acceptable.
      // Provider errors MUST block the mapping attestation.
      let provider;
      try {provider=await providerOff.verifyOff(recipient);}catch{throw refuse();}
      if(typeof provider?.off!=='boolean')throw refuse();
      const t=Math.floor(now()/1000);
      const claims={
        iss:issuer,aud:audience,purpose:'MAPPING',request_id:requestId,
        jti:randomUUID(),iat:t,exp:t+300,
        mailbox_tag:mailboxTag,method:'one_to_one_legacy_mapping',
        subject_ref:legacySubjectRefFromHash(subjectHash),
        mapping_ref:randomUUID(),
        collision_checked:true,suppressions_checked:true
      };
      const header=Buffer.from(JSON.stringify({typ:'JWT',alg:'EdDSA',kid:keyId})).toString('base64url');
      const body=Buffer.from(JSON.stringify(claims)).toString('base64url');
      const message=header+'.'+body;
      return message+'.'+sign(null,Buffer.from(message),privateKey).toString('base64url');
    }
  });
}
