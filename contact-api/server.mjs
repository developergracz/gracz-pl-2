import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { resolveMx } from "node:dns/promises";

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || "Gracz.pl <kontakt@gracz.pl>").trim();
const CONTACT_TO = String(process.env.CONTACT_TO || "").trim().toLowerCase();
const TURNSTILE_SECRET_KEY = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
const TURNSTILE_SITE_KEY = String(process.env.TURNSTILE_SITE_KEY || "").trim();
const TURNSTILE_ENABLED = Boolean(TURNSTILE_SECRET_KEY && TURNSTILE_SITE_KEY);
const RISK_CHALLENGE_THRESHOLD = Number(process.env.RISK_CHALLENGE_THRESHOLD || 55);
const RISK_BLOCK_THRESHOLD = Number(process.env.RISK_BLOCK_THRESHOLD || 85);

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

const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
]);

const DOMAIN_TYPOS = new Map([
  ["gmial.com", "gmail.com"],
  ["gmal.com", "gmail.com"],
  ["gmail.con", "gmail.com"],
  ["gmail.co", "gmail.com"],
  ["outlok.com", "outlook.com"],
  ["outllook.com", "outlook.com"],
  ["hotnail.com", "hotmail.com"],
  ["wppl", "wp.pl"],
  ["wp.com.pl", "wp.pl"],
  ["o2pl", "o2.pl"],
  ["interiapl", "interia.pl"],
]);

const ipBuckets = new Map();
const emailBuckets = new Map();
const duplicateSubmissions = new Map();
const idempotencyCache = new Map();
const abuseStrikes = new Map();
const mxCache = new Map();

const providerCircuit = {
  failures: [],
  openUntil: 0,
};

const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_PER_WINDOW = 5;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MAX_PER_WINDOW = 8;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const MIN_FORM_TIME_MS = 2500;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;
const MX_CACHE_MS = 6 * 60 * 60 * 1000;
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const ABUSE_STRIKE_WINDOW_MS = 60 * 60 * 1000;
const ABUSE_BLOCK_MS = 60 * 60 * 1000;
const ABUSE_STRIKE_LIMIT = 3;
const PROVIDER_FAILURE_WINDOW_MS = 5 * 60 * 1000;
const PROVIDER_FAILURE_LIMIT = 5;
const PROVIDER_CIRCUIT_OPEN_MS = 2 * 60 * 1000;

