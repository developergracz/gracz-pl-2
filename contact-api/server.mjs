import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { resolveMx } from "node:dns/promises";
import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { createPremiumReplyManager } from "./premium-reply.mjs";
import { createNewsletterManager } from "./newsletter.mjs";
import { createDatabase } from "./persistence/database.mjs";
import { createPersistenceRepositories } from "./persistence/repositories.mjs";
import { createMemoryReplyTokenStore } from "./persistence/memory-reply-token-store.mjs";
import { createMemoryIdempotencyStore } from "./persistence/memory-idempotency-store.mjs";
import { createMemoryNewsletterConsentStore } from "./persistence/memory-newsletter-consent-store.mjs";
import { createNewsletterRoute } from "./routes/newsletter-route.mjs";
import { createPremiumReplyRoute } from "./routes/premium-reply-route.mjs";

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const RESEND_ENDPOINT = String(
  process.env.RESEND_ENDPOINT || "https://api.resend.com/emails"
).trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || "Gracz.pl <kontakt@gracz.pl>").trim();
const CONTACT_TO = String(process.env.CONTACT_TO || "").trim();
const EMAIL_FROM_ADDRESS = extractMailbox(EMAIL_FROM);
const CONTACT_TO_ADDRESS = extractMailbox(CONTACT_TO);
const CONTACT_REPLY_SECRET = String(process.env.CONTACT_REPLY_SECRET || "").trim();
const NEWSLETTER_URL = String(
  process.env.NEWSLETTER_URL || "https://gracz.pl/newsletter/"
).trim();
const NEWSLETTER_SECRET = String(process.env.NEWSLETTER_SECRET || "").trim();
const NEWSLETTER_RESEND_API_KEY = String(
  process.env.NEWSLETTER_RESEND_API_KEY || ""
).trim();
const RESEND_API_BASE = String(
  process.env.RESEND_API_BASE || "https://api.resend.com"
).trim();

if (!EMAIL_FROM_ADDRESS || !CONTACT_TO_ADDRESS) {
  throw new Error("EMAIL_FROM and CONTACT_TO must contain valid mailbox addresses");
}
if (EMAIL_FROM_ADDRESS === CONTACT_TO_ADDRESS) {
  throw new Error("EMAIL_FROM and CONTACT_TO must use different mailbox addresses");
}

const database = createDatabase();
const persistence = database.enabled
  ? createPersistenceRepositories(database)
  : null;

const useTestReplyStore =
  process.env.NODE_ENV === "test" &&
  process.env.PREMIUM_REPLY_TEST_MEMORY_STORE === "1";

const replyTokenStore = useTestReplyStore
  ? createMemoryReplyTokenStore()
  : persistence?.replyTokens || null;

const useTestContactIdempotencyStore =
  process.env.NODE_ENV === "test" &&
  process.env.CONTACT_IDEMPOTENCY_TEST_MEMORY_STORE === "1";

const contactIdempotencyStore = useTestContactIdempotencyStore
  ? createMemoryIdempotencyStore()
  : persistence?.idempotency || null;

const premiumReply = createPremiumReplyManager({
  secret: CONTACT_REPLY_SECRET,
  ownerAddress: CONTACT_TO_ADDRESS,
  newsletterUrl: NEWSLETTER_URL,
  tokenStore: replyTokenStore,
});

const useTestNewsletterConsentStore =
  process.env.NODE_ENV === "test" &&
  process.env.NEWSLETTER_CONSENT_TEST_MEMORY_STORE === "1";

const newsletterConsentStore = useTestNewsletterConsentStore
  ? createMemoryNewsletterConsentStore()
  : persistence?.newsletter || null;

const NEWSLETTER_CONSENT_HASH_SECRET = String(
  process.env.NEWSLETTER_CONSENT_HASH_SECRET || ""
).trim();

const newsletter = createNewsletterManager({
  secret: NEWSLETTER_SECRET,
  resendApiKey: NEWSLETTER_RESEND_API_KEY,
  resendApiBase: RESEND_API_BASE,
  emailEndpoint: RESEND_ENDPOINT,
  emailFrom: EMAIL_FROM,
  replyTo: CONTACT_TO_ADDRESS,
  baseUrl: NEWSLETTER_URL,
  consentStore: newsletterConsentStore,
  consentHashSecret: NEWSLETTER_CONSENT_HASH_SECRET,
});

