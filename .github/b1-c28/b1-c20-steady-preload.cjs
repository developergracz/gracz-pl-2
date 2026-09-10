"use strict";

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { AsyncLocalStorage } = require("node:async_hooks");
const { createHistogram } = require("node:perf_hooks");

const runId = String(process.env.WAVE_B_RUN_ID || "b1-c28-r1-v100");
const obsPath = process.env.WAVE_B_OBS_FILE || "";
const reportDir = obsPath ? path.dirname(obsPath) : path.resolve("perf/k6/reports");
const outputPath = path.join(reportDir, `${runId}-b1-c20-steady-telemetry.json`);
const markerPath = `/tmp/b1-c20-k6-start-${runId}`;
const warmupMs = Number(process.env.WAVE_B_WARMUP_SECONDS || 120) * 1000;
const steadyMs = Number(process.env.WAVE_B_STEADY_SECONDS || 300) * 1000;
const als = new AsyncLocalStorage();

let windowInfo = null;
let startPoolSnapshot = null;
let endPoolSnapshot = null;
let snapshotWritten = false;
const poolStatsByPool = new WeakMap();
const poolStats = [];
const clientPoolStats = new WeakMap();
const clientAcquireSource = new WeakMap();
const listenerClients = new Set();
const responseMeta = new WeakMap();

const httpCounts = {
  total: 0,
  status2xx: 0,
  status3xx: 0,
  status409: 0,
  status429: 0,
  status5xx: 0,
  other4xx: 0,
  paths: {},
  errorCodes: {},
};

function timing() {
  return {
    histogram: createHistogram({ lowest: 1, highest: 60_000_000, figures: 3 }),
    errors: 0,
    timeoutErrors: 0,
    errorKinds: new Map(),
  };
}

function timingSnapshot(target) {
  const h = target.histogram;
  const count = Number(h.count || 0);
  return {
    count,
    p50Ms: count ? Number(h.percentile(50)) / 1000 : 0,
    p95Ms: count ? Number(h.percentile(95)) / 1000 : 0,
    p99Ms: count ? Number(h.percentile(99)) / 1000 : 0,
    maxMs: count ? Number(h.max) / 1000 : 0,
    errors: target.errors,
    timeouts: target.timeoutErrors,
    errorKinds: Object.fromEntries([...target.errorKinds.entries()].sort()),
  };
}

function recordTiming(target, elapsedMs, error = null) {
  const micros = Math.max(1, Math.min(60_000_000, Math.round(elapsedMs * 1000)));
  target.histogram.record(micros);
  if (error) {
    target.errors += 1;
    const raw = String(error?.code || error?.name || error?.message || "ERROR").slice(0, 120);
    if (/timeout|timed out|ETIMEDOUT/i.test(String(error?.message || raw))) target.timeoutErrors += 1;
    target.errorKinds.set(raw, (target.errorKinds.get(raw) || 0) + 1);
  }
}

function sourceFromStack(stack) {
  for (const line of String(stack || "").split("\n")) {
    const match = line.match(/\/src\/([^/():]+\.js)(?::\d+:\d+)?/);
    if (match) return match[1];
  }
  return "unknown";
}

function inSteady(epochMs) {
  return Boolean(windowInfo && epochMs >= windowInfo.steadyStartEpochMs && epochMs < windowInfo.steadyEndEpochMs);
}

function attributionFor(stats, source) {
  const key = String(source || "unknown");
  let value = stats.attribution.get(key);
  if (!value) {
    value = { source: key, acquire: timing(), query: timing() };
    stats.attribution.set(key, value);
  }
  return value;
}

function statsFor(pool, source) {
  let stats = poolStatsByPool.get(pool);
  if (stats) return stats;
  const max = Number(pool?.options?.max || 0) || null;
  stats = {
    pool,
    label: `${source || "unknown"}|max=${max ?? "unknown"}`,
    configuredMax: max,
    historicalMaxWaitingCount: Number(pool?.waitingCount || 0),
    steadyMaxWaitingCount: 0,
    acquire: timing(),
    query: timing(),
    attribution: new Map(),
  };
  poolStatsByPool.set(pool, stats);
  poolStats.push(stats);
  return stats;
}

function updateWaiting(stats, epochMs = Date.now()) {
  const waiting = Number(stats.pool?.waitingCount || 0);
  stats.historicalMaxWaitingCount = Math.max(stats.historicalMaxWaitingCount, waiting);
  if (inSteady(epochMs)) stats.steadyMaxWaitingCount = Math.max(stats.steadyMaxWaitingCount, waiting);
}

function poolState(stats) {
  return {
    label: stats.label,
    configuredMax: stats.configuredMax,
    totalCount: Number(stats.pool?.totalCount || 0),
    idleCount: Number(stats.pool?.idleCount || 0),
    waitingCount: Number(stats.pool?.waitingCount || 0),
  };
}

