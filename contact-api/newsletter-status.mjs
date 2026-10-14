import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

const TTL = 10 * 60 * 1000;
const AAD = Buffer.from('gracz.pl/newsletter/STATUS_CHECK/v1');
const digest = value => createHash('sha256').update(value).digest('hex');
function invalid() { return Object.assign(new Error('Link jest nieprawidłowy, wygasł lub został wykorzystany.'), {code:'NEWSLETTER_STATUS_TOKEN_INVALID',status:400}); }
function unavailable() { return Object.assign(new Error('Nie można teraz sprawdzić statusu. Nie zmieniono subskrypcji.'), {code:'NEWSLETTER_STATUS_UNAVAILABLE',status:503}); }
function decode(value) {
  if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw invalid();
  const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)throw invalid();return bytes;
}

// Separate key, envelope, audience and persistence namespace from DOI/unsubscribe.
export function createMailboxStatus({secret,store,hashEmail,sendEmail,readStatus,canSend=async()=>true,baseUrl,now=Date.now}) {
  const key=Buffer.from(hkdfSync('sha256',String(secret),AAD,Buffer.from('mailbox-proof-key'),32));
  function encrypt(data) {
    const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(AAD);
    const ciphertext=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
    return ['ns1',iv.toString('base64url'),ciphertext.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
  }
  function decrypt(token) {
    try {
      if(typeof token!=='string'||token.length>4096)throw invalid();
      const parts=token.split('.');if(parts.length!==4||parts[0]!=='ns1')throw invalid();
      const iv=decode(parts[1]), ciphertext=decode(parts[2]),tag=decode(parts[3]);
      if(iv.length!==12||tag.length!==16)throw invalid();
      const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(AAD);decipher.setAuthTag(tag);
      const data=JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));
      if(data.purpose!=='STATUS_CHECK'||data.aud!=='gracz.pl/newsletter/status-check'||
        typeof data.email!=='string'||data.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||
        typeof data.nonce!=='string'||!/^[0-9a-f]{64}$/.test(data.nonce)||
        !Number.isSafeInteger(data.iat)||!Number.isSafeInteger(data.exp)||data.exp-data.iat!==TTL||data.iat>now()||data.exp<=now())throw invalid();
      return data;
    }catch {throw invalid();}
  }
  return {
    async requestStatus({email,beforeExternalEffect=async()=>{}}) {
      if(!store)throw unavailable();
      const emailHash=hashEmail(email),requestId=randomBytes(32).toString('hex');
      const dispatch={scope:'newsletter-status-dispatch',emailHash,requestId,expiresAt:new Date(now()+TTL)};
      if(!await store.claimDispatch(dispatch))return {state:'request_received'};
      try {
        // Budget is durable and independent of subscription membership. Exhaustion
        // never bypasses the uncertain dispatch reservation or discloses membership.
        if(!await store.reserveStatusBudget({emailHash})) {
          await store.markDispatchDone(dispatch);
          return {state:'request_received'};
        }
        if(!await canSend(email)) {
          await store.markDispatchDone(dispatch);
          return {state:'request_received'};
        }
        const data={purpose:'STATUS_CHECK',aud:'gracz.pl/newsletter/status-check',email,nonce:randomBytes(32).toString('hex'),iat:now(),exp:now()+TTL};
        data.exp=data.iat+TTL;
        if(!await store.issueStatusToken({tokenHash:digest(data.nonce),emailHash,expiresAt:new Date(data.exp)}))throw unavailable();
        const link=baseUrl+'#status='+encrypt(data);
        const text='Sprawdź status newslettera gracz.pl\n\nOtwórz link i potwierdź sprawdzenie statusu swojej skrzynki. Link jest jednorazowy i ważny 10 minut. Nie zapisuje ani nie wypisuje z newslettera.\n\n'+link+'\n\nJeśli nie prosisz o sprawdzenie, zignoruj tę wiadomość.';
        await beforeExternalEffect();
        if(!await store.markDispatchEffect(dispatch))throw unavailable();
        const delivery=await sendEmail({to:email,subject:'gracz.pl — sprawdzenie statusu newslettera',text,html:'<p>Sprawdzenie statusu newslettera gracz.pl</p><p>Link jednorazowy, ważny 10 minut. Nie zmienia zgody na newsletter.</p><p><a href="'+link+'">Sprawdź status swojej skrzynki</a></p><p>Jeśli nie prosisz o sprawdzenie, zignoruj tę wiadomość.</p>',idempotencyKey:'newsletter-status/'+requestId,entityRef:'gracz-newsletter-status-'+requestId});
        if(typeof delivery?.id!=='string'||!delivery.id)throw unavailable();
        if(!await store.markDispatchDone(dispatch))throw unavailable();
        return {state:'request_received'};
      }catch(error){
        await store.releaseDispatchBeforeEffect(dispatch).catch(()=>{});
        throw error;
      }
    },
    async checkStatus(token) {
      if(!store)throw unavailable();
      const data=decrypt(token);
      let consumed;
      try {consumed=await store.consumeStatusToken({tokenHash:digest(data.nonce),emailHash:hashEmail(data.email)});}catch{throw unavailable();}
      if(!consumed)throw invalid();
      // Consume even if provider fails. Never reuse proof or guess from cached PG.
      try {return await readStatus(data.email);}catch{throw unavailable();}
    },
  };
}

