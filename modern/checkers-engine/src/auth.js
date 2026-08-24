import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 2;
const TOKEN_ISSUER = "gracz.pl";
const TOKEN_AUDIENCE = "gracz.pl-web";
const MAX_TOKEN_LENGTH = 4096;
// Stare tokeny v1 nie miały jti/iss/aud i nie mogły być skutecznie unieważniane
// w magazynie sesji. Pozostawiamy krótki, zamknięty okres migracji do ciasteczek v2.
const LEGACY_V1_ACCEPT_UNTIL = 1788220800; // 2026-09-01T00:00:00Z

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

  issueGuest({ userId, displayName, ttlSeconds = 1800 }) {
    requireText(userId, "userId");
    requireText(displayName, "displayName");
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3600) {
      throw new TypeError("Sesja gościa musi trwać od 60 s do 1 h.");
    }
    const issuedAt = Math.floor(this.clock() / 1000);
    // Token gościa celowo nie ma jti ani wersji v2. Dzięki temu nie jest zapisywany
    // jako normalna sesja konta w PostgreSQL i nie wymaga rekordu gracz_accounts.
    const payload = {
      sub: userId,
      name: displayName,
      guest: true,
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
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

    if (payload.v !== undefined) {
      if (payload.v !== TOKEN_VERSION || payload.iss !== TOKEN_ISSUER || payload.aud !== TOKEN_AUDIENCE) {
        throw new AuthError("Token logowania pochodzi z niewłaściwego źródła.");
      }
      if (!payload.jti || !Number.isInteger(payload.iat) || payload.iat > now + 60 || payload.exp - payload.iat > 86_400) {
        throw new AuthError("Token logowania ma nieprawidłowe parametry.");
      }
    } else {
      // V1 jest tolerowany wyłącznie przez krótki okres migracyjny i tylko gdy
      // jego pozostały czas życia mieści się w aktualnym maksimum 24 h.
      if (now >= LEGACY_V1_ACCEPT_UNTIL || payload.exp - now > 86_400) {
        throw new AuthError("Starsza sesja logowania wygasła. Zaloguj się ponownie.", "SESSION_EXPIRED");
      }
    }

    return Object.freeze({
      userId: payload.sub,
      displayName: payload.name,
      expiresAt: payload.exp,
      tokenId: payload.jti ?? null,
      tokenVersion: payload.v ?? 1,
      guest: payload.guest === true,
    });
  }

  #sign(value) { return createHmac("sha256", this.secret).update(value).digest("base64url"); }
}

function requireText(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new TypeError(`Pole ${field} jest nieprawidłowe.`);
}
