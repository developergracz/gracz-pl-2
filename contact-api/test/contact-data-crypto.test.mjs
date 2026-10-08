import test from "node:test";
import assert from "node:assert/strict";
import { createContactDataCrypto } from "../security/contact-data-crypto.mjs";

test("contact data encryption uses authenticated AES-256-GCM envelopes", () => {
  const crypto = createContactDataCrypto({
    secret: "test-" + "k".repeat(64),
  });

  assert.equal(crypto.enabled, true);
  assert.equal(crypto.version, "c1");

  const aad = "contact-case:00000000-0000-0000-0000-000000000001:subject";
  const plaintext = "Poufny temat wiadomości";
  const envelope = crypto.encrypt(plaintext, { aad });

  assert.match(envelope, /^c1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(envelope.includes(plaintext), false);
  assert.equal(crypto.decrypt(envelope, { aad }), plaintext);

  assert.throws(
    () => crypto.decrypt(envelope, { aad: aad + ":tampered" }),
    (error) => error?.code === "CONTACT_DATA_DECRYPT_FAILED"
  );

  const last = envelope.slice(-1);
  const tampered = envelope.slice(0, -1) + (last === "A" ? "B" : "A");
  assert.throws(
    () => crypto.decrypt(tampered, { aad }),
    (error) => error?.code === "CONTACT_DATA_DECRYPT_FAILED"
  );
});

test("contact data encryption fails closed without a strong secret", () => {
  const disabled = createContactDataCrypto({ secret: "" });
  assert.equal(disabled.enabled, false);
  assert.throws(
    () => disabled.encrypt("secret"),
    (error) => error?.code === "CONTACT_DATA_ENCRYPTION_NOT_CONFIGURED"
  );

  assert.throws(
    () => createContactDataCrypto({ secret: "too-short" }),
    /at least 32 characters/
  );
});
