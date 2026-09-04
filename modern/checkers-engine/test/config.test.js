import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

const AUTH = "auth-secret-material-for-unit-tests-0001";
const MESSAGE = "message-key-material-for-unit-tests-0001";
const ATTACHMENT = "attachment-key-material-for-unit-tests-01";
const MFA = "mfa-key-material-for-unit-tests-0000001";

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: "production",
    AUTH_SECRET: AUTH,
    MESSAGE_ENCRYPTION_KEY: MESSAGE,
    ATTACHMENT_ENCRYPTION_KEY: ATTACHMENT,
    MFA_ENCRYPTION_KEY: MFA,
    ...overrides,
  };
}

test("loadConfig tworzy bezpieczną konfigurację wdrożenia", () => {
  const config = loadConfig({ AUTH_SECRET: "x".repeat(32), PORT: "8080", HOST: "127.0.0.1", DATA_DIR: "state" });
  assert.equal(config.port, 8080);
  assert.equal(config.host, "127.0.0.1");
  assert.match(config.dataDirectory, /state$/);
  assert.equal(config.messageEncryptionKey, null);
  assert.equal(Object.isFrozen(config), true);
});

test("loadConfig odrzuca słaby sekret i nieprawidłowy port", () => {
  assert.throws(() => loadConfig({ AUTH_SECRET: "za-krótki" }), /AUTH_SECRET/);
  assert.throws(() => loadConfig({ AUTH_SECRET: "x".repeat(32), PORT: "70000" }), /PORT/);
});

test("production wymaga wszystkich dedicated encryption keys", () => {
  for (const key of ["MESSAGE_ENCRYPTION_KEY", "ATTACHMENT_ENCRYPTION_KEY", "MFA_ENCRYPTION_KEY"]) {
    const env = productionEnv();
    delete env[key];
    assert.throws(() => loadConfig(env), new RegExp(key));
    assert.throws(() => loadConfig({ ...productionEnv(), [key]: "" }), new RegExp(key));
  }
});

test("dedicated encryption key nie może być równy AUTH_SECRET", () => {
  for (const key of ["MESSAGE_ENCRYPTION_KEY", "ATTACHMENT_ENCRYPTION_KEY", "MFA_ENCRYPTION_KEY"]) {
    assert.throws(() => loadConfig({ ...productionEnv(), [key]: AUTH }), /AUTH_SECRET/);
  }
});

test("dedicated encryption keys muszą być pairwise distinct", () => {
  assert.throws(() => loadConfig({ ...productionEnv(), ATTACHMENT_ENCRYPTION_KEY: MESSAGE }), /muszą być różne/);
  assert.throws(() => loadConfig({ ...productionEnv(), MFA_ENCRYPTION_KEY: ATTACHMENT }), /muszą być różne/);
});

test("dedicated encryption keys muszą mieć minimum 32 bajty i minimalną jakość", () => {
  assert.throws(() => loadConfig({ ...productionEnv(), MESSAGE_ENCRYPTION_KEY: "short" }), /32 bajty/);
  assert.throws(() => loadConfig({ ...productionEnv(), MESSAGE_ENCRYPTION_KEY: "q".repeat(32) }), /jakości/);
});
