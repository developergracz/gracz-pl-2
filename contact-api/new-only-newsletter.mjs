import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const CONSENT_VERSION = 'newsletter-new-only-2026-10-20';
const CONFIRM_TTL_MS = 30 * 60 * 1000;
const STATUS_TTL_MS = 15 * 60 * 1000;
const MAX_STATUS_MAILS_PER_HOUR = 15;
const MAX_CONFIRM_MAILS_PER_HOUR = 60;

function decodeNewKey(raw) {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const key = Buffer.from(raw, 'base64url');
  return key.length === 32 && key.toString('base64url') === raw ? key : null;
}

function unavailable() {
  return Object.assign(new Error('Newsletter jest chwilowo niedostępny.'), {
    code: 'NEWSLETTER_NEW_NOT_READY', status: 503,
  });
}

function rejected() {
  return Object.assign(new Error('Nieprawidłowy lub wykorzystany link.'), {
    code: 'NEWSLETTER_CONFIRM_REJECTED', status: 400,
  });
}

export function createNewOnlyNewsletter({
  database,
  enabled = process.env.NEWSLETTER_NEW_ONLY_ENABLED === '1',
  encryptionKey = process.env.NEWSLETTER_NEW_ENCRYPTION_KEY,
  subjectKey = process.env.NEWSLETTER_NEW_SUBJECT_KEY,
  apiKey = process.env.RESEND_API_KEY,
  emailFrom = process.env.EMAIL_FROM,
  baseUrl = 'https://gracz.pl/newsletter/',
  fetchFn = globalThis.fetch,
} = {}) {
  const enc = decodeNewKey(encryptionKey);
  const tagKey = decodeNewKey(subjectKey);
  const configured = Boolean(enabled && database?.enabled && enc && tagKey &&
    !timingSafeEqual(enc || Buffer.alloc(32), tagKey || Buffer.alloc(32)) &&
    String(apiKey || '').trim() && String(emailFrom || '').trim() &&
    typeof fetchFn === 'function' && baseUrl === 'https://gracz.pl/newsletter/');
  const tag = (purpose, value) => createHmac('sha256', tagKey)
    .update('gracz-new-only:' + purpose + '\n' + value).digest('hex');

  let lastReadyAt = 0;
  let lastReady = false;
  async function readiness() {
    if (!configured) return Object.freeze({ready:false, configured:false,
      schemaReady:false,intakePaused:true,newOnly:true});
    if (Date.now() - lastReadyAt > 5000) {
      // Real permissions and schema probe; never rely on a mere table-name check.
      try {
        const checked = await database.queryBounded(`
          SELECT has_schema_privilege(current_user,'newsletter_new','USAGE')
            AND has_table_privilege(current_user,'newsletter_new.subscribers','SELECT')
            AND has_table_privilege(current_user,'newsletter_new.subscribers','INSERT')
            AND has_table_privilege(current_user,'newsletter_new.subscribers','UPDATE')
            AND has_table_privilege(current_user,'newsletter_new.mail_budget','INSERT')
            AND has_table_privilege(current_user,'newsletter_new.mail_budget','UPDATE')
            AND has_table_privilege(current_user,'newsletter_new.consent_events','INSERT')
            AND has_table_privilege(current_user,'newsletter_new.revocations','SELECT')
            AND has_table_privilege(current_user,'newsletter_new.revocations','INSERT') AS allowed
        `, [], {timeoutMs:2000});
        lastReady = checked.rows?.[0]?.allowed === true;
      } catch { lastReady = false; }
      lastReadyAt = Date.now();
    }
    return Object.freeze({ready:lastReady,configured:true,
      schemaReady:lastReady,intakePaused:!lastReady,newOnly:true});
  }
  async function requireReady() {
    if (!(await readiness()).ready) throw unavailable();
  }

  function encryptedEmail(email) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', enc, nonce);
    cipher.setAAD(Buffer.from('gracz-newsletter-new:' + tag('email',email)));
    const ciphertext = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()]);
    return {nonce, ciphertext, authTag:cipher.getAuthTag()};
  }

  async function acceptOptIn({email, source = 'newsletter_page'} = {}) {
    await requireReady();
    const mailbox = String(email || '').trim().toLowerCase();
    if (mailbox.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox))
      throw Object.assign(new Error('Nieprawidłowy e-mail.'),{status:400,code:'INVALID_EMAIL'});
    const safeSource = /^[a-z_]{1,40}$/.test(source) ? source : 'newsletter_page';
    const emailTag = tag('email',mailbox);
    const rawToken = randomBytes(32).toString('base64url');
    const challengeId = randomUUID();
    const tokenTag = tag('token',challengeId + ':' + rawToken);
    const envelope = encryptedEmail(mailbox);
    const expiresAt = new Date(Date.now()+CONFIRM_TTL_MS);
    // One atomic reservation of recipient + account-wide hourly delivery budget.
    // Any subsequent uncertain provider effect is fenced until TTL expiry.
    const accepted = await database.transaction(async client => {
      // Serialize new enrollment with an existing verified withdrawal.
      await client.query(
        'SELECT email_tag FROM newsletter_new.subscribers WHERE email_tag=$1 FOR UPDATE',
        [emailTag]);
      const blocked = await client.query(
        'SELECT 1 FROM newsletter_new.revocations WHERE email_tag=$1',
        [emailTag]);
      if (blocked.rowCount) return false;
      const insert = await client.query(`
        INSERT INTO newsletter_new.subscribers
          (email_tag,ciphertext,nonce,auth_tag,challenge_id,token_tag,state,
           delivery_state,source,consent_version,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,'pending','uncertain',$7,$8,$9)
        ON CONFLICT (email_tag) DO NOTHING RETURNING email_tag
      `,[emailTag,envelope.ciphertext,envelope.nonce,envelope.authTag,
        challengeId,tokenTag,safeSource,CONSENT_VERSION,expiresAt]);
      if (!insert.rowCount) {
        const row = (await client.query(
          'SELECT state,expires_at FROM newsletter_new.subscribers WHERE email_tag=$1 FOR UPDATE',
          [emailTag])).rows[0];
        // Report only an existing ACTIVE row. The unique-row lock keeps
        // the lookup and reservation atomic under simultaneous submissions.
        if (row?.state === 'active') return 'already_subscribed';
        if (!row || Date.parse(row.expires_at) > Date.now()) return false;
        await client.query(`
          UPDATE newsletter_new.subscribers
          SET ciphertext=$2,nonce=$3,auth_tag=$4,challenge_id=$5,token_tag=$6,
              state='pending',delivery_state='uncertain',source=$7,
              consent_version=$8,requested_at=clock_timestamp(),
              expires_at=$9,confirmed_at=NULL WHERE email_tag=$1
        `,[emailTag,envelope.ciphertext,envelope.nonce,envelope.authTag,
          challengeId,tokenTag,safeSource,CONSENT_VERSION,expiresAt]);
      }
      const budget = await client.query(`
        INSERT INTO newsletter_new.mail_budget(hour_bucket,used)
        VALUES (date_trunc('hour',clock_timestamp()),1)
        ON CONFLICT (hour_bucket) DO UPDATE
          SET used=newsletter_new.mail_budget.used+1
          WHERE newsletter_new.mail_budget.used < $1
        RETURNING used
      `,[MAX_CONFIRM_MAILS_PER_HOUR]);
      if (budget.rowCount !== 1) throw unavailable();
      return true;
    });
    if (accepted === 'already_subscribed') return {state:'already_subscribed'};
    if (!accepted) return {state:'request_received'};

    const url = baseUrl + '#confirm=ni3.' + challengeId + '.' + rawToken;
    // Transactional confirmation only. This does NOT register legacy contacts,
    // create a marketing audience or send a newsletter.
    const response = await fetchFn('https://api.resend.com/emails', {
      method:'POST',
      headers:{
        Authorization:'Bearer ' + apiKey,
        'Content-Type':'application/json',
        'Idempotency-Key':'newsletter-new/' + challengeId,
      },
      body:JSON.stringify({
        from:emailFrom, to:[mailbox],
        subject:'gracz.pl — potwierdź zapis do newslettera',
        text:'Aby potwierdzić nową zgodę na newsletter gracz.pl, otwórz link: '+url+
          '\n\nLink jest ważny 30 minut. Jeśli to nie Ty, zignoruj wiadomość.\n'+
          'Informacje o prywatności: https://gracz.pl/polityka-prywatnosci/',
      }),
      signal:AbortSignal.timeout(10000),
    });
    if (!response.ok) throw unavailable();
    const receipt = await response.json().catch(() => null);
    if (typeof receipt?.id !== 'string' || !receipt.id) throw unavailable();
    const sent = await database.query(`
      UPDATE newsletter_new.subscribers SET delivery_state='sent'
      WHERE email_tag=$1 AND challenge_id=$2 AND state='pending'
    `,[emailTag,challengeId]);
    if (sent.rowCount !== 1) throw unavailable();
    return {state:'request_received'};
  }

  async function confirm(token) {
    await requireReady();
    const parts = /^ni3\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/.exec(String(token || ''));
    if (!parts) throw rejected();
    const tokenTag = tag('token',parts[1]+':'+parts[2]);
    return database.transaction(async client => {
      const result = await client.query(`
        SELECT email_tag,token_tag,state,delivery_state,expires_at,
               source,consent_version
        FROM newsletter_new.subscribers WHERE challenge_id=$1 FOR UPDATE
      `,[parts[1]]);
      const row = result.rows[0];
      if (!row || row.state !== 'pending' || row.delivery_state !== 'sent' ||
          !row.token_tag || Date.parse(row.expires_at) <= Date.now() ||
          !timingSafeEqual(Buffer.from(row.token_tag,'hex'),Buffer.from(tokenTag,'hex')))
        throw rejected();
      const blocked = await client.query(
        'SELECT 1 FROM newsletter_new.revocations WHERE email_tag=$1',
        [row.email_tag]);
      if (blocked.rowCount) throw rejected();
      await client.query(`
        UPDATE newsletter_new.subscribers
        SET state='active',token_tag=NULL,confirmed_at=clock_timestamp()
        WHERE challenge_id=$1 AND state='pending'
      `,[parts[1]]);
      await client.query(`
        INSERT INTO newsletter_new.consent_events
          (event_id,email_tag,challenge_id,event_type,consent_version,source)
        VALUES ($1,$2,$3,'opt_in_confirmed',$4,$5)
      `,[randomUUID(),row.email_tag,parts[1],row.consent_version,row.source]);
      return {state:'subscribed'};
    });
  }
  // Called only after a verified one-time withdrawal challenge, inside its
  // PostgreSQL transaction. No historical subscriber records are accessed.
  async function recordVerifiedWithdrawal({client,email,challengeId}={}) {
    if (!database?.enabled || !tagKey) return;
    if (typeof client?.query !== 'function' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(challengeId||'')))
      throw unavailable();
    const recipient = String(email || '').trim().toLowerCase();
    if (recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
      throw unavailable();
    const emailTag = tag('email',recipient);
    const existing = await client.query(
      'SELECT email_tag FROM newsletter_new.subscribers WHERE email_tag=$1 FOR UPDATE',
      [emailTag]);
    if (!existing.rowCount) return;
    await client.query(
      'INSERT INTO newsletter_new.revocations (email_tag,challenge_id) VALUES ($1,$2) '+
      'ON CONFLICT (email_tag) DO NOTHING',
      [emailTag,challengeId]);
  }
  // An anonymous POST must never disclose whether an address exists.
  // Status is returned only to the holder of an encrypted, short-lived
  // mailbox-delivered bearer proof. No new DB table or consent mutation.
  async function acceptStatus({email}={}) {
    await requireReady();
    const mailbox=String(email||'').trim().toLowerCase();
    if(mailbox.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox))
      throw Object.assign(new Error('Nieprawidłowy e-mail.'),{status:400,code:'INVALID_EMAIL'});
    const nonce=randomBytes(12);
    const cipher=createCipheriv('aes-256-gcm',enc,nonce);
    cipher.setAAD(Buffer.from('gracz-new-only:status:v1'));
    const ciphertext=Buffer.concat([cipher.update(JSON.stringify({
      mailbox,issued:Date.now()
    }),'utf8'),cipher.final()]);
    const proof='ns2.'+nonce.toString('base64url')+'.'+ciphertext.toString('base64url')+
      '.'+cipher.getAuthTag().toString('base64url');
    // Shared existing global send budget, also used by DOI.
    await database.transaction(async client=>{
      const budget=await client.query(`
        INSERT INTO newsletter_new.mail_budget(hour_bucket,used)
        VALUES (date_trunc('hour',clock_timestamp()),1)
        ON CONFLICT (hour_bucket) DO UPDATE
          SET used=newsletter_new.mail_budget.used+1
          WHERE newsletter_new.mail_budget.used < $1
        RETURNING used
      `,[MAX_STATUS_MAILS_PER_HOUR]);
      if(budget.rowCount!==1)throw unavailable();
    });
    const response=await fetchFn('https://api.resend.com/emails',{
      method:'POST',
      headers:{
        Authorization:'Bearer '+apiKey,'Content-Type':'application/json',
        'Idempotency-Key':'newsletter-status/'+createHash('sha256').update(proof).digest('hex')
      },
      body:JSON.stringify({
        from:emailFrom,to:[mailbox],subject:'gracz.pl — bezpieczne sprawdzenie newslettera',
        text:'Aby sprawdzić status swojej subskrypcji newslettera gracz.pl, otwórz link: '+
          baseUrl+'#status='+proof+
          '\n\nLink jest ważny 15 minut. Nie zmienia subskrypcji. Jeśli to nie Ty, zignoruj wiadomość.'
      }),
      signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)throw unavailable();
    const receipt=await response.json().catch(()=>null);
    if(typeof receipt?.id!=='string'||!receipt.id)throw unavailable();
    return {state:'request_received'};
  }
  async function checkStatus(token){
    await requireReady();
    const invalid=()=>Object.assign(new Error('Nieważny lub wygasły link do statusu.'),{
      code:'NEWSLETTER_STATUS_REJECTED',status:400
    });
    const parts=/^ns2[.]([A-Za-z0-9_-]{16})[.]([A-Za-z0-9_-]{1,600})[.]([A-Za-z0-9_-]{22})$/.exec(String(token||''));
    if(!parts)throw invalid();
    let payload;
    try{
      const decipher=createDecipheriv('aes-256-gcm',enc,Buffer.from(parts[1],'base64url'));
      decipher.setAAD(Buffer.from('gracz-new-only:status:v1'));
      decipher.setAuthTag(Buffer.from(parts[3],'base64url'));
      const data=Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]);
      payload=JSON.parse(data.toString('utf8'));
    }catch{throw invalid();}
    if(!payload||typeof payload.mailbox!=='string'||payload.mailbox.length>254||
      !/^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(payload.mailbox)||
      !Number.isSafeInteger(payload.issued)||payload.issued>Date.now()||
      Date.now()-payload.issued>STATUS_TTL_MS)throw invalid();
    const found=await database.queryBounded(`
      SELECT s.state,
        EXISTS(SELECT 1 FROM newsletter_new.revocations r
               WHERE r.email_tag=s.email_tag) AS withdrawn
      FROM newsletter_new.subscribers s WHERE s.email_tag=$1
    `,[tag('email',payload.mailbox)],{timeoutMs:2000});
    const row=found.rows?.[0];
    const state=!row||row.withdrawn?'inactive':
      row.state==='active'?'active':row.state==='pending'?'pending':'inactive';
    return {state};
  }
  async function held() { throw unavailable(); }
  return Object.freeze({
    enabled:configured,
    intakePaused:!configured,
    consentLedgerConfigured:configured,
    acceptOptIn,requestOptIn:acceptOptIn,confirm,readiness,recordVerifiedWithdrawal,
    acceptStatus,checkStatus,unsubscribe:held,
    stopAccepting(){},async waitForPublicWork(){},
  });
}
