import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const runId = String(process.env.WAVE_B_RUN_ID || "b1-c16-r1-v100");
const dir = resolve("perf/k6/reports");
const files = await readdir(dir);

async function readJson(name) {
  return JSON.parse(await readFile(resolve(dir, name), "utf8"));
}

async function readCsv(name) {
  const raw = await readFile(resolve(dir, name), "utf8");
  const lines = raw.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const fields = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ""]));
  });
}

function metricObject(summary, name) {
  return summary?.metrics?.[name] || {};
}

function values(summary, name) {
  const metric = metricObject(summary, name);
  return metric.values && typeof metric.values === "object" ? metric.values : metric;
}

function counter(summary, name) {
  const metric = metricObject(summary, name);
  const v = values(summary, name);
  return Number(metric.count ?? v.count ?? 0);
}

function rate(summary, name) {
  const v = values(summary, name);
  return Number(v.rate ?? 0);
}

function trueCount(summary, name) {
  const v = values(summary, name);
  if (Number.isFinite(Number(v.passes))) return Number(v.passes);
  const operations = counter(summary, "wave_b_operations");
  return Math.round(rate(summary, name) * operations);
}

function trend(summary, name) {
  const v = values(summary, name);
  return {
    count: Number(v.count ?? 0),
    p50: Number(v.med ?? v["p(50)"] ?? 0),
    p95: Number(v["p(95)"] ?? 0),
    p99: Number(v["p(99)"] ?? 0),
    max: Number(v.max ?? 0),
  };
}

function numericMax(rows, key) {
  let max = 0;
  for (const row of rows) {
    const value = Number(String(row[key] ?? "").replace(/%$/, ""));
    if (Number.isFinite(value)) max = Math.max(max, value);
  }
  return max;
}

function mergeCodeCounts(target, source = {}) {
  for (const [key, raw] of Object.entries(source)) {
    const value = Number(raw) || 0;
    target[key] = Math.max(target[key] || 0, value);
  }
}

const record = await readJson(`${runId}-record.json`);
const k6 = await readJson(`${runId}-k6-summary-export.json`);
const correctness = await readJson(`${runId}-correctness.json`);
const application = await readCsv(`${runId}-application.csv`);
const postgres = await readCsv(`${runId}-postgres.csv`);
const host = await readCsv(`${runId}-host.csv`);

const poolAggregate = new Map();
const requestErrorCodes = {};
const serverErrorCodes = {};
let heapUsedMax = 0;
let heapTotalMax = 0;
let eventLoopP50Max = 0;
let eventLoopP95Max = 0;
let eventLoopP99Max = 0;
let eventLoopMax = 0;
let poolWaitMax = 0;
let activeRequestsMax = 0;

for (const name of files.filter((name) => name.startsWith(`${runId}-observability-`) && name.endsWith(".jsonl"))) {
  const raw = await readFile(resolve(dir, name), "utf8");
  for (const line of raw.trim().split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    heapUsedMax = Math.max(heapUsedMax, Number(row.heapUsed) || 0);
    heapTotalMax = Math.max(heapTotalMax, Number(row.heapTotal) || 0);
    eventLoopP50Max = Math.max(eventLoopP50Max, Number(row.eventLoopP50Ms) || 0);
    eventLoopP95Max = Math.max(eventLoopP95Max, Number(row.eventLoopP95Ms) || 0);
    eventLoopP99Max = Math.max(eventLoopP99Max, Number(row.eventLoopP99Ms) || 0);
    eventLoopMax = Math.max(eventLoopMax, Number(row.eventLoopMaxMs) || 0);
    poolWaitMax = Math.max(poolWaitMax, Number(row.poolWaitMaxMs) || 0);
    activeRequestsMax = Math.max(activeRequestsMax, Number(row.activeRequests) || 0);
    mergeCodeCounts(requestErrorCodes, row.requestErrorCodes);
    mergeCodeCounts(serverErrorCodes, row.serverErrorCodes);

    for (const pool of row.pools || []) {
      const label = String(pool.label || "unknown");
      const current = poolAggregate.get(label) || {
        label,
        configuredMax: Number(pool.configuredMax) || null,
        totalMax: 0,
        idleMax: 0,
        waitingMax: 0,
        maxWaitingCount: 0,
        acquire: null,
        query: null,
      };
      current.totalMax = Math.max(current.totalMax, Number(pool.totalCount) || 0);
      current.idleMax = Math.max(current.idleMax, Number(pool.idleCount) || 0);
      current.waitingMax = Math.max(current.waitingMax, Number(pool.waitingCount) || 0);
      current.maxWaitingCount = Math.max(current.maxWaitingCount, Number(pool.maxWaitingCount) || 0);
      if (!current.acquire || Number(pool.acquire?.count || 0) >= Number(current.acquire?.count || 0)) {
        current.acquire = pool.acquire || null;
      }
      if (!current.query || Number(pool.query?.count || 0) >= Number(current.query?.count || 0)) {
        current.query = pool.query || null;
      }
      poolAggregate.set(label, current);
    }
  }
}

const pools = [...poolAggregate.values()].sort((a, b) => (b.maxWaitingCount || 0) - (a.maxWaitingCount || 0));
const trafficGuard = pools.find((pool) => pool.label.includes("distributed-infrastructure.js|max=4")) || null;
const sessionStore = pools.find((pool) => pool.label.includes("postgres-session-store.js|max=4")) || null;
const auditService = pools.find((pool) => pool.label.includes("audit-service.js|max=2")) || null;