function recordHttp(meta, statusCode) {
  if (!meta.isK6 || !inSteady(meta.startedAt)) return;
  httpCounts.total += 1;
  if (statusCode >= 200 && statusCode < 300) httpCounts.status2xx += 1;
  else if (statusCode >= 300 && statusCode < 400) httpCounts.status3xx += 1;
  else if (statusCode === 409) httpCounts.status409 += 1;
  else if (statusCode === 429) httpCounts.status429 += 1;
  else if (statusCode >= 500) httpCounts.status5xx += 1;
  else if (statusCode >= 400) httpCounts.other4xx += 1;

  const key = `${meta.method} ${meta.path}`;
  const row = httpCounts.paths[key] || (httpCounts.paths[key] = { total: 0, status2xx: 0, status409: 0, status429: 0, status5xx: 0, other: 0 });
  row.total += 1;
  if (statusCode >= 200 && statusCode < 300) row.status2xx += 1;
  else if (statusCode === 409) row.status409 += 1;
  else if (statusCode === 429) row.status429 += 1;
  else if (statusCode >= 500) row.status5xx += 1;
  else row.other += 1;

  if (meta.errorCode) httpCounts.errorCodes[meta.errorCode] = (httpCounts.errorCodes[meta.errorCode] || 0) + 1;
}

function sqlText(args) {
  const first = args[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && typeof first.text === "string") return first.text;
  return "";
}

function listenerSnapshot() {
  const rows = [];
  for (const entry of listenerClients) {
    const client = entry.client;
    const streamDestroyed = Boolean(client?.connection?.stream?.destroyed);
    const ending = Boolean(client?._ending);
    rows.push({
      poolLabel: entry.poolLabel,
      source: entry.source,
      backendPid: entry.backendPid,
      listenSql: entry.listenSql,
      observedAt: entry.observedAt,
      streamDestroyed,
      ending,
      appearsLive: !streamDestroyed && !ending,
    });
  }
  return rows;
}

try {
  const pg = require("pg");
  const originalPoolQuery = pg.Pool.prototype.query;
  const originalConnect = pg.Pool.prototype.connect;
  const originalClientQuery = pg.Client.prototype.query;

  pg.Pool.prototype.query = function b1c20PoolQuery(...args) {
    const source = sourceFromStack(new Error().stack);
    return als.run({ source, kind: "pool.query" }, () => originalPoolQuery.apply(this, args));
  };

  pg.Pool.prototype.connect = function b1c20Connect(callback) {
    const context = als.getStore();
    const source = context?.source || sourceFromStack(new Error().stack);
    const stats = statsFor(this, source);
    const startedAt = Date.now();
    const startedHr = process.hrtime.bigint();
    updateWaiting(stats, startedAt);

    const done = (client, error = null) => {
      const elapsedMs = Number(process.hrtime.bigint() - startedHr) / 1e6;
      updateWaiting(stats, Date.now());
      if (client) {
        clientPoolStats.set(client, stats);
        clientAcquireSource.set(client, source);
      }
      if (inSteady(startedAt)) {
        recordTiming(stats.acquire, elapsedMs, error);
        recordTiming(attributionFor(stats, source).acquire, elapsedMs, error);
      }
    };

    if (typeof callback === "function") {
      return originalConnect.call(this, (error, client, release) => {
        done(client, error);
        callback(error, client, release);
      });
    }

    let result;
    try {
      result = originalConnect.call(this);
      updateWaiting(stats, Date.now());
    } catch (error) {
      done(null, error);
      throw error;
    }
    return Promise.resolve(result).then(
      (client) => { done(client); return client; },
      (error) => { done(null, error); throw error; },
    );
  };

  pg.Client.prototype.query = function b1c20ClientQuery(...args) {
    const stats = clientPoolStats.get(this) || null;
    if (!stats) return originalClientQuery.apply(this, args);
    const source = clientAcquireSource.get(this) || sourceFromStack(new Error().stack);
    const text = sqlText(args);
    const startedAt = Date.now();
    const startedHr = process.hrtime.bigint();
    let recorded = false;

    if (/^\s*LISTEN\s+gracz_global_chat_realtime\b/i.test(text)) {
      listenerClients.add({
        client: this,
        poolLabel: stats.label,
        source,
        backendPid: this.processID ?? null,
        listenSql: text.trim().slice(0, 160),
        observedAt: new Date().toISOString(),
      });
    }

    const done = (error = null) => {
      if (recorded) return;
      recorded = true;
      if (!inSteady(startedAt)) return;
      const elapsedMs = Number(process.hrtime.bigint() - startedHr) / 1e6;
      recordTiming(stats.query, elapsedMs, error);
      recordTiming(attributionFor(stats, source).query, elapsedMs, error);
    };

    const last = args.length - 1;
    if (last >= 0 && typeof args[last] === "function") {
      const callback = args[last];
      args[last] = function b1c20QueryCallback(error, result) {
        done(error);
        return callback.call(this, error, result);
      };
      try { return originalClientQuery.apply(this, args); } catch (error) { done(error); throw error; }
    }

    let result;
    try { result = originalClientQuery.apply(this, args); } catch (error) { done(error); throw error; }
    if (!result || typeof result.then !== "function") { done(); return result; }
    return result.then(
      (value) => { done(); return value; },
      (error) => { done(error); throw error; },
    );
  };
} catch (error) {
  console.error("B1-C20 telemetry preload failed to instrument pg:", error);
}

