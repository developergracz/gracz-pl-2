import {createHash, createHmac, createPublicKey, verify as verifySignature} from 'node:crypto';

// Local, offline-only verifier for a future restricted identity-provider gateway.
// No HTTP route, no login page, no secret provisioning and NO production auth.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64URL=/^[A-Za-z0-9_-]+$/;
function deny() { const e=new Error('OPERATOR_ACCESS_DENIED');e.code='OPERATOR_ACCESS_DENIED';return e; }
function parsePart(part) {
  if(typeof part!=='string'||part.length<2||part.length>3000||!BASE64URL.test(part))throw deny();
  const buf=Buffer.from(part,'base64url');
  if(buf.toString('base64url')!==part)throw deny();
  let data;
  try {data=JSON.parse(buf.toString('utf8'));}catch{throw deny();}
  if(!data||typeof data!=='object'||Array.isArray(data))throw deny();
  return data;
}
function isInt(n){return Number.isSafeInteger(n)&&n>=0;}

export function createOperatorAssertionVerifier({
  issuer,audience,keyId,publicKeyPem,subjectTagKey,now=()=>Date.now()
}={}) {
  if(typeof issuer!=='string'||!issuer.startsWith('https://')||typeof audience!=='string'||!audience||
     typeof keyId!=='string'||!keyId||typeof now!=='function')throw new TypeError('Restricted identity provider configuration required');
  if(!Buffer.isBuffer(subjectTagKey)||subjectTagKey.length<32)
    throw new TypeError('Independent 32-byte operator subject HMAC key required');
  const publicKey=createPublicKey(publicKeyPem);
  if(publicKey.asymmetricKeyType!=='ed25519')throw new TypeError('Pinned Ed25519 public key required');
  const tagKey=Buffer.from(subjectTagKey);

  return Object.freeze({
    verify(token) {
      if(typeof token!=='string'||token.length>4096)throw deny();
      const parts=token.split('.');
      if(parts.length!==3)throw deny();
      const header=parsePart(parts[0]),claims=parsePart(parts[1]);
      if(header.alg!=='EdDSA'||header.kid!==keyId||header.typ!=='JWT'||
         Object.hasOwn(header,'crit')||Object.hasOwn(header,'jwk')||Object.hasOwn(header,'jku')||
         Object.hasOwn(header,'x5u')||Object.hasOwn(header,'x5c'))throw deny();
      if(!BASE64URL.test(parts[2]))throw deny();
      const signature=Buffer.from(parts[2],'base64url');
      if(signature.length!==64||signature.toString('base64url')!==parts[2]||
         !verifySignature(null,Buffer.from(parts[0]+'.'+parts[1]),publicKey,signature))throw deny();
      const nowSec=Math.floor(now()/1000);
      if(claims.iss!==issuer||claims.aud!==audience||
         typeof claims.sub!=='string'||!UUID.test(claims.sub)||
         typeof claims.jti!=='string'||!UUID.test(claims.jti)||
         !isInt(claims.exp)||!isInt(claims.iat)||!isInt(claims.auth_time)||
         !Array.isArray(claims.amr)||!claims.amr.includes('mfa')||!claims.amr.includes('webauthn')||
         claims.iat>nowSec+30||claims.auth_time>nowSec+30||
         claims.auth_time>claims.iat||claims.iat-claims.auth_time>600||
         claims.exp<=nowSec||claims.exp-claims.iat>600||
         (claims.nbf!==undefined&&(!isInt(claims.nbf)||claims.nbf>nowSec)))throw deny();

      const subjectTag=createHmac('sha256',tagKey)
        .update('newsletter-operator-subject-v1\0'+issuer+'\0'+claims.sub.toLowerCase())
        .digest('hex');
      const tokenUse=createHash('sha256')
        .update('newsletter-operator-jti-v1\0'+issuer+'\0'+claims.jti.toLowerCase())
        .digest('hex');
      return Object.freeze({subjectTag,tokenUse});
    }
  });
}
