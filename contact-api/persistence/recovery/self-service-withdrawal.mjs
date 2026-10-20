import {
  createCipheriv,createDecipheriv,createHmac,randomBytes,randomUUID,
  timingSafeEqual
} from 'node:crypto';
import {WITHDRAWAL_EGRESS_LOCK} from './withdrawal-send-fence.mjs';

// #283 R9 — recipient self-service withdrawal core. NO operator account/IdP.
// Never accepts old n1/ns1 tokens. A random NEW mailbox challenge is sent
// using a separate transactional message transport (not marketing).
// This is an internal module: the public gateway MUST rate-limit, prevent
// enumeration, check Origin/CSRF and not log email or challenge secrets.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const REQUEST_RECEIVED=Object.freeze({state:'request_received',confirmed:false});
const COOLDOWN_MS=15*60*1000;
const TTL_MS=15*60*1000;
function deny(code='WITHDRAWAL_CHALLENGE_REJECTED') {
  const error=new Error(code);error.code=code;return error;
}
function emailAddress(value) {
  if(typeof value!=='string'||value.length>254||value!==value.trim().toLowerCase()||
     !/^[a-z0-9.!#$%&'*+/=?^_\x60{|}~-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(value))
    throw deny();
  return value;
}
function key(value){
  if(!Buffer.isBuffer(value)||value.length!==32)throw new TypeError('Unique 32-byte purpose key required');
  return Buffer.from(value);
}
export function createSelfServiceWithdrawal({
  database,recipientTagKey,challengeKey,encryptionKey,challengeMailer,
  providerOff,now=()=>Date.now()
}={}) {
  if(typeof database?.transaction!=='function'||
     typeof challengeMailer?.sendChallenge!=='function'||
     typeof providerOff?.ensureOff!=='function'||
     typeof providerOff?.verifyOff!=='function'||typeof now!=='function')
    throw new TypeError('Durable PostgreSQL, challenge delivery and provider OFF required');
  const tagKey=key(recipientTagKey),tokenKey=key(challengeKey),dataKey=key(encryptionKey);
  if(tagKey.equals(tokenKey)||tagKey.equals(dataKey)||tokenKey.equals(dataKey))
    throw new TypeError('Three independent purpose keys required');
  const digest=(domain,data,keyBytes)=>createHmac('sha256',keyBytes)
    .update('gracz-withdrawal-v1\0'+domain+'\0'+data,'utf8').digest('hex');
  const recipientTag=email=>digest('recipient',email,tagKey);
  const challengeTag=(id,token)=>digest('challenge',id+'\0'+token,tokenKey);
  const dedupeTag=id=>digest('intake',id,tagKey);
  function seal(email,id){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',dataKey,nonce);
    cipher.setAAD(Buffer.from('gracz-withdrawal-recipient-v1\0'+id));
    // PostgreSQL requires ciphertext >= 16 bytes; AES-GCM does not add length.
    // Authenticated zero-padding preserves short legitimate email addresses.
    const bytes=Buffer.from(email,'utf8');
    const padded=Buffer.alloc(Math.max(16,bytes.length));
    bytes.copy(padded);
    const ciphertext=Buffer.concat([cipher.update(padded),cipher.final()]);
    return {ciphertext,nonce,authTag:cipher.getAuthTag()};
  }
  function unseal(row) {
    try {
      const decoder=createDecipheriv('aes-256-gcm',dataKey,row.nonce);
      decoder.setAAD(Buffer.from('gracz-withdrawal-recipient-v1\0'+row.challenge_id));
      decoder.setAuthTag(row.auth_tag);
      const decrypted=Buffer.concat([decoder.update(row.ciphertext),decoder.final()]);
      // Existing unpadded challenges remain readable; email syntax forbids NUL.
      return emailAddress(decrypted.toString('utf8').replace(/\0+$/g,''));
    } catch {throw deny();}
  }

  return Object.freeze({
    async requestChallenge({email}={}) {
      const recipient=emailAddress(email);
      const tag=recipientTag(recipient);
      const item=await database.transaction(async client=>{
        // Prevent two concurrent challenge deliveries for the same recipient.
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          ['gracz-withdrawal-challenge-v1:'+tag]
        );
        const recent=await client.query(
          "SELECT 1 FROM newsletter_recovery.self_service_challenges " +
          "WHERE recipient_tag=$1 AND requested_at>clock_timestamp()-interval '15 minutes' LIMIT 1",
          [tag]
        );
        if(recent.rowCount)return null;
        // Atomic global hourly budget prevents open-relay abuse across IPs
        // and process restarts. A rejected issuance looks neutral publicly.
        const budget=await client.query(
          "INSERT INTO newsletter_recovery.self_service_mail_budget " +
          "(hour_bucket,accepted_count) VALUES(date_trunc('hour',clock_timestamp()),1) "+
          "ON CONFLICT(hour_bucket) DO UPDATE "+
          "SET accepted_count=newsletter_recovery.self_service_mail_budget.accepted_count+1 "+
          "WHERE newsletter_recovery.self_service_mail_budget.accepted_count<60 "+
          "RETURNING accepted_count"
        );
        if(budget.rowCount!==1)return null;
        const challengeId=randomUUID(),token=randomBytes(32).toString('base64url');
        const expiresAt=new Date(now()+TTL_MS),data=seal(recipient,challengeId);
        await client.query(
          "INSERT INTO newsletter_recovery.self_service_challenges " +
          "(challenge_id,recipient_tag,token_tag,ciphertext,nonce,auth_tag,expires_at) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [challengeId,tag,challengeTag(challengeId,token),
            data.ciphertext,data.nonce,data.authTag,expiresAt]
        );
        return {challengeId,token,email:recipient,expiresAt};
      });
      if(item) {
        // The secret goes ONLY to this private transport, never in an API
        // response, database plaintext, query log or marketing broadcast.
        // No send retry on ambiguous ACK; request remains opaque to callers.
        try {await challengeMailer.sendChallenge(item);} catch {}
      }
      return REQUEST_RECEIVED;
    },
    async confirmChallenge({challengeId,token}={}) {
      if(typeof challengeId!=='string'||!UUID.test(challengeId)||
         typeof token!=='string'||!TOKEN.test(token)||
         Buffer.from(token,'base64url').length!==32)
        throw deny();
      const result=await database.transaction(async client=>{
        // Stop a concurrent marketing egress effect before acknowledging the
        // durable withdrawal. Intake's exclusive lock matches the send fence.
        await client.query(
          'SELECT pg_advisory_xact_lock($1::int,$2::int)',WITHDRAWAL_EGRESS_LOCK
        );
        const found=await client.query(
          "SELECT challenge_id,recipient_tag,token_tag,ciphertext,nonce,auth_tag " +
          "FROM newsletter_recovery.self_service_challenges " +
          "WHERE challenge_id=$1 AND expires_at>clock_timestamp() FOR UPDATE",
          [challengeId]
        );
        if(found.rowCount!==1)throw deny();
        const record=found.rows[0];
        const previous=await client.query(
          "SELECT 1 FROM newsletter_recovery.self_service_verified WHERE challenge_id=$1",
          [challengeId]
        );
        if(previous.rowCount)throw deny(); // replay is forbidden, even after success
        const expected=Buffer.from(record.token_tag,'hex');
        const actual=Buffer.from(challengeTag(challengeId,token),'hex');
        if(expected.length!==32||!timingSafeEqual(expected,actual))throw deny();
        const email=unseal(record);
        if(recipientTag(email)!==record.recipient_tag)throw deny();
        const requestId=randomUUID();
        await client.query(
          "INSERT INTO newsletter_recovery.withdrawal_requests " +
          "(request_id,dedupe_tag,intake_source,evidence_ref) "+
          "VALUES($1,$2,'self_service',$3)",
          [requestId,dedupeTag(challengeId),challengeId]
        );
        await client.query(
          "INSERT INTO newsletter_recovery.self_service_verified " +
          "(challenge_id,withdrawal_request_id) VALUES($1,$2)",
          [challengeId,requestId]
        );
        // Durable provider effect intent MUST exist before any Resend mutation.
        await client.query(
          "INSERT INTO newsletter_recovery.self_service_provider_intents " +
          "(challenge_id) VALUES($1)",[challengeId]
        );
        return {email};
      });
      // The only authorization is the one-time NEW mailbox secret. Missing,
      // expired, tampered and replayed proofs perform NO provider mutation.
      try {
        const effect=await providerOff.ensureOff(result.email);
        if(effect?.off!==true)throw deny('WITHDRAWAL_PROVIDER_UNCERTAIN');
        const confirmed=await providerOff.verifyOff(result.email);
        if(confirmed?.off!==true)throw deny('WITHDRAWAL_PROVIDER_UNCERTAIN');
      } catch {
        // Durable NO SEND request/intent remains. A human can independently
        // inspect provider state without repeating an ambiguous mutation.
        return REQUEST_RECEIVED;
      }
      await database.transaction(async client=>{
        await client.query(
          "INSERT INTO newsletter_recovery.self_service_provider_verified " +
          "(challenge_id) VALUES ($1) ON CONFLICT DO NOTHING",
          [challengeId]
        );
      });
      // This proves only provider suppression. The old first-party consent
      // ledger is STILL quarantined; never claim a full confirmed withdrawal.
      return Object.freeze({state:'provider_off_verified',confirmed:false});
    }
  });
}
