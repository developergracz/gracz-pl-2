import pg from "pg";
import { TokenService } from "./token-service.js";
import { SecureMailService } from "./secure-mail-service.js";
import { SecurityService, RateLimitError } from "./security-service.js";
const { Pool } = pg;

const CONFIRM_TTL_MS = 24 * 60 * 60_000;
const RESEND_COOLDOWN_MS = 30 * 60_000;
const CONSENT_VERSION = "launch-v3-double-opt-in";

export class NewsletterService {
  constructor(connectionString, { tokenService = new TokenService(), mail = null, baseUrl = process.env.PUBLIC_BASE_URL || "https://gracz.pl" } = {}) {
    this.pool = connectionString ? new Pool({ connectionString, ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }, max: 3 }) : null;
    this.memory = new Map();
    this.tokens = tokenService;
    this.mail = mail || new SecureMailService();
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.ready = this.initialize();
  }

  async initialize() {
    if (!this.pool) return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS gracz_newsletter_subscribers(
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      email_normalized VARCHAR(254) NOT NULL UNIQUE,
      preferred_nick VARCHAR(24), preferred_nick_normalized VARCHAR(24),
      consent_version VARCHAR(64) NOT NULL, consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(32) NOT NULL DEFAULT 'pending_confirmation',
      confirmation_token_hash BYTEA, confirmation_expires_at TIMESTAMPTZ, confirmation_sent_at TIMESTAMPTZ, confirmed_at TIMESTAMPTZ,
      position_token_hash BYTEA, unsubscribe_token_hash BYTEA, unsubscribed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    for (const statement of [
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS id BIGSERIAL`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS preferred_nick VARCHAR(24)`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS preferred_nick_normalized VARCHAR(24)`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_token_hash BYTEA`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS position_token_hash BYTEA`,
      `ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token_hash BYTEA`,
    ]) await this.pool.query(statement);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_id_unique ON gracz_newsletter_subscribers(id)`);
    await this.pool.query(`DROP INDEX IF EXISTS gracz_newsletter_preferred_nick_unique`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_preferred_nick_unique_v2 ON gracz_newsletter_subscribers(preferred_nick_normalized) WHERE preferred_nick_normalized IS NOT NULL AND status IN ('pending_confirmation','subscribed')`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_newsletter_confirmation_hash_idx ON gracz_newsletter_subscribers(confirmation_token_hash) WHERE confirmation_token_hash IS NOT NULL`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_newsletter_position_hash_idx ON gracz_newsletter_subscribers(position_token_hash) WHERE position_token_hash IS NOT NULL`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_newsletter_unsubscribe_hash_idx ON gracz_newsletter_subscribers(unsubscribe_token_hash) WHERE unsubscribe_token_hash IS NOT NULL`);
  }

  normalize(email) {
    const value = String(email || "").normalize("NFKC").trim().toLowerCase();
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) throw newsletterError("INVALID_EMAIL", "Podaj prawidłowy adres e-mail.");
    return value;
  }

  normalizeNick(nick, { optional = true } = {}) {
    const value = String(nick || "").normalize("NFKC").trim();
    if (!value && optional) return { value: null, normalized: null };
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(value)) throw newsletterError("INVALID_NICK", "Nick może mieć 3–24 znaki: litery, cyfry, _, . lub -.");
    return { value, normalized: value.toLowerCase() };
  }

  async nicknameAvailable(nick) {
    const parsed = this.normalizeNick(nick, { optional: false });
    if (!this.pool) {
      for (const item of this.memory.values()) if (item.preferredNickNormalized === parsed.normalized && ["pending_confirmation", "subscribed"].includes(item.status)) return { available: false, nick: parsed.value };
      return { available: true, nick: parsed.value };
    }
    await this.ready;
    const result = await this.pool.query(`SELECT 1 FROM gracz_newsletter_subscribers WHERE preferred_nick_normalized=$1 AND status IN ('pending_confirmation','subscribed') LIMIT 1`, [parsed.normalized]);
    return { available: result.rowCount === 0, nick: parsed.value };
  }

  async subscribe({ email, consent, legal, preferredNick }) {
    if (legal !== true) throw newsletterError("LEGAL_REQUIRED", "Akceptacja Regulaminu i Polityki prywatności jest wymagana.");
    if (consent !== true) throw newsletterError("CONSENT_REQUIRED", "Zgoda na zapis jest wymagana.");
    const normalized = this.normalize(email), nick = this.normalizeNick(preferredNick);
    const neutral = { ok: true, pendingConfirmation: true, message: "Jeżeli podany adres może zostać zapisany, wyślemy wiadomość z linkiem potwierdzającym." };

    if (!this.pool) {
      const existing = this.memory.get(normalized);
      if (existing?.status === "subscribed") return neutral;
      if (existing?.confirmationSentAt && Date.now() - existing.confirmationSentAt < RESEND_COOLDOWN_MS) return neutral;
      const confirmation = this.tokens.issue();
      this.memory.set(normalized, { email: normalized, preferredNick: nick.value, preferredNickNormalized: nick.normalized, status: "pending_confirmation", confirmationHash: confirmation.tokenHash, confirmationExpiresAt: Date.now() + CONFIRM_TTL_MS, confirmationSentAt: null });
      const delivery = await this.sendConfirmation(normalized, nick.value, confirmation.token);
      if (!delivery?.sent) throw newsletterError("EMAIL_PROVIDER_NOT_CONFIGURED", "Wysyłka wiadomości e-mail nie jest jeszcze skonfigurowana. Spróbuj ponownie później.", 503);
      const item = this.memory.get(normalized); if (item) item.confirmationSentAt = Date.now();
      return neutral;
    }

    await this.ready;
    const client = await this.pool.connect(); let confirmationToken = null;
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT id,status,confirmation_sent_at FROM gracz_newsletter_subscribers WHERE email_normalized=$1 FOR UPDATE`, [normalized]);
      const existing = rows[0];
      if (existing?.status === "subscribed") { await client.query("COMMIT"); return neutral; }
      if (existing?.confirmation_sent_at && Date.now() - new Date(existing.confirmation_sent_at).getTime() < RESEND_COOLDOWN_MS) { await client.query("COMMIT"); return neutral; }
      if (nick.normalized) {
        const conflict = await client.query(`SELECT 1 FROM gracz_newsletter_subscribers WHERE preferred_nick_normalized=$1 AND email_normalized<>$2 AND status IN ('pending_confirmation','subscribed') LIMIT 1`, [nick.normalized, normalized]);
        if (conflict.rowCount) throw newsletterError("NICK_TAKEN", "Ten nick jest już zarezerwowany. Wybierz inny.");
      }
      const confirmation = this.tokens.issue(); confirmationToken = confirmation.token;
      if (existing) await client.query(`UPDATE gracz_newsletter_subscribers SET preferred_nick=$2,preferred_nick_normalized=$3,status='pending_confirmation',consent_version=$4,consented_at=NOW(),confirmation_token_hash=$5,confirmation_expires_at=NOW()+INTERVAL '24 hours',confirmation_sent_at=NULL,position_token_hash=NULL,unsubscribe_token_hash=NULL,unsubscribed_at=NULL,updated_at=NOW() WHERE email_normalized=$1`, [normalized,nick.value,nick.normalized,CONSENT_VERSION,confirmation.tokenHash]);
      else await client.query(`INSERT INTO gracz_newsletter_subscribers(email,email_normalized,preferred_nick,preferred_nick_normalized,consent_version,status,confirmation_token_hash,confirmation_expires_at,confirmation_sent_at) VALUES($1,$1,$2,$3,$4,'pending_confirmation',$5,NOW()+INTERVAL '24 hours',NULL)`, [normalized,nick.value,nick.normalized,CONSENT_VERSION,confirmation.tokenHash]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error?.code === "23505") throw newsletterError("DUPLICATE", "Nie udało się zapisać tych danych.");
      throw error;
    } finally { client.release(); }
    if (confirmationToken) {
      try {
        const delivery = await this.sendConfirmation(normalized, nick.value, confirmationToken);
        if (!delivery?.sent) throw newsletterError("EMAIL_PROVIDER_NOT_CONFIGURED", "Wysyłka wiadomości e-mail nie jest jeszcze skonfigurowana. Spróbuj ponownie później.", 503);
        await this.pool.query(`UPDATE gracz_newsletter_subscribers SET confirmation_sent_at=NOW(),updated_at=NOW() WHERE email_normalized=$1 AND status='pending_confirmation'`, [normalized]);
      } catch (error) {
        await this.pool.query(`UPDATE gracz_newsletter_subscribers SET confirmation_sent_at=NULL,updated_at=NOW() WHERE email_normalized=$1 AND status='pending_confirmation'`, [normalized]).catch(() => {});
        console.error("[newsletter] confirmation mail failed", error?.code || error?.message);
        throw error;
      }
    }
    return neutral;
  }

  async sendConfirmation(to, nick, token) {
    const link = `${this.baseUrl}/newsletter/confirm?token=${encodeURIComponent(token)}`;
    const text = `Otwórz stronę potwierdzenia zapisu do Gracz.pl: ${link}\n\nNa stronie kliknij przycisk potwierdzenia. Link jest ważny przez 24 godziny.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h1>Potwierdź zapis do Gracz.pl</h1><p>${escapeHtml(nick ? `Nick: ${nick}` : "Lista startowa Gracz.pl")}</p><p><a href="${escapeHtml(link)}">Przejdź do potwierdzenia</a></p><p>Na stronie kliknij przycisk potwierdzenia. Link jest ważny przez 24 godziny.</p></div>`;
    return this.mail.send({ to, subject: "Potwierdź zapis do Gracz.pl", text, html, purpose: "newsletter-confirm" });
  }

  async confirm(token) {
    const tokenHash = this.tokens.hash(String(token || ""));
    if (!this.pool) {
      for (const item of this.memory.values()) if (bufferEqual(item.confirmationHash, tokenHash) && item.confirmationExpiresAt > Date.now()) {
        item.status = "subscribed"; item.confirmationHash = null;
        const position = this.tokens.issue(), unsubscribe = this.tokens.issue(); item.positionHash = position.tokenHash; item.unsubscribeHash = unsubscribe.tokenHash;
        await this.sendWelcome(item.email, item.preferredNick, position.token, unsubscribe.token); return { ok: true, message: "Zapis został potwierdzony." };
      }
      throw newsletterError("TOKEN_INVALID", "Link potwierdzający jest nieprawidłowy albo wygasł.");
    }
    await this.ready;
    const client = await this.pool.connect(); let data;
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT id,email,preferred_nick FROM gracz_newsletter_subscribers WHERE confirmation_token_hash=$1 AND confirmation_expires_at>NOW() AND status='pending_confirmation' FOR UPDATE`, [tokenHash]);
      if (!rows[0]) throw newsletterError("TOKEN_INVALID", "Link potwierdzający jest nieprawidłowy albo wygasł.");
      const position = this.tokens.issue(), unsubscribe = this.tokens.issue();
      await client.query(`UPDATE gracz_newsletter_subscribers SET status='subscribed',confirmed_at=NOW(),confirmation_token_hash=NULL,confirmation_expires_at=NULL,position_token_hash=$2,unsubscribe_token_hash=$3,updated_at=NOW() WHERE id=$1`, [rows[0].id,position.tokenHash,unsubscribe.tokenHash]);
      await client.query("COMMIT"); data={email:rows[0].email,nick:rows[0].preferred_nick,positionToken:position.token,unsubscribeToken:unsubscribe.token};
    } catch(error){ await client.query("ROLLBACK").catch(()=>{}); throw error; } finally { client.release(); }
    await this.sendWelcome(data.email,data.nick,data.positionToken,data.unsubscribeToken).catch(error=>console.error("[newsletter] welcome mail failed",error?.code||error?.message));
    return { ok:true,message:"Zapis został potwierdzony. Witaj na liście startowej Gracz.pl!" };
  }

  async sendWelcome(to,nick,positionToken,unsubscribeToken){
    const positionLink=`${this.baseUrl}/newsletter/position?token=${encodeURIComponent(positionToken)}`;
    const unsubscribeLink=`${this.baseUrl}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const text=`Witaj na liście Gracz.pl!\n${nick?`Nick: ${nick}\n`:""}Sprawdź miejsce: ${positionLink}\nWypisz się: ${unsubscribeLink}`;
    const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h1>Witaj na liście Gracz.pl!</h1>${nick?`<p>Nick: <strong>${escapeHtml(nick)}</strong></p>`:""}<p><a href="${escapeHtml(positionLink)}">Sprawdź swoje miejsce</a></p><p><a href="${escapeHtml(unsubscribeLink)}">Przejdź do wypisania</a></p></div>`;
    return this.mail.send({to,subject:"Witaj na liście startowej Gracz.pl",text,html,purpose:"newsletter-welcome"});
  }

  async position(token){
    const hash=this.tokens.hash(String(token||""));
    if(!this.pool){const active=[...this.memory.values()].filter(x=>x.status==="subscribed");const index=active.findIndex(x=>bufferEqual(x.positionHash,hash));if(index<0)throw newsletterError("TOKEN_INVALID","Nieprawidłowy token.");return{position:index+1};}
    await this.ready;const{rows}=await this.pool.query(`SELECT s.id,(SELECT COUNT(*)::int FROM gracz_newsletter_subscribers x WHERE x.status='subscribed' AND x.id<=s.id) AS position FROM gracz_newsletter_subscribers s WHERE s.position_token_hash=$1 AND s.status='subscribed'`,[hash]);if(!rows[0])throw newsletterError("TOKEN_INVALID","Nieprawidłowy token.");return{position:Number(rows[0].position)};
  }

  async unsubscribeByToken(token){
    const hash=this.tokens.hash(String(token||""));
    if(!this.pool){for(const item of this.memory.values())if(bufferEqual(item.unsubscribeHash,hash)){item.status="unsubscribed";item.positionHash=null;item.unsubscribeHash=null;return{ok:true};}return{ok:true};}
    await this.ready;await this.pool.query(`UPDATE gracz_newsletter_subscribers SET status='unsubscribed',unsubscribed_at=NOW(),position_token_hash=NULL,unsubscribe_token_hash=NULL,confirmation_token_hash=NULL,updated_at=NOW() WHERE unsubscribe_token_hash=$1`,[hash]);return{ok:true};
  }

  async close(){if(this.pool)await this.pool.end();}
}

