import pg from "pg";
import { randomUUID } from "node:crypto";

const { Pool } = pg;
const BASE_URL = process.env.PUBLIC_BASE_URL || "https://gracz.pl";
const FROM_EMAIL = process.env.NEWSLETTER_FROM_EMAIL || "newslatter@gracz.pl";
const FROM_NAME = process.env.NEWSLETTER_FROM_NAME || "Gracz.pl";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

export class NewsletterService {
  constructor(connectionString = null) {
    this.pool = connectionString ? new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 2,
    }) : null;
    this.ready = this.pool ? this.#initialize() : Promise.resolve();
  }

  async #initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_newsletter_subscribers (
        subscriber_id UUID PRIMARY KEY,
        email VARCHAR(254) NOT NULL,
        preferred_nick VARCHAR(32),
        consent_version VARCHAR(32) NOT NULL,
        consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        terms_version VARCHAR(32),
        privacy_version VARCHAR(32),
        terms_accepted_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        unsubscribe_token UUID NOT NULL UNIQUE,
        welcome_email_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32)`);
    await this.pool.query(`ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(32)`);
    await this.pool.query(`ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`);
    await this.pool.query(`ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_email_unique ON gracz_newsletter_subscribers (LOWER(email))`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_nick_unique ON gracz_newsletter_subscribers (LOWER(preferred_nick)) WHERE preferred_nick IS NOT NULL`);
  }

  async subscribe({ email, preferredNick = "", consent = false, acceptedTerms = false, termsVersion = "newsletter-v1", privacyVersion = "privacy-v1" }) {
    await this.ready;
    if (!this.pool) throw new NewsletterError("Zapisy są chwilowo niedostępne.", "NEWSLETTER_UNAVAILABLE", 503);
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanNick = String(preferredNick || "").trim();
    if (!validEmail(cleanEmail)) throw new NewsletterError("Podaj prawidłowy adres e-mail.", "INVALID_EMAIL", 400);
    if (!validNick(cleanNick)) throw new NewsletterError("Nick może mieć 3–32 znaki: litery (także polskie), cyfry, kropkę, _ lub -.", "INVALID_NICK", 400);
    if (acceptedTerms !== true) throw new NewsletterError("Zaakceptuj regulamin newslettera i zapoznaj się z polityką prywatności.", "TERMS_REQUIRED", 400);
    if (consent !== true) throw new NewsletterError("Zaznacz zgodę na otrzymywanie informacji o starcie Gracz.pl.", "CONSENT_REQUIRED", 400);

    const existing = await this.pool.query(`SELECT subscriber_id,preferred_nick,unsubscribe_token FROM gracz_newsletter_subscribers WHERE LOWER(email)=LOWER($1) LIMIT 1`, [cleanEmail]);
    let subscriberId;
    let unsubscribeToken;
    let alreadySubscribed = false;

    if (existing.rows[0]) {
      alreadySubscribed = true;
      subscriberId = existing.rows[0].subscriber_id;
      unsubscribeToken = existing.rows[0].unsubscribe_token;
      if (cleanNick) {
        const nickTaken = await this.pool.query(`SELECT 1 FROM gracz_newsletter_subscribers WHERE LOWER(preferred_nick)=LOWER($1) AND subscriber_id<>$2 LIMIT 1`, [cleanNick, subscriberId]);
        if (nickTaken.rows[0]) throw new NewsletterError("Ten nick jest już zarezerwowany. Wybierz inny.", "NICK_TAKEN", 409);
      }
      await this.pool.query(`UPDATE gracz_newsletter_subscribers SET preferred_nick=$2,consent_version='launch-v1',consent_at=NOW(),terms_version=$3,privacy_version=$4,terms_accepted_at=NOW(),status='active',updated_at=NOW() WHERE subscriber_id=$1`, [subscriberId, cleanNick || null, termsVersion, privacyVersion]);
    } else {
      subscriberId = randomUUID();
      unsubscribeToken = randomUUID();
      try {
        await this.pool.query(`INSERT INTO gracz_newsletter_subscribers(subscriber_id,email,preferred_nick,consent_version,terms_version,privacy_version,terms_accepted_at,unsubscribe_token) VALUES($1,$2,$3,'launch-v1',$4,$5,NOW(),$6)`, [subscriberId, cleanEmail, cleanNick || null, termsVersion, privacyVersion, unsubscribeToken]);
      } catch (error) {
        if (error?.code === "23505" && String(error.constraint || "").includes("nick")) throw new NewsletterError("Ten nick jest już zarezerwowany. Wybierz inny.", "NICK_TAKEN", 409);
        if (error?.code === "23505") throw new NewsletterError("Ten adres e-mail jest już zapisany.", "EMAIL_EXISTS", 409);
        throw error;
      }
    }

    const mailResult = await sendWelcomeEmail({ email: cleanEmail, preferredNick: cleanNick, unsubscribeToken });
    if (mailResult.sent) {
      await this.pool.query(`UPDATE gracz_newsletter_subscribers SET welcome_email_sent_at=NOW(),updated_at=NOW() WHERE subscriber_id=$1`, [subscriberId]);
    }

    const message = cleanNick
      ? `${alreadySubscribed ? "Twój zapis został zaktualizowany" : "Zapis zakończony pomyślnie"}. Nick ${cleanNick} jest zarezerwowany. ${mailResult.sent ? "Wysłaliśmy wiadomość powitalną na Twój adres e-mail." : "Zapis działa, ale wiadomość powitalna nie została jeszcze wysłana."}`
      : `${alreadySubscribed ? "Twój zapis został zaktualizowany" : "Jesteś na liście pierwszych użytkowników Gracz.pl"}. ${mailResult.sent ? "Wysłaliśmy wiadomość powitalną na Twój adres e-mail." : "Zapis działa, ale wiadomość powitalna nie została jeszcze wysłana."}`;

    return { ok: true, alreadySubscribed, preferredNick: cleanNick || null, welcomeEmailSent: mailResult.sent, message };
  }

  async unsubscribe(token) {
    await this.ready;
    if (!this.pool) return false;
    const result = await this.pool.query(`UPDATE gracz_newsletter_subscribers SET status='unsubscribed',updated_at=NOW() WHERE unsubscribe_token=$1 RETURNING email`, [String(token || "")]);
    return Boolean(result.rows[0]);
  }

  async close() { if (this.pool) await this.pool.end(); }
}

