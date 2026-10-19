import {createHash,createPublicKey,randomUUID,verify as verifySignature} from 'node:crypto';

// One-time, private provisioning. The owner approval is a separately signed,
// short-lived authorization for the EXACT two MFA-attested operator identities.
// No emails, passwords, accounts or MFA devices are created by this code.
const HEX=/^[0-9a-f]{64}$/;
const BASE64=/^[A-Za-z0-9_-]+$/;
function refuse(){const e=new Error('WITHDRAWAL_ENROLLMENT_DENIED');e.code='WITHDRAWAL_ENROLLMENT_DENIED';return e;}
function parse(part) {
  if(typeof part!=='string'||part.length<2||part.length>2500||!BASE64.test(part))throw refuse();
  const bytes=Buffer.from(part,'base64url');
  if(bytes.toString('base64url')!==part)throw refuse();
  try {
    const obj=JSON.parse(bytes.toString('utf8'));
    if(obj&&typeof obj==='object'&&!Array.isArray(obj))return obj;
  }catch{}
  throw refuse();
}
export function createOwnerApprovedOperatorEnrollment({
  database,assertionVerifier,approvalPublicKeyPem,issuer,audience,keyId,now=()=>Date.now()
}={}) {
  if(typeof database?.transaction!=='function'||typeof assertionVerifier?.verify!=='function'||
     typeof now!=='function'||typeof issuer!=='string'||!issuer.startsWith('https://')||
     typeof audience!=='string'||!audience||typeof keyId!=='string'||!keyId)
    throw new TypeError('Separate, configured operator identity and Owner approval authorities required');
  const key=createPublicKey(approvalPublicKeyPem);
  if(key.asymmetricKeyType!=='ed25519')throw new TypeError('Pinned Owner Ed25519 approval key required');
  function approval(token,primaryTag,backupTag) {
    if(typeof token!=='string'||token.length>4096)throw refuse();
    const parts=token.split('.');
    if(parts.length!==3||!BASE64.test(parts[2]))throw refuse();
    const header=parse(parts[0]),claims=parse(parts[1]);
    if(header.typ!=='JWT'||header.alg!=='EdDSA'||header.kid!==keyId||
      ['jwk','jku','x5u','x5c','crit'].some(k=>Object.hasOwn(header,k)))throw refuse();
    const sig=Buffer.from(parts[2],'base64url');
    if(sig.length!==64||sig.toString('base64url')!==parts[2]||
       !verifySignature(null,Buffer.from(parts[0]+'.'+parts[1]),key,sig))throw refuse();
    const t=Math.floor(now()/1000);
    if(claims.iss!==issuer||claims.aud!==audience||
      claims.purpose!=='OPERATOR_PAIR_ENROLLMENT'||claims.primary_tag!==primaryTag||
      claims.backup_tag!==backupTag||!HEX.test(primaryTag)||!HEX.test(backupTag)||
      typeof claims.jti!=='string'||!/^[0-9a-f-]{36}$/i.test(claims.jti)||
      !Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||
      claims.iat>t+30||claims.exp<=t||claims.exp-claims.iat>600)throw refuse();
    return createHash('sha256')
      .update('gracz-owner-enrollment-v1\0'+issuer+'\0'+claims.jti.toLowerCase())
      .digest('hex');
  }
  return Object.freeze({
    async enrollPair({primaryAssertion,backupAssertion,ownerApproval}={}) {
      // Both signed MFA assertions are checked against the same pinned issuer,
      // including their subject, freshness and WebAuthn MFA evidence.
      const primary=assertionVerifier.verify(primaryAssertion);
      const backup=assertionVerifier.verify(backupAssertion);
      if(primary.subjectTag===backup.subjectTag||primary.tokenUse===backup.tokenUse)throw refuse();
      const approvalTag=approval(ownerApproval,primary.subjectTag,backup.subjectTag);
      const primaryRef=randomUUID(),backupRef=randomUUID();
      return database.transaction(async client=>{
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('newsletter-operator-enrollment-v1',0))");
        const existing=await client.query('SELECT count(*)::int AS n FROM newsletter_recovery.operator_accounts');
        const approvals=await client.query('SELECT count(*)::int AS n FROM newsletter_recovery.operator_enrollments');
        if(existing.rows[0]?.n!==0||approvals.rows[0]?.n!==0)throw refuse();
        await client.query(
          "INSERT INTO newsletter_recovery.operator_accounts(operator_ref,subject_tag,role) "+
          "VALUES ($1,$2,'primary'),($3,$4,'backup')",
          [primaryRef,primary.subjectTag,backupRef,backup.subjectTag]
        );
        await client.query(
          "INSERT INTO newsletter_recovery.operator_enrollments(approval_tag,primary_ref,backup_ref) "+
          "VALUES ($1,$2,$3)",[approvalTag,primaryRef,backupRef]
        );
        return Object.freeze({primaryRef,backupRef,accounts:2});
      });
    }
  });
}