export function createNewsletterHandler(service,{security=new SecurityService()}={}){
  return async function newsletterHandler(request,response){
    const url=new URL(request.url,"http://localhost"); if(!url.pathname.startsWith("/newsletter/"))return false;
    try{
      enforceNewsletterHost(request,security);
      if(request.method==="GET"&&url.pathname==="/newsletter/challenge-config")return json(response,200,security.challengeConfig(request));
      if(request.method==="GET"&&url.pathname==="/newsletter/nick-availability"){security.limit(request,"newsletter-nick",url.searchParams.get("nick")||"anonymous",{limit:30,windowMs:60_000});return json(response,200,await service.nicknameAvailable(url.searchParams.get("nick")||""));}
      if(request.method==="GET"&&url.pathname==="/newsletter/confirm"){security.limit(request,"newsletter-confirm-page","anonymous",{limit:30,windowMs:15*60_000});const token=url.searchParams.get("token")||"";service.tokens.hash(token);return html(response,200,actionPage("/newsletter/confirm","Potwierdź zapis","Kliknij przycisk, aby aktywować zapis do listy Gracz.pl.",token,"Potwierdzam zapis"));}
      if(request.method==="POST"&&url.pathname==="/newsletter/confirm"){security.assertSameOrigin(request);security.limit(request,"newsletter-confirm","anonymous",{limit:12,windowMs:15*60_000});const form=await readForm(request);const result=await service.confirm(form.get("token")||"");return html(response,200,successPage(result.message));}
      if(request.method==="GET"&&url.pathname==="/newsletter/position"){security.limit(request,"newsletter-position","anonymous",{limit:30,windowMs:15*60_000});const result=await service.position(url.searchParams.get("token")||"");return html(response,200,successPage(`Twoje aktualne miejsce na liście: ${result.position}.`));}
      if(request.method==="GET"&&url.pathname==="/newsletter/unsubscribe"){security.limit(request,"newsletter-unsubscribe-page","anonymous",{limit:30,windowMs:15*60_000});const token=url.searchParams.get("token")||"";service.tokens.hash(token);return html(response,200,actionPage("/newsletter/unsubscribe","Wypisz z listy","Kliknij przycisk, aby potwierdzić wypisanie adresu z listy Gracz.pl.",token,"Wypisz mnie"));}
      if(request.method==="POST"&&url.pathname==="/newsletter/unsubscribe"){security.assertSameOrigin(request);security.limit(request,"newsletter-unsubscribe","anonymous",{limit:12,windowMs:15*60_000});const form=await readForm(request);await service.unsubscribeByToken(form.get("token")||"");return html(response,200,successPage("Adres został wypisany z listy Gracz.pl."));}
      if(request.method!=="POST"||url.pathname!=="/newsletter/subscribe")return false;
      security.assertSameOrigin(request);
      const body=await readJson(request,10_000);
      const neutral={ok:true,pendingConfirmation:true,message:"Jeżeli podany adres może zostać zapisany, wyślemy wiadomość z linkiem potwierdzającym."};

      // Honeypot failures are deliberately indistinguishable from successful submissions.
      if(String(body.website||"").trim()){
        await security.audit?.record({eventType:"newsletter.honeypot",outcome:"blocked",source:security.source(request),metadata:{}});
        return json(response,202,neutral);
      }

      const normalized=service.normalize(body.email);
      const nick=service.normalizeNick(body.preferredNick);
      security.limit(request,"newsletter-subscribe",normalized,{limit:5,windowMs:30*60_000});
      if(nick.normalized)security.limit(request,"newsletter-subscribe-nick",nick.normalized,{limit:6,windowMs:30*60_000});

      const startedAt=Number(body.formStartedAt);
      const elapsed=Number.isFinite(startedAt)&&startedAt>0?Date.now()-startedAt:null;
      if(elapsed!==null&&elapsed>=0&&elapsed<800){
        security.limit(request,"newsletter-fast-submit",normalized,{limit:2,windowMs:10*60_000});
        await security.audit?.record({eventType:"newsletter.fast_submit",outcome:"suspicious",source:security.source(request),metadata:{elapsedBucket:"under-800ms"}});
      }

      const submissionId=String(body.submissionId||"").trim();
      if(submissionId&&!/^[A-Za-z0-9-]{16,80}$/.test(submissionId))throw newsletterError("INVALID_SUBMISSION_ID","Nieprawidłowe dane formularza.");
      if(submissionId)security.limit(request,"newsletter-submission-id",submissionId,{limit:2,windowMs:30*60_000});

      await security.verifyTurnstile(request,body.challengeToken,{required:isProduction()});
      return json(response,202,await service.subscribe({...body,preferredNick:nick.value}));
    }catch(error){if(error instanceof RateLimitError&&error.retryAfterSeconds)response.setHeader("Retry-After",String(error.retryAfterSeconds));const status=Number(error.status)||(error instanceof RateLimitError?429:400);return errorResponse(response,status,error);}
  };
}

