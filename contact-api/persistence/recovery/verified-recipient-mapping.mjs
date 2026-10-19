import {
  createCipheriv,createDecipheriv,createHash,createHmac,hkdfSync,
  randomBytes,timingSafeEqual
} from 'node:crypto';

// Private recipient mapping. Exact escrow match plus NEW purpose keys and an
// existing consent event are mandatory. No raw mailbox in public storage.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(){const e=new Error('WITHDRAWAL_IDENTITY_UNRESOLVED');e.code='WITHDRAWAL_IDENTITY_UNRESOLVED';return e;}
function canonicalEmail(email) {
  if(typeof email!=='string'||email.length>254||email!==email.trim().toLowerCase()||
     !/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email))
    throw fail();
  return email;
}
function keyBuffer(key){return Buffer.isBuffer(key)&&key.length>=32;}
function toUuid(bytes) {
  const b=Buffer.from(bytes.subarray(0,16));
  b[6]=(b[6]&0x0f)|0x50;b[8]=(b[8]&0x3f)|0x80;
  const h=b.toString('hex');
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
export function legacySubjectRefFromHash(hash) {
  if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw fail();
  return toUuid(createHash('sha256').update('gracz-legacy-subject-reference-v1\0'+hash).digest());
}
export function createVerifiedRecipientMapping({
  database,legacyConsentSecret,escrowConsentSecret,mailboxTagKey,encryptionKey
}={}) {
  if(typeof database?.transaction!=='function'||typeof database?.query!=='function'||
     !keyBuffer(legacyConsentSecret)||!keyBuffer(escrowConsentSecret)||
     !keyBuffer(mailboxTagKey)||!Buffer.isBuffer(encryptionKey)||encryptionKey.length!==32)
    throw new TypeError('Private database, independently verified old escrow and separate 32-byte purpose keys required');
  // Both copies must originate in separately protected owner-authorized sources.
  // Never compare merely shortened hashes, prefixes or formatting.
  if(legacyConsentSecret.length!==escrowConsentSecret.length||
     !timingSafeEqual(legacyConsentSecret,escrowConsentSecret))throw fail();
  if(timingSafeEqual(mailboxTagKey,encryptionKey))throw fail();
  const legacyHashKey=createHash('sha256')
    .update('newsletter-consent-subject:','utf8').update(legacyConsentSecret).digest();
  const mailboxKey=Buffer.from(mailboxTagKey);
  const dataKey=Buffer.from(hkdfSync('sha256',encryptionKey,
    Buffer.from('gracz-newsletter-recovery-recipient-v1'),
    Buffer.from('aes-256-gcm'),32));

  const legacyHash=email=>createHmac('sha256',legacyHashKey).update(email,'utf8').digest('hex');
  const tag=email=>createHmac('sha256',mailboxKey)
    .update('gracz-newsletter-recovery-mailbox-v1\0'+email).digest('hex');
  const aad=(requestId,legacyRef)=>Buffer.from(
    'gracz-newsletter-recovery-recipient-v1\0'+requestId+'\0'+legacyRef);
  function seal(email,requestId,legacyRef){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',dataKey,nonce);
    cipher.setAAD(aad(requestId,legacyRef));
    return {nonce,ciphertext:Buffer.concat([cipher.update(email,'utf8'),cipher.final()]),authTag:cipher.getAuthTag()};
  }
  function unseal(row){
    try {
      const decipher=createDecipheriv('aes-256-gcm',dataKey,row.nonce);
      decipher.setAAD(aad(row.request_id,row.legacy_subject_ref));
      decipher.setAuthTag(row.auth_tag);
      return canonicalEmail(Buffer.concat([decipher.update(row.ciphertext),decipher.final()]).toString('utf8'));
    }catch{throw fail();}
  }
  async function requireLegacy(client,emailHash) {
    const result=await client.query(
      "SELECT " +
      " to_regclass('public.newsletter_opt_in_requests') IS NOT NULL AS f03, " +
      " (SELECT count(*)::int FROM public.newsletter_contacts WHERE email_hash=$1) AS contacts, " +
      " (SELECT count(*)::int FROM public.newsletter_consent_events WHERE email_hash=$1) AS events",
      [emailHash]);
    if(result.rowCount!==1||result.rows[0]?.f03!==true||
       result.rows[0]?.contacts!==1||
       !Number.isInteger(result.rows[0]?.events)||result.rows[0].events<1)throw fail();
  }
  return Object.freeze({
    // Only invoke from an operator-authenticated transaction after BOTH
    // independent signed proofs have been durably verified and recorded.
    async linkVerified({client,requestId,legacySubjectRef,mailboxTag,email,operatorRef}={}) {
      if(typeof client?.query!=='function'||!UUID.test(requestId||'')||
         !UUID.test(legacySubjectRef||'')||!UUID.test(operatorRef||''))
        throw fail();
      const normalized=canonicalEmail(email);
      const h=legacyHash(normalized);
      if(legacySubjectRef.toLowerCase()!==legacySubjectRefFromHash(h)||
         mailboxTag!==tag(normalized))throw fail();
      const proof=await client.query(
        "SELECT legacy_subject_ref,mailbox_tag FROM newsletter_recovery.withdrawal_verified_evidence " +
        "WHERE request_id=$1 FOR SHARE",[requestId]);
      if(proof.rowCount!==1||proof.rows[0].legacy_subject_ref!==legacySubjectRef||
         proof.rows[0].mailbox_tag!==mailboxTag)throw fail();
      await requireLegacy(client,h);
      const box=seal(normalized,requestId,legacySubjectRef);
      const ins=await client.query(
        "INSERT INTO newsletter_recovery.verified_recipient_links " +
        "(request_id,legacy_subject_ref,mailbox_tag,legacy_email_hash,ciphertext,nonce,auth_tag,linked_by) " +
        "VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING request_id",
        [requestId,legacySubjectRef,mailboxTag,h,box.ciphertext,box.nonce,box.authTag,operatorRef]
      );
      if(ins.rowCount!==1)throw fail();
      return Object.freeze({requestId,linked:true});
    },
    async resolveVerifiedRecipient({requestId,legacySubjectRef}={}) {
      if(!UUID.test(requestId||'')||!UUID.test(legacySubjectRef||''))throw fail();
      const res=await database.query(
        "SELECT l.request_id,l.legacy_subject_ref,l.mailbox_tag,l.legacy_email_hash," +
        "l.ciphertext,l.nonce,l.auth_tag FROM newsletter_recovery.verified_recipient_links l " +
        "JOIN newsletter_recovery.withdrawal_verified_evidence v ON v.request_id=l.request_id " +
        "WHERE l.request_id=$1 AND l.legacy_subject_ref=$2 " +
        "AND l.mailbox_tag=v.mailbox_tag AND l.legacy_subject_ref=v.legacy_subject_ref",
        [requestId,legacySubjectRef]
      );
      if(res.rowCount!==1)throw fail();
      const record=res.rows[0],email=unseal(record);
      if(legacyHash(email)!==record.legacy_email_hash||
         legacySubjectRefFromHash(record.legacy_email_hash)!==legacySubjectRef||
         tag(email)!==record.mailbox_tag)throw fail();
      await requireLegacy(database,record.legacy_email_hash);
      return Object.freeze({email,mailboxTag:record.mailbox_tag,legacySubjectRef});
    }
  });
}
