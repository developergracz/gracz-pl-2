import pg from 'pg';
const {Pool}=pg;

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
  async subscribe({email,consent,legal,preferredNick}){
    if(legal!==true)throw Object.assign(new Error('Akceptacja Regulaminu i Polityki prywatności jest wymagana.'),{code:'LEGAL_REQUIRED'});
    if(consent!==true)throw Object.assign(new Error('Zgoda na zapis jest wymagana.'),{code:'CONSENT_REQUIRED'});
    const normalized=this.normalize(email);
    const nick=this.normalizeNick(preferredNick);
    if(nick.normalized){
      const availability=await this.nicknameAvailable(nick.value);
      if(!availability.available){
        if(this.pool){
          const own=await this.pool.query(`SELECT 1 FROM gracz_newsletter_subscribers WHERE email_normalized=$1 AND preferred_nick_normalized=$2 LIMIT 1`,[normalized,nick.normalized]);
          if(own.rowCount===0)throw Object.assign(new Error('Ten nick jest już zarezerwowany. Wybierz inny.'),{code:'NICK_TAKEN'});
        }else{
          const own=this.memory.get(normalized);
          if(own?.preferredNickNormalized!==nick.normalized)throw Object.assign(new Error('Ten nick jest już zarezerwowany. Wybierz inny.'),{code:'NICK_TAKEN'});
        }
      }
    }
    if(this.pool){
      await this.ready;
      try{
        await this.pool.query(`INSERT INTO gracz_newsletter_subscribers(email,email_normalized,preferred_nick,preferred_nick_normalized,consent_version,status,consented_at,unsubscribed_at,updated_at) VALUES($1,$1,$2,$3,'launch-v2','subscribed',NOW(),NULL,NOW()) ON CONFLICT(email_normalized) DO UPDATE SET preferred_nick=EXCLUDED.preferred_nick,preferred_nick_normalized=EXCLUDED.preferred_nick_normalized,status='subscribed',consent_version='launch-v2',consented_at=NOW(),unsubscribed_at=NULL,updated_at=NOW()`,[normalized,nick.value,nick.normalized]);
      }catch(error){
        if(error?.code==='23505')throw Object.assign(new Error('Ten nick jest już zarezerwowany. Wybierz inny.'),{code:'NICK_TAKEN'});
        throw error;
      }
    }else this.memory.set(normalized,{email:normalized,preferredNick:nick.value,preferredNickNormalized:nick.normalized,status:'subscribed',consentedAt:new Date().toISOString()});
    return {ok:true,message:nick.value?`Dziękujemy! Zapisano e-mail i zgłoszono nick „${nick.value}” do rezerwacji.`:'Dziękujemy! Jesteś na liście startowej Gracz.pl.'};
  }
  async unsubscribe(email){
    const normalized=this.normalize(email);
    if(this.pool){
      await this.ready;
      await this.pool.query(`UPDATE gracz_newsletter_subscribers SET status='unsubscribed',unsubscribed_at=NOW(),updated_at=NOW() WHERE email_normalized=$1`,[normalized]);
    }else this.memory.delete(normalized);
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