createServer(async (req, res) => {
  const requestId = randomUUID();

  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        status: "ok",
        mailConfigured: Boolean(RESEND_API_KEY && CONTACT_TO && EMAIL_FROM),
      });
    }

    if (url.pathname !== "/contact") {
      return json(res, 404, {
        error: { code: "NOT_FOUND", message: "Nie znaleziono zasobu." },
      });
    }

    const origin = String(req.headers.origin || "");
    if (!ALLOWED_ORIGINS.has(origin)) {
      return json(res, 403, {
        error: { code: "ORIGIN_NOT_ALLOWED", message: "Niedozwolone źródło żądania." },
      });
    }

    setCors(res, origin);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Idempotency-Key",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin",
      });
      return res.end();
    }

    if (req.method !== "POST") {
      return json(res, 405, {
        error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." },
      });
    }

    const ip = clientIp(req) || "unknown";
    enforceTemporaryBlock(ip);
    enforceIpRate(req);

    const idempotencyKey = validateIdempotencyKey(req.headers["x-idempotency-key"]);
    const replay = getIdempotentReplay(ip, idempotencyKey);
    if (replay) {
      return json(res, replay.status, replay.body);
    }

    const body = await readJson(req, 16_384);
    const payload = validateBasics(body);

    if (payload.website) {
      registerAbuseStrike(ip, "honeypot");
      const fake = { ok: true, id: requestId };
      rememberIdempotentResult(ip, idempotencyKey, 200, fake);
      return json(res, 200, fake);
    }

    enforceFormTiming(payload.startedAt);
    await validateEmailDomain(payload.email);
    enforceEmailRate(payload.email);
    enforceSpamRules(payload);
    enforceDuplicate(payload);

    const risk = calculateRisk(req, payload);
    if (risk.score >= RISK_BLOCK_THRESHOLD) {
      registerAbuseStrike(ip, "risk-block");
      const error = new Error("Nie udało się zweryfikować zgłoszenia. Spróbuj ponownie później.");
      error.code = "RISK_BLOCKED";
      error.status = 429;
      throw error;
    }

    if (TURNSTILE_ENABLED && risk.score >= RISK_CHALLENGE_THRESHOLD) {
      await verifyTurnstile(payload.turnstileToken, ip);
    }

    ensureProviderCircuitClosed();

    if (payload.email === CONTACT_TO) {
      bad(
        "Podaj adres e-mail inny niż administracyjny adres kontaktowy gracz.pl.",
        "ADMIN_EMAIL_NOT_ALLOWED"
      );
    }

    if (!RESEND_API_KEY || !CONTACT_TO || !EMAIL_FROM) {
      return json(res, 503, {
        error: {
          code: "MAIL_NOT_CONFIGURED",
          message: "Kanał wysyłki wiadomości nie jest jeszcze skonfigurowany.",
        },
      });
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
        reply_to: payload.email,
        subject: "gracz.pl " + payload.category + " — " + payload.subject,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const raw = await response.text().catch(() => "");

    if (!response.ok) {
      recordProviderFailure();
      let providerError = {};
      try {
        providerError = raw ? JSON.parse(raw) : {};
      } catch {}

      console.error("[contact] provider rejected", {
        requestId,
        status: response.status,
        name:
          typeof providerError?.name === "string"
            ? providerError.name.slice(0, 80)
            : null,
        message:
          typeof providerError?.message === "string"
            ? providerError.message.slice(0, 300)
            : null,
      });

      return json(res, 502, {
        error: {
          code: "MAIL_DELIVERY_FAILED",
          message: "Nie udało się wysłać wiadomości. Spróbuj ponownie później.",
        },
      });
    }

    let result = {};
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {}

    rememberDuplicate(payload);
    recordProviderSuccess();

    const successBody = { ok: true, id: requestId };
    rememberIdempotentResult(ip, idempotencyKey, 200, successBody);

    console.log("[contact] sent", {
      requestId,
      providerId: result.id || null,
      category: payload.category,
      emailHash: hashValue(payload.email).slice(0, 12),
      riskScore: risk.score,
      riskSignals: risk.signals,
    });

    return json(res, 200, successBody);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;

    if (status >= 500) {
      console.error("[contact] error", {
        requestId,
        code: error?.code || "INTERNAL_ERROR",
      });
    }

    return json(res, status, {
      error: {
        code: error?.code || "INTERNAL_ERROR",
        message:
          status >= 500 ? "Wewnętrzny błąd serwera." : error.message,
      },
    });
  }
}).listen(PORT, HOST, () => {
  console.log("gracz.pl contact API listening", {
    port: PORT,
    configured: Boolean(RESEND_API_KEY && CONTACT_TO && EMAIL_FROM),
  });
});

function setCors(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "false");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function enforceIpRate(req) {
  rateLimit(
    ipBuckets,
    clientIp(req) || "unknown",
    IP_WINDOW_MS,
    IP_MAX_PER_WINDOW,
    "Za dużo prób wysłania wiadomości. Spróbuj ponownie za kilka minut."
  );
}

function enforceEmailRate(email) {
  rateLimit(
    emailBuckets,
    hashValue(email),
    EMAIL_WINDOW_MS,
    EMAIL_MAX_PER_WINDOW,
    "Z tego adresu wysłano zbyt wiele wiadomości. Spróbuj ponownie później."
  );
}

function rateLimit(store, key, windowMs, max, message) {
  cleanupBuckets(store, windowMs);
  const now = Date.now();
  const current = store.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    store.set(key, { startedAt: now, count: 1 });
    return;
  }

  current.count += 1;

  if (current.count > max) {
    const error = new Error(message);
    error.code = "RATE_LIMITED";
    error.status = 429;
    throw error;
  }
}

function cleanupBuckets(store, windowMs) {
  const now = Date.now();
  for (const [key, value] of store) {
    if (now - value.startedAt >= windowMs) store.delete(key);
  }
}

