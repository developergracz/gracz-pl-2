import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || "Gracz.pl <kontakt@gracz.pl>").trim();
const CONTACT_TO = String(process.env.CONTACT_TO || "").trim();
const ALLOWED_ORIGINS = new Set([
  "https://gracz.pl",
  "https://www.gracz.pl",
  "https://gracz-pl-maintenance.onrender.com",
]);
const CATEGORY_SET = new Set([
  "Pytanie ogólne",
  "Problem techniczny",
  "Sugestia / pomysł",
  "Współpraca / reklama",
  "Prywatność / RODO",
  "Inna sprawa",
]);
const buckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

createServer(async (req, res) => {
  const requestId = randomUUID();
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { status: "ok", mailConfigured: Boolean(RESEND_API_KEY && CONTACT_TO && EMAIL_FROM) });
    }
    if (url.pathname !== "/contact") return json(res, 404, { error: { code: "NOT_FOUND", message: "Nie znaleziono zasobu." } });

    const origin = String(req.headers.origin || "");
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json(res, 403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "Niedozwolone źródło żądania." } });
    }
    setCors(res, origin);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin",
      });
      return res.end();
    }
    if (req.method !== "POST") return json(res, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });

    enforceRate(req);
    const body = await readJson(req, 16_384);
    const payload = validate(body);

    if (payload.website) {
      return json(res, 200, { ok: true, id: requestId });
    }
    if (!RESEND_API_KEY || !CONTACT_TO || !EMAIL_FROM) {
      return json(res, 503, { error: { code: "MAIL_NOT_CONFIGURED", message: "Kanał wysyłki wiadomości nie jest jeszcze skonfigurowany." } });
    }

    const text = [
      "Nowa wiadomość z formularza kontaktowego gracz.pl",
      "",
      "Imię i nazwisko: " + payload.name,
      "E-mail nadawcy: " + payload.email,
      "Kategoria: " + payload.category,
      "Temat: " + payload.subject,
      "Strona źródłowa: " + payload.page,
      "",
      "Wiadomość:",
      payload.message,
      "",
      "ID zgłoszenia: " + requestId,
    ].join("\n");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: "Bearer " + RESEND_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [CONTACT_TO],
        subject: "gracz.pl " + payload.category + " — " + payload.subject,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      let providerError = {};
      try { providerError = raw ? JSON.parse(raw) : {}; } catch {}
      console.error("[contact] provider rejected", {
        requestId,
        status: response.status,
        name: typeof providerError?.name === "string" ? providerError.name.slice(0, 80) : null,
        message: typeof providerError?.message === "string" ? providerError.message.slice(0, 300) : null,
      });
      return json(res, 502, { error: { code: "MAIL_DELIVERY_FAILED", message: "Nie udało się wysłać wiadomości. Spróbuj ponownie później." } });
    }

    let result = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch {}
    console.log("[contact] sent", { requestId, providerId: result.id || null, category: payload.category });
    return json(res, 200, { ok: true, id: requestId });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error("[contact] error", { requestId, code: error?.code || "INTERNAL_ERROR" });
    return json(res, status, { error: { code: error?.code || "INTERNAL_ERROR", message: status >= 500 ? "Wewnętrzny błąd serwera." : error.message } });
  }
}).listen(PORT, HOST, () => {
  console.log("gracz.pl contact API listening", { port: PORT, configured: Boolean(RESEND_API_KEY && CONTACT_TO && EMAIL_FROM) });
});

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "false");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim().slice(0, 80);
}

function enforceRate(req) {
  const now = Date.now();
  const key = clientIp(req) || "unknown";
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > MAX_PER_WINDOW) {
    const error = new Error("Za dużo prób wysłania wiadomości. Spróbuj ponownie za kilka minut.");
    error.code = "RATE_LIMITED";
    error.status = 429;
    throw error;
  }
}

async function readJson(req, maxBytes) {
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    const error = new Error("Wymagany jest format JSON.");
    error.code = "INVALID_CONTENT_TYPE";
    error.status = 415;
    throw error;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Wiadomość jest za duża.");
      error.code = "PAYLOAD_TOO_LARGE";
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Nieprawidłowe dane formularza.");
    error.code = "INVALID_JSON";
    error.status = 400;
    throw error;
  }
}

function validate(input) {
  const payload = {
    name: clean(input?.name, 80),
    email: clean(input?.email, 254).toLowerCase(),
    category: clean(input?.category, 60),
    subject: clean(input?.subject, 120),
    message: clean(input?.message, 4000),
    website: clean(input?.website, 120),
    page: clean(input?.page, 500),
    acknowledgement: input?.acknowledgement === true,
  };
  if (payload.name.length < 2) bad("Podaj imię i nazwisko.", "INVALID_NAME");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payload.email)) bad("Podaj prawidłowy adres e-mail.", "INVALID_EMAIL");
  if (!CATEGORY_SET.has(payload.category)) bad("Wybierz prawidłową kategorię.", "INVALID_CATEGORY");
  if (payload.subject.length < 3) bad("Temat musi mieć co najmniej 3 znaki.", "INVALID_SUBJECT");
  if (payload.message.length < 10) bad("Wiadomość musi mieć co najmniej 10 znaków.", "INVALID_MESSAGE");
  if (!payload.acknowledgement) bad("Potwierdzenie zasad obsługi zgłoszenia jest wymagane.", "ACK_REQUIRED");
  return payload;
}

function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

function bad(message, code) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  throw error;
}

function json(res, status, body) {
  if (!res.hasHeader("Cache-Control")) res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.writeHead(status);
  res.end(JSON.stringify(body));
}
