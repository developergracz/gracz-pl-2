const SAFE_PURPOSES = new Set(["newsletter-confirm", "newsletter-welcome", "account-verify", "password-reset", "security-alert"]);

export class SecureMailService {
  constructor({ apiKey = process.env.RESEND_API_KEY || "", from = process.env.EMAIL_FROM || process.env.NEWSLETTER_FROM || "Gracz.pl <newsletter@gracz.pl>", replyTo = process.env.EMAIL_REPLY_TO || "kontakt@gracz.pl", fetchImpl = globalThis.fetch, audit = null } = {}) {
    this.apiKey=String(apiKey).trim(); this.from=String(from).trim(); this.replyTo=String(replyTo).trim(); this.fetchImpl=fetchImpl; this.audit=audit;
  }
  get enabled(){return Boolean(this.apiKey && this.from && typeof this.fetchImpl === "function");}
  async send({ to, subject, text, html, purpose }) {
    if (!SAFE_PURPOSES.has(purpose)) throw new TypeError("Nieprawidłowy cel wiadomości systemowej.");
    const email=normalizeEmail(to);
    const target=emailFingerprint(email);
    if (!this.enabled) {
      console.error("[mail] provider not configured", {purpose,target,hasApiKey:Boolean(this.apiKey),hasFrom:Boolean(this.from),hasFetch:typeof this.fetchImpl === "function"});
      throw Object.assign(new Error("Usługa wysyłki e-mail nie jest skonfigurowana."),{code:"EMAIL_PROVIDER_NOT_CONFIGURED",status:503});
    }

    const payload={
      from:this.from,
      to:[email],
      subject:String(subject).slice(0,180),
      text:text?String(text):undefined,
      html:html?String(html):undefined,
      reply_to:this.replyTo||undefined,
      headers:{"X-Entity-Ref-ID":`gracz-${Date.now()}-${Math.random().toString(36).slice(2,10)}`}
    };

    let lastError=null;
    for(let attempt=1; attempt<=2; attempt++){
      console.log("[mail] resend request", {purpose,target,from:this.from,attempt});
      let response;
      try {
        response=await this.fetchImpl("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${this.apiKey}`,"content-type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(12_000)});
      } catch (error) {
        lastError=Object.assign(new Error("Nie udało się połączyć z usługą wysyłki e-mail."),{code:"MAIL_PROVIDER_UNREACHABLE",status:502});
        console.error("[mail] resend network error", {purpose,target,attempt,code:error?.code||null,message:String(error?.message||error).slice(0,300)});
        if(attempt<2){await delay(700);continue;}
        throw lastError;
      }

      const raw=await response.text().catch(()=>"");
      let result={};
      try { result=raw?JSON.parse(raw):{}; } catch { result={}; }

      if(response.ok) {
        console.log("[mail] resend accepted", {purpose,target,status:response.status,attempt,providerId:result.id?String(result.id).slice(0,120):null});
        await this.audit?.record({eventType:"mail.sent",outcome:"success",targetType:"email",targetId:target,metadata:{purpose,provider:"resend",providerId:result.id?String(result.id).slice(0,120):null}});
        return {sent:true,id:result.id||null};
      }

      const providerMessage=String(result?.message||result?.error?.message||raw||"Brak szczegółów").replace(/\s+/g," ").slice(0,500);
      console.error("[mail] resend rejected", {purpose,target,status:response.status,attempt,providerMessage});
      lastError=Object.assign(new Error(`Resend odrzucił wiadomość (${response.status}): ${providerMessage}`),{code:"MAIL_DELIVERY_FAILED",status:502,providerStatus:response.status});

      // Ponawiamy wyłącznie błędy chwilowe; błędy konfiguracji (4xx) wymagają poprawy ustawień.
      if(attempt<2 && (response.status===408 || response.status===409 || response.status===429 || response.status>=500)){
        await delay(900);
        continue;
      }
      throw lastError;
    }
    throw lastError || Object.assign(new Error("Nie udało się wysłać wiadomości."),{code:"MAIL_DELIVERY_FAILED",status:502});
  }
}

function normalizeEmail(value){const email=String(value||"").trim().toLowerCase();if(email.length>254||!/^([^\s@]+)@([^\s@]+)\.([^\s@]{2,})$/.test(email))throw new TypeError("Nieprawidłowy adres e-mail.");return email;}
function emailFingerprint(email){const [local,domain]=email.split("@");return `${local.slice(0,2)}***@${domain}`;}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
