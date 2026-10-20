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
    async readPage({after=null,limit=MAX_PAGE,signal}={}) {
      if(!Number.isInteger(limit)||limit<1||limit>MAX_PAGE||
         (after!==null&&(!hex64.test(after)))) throw fault('invalid_request');
      const rows=await query(`
        SELECT s.email_tag,s.ciphertext,s.nonce,s.auth_tag,s.state,
               s.source,s.requested_at,s.confirmed_at,
               (r.email_tag IS NOT NULL) AS revoked
        FROM newsletter_new.subscribers s
        LEFT JOIN newsletter_new.revocations r ON r.email_tag=s.email_tag
        WHERE ($1::text IS NULL OR s.email_tag < $1::text)
        ORDER BY s.email_tag DESC LIMIT $2
      `,[after,limit+1],signal);
      if(rows.length>limit+1)throw fault('invalid_provider_response');
      const page=rows.slice(0,limit);
      const ids=new Set();
      const items=page.map(row=>{
        const id=HEX(row.email_tag);
        if(!hex64.test(id)||ids.has(id) ||
           !['pending','active'].includes(row.state) ||
           typeof row.revoked!=='boolean')throw fault('invalid_provider_response');
        ids.add(id);
        const iso=value=>{
          const date=value instanceof Date?value:new Date(String(value));
          if(!Number.isFinite(date.getTime()))throw fault('invalid_provider_response');
          return date.toISOString();
        };
        if(typeof row.source!=='string'||!/^[a-z_]{1,40}$/.test(row.source)||
           !row.requested_at|| (row.state==='active'&&!row.confirmed_at))
          throw fault('invalid_provider_response');
        return {id,email:decrypt(row),
          // This is first-party consent only, NOT proven provider deliverability.
          state:row.revoked?'unsubscribed':row.state,
          requestedAt:iso(row.requested_at),
          confirmedAt:row.confirmed_at?iso(row.confirmed_at):null,
          source:row.source,
          globalUnsubscribed:null,inSegment:null,topic:null,suppressed:null};
      });
      return {items,after:rows.length>limit?items.at(-1).id:null};
    }
  });
  const readConsent=async(emailTag,{signal,limit=20}={})=>{
    if(!hex64.test(emailTag) || !Number.isInteger(limit) || limit<1 || limit>20)
      throw fault('invalid_request');
    const rows=await query(`
      SELECT s.state,s.confirmed_at,
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
      SELECT event_type AS type, recorded_at AS at FROM newsletter_new.consent_events
      WHERE email_tag=$1
      UNION ALL
      SELECT 'unsubscribed' AS type, recorded_at AS at FROM newsletter_new.revocations
      WHERE email_tag=$1
      ORDER BY at DESC LIMIT $2
    `,[emailTag,limit],signal);
    return {state:row.revoked?'unsubscribed':row.state==='active'?'subscribed':'pending',
      events:events.map(e=>({type:e.type,at:e.at instanceof Date
        ?e.at.toISOString():String(e.at)}))};
  };
  return Object.freeze({adapter,subjectHash,readConsent});
}
