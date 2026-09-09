import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import pg from "pg";
import { AuthService } from "../src/auth.js";
import {
  acquirePostgresStartupSchemaLock,
  POSTGRES_STARTUP_SCHEMA_LOCK_CLASS,
  POSTGRES_STARTUP_SCHEMA_LOCK_OBJECT,
  POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_CODE,
  withPostgresStartupSchemaLock,
} from "../src/postgres-startup-schema-lock.js";
import { WAVE_B_GUEST_TTL_SECONDS } from "../perf/scripts/wave-b-auth-policy.mjs";
import { createWaveBSeedPlatform } from "../perf/scripts/wave-b-seed-platform.mjs";

const require = createRequire(import.meta.url);
const budget = require("../src/postgres-pool-budget.cjs");
const { secureSslConfig } = require("../src/postgres-ssl-policy.cjs");
const { Pool, Client } = pg;

const environment = { POSTGRES_POOL_BUDGET: "64" };
const databaseUrl = process.env.WAVE_B_TEST_DATABASE_URL || process.env.DATABASE_URL || "";
const postgresTest = { skip: !databaseUrl };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resetDatabase() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 1,
  });
  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  } finally {
    await pool.end();
  }
}

function runColdStart(replicas, basePort, runId) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["perf/scripts/wave-b-cold-start.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WAVE_B_REPLICAS: String(replicas),
        WAVE_B_BASE_PORT: String(basePort),
        WAVE_B_RUN_ID: runId,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "", stderr = "", settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      settled = true;
      reject(new Error(`${runId} timed out\n${stderr.slice(-12000)}`));
    }, 120_000);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-20000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-20000); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${runId} failed code=${code} signal=${signal || "none"}\n${stdout}\n${stderr}`));
    });
  });
}

test("Wave B connection budget accepts the 1-replica PostgreSQL=100 topology", () => {
  const plan = budget.validateClusterConnectionBudget({
    replicaCount: 1,
    maxConnections: 100,
    reservedConnections: 3,
    environment,
  });
  assert.equal(plan.profilePoolMaxPerReplica, 62);
  assert.equal(plan.dedicatedListenPerReplica, 1);
  assert.equal(plan.ordinaryPoolMaxPerReplica, 61);
  assert.equal(plan.operationalHeadroom, 10);
  assert.equal(plan.safe, true);
});

test("Wave B connection budget rejects unsafe 2-replica PostgreSQL=100 topology", () => {
  assert.throws(
    () => budget.validateClusterConnectionBudget({ replicaCount: 2, maxConnections: 100, reservedConnections: 3, environment }),
    (error) => error?.code === "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED" && error.plan?.configuredTotalApplicationEnvelope === 124,
  );
});

test("Wave B connection budget rejects unsafe 4-replica PostgreSQL=100 topology", () => {
  assert.throws(
    () => budget.validateClusterConnectionBudget({ replicaCount: 4, maxConnections: 100, reservedConnections: 3, environment }),
    (error) => error?.code === "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED" && error.plan?.configuredTotalApplicationEnvelope === 248,
  );
});

test("Wave B connection budget accepts topology only when measured max_connections provides headroom", () => {
  const two = budget.validateClusterConnectionBudget({ replicaCount: 2, maxConnections: 160, reservedConnections: 3, environment });
  const four = budget.validateClusterConnectionBudget({ replicaCount: 4, maxConnections: 320, reservedConnections: 3, environment });
  assert.equal(two.safe, true);
  assert.equal(four.safe, true);
  assert.ok(two.operationalHeadroom >= 16);
  assert.ok(four.operationalHeadroom >= 32);
});

test("C11-AG1 canonical PostgreSQL TLS policy is strict for external connections", () => {
  assert.equal(secureSslConfig("postgresql://u:p@127.0.0.1:5432/db", {}), false);
  assert.equal(secureSslConfig("postgresql://u:p@localhost:5432/db", {}), false);
  assert.equal(secureSslConfig("postgresql://u:p@dpg-gracz-private:5432/db", {}), false);

  assert.deepEqual(
    secureSslConfig("postgresql://u:p@db.example.com:5432/db", {}),
    { rejectUnauthorized: true },
  );

  const pem = "-----BEGIN CERTIFICATE-----\nC11-AG1 TEST CA\n-----END CERTIFICATE-----";
  const configured = secureSslConfig(
    "postgresql://u:p@db.example.com:5432/db",
    { DATABASE_SSL_CA_BASE64: Buffer.from(pem, "utf8").toString("base64") },
  );
  assert.equal(configured.rejectUnauthorized, true);
  assert.equal(configured.ca, pem);

  assert.throws(
    () => secureSslConfig(
      "postgresql://u:p@db.example.com:5432/db",
      { DATABASE_SSL_CA_BASE64: "%%%not-base64%%%" },
    ),
    /DATABASE_SSL_CA_BASE64/,
  );
  assert.throws(
    () => secureSslConfig(
      "postgresql://u:p@db.example.com:5432/db",
      { DATABASE_SSL_CA_BASE64: Buffer.from("not a certificate", "utf8").toString("base64") },
    ),
    /certyfikatu CA/,
  );
});

test("C11-S2 startup schema lock serializes concurrent PostgreSQL initialization", postgresTest, async () => {
  let firstEntered;
  const entered = new Promise((resolve) => { firstEntered = resolve; });
  let secondEntered = false;

  const first = withPostgresStartupSchemaLock(databaseUrl, async () => {
    firstEntered();
    await delay(150);
  });
  await entered;
  const second = withPostgresStartupSchemaLock(databaseUrl, async () => {
    secondEntered = true;
  });

  await delay(60);
  assert.equal(secondEntered, false);
  await first;
  await second;
  assert.equal(secondEntered, true);
});

test("C11-AG1 startup schema lock wait is bounded and fail-closed", postgresTest, async () => {
  const holder = await acquirePostgresStartupSchemaLock(databaseUrl, { timeoutMs: 5_000 });
  let protectedWorkEntered = false;
  const startedAt = Date.now();
  try {
    await assert.rejects(
      withPostgresStartupSchemaLock(
        databaseUrl,
        async () => { protectedWorkEntered = true; },
        { timeoutMs: 150 },
      ),
      (error) => error?.code === POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_CODE && error?.timeoutMs === 150,
    );
    assert.equal(protectedWorkEntered, false);
    assert.ok(Date.now() - startedAt < 5_000);
  } finally {
    await holder.release();
  }

  let retryEntered = false;
  await withPostgresStartupSchemaLock(
    databaseUrl,
    async () => { retryEntered = true; },
    { timeoutMs: 1_000 },
  );
  assert.equal(retryEntered, true);
});

test("C11-AG1 PostgreSQL session disappearance releases startup lock ownership", postgresTest, async () => {
  const holder = new Client({
    connectionString: databaseUrl,
    ssl: secureSslConfig(databaseUrl),
    connectionTimeoutMillis: 5_000,
  });
  await holder.connect();
  await holder.query(
    "SELECT pg_advisory_lock($1::int, $2::int)",
    [POSTGRES_STARTUP_SCHEMA_LOCK_CLASS, POSTGRES_STARTUP_SCHEMA_LOCK_OBJECT],
  );
  await holder.end();

  const acquired = await acquirePostgresStartupSchemaLock(databaseUrl, { timeoutMs: 1_000 });
  await acquired.release();
});

test("C11-S2 startup schema lock releases on failure and permits retry", postgresTest, async () => {
  await assert.rejects(
    withPostgresStartupSchemaLock(databaseUrl, async () => {
      throw new Error("intentional C11-S2 initialization failure");
    }),
    /intentional C11-S2 initialization failure/,
  );

  let retried = false;
  await withPostgresStartupSchemaLock(databaseUrl, async () => { retried = true; });
  assert.equal(retried, true);
});

test("C11-AG1 canonical application launch paths use src/start.js", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts.start, /src\/start\.js/);
  assert.doesNotMatch(packageJson.scripts.start, /src\/main\.js/);

  const startSource = await readFile(new URL("../src/start.js", import.meta.url), "utf8");
  assert.match(startSource, /withPostgresStartupSchemaLock/);
  assert.match(startSource, /import\("\.\/main\.js"\)/);

  const lockSource = await readFile(new URL("../src/postgres-startup-schema-lock.js", import.meta.url), "utf8");
  assert.match(lockSource, /ssl:\s*secureSslConfig\(connectionString\)/);
  assert.doesNotMatch(lockSource, /rejectUnauthorized:\s*false/);

  for (const path of [
    "../perf/scripts/wave-b-cold-start.sh",
    "../perf/scripts/wave-b-runner.sh",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /src\/start\.js/);
    assert.doesNotMatch(source, /src\/main\.js/);
  }

  const workflow = await readFile(
    new URL("../../../.github/workflows/wave-b-benchmark.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /wave-b-cold-start\.sh/);
  assert.match(workflow, /wave-b-runner\.sh/);
  assert.doesNotMatch(workflow, /src\/main\.js/);
});

test("C11-S2 benchmark guest token policy stays inside production one-hour maximum", () => {
  assert.equal(WAVE_B_GUEST_TTL_SECONDS, 3600);
  const auth = new AuthService({ secret: "c11-s2-auth-secret-0123456789abcdef0123456789abcdef" });
  const token = auth.issueGuest({ userId: "waveb", displayName: "Wave B", ttlSeconds: WAVE_B_GUEST_TTL_SECONDS });
  const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
  assert.equal(payload.exp - payload.iat, 3600);
  assert.throws(
    () => auth.issueGuest({ userId: "waveb", displayName: "Wave B", ttlSeconds: 3601 }),
    /Sesja gościa musi trwać od 60 s do 1 h/,
  );
});

test("C11-S2 clean PostgreSQL bootstrap supports 2 and 4 concurrent startup processes and repeat", { ...postgresTest, timeout: 300_000 }, async () => {
  await resetDatabase();
  await runColdStart(2, 4520, "c11-s2-focused-r2");

  await resetDatabase();
  await runColdStart(4, 4540, "c11-s2-focused-r4");

  await runColdStart(4, 4560, "c11-s2-focused-r4-repeat");
});

test("C11-S2 benchmark setup can create more than the HTTP room-admission limit through canonical LobbyService", { ...postgresTest, timeout: 120_000 }, async () => {
  const platform = await createWaveBSeedPlatform(databaseUrl);
  const prefix = `c11s2-${Date.now()}`;
  try {
    for (let index = 0; index < 21; index += 1) {
      const ownerId = `c11owner${String(index).padStart(2, "0")}`;
      const playerId = `c11player${String(index).padStart(2, "0")}`;
      const room = await platform.lobby.createRoom({
        ownerId,
        ownerName: `Owner ${index}`,
        roomName: `${prefix}-${index}`,
        gameType: "checkers",
        maxPlayers: 2,
      });
      const playing = await platform.lobby.joinRoom({
        roomId: room.roomId,
        playerId,
        playerName: `Player ${index}`,
      });
      assert.equal(playing.status, "playing");
      assert.ok(playing.gameId);
    }
  } finally {
    await platform.close();
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 1,
  });
  try {
    const rooms = await pool.query("SELECT count(*)::int AS count FROM gracz_lobby_rooms WHERE room_name LIKE $1", [`${prefix}%`]);
    const games = await pool.query(
      "SELECT count(*)::int AS count FROM gracz_game_sessions WHERE game_id IN (SELECT game_id FROM gracz_lobby_rooms WHERE room_name LIKE $1)",
      [`${prefix}%`],
    );
    assert.equal(rooms.rows[0].count, 21);
    assert.equal(games.rows[0].count, 21);
  } finally {
    await pool.end();
  }
});