function enforceNewsletterHost(request,security){if(!isProduction())return;const host=security.host(request);if(host!=="gracz.pl"&&host!=="www.gracz.pl")throw newsletterError("HOST_NOT_ALLOWED","Publiczne operacje newslettera są dostępne wyłącznie przez gracz.pl.",403);}
function isProduction(){return String(process.env.NODE_ENV||"").toLowerCase()==="production";}
async function readJson(request,limit){let raw="";for await(const chunk of request){raw+=chunk;if(raw.length>limit)throw newsletterError("REQUEST_TOO_LARGE","Żądanie jest zbyt duże.",413);}try{return JSON.parse(raw||"{}");}catch{throw newsletterError("INVALID_JSON","Nieprawidłowe dane.");}}
async function readForm(request,limit=4096){let raw="";for await(const chunk of request){raw+=chunk;if(raw.length>limit)throw newsletterError("REQUEST_TOO_LARGE","Żądanie jest zbyt duże.",413);}return new URLSearchParams(raw);}
function securityHeaders(contentType){return{"content-type":contentType,"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"same-origin","x-frame-options":"DENY","permissions-policy":"camera=(), microphone=(), geolocation=()","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};}
function json(response,status,body){response.writeHead(status,securityHeaders("application/json; charset=utf-8"));response.end(JSON.stringify(body));return true;}
function html(response,status,body){response.writeHead(status,securityHeaders("text/html; charset=utf-8"));response.end(body);return true;}
function errorResponse(response,status,error){if(String(error?.message||"").includes("token")||error?.code==="TOKEN_INVALID")return html(response,status,successPage("Link jest nieprawidłowy albo wygasł."));return json(response,status,{error:{code:error.code||"NEWSLETTER_ERROR",message:error.message||"Nie udało się wykonać operacji."}});}
function actionPage(action,title,message,token,button){return `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Gracz.pl</title><body style="margin:0;background:#071015;color:#eef6f2;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh"><main style="max-width:620px;padding:40px;text-align:center"><h1>Gracz.pl</h1><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><form method="post" action="${escapeHtml(action)}"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit" style="padding:14px 22px;border:0;border-radius:8px;background:#32e982;color:#041009;font-weight:800;cursor:pointer">${escapeHtml(button)}</button></form></main></body></html>`;}
function successPage(message){return `<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gracz.pl</title><body style="margin:0;background:#071015;color:#eef6f2;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh"><main style="max-width:620px;padding:40px;text-align:center"><h1>Gracz.pl</h1><p>${escapeHtml(message)}</p><p><a style="color:#48e78c" href="/">Wróć na stronę główną</a></p></main></body></html>`;}
function newsletterError(code,message,status=400){return Object.assign(new Error(message),{code,status});}
function escapeHtml(value){return String(value??"").replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function bufferEqual(a,b){if(!a||!b)return false;return Buffer.from(a).equals(Buffer.from(b));}
