import { AbuseRateLimiter, RateLimitError } from "./rate-limit.js";

const limiter = new AbuseRateLimiter();
const TURNSTILE_SECRET_KEY = String(process.env.TURNSTILE_SECRET_KEY || "").trim();

export function requestIp(request) {
  const cf = String(request.headers["cf-connecting-ip"] || "").trim();
  if (cf) return cf.slice(0, 80);
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) return forwarded.slice(0, 80);
  return String(request.socket?.remoteAddress || "unknown").slice(0, 80);
}

export function protectNewsletterRequest(request) {
  const url = new URL(request.url, "http://localhost");
  const ip = requestIp(request);

  if (url.pathname === "/newsletter/nick-availability") {
    limiter.consume(`newsletter:nick:${ip}`, { limit: 30, windowMs: 60_000, message: "Zbyt wiele prób sprawdzania nicku." });
  }

  if (url.pathname === "/newsletter/subscribe" && request.method === "POST") {
    assertSameOrigin(request);
    limiter.consume(`newsletter:subscribe:${ip}`, { limit: 5, windowMs: 15 * 60_000, message: "Zbyt wiele prób zapisu do newslettera." });
  }

  if (url.pathname === "/newsletter/status") {
    limiter.consume(`newsletter:status:${ip}`, { limit: 60, windowMs: 60_000, message: "Zbyt wiele odświeżeń statusu." });
  }

  if (url.pathname === "/newsletter/unsubscribe") {
    limiter.consume(`newsletter:unsubscribe:${ip}`, { limit: 20, windowMs: 60_000, message: "Zbyt wiele prób wypisania." });
  }
}

export async function verifyNewsletterHuman(input, request = null) {
  if (!TURNSTILE_SECRET_KEY) return { ok: true, skipped: true };
  const token = String(input?.turnstileToken || "").trim();
  if (!token) return { ok: false, reason: "missing_token" };

  const form = new URLSearchParams();
  form.set("secret", TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (request) form.set("remoteip", requestIp(request));

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, reason: "provider_error" };
    const result = await response.json();
    return { ok: result?.success === true, reason: result?.success === true ? null : "verification_failed" };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

export function isRateLimitError(error) {
  return error instanceof RateLimitError;
}

function assertSameOrigin(request) {
  const origin = String(request.headers.origin || "").trim();
  if (!origin) return;
  let hostname;
  try { hostname = new URL(origin).hostname.toLowerCase(); } catch { throw new Error("INVALID_ORIGIN"); }
  if (hostname !== "gracz.pl" && hostname !== "www.gracz.pl" && hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error("INVALID_ORIGIN");
  }
}