async function sendWelcomeEmail({ email, preferredNick, unsubscribeToken }) {
  if (!RESEND_API_KEY) {
    console.warn("Newsletter: brak RESEND_API_KEY — zapisano subskrybenta, ale e-mail powitalny nie został wysłany.");
    return { sent: false, reason: "missing_api_key" };
  }

  const nickText = preferredNick || "nie podano";
  const unsubscribeUrl = `${BASE_URL}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const html = `<!doctype html><html lang="pl"><body style="margin:0;background:#071015;color:#eaf4ef;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:32px"><div style="font-size:28px;font-weight:800">Gracz<span style="color:#39df83">.pl</span></div><h1 style="font-size:28px;margin:28px 0 10px">Witamy na liście startowej Gracz.pl!</h1><p>Dziękujemy za zapis do newslettera i listy pierwszych użytkowników naszej platformy gier multiplayer.</p><div style="margin:24px 0;padding:20px;background:#0d181d;border:1px solid #28503f;border-radius:12px"><p style="margin:0 0 8px"><strong>Adres e-mail:</strong> ${escapeHtml(email)}</p><p style="margin:0"><strong>Zarezerwowany nick:</strong> ${escapeHtml(nickText)}</p></div><p>Będziemy informować Cię o najważniejszych etapach budowy Gracz.pl, testach gier, nowych funkcjach oraz terminie uruchomienia platformy.</p><p style="margin:28px 0"><a href="${BASE_URL}" style="display:inline-block;background:#2ddd7c;color:#041009;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Odwiedź Gracz.pl</a></p><p><a href="${BASE_URL}/aktualnosci.html" style="color:#54e995">Aktualności</a> · <a href="${BASE_URL}/regulamin-newslettera.html" style="color:#54e995">Regulamin newslettera</a> · <a href="${BASE_URL}/polityka-prywatnosci.html" style="color:#54e995">Polityka prywatności</a></p><hr style="border:0;border-top:1px solid #24352f;margin:28px 0"><p style="font-size:12px;color:#9aaba3">Wiadomość została wysłana, ponieważ ten adres został zapisany do newslettera Gracz.pl. Jeśli nie chcesz otrzymywać kolejnych wiadomości, <a href="${unsubscribeUrl}" style="color:#54e995">wypisz się jednym kliknięciem</a>.</p><p style="font-size:12px;color:#9aaba3">Gracz.pl · Czesław Socha · Chełm Śląski, ul. Żabia 3</p></div></body></html>`;
  const text = `Witamy na liście startowej Gracz.pl!\n\nAdres e-mail: ${email}\nZarezerwowany nick: ${nickText}\n\nAktualności: ${BASE_URL}/aktualnosci.html\nRegulamin: ${BASE_URL}/regulamin-newslettera.html\nPolityka prywatności: ${BASE_URL}/polityka-prywatnosci.html\n\nRezygnacja: ${unsubscribeUrl}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "authorization": `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject: preferredNick ? `Witamy w Gracz.pl — nick ${preferredNick} został zarezerwowany` : "Witamy na liście startowej Gracz.pl",
        html,
        text,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
      })
    });
    if (!response.ok) {
      console.error("Newsletter: Resend zwrócił błąd", response.status, await response.text());
      return { sent: false, reason: `resend_${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("Newsletter: błąd wysyłki wiadomości powitalnej", error);
    return { sent: false, reason: "network_error" };
  }
}

export class NewsletterError extends Error {
  constructor(message, code, status = 400) { super(message); this.name = "NewsletterError"; this.code = code; this.status = status; }
}

export function createNewsletterHandler(service) {
  return async function newsletterHandler(request, response) {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/newsletter/unsubscribe") {
      if (request.method !== "GET" && request.method !== "POST") { sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } }); return true; }
      const ok = await service.unsubscribe(url.searchParams.get("token"));
      response.writeHead(ok ? 200 : 404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(ok ? `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Wypisano z newslettera</title><body style="font-family:Arial;background:#071015;color:#eef6f2;padding:40px"><h1>Zostałeś wypisany z newslettera Gracz.pl.</h1><p>Nie będziemy wysyłać kolejnych wiadomości na ten adres.</p><p><a style="color:#42e487" href="${BASE_URL}">Wróć do Gracz.pl</a></p></body></html>` : `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Nieprawidłowy link</title><body style="font-family:Arial;background:#071015;color:#eef6f2;padding:40px"><h1>Link jest nieprawidłowy lub nieaktualny.</h1></body></html>`);
      return true;
    }
    if (url.pathname !== "/newsletter/subscribe") return false;
    if (request.method !== "POST") { sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } }); return true; }
    try {
      const body = await readJson(request);
      const result = await service.subscribe(body);
      sendJson(response, result.alreadySubscribed ? 200 : 201, result);
    } catch (error) {
      const status = error instanceof NewsletterError ? error.status : 500;
      sendJson(response, status, { error: { code: error.code || "NEWSLETTER_ERROR", message: status === 500 ? "Nie udało się zapisać. Spróbuj ponownie później." : error.message } });
    }
    return true;
  };
}

function validEmail(value) { return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value); }
function validNick(value) { return value === "" || (typeof value === "string" && /^[\p{L}\p{N}_.-]{3,32}$/u.test(value)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }
async function readJson(request, limit = 8192) { let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw new NewsletterError("Za duże żądanie.","REQUEST_TOO_LARGE",413);chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}")}catch{throw new NewsletterError("Nieprawidłowe dane formularza.","INVALID_JSON",400)} }
function sendJson(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body));}
