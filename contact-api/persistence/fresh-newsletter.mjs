import {
  createCipheriv,createDecipheriv,createHmac,hkdfSync,randomBytes,randomUUID,timingSafeEqual
} from 'node:crypto';

// Fresh consent has no dependency on legacy n1/ns1 keys, historic identity hashes or F03.
const CONSENT_VERSION='gracz-fresh-optin-r1-2026-10-20';
const TTL_MS=30*60*1000;
function refuse() {
  const error=new Error('FRESH_PROOF_REJECTED');
  error.code='FRESH_PROOF_REJECTED';return error;
}
function emailAddress(value) {
  if(typeof value!=='string'||value!==value.trim().toLowerCase()||
    value.length>254||!/^[a-z0-9.!#$%&'*+/=?^`{|}~-]{1,64}@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(value))
    throw refuse();
  return value;
}
function purpose(root,name) {
  return Buffer.from(hkdfSync('sha256',root,Buffer.from('gracz-fresh-only-v1'),
    Buffer.from(name),32));
}
function hash(key,value) {
  return createHmac('sha256',key).update(value,'utf8').digest('hex');
}
function keysFrom(root) {
  if(!Buffer.isBuffer(root)||root.length!==32)throw new TypeError('Fresh-only independent 32-byte key required');
  return Object.freeze({identity:purpose(root,'recipient'),challenge:purpose(root,'challenge'),encryption:purpose(root,'encrypted-mailbox')});
}

export function createFreshNewsletter({database,rootKey,mailer,provider,now=()=>Date.now()}={}) {
  if(typeof database?.transaction!=='function'||typeof database?.query!=='function'||
     typeof database?.queryBounded!=='function'||typeof mailer?.send!=='function'||
     typeof provider?.isEligible!=='function'||typeof provider?.enroll!=='function')
    throw new TypeError('Fresh-only signup requires durable storage and dedicated provider interfaces');
  const keys=keysFrom(rootKey);
  const recipientTag=email=>hash(keys.identity,'recipient\0'+email);
  const proofTag=(id,token)=>hash(keys.challenge,'confirm\0'+id+'\0'+token);
  function seal(email,id) {
    const nonce=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',keys.encryption,nonce);
    cipher.setAAD(Buffer.from('fresh-consent\0'+id));
    const ciphertext=Buffer.concat([cipher.update(email,'utf8'),cipher.final()]);
    return {nonce,ciphertext,authTag:cipher.getAuthTag()};
  }
  function unseal(row) {
    try {
      const cipher=createDecipheriv('aes-256-gcm',keys.encryption,row.nonce);
      cipher.setAAD(Buffer.from('fresh-consent\0'+row.challenge_id));
      cipher.setAuthTag(row.auth_tag);
      return emailAddress(Buffer.concat([cipher.update(row.ciphertext),cipher.final()]).toString('utf8'));
    }catch{throw refuse();}
  }
  const neutral=Object.freeze({state:'request_received'});
  return Object.freeze({
    async readiness() {
      try {
        const result=await database.queryBounded(
          'WITH checked AS (SELECT 1 FROM newsletter_fresh.challenges c '+
          'CROSS JOIN newsletter_fresh.mail_budget b '+
          'CROSS JOIN newsletter_fresh.consent_events e '+
          'CROSS JOIN newsletter_fresh.provider_intents p LIMIT 0) '+
          'SELECT count(*)::int AS n FROM checked'
        );
        return result.rowCount===1&&result.rows[0]?.n===0;
      }catch{return false;}
    },
    async request({email,source='newsletter_page'}={}) {
      const recipient=emailAddress(email);
      if(!['newsletter_page','footer'].includes(source))throw refuse();
      // A previous Resend contact, suppression, or unknown provider result is
      // never treated as a new subscriber. No legacy table is read or changed.
      try {if(!await provider.isEligible(recipient))return neutral;}catch{return neutral;}
      const tag=recipientTag(recipient);
      const item=await database.transaction(async client=>{
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['gracz-fresh-v1:'+tag]);
        const already=await client.query(
          'SELECT 1 FROM newsletter_fresh.consent_events WHERE recipient_tag=$1 LIMIT 1',[tag]);
        if(already.rowCount)return null;
        const recent=await client.query(
          "SELECT 1 FROM newsletter_fresh.challenges WHERE recipient_tag=$1 "+
          "AND (issued_at>clock_timestamp()-interval '15 minutes' OR "+
          "mail_state IN ('inflight','unknown')) LIMIT 1",[tag]);
        if(recent.rowCount)return null;
        const budget=await client.query(
          'INSERT INTO newsletter_fresh.mail_budget(hour_bucket,count) '+
          "VALUES(date_trunc('hour',clock_timestamp()),1) "+
          'ON CONFLICT(hour_bucket) DO UPDATE SET count=newsletter_fresh.mail_budget.count+1 '+
          'WHERE newsletter_fresh.mail_budget.count<60 RETURNING count'
        );
        if(budget.rowCount!==1)return null;
        const id=randomUUID(),token=randomBytes(32).toString('base64url');
        const encrypted=seal(recipient,id);
        await client.query(
          'INSERT INTO newsletter_fresh.challenges '+
          '(challenge_id,recipient_tag,token_tag,ciphertext,nonce,auth_tag,source,consent_version,expires_at) '+
          'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [id,tag,proofTag(id,token),encrypted.ciphertext,encrypted.nonce,
            encrypted.authTag,source,CONSENT_VERSION,new Date(now()+TTL_MS)]
        );
        return {id,token,email:recipient};
      });
      if(!item)return neutral;
      // Inflight intent is durable before the external send. Never auto-retry an unknown ACK.
      let delivered=false;
      try {delivered=await mailer.send(item)===true;}catch{}
      try {
        await database.query('UPDATE newsletter_fresh.challenges SET mail_state=$2 '+
          "WHERE challenge_id=$1 AND mail_state='inflight'",
          [item.id,delivered?'sent':'unknown']);
      }catch {/* Existing inflight intent remains fenced. */}
      return neutral;
    },
    async confirm({id,token}={}) {
      if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||
         typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||
         Buffer.from(token,'base64url').length!==32)throw refuse();
      const email=await database.transaction(async client=>{
        const row=await client.query(
          'SELECT challenge_id,recipient_tag,token_tag,ciphertext,nonce,auth_tag,consent_version '+
          'FROM newsletter_fresh.challenges WHERE challenge_id=$1 '+
          'AND expires_at>clock_timestamp() AND consumed_at IS NULL '+
          "AND mail_state IN ('inflight','sent') FOR UPDATE",[id]);
        if(row.rowCount!==1)throw refuse();
        const item=row.rows[0];
        const expected=Buffer.from(item.token_tag,'hex');
        const actual=Buffer.from(proofTag(id,token),'hex');
        if(expected.length!==32||!timingSafeEqual(expected,actual))throw refuse();
        const address=unseal(item);
        if(recipientTag(address)!==item.recipient_tag||item.consent_version!==CONSENT_VERSION)throw refuse();
        // The consent evidence and the provider intent commit atomically.
        await client.query(
          'INSERT INTO newsletter_fresh.consent_events(event_id,challenge_id,recipient_tag,consent_version) '+
          'VALUES($1,$2,$3,$4)',[randomUUID(),id,item.recipient_tag,CONSENT_VERSION]);
        await client.query(
          'INSERT INTO newsletter_fresh.provider_intents(challenge_id) VALUES($1)',[id]);
        await client.query(
          'UPDATE newsletter_fresh.challenges SET consumed_at=clock_timestamp() WHERE challenge_id=$1',[id]);
        return address;
      });
      let activated=false;
      try {activated=await provider.enroll(email)===true;}catch{}
      if(activated) {
        try {
          await database.query('UPDATE newsletter_fresh.provider_intents '+
            "SET state='active',verified_at=clock_timestamp() WHERE challenge_id=$1 AND state='pending'",[id]);
        }catch{activated=false;}
      }
      // Never claim an active subscription after a failed or ambiguous provider write.
      return {state:activated?'subscribed':'provider_pending',confirmed:activated};
    }
  });
}

