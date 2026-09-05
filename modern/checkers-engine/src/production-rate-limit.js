const HEALTH_PATHS = new Set(["/health", "/health/live", "/health/ready"]);

export function createProductionRateLimitComposition({ localTrafficGuard, sharedTrafficGuard = null }) {
  if (!localTrafficGuard || typeof localTrafficGuard.assertAllowed !== "function") {
    throw new TypeError("Lokalny TrafficGuard jest wymagany.");
  }

  const routedTrafficGuard = {
    // Request-level enforcement is executed by enforceRequest() in the outer
    // production handler. This no-op prevents a second local request consume
    // when createGameHttpServer handles the remaining application routing.
    assertAllowed() {},
    assertAccountAllowed(input) { return localTrafficGuard.assertAccountAllowed(input); },
    assertCredentialAttempt(input) { return localTrafficGuard.assertCredentialAttempt(input); },
    assertRegistrationAttempt(input) { return localTrafficGuard.assertRegistrationAttempt(input); },
  };

  async function enforceRequest(request) {
    if (HEALTH_PATHS.has(requestPath(request))) return;
    localTrafficGuard.assertAllowed(request);
    if (sharedTrafficGuard) await sharedTrafficGuard.assertAllowed(request);
  }

  return { routedTrafficGuard, enforceRequest };
}

export function sendProductionRequestError(response, error) {
  if (response.headersSent || response.writableEnded) return false;
  if (error?.status === 429 && Number.isFinite(error?.retryAfterSeconds)) {
    response.setHeader("Retry-After", String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
  }
  const status = error?.status || 500;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify({
    error: {
      code: error?.code || "APP_INTERNAL_ERROR",
      message: status < 500 ? error.message : "Wewnętrzny błąd aplikacji.",
    },
  }));
  return true;
}

function requestPath(request) {
  try { return new URL(request?.url || "/", "http://localhost").pathname; }
  catch { return "/"; }
}
