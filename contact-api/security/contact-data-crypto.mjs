import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const VERSION = "c1";
const MIN_SECRET_LENGTH = 32;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SALT = Buffer.from("gracz.pl/contact-data/v1", "utf8");
const INFO = Buffer.from("aes-256-gcm-at-rest", "utf8");

export function createContactDataCrypto({ secret } = {}) {
  const normalizedSecret = String(secret || "").trim();

  if (normalizedSecret && normalizedSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "CONTACT_DATA_ENCRYPTION_SECRET must contain at least 32 characters"
    );
  }

  const key = normalizedSecret
    ? Buffer.from(
        hkdfSync(
          "sha256",
          Buffer.from(normalizedSecret, "utf8"),
          SALT,
          INFO,
          KEY_BYTES
        )
      )
    : null;

  function encrypt(value, { aad } = {}) {
    requireEnabled();
    const plaintext = Buffer.from(String(value ?? ""), "utf8");
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv, {
      authTagLength: TAG_BYTES,
    });
    if (aad) cipher.setAAD(Buffer.from(String(aad), "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  function decrypt(envelope, { aad } = {}) {
    requireEnabled();
    const parts = String(envelope || "").split(".");
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw invalidEnvelope();
    }

    try {
      const iv = decodeCanonicalBase64Url(parts[1]);
      const tag = decodeCanonicalBase64Url(parts[2]);
      const ciphertext = decodeCanonicalBase64Url(parts[3]);
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw invalidEnvelope();
      }

      const decipher = createDecipheriv("aes-256-gcm", key, iv, {
        authTagLength: TAG_BYTES,
      });
      if (aad) decipher.setAAD(Buffer.from(String(aad), "utf8"));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      if (error?.code === "CONTACT_DATA_DECRYPT_FAILED") throw error;
      throw invalidEnvelope();
    }
  }

  function requireEnabled() {
    if (!key) {
      const error = new Error("Contact data encryption is not configured.");
      error.code = "CONTACT_DATA_ENCRYPTION_NOT_CONFIGURED";
      throw error;
    }
  }

  return Object.freeze({
    enabled: Boolean(key),
    version: VERSION,
    encrypt,
    decrypt,
  });
}

function decodeCanonicalBase64Url(value) {
  const input = String(value || "");
  if (!/^[A-Za-z0-9_-]*$/.test(input)) throw invalidEnvelope();
  const decoded = Buffer.from(input, "base64url");
  if (decoded.toString("base64url") !== input) throw invalidEnvelope();
  return decoded;
}

function invalidEnvelope() {
  const error = new Error("Encrypted contact data is invalid or was tampered with.");
  error.code = "CONTACT_DATA_DECRYPT_FAILED";
  return error;
}