const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function b1c20ServerEmit(event, ...args) {
  if (event === "request") {
    const [req, res] = args;
    if (req && res) {
      let pathname = "/";
      try { pathname = new URL(req.url || "/", "http://127.0.0.1").pathname; } catch {}
      const meta = { startedAt: Date.now(), method: String(req.method || "GET").toUpperCase(), path: pathname, errorCode: null, isK6: String(req.headers?.["user-agent"] || "").startsWith("gracz-wave-b-k6/") };
      responseMeta.set(res, meta);
      res.once("finish", () => recordHttp(meta, Number(res.statusCode || 0)));
    }
  }
  return originalEmit.call(this, event, ...args);
};

const originalEnd = http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end = function b1c20ResponseEnd(chunk, encoding, callback) {
  const meta = responseMeta.get(this);
  if (meta && chunk && Number(this.statusCode || 0) >= 400) {
    try {
      const text = Buffer.isBuffer(chunk) ? chunk.toString(typeof encoding === "string" ? encoding : "utf8") : String(chunk);
      if (text.length <= 65536) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.code === "string") meta.errorCode = parsed.code.slice(0, 120);
      }
    } catch {}
  }
  return originalEnd.call(this, chunk, encoding, callback);
};

function capturePoolSnapshot() {
  return poolStats.map(poolState);
}

function writeSnapshot() {
  if (snapshotWritten || !windowInfo) return;
  snapshotWritten = true;
  fs.mkdirSync(reportDir, { recursive: true });
  const pools = poolStats.map((stats) => ({
    ...poolState(stats),
    maxWaitingCount: stats.steadyMaxWaitingCount,
    historicalMaxWaitingCount: stats.historicalMaxWaitingCount,
    acquire: timingSnapshot(stats.acquire),
    query: timingSnapshot(stats.query),
    attribution: [...stats.attribution.values()].map((row) => ({
      source: row.source,
      acquire: timingSnapshot(row.acquire),
      query: timingSnapshot(row.query),
    })).sort((a, b) => b.acquire.count - a.acquire.count || a.source.localeCompare(b.source)),
  }));
  const body = {
    runId,
    generatedAt: new Date().toISOString(),
    window: windowInfo,
    poolSnapshots: { start: startPoolSnapshot, end: endPoolSnapshot },
    pools,
    http: httpCounts,
    globalChatListeners: listenerSnapshot(),
  };
  fs.writeFileSync(outputPath, JSON.stringify(body, null, 2) + "\n");
}

process.on("SIGUSR2", () => {
  if (windowInfo) return;
  try {
    const [epochText, isoText] = fs.readFileSync(markerPath, "utf8").trim().split("|");
    const k6StartEpochMs = Number(epochText);
    if (!Number.isFinite(k6StartEpochMs)) throw new Error("invalid k6 marker epoch");
    windowInfo = {
      k6StartEpochMs,
      k6StartIso: isoText || new Date(k6StartEpochMs).toISOString(),
      warmupSeconds: warmupMs / 1000,
      steadySeconds: steadyMs / 1000,
      steadyStartEpochMs: k6StartEpochMs + warmupMs,
      steadyStartIso: new Date(k6StartEpochMs + warmupMs).toISOString(),
      steadyEndEpochMs: k6StartEpochMs + warmupMs + steadyMs,
      steadyEndIso: new Date(k6StartEpochMs + warmupMs + steadyMs).toISOString(),
    };
    const untilStart = Math.max(0, windowInfo.steadyStartEpochMs - Date.now());
    const untilEnd = Math.max(0, windowInfo.steadyEndEpochMs - Date.now());
    setTimeout(() => { startPoolSnapshot = capturePoolSnapshot(); }, untilStart + 5);
    setTimeout(() => { endPoolSnapshot = capturePoolSnapshot(); }, untilEnd + 5);
    setTimeout(writeSnapshot, untilEnd + 30_000);
  } catch (error) {
    console.error("B1-C20 telemetry could not establish steady window:", error);
  }
});

process.on("exit", () => {
  try { writeSnapshot(); } catch {}
});