const TURNSTILE_SECRET_KEY = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
const TURNSTILE_SITE_KEY = String(process.env.TURNSTILE_SITE_KEY || "").trim();
const TURNSTILE_ENABLED = Boolean(TURNSTILE_SECRET_KEY && TURNSTILE_SITE_KEY);
const RISK_CHALLENGE_THRESHOLD = readRiskThreshold("RISK_CHALLENGE_THRESHOLD", 55);
const RISK_BLOCK_THRESHOLD = readRiskThreshold("RISK_BLOCK_THRESHOLD", 85);

if (RISK_CHALLENGE_THRESHOLD >= RISK_BLOCK_THRESHOLD) {
  throw new Error("RISK_CHALLENGE_THRESHOLD must be lower than RISK_BLOCK_THRESHOLD");
}

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
const replyIpBuckets = new Map();
const newsletterIpBuckets = new Map();
const newsletterEmailBuckets = new Map();
const emailBuckets = new Map();
const duplicateSubmissions = new Map();
const abuseStrikes = new Map();
const mxCache = new Map();
const mxInFlight = new Map();

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
const MAX_IP_BUCKETS = 5000;
const MAX_EMAIL_BUCKETS = 5000;
const MAX_DUPLICATES = 5000;
const MAX_ABUSE_STRIKES = 5000;
const MAX_MX_CACHE = 2000;
const MAX_MX_IN_FLIGHT = 50;

const handleNewsletterRequest = createNewsletterRoute({
  allowedOrigins: ALLOWED_ORIGINS,
  newsletter,
  newsletterIpBuckets,
  newsletterEmailBuckets,
  rateLimit,
  hashValue,
  clientIp,
  readJson,
  json,
  setCors,
  bad,
  normalizeEmail,
  requiredString,
  optionalString,
  parseStartedAt,
  isValidEmailSyntax,
  enforceFormTiming,
  validateEmailDomain,
});

const handlePremiumReplyRequest = createPremiumReplyRoute({
  allowedOrigins: ALLOWED_ORIGINS,
  premiumReply,
  replyIpBuckets,
  rateLimit,
  hashValue,
  clientIp,
  readJson,
  json,
  setCors,
  resendApiKey: RESEND_API_KEY,
  resendEndpoint: RESEND_ENDPOINT,
  emailFrom: EMAIL_FROM,
  emailFromAddress: EMAIL_FROM_ADDRESS,
  contactToAddress: CONTACT_TO_ADDRESS,
  ensureProviderCircuitClosed,
  recordProviderFailure,
  recordProviderSuccess,
});

