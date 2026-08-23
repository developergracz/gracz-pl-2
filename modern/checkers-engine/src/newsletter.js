import pg from "pg";
import { randomUUID } from "node:crypto";

const { Pool } = pg;

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
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        unsubscribe_token UUID NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_email_unique ON gracz_newsletter_subscribers (LOWER(email))`);
    await this.pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_nick_unique ON gracz_newsletter_subscribers (LOWER(preferred_nick)) WHERE preferred_nick IS NOT NULL`);
  }

  async subscribe({ email, preferredNick = "", consent = false }) {
    await this.ready;
    if (!this.pool) throw new NewsletterError("Zapisy są chwilowo niedostępne.", "NEWSLETTER_UNAVAILABLE", 503);
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanNick = String(preferredNick || "").trim();
    if (!validEmail(cleanEmail)) throw new NewsletterError("Podaj prawidłowy adres e-mail.", "INVALID_EMAIL", 400);
    if (!validNick(cleanNick)) throw new NewsletterError("Nick może mieć 3–32 znaki: litery, cyfry, kropkę, _ lub -.", "INVALID_NICK", 400);
    if (consent !== true) throw new NewsletterError("Zaznacz zgodę na otrzymywanie informacji o starcie Gracz.pl.", "CONSENT_REQUIRED", 400);

    const existing = await this.pool.query(`SELECT subscriber_id,preferred_nick FROM gracz_newsletter_subscribers WHERE LOWER(email)=LOWER($1) LIMIT 1`, [cleanEmail]);
    if (existing.rows[0]) {
      if (cleanNick) {
        const nickTaken = await this.pool.query(`SELECT 1 FROM gracz_newsletter_subscribers WHERE LOWER(preferred_nick)=LOWER($1) AND subscriber_id<>$2 LIMIT 1`, [cleanNick, existing.rows[0].subscriber_id]);
        if (nickTaken.rows[0]) throw new NewsletterError("Ten nick jest już zarezerwowany. Wybierz inny.", "NICK_TAKEN", 409);
      }
      await this.pool.query(`UPDATE gracz_newsletter_subscribers SET preferred_nick=$2,consent_version='launch-v1',consent_at=NOW(),status='active',updated_at=NOW() WHERE subscriber_id=$1`, [existing.rows[0].subscriber_id, cleanNick || null]);
      return { ok: true, alreadySubscribed: true, preferredNick: cleanNick || null, message: "Twój zapis został zaktualizowany." };
    }

    try {
      await this.pool.query(`INSERT INTO gracz_newsletter_subscribers(subscriber_id,email,preferred_nick,consent_version,unsubscribe_token) VALUES($1,$2,$3,'launch-v1',$4)`, [randomUUID(), cleanEmail, cleanNick || null, randomUUID()]);
    } catch (error) {
      if (error?.code === "23505" && String(error.constraint || "").includes("nick")) throw new NewsletterError("Ten nick jest już zarezerwowany. Wybierz inny.", "NICK_TAKEN", 409);
      if (error?.code === "23505") throw new NewsletterError("Ten adres e-mail jest już zapisany.", "EMAIL_EXISTS", 409);
      throw error;
    }
    return { ok: true, preferredNick: cleanNick || null, message: cleanNick ? `Dziękujemy. Nick ${cleanNick} został zarezerwowany.` : "Dziękujemy. Jesteś na liście pierwszych użytkowników Gracz.pl." };
  }

  async close() { if (this.pool) await this.pool.end(); }
}

export class NewsletterError extends Error {
  constructor(message, code, status = 400) { super(message); this.name = "NewsletterError"; this.code = code; this.status = status; }
}

export function createNewsletterHandler(service) {
  return async function newsletterHandler(request, response) {
    const url = new URL(request.url, "http://localhost");
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
function validNick(value) { return value === "" || (typeof value === "string" && /^[A-Za-z0-9_.-]{3,32}$/.test(value)); }
async function readJson(request, limit = 8192) { let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw new NewsletterError("Za duże żądanie.","REQUEST_TOO_LARGE",413);chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}")}catch{throw new NewsletterError("Nieprawidłowe dane formularza.","INVALID_JSON",400)} }
function sendJson(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});response.end(JSON.stringify(body));}
