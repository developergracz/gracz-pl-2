import pg from 'pg';
const {Pool}=pg;

function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}

async function sendWelcomeEmail({to,nick,position}){
  const apiKey=String(process.env.RESEND_API_KEY||'').trim();
  const from=String(process.env.NEWSLETTER_FROM_EMAIL||'Gracz.pl <newsletter@gracz.pl>').trim();
  if(!apiKey)return {sent:false,reason:'EMAIL_PROVIDER_NOT_CONFIGURED'};
  const safeEmail=escapeHtml(to);
  const safeNick=escapeHtml(nick||'nie podano');
  const safePosition=Number.isFinite(position)&&position>0?position:null;
  const listText=safePosition?`Jesteś użytkownikiem nr ${safePosition} na aktywnej liście startowej.`:'Twój zapis na listę startową jest aktywny.';
  const html=`<!doctype html><html lang="pl"><body style="margin:0;background:#071015;color:#eef6f2;font-family:Arial,sans-serif"><div style="max-width:760px;margin:0 auto;padding:42px 28px"><div style="font-size:34px;font-weight:900;margin-bottom:44px">Gracz.<span style="color:#45e889">pl</span></div><h1 style="font-size:34px;line-height:1.15;margin:0 0 22px">Witamy na liście startowej Gracz.pl!</h1><p style="font-size:18px;line-height:1.55;color:#dbe8e1">Dziękujemy za zapis do newslettera i listy pierwszych użytkowników naszej platformy gier multiplayer.</p><div style="margin:34px 0;padding:28px;border:1px solid #28503f;border-radius:16px;background:#0d181d"><p style="font-size:18px;margin:0 0 14px"><strong>Adres e-mail:</strong> ${safeEmail}</p><p style="font-size:18px;margin:0 0 14px"><strong>Zarezerwowany nick:</strong> ${safeNick}</p><p style="font-size:18px;margin:0"><strong>Miejsce na liście:</strong> ${escapeHtml(listText)}</p></div><p style="font-size:18px;line-height:1.55;color:#dbe8e1">Będziemy informować Cię o najważniejszych etapach budowy Gracz.pl, testach gier, nowych funkcjach oraz terminie uruchomienia platformy.</p><p style="margin-top:34px"><a href="https://gracz.pl" style="display:inline-block;background:linear-gradient(180deg,#32e982,#0db95a);color:#041009;text-decoration:none;font-weight:900;padding:15px 24px;border-radius:9px">Przejdź do Gracz.pl</a></p><p style="margin-top:40px;color:#8fa199;font-size:14px;line-height:1.6">Wiadomość została wysłana, ponieważ ten adres został zapisany do newslettera Gracz.pl. Aby zrezygnować z wiadomości, skorzystaj z opcji wypisu dostępnej w serwisie.<br>Gracz.pl · Chełm Śląski, ul. Żabia 3</p></div></body></html>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({from,to:[to],subject:'Witamy na liście startowej Gracz.pl!',html})});
  if(!response.ok){const detail=await response.text().catch(()=>String(response.status));throw Object.assign(new Error(`Nie udało się wysłać e-maila potwierdzającego: ${detail}`),{code:'WELCOME_EMAIL_FAILED'});}
  const result=await response.json().catch(()=>({}));
  return {sent:true,id:result.id||null};
}

export class NewsletterService{
  constructor(connectionString){
    this.pool=connectionString?new Pool({connectionString,ssl:connectionString.includes('localhost')||connectionString.includes('127.0.0.1')?false:{rejectUnauthorized:false},max:3}):null;
    this.memory=new Map();
    this.ready=this.initialize();
  }
  async initialize(){
    if(!this.pool)return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS gracz_newsletter_subscribers(id BIGSERIAL PRIMARY KEY,email VARCHAR(254) NOT NULL UNIQUE,email_normalized VARCHAR(254) NOT NULL UNIQUE,consent_version VARCHAR(32) NOT NULL,consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),status VARCHAR(24) NOT NULL DEFAULT 'subscribed',unsubscribed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await this.pool.query(`ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS preferred_nick VARCHAR(24)`);
    await this.pool.query(`ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS preferred_nick_normalized VARCHAR(24)`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_preferred_nick_unique ON gracz_newsletter_subscribers(preferred_nick_normalized) WHERE preferred_nick_normalized IS NOT NULL AND status='subscribed'`);
  }
  normalize(email){
    const value=String(email||'').trim().toLowerCase();
    if(value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))throw Object.assign(new Error('Podaj prawidłowy adres e-mail.'),{code:'INVALID_EMAIL'});
    return value;
  }
  normalizeNick(nick,{optional=true}={}){
    const value=String(nick||'').trim();
    if(!value&&optional)return {value:null,normalized:null};
    if(!/^[A-Za-z0-9_.-]{3,24}$/.test(value))throw Object.assign(new Error('Nick może mieć 3–24 znaki: litery, cyfry, _, . lub -.'),{code:'INVALID_NICK'});
    return {value,normalized:value.toLowerCase()};
  }
  async nicknameAvailable(nick){
    const parsed=this.normalizeNick(nick,{optional:false});
    if(this.pool){
      await this.ready;
      const result=await this.pool.query(`SELECT 1 FROM gracz_newsletter_subscribers WHERE preferred_nick_normalized=$1 AND status='subscribed' LIMIT 1`,[parsed.normalized]);
      return {available:result.rowCount===0,nick:parsed.value};
    }
    for(const item of this.memory.values())if(item.preferredNickNormalized===parsed.normalized&&item.status==='subscribed')return {available:false,nick:parsed.value};
    return {available:true,nick:parsed.value};
  }
  async activeCount(){
    if(this.pool){await this.ready;const result=await this.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_newsletter_subscribers WHERE status='subscribed'`);return Number(result.rows?.[0]?.count||0)}
    return [...this.memory.values()].filter(item=>item.status==='subscribed').length;
  }
  async subscribe({email,consent,legal,preferredNick}){
    if(legal!==true)throw Object.assign(new Error('Akceptacja Regulaminu i Polityki prywatności jest wymagana.'),{code:'LEGAL_REQUIRED'});
    if(consent!==true)throw Object.assign(new Error('Zgoda na zapis jest wymagana.'),{code:'CONSENT_REQUIRED'});
    const normalized=this.normalize(email);
    const nick=this.normalizeNick(preferredNick);
    if(nick.normalized){
      const availability=await this.nicknameAvailable(nick.value);
      if(!availability.available){
        if(this.pool){
          const own=await this.pool.query(`SELECT 1 FROM gracz_newsletter_subscribers WHERE lower(email)=lower($1) AND preferred_nick_normalized=$2 LIMIT 1`,[normalized,nick.normalized]);
          if(own.rowCount===0)throw Object.assign(new Error('Ten nick jest już zarezerwowany. Wybierz inny.'),{code:'NICK_TAKEN'});
        }else{
          const own=this.memory.get(normalized);
          if(own?.preferredNickNormalized!==nick.normalized)throw Object.assign(new Error('Ten nick jest już zarezerwowany. Wybierz inny.'),{code:'NICK_TAKEN'});
        }
      }
    }
    if(this.pool){
      await this.ready;
      const client=await this.pool.connect();
      try{
        await client.query('BEGIN');
        const updated=await client.query(`UPDATE gracz_newsletter_subscribers SET email=$1,email_normalized=$1,preferred_nick=$2,preferred_nick_normalized=$3,status='subscribed',consent_version='launch-v2',consented_at=NOW(),unsubscribed_at=NULL,updated_at=NOW() WHERE lower(email)=lower($1) OR email_normalized=$1`,[normalized,nick.value,nick.normalized]);
        if(updated.rowCount===0){
          await client.query(`INSERT INTO gracz_newsletter_subscribers(email,email_normalized,preferred_nick,preferred_nick_normalized,consent_version,status,consented_at,unsubscribed_at,updated_at) VALUES($1,$1,$2,$3,'launch-v2','subscribed',NOW(),NULL,NOW())`,[normalized,nick.value,nick.normalized]);
        }
        await client.query('COMMIT');
      }catch(error){
        await client.query('ROLLBACK');
        if(error?.code==='23505'){
          const detail=String(error.detail||'').toLowerCase();
          if(detail.includes('preferred_nick')||detail.includes('nick'))throw Object.assign(new Error('Ten nick jest już zarezerwowany. Wybierz inny.'),{code:'NICK_TAKEN'});
          throw Object.assign(new Error('Ten adres e-mail jest już zapisany na liście.'),{code:'EMAIL_EXISTS'});
        }
        throw error;
      }finally{client.release();}
    }else this.memory.set(normalized,{email:normalized,preferredNick:nick.value,preferredNickNormalized:nick.normalized,status:'subscribed',consentedAt:new Date().toISOString()});
    const position=await this.activeCount();
    let emailDelivery={sent:false};
    try{emailDelivery=await sendWelcomeEmail({to:normalized,nick:nick.value,position});}catch(error){console.error('[newsletter] welcome email failed',error);emailDelivery={sent:false,reason:error.code||'WELCOME_EMAIL_FAILED'};}
    return {ok:true,emailSent:emailDelivery.sent,message:nick.value?`Dziękujemy! Zapisano e-mail i zgłoszono nick „${nick.value}” do rezerwacji.`:'Dziękujemy! Jesteś na liście startowej Gracz.pl.'};
  }
  async unsubscribe(email){
    const normalized=this.normalize(email);
    if(this.pool){await this.ready;await this.pool.query(`UPDATE gracz_newsletter_subscribers SET status='unsubscribed',unsubscribed_at=NOW(),updated_at=NOW() WHERE email_normalized=$1 OR lower(email)=lower($1)`,[normalized]);}
    else this.memory.delete(normalized);
    return {ok:true};
  }
  async close(){if(this.pool)await this.pool.end();}
}

async function verifyTurnstile(secretKey,token){
  if(!secretKey)return true;
  if(!token)throw Object.assign(new Error('Nie udało się potwierdzić zabezpieczenia formularza. Spróbuj ponownie.'),{code:'TURNSTILE_REQUIRED'});
  const payload=new URLSearchParams({secret:secretKey,response:String(token)});
  let verification;
  try{
    const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:payload,signal:AbortSignal.timeout(8000)});
    if(!result.ok)throw new Error(`Turnstile Siteverify HTTP ${result.status}`);
    verification=await result.json();
  }catch(error){throw Object.assign(new Error('Weryfikacja zabezpieczenia jest chwilowo niedostępna. Spróbuj ponownie za moment.'),{code:'TURNSTILE_UNAVAILABLE',cause:error});}
  if(verification?.success!==true)throw Object.assign(new Error('Weryfikacja bezpieczeństwa nie powiodła się. Spróbuj ponownie.'),{code:'TURNSTILE_FAILED'});
  return true;
}

function requestHostname(request){const forwarded=String(request.headers['x-forwarded-host']||'').split(',')[0].trim();const raw=forwarded||String(request.headers.host||'');return raw.toLowerCase().split(':')[0]}
function isProductionNewsletterHost(hostname){return hostname==='gracz.pl'||hostname==='www.gracz.pl'}
function sendJson(response,status,body){response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify(body));return true}

export function createNewsletterHandler(service,{siteKey=process.env.TURNSTILE_SITE_KEY||'',secretKey=process.env.TURNSTILE_SECRET_KEY||''}={}){
  const turnstileConfigured=Boolean(siteKey&&secretKey);
  return async(request,response)=>{
    const url=new URL(request.url,'http://localhost');
    const hostname=requestHostname(request);
    const turnstileEnabled=turnstileConfigured&&isProductionNewsletterHost(hostname);
    if(request.method==='GET'&&url.pathname==='/newsletter/challenge-config')return sendJson(response,200,{enabled:turnstileEnabled,provider:turnstileEnabled?'turnstile':null,siteKey:turnstileEnabled?siteKey:null});
    if(request.method==='GET'&&url.pathname==='/newsletter/nick-availability'){
      try{return sendJson(response,200,await service.nicknameAvailable(url.searchParams.get('nick')||''));}
      catch(error){return sendJson(response,400,{error:{code:error.code||'INVALID_NICK',message:error.message||'Nie udało się sprawdzić nicku.'}})}
    }
    if(request.method!=='POST'||url.pathname!=='/newsletter/subscribe')return false;
    let raw='';for await(const chunk of request){raw+=chunk;if(raw.length>10_000)throw Object.assign(new Error('Żądanie jest zbyt duże.'),{code:'REQUEST_TOO_LARGE'})}
    let body;try{body=JSON.parse(raw||'{}')}catch{body={}}
    try{
      if(turnstileEnabled)await verifyTurnstile(secretKey,body.challengeToken);
      return sendJson(response,201,await service.subscribe(body));
    }catch(error){const securityError=String(error.code||'').startsWith('TURNSTILE_');return sendJson(response,securityError?403:400,{error:{code:error.code||'NEWSLETTER_ERROR',message:error.message||'Nie udało się zapisać.'}})}
  };
}