createServer(async (req, res) => {
  const requestId = randomUUID();
  let reservedIdempotency = null;
  let providerAttempted = false;

  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, {
        status: "ok",
        mailConfigured: Boolean(
          RESEND_API_KEY && CONTACT_TO_ADDRESS && EMAIL_FROM_ADDRESS
        ),
        persistenceConfigured: database.enabled,
        premiumReplyConfigured: premiumReply.enabled,
        premiumReplyDurableState: premiumReply.durableStateConfigured,
        contactIdempotencyConfigured: Boolean(contactIdempotencyStore),
        newsletterConfigured: newsletter.enabled,
        newsletterConsentLedger: newsletter.consentLedgerConfigured,
      });
    }

    if (url.pathname === "/reply-context" || url.pathname === "/reply") {
      return await handlePremiumReplyRequest(req, res, url, requestId);
    }

    if (url.pathname.startsWith("/newsletter/")) {
      try {
        return await handleNewsletterRequest(req, res, url, requestId);
      } catch (error) {
        if (error?.providerOperation) {
          console.error("[newsletter] provider failure", {
            requestId,
            code: error?.code || "NEWSLETTER_PROVIDER_FAILED",
            operation: error.providerOperation,
            providerStatus: error.providerStatus ?? null,
            providerName: error.providerName || null,
            providerRequestId: error.providerRequestId || null,
          });
        }
        throw error;
      }
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

    const body = await readJson(req, 16_384);
    const payload = validateBasics(body);
    const requestFingerprint = submissionFingerprint(payload);
    const rawIdempotencyKey = req.headers["x-idempotency-key"];
    const idempotencyKey = rawIdempotencyKey
      ? validateIdempotencyKey(rawIdempotencyKey)
      : "legacy-" + requestFingerprint.slice(0, 32);

    const replay = await getContactIdempotentReplay(
      idempotencyKey,
      requestFingerprint
    );
    if (replay) {
      return json(res, replay.status, replay.body);
    }

    if (payload.website) {
      registerAbuseStrike(ip, "honeypot");
      const reservation = await reserveContactIdempotency(
        idempotencyKey,
        requestFingerprint
      );
      if (reservation.replay) {
        return json(res, reservation.replay.status, reservation.replay.body);
      }

      reservedIdempotency = reservation.reservation;
      const fake = { ok: true, id: requestId };
      try {
        const completed = await completeContactIdempotency(
          reservedIdempotency,
          200,
          fake
        );
        if (completed) reservedIdempotency = null;
      } catch (persistenceError) {
        console.error("[contact] honeypot idempotency commit failed", {
          requestId,
          code: persistenceError?.code || "PERSISTENCE_ERROR",
        });
      }
      return json(res, 200, fake);
    }

    if (payload.startedAt > 0) {
      enforceFormTiming(payload.startedAt);
    }

    if (
      sameProtectedMailbox(payload.email, CONTACT_TO_ADDRESS) ||
      sameProtectedMailbox(payload.email, EMAIL_FROM_ADDRESS)
    ) {
      bad(
        "Podaj adres e-mail inny niż administracyjny lub techniczny adres gracz.pl.",
        "ADMIN_EMAIL_NOT_ALLOWED"
      );
    }

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

    if (!RESEND_API_KEY || !CONTACT_TO_ADDRESS || !EMAIL_FROM_ADDRESS) {
      return json(res, 503, {
        error: {
          code: "MAIL_NOT_CONFIGURED",
          message: "Kanał wysyłki wiadomości nie jest jeszcze skonfigurowany.",
        },
      });
    }

    const reservation = await reserveContactIdempotency(
      idempotencyKey,
      requestFingerprint
    );
    if (reservation.replay) {
      return json(res, reservation.replay.status, reservation.replay.body);
    }
    reservedIdempotency = reservation.reservation;

    if (premiumReply.enabled && persistence) {
      const created = await persistence.contactCases.create({
        requestId,
        senderHash: hashValue(payload.email),
        category: payload.category,
        subject: payload.subject,
        sourcePath: payload.page,
      });

      if (!created) {
        const error = new Error("Nie udało się utworzyć trwałego rekordu zgłoszenia.");
        error.code = "CONTACT_CASE_PERSISTENCE_FAILED";
        error.status = 503;
        throw error;
      }
    }

    const adminDelivery = await premiumReply.createAdminDelivery(payload, requestId);

    let response;
    providerAttempted = true;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: "Bearer " + RESEND_API_KEY,
          "content-type": "application/json",
          "Idempotency-Key": "contact/" + idempotencyKey,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [CONTACT_TO_ADDRESS],
          reply_to: payload.email,
          subject: "♦️ gracz.pl " + payload.category + " — " + payload.subject,
          text: adminDelivery.text,
          html: adminDelivery.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      if (premiumReply.enabled && persistence) {
        try {
          await persistence.contactCases.markDeliveryFailed(
            requestId,
            error?.code || "MAIL_PROVIDER_NETWORK_ERROR"
          );
        } catch (persistenceError) {
          console.error("[contact] persistence update failed", {
            requestId,
            code: persistenceError?.code || "PERSISTENCE_ERROR",
          });
        }
      }
      recordProviderFailure();
      throw error;
    }

    const raw = await response.text().catch(() => "");

    if (!response.ok) {
      if (
        reservedIdempotency &&
        isExplicitProviderFailureSafeToRetry(response.status)
      ) {
        try {
          await releaseContactIdempotency(reservedIdempotency);
          reservedIdempotency = null;
        } catch (persistenceError) {
          console.error("[contact] idempotency release failed", {
            requestId,
            code: persistenceError?.code || "PERSISTENCE_ERROR",
          });
        }
      }

      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        recordProviderFailure();
      }
      let providerError = {};
      try {
        providerError = raw ? JSON.parse(raw) : {};
      } catch {}

      if (premiumReply.enabled && persistence) {
        try {
          await persistence.contactCases.markDeliveryFailed(
            requestId,
            "MAIL_DELIVERY_FAILED"
          );
        } catch (persistenceError) {
          console.error("[contact] persistence update failed", {
            requestId,
            code: persistenceError?.code || "PERSISTENCE_ERROR",
          });
        }
      }

      console.error("[contact] provider rejected", {
        requestId,
        status: response.status,
        name:
          typeof providerError?.name === "string"
            ? providerError.name.slice(0, 80)
            : null,
        providerCode:
          typeof providerError?.name === "string"
            ? providerError.name.slice(0, 80)
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

    if (premiumReply.enabled && persistence) {
      try {
        const marked = await persistence.contactCases.markDelivered(
          requestId,
          result.id || null
        );
        if (!marked) {
          console.error("[contact] durable delivery status missing", {
            requestId,
            code: "CONTACT_CASE_NOT_FOUND",
          });
        }
      } catch (persistenceError) {
        console.error("[contact] durable delivery status update failed", {
          requestId,
          code: persistenceError?.code || "PERSISTENCE_ERROR",
        });
      }
    }

    rememberDuplicate(payload);
    recordProviderSuccess();

    let newsletterState = "not_requested";
    if (payload.newsletter) {
      try {
        await newsletter.requestOptIn({
          email: payload.email,
          name: payload.name,
          source: "contact_form",
        });
        newsletterState = "confirmation_sent";
      } catch (newsletterError) {
        newsletterState = "temporarily_unavailable";
        console.error("[newsletter] opt-in request failed", {
          requestId,
          code: newsletterError?.code || "NEWSLETTER_ERROR",
          emailHash: hashValue(payload.email).slice(0, 12),
        });
      }
    }

    const successBody = {
      ok: true,
      id: requestId,
      newsletter: newsletterState,
    };
    if (reservedIdempotency) {
      try {
        const completed = await completeContactIdempotency(
          reservedIdempotency,
          200,
          successBody
        );
        if (completed) {
          reservedIdempotency = null;
        } else {
          console.error("[contact] durable idempotency completion missing", {
            requestId,
            code: "IDEMPOTENCY_COMPLETION_MISSING",
          });
        }
      } catch (persistenceError) {
        console.error("[contact] durable idempotency completion failed", {
          requestId,
          code: persistenceError?.code || "PERSISTENCE_ERROR",
        });
      }
    }

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
    if (reservedIdempotency && !providerAttempted) {
      try {
        await releaseContactIdempotency(reservedIdempotency);
        reservedIdempotency = null;
      } catch (persistenceError) {
        console.error("[contact] durable idempotency release failed", {
          requestId,
          code: persistenceError?.code || "PERSISTENCE_ERROR",
        });
      }
    }

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
    configured: Boolean(
      RESEND_API_KEY && CONTACT_TO_ADDRESS && EMAIL_FROM_ADDRESS
    ),
    premiumReplyConfigured: premiumReply.enabled,
    newsletterConfigured: newsletter.enabled,
  });
});

