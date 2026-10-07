export function createNewsletterRoute({
  allowedOrigins,
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
  logger = console,
}) {
  if (!(allowedOrigins instanceof Set)) {
    throw new TypeError("allowedOrigins must be a Set");
  }
  if (!newsletter || typeof newsletter.requestOptIn !== "function") {
    throw new TypeError("newsletter manager is required");
  }

  return async function handleNewsletterRequest(req, res, url, requestId) {
    const origin = String(req.headers.origin || "");
    if (!allowedOrigins.has(origin)) {
      return json(res, 403, {
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "Niedozwolone źródło żądania.",
        },
      });
    }

    setCors(res, origin);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      });
      return res.end();
    }

    if (req.method !== "POST") {
      return json(res, 405, {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Niedozwolona metoda.",
        },
      });
    }

    if (!newsletter.enabled) {
      return json(res, 503, {
        error: {
          code: "NEWSLETTER_NOT_CONFIGURED",
          message: "Newsletter jest chwilowo niedostępny.",
        },
      });
    }

    const ip = clientIp(req) || "unknown";
    rateLimit(
      newsletterIpBuckets,
      hashValue(ip),
      15 * 60 * 1000,
      15,
      "Za dużo prób obsługi newslettera. Spróbuj ponownie później."
    );

    const body = await readJson(req, 8_192);

    if (url.pathname === "/newsletter/subscribe") {
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        bad("Nieprawidłowe dane formularza.", "INVALID_PAYLOAD");
      }

      const email = normalizeEmail(requiredString(body.email, "email", 254));
      const name = optionalString(body.name, "name", 80);
      const website = optionalString(body.website, "website", 120);
      const startedAt = parseStartedAt(body.startedAt);

      if (!isValidEmailSyntax(email)) {
        bad("Podaj prawidłowy adres e-mail.", "INVALID_EMAIL");
      }
      if (body.consent !== true) {
        bad("Zgoda na newsletter jest wymagana.", "NEWSLETTER_CONSENT_REQUIRED");
      }
      if (website) {
        return json(res, 200, { ok: true, state: "confirmation_sent" });
      }
      if (startedAt > 0) enforceFormTiming(startedAt);

      await validateEmailDomain(email);
      rateLimit(
        newsletterEmailBuckets,
        hashValue(email),
        60 * 60 * 1000,
        4,
        "Z tego adresu wysłano zbyt wiele próśb o zapis. Spróbuj ponownie później."
      );

      await newsletter.requestOptIn({
        email,
        name,
        source: "newsletter_page",
      });

      logger.log("[newsletter] confirmation requested", {
        requestId,
        emailHash: hashValue(email).slice(0, 12),
      });

      return json(res, 200, { ok: true, state: "confirmation_sent" });
    }

    const token = typeof body?.token === "string" ? body.token : "";

    if (url.pathname === "/newsletter/confirm") {
      const result = await newsletter.confirm(token);
      logger.log("[newsletter] confirmed", {
        requestId,
        recipient: result.recipient,
      });
      return json(res, 200, { ok: true, state: result.state });
    }

    if (url.pathname === "/newsletter/unsubscribe") {
      const result = await newsletter.unsubscribe(token);
      logger.log("[newsletter] unsubscribed", {
        requestId,
        recipient: result.recipient,
      });
      return json(res, 200, { ok: true, state: result.state });
    }

    return json(res, 404, {
      error: {
        code: "NOT_FOUND",
        message: "Nie znaleziono zasobu.",
      },
    });
  };
}
