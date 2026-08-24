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
  }
  normalize(email){
    const value=String(email||'').trim().toLowerCase();
    if(value.length>254||!^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))throw Object.assign(new Error('Podaj prawidłowy adres e-mail.'),{code:'INVALID_EMAIL'});
    return value;
  }
  async subscribe({email,consent}){
    if(consent!==true)throw Object.assign(new Error('Zgoda na zapis jest wymagana.'),{code:'CONSENT_REQUIRED'});
    const normalized=this.normalize(email);
    if(this.pool){
      await this.ready;
      await this.pool.query(`INSERT INTO gracz_newsletter_subscribers(email,email_normalized,consent_version,status,consented_at,unsubscribed_at,updated_at) VALUES($1,$1,'launch-v1','subscribed',NOW(),NULL,NOW()) ON CONFLICT(email_normalized) DO UPDATE SET status='subscribed',consent_version='launch-v1',consented_at=NOW(),unsubscribed_at=NULL,updated_at=NOW()`,[normalized]);
    }else this.memory.set(normalized,{email:normalized,status:'subscribed',consentedAt:new Date().toISOString()});
    return {ok:true,message:'Dziękujemy! Jesteś na liście startowej Gracz.pl.'};
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
    const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:payload,
      signal:AbortSignal.timeout(8000)
    });
    if(!result.ok)throw new Error(`Turnstile Siteverify HTTP ${result.status}`);
    verification=await result.json();
  }catch(error){
    throw Object.assign(new Error('Weryfikacja zabezpieczenia jest chwilowo niedostępna. Spróbuj ponownie za moment.'),{code:'TURNSTILE_UNAVAILABLE',cause:error});
  }
  if(verification?.success!==true){
    throw Object.assign(new Error('Weryfikacja bezpieczeństwa nie powiodła się. Spróbuj ponownie.'),{code:'TURNSTILE_FAILED'});
  }
  return true;
}

export function createNewsletterHandler(service,{siteKey='',secretKey=''}={}){
  const turnstileEnabled=Boolean(siteKey&&secretKey);
  return async(request,response)=>{
    const url=new URL(request.url,'http://localhost');
    if(request.method==='GET'&&url.pathname==='/newsletter/challenge-config'){
      response.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      response.end(JSON.stringify({enabled:turnstileEnabled,provider:turnstileEnabled?'turnstile':null,siteKey:turnstileEnabled?siteKey:null}));
      return true;
    }
    if(request.method!=='POST'||url.pathname!=='/newsletter/subscribe')return false;
    let raw='';
    for await(const chunk of request){
      raw+=chunk;
      if(raw.length>10_000)throw Object.assign(new Error('Żądanie jest zbyt duże.'),{code:'REQUEST_TOO_LARGE'});
    }
    let body;
    try{body=JSON.parse(raw||'{}');}catch{body={};}
    try{
      if(turnstileEnabled)await verifyTurnstile(secretKey,body.challengeToken);
      const result=await service.subscribe(body);
      response.writeHead(201,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      response.end(JSON.stringify(result));
    }catch(error){
      const securityError=String(error.code||'').startsWith('TURNSTILE_');
      response.writeHead(securityError?403:400,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      response.end(JSON.stringify({error:{code:error.code||'NEWSLETTER_ERROR',message:error.message||'Nie udało się zapisać.'}}));
    }
    return true;
  };
}