function readRiskThreshold(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(name + " must be a finite number between 0 and 100");
  }
  return value;
}

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
  // Render documents X-Forwarded-For as the client-IP source and places the
  // real client IP first. Do not trust CF-Connecting-IP directly here.
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (let index = 0; index < forwarded.length; index += 1) {
    const candidate = forwarded[index].replace(/^\[|\]$/g, "");
    if (isIP(candidate)) return candidate;
  }

  const remote = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return isIP(remote) ? remote : "unknown";
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
    const cap = store === ipBuckets ? MAX_IP_BUCKETS : MAX_EMAIL_BUCKETS;
    boundedSet(store, key, { startedAt: now, count: 1 }, cap);
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
  const contentType = String(req.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
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
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    bad("Nieprawidłowe dane formularza.", "INVALID_PAYLOAD");
  }

  const payload = {
    name: requiredString(input.name, "name", 80),
    email: normalizeEmail(requiredString(input.email, "email", 254)),
    category: requiredString(input.category, "category", 60),
    subject: requiredString(input.subject, "subject", 120),
    message: requiredMultiline(input.message, "message", 4000),
    website: optionalString(input.website, "website", 120),
    page: normalizePage(optionalString(input.page, "page", 500)),
    acknowledgement: input.acknowledgement === true,
    startedAt: parseStartedAt(input.startedAt),
    turnstileToken: optionalString(input.turnstileToken, "turnstileToken", 2048),
    newsletter: input.newsletter === true,
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
  if (email.includes("\r") || email.includes("\n")) return false;

  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

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
  cleanupMxCache();
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();

  if (process.env.NODE_ENV === "test" && domain.endsWith(".test")) {
    return;
  }

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

  if (cached && now - cached.checkedAt < cached.ttlMs) {
    if (!cached.valid) {
      bad(
        "Domena tego adresu e-mail nie obsługuje poczty. Sprawdź adres.",
        "EMAIL_DOMAIN_NO_MX"
      );
    }
    return;
  }

  let mx;
  try {
    mx = await resolveMxBounded(domain);
  } catch (error) {
    const code = String(error?.code || error?.message || "");

    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      boundedSet(
        mxCache,
        domain,
        { valid: false, checkedAt: now, ttlMs: 30 * 60 * 1000 },
        MAX_MX_CACHE
      );
      bad(
        "Domena tego adresu e-mail nie obsługuje poczty. Sprawdź adres.",
        "EMAIL_DOMAIN_NO_MX"
      );
    }

    const transient = new Error(
      "Nie udało się teraz zweryfikować domeny e-mail. Spróbuj ponownie za chwilę."
    );
    transient.code =
      code === "MX_TIMEOUT" ? "EMAIL_DOMAIN_CHECK_TIMEOUT" : "EMAIL_DOMAIN_CHECK_TEMPORARY";
    transient.status = 503;
    throw transient;
  }

  const valid = Array.isArray(mx) && mx.some((entry) => entry?.exchange);
  boundedSet(
    mxCache,
    domain,
    { valid, checkedAt: now, ttlMs: valid ? MX_CACHE_MS : 30 * 60 * 1000 },
    MAX_MX_CACHE
  );

  if (!valid) {
    bad(
      "Domena tego adresu e-mail nie obsługuje poczty. Sprawdź adres.",
      "EMAIL_DOMAIN_NO_MX"
    );
  }
}

