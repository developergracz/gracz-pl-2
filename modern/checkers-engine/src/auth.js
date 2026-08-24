import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 2;
const TOKEN_ISSUER = "gracz.pl";
const TOKEN_AUDIENCE = "gracz.pl-web";
const MAX_TOKEN_LENGTH = 4096;

export class AuthError extends Error {
  constructor(message, code = "UNAUTHENTICATED") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export class AuthService {
  constructor({ secret, ttlSeconds = 3600, clock = () => Date.now() }) {
    if (typeof secret !== "string" || secret.length < 32) throw new TypeError("Sekret logowania musi mieć co najmniej 32 znaki.");
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86_400) throw new TypeError("Czas życia tokenu musi wynosić od 60 s do 24 h.");
    this.secret = secret;
    this.ttlSeconds = ttlSeconds;
    this.clock = clock;
  }

  issue({ userId, displayName }) {
    requireText(userId, "userId");
    requireText(displayName, "displayName");
    const issuedAt = Math.floor(this.clock() / 1000);
    const payload = {
      v: TOKEN_VERSION,
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      jti: randomUUID(),
      sub: userId,
      name: displayName,
      iat: issuedAt,
      exp: issuedAt + this.ttlSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${this.#sign(encoded)}`;
  }

  verify(token) {
    if (typeof token !== "string" || token.length < 10 || token.length > MAX_TOKEN_LENGTH) {
      throw new AuthError("Nieprawidłowy token logowania.");
    }
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) throw new AuthError("Nieprawidłowy token logowania.");
    if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) {
      throw new AuthError("Nieprawidłowy token logowania.");
    }
    const expected = this.#sign(encoded);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new AuthError("Nieprawidłowy podpis tokenu.");

    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
    catch { throw new AuthError("Uszkodzony token logowania."); }

    const now = Math.floor(this.clock() / 1000);
    if (!payload?.sub || !payload?.name || !Number.isInteger(payload.exp) || payload.exp <= now) {
      throw new AuthError("Token logowania wygasł.", "SESSION_EXPIRED");
    }

    // Tokeny v1 pozostają akceptowane przez okres migracyjny, aby wdrożenie nie
    // wylogowało użytkowników w trakcie aktywnej sesji. Wszystkie nowe tokeny są v2.
    if (payload.v !== undefined) {
      if (payload.v !== TOKEN_VERSION || payload.iss !== TOKEN_ISSUER || payload.aud !== TOKEN_AUDIENCE) {
        throw new AuthError("Token logowania pochodzi z niewłaściwego źródła.");
      }
      if (!payload.jti || !Number.isInteger(payload.iat) || payload.iat > now + 60 || payload.exp - payload.iat > 86_400) {
        throw new AuthError("Token logowania ma nieprawidłowe parametry.");
      }
    }

    return Object.freeze({
      userId: payload.sub,
      displayName: payload.name,
      expiresAt: payload.exp,
      tokenId: payload.jti ?? null,
      tokenVersion: payload.v ?? 1,
    });
  }

  #sign(value) { return createHmac("sha256", this.secret).update(value).digest("base64url"); }
}

function requireText(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new TypeError(`Pole ${field} jest nieprawidłowe.`);
}