async function readJson(req, maxBytes) {
  if (
    !String(req.headers["content-type"] || "")
      .toLowerCase()
      .startsWith("application/json")
  ) {
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

function validateBasics(input) {
  const payload = {
    name: clean(input?.name, 80),
    email: clean(input?.email, 254).toLowerCase(),
    category: clean(input?.category, 60),
    subject: clean(input?.subject, 120),
    message: cleanMultiline(input?.message, 4000),
    website: clean(input?.website, 120),
    page: clean(input?.page, 500),
    acknowledgement: input?.acknowledgement === true,
    startedAt: Number(input?.startedAt || 0),
    turnstileToken: clean(input?.turnstileToken, 2048),
  };

  if (payload.name.length < 2) {
    bad("Podaj imię i nazwisko.", "INVALID_NAME");
  }

  if (!isValidEmailSyntax(payload.email)) {
    bad("Podaj prawidłowy adres e-mail.", "INVALID_EMAIL");
  }

  if (!CATEGORY_SET.has(payload.category)) {
    bad("Wybierz prawidłową kategorię.", "INVALID_CATEGORY");
  }

  if (payload.subject.length < 3) {
    bad("Temat musi mieć co najmniej 3 znaki.", "INVALID_SUBJECT");
  }

  if (payload.message.length < 10) {
    bad("Wiadomość musi mieć co najmniej 10 znaków.", "INVALID_MESSAGE");
  }

  if (!payload.acknowledgement) {
    bad(
      "Potwierdzenie zasad obsługi zgłoszenia jest wymagane.",
      "ACK_REQUIRED"
    );
  }

  return payload;
}

function isValidEmailSyntax(email) {
  if (!email || email.length > 254) return false;
  if (/[
]/.test(email)) return false;

  const match = /^([^\s@]+)@([^\s@]+)$/.exec(email);
  if (!match) return false;

  const local = match[1];
  const domain = match[2];

  if (local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  if (!isValidDomain(domain)) return false;

  return true;
}

function isValidDomain(domain) {
  if (domain.length > 253 || domain.includes("..")) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;

  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

async function validateEmailDomain(email) {
  const domain = email.split("@").pop().toLowerCase();

  if (DISPOSABLE_DOMAINS.has(domain)) {
    bad(
      "Tymczasowe adresy e-mail nie są obsługiwane. Podaj stały adres e-mail.",
      "DISPOSABLE_EMAIL"
    );
  }

  const suggestion = DOMAIN_TYPOS.get(domain);
  if (suggestion) {
    bad(
      "Sprawdź domenę adresu e-mail. Czy chodziło Ci o " + suggestion + "?",
      "EMAIL_DOMAIN_TYPO"
    );
  }

  const now = Date.now();
  const cached = mxCache.get(domain);

  if (cached && now - cached.checkedAt < MX_CACHE_MS) {
    if (!cached.valid) {
      bad(
        "Domena tego adresu e-mail nie obsługuje poczty. Sprawdź adres.",
        "EMAIL_DOMAIN_NO_MX"
      );
    }
    return;
  }

  let mx = [];

  try {
    mx = await Promise.race([
      resolveMx(domain),
      timeoutReject(2500, "MX_TIMEOUT"),
    ]);
  } catch (error) {
    if (error?.message === "MX_TIMEOUT") {
      const timeout = new Error(
        "Nie udało się teraz zweryfikować domeny e-mail. Spróbuj ponownie za chwilę."
      );
      timeout.code = "EMAIL_DOMAIN_CHECK_TIMEOUT";
      timeout.status = 503;
      throw timeout;
    }

    mxCache.set(domain, { valid: false, checkedAt: now });
    bad(
      "Domena tego adresu e-mail nie obsługuje poczty. Sprawdź adres.",
      "EMAIL_DOMAIN_NO_MX"
    );
  }

  const valid = Array.isArray(mx) && mx.some((entry) => entry?.exchange);
  mxCache.set(domain, { valid, checkedAt: now });

  if (!valid) {
    bad(
      "Domena tego adresu e-mail nie obsługuje poczty. Sprawdź adres.",
      "EMAIL_DOMAIN_NO_MX"
    );
  }
}

function timeoutReject(ms, marker) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(marker)), ms);
  });
}

