import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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

export class FileAccountService {
  #writeQueue = Promise.resolve();

  constructor(filePath) {
    if (typeof filePath !== "string" || filePath.length === 0) throw new TypeError("Ścieżka bazy kont jest wymagana.");
    this.filePath = filePath;
  }

  async register({ userId, displayName, password }) {
    const normalizedId = normalizeUserId(userId);
    validateDisplayName(displayName);
    validatePassword(password);
    return this.#exclusive(async () => {
      const records = await this.#read();
      if (records[normalizedId]) throw new AccountError("Takie konto już istnieje.", "ACCOUNT_EXISTS");
      const salt = randomBytes(16);
      const passwordHash = await hashPassword(password, salt);
      records[normalizedId] = {
        userId: normalizedId, displayName,
        salt: salt.toString("base64"), passwordHash: passwordHash.toString("base64"),
      };
      await this.#write(records);
      return Object.freeze({ userId: normalizedId, displayName });
    });
  }

  async authenticate({ userId, password }) {
    const normalizedId = normalizeUserId(userId);
    const records = await this.#read();
    const record = records[normalizedId];
    const salt = record ? Buffer.from(record.salt, "base64") : Buffer.alloc(16);
    const expected = record ? Buffer.from(record.passwordHash, "base64") : Buffer.alloc(64);
    const actual = await hashPassword(typeof password === "string" ? password : "", salt);
    if (!record || expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
      throw new AccountError("Nieprawidłowy login lub hasło.", "INVALID_CREDENTIALS");
    }
    return Object.freeze({ userId: record.userId, displayName: record.displayName });
  }

  async #read() {
    try { return JSON.parse(await readFile(this.filePath, "utf8")); }
    catch (error) { if (error?.code === "ENOENT") return {}; throw error; }
  }

  async #write(records) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(records), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  #exclusive(operation) {
    const result = this.#writeQueue.then(operation, operation);
    this.#writeQueue = result.catch(() => {});
    return result;
  }
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function normalizeUserId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{3,32}$/.test(value)) {
    throw new AccountError("Login musi mieć 3–32 znaki: litery, cyfry, kropkę, _ lub -.", "INVALID_ACCOUNT");
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