async function resolveMxBounded(domain) {
  const existing = mxInFlight.get(domain);
  if (existing) return withTimeout(existing, 2500, "MX_TIMEOUT");

  if (mxInFlight.size >= MAX_MX_IN_FLIGHT) {
    const error = new Error(
      "Weryfikacja domen e-mail jest chwilowo przeciążona. Spróbuj ponownie za chwilę."
    );
    error.code = "EMAIL_DOMAIN_CHECK_BUSY";
    error.status = 503;
    throw error;
  }

  const lookup = resolveMx(domain).finally(() => mxInFlight.delete(domain));
  mxInFlight.set(domain, lookup);
  return withTimeout(lookup, 2500, "MX_TIMEOUT");
}

function cleanupMxCache() {
  const now = Date.now();
  for (const [key, entry] of mxCache) {
    if (now - entry.checkedAt >= entry.ttlMs) mxCache.delete(key);
  }
}

function withTimeout(promise, ms, marker) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(marker);
      error.code = marker;
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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
  const urlMatches = combined.match(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi) || [];

  if (urlMatches.length > 3) {
    const error = new Error(
      "Wiadomość zawiera zbyt wiele linków. Usuń część odnośników i spróbuj ponownie."
    );
    error.code = "SPAM_LINK_LIMIT";
    error.status = 400;
    throw error;
  }

  if (/([^\s.\-_=])\1{19,}/u.test(combined)) {
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

function submissionFingerprint(payload) {
  return hashValue([
    payload.name,
    payload.email,
    payload.category,
    payload.subject,
    payload.message,
    payload.page,
    String(payload.acknowledgement),
  ].join("\n"));
}

function contactIdempotencyKeyHash(key) {
  return hashValue("contact\n" + String(key || ""));
}

function requireContactIdempotencyStore() {
  if (contactIdempotencyStore) return contactIdempotencyStore;

  const error = new Error(
    "Trwała idempotencja formularza kontaktowego nie jest skonfigurowana."
  );
  error.code = "CONTACT_IDEMPOTENCY_NOT_CONFIGURED";
  error.status = 503;
  throw error;
}

async function getContactIdempotentReplay(key, fingerprint) {
  const store = requireContactIdempotencyStore();
  const record = await store.get({
    scope: "contact",
    keyHash: contactIdempotencyKeyHash(key),
  });

  return interpretContactIdempotencyRecord(record, fingerprint);
}

async function reserveContactIdempotency(key, fingerprint) {
  const store = requireContactIdempotencyStore();
  const keyHash = contactIdempotencyKeyHash(key);
  const result = await store.reserve({
    scope: "contact",
    keyHash,
    fingerprint,
    expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
  });

  if (result?.reserved) {
    return {
      reservation: {
        scope: "contact",
        keyHash,
        fingerprint,
      },
      replay: null,
    };
  }

  const replay = interpretContactIdempotencyRecord(
    result?.record || null,
    fingerprint
  );

  if (replay) {
    return { reservation: null, replay };
  }

  const error = new Error(
    "Nie udało się bezpiecznie zarezerwować wysyłki wiadomości."
  );
  error.code = "IDEMPOTENCY_RESERVATION_FAILED";
  error.status = 503;
  throw error;
}

function interpretContactIdempotencyRecord(record, fingerprint) {
  if (!record) return null;

  if (record.fingerprint !== fingerprint) {
    const error = new Error(
      "Ten identyfikator wysyłki został już użyty dla innej wiadomości."
    );
    error.code = "IDEMPOTENCY_CONFLICT";
    error.status = 409;
    throw error;
  }

  if (record.state === "done") {
    const status = Number(record.response_status);
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      const error = new Error(
        "Trwały rekord idempotencji ma nieprawidłowy stan odpowiedzi."
      );
      error.code = "IDEMPOTENCY_STATE_INVALID";
      error.status = 503;
      throw error;
    }

    return {
      status,
      body: record.response_body ?? { ok: true },
    };
  }

  if (record.state === "inflight") {
    const error = new Error(
      "Ta wiadomość jest już przetwarzana. Poczekaj chwilę."
    );
    error.code = "REQUEST_IN_PROGRESS";
    error.status = 409;
    throw error;
  }

  const error = new Error(
    "Trwały rekord idempotencji ma nieobsługiwany stan."
  );
  error.code = "IDEMPOTENCY_STATE_INVALID";
  error.status = 503;
  throw error;
}

