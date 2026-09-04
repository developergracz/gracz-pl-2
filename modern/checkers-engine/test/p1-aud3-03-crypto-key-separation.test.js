import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";
import { MfaService } from "../src/mfa-service.js";

const AUTH = "auth-secret-material-for-crypto-tests-0001";
const MFA = "mfa-dedicated-key-material-crypto-tests-01";
const WRONG = "wrong-dedicated-key-material-crypto-test-01";
const MESSAGE_KEY = ["message","dedicated","key","material","test","0001"].join("-");
const ATTACHMENT_KEY = ["attachment","dedicated","key","material","test","01"].join("-");

test("production fail-closed contract blokuje brak, reuse i equality", () => {
  const base = {
    NODE_ENV: "production",
    AUTH_SECRET: AUTH,
    MESSAGE_ENCRYPTION_KEY: MESSAGE_KEY,
    ATTACHMENT_ENCRYPTION_KEY: ATTACHMENT_KEY,
    MFA_ENCRYPTION_KEY: MFA,
  };
  assert.doesNotThrow(() => loadConfig(base));
  assert.throws(() => loadConfig({ ...base, MESSAGE_ENCRYPTION_KEY: "" }), /MESSAGE_ENCRYPTION_KEY/);
  assert.throws(() => loadConfig({ ...base, MFA_ENCRYPTION_KEY: AUTH }), /AUTH_SECRET/);
  assert.throws(() => loadConfig({ ...base, MFA_ENCRYPTION_KEY: base.ATTACHMENT_ENCRYPTION_KEY }), /muszą być różne/);
});

test("MFA single-write używa dedicated key i odrzuca wrong/auth-only key", async () => {
  const current = new MfaService(null, { encryptionSecret: MFA, legacyEncryptionSecret: AUTH });
  const legacyOnly = new MfaService(null, { encryptionSecret: AUTH, legacyEncryptionSecret: null });
  const wrongOnly = new MfaService(null, { encryptionSecret: WRONG, legacyEncryptionSecret: null });
  const id = "aud303mfa";
  const created = await current.begin(id);
  const record = await current.getRecord(id);
  assert.equal(current.decrypt(record, id), created.secret);
  assert.throws(() => legacyOnly.decrypt(record, id), /MFA_DECRYPT_FAILED|odszyfrować/);
  assert.throws(() => wrongOnly.decrypt(record, id), /MFA_DECRYPT_FAILED|odszyfrować/);
  await current.close(); await legacyOnly.close(); await wrongOnly.close();
});

test("MFA dual-read czyta legacy AUTH_SECRET dopiero po authenticated failure i emituje bezpieczny sygnał", async () => {
  const events = [];
  const audit = { record(event) { events.push(event); return Promise.resolve(event); } };
  const legacyWriter = new MfaService(null, { encryptionSecret: AUTH, legacyEncryptionSecret: null });
  const id = "aud303legacy";
  const legacy = await legacyWriter.begin(id);
  const record = await legacyWriter.getRecord(id);
  const current = new MfaService(null, { encryptionSecret: MFA, legacyEncryptionSecret: AUTH, audit });
  assert.equal(current.decrypt(record, id), legacy.secret);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { eventType: "crypto.legacy_decrypt", outcome: "success", metadata: { domain: "mfa" } });
  const serialized = JSON.stringify(events[0]);
  assert.equal(serialized.includes(legacy.secret), false);
  assert.equal(serialized.includes(AUTH), false);
  assert.equal(serialized.includes(record.ciphertext.toString("base64")), false);
  await legacyWriter.close(); await current.close();
});

test("MFA setup/non-auth error nie uruchamia legacy fallback i dedicated success emituje zero legacy events", async () => {
  const events = [];
  const audit = { record(event) { events.push(event); return Promise.resolve(event); } };
  const writer = new MfaService(null, { encryptionSecret: MFA, legacyEncryptionSecret: null });
  const id = "aud303setup";
  const created = await writer.begin(id);
  const record = await writer.getRecord(id);
  const reader = new MfaService(null, { encryptionSecret: MFA, legacyEncryptionSecret: AUTH, audit });
  assert.equal(reader.decrypt(record, id), created.secret);
  assert.equal(events.length, 0, "dedicated decrypt must emit zero legacy events");

  const realLegacyKey = reader.legacyKey;
  let legacyKeyReads = 0;
  Object.defineProperty(reader, "legacyKey", {
    configurable: true,
    get() { legacyKeyReads += 1; return realLegacyKey; },
  });
  const malformed = { ...record, tag: Buffer.alloc(1) };
  let error;
  try { reader.decrypt(malformed, id); } catch (caught) { error = caught; }
  assert.equal(error instanceof TypeError, true);
  assert.equal(error?.code, "ERR_CRYPTO_INVALID_AUTH_TAG");
  assert.equal(legacyKeyReads, 0, "setup error must not access legacy key");
  assert.equal(events.length, 0, "setup error must emit zero legacy events");
  const serialized = String(error?.message ?? "");
  assert.equal(serialized.includes(created.secret), false);
  assert.equal(serialized.includes(AUTH), false);
  assert.equal(serialized.includes(record.ciphertext.toString("base64")), false);
  await writer.close(); await reader.close();
});

test("MFA both keys fail safely bez ujawnienia materiału kryptograficznego", async () => {
  const writer = new MfaService(null, { encryptionSecret: MFA, legacyEncryptionSecret: null });
  const id = "aud303wrong";
  const created = await writer.begin(id);
  const record = await writer.getRecord(id);
  const reader = new MfaService(null, { encryptionSecret: WRONG, legacyEncryptionSecret: AUTH });
  let error;
  try { reader.decrypt(record, id); } catch (caught) { error = caught; }
  assert.equal(error?.code, "MFA_DECRYPT_FAILED");
  assert.equal(String(error?.message).includes(created.secret), false);
  assert.equal(String(error?.message).includes(AUTH), false);
  await writer.close(); await reader.close();
});
