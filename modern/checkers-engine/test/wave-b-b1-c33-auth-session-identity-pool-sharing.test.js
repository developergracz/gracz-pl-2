import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import { AuthService } from "../src/auth.js";
import { PostgresAuthSessionStore } from "../src/auth-sessions.js";
import { PostgresAccountService } from "../src/postgres-accounts.js";
import { SecureAccountService } from "../src/secure-accounts.js";
import { createGameHttpServer } from "../src/server.js";
import { MemorySessionStore } from "../src/store.js";
import poolBudget from "../src/postgres-pool-budget.cjs";

const {
  POSTGRES_RESOURCE_PROFILE,
  aggregatePoolMax,
  connectionBudgetPlan,
  configuredPoolBudget,
} = poolBudget;

const DATABASE_URL = process.env.B1_C33_DATABASE_URL || "";
const MESSAGE_SECRET = "b1-c33-message-encryption-secret-material-2026";
const AUTH_SECRET = "b1-c33-auth-secret-material-at-least-32-characters";
const USER_ID = "c33alice";
const DISPLAY_NAME = "C33 Alicja";
const PASSWORD = "C33-Strong-Password!2026";

test("B1-C33 static borrower contract removes the AuthSession physical PostgreSQL resource", async () => {
  const source = await readFile(new URL("../src/auth-sessions.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /from\s+["']pg["']/);
  assert.doesNotMatch(source, /new\s+Pool\s*\(/);
  assert.doesNotMatch(source, /new\s+pg\.Pool\s*\(/);
  assert.doesNotMatch(source, /new\s+Client\s*\(/);
  assert.doesNotMatch(source, /new\s+pg\.Client\s*\(/);
  assert.doesNotMatch(source, /this\.pool\.end\s*\(/);
  assert.match(source, /this\.pool\s*=\s*pool/);
  assert.match(source, /POSTGRES_AUTH_SESSION_POOL_REQUIRED/);
  assert.match(source, /const DEFAULT_IDLE_SECONDS = 30 \* 60;/);

  assert.throws(
    () => new PostgresAuthSessionStore(),
    (error) => error?.code === "POSTGRES_AUTH_SESSION_POOL_REQUIRED",
  );
  assert.throws(
    () => new PostgresAuthSessionStore({}),
    (error) => error?.code === "POSTGRES_AUTH_SESSION_POOL_REQUIRED",
  );

  const accountReadyIndex = main.indexOf("if(config.databaseUrl&&baseAccounts.ready)await baseAccounts.ready;");
  const authSessionIndex = main.indexOf("new PostgresAuthSessionStore(baseAccounts.pool)");
  assert.ok(accountReadyIndex >= 0 && authSessionIndex > accountReadyIndex, "AuthSession initialization must remain after PostgresAccountService.ready");
  assert.doesNotMatch(main, /new PostgresAuthSessionStore\(config\.databaseUrl\)/);

  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.length, 15);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.some((entry) => entry.id === "auth-sessions"), false);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.some((entry) => entry.id === "message-attachments"), false);
  assert.equal(aggregatePoolMax(), 50);
  assert.equal(configuredPoolBudget({ POSTGRES_POOL_BUDGET: "64" }), 50);
  assert.throws(
    () => configuredPoolBudget({ POSTGRES_POOL_BUDGET: "49" }),
    (error) => error?.code === "POSTGRES_POOL_BUDGET_EXCEEDED",
  );

  const expected = [
    [1, 52, true],
    [2, 104, false],
    [3, 156, false],
    [4, 208, false],
  ];
  for (const [replicaCount, startupEnvelope, safe] of expected) {
    const plan = connectionBudgetPlan({
      replicaCount,
      maxConnections: 100,
      reservedConnections: 0,
      superuserReservedConnections: 3,
      environment: { POSTGRES_POOL_BUDGET: "64" },
    });
    assert.equal(plan.poolMaxPerReplica, 50);
    assert.equal(plan.externalDedicatedPerReplica, 1);
    assert.equal(plan.startupOverlapPerReplica, 1);
    assert.equal(plan.steadyEnvelope, replicaCount * 51);
    assert.equal(plan.startupEnvelope, startupEnvelope);
    assert.equal(plan.safeApplicationCapacity, 87);
    assert.equal(plan.safe, safe);
  }
});

test("B1-C33 real PostgreSQL shared identity pool preserves auth sessions, HTTP auth, concurrency and shutdown", { skip: !DATABASE_URL, timeout: 30_000 }, async () => {
  let base = null;
  let ownerClosed = false;
  let server = null;

  try {
    const allocatedBefore = Number(pg.Pool.graczAllocatedPoolMax ?? 0);
    base = new PostgresAccountService(DATABASE_URL, MESSAGE_SECRET, { legacyEncryptionSecret: null });
    const allocatedAfterBase = Number(pg.Pool.graczAllocatedPoolMax ?? 0);
    assert.equal(allocatedAfterBase - allocatedBefore, 5, "PostgresAccountService must remain max=5");
    assert.equal(base.pool.options.max, 5);

    await base.ready;
    const secured = new SecureAccountService(base);
    await secured.ready;

    const authSessions = new PostgresAuthSessionStore(base.pool);
    await authSessions.ready;

    assert.equal(secured.pool, base.pool, "SecureAccountService must retain C31 object identity");
    assert.equal(authSessions.pool, base.pool, "AuthSessionStore must borrow the exact canonical account pool");
    assert.equal(Number(pg.Pool.graczAllocatedPoolMax ?? 0), allocatedAfterBase, "AuthSessionStore must allocate no second pool");

    await base.pool.query("DELETE FROM gracz_auth_sessions WHERE user_id=$1", [USER_ID]);
    await base.pool.query("DELETE FROM gracz_accounts WHERE user_id=$1", [USER_ID]);
    await base.register({ userId: USER_ID, displayName: DISPLAY_NAME, password: PASSWORD });

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    const revokedToken = randomUUID();
    await authSessions.create({ tokenId: revokedToken, userId: USER_ID, expiresAt });
    assert.equal(await authSessions.has(revokedToken), true);
    await authSessions.assertActive({ tokenId: revokedToken, userId: USER_ID, expiresAt });
    await authSessions.revoke(revokedToken);
    await assert.rejects(
      () => authSessions.assertActive({ tokenId: revokedToken, userId: USER_ID, expiresAt }),
      (error) => error?.code === "SESSION_REVOKED",
    );

    const allTokenA = randomUUID();
    const allTokenB = randomUUID();
    await authSessions.create({ tokenId: allTokenA, userId: USER_ID, expiresAt });
    await authSessions.create({ tokenId: allTokenB, userId: USER_ID, expiresAt });
    await authSessions.revokeAll(USER_ID);
    await assert.rejects(
      () => authSessions.assertActive({ tokenId: allTokenA, userId: USER_ID, expiresAt }),
      (error) => error?.code === "SESSION_REVOKED",
    );
    await assert.rejects(
      () => authSessions.assertActive({ tokenId: allTokenB, userId: USER_ID, expiresAt }),
      (error) => error?.code === "SESSION_REVOKED",
    );

    const idleToken = randomUUID();
    await authSessions.create({ tokenId: idleToken, userId: USER_ID, expiresAt });
    await base.pool.query("UPDATE gracz_auth_sessions SET last_seen_at=NOW()-INTERVAL '31 minutes' WHERE token_id=$1", [idleToken]);
    await assert.rejects(
      () => authSessions.assertActive({ tokenId: idleToken, userId: USER_ID, expiresAt }),
      (error) => error?.code === "SESSION_REVOKED",
    );

    const cleanupToken = randomUUID();
    await authSessions.create({ tokenId: cleanupToken, userId: USER_ID, expiresAt });
    await base.pool.query("UPDATE gracz_auth_sessions SET last_seen_at=NOW()-INTERVAL '3 days' WHERE token_id=$1", [cleanupToken]);
    await authSessions.cleanup();
    assert.equal(await authSessions.has(cleanupToken), false);

    const concurrentToken = randomUUID();
    await authSessions.create({ tokenId: concurrentToken, userId: USER_ID, expiresAt });
    const samples = [];
    const sampler = setInterval(() => samples.push(base.pool.totalCount), 1);
    try {
      await Promise.all(Array.from({ length: 60 }, (_, index) => {
        if (index % 3 === 0) return base.getProfile(USER_ID);
        if (index % 3 === 1) return secured.checkAvailability({ userId: USER_ID, displayName: DISPLAY_NAME });
        return authSessions.assertActive({ tokenId: concurrentToken, userId: USER_ID, expiresAt });
      }));
    } finally {
      clearInterval(sampler);
      samples.push(base.pool.totalCount);
    }
    assert.ok(samples.every((count) => count <= 5), "canonical identity pool exceeded max=5: " + samples.join(","));
    assert.equal((await base.getProfile(USER_ID)).userId, USER_ID);
    assert.equal((await secured.checkAvailability({ userId: USER_ID, displayName: DISPLAY_NAME })).userId, false);
    assert.equal(await authSessions.has(concurrentToken), true);

    const auth = new AuthService({ secret: AUTH_SECRET, ttlSeconds: 3600 });
    server = createGameHttpServer({ store: new MemorySessionStore(), auth, authSessions });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = "http://127.0.0.1:" + server.address().port;

    async function issueCookie() {
      const response = await fetch(baseUrl + "/auth/session", {
        method: "POST",
        headers: {
          "x-authenticated-user-id": USER_ID,
          "x-authenticated-display-name": DISPLAY_NAME,
        },
      });
      assert.equal(response.status, 201);
      const cookie = response.headers.get("set-cookie");
      assert.match(cookie, /__Host-gracz_session=/);
      return cookie;
    }

    const cookie = await issueCookie();
    const me = await fetch(baseUrl + "/auth/me", { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.userId, USER_ID);

    const logout = await fetch(baseUrl + "/auth/logout", { method: "POST", headers: { cookie } });
    assert.equal(logout.status, 200);
    const reused = await fetch(baseUrl + "/auth/me", { headers: { cookie } });
    assert.equal(reused.status, 401);
    assert.equal((await reused.json()).error.code, "SESSION_REVOKED");

    const cookieA = await issueCookie();
    const cookieB = await issueCookie();
    await authSessions.revokeAll(USER_ID);
    for (const revokedCookie of [cookieA, cookieB]) {
      const response = await fetch(baseUrl + "/auth/me", { headers: { cookie: revokedCookie } });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, "SESSION_REVOKED");
    }

    await new Promise((resolve) => server.close(resolve));
    server = null;

    await base.pool.query("DELETE FROM gracz_auth_sessions WHERE user_id=$1", [USER_ID]);
    await base.pool.query("DELETE FROM gracz_accounts WHERE user_id=$1", [USER_ID]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(base.pool.waitingCount, 0);
    assert.equal(base.pool.totalCount - base.pool.idleCount, 0, "all shared clients must be released before borrower shutdown");

    const physicalPool = base.pool;
    const originalEnd = physicalPool.end.bind(physicalPool);
    let poolEndCount = 0;
    physicalPool.end = (...args) => {
      poolEndCount += 1;
      return originalEnd(...args);
    };

    await authSessions.close();
    await authSessions.close();
    assert.equal(poolEndCount, 0, "borrower close must never end the canonical pool");
    assert.equal((await physicalPool.query("SELECT 1 AS ok")).rows[0].ok, 1, "base pool must remain usable after borrower close");

    await base.close();
    ownerClosed = true;
    assert.equal(poolEndCount, 1, "physical owner must end the canonical pool exactly once");
    assert.equal(physicalPool.totalCount, 0);
    assert.equal(physicalPool.waitingCount, 0);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (!ownerClosed && base) await base.close().catch(() => {});
  }
});