export function createFreshResend({sendKey,manageKey,emailFrom,segmentId,topicId,request=fetch}={}) {
  if(!sendKey||!manageKey||!emailFrom||!segmentId||typeof request!=='function')
    throw new TypeError('Fresh-only Resend requires separate sender/manager keys and a dedicated segment');
  const base='https://api.resend.com';
  async function call(method,path,body,manager=false,idempotency=null) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try {
      const response=await request(base+path,{method,redirect:'error',signal:controller.signal,
        headers:{Authorization:'Bearer '+(manager?manageKey:sendKey),
          'Content-Type':'application/json',
          ...(idempotency?{'Idempotency-Key':idempotency}:{})},
        ...(body?{body:JSON.stringify(body)}:{})});
      if(response.status===404)return {found:false};
      if(response.status<200||response.status>=300)throw new Error('FRESH_PROVIDER_UNAVAILABLE');
      const data=await response.json();
      return {found:true,data};
    }finally{clearTimeout(timer);}
  }
  const addressPath=email=>encodeURIComponent(email);
  async function isEligible(email) {
    const suppression=await call('GET','/suppressions/'+addressPath(email),null,true);
    if(suppression.found)return false;
    const contact=await call('GET','/contacts/'+addressPath(email),null,true);
    return !contact.found;
  }
  return Object.freeze({
    async isEligible(email){return isEligible(email);},
    async send({email,id,token}) {
      const url='https://gracz.pl/newsletter/#fresh-confirm='+id+'.'+token;
      const body={from:emailFrom,to:[email],
        subject:'gracz.pl — potwierdź nowy zapis do newslettera',
        text:'Aby wyrazić zgodę na newsletter gracz.pl, otwórz link i kliknij Potwierdź zapis: '+url+
        '\nLink ważny 30 minut. Jeśli nie prosiłeś o zapis, zignoruj wiadomość.'};
      const result=await call('POST','/emails',body,false,'gracz-fresh-doi-'+id);
      return Boolean(result.found&&result.data?.id);
    },
    async enroll(email) {
      // Existing provider contact, even if not unsubscribed, always stays on HOLD.
      if(!await isEligible(email))return false;
      const body={email,unsubscribed:false,segments:[{id:segmentId}],
        ...(topicId?{topics:[{id:topicId,subscription:'opt_in'}]}:{})};
      const result=await call('POST','/contacts',body,true);
      if(!result.found)return false;
      // Read-back must independently prove membership and absence of suppression.
      const suppressed=await call('GET','/suppressions/'+addressPath(email),null,true);
      if(suppressed.found)return false;
      const contact=await call('GET','/contacts/'+addressPath(email),null,true);
      if(!contact.found||contact.data?.unsubscribed!==false)return false;
      const membership=await call('GET','/contacts/'+addressPath(email)+'/segments',null,true);
      const list=membership.data?.data;
      return Array.isArray(list)&&list.some(s=>s.id===segmentId);
    }
  });
}
