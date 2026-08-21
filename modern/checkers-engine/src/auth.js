import { createHmac, timingSafeEqual } from "node:crypto";

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
    this.secret = secret;
    this.ttlSeconds = ttlSeconds;
    this.clock = clock;
  }

  issue({ userId, displayName }) {
    requireText(userId, "userId");
    requireText(displayName, "displayName");
    const payload = {
      sub: userId,
      name: displayName,
      exp: Math.floor(this.clock() / 1000) + this.ttlSeconds,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${this.#sign(encoded)}`;
  }

  verify(token) {
    if (typeof token !== "string") throw new AuthError("Brak tokenu logowania.");
    const [encoded, signature, extra] = token.split(".");
    if (!encoded || !signature || extra) throw new AuthError("Nieprawidłowy token logowania.");
    const expected = this.#sign(encoded);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new AuthError("Nieprawidłowy podpis tokenu.");
    let payload;
    try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
    catch { throw new AuthError("Uszkodzony token logowania."); }
    if (!payload.sub || !payload.name || payload.exp <= Math.floor(this.clock() / 1000)) {
      throw new AuthError("Token logowania wygasł.", "SESSION_EXPIRED");
    }
    return Object.freeze({ userId: payload.sub, displayName: payload.name, expiresAt: payload.exp });
  }

  #sign(value) { return createHmac("sha256", this.secret).update(value).digest("base64url"); }
}

function requireText(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new TypeError(`Pole ${field} jest nieprawidłowe.`);
}