function enforceFormTiming(startedAt) {
  const now = Date.now();

  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    bad("Odśwież formularz i spróbuj ponownie.", "FORM_TIMING_INVALID");
  }

  const age = now - startedAt;

  if (age < MIN_FORM_TIME_MS) {
    const error = new Error("Formularz został wysłany zbyt szybko.");
    error.code = "FORM_TOO_FAST";
    error.status = 429;
    throw error;
  }

  if (age > MAX_FORM_AGE_MS) {
    bad("Formularz wygasł. Otwórz go ponownie i spróbuj jeszcze raz.", "FORM_EXPIRED");
  }
}

function enforceSpamRules(payload) {
  const combined = (payload.subject + "\n" + payload.message).toLowerCase();
  const urlMatches = combined.match(/(?:https?:\/\/|www\.)/g) || [];

  if (urlMatches.length > 3) {
    const error = new Error(
      "Wiadomość zawiera zbyt wiele linków. Usuń część odnośników i spróbuj ponownie."
    );
    error.code = "SPAM_LINK_LIMIT";
    error.status = 400;
    throw error;
  }

  if (/(.)\1{19,}/u.test(combined)) {
    const error = new Error(
      "Wiadomość zawiera nietypowo długie powtórzenia znaków."
    );
    error.code = "SPAM_REPETITION";
    error.status = 400;
    throw error;
  }

  const normalized = combined.replace(/\s+/g, " ").trim();
  if (normalized.length > 0 && uniqueWordRatio(normalized) < 0.18 && normalized.length > 250) {
    const error = new Error(
      "Wiadomość wygląda na automatycznie powieloną. Zmień treść i spróbuj ponownie."
    );
    error.code = "SPAM_LOW_VARIETY";
    error.status = 400;
    throw error;
  }
}

function uniqueWordRatio(text) {
  const words = text.match(/[\p{L}\p{N}]{2,}/gu) || [];
  if (words.length < 10) return 1;
  return new Set(words).size / words.length;
}


function validateIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!/^[a-zA-Z0-9._:-]{16,128}$/.test(key)) {
    bad("Odśwież formularz i spróbuj ponownie.", "INVALID_IDEMPOTENCY_KEY");
  }
  return key;
}

function idempotencyStorageKey(ip, key) {
  return hashValue(ip + "\n" + key);
}

function getIdempotentReplay(ip, key) {
  cleanupIdempotency();
  const entry = idempotencyCache.get(idempotencyStorageKey(ip, key));
  if (!entry) return null;
  if (entry.state === "done") return { status: entry.status, body: entry.body };

  const error = new Error("Ta wiadomość jest już przetwarzana. Poczekaj chwilę.");
  error.code = "REQUEST_IN_PROGRESS";
  error.status = 409;
  throw error;
}

function rememberIdempotentResult(ip, key, status, body) {
  cleanupIdempotency();
  idempotencyCache.set(idempotencyStorageKey(ip, key), {
    state: "done",
    status,
    body,
    createdAt: Date.now(),
  });
}

function cleanupIdempotency() {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache) {
    if (now - entry.createdAt >= IDEMPOTENCY_TTL_MS) idempotencyCache.delete(key);
  }
}

function registerAbuseStrike(ip, reason) {
  const now = Date.now();
  const key = hashValue(ip);
  const current = abuseStrikes.get(key);

  if (!current || now - current.startedAt >= ABUSE_STRIKE_WINDOW_MS) {
    abuseStrikes.set(key, { startedAt: now, count: 1, blockedUntil: 0 });
    return;
  }

  current.count += 1;
  if (current.count >= ABUSE_STRIKE_LIMIT) {
    current.blockedUntil = now + ABUSE_BLOCK_MS;
  }

  console.warn("[contact] abuse signal", {
    ipHash: key.slice(0, 12),
    reason,
    count: current.count,
  });
}

function enforceTemporaryBlock(ip) {
  const key = hashValue(ip);
  const current = abuseStrikes.get(key);
  if (!current) return;

  const now = Date.now();
  if (current.blockedUntil > now) {
    const error = new Error("Zbyt wiele podejrzanych prób. Spróbuj ponownie później.");
    error.code = "TEMPORARILY_BLOCKED";
    error.status = 429;
    throw error;
  }

  if (now - current.startedAt >= ABUSE_STRIKE_WINDOW_MS) {
    abuseStrikes.delete(key);
  }
}

