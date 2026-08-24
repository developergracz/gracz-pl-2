import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export class TokenService {
  constructor({ bytes = 32 } = {}) {
    if (!Number.isInteger(bytes) || bytes < 24 || bytes > 64) throw new TypeError("Token entropy must be 24-64 bytes.");
    this.bytes = bytes;
  }

  issue() {
    const token = randomBytes(this.bytes).toString("base64url");
    return Object.freeze({ token, tokenHash: this.hash(token) });
  }

  hash(token) {
    if (typeof token !== "string" || token.length < 16 || token.length > 512) throw new TypeError("Invalid token.");
    return createHash("sha256").update(token, "utf8").digest();
  }

  equals(token, storedHash) {
    try {
      const actual = this.hash(token);
      const expected = Buffer.isBuffer(storedHash) ? storedHash : Buffer.from(storedHash ?? []);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
