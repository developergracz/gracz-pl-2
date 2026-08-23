const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const PUBLIC_HOSTS = new Set(['gracz.pl', 'www.gracz.pl']);
const databaseUrl = process.env.DATABASE_URL || '';
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  max: 2,
}) : null;

let ready = Promise.resolve();
if (pool) {
  ready = pool.query(`
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
  `).then(() => pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_email_unique ON gracz_newsletter_subscribers (LOWER(email))`))
    .then(() => pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_nick_unique ON gracz_newsletter_subscribers (LOWER(preferred_nick)) WHERE preferred_nick IS NOT NULL`))
    .catch((error) => console.error('Newsletter init error:', error));
}

function hostname(req) {
  return String(req.headers.host || '').toLowerCase().split(':')[0];
}
function isPublicHost(req) { return PUBLIC_HOSTS.has(hostname(req)); }
function sendJson(res, status, body) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
  });
  res.end(JSON.stringify(body));
}
function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}
function validNick(value) {
  return value === '' || (typeof value === 'string' && /^[A-Za-z0-9_.-]{3,32}$/.test(value));
}
async function readJson(req, limit = 8192) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Za duże żądanie.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Nieprawidłowe dane formularza.'), { status: 400 }); }
}

async function subscribe(req, res) {
  if (!pool) return sendJson(res, 503, { error: { code: 'NEWSLETTER_UNAVAILABLE', message: 'Zapisy do newslettera są chwilowo niedostępne.' } });
  await ready;
  const body = await readJson(req);
  const email = String(body.email || '').trim().toLowerCase();
  const preferredNick = String(body.preferredNick || '').trim();
  if (!validEmail(email)) return sendJson(res, 400, { error: { code: 'INVALID_EMAIL', message: 'Podaj prawidłowy adres e-mail.' } });
  if (!validNick(preferredNick)) return sendJson(res, 400, { error: { code: 'INVALID_NICK', message: 'Nick może mieć 3–32 znaki: litery, cyfry, kropkę, _ lub -.' } });
  if (body.consent !== true) return sendJson(res, 400, { error: { code: 'CONSENT_REQUIRED', message: 'Zaznacz zgodę na otrzymywanie informacji o starcie Gracz.pl.' } });

  try {
    const existing = await pool.query('SELECT subscriber_id, preferred_nick, status FROM gracz_newsletter_subscribers WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
    if (existing.rows[0]) {
      if (preferredNick && String(existing.rows[0].preferred_nick || '').toLowerCase() !== preferredNick.toLowerCase()) {
        const nickTaken = await pool.query('SELECT 1 FROM gracz_newsletter_subscribers WHERE LOWER(preferred_nick)=LOWER($1) AND subscriber_id<>$2 LIMIT 1', [preferredNick, existing.rows[0].subscriber_id]);
        if (nickTaken.rows[0]) return sendJson(res, 409, { error: { code: 'NICK_TAKEN', message: 'Ten nick jest już zarezerwowany. Wybierz inny.' } });
      }
      await pool.query(`UPDATE gracz_newsletter_subscribers SET preferred_nick=$2, consent_version='launch-v1', consent_at=NOW(), status='active', updated_at=NOW() WHERE subscriber_id=$1`, [existing.rows[0].subscriber_id, preferredNick || null]);
      return sendJson(res, 200, { ok: true, alreadySubscribed: true, preferredNick: preferredNick || null, message: 'Twój zapis został zaktualizowany.' });
    }

    await pool.query(`INSERT INTO gracz_newsletter_subscribers(subscriber_id,email,preferred_nick,consent_version,unsubscribe_token) VALUES($1,$2,$3,'launch-v1',$4)`, [randomUUID(), email, preferredNick || null, randomUUID()]);
    return sendJson(res, 201, { ok: true, preferredNick: preferredNick || null, message: preferredNick ? `Dziękujemy. Nick ${preferredNick} został zarezerwowany.` : 'Dziękujemy. Jesteś na liście pierwszych użytkowników Gracz.pl.' });
  } catch (error) {
    if (error && error.code === '23505') {
      if (String(error.constraint || '').includes('nick')) return sendJson(res, 409, { error: { code: 'NICK_TAKEN', message: 'Ten nick jest już zarezerwowany. Wybierz inny.' } });
      return sendJson(res, 409, { error: { code: 'EMAIL_EXISTS', message: 'Ten adres e-mail jest już zapisany.' } });
    }
    console.error('Newsletter subscribe error:', error);
    return sendJson(res, 500, { error: { code: 'NEWSLETTER_ERROR', message: 'Nie udało się zapisać. Spróbuj ponownie później.' } });
  }
}

const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function patchedEmit(event, ...args) {
  if (event !== 'request') return originalEmit.call(this, event, ...args);
  const [req, res] = args;
  const path = new URL(req.url || '/', 'http://localhost').pathname;

  if (isPublicHost(req) && req.method === 'POST' && (path === '/auth/login' || path === '/auth/register')) {
    sendJson(res, 403, { error: { code: 'PUBLIC_LAUNCH_DISABLED', message: 'Logowanie i rejestracja są wyłączone do czasu oficjalnego uruchomienia Gracz.pl.' } });
    return true;
  }
  if (isPublicHost(req) && req.method === 'POST' && path === '/newsletter/subscribe') {
    subscribe(req, res).catch((error) => sendJson(res, error.status || 500, { error: { code: 'NEWSLETTER_ERROR', message: error.message || 'Błąd zapisu.' } }));
    return true;
  }
  return originalEmit.call(this, event, ...args);
};