function calculateRisk(req, payload) {
  let score = 0;
  const signals = [];
  const age = Date.now() - payload.startedAt;
  const combined = (payload.subject + "\n" + payload.message).toLowerCase();
  const urls = combined.match(/(?:https?:\/\/|www\.)/g) || [];
  const ua = String(req.headers["user-agent"] || "");
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!ua || ua.length < 8) {
    score += 25;
    signals.push("missing-user-agent");
  }
  if (age < 5000) {
    score += 15;
    signals.push("fast-submit");
  }
  if (urls.length === 1) {
    score += 8;
    signals.push("one-url");
  } else if (urls.length === 2) {
    score += 18;
    signals.push("two-urls");
  } else if (urls.length >= 3) {
    score += 30;
    signals.push("three-urls");
  }
  if (forwarded.length > 3) {
    score += 12;
    signals.push("long-proxy-chain");
  }
  if (payload.message.length > 2500) {
    score += 8;
    signals.push("very-long-message");
  }
  if (uppercaseRatio(payload.subject + " " + payload.message) > 0.7) {
    score += 10;
    signals.push("high-uppercase");
  }

  return { score: Math.min(score, 100), signals };
}

function uppercaseRatio(text) {
  const letters = String(text).match(/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g) || [];
  if (letters.length < 20) return 0;
  const upper = letters.filter((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
  return upper.length / letters.length;
}

async function verifyTurnstile(token, ip) {
  if (!token) {
    const error = new Error("Wymagana jest dodatkowa weryfikacja antybotowa.");
    error.code = "CHALLENGE_REQUIRED";
    error.status = 428;
    throw error;
  }

  const body = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: ip,
  });

  let response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    const error = new Error("Weryfikacja antybotowa jest chwilowo niedostępna.");
    error.code = "CHALLENGE_UNAVAILABLE";
    error.status = 503;
    throw error;
  }

  let result = {};
  try {
    result = await response.json();
  } catch {}

  if (!response.ok || result?.success !== true) {
    const error = new Error("Nie udało się potwierdzić weryfikacji antybotowej.");
    error.code = "CHALLENGE_FAILED";
    error.status = 403;
    throw error;
  }
}

function ensureProviderCircuitClosed() {
  const now = Date.now();
  if (providerCircuit.openUntil > now) {
    const error = new Error("Kanał wysyłki jest chwilowo przeciążony. Spróbuj ponownie za kilka minut.");
    error.code = "MAIL_CIRCUIT_OPEN";
    error.status = 503;
    throw error;
  }
}

function recordProviderFailure() {
  const now = Date.now();
  providerCircuit.failures = providerCircuit.failures.filter(
    (time) => now - time < PROVIDER_FAILURE_WINDOW_MS
  );
  providerCircuit.failures.push(now);

  if (providerCircuit.failures.length >= PROVIDER_FAILURE_LIMIT) {
    providerCircuit.openUntil = now + PROVIDER_CIRCUIT_OPEN_MS;
  }
}

function recordProviderSuccess() {
  providerCircuit.failures = [];
  providerCircuit.openUntil = 0;
}

function duplicateKey(payload) {
  return hashValue(
    [payload.email, payload.category, payload.subject, payload.message].join("\n")
  );
}

function enforceDuplicate(payload) {
  cleanupDuplicates();

  const key = duplicateKey(payload);
  const previous = duplicateSubmissions.get(key);

  if (previous && Date.now() - previous < DUPLICATE_WINDOW_MS) {
    const error = new Error(
      "Ta sama wiadomość została już niedawno wysłana. Nie wysyłaj jej ponownie."
    );
    error.code = "DUPLICATE_SUBMISSION";
    error.status = 409;
    throw error;
  }
}

function rememberDuplicate(payload) {
  cleanupDuplicates();
  duplicateSubmissions.set(duplicateKey(payload), Date.now());
}

function cleanupDuplicates() {
  const now = Date.now();
  for (const [key, createdAt] of duplicateSubmissions) {
    if (now - createdAt >= DUPLICATE_WINDOW_MS) {
      duplicateSubmissions.delete(key);
    }
  }
}

function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function clean(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function bad(message, code) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  throw error;
}

function json(res, status, body) {
  if (!res.hasHeader("Cache-Control")) {
    res.setHeader("Cache-Control", "no-store");
  }

  if (!res.hasHeader("X-Content-Type-Options")) {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.writeHead(status);
  res.end(JSON.stringify(body));
}
