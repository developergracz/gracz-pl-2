import { AbuseRateLimiter, RateLimitError } from "./rate-limit.js";

const MUTATIONS=new Set(["POST","PUT","PATCH","DELETE"]);

export class SecurityService {
  constructor({ limiter=new AbuseRateLimiter(), audit=null, turnstileSiteKey=process.env.TURNSTILE_SITE_KEY||"", turnstileSecretKey=process.env.TURNSTILE_SECRET_KEY||"", turnstileHostname=process.env.TURNSTILE_HOSTNAME||"gracz.pl", fetchImpl=globalThis.fetch }={}){
    this.limiter=limiter;this.audit=audit;this.siteKey=String(turnstileSiteKey).trim();this.secretKey=String(turnstileSecretKey).trim();this.turnstileHostname=String(turnstileHostname).trim().toLowerCase();this.fetchImpl=fetchImpl;
  }
  source(request){return trustedClientSource(request);}
  host(request){const raw=String(request.headers?.["x-forwarded-host"]||request.headers?.host||"").split(",")[0].trim();return raw.toLowerCase().split(":")[0];}
  assertSameOrigin(request){
    if(!MUTATIONS.has(String(request.method||"").toUpperCase()))return;
    const fetchSite=String(request.headers?.["sec-fetch-site"]||"").toLowerCase();
    const requestHost=this.host(request);
    const origin=String(request.headers?.origin||"").trim();
    const referer=String(request.headers?.referer||"").trim();

    // Render/Cloudflare can expose an internal Host header while the browser correctly
    // sends Origin/Referer for the public gracz.pl host. Compare against the public
    // forwarded host via host() rather than the raw Host header.
    if(origin){
      let originHost;
      try{originHost=new URL(origin).hostname.toLowerCase();}catch{throw http403();}
      if(!requestHost||originHost!==requestHost)throw http403();
      return;
    }
    if(referer){
      let refererHost;
      try{refererHost=new URL(referer).hostname.toLowerCase();}catch{throw http403();}
      if(!requestHost||refererHost!==requestHost)throw http403();
      return;
    }

    // Sec-Fetch-Site is a useful fallback only when Origin/Referer are absent.
    // A valid matching Origin/Referer above is stronger evidence and avoids false
    // positives after users arrive from an e-mail link and submit our own form.
    if(fetchSite==="same-origin"||fetchSite==="same-site")return;
    if(fetchSite==="cross-site")throw http403();
    if(String(process.env.NODE_ENV||"").toLowerCase()==="production")throw http403();
  }
  limit(request,scope,identity,{limit,windowMs}){const source=this.source(request);const id=String(identity||"anonymous").trim().toLowerCase().slice(0,254);this.limiter.consume(`${scope}:ip:${source}`,{limit,windowMs,message:"Zbyt wiele prób."});if(id&&id!=="anonymous")this.limiter.consume(`${scope}:identity:${id}`,{limit:Math.max(2,Math.ceil(limit/2)),windowMs,message:"Zbyt wiele prób dla tych danych."});}
  challengeConfig(request){const host=this.host(request);const allowed=host==="gracz.pl"||host==="www.gracz.pl"||Boolean(process.env.ALLOW_TURNSTILE_ON_TEST_HOSTS==="true");const enabled=Boolean(this.siteKey&&this.secretKey&&allowed);return{enabled,provider:enabled?"turnstile":null,siteKey:enabled?this.siteKey:null};}
  async verifyTurnstile(request,token,{required=true}={}){const cfg=this.challengeConfig(request);if(!cfg.enabled){if(required&&(this.host(request)==="gracz.pl"||this.host(request)==="www.gracz.pl"))throw securityError("TURNSTILE_NOT_CONFIGURED","Weryfikacja bezpieczeństwa nie jest skonfigurowana.",503);return{verified:false,disabled:true};}const clean=String(token||"").trim();if(!clean)throw securityError("TURNSTILE_REQUIRED","Wymagana jest weryfikacja bezpieczeństwa.",403);const form=new URLSearchParams({secret:this.secretKey,response:clean,remoteip:this.source(request)});let result;try{const response=await this.fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:form,signal:AbortSignal.timeout(8_000)});if(!response.ok)throw new Error(`http-${response.status}`);result=await response.json();}catch(error){await this.audit?.record({eventType:"turnstile.error",outcome:"failure",source:this.source(request),metadata:{reason:"provider-unavailable"}});throw securityError("TURNSTILE_UNAVAILABLE","Weryfikacja bezpieczeństwa jest chwilowo niedostępna.",503);}
    const hostname=String(result?.hostname||"").toLowerCase();const hostnameOk=!this.turnstileHostname||hostname===this.turnstileHostname||(this.turnstileHostname==="gracz.pl"&&hostname==="www.gracz.pl");if(result?.success!==true||!hostnameOk){await this.audit?.record({eventType:"turnstile.failed",outcome:"failure",source:this.source(request),metadata:{hostname}});throw securityError("TURNSTILE_FAILED","Weryfikacja bezpieczeństwa nie powiodła się.",403);}return{verified:true};}
}

export function trustedClientSource(request){const onRender=String(process.env.RENDER||"").toLowerCase()==="true";const trustCf=onRender||String(process.env.TRUST_CLOUDFLARE_HEADERS||"").toLowerCase()==="true";const trustProxy=String(process.env.TRUST_PROXY_HEADERS||"").toLowerCase()==="true";if(trustCf){const value=request.headers?.["cf-connecting-ip"];if(typeof value==="string"&&value.trim())return normalizeAddress(value);}if(trustProxy){const value=request.headers?.["x-forwarded-for"];if(typeof value==="string"&&value.trim())return normalizeAddress(value.split(",")[0]);}return normalizeAddress(request.socket?.remoteAddress||"unknown");}
function normalizeAddress(value){return String(value||"unknown").trim().replace(/^::ffff:/,"").slice(0,128);}
function http403(){return securityError("CROSS_SITE_REQUEST","Żądanie z obcej strony zostało zablokowane.",403);}
function securityError(code,message,status){return Object.assign(new Error(message),{name:"SecurityError",code,status});}
export { RateLimitError };
