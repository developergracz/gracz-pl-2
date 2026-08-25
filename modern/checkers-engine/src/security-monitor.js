import { createHash } from "node:crypto";

const WINDOW_MS=15*60_000;
const ALERT_COOLDOWN_MS=10*60_000;
const NEWSLETTER_THRESHOLDS={honeypot:5,"fast-submit":5,subscribe:25,resend:10};

export class SecurityMonitor {
  #events=[];
  #lastAlert=new Map();
  constructor({audit=null,fetchImpl=globalThis.fetch,alertWebhook=process.env.SECURITY_ALERT_WEBHOOK||"",clock=()=>Date.now(),hashSalt=process.env.MONITOR_HASH_SALT||process.env.AUTH_SECRET||"gracz-monitor"}={}){this.audit=audit;this.fetchImpl=fetchImpl;this.alertWebhook=String(alertWebhook).trim();this.clock=clock;this.hashSalt=String(hashSalt);}
  fingerprint(value){return createHash("sha256").update(this.hashSalt).update("\0").update(String(value||"unknown")).digest("hex").slice(0,16);}
  prune(now){this.#events=this.#events.filter(e=>now-e.at<WINDOW_MS);}
  async observeHttp({status,source,path}){const now=this.clock(),sourceId=this.fingerprint(source);this.#events.push({at:now,type:"http",status:Number(status),sourceId,path:String(path||"/").slice(0,180)});this.prune(now);const bySource=this.#events.filter(e=>e.type==="http"&&e.sourceId===sourceId);const authFailures=bySource.filter(e=>[401,403].includes(e.status)).length;const rateLimits=bySource.filter(e=>e.status===429).length;const serverErrors=this.#events.filter(e=>e.type==="http"&&e.status>=500).length;if(authFailures>=12)await this.alert("auth-failure-spike",{sourceId,count:authFailures});if(rateLimits>=8)await this.alert("rate-limit-spike",{sourceId,count:rateLimits});if(serverErrors>=10)await this.alert("server-error-spike",{count:serverErrors});}
  async observeNewsletter({event,source}){const normalized=String(event||"").slice(0,40),threshold=NEWSLETTER_THRESHOLDS[normalized];if(!threshold)return;const now=this.clock(),sourceId=this.fingerprint(source);this.#events.push({at:now,type:"newsletter",event:normalized,sourceId});this.prune(now);const count=this.#events.filter(e=>e.type==="newsletter"&&e.event===normalized&&e.sourceId===sourceId).length;if(count>=threshold)await this.alert(`newsletter-${normalized}-spike`,{sourceId,count,windowMinutes:15});}
  async alert(kind,metadata={}){const now=this.clock(),key=`${kind}:${metadata.sourceId||"global"}`,last=this.#lastAlert.get(key)||0;if(now-last<ALERT_COOLDOWN_MS)return;this.#lastAlert.set(key,now);const safeMetadata=sanitizeMetadata(metadata);await this.audit?.record({eventType:`security.alert.${kind}`,outcome:"failure",metadata:safeMetadata});if(!this.alertWebhook||typeof this.fetchImpl!=="function")return;try{await this.fetchImpl(this.alertWebhook,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({service:"gracz.pl",kind:String(kind).slice(0,80),metadata:safeMetadata,at:new Date(now).toISOString()}),signal:AbortSignal.timeout(5_000)});}catch{/* alert transport failure is intentionally non-fatal */}}
}

function sanitizeMetadata(metadata){const allowed={};for(const key of["sourceId","count","windowMinutes"]){const value=metadata?.[key];if(typeof value==="number"&&Number.isFinite(value))allowed[key]=value;else if(key==="sourceId"&&/^[a-f0-9]{16}$/.test(String(value||"")))allowed[key]=String(value);}return allowed;}