async function completeContactIdempotency(reservation, status, body) {
  if (!reservation) return false;
  const store = requireContactIdempotencyStore();
  return store.complete({
    scope: reservation.scope,
    keyHash: reservation.keyHash,
    fingerprint: reservation.fingerprint,
    status,
    body,
  });
}

async function releaseContactIdempotency(reservation) {
  if (!reservation) return false;
  const store = requireContactIdempotencyStore();
  return store.release({
    scope: reservation.scope,
    keyHash: reservation.keyHash,
    fingerprint: reservation.fingerprint,
  });
}

function isExplicitProviderFailureSafeToRetry(status) {
  return (
    Number.isInteger(status) &&
    status >= 400 &&
    status < 500 &&
    status !== 408
  );
}

function registerAbuseStrike(ip, reason) {
  const now = Date.now();
  const key = hashValue(ip);
  const current = abuseStrikes.get(key);

  if (!current || now - current.startedAt >= ABUSE_STRIKE_WINDOW_MS) {
    boundedSet(
      abuseStrikes,
      key,
      { startedAt: now, count: 1, blockedUntil: 0 },
      MAX_ABUSE_STRIKES
    );
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
  cleanupAbuseStrikes();
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

function cleanupAbuseStrikes() {
  const now = Date.now();
  for (const [key, value] of abuseStrikes) {
    const expiresAt = Math.max(
      value.startedAt + ABUSE_STRIKE_WINDOW_MS,
      value.blockedUntil || 0
    );
    if (expiresAt <= now) abuseStrikes.delete(key);
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
  const now = Date.now();
  providerCircuit.failures = providerCircuit.failures.filter(
    (time) => now - time < PROVIDER_FAILURE_WINDOW_MS
  );
  if (providerCircuit.openUntil <= now) {
    providerCircuit.failures = [];
    providerCircuit.openUntil = 0;
  }
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
  boundedSet(
    duplicateSubmissions,
    duplicateKey(payload),
    Date.now(),
    MAX_DUPLICATES
  );
}

function cleanupDuplicates() {
  const now = Date.now();
  for (const [key, createdAt] of duplicateSubmissions) {
    if (now - createdAt >= DUPLICATE_WINDOW_MS) {
      duplicateSubmissions.delete(key);
    }
  }
}

function boundedSet(map, key, value, maxEntries) {
  if (!map.has(key) && map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  map.set(key, value);
}

function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function requiredString(value, field, max) {
  if (typeof value !== "string") {
    bad("Nieprawidłowy typ pola " + field + ".", "INVALID_FIELD_TYPE");
  }
  if (value.length > max) {
    bad("Pole " + field + " jest zbyt długie.", "FIELD_TOO_LONG");
  }
  return stripSingleLineControls(value).trim();
}

function optionalString(value, field, max) {
  if (value == null || value === "") return "";
  return requiredString(value, field, max);
}

function requiredMultiline(value, field, max) {
  if (typeof value !== "string") {
    bad("Nieprawidłowy typ pola " + field + ".", "INVALID_FIELD_TYPE");
  }
  if (value.length > max) {
    bad("Pole " + field + " jest zbyt długie.", "FIELD_TOO_LONG");
  }
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function stripSingleLineControls(value) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

function extractMailbox(value) {
  const raw = String(value || "").trim();
  const angle = raw.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>$/);
  const candidate = angle ? angle[1] : raw;
  const at = candidate.lastIndexOf("@");
  if (at <= 0 || at !== candidate.indexOf("@")) return "";

  const local = candidate.slice(0, at);
  const asciiDomain = domainToASCII(candidate.slice(at + 1));
  if (!asciiDomain) return "";

  const normalized = local + "@" + asciiDomain.toLowerCase();
  return isValidEmailSyntax(normalized) ? normalized : "";
}

function protectedMailboxKey(email) {
  const at = email.lastIndexOf("@");
  if (at <= 0) return email.toLowerCase();
  const local = email.slice(0, at).toLowerCase().split("+", 1)[0];
  const domain = email.slice(at + 1).toLowerCase();
  return local + "@" + domain;
}

function sameProtectedMailbox(candidate, protectedAddress) {
  return protectedMailboxKey(candidate) === protectedMailboxKey(protectedAddress);
}

function normalizeEmail(value) {
  if (value.includes("\r") || value.includes("\n")) {
    bad("Podaj prawidłowy adres e-mail.", "INVALID_EMAIL");
  }
  const at = value.lastIndexOf("@");
  if (at <= 0) return value.trim();

  const local = value.slice(0, at);
  const rawDomain = value.slice(at + 1);
  const asciiDomain = domainToASCII(rawDomain);
  if (!asciiDomain) return value.trim();

  return local + "@" + asciiDomain.toLowerCase();
}

function normalizePage(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!ALLOWED_ORIGINS.has(url.origin)) return "";
    return url.origin + url.pathname;
  } catch {
    return "";
  }
}

function parseStartedAt(value) {
  if (value == null || value === "") return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    bad("Odśwież formularz i spróbuj ponownie.", "FORM_TIMING_INVALID");
  }
  return value;
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