// Public requests acknowledge durable admission, not provider delivery. Provider
// branches/errors run after admission and cannot become a membership timing oracle.
export function createNewsletterAdmission({store,hashEmail,requestOptIn,requestStatus,checkReady=async()=>{},logger=console,now=Date.now,intakePaused=false}) {
  const active=new Set();
  let reserved=0,stopping=false;
  const drained=new Set();
  function releaseCapacity(){reserved--;if(!reserved){for(const resolve of drained)resolve();drained.clear();}}
  async function accept(kind,payload) {
    if(intakePaused||stopping||!store||reserved>=64)throw unavailable();
    const dispatch={scope:'newsletter-public-'+kind,emailHash:hashEmail(payload.email),requestId:randomBytes(32).toString('hex'),expiresAt:new Date(now()+60000)};
    reserved++;
    let claimed;
    try {if(kind==='optin')await checkReady();claimed=await store.claimDispatch(dispatch);}catch{releaseCapacity();throw unavailable();}
    if(claimed) {
      const work=new Promise(resolve=>setImmediate(resolve)).then(async()=>{
        try {
          let marked=false;
          const beforeExternalEffect=async()=>{
            if(marked)return;
            if(!await store.markDispatchEffect(dispatch))throw unavailable();
            marked=true;
          };
          await (kind==='optin'?requestOptIn:requestStatus)({...payload,beforeExternalEffect});
          if(!await store.markDispatchDone(dispatch))throw unavailable();
        }catch {
          // Fixed code only: no provider text, token, raw email or HMAC in logs.
          const released=await store.releaseDispatchBeforeEffect(dispatch).catch(()=>false);
          logger.error('[newsletter] admitted operation unavailable',{code:released?'NEWSLETTER_PRE_EFFECT_RELEASED':'NEWSLETTER_OPERATION_UNCERTAIN',operationId:dispatch.requestId});
        }
      });
      active.add(work);work.finally(()=>{active.delete(work);releaseCapacity();});
    } else releaseCapacity();
    return {state:'request_received'};
  }
  return {acceptOptIn:payload=>accept('optin',payload),acceptStatus:payload=>accept('status',payload),
    get intakePaused(){return intakePaused||stopping;},
    stopAccepting(){stopping=true;},
    waitForPublicWork:()=>reserved?new Promise(resolve=>drained.add(resolve)):Promise.resolve()};
}