const totalProfileSeconds = Number(record.warmupSeconds || 0) + Number(record.steadySeconds || 0) + Number(record.cooldownSeconds || 0);
const trafficAcquireCount = Number(trafficGuard?.acquire?.count || 0);
const totalHttpRequests = counter(k6, "http_reqs");
const steadyOperations = counter(k6, "wave_b_operations");

const summary = {
  identity: {
    runId,
    head: record.head,
    tree: record.tree,
    replicas: record.replicas,
    vus: record.vus,
    scenario: record.scenario,
    warmupSeconds: record.warmupSeconds,
    steadySeconds: record.steadySeconds,
    cooldownSeconds: record.cooldownSeconds,
  },
  workload: {
    httpRequestsTotal: totalHttpRequests,
    steadyOperations,
    steadyRps: Number(values(k6, "wave_b_operations").rate ?? 0),
    readOperations: counter(k6, "wave_b_read_operations"),
    writeAttempts: counter(k6, "wave_b_write_attempts"),
    writesAccepted: counter(k6, "wave_b_write_accepted"),
    checkersAccepted: counter(k6, "wave_b_checkers_write_accepted"),
    gomokuAccepted: counter(k6, "wave_b_gomoku_write_accepted"),
    thousandAccepted: counter(k6, "wave_b_thousand_write_accepted"),
  },
  latency: {
    fast: trend(k6, "wave_b_fast_read_ms"),
    normal: trend(k6, "wave_b_normal_command_ms"),
    complex: trend(k6, "wave_b_complex_read_ms"),
    all: trend(k6, "wave_b_http_ms"),
  },
  errors: {
    unexpectedRate: rate(k6, "wave_b_unexpected_error"),
    unexpectedCount: trueCount(k6, "wave_b_unexpected_error"),
    server5xxRate: rate(k6, "wave_b_server_5xx"),
    server5xxCount: trueCount(k6, "wave_b_server_5xx"),
    timeoutRate: rate(k6, "wave_b_timeout"),
    timeoutCount: trueCount(k6, "wave_b_timeout"),
    expected429: counter(k6, "wave_b_expected_429"),
    expected409: counter(k6, "wave_b_expected_409"),
    requestErrorCodes,
    serverErrorCodes,
  },
  correctness,
  runtime: {
    appCpuMaxPercent: numericMax(application.filter((row) => row.process_state !== "PROCESS_DEAD"), "cpu_percent"),
    appRssMaxMb: numericMax(application, "rss_kb") / 1024,
    heapUsedMaxMb: heapUsedMax / 1048576,
    heapTotalMaxMb: heapTotalMax / 1048576,
    eventLoopP50MaxMs: eventLoopP50Max,
    eventLoopP95MaxMs: eventLoopP95Max,
    eventLoopP99MaxMs: eventLoopP99Max,
    eventLoopMaxMs: eventLoopMax,
    activeRequestsMax,
    poolWaitMaxMs: poolWaitMax,
    k6CpuMaxPercent: numericMax(host, "k6_cpu_percent"),
    postgresCpuMaxPercent: numericMax(host, "postgres_cpu_percent"),
    hostLoad1Max: numericMax(host, "load1"),
  },
  postgres: {
    maxConnections: numericMax(postgres, "max_connections"),
    maxBackends: numericMax(postgres, "numbackends"),
    maxActive: numericMax(postgres, "active"),
    maxIdle: numericMax(postgres, "idle"),
    maxIdleInTransaction: numericMax(postgres, "idle_in_transaction"),
    maxWaiting: numericMax(postgres, "waiting"),
    maxClientWait: numericMax(postgres, "client_wait"),
    maxLockWait: numericMax(postgres, "lock_wait"),
    maxLwLockWait: numericMax(postgres, "lwlock_wait"),
    maxIoWait: numericMax(postgres, "io_wait"),
    maxIpcWait: numericMax(postgres, "ipc_wait"),
    maxTimeoutWait: numericMax(postgres, "timeout_wait"),
    maxActivityWait: numericMax(postgres, "activity_wait"),
    maxBufferPinWait: numericMax(postgres, "bufferpin_wait"),
    maxTransactionIdWait: numericMax(postgres, "transactionid_wait"),
    maxLongQueries: numericMax(postgres, "long_queries"),
    maxQueryMs: numericMax(postgres, "max_query_ms"),
    maxTransactionMs: numericMax(postgres, "max_xact_ms"),
    maxWaitingLocks: numericMax(postgres, "waiting_locks"),
    deadlocksMax: numericMax(postgres, "deadlocks"),
  },
  pools,
  batching: {
    trafficGuardAcquireCount: trafficAcquireCount,
    trafficGuardAcquirePerSecondWholeProfile: totalProfileSeconds > 0 ? trafficAcquireCount / totalProfileSeconds : null,
    totalHttpRequestsPerTrafficGuardAcquire: trafficAcquireCount > 0 ? totalHttpRequests / trafficAcquireCount : null,
    steadyOperationsPerTrafficGuardAcquire: trafficAcquireCount > 0 ? steadyOperations / trafficAcquireCount : null,
    totalProfileSeconds,
  },
  keyPools: { trafficGuard, sessionStore, auditService },
};

const out = resolve(dir, `${runId}-control-summary.json`);
await writeFile(out, JSON.stringify(summary, null, 2));
console.log("B1_C16_CONTROL_SUMMARY_BEGIN");
console.log(JSON.stringify(summary, null, 2));
console.log("B1_C16_CONTROL_SUMMARY_END");
