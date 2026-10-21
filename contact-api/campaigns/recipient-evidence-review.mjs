// Internal evidence-only recipient screening before future newsletter campaigns.
// No send route, provider calls, sender permits or eligibility cache.
// A positive result is NOT authority to send: the global withdrawal fence and
// fresh transactional checks still apply before any future provider effect.
import {createDecipheriv,createHmac,timingSafeEqual} from 'node:crypto';
import {CAMPAIGN_CONSENT_VERSION} from './audience-proof-count.mjs';

const HEX64=/^[0-9a-f]{64}$/;
const MAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_CONTEXT='gracz-newsletter-new:';
const REGISTRY_CONTEXT='gracz-new-only:email\n';
const WITHDRAWAL_CONTEXT='gracz-withdrawal-v1\0recipient\0';

const GLOBAL_SQL=`
 SELECT
   EXISTS(
     SELECT 1 FROM newsletter_recovery.withdrawal_requests r
     LEFT JOIN newsletter_recovery.self_service_verified v
       ON v.withdrawal_request_id=r.request_id
     LEFT JOIN newsletter_recovery.self_service_provider_verified p
       ON p.challenge_id=v.challenge_id
     WHERE r.intake_source<>'self_service'
       OR v.challenge_id IS NULL OR p.challenge_id IS NULL
   ) AS unverified_withdrawals,
   EXISTS(
     SELECT 1 FROM newsletter_recovery.withdrawal_no_send_obligations
   ) AS obligations
`;
const DOI_SQL=`
 SELECT s.email_tag,s.ciphertext,s.nonce,s.auth_tag
 FROM newsletter_new.subscribers s
 WHERE s.email_tag=$1 AND s.state='active'
   AND s.delivery_state='sent'
   AND s.confirmed_at IS NOT NULL
   AND s.consent_version=$2
   AND EXISTS(
     SELECT 1 FROM newsletter_new.consent_events e
     WHERE e.email_tag=s.email_tag
       AND e.challenge_id=s.challenge_id
       AND e.event_type='opt_in_confirmed'
       AND e.consent_version=s.consent_version
       AND e.source=s.source
   )
   AND NOT EXISTS(
     SELECT 1 FROM newsletter_new.revocations v
     WHERE v.email_tag=s.email_tag
   )
`;
const WITHDRAWAL_SQL=`
 SELECT EXISTS(
   SELECT 1 FROM newsletter_recovery.self_service_challenges c
   JOIN newsletter_recovery.self_service_verified v
     ON v.challenge_id=c.challenge_id
   WHERE c.recipient_tag=$1
 ) AS withdrawn
`;
const invalid=()=>new Error('campaign_recipient_evidence_unavailable');
function decodeKey(value){
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))
    throw invalid();
  const raw=Buffer.from(value,'base64url');
  if(raw.length!==32||raw.toString('base64url')!==value)throw invalid();
  return raw;
}
const verdict=(state)=>Object.freeze({state,advisoryOnly:true,maySend:false});

export function createCampaignRecipientEvidenceReview({
  database,newEncryptionKey,newSubjectKey,withdrawalRecipientTagKey
}={}){
  if(typeof database?.queryBounded!=='function')
    throw new TypeError('read_only_database_required');
  const enc=decodeKey(newEncryptionKey);
  const subject=decodeKey(newSubjectKey);
  const withdrawal=decodeKey(withdrawalRecipientTagKey);
  if(timingSafeEqual(enc,subject)||timingSafeEqual(enc,withdrawal)||
     timingSafeEqual(subject,withdrawal))
    throw invalid();

  return async function reviewOne(emailTag,expectedAddress){
    if(typeof emailTag!=='string'||!HEX64.test(emailTag))throw invalid();
    // The optional expected address is supplied only by a private, future
    // dispatch adapter. Merely possessing an email_tag must never authorize
    // sending to an arbitrary address.
    const matchAddress=expectedAddress!==undefined;
    if(matchAddress&&(typeof expectedAddress!=='string'||
       expectedAddress.length>254||expectedAddress!==expectedAddress.trim().toLowerCase()||
       !MAIL.test(expectedAddress)))throw invalid();

    // An unresolved self-service provider effect, any exceptional/legacy intake
    // or a global no-send obligation requires a conservative NO, not a guess.
    const check=await database.queryBounded(GLOBAL_SQL,[],{timeoutMs:3000});
    const flags=check?.rows?.[0];
    if(check?.rows?.length!==1||
       typeof flags?.unverified_withdrawals!=='boolean'||
       typeof flags?.obligations!=='boolean')throw invalid();
    if(flags.unverified_withdrawals||flags.obligations)
      return verdict('global_evidence_hold');

    const doi=await database.queryBounded(
      DOI_SQL,[emailTag,CAMPAIGN_CONSENT_VERSION],{timeoutMs:3000});
    if(!Array.isArray(doi?.rows)||doi.rows.length>1)throw invalid();
    if(doi.rows.length===0)return verdict('no_current_doi');
    const row=doi.rows[0];
    if(row.email_tag!==emailTag||!Buffer.isBuffer(row.ciphertext)||
       row.ciphertext.length<4||!Buffer.isBuffer(row.nonce)||
       row.nonce.length!==12||!Buffer.isBuffer(row.auth_tag)||
       row.auth_tag.length!==16)throw invalid();

    // Decrypt exclusively in private process memory, then prove the identity
    // matches the new-only registry before deriving the independent opt-out tag.
    let email;
    try{
      const cipher=createDecipheriv('aes-256-gcm',enc,row.nonce);
      cipher.setAAD(Buffer.from(EMAIL_CONTEXT+emailTag));
      cipher.setAuthTag(row.auth_tag);
      email=Buffer.concat([cipher.update(row.ciphertext),cipher.final()])
        .toString('utf8');
    }catch{throw invalid();}
    if(email.length>254||email!==email.trim().toLowerCase()||
       !MAIL.test(email))throw invalid();
    const computed=createHmac('sha256',subject)
      .update(REGISTRY_CONTEXT+email).digest();
    if(!timingSafeEqual(computed,Buffer.from(emailTag,'hex')))
      throw invalid();
    if(matchAddress){
      const verified=Buffer.from(email,'utf8');
      const supplied=Buffer.from(expectedAddress,'utf8');
      if(verified.length!==supplied.length||
         !timingSafeEqual(verified,supplied))
        return verdict('recipient_mismatch');
    }

    const withdrawalTag=createHmac('sha256',withdrawal)
      .update(WITHDRAWAL_CONTEXT+email).digest('hex');
    const result=await database.queryBounded(
      WITHDRAWAL_SQL,[withdrawalTag],{timeoutMs:3000});
    if(result?.rows?.length!==1||
       typeof result.rows[0]?.withdrawn!=='boolean')throw invalid();
    if(result.rows[0].withdrawn)return verdict('verified_withdrawal');
    if(!matchAddress)return verdict('evidence_complete_for_review');
    // Additional evidence, never a sender permit: only inside the separate
    // global send fence and after a durable delivery claim can this be used.
    return Object.freeze({...verdict('evidence_complete_for_review'),
      recipientMatched:true});
  };
}
