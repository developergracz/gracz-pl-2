import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export class AccountError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "AccountError";
    this.code = code;
  }
}

export class MemoryAccountService {
  #accounts = new Map();

  async register({ userId, displayName, password }) {
    const normalizedId = normalizeUserId(userId);
    validateDisplayName(displayName);
    validatePassword(password);
    if (this.#accounts.has(normalizedId)) throw new AccountError("Takie konto już istnieje.", "ACCOUNT_EXISTS");
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(password, salt);
    const account = { userId: normalizedId, displayName, salt, passwordHash };
    this.#accounts.set(normalizedId, account);
    return publicAccount(account);
  }

  async authenticate({ userId, password }) {
    const normalizedId = normalizeUserId(userId);
    const account = this.#accounts.get(normalizedId);
    const salt = account?.salt ?? Buffer.alloc(16);
    const expected = account?.passwordHash ?? Buffer.alloc(64);
    const actual = await hashPassword(typeof password === "string" ? password : "", salt);
    if (!account || !timingSafeEqual(actual, expected)) {
      throw new AccountError("Nieprawidłowy login lub hasło.", "INVALID_CREDENTIALS");
    }
    return publicAccount(account);
  }
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function normalizeUserId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,32}$/.test(value)) {
    throw new AccountError("Login musi mieć 3–32 znaki: litery, cyfry, _ lub -.", "INVALID_ACCOUNT");
  }
  return value.toLowerCase();
}

function validateDisplayName(value) {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 40) {
    throw new AccountError("Nazwa gracza musi mieć 2–40 znaków.", "INVALID_ACCOUNT");
  }
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw new AccountError("Hasło musi mieć co najmniej 10 znaków.", "WEAK_PASSWORD");
  }
}

function publicAccount({ userId, displayName }) { return Object.freeze({ userId, displayName }); }
