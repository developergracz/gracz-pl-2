import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import { PostgresAccountService } from "../src/postgres-accounts.js";

const DATABASE_URL = process.env.B1_C31_DATABASE_URL || "";
const MESSAGE_SECRET = "b1-c31-message-encryption-secret-material-2026";
const USER_ID = "c31alice";
const DISPLAY_NAME = "C31 Alicja";
const EMAIL = "c31-alice@example.test";
const PASSWORD_1 = "C31-Initial-Password!2026";
const PASSWORD_2 = "C31-Reset-Password!2026";
const PASSWORD_3 = "C31-Expired-Password!2026";

test("B1-C31 static ownership contract removes every SecureAccount physical PostgreSQL constructor", async () => {
  const source = await readFile(new URL("../src/secure-accounts.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /new\s+Pool\s*\(/);
  assert.doesNotMatch(source, /new\s+pg\.Pool\s*\(/);
  assert.doesNotMatch(source, /new\s+Client\s*\(/);
  assert.doesNotMatch(source, /new\s+pg\.Client\s*\(/);
  assert.doesNotMatch(source, /this\.pool\.end\s*\(/);
  assert.doesNotMatch(source, /from\s+["']pg["']/);
  assert.match(source, /this\.pool\s*=\s*baseService\.pool/);
  assert.match(main, /new SecureAccountService\(baseAccounts\)/);
  assert.doesNotMatch(main, /new SecureAccountService\(baseAccounts\s*,/);
});

test("B1-C31 real PostgreSQL canonical identity pool ownership, correctness, concurrency and shutdown", { skip: !DATABASE_URL }, async () => {
  const originalFetch = globalThis.fetch;
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  const deliveries = [];
  let secured = null;
  let base = null;
  let ownerClosed = false;

  process.env.RESEND_API_KEY = "b1-c31-test-resend-key";
  process.env.EMAIL_FROM = "Gracz.pl Test <test@example.test>";
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(String(url), "https://api.resend.com/emails");
    const payload = JSON.parse(String(options.body || "{}"));
    deliveries.push(payload);
    return new Response(JSON.stringify({ id: `c31-mail-${deliveries.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const beforeAllocation = Number(pg.Pool.graczAllocatedPoolMax ?? 0);

    base = new PostgresAccountService(DATABASE_URL, MESSAGE_SECRET, { legacyEncryptionSecret: null });
    const afterBaseAllocation = Number(pg.Pool.graczAllocatedPoolMax ?? 0);
    assert.equal(afterBaseAllocation - beforeAllocation, 5, "PostgresAccountService must allocate exactly max=5");

    const originalReady = base.ready;
    let baseReadyCompleted = false;
    base.ready = (async () => {
      await originalReady;
      await new Promise((resolve) => setTimeout(resolve, 25));
      baseReadyCompleted = true;
    })();

    const { SecureAccountService } = await import("../src/secure-accounts.js?b1-c31");
    assert.throws(
      () => new SecureAccountService({ ready: Promise.resolve() }),
      /kanoniczną pulę PostgreSQL/,
      "SecureAccountService must fail closed when the base service has no canonical pool",
    );

    secured = new SecureAccountService(base);

    assert.equal(secured.pool, base.pool, "borrowed pool must be the exact same object");
    assert.equal(base.pool.options.max, 5);
    assert.equal(Number(pg.Pool.graczAllocatedPoolMax ?? 0), afterBaseAllocation, "SecureAccountService must allocate no second pool");

    await secured.ready;
    assert.equal(baseReadyCompleted, true, "SecureAccount schema initialization must wait for base.ready");

    await base.pool.query("DELETE FROM gracz_password_reset_tokens WHERE user_id=$1", [USER_ID]).catch(() => {});
    await base.pool.query("DELETE FROM gracz_registration_codes WHERE user_id=$1", [USER_ID]).catch(() => {});
    await base.pool.query("DELETE FROM gracz_messages WHERE sender_id=$1 OR recipient_id=$1", [USER_ID]).catch(() => {});
    await base.pool.query("DELETE FROM gracz_accounts WHERE user_id=$1", [USER_ID]).catch(() => {});

    const availableBefore = await secured.checkAvailability({ userId: USER_ID, displayName: DISPLAY_NAME });
    assert.equal(availableBefore.userId, true);
    assert.equal(availableBefore.displayName, true);

    await assert.rejects(
      () => secured.register({
        userId: USER_ID,
        displayName: DISPLAY_NAME,
        password: PASSWORD_1,
        email: EMAIL,
        verificationChannel: "email",
        website: "",
      }),
      (error) => error?.code === "VERIFICATION_REQUIRED",
    );

    const registered = (await base.pool.query(
      "SELECT user_id,display_name,email,contact_verified,password_hash_version FROM gracz_accounts WHERE user_id=$1",
      [USER_ID],
    )).rows[0];
    assert.equal(registered.user_id, USER_ID);
    assert.equal(registered.display_name, DISPLAY_NAME);
    assert.equal(registered.email, EMAIL);
    assert.equal(registered.contact_verified, false);
    assert.equal(Number(registered.password_hash_version), 2);

    const registrationRecord = (await base.pool.query(
      "SELECT code_hash,expires_at FROM gracz_registration_codes WHERE user_id=$1",
      [USER_ID],
    )).rows[0];
    assert.ok(registrationRecord?.code_hash);
    assert.ok(new Date(registrationRecord.expires_at).getTime() > Date.now());

    const verificationMail = deliveries.find((delivery) => /kod aktywacyjny/i.test(String(delivery.text || "")));
    const verificationCode = String(verificationMail?.text || "").match(/kod aktywacyjny:\s*(\d{6})/i)?.[1];
    assert.match(String(verificationCode || ""), /^\d{6}$/);

    await assert.rejects(
      () => secured.authenticate({ userId: USER_ID, password: PASSWORD_1 }),
      (error) => error?.code === "ACCOUNT_NOT_VERIFIED",
    );

    const wrongVerificationCode = verificationCode === "000000" ? "000001" : "000000";
    await assert.rejects(
      () => secured.verifyRegistrationCode({ userId: USER_ID, code: wrongVerificationCode }),
      (error) => error?.code === "INVALID_VERIFICATION_CODE",
    );
    assert.equal(
      (await base.pool.query("SELECT contact_verified FROM gracz_accounts WHERE user_id=$1", [USER_ID])).rows[0].contact_verified,
      false,
      "invalid verification code must not activate the account",
    );

    const activated = await secured.verifyRegistrationCode({ userId: USER_ID, code: verificationCode });
    assert.equal(activated.userId, USER_ID);
    assert.equal(
      (await base.pool.query("SELECT contact_verified FROM gracz_accounts WHERE user_id=$1", [USER_ID])).rows[0].contact_verified,
      true,
    );
    assert.equal(
      (await base.pool.query("SELECT COUNT(*)::int AS count FROM gracz_registration_codes WHERE user_id=$1", [USER_ID])).rows[0].count,
      0,
    );

    assert.deepEqual(
      await secured.authenticate({ userId: USER_ID, password: PASSWORD_1 }),
      { userId: USER_ID, displayName: DISPLAY_NAME },
    );
    await assert.rejects(
      () => secured.authenticate({ userId: USER_ID, password: "C31-Wrong-Password!2026" }),
      (error) => error?.code === "INVALID_CREDENTIALS",
    );

    const availableAfter = await secured.checkAvailability({ userId: USER_ID, displayName: DISPLAY_NAME });
    assert.equal(availableAfter.userId, false);
    assert.equal(availableAfter.displayName, false);

    const passwordBeforeFailedReset = (await base.pool.query(
      "SELECT salt,password_hash,password_hash_version FROM gracz_accounts WHERE user_id=$1",
      [USER_ID],
    )).rows[0];

    await secured.requestPasswordReset({ email: EMAIL, verificationChannel: "email" });
    const resetMail = [...deliveries].reverse().find((delivery) => /kod odzyskiwania/i.test(String(delivery.text || "")));
    const resetCode = String(resetMail?.text || "").match(/kod odzyskiwania(?: hasła)?:\s*(\d{6})/i)?.[1];
    assert.match(String(resetCode || ""), /^\d{6}$/);

    const wrongResetCode = resetCode === "000000" ? "000001" : "000000";
    await assert.rejects(
      () => secured.resetPasswordWithEmail({
        email: EMAIL,
        verificationChannel: "email",
        newPassword: PASSWORD_2,
        token: wrongResetCode,
      }),
      (error) => error?.code === "RECOVERY_FAILED",
    );

    const passwordAfterFailedReset = (await base.pool.query(
      "SELECT salt,password_hash,password_hash_version FROM gracz_accounts WHERE user_id=$1",
      [USER_ID],
    )).rows[0];
    assert.deepEqual(passwordAfterFailedReset.salt, passwordBeforeFailedReset.salt);
    assert.deepEqual(passwordAfterFailedReset.password_hash, passwordBeforeFailedReset.password_hash);
    assert.equal(passwordAfterFailedReset.password_hash_version, passwordBeforeFailedReset.password_hash_version);
    assert.equal((await secured.authenticate({ userId: USER_ID, password: PASSWORD_1 })).userId, USER_ID);

    const reset = await secured.resetPasswordWithEmail({
      email: EMAIL,
      verificationChannel: "email",
      newPassword: PASSWORD_2,
      token: resetCode,
    });
    assert.equal(reset.userId, USER_ID);
    assert.equal((await secured.authenticate({ userId: USER_ID, password: PASSWORD_2 })).userId, USER_ID);
    await assert.rejects(
      () => secured.authenticate({ userId: USER_ID, password: PASSWORD_1 }),
      (error) => error?.code === "INVALID_CREDENTIALS",
    );

    const expiring = await secured.createPasswordResetToken({
      userId: USER_ID,
      email: EMAIL,
      verificationChannel: "email",
    });
    assert.ok(expiring.token);
    await base.pool.query(
      "UPDATE gracz_password_reset_tokens SET expires_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1 AND used_at IS NULL",
      [USER_ID],
    );
    await assert.rejects(
      () => secured.resetPasswordWithEmail({
        email: EMAIL,
        verificationChannel: "email",
        newPassword: PASSWORD_3,
        token: expiring.token,
      }),
      (error) => error?.code === "RECOVERY_FAILED",
    );
    assert.equal((await secured.authenticate({ userId: USER_ID, password: PASSWORD_2 })).userId, USER_ID);

    const poolSamples = [];
    const sampler = setInterval(() => poolSamples.push(base.pool.totalCount), 1);
    try {
      await Promise.all(Array.from({ length: 48 }, (_, index) => (
        index % 2 === 0
          ? secured.checkAvailability({ userId: USER_ID, displayName: DISPLAY_NAME })
          : base.getProfile(USER_ID)
      )));
    } finally {
      clearInterval(sampler);
      poolSamples.push(base.pool.totalCount);
    }
    assert.ok(poolSamples.every((count) => count <= 5), `canonical pool exceeded max=5: ${poolSamples.join(",")}`);
    assert.equal((await base.getProfile(USER_ID)).userId, USER_ID);
    assert.equal((await secured.authenticate({ userId: USER_ID, password: PASSWORD_2 })).userId, USER_ID);

    await base.pool.query("DELETE FROM gracz_password_reset_tokens WHERE user_id=$1", [USER_ID]);
    await base.pool.query("DELETE FROM gracz_registration_codes WHERE user_id=$1", [USER_ID]);
    await base.pool.query("DELETE FROM gracz_messages WHERE sender_id=$1 OR recipient_id=$1", [USER_ID]);
    await base.pool.query("DELETE FROM gracz_accounts WHERE user_id=$1", [USER_ID]);

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(base.pool.waitingCount, 0);
    assert.equal(base.pool.totalCount - base.pool.idleCount, 0, "all borrowed clients must be released before shutdown");

    const physicalPool = base.pool;
    const originalEnd = physicalPool.end.bind(physicalPool);
    const originalBaseClose = base.close.bind(base);
    let poolEndCount = 0;
    let baseCloseCount = 0;

    physicalPool.end = (...args) => {
      poolEndCount += 1;
      return originalEnd(...args);
    };
    base.close = (...args) => {
      baseCloseCount += 1;
      return originalBaseClose(...args);
    };

    await secured.close();
    await secured.close();
    ownerClosed = true;

    assert.equal(baseCloseCount, 1, "SecureAccountService must close its wrapped owner exactly once");
    assert.equal(poolEndCount, 1, "physical canonical pool must end exactly once");
    assert.equal(physicalPool.totalCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;

    if (!ownerClosed && secured) await secured.close().catch(() => {});
    else if (!ownerClosed && base) await base.close().catch(() => {});
  }
});
