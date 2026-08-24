const SAFE_PURPOSES = new Set(["newsletter-confirm", "newsletter-welcome", "account-verify", "password-reset", "security-alert"]);

export class SecureMailService {
  constructor({ apiKey = process.env.RESEND_API_KEY || "", from = process.env.EMAIL_FROM || process.env.NEWSLETTER_FROM || "Gracz.pl <newsletter@gracz.pl>", fetchImpl = globalThis.fetch, audit = null } = {}) {
    this.apiKey=String(apiKey).trim(); this.from=String(from).trim(); this.fetchImpl=fetchImpl; this.audit=audit;
  }
  get enabled(){return Boolean(this.apiKey && this.from && typeof this.fetchImpl === "function");}
  async send({ to, subject, text, html, purpose }) {
    if (!SAFE_PURPOSES.has(purpose)) throw new TypeError("Nieprawidłowy cel wiadomości systemowej.");
    const email=normalizeEmail(to); if (!this.enabled) return { sent:false, reason:"EMAIL_PROVIDER_NOT_CONFIGURED" };
    const response=await this.fetchImpl("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${this.apiKey}`,"content-type":"application/json"},body:JSON.stringify({from:this.from,to:[email],subject:String(subject).slice(0,180),text:text?String(text):undefined,html:html?String(html):undefined}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok) throw Object.assign(new Error("Nie udało się wysłać wiadomości systemowej."),{code:"MAIL_DELIVERY_FAILED",status:502});
    const result=await response.json().catch(()=>({}));
    await this.audit?.record({eventType:"mail.sent",outcome:"success",targetType:"email",targetId:emailFingerprint(email),metadata:{purpose,provider:"resend",providerId:result.id?String(result.id).slice(0,120):null}});
    return {sent:true,id:result.id||null};
  }
}

function normalizeEmail(value){const email=String(value||"").trim().toLowerCase();if(email.length>254||!/^([^\s@]+)@([^\s@]+)\.([^\s@]{2,})$/.test(email))throw new TypeError("Nieprawidłowy adres e-mail.");return email;}
function emailFingerprint(email){const [local,domain]=email.split("@");return `${local.slice(0,2)}***@${domain}`;}
