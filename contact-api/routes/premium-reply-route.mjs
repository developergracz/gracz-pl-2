export function createPremiumReplyRoute({
  allowedOrigins,
  premiumReply,
  replyIpBuckets,
  rateLimit,
  hashValue,
  clientIp,
  readJson,
  json,
  setCors,
  resendApiKey,
  resendEndpoint,
  emailFrom,
  emailFromAddress,
  contactToAddress,
  ensureProviderCircuitClosed,
  recordProviderFailure,
  recordProviderSuccess,
  logger = console,
  fetchImpl = globalThis.fetch,
}) {
  if (!(allowedOrigins instanceof Set)) {
    throw new TypeError("allowedOrigins must be a Set");
  }
  if (!premiumReply || typeof premiumReply.prepareReply !== "function") {
    throw new TypeError("premiumReply manager is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch implementation is required");
  }

  return async function handlePremiumReplyRequest(req, res, url, requestId) {
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

    const ip = clientIp(req) || "unknown";
    rateLimit(
      replyIpBuckets,
      hashValue(ip),
      15 * 60 * 1000,
      20,
      "Za dużo prób użycia panelu odpowiedzi. Spróbuj ponownie później."
    );

    const body = await readJson(req, 16_384);
    const token = typeof body.token === "string" ? body.token : "";

    if (url.pathname === "/reply-context") {
      const context = premiumReply.getPublicContext(token);
      return json(res, 200, { ok: true, context });
    }

    if (!resendApiKey || !emailFromAddress || !contactToAddress) {
      return json(res, 503, {
        error: {
          code: "MAIL_NOT_CONFIGURED",
          message: "Kanał wysyłki wiadomości nie jest skonfigurowany.",
        },
      });
    }

    ensureProviderCircuitClosed();

    const delivery = await premiumReply.prepareReply(token, body.message);
    let response;

    try {
      response = await fetchImpl(resendEndpoint, {
        method: "POST",
        headers: {
          authorization: "Bearer " + resendApiKey,
          "content-type": "application/json",
          "Idempotency-Key": delivery.providerIdempotencyKey,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [delivery.to],
          reply_to: delivery.replyTo,
          subject: delivery.subject,
          text: delivery.text,
          html: delivery.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      try {
        await premiumReply.releaseReply(
          delivery.tokenKey,
          delivery.messageHash,
          error?.code || "MAIL_PROVIDER_NETWORK_ERROR"
        );
      } catch (persistenceError) {
        logger.error("[contact-reply] release failed", {
          requestId,
          contactRequestId: delivery.requestId,
          code: persistenceError?.code || "PERSISTENCE_ERROR",
        });
      }
      recordProviderFailure();
      throw error;
    }

    const raw = await response.text().catch(() => "");

    if (!response.ok) {
      try {
        await premiumReply.releaseReply(
          delivery.tokenKey,
          delivery.messageHash,
          "MAIL_PROVIDER_" + response.status
        );
      } catch (persistenceError) {
        logger.error("[contact-reply] release failed", {
          requestId,
          contactRequestId: delivery.requestId,
          code: persistenceError?.code || "PERSISTENCE_ERROR",
        });
      }

      if (
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500
      ) {
        recordProviderFailure();
      }

      logger.error("[contact-reply] provider rejected", {
        requestId,
        status: response.status,
        contactRequestId: delivery.requestId,
      });

      return json(res, 502, {
        error: {
          code: "MAIL_DELIVERY_FAILED",
          message: "Nie udało się wysłać odpowiedzi. Spróbuj ponownie później.",
        },
      });
    }

    let result = {};
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {}

    await premiumReply.markReplySent(
      delivery.tokenKey,
      delivery.messageHash,
      result.id || null
    );
    recordProviderSuccess();

    logger.log("[contact-reply] sent", {
      requestId,
      contactRequestId: delivery.requestId,
      providerId: result.id || null,
      recipientHash: hashValue(delivery.to).slice(0, 12),
    });

    return json(res, 200, {
      ok: true,
      id: delivery.requestId,
    });
  };
}
