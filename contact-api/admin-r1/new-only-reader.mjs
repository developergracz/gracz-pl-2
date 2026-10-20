// Private new-only first-party data adapter. NEVER mount without OWNER auth.
// No legacy Resend list reads, production settings, environment or HTTP routes.
import { createDecipheriv, createHmac, timingSafeEqual } from 'node:crypto';
import { fault } from './provider.mjs';
const hex64 = /^[0-9a-f]{64}$/;
const MAX_PAGE = 10;
const HEX = (data) => String(data || '').trim();
const tag = (key, purpose, value) => createHmac('sha256', key)
  .update('gracz-new-only:' + purpose + '\n' + value).digest('hex');

export function createNewOnlyAdminReader({database,encryptionKey,subjectKey}={}) {
  if(typeof database?.queryBounded !== 'function' ||
     !Buffer.isBuffer(encryptionKey) || encryptionKey.length!==32 ||
     !Buffer.isBuffer(subjectKey) || subjectKey.length!==32 ||
     timingSafeEqual(encryptionKey,subjectKey))
    throw fault('configuration');
  const subjectHash = email => {
    if(typeof email!=='string' || email!==email.trim().toLowerCase() ||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fault('invalid_request');
    return tag(subjectKey,'email',email);
  };
  const query = async(sql,params,signal) => {
    if(signal?.aborted) throw fault('timeout');
    try {
      const answer=await database.queryBounded(sql,params,{timeoutMs:2000});
      if(signal?.aborted) throw fault('timeout');
      if(!Array.isArray(answer?.rows)) throw fault('invalid_provider_response');
      return answer.rows;
    } catch (e) {
      if(e?.code==='timeout') throw e;
      throw fault('provider_unavailable');
    }
  };
  const decrypt = row => {
    const emailTag=HEX(row.email_tag);
    if(!hex64.test(emailTag) ||
       !Buffer.isBuffer(row.ciphertext) ||
       !Buffer.isBuffer(row.nonce) || row.nonce.length!==12 ||
       !Buffer.isBuffer(row.auth_tag) || row.auth_tag.length!==16)
      throw fault('invalid_provider_response');
    try {
      const decipher=createDecipheriv('aes-256-gcm',encryptionKey,row.nonce);
      decipher.setAAD(Buffer.from('gracz-newsletter-new:'+emailTag));
      decipher.setAuthTag(row.auth_tag);
      const email=Buffer.concat([decipher.update(row.ciphertext),decipher.final()]).toString('utf8');
      if(email!==email.trim().toLowerCase() || email.length>254 ||
         !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw fault('invalid_provider_response');
      const expected=Buffer.from(subjectHash(email),'hex');
      if(!timingSafeEqual(expected,Buffer.from(emailTag,'hex')))
        throw fault('invalid_provider_response');
      return email;
    }catch{throw fault('invalid_provider_response');}
  };
  const adapter=Object.freeze({
    async readPage({after=null,limit=MAX_PAGE,search="",state="all",signal}={}) {
      if(!Number.isInteger(limit)||limit<1||limit>MAX_PAGE||
         (after!==null&&!hex64.test(after))||
         typeof search!=="string"||search.length>80||
         !['all','active','pending','unsubscribed','suppressed','outside_segment','unknown'].includes(state))
        throw fault('invalid_request');
      const term=search.trim().toLowerCase();
      const matches=[];
      let boundary=after,hasMore=false;
      // Encrypted addresses cannot be filtered with SQL LIKE. Scan bounded
      // keyset batches, decrypt only on the private OWNER route, and resume
      // from the last inspected key without skipping matching records.
      for(let batch=0;batch<8&&matches.length<limit;batch++){
        const rows=await query(`
          SELECT s.email_tag,s.ciphertext,s.nonce,s.auth_tag,s.state,
                 s.source,s.consent_version,s.delivery_state,
                 s.requested_at,s.confirmed_at,
                 (r.email_tag IS NOT NULL) AS revoked,
                 r.recorded_at AS revoked_at
          FROM newsletter_new.subscribers s
          LEFT JOIN newsletter_new.revocations r ON r.email_tag=s.email_tag
          WHERE ($1::text IS NULL OR s.email_tag < $1::text)
          ORDER BY s.email_tag DESC LIMIT 101
        `,[boundary],signal);
        if(rows.length>101)throw fault('invalid_provider_response');
        const full=rows.length===101;
        const slice=rows.slice(0,100);
        if(!slice.length){hasMore=false;break;}
        const ids=new Set();
        const items=slice.map(row=>{
          const id=HEX(row.email_tag);
          if(!hex64.test(id)||ids.has(id)||
             !['pending','active'].includes(row.state)||
             typeof row.revoked!=='boolean')throw fault('invalid_provider_response');
          ids.add(id);
          const iso=value=>{
            const date=value instanceof Date?value:new Date(String(value));
            if(!Number.isFinite(date.getTime()))throw fault('invalid_provider_response');
            return date.toISOString();
          };
          if(typeof row.source!=='string'||!/^[a-z_]{1,40}$/.test(row.source)||
             typeof row.consent_version!=='string'||row.consent_version.length<1||
             row.consent_version.length>64||/[\x00-\x1f\x7f]/.test(row.consent_version)||
             !['uncertain','sent'].includes(row.delivery_state)||
             !row.requested_at||(row.state==='active'&&!row.confirmed_at)||
             (row.revoked&&!row.revoked_at))
            throw fault('invalid_provider_response');
          return {id,email:decrypt(row),state:row.revoked?'unsubscribed':row.state,
            requestedAt:iso(row.requested_at),
            confirmedAt:row.confirmed_at?iso(row.confirmed_at):null,
            revokedAt:row.revoked_at?iso(row.revoked_at):null,
            source:row.source,consentVersion:row.consent_version,
            deliveryState:row.delivery_state,
            globalUnsubscribed:null,inSegment:null,topic:null,suppressed:null};
        });
        for(const item of items){
          boundary=item.id;
          if((state==='all'||item.state===state)&&item.email.includes(term))
            matches.push(item);
          if(matches.length===limit)break;
        }
        hasMore=full||boundary!==slice.at(-1).email_tag;
        if(matches.length===limit||!full)break;
      }
      return {items:matches,after:hasMore?boundary:null};
    }
  });

  // Read only the current new-only subscriber ledger, latest request timestamp.
  // This is NOT a historical count of every attempt or delivery receipt.
  async function readRecent(){
    const rows=await query(String.raw`
      WITH snap AS (SELECT clock_timestamp() AS at),
      recent AS MATERIALIZED (
        SELECT s.email_tag,s.ciphertext,s.nonce,s.auth_tag,s.state,
          s.source,s.requested_at,(r.email_tag IS NOT NULL) AS revoked
        FROM newsletter_new.subscribers s
        LEFT JOIN newsletter_new.revocations r ON r.email_tag=s.email_tag
        CROSS JOIN snap
        WHERE s.requested_at>snap.at-interval '24 hours'
          AND s.requested_at<=snap.at
      )
      SELECT recent.*,
        count(*) OVER()::text AS total24,
        count(*) FILTER (
          WHERE requested_at>(SELECT at FROM snap)-interval '2 hours'
        ) OVER()::text AS total2
      FROM recent ORDER BY requested_at DESC,email_tag DESC LIMIT 51
    `,[],null);
    if(rows.length>51)throw fault('invalid_provider_response');
    const nonnegative=value=>{
      if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value))
        throw fault('invalid_provider_response');
      const n=Number(value);
      if(!Number.isSafeInteger(n))throw fault('invalid_provider_response');
      return n;
    };
    const total24=rows.length?nonnegative(rows[0].total24):0;
    const total2=rows.length?nonnegative(rows[0].total2):0;
    if(total2>total24||total24<rows.length||rows.length!==Math.min(51,total24))
      throw fault('invalid_provider_response');
    const items=rows.slice(0,50).map(row=>{
      if(!['pending','active'].includes(row.state)||
         typeof row.revoked!=='boolean'||
         typeof row.source!=='string'||!/^[a-z_]{1,40}$/.test(row.source))
        throw fault('invalid_provider_response');
      const time=row.requested_at instanceof Date?row.requested_at:
        new Date(String(row.requested_at));
      if(!Number.isFinite(time.getTime()))throw fault('invalid_provider_response');
      return {email:decrypt(row),state:row.revoked?'unsubscribed':row.state,
        requestedAt:time.toISOString(),source:row.source};
    });
    return {ok:true,scope:'new_only_global',total24,total2,
      items,hasMore:total24>50,fetchedAt:new Date().toISOString(),
      note:'latest_request_date_not_all_attempts'};
  }

  const readConsent=async(emailTag,{signal,limit=20}={})=>{
    if(!hex64.test(emailTag) || !Number.isInteger(limit) || limit<1 || limit>20)
      throw fault('invalid_request');
    const rows=await query(`
      SELECT s.state,s.confirmed_at,s.source,s.consent_version,
        (r.email_tag IS NOT NULL) AS revoked
      FROM newsletter_new.subscribers s
      LEFT JOIN newsletter_new.revocations r ON r.email_tag=s.email_tag
      WHERE s.email_tag=$1
    `,[emailTag],signal);
    if(rows.length!==1)return null;
    const row=rows[0];
    if(!['pending','active'].includes(row.state)||typeof row.revoked!=='boolean')
      throw fault('invalid_provider_response');
    const events=await query(`
      SELECT event_type AS type, recorded_at AS at, source, consent_version
      FROM newsletter_new.consent_events WHERE email_tag=$1
      UNION ALL
      SELECT 'unsubscribed' AS type, recorded_at AS at,
        NULL::varchar(40) AS source,NULL::varchar(64) AS consent_version
      FROM newsletter_new.revocations
      WHERE email_tag=$1
      ORDER BY at DESC LIMIT $2
    `,[emailTag,limit],signal);
    return {state:row.revoked?'unsubscribed':row.state==='active'?'subscribed':'pending',
      source:row.source,consentVersion:row.consent_version,
      events:events.map(e=>({
        type:e.type,at:e.at instanceof Date?e.at.toISOString():String(e.at),
        source:e.source??null,consentVersion:e.consent_version??null
      }))};
  };
  return Object.freeze({adapter,subjectHash,readConsent,readRecent});
}
