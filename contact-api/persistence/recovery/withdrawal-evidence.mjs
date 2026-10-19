import {createHash, createPublicKey, verify as verifySignature} from 'node:crypto';

// Offline-only evidence verifier for #282. Authentication must be performed by
// TWO independent operator-approved authorities, neither implemented here:
// 1) a fresh independent mailbox challenge; 2) one-to-one legacy mapping.
// NOT an HTTP endpoint. No email is sent; no historical identity is rewritten.
const B64=/^[A-Za-z0-9_-]+$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAG=/^[0-9a-f]{64}$/;
function denied() {const e=new Error('WITHDRAWAL_EVIDENCE_REJECTED');e.code='WITHDRAWAL_EVIDENCE_REJECTED';return e;}
function inputError(){throw new TypeError('Two independent pinned evidence authorities are required');}
function decode(part) {
  if(typeof part!=='string'||part.length<2||part.length>2600||!B64.test(part))throw denied();
  const bytes=Buffer.from(part,'base64url');
  if(bytes.toString('base64url')!==part)throw denied();
  let parsed;
  try {parsed=JSON.parse(bytes.toString('utf8'));}catch{throw denied();}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw denied();
  return parsed;
}
const validUuid=value=>typeof value==='string'&&UUID.test(value);
const validEpoch=value=>Number.isSafeInteger(value)&&value>=0;
function makeAuthority(config,kind,now){
  if(!config||typeof config.issuer!=='string'||!config.issuer.startsWith('https://')||
     typeof config.audience!=='string'||!config.audience||typeof config.keyId!=='string'||!config.keyId)
    inputError();
  const key=createPublicKey(config.publicKeyPem);
  if(key.asymmetricKeyType!=='ed25519')inputError();
  return {
    key,issuer:config.issuer,audience:config.audience,keyId:config.keyId,kind,now
  };
}
function open(token,authority) {
  if(typeof token!=='string'||token.length>4096)throw denied();
  const parts=token.split('.');
  if(parts.length!==3||!B64.test(parts[2]))throw denied();
  const header=decode(parts[0]),claims=decode(parts[1]);
  if(header.typ!=='JWT'||header.alg!=='EdDSA'||header.kid!==authority.keyId||
     ['jwk','jku','x5u','x5c','crit'].some(k=>Object.hasOwn(header,k)))throw denied();
  const sig=Buffer.from(parts[2],'base64url');
  if(sig.length!==64||sig.toString('base64url')!==parts[2]||
     !verifySignature(null,Buffer.from(parts[0]+'.'+parts[1]),authority.key,sig))throw denied();
  const clock=Math.floor(authority.now()/1000);
  if(claims.iss!==authority.issuer||claims.aud!==authority.audience||
     claims.purpose!==authority.kind||!validUuid(claims.request_id)||
     !validUuid(claims.jti)||!validEpoch(claims.iat)||!validEpoch(claims.exp)||
     claims.iat>clock+30||claims.exp<=clock||claims.exp-claims.iat>600||
     (claims.nbf!==undefined&&(!validEpoch(claims.nbf)||claims.nbf>clock)))throw denied();
  if(typeof claims.mailbox_tag!=='string'||!TAG.test(claims.mailbox_tag))throw denied();
  if(authority.kind==='MAILBOX'){
    if(claims.method!=='independent_mailbox_challenge'||!validUuid(claims.challenge_ref))throw denied();
  }else{
    if(claims.method!=='one_to_one_legacy_mapping'||!validUuid(claims.subject_ref)||
       !validUuid(claims.mapping_ref)||claims.collision_checked!==true||
       claims.suppressions_checked!==true)throw denied();
  }
  return claims;
}
function ticketHash(issuer,jti,purpose) {
  return createHash('sha256')
    .update('gracz-withdrawal-evidence-v1\0'+purpose+'\0'+issuer+'\0'+jti.toLowerCase())
    .digest('hex');
}
export function createWithdrawalEvidenceVerifier({mailbox,mapping,now=()=>Date.now()}={}) {
  if(typeof now!=='function')inputError();
  const mb=makeAuthority(mailbox,'MAILBOX',now);
  const mp=makeAuthority(mapping,'MAPPING',now);
  // One authority with one compromised key must not impersonate both proofs.
  const mbPub=mb.key.export({format:'der',type:'spki'});
  const mpPub=mp.key.export({format:'der',type:'spki'});
  if(mb.issuer===mp.issuer||mbPub.equals(mpPub)||mb.audience===mp.audience)inputError();
  return Object.freeze({
    verifyPair({mailboxToken,mappingToken,expectedRequestId}={}) {
      if(!validUuid(expectedRequestId))throw denied();
      const mail=open(mailboxToken,mb),map=open(mappingToken,mp);
      if(mail.request_id.toLowerCase()!==expectedRequestId.toLowerCase()||
         map.request_id.toLowerCase()!==expectedRequestId.toLowerCase()||
         mail.mailbox_tag!==map.mailbox_tag)throw denied();
      return Object.freeze({
        requestId:expectedRequestId.toLowerCase(),
        legacySubjectRef:map.subject_ref.toLowerCase(),
        mailboxProofRef:mail.challenge_ref.toLowerCase(),
        mappingProofRef:map.mapping_ref.toLowerCase(),
        mailboxProofTag:ticketHash(mb.issuer,mail.jti,'MAILBOX'),
        mappingProofTag:ticketHash(mp.issuer,map.jti,'MAPPING')
      });
    }
  });
}
