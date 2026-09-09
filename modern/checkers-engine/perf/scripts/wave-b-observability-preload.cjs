"use strict";
const fs = require("node:fs");
const { monitorEventLoopDelay, createHistogram } = require("node:perf_hooks");
const outputPath = process.env.WAVE_B_OBS_FILE;

if (outputPath) {
  fs.mkdirSync(require("node:path").dirname(outputPath), { recursive: true });
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();
  const poolStatsByPool = new WeakMap();
  const poolStats = [];
  const requestErrorCodes = new Map();
  const serverErrorCodes = new Map();
  let poolWaitCount = 0;
  let poolWaitTotalMs = 0;
  let poolWaitMaxMs = 0;

  function timing() {
    return { histogram: createHistogram({ lowest: 1, highest: 60_000_000, figures: 3 }), errors: 0, over1500ms: 0, errorKinds: new Map() };
  }
  function recordTiming(target, elapsedMs, error = null) {
    const micros = Math.max(1, Math.min(60_000_000, Math.round(elapsedMs * 1000)));
    target.histogram.record(micros);
    if (elapsedMs >= 1500) target.over1500ms += 1;
    if (error) {
      target.errors += 1;
      const raw = String(error?.code || error?.name || error?.message || "ERROR");
      const kind = /timeout/i.test(String(error?.message || raw)) ? "TIMEOUT" : raw.slice(0, 80);
      target.errorKinds.set(kind, (target.errorKinds.get(kind) || 0) + 1);
    }
  }
  function snapshotTiming(target) {
    const h = target.histogram;
    const count = Number(h.count || 0);
    return {
      count,
      p50Ms: count ? Number(h.percentile(50)) / 1000 : 0,
      p95Ms: count ? Number(h.percentile(95)) / 1000 : 0,
      p99Ms: count ? Number(h.percentile(99)) / 1000 : 0,
      maxMs: count ? Number(h.max) / 1000 : 0,
      errors: target.errors,
      over1500ms: target.over1500ms,
      errorKinds: Object.fromEntries([...target.errorKinds.entries()].sort()),
    };
  }
  function sourceFromStack(stack) {
    for (const line of String(stack || "").split("\n")) {
      const match = line.match(/\/src\/([^/():]+\.js)(?::\d+:\d+)?/);
      if (match) return match[1];
    }
    return "unknown";
  }
  function statsFor(pool, stack = "") {
    let stats = poolStatsByPool.get(pool);
    if (stats) return stats;
    const max = Number(pool?.options?.max || 0) || null;
    stats = { label: `${sourceFromStack(stack)}|max=${max ?? "unknown"}`, max, pool, maxWaiting: Number(pool?.waitingCount || 0), acquire: timing(), query: timing() };
    poolStatsByPool.set(pool, stats);
    poolStats.push(stats);
    return stats;
  }
  function tagClient(client, stats) {
    if (!client || client.__waveBPoolStats) return;
    try { Object.defineProperty(client, "__waveBPoolStats", { value: stats, configurable: true, enumerable: false }); } catch {}
  }
  function recordCode(map, value) {
    const code = String(value || "ERROR").slice(0, 80);
    map.set(code, (map.get(code) || 0) + 1);
  }

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const prefix = String(args[0] || "");
      const detail = args.find((value) => value && typeof value === "object" && value.code);
      if (detail?.code && prefix.startsWith("Application request error:")) recordCode(requestErrorCodes, detail.code);
      else if (detail?.code && prefix.startsWith("Server error:")) recordCode(serverErrorCodes, detail.code);
    } catch {}
    return originalConsoleError(...args);
  };

  try {
    const pg = require("pg");
    const originalConnect = pg.Pool.prototype.connect;
    const originalClientQuery = pg.Client.prototype.query;
    pg.Pool.prototype.connect = function patchedConnect(callback) {
      const stats = statsFor(this, new Error().stack);
      stats.maxWaiting = Math.max(stats.maxWaiting, Number(this.waitingCount || 0));
      const started = process.hrtime.bigint();
      const done = (client, error = null) => {
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
        poolWaitCount += 1; poolWaitTotalMs += elapsedMs; poolWaitMaxMs = Math.max(poolWaitMaxMs, elapsedMs);
        recordTiming(stats.acquire, elapsedMs, error);
        stats.maxWaiting = Math.max(stats.maxWaiting, Number(this.waitingCount || 0));
        tagClient(client, stats);
      };
      if (typeof callback === "function") {
        return originalConnect.call(this, (error, client, release) => { done(client, error); callback(error, client, release); });
      }
      const result = originalConnect.call(this);
      return Promise.resolve(result).then((client) => { done(client); return client; }, (error) => { done(null, error); throw error; });
    };

    pg.Client.prototype.query = function patchedQuery(...args) {
      const stats = this.__waveBPoolStats || null;
      if (!stats) return originalClientQuery.apply(this, args);
      const started = process.hrtime.bigint();
      let recorded = false;
      const done = (error = null) => {
        if (recorded) return;
        recorded = true;
        recordTiming(stats.query, Number(process.hrtime.bigint() - started) / 1e6, error);
      };
      const last = args.length - 1;
      if (last >= 0 && typeof args[last] === "function") {
        const callback = args[last];
        args[last] = function diagnosticCallback(error, result) { done(error); return callback.call(this, error, result); };
        try { return originalClientQuery.apply(this, args); } catch (error) { done(error); throw error; }
      }
      let result;
      try { result = originalClientQuery.apply(this, args); } catch (error) { done(error); throw error; }
      if (!result || typeof result.then !== "function") { done(); return result; }
      return result.then((value) => { done(); return value; }, (error) => { done(error); throw error; });
    };
  } catch {}

  const timer = setInterval(() => {
    const mem = process.memoryUsage();
    for (const stats of poolStats) stats.maxWaiting = Math.max(stats.maxWaiting, Number(stats.pool?.waitingCount || 0));
    const row = {
      ts: new Date().toISOString(), pid: process.pid, rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal,
      eventLoopP50Ms: Number(eventLoop.percentile(50)) / 1e6, eventLoopP95Ms: Number(eventLoop.percentile(95)) / 1e6,
      eventLoopP99Ms: Number(eventLoop.percentile(99)) / 1e6, eventLoopMaxMs: Number(eventLoop.max) / 1e6,
      activeRequests: typeof process._getActiveRequests === "function" ? process._getActiveRequests().length : null,
      activeHandles: typeof process._getActiveHandles === "function" ? process._getActiveHandles().length : null,
      poolWaitCount, poolWaitAvgMs: poolWaitCount ? poolWaitTotalMs / poolWaitCount : 0, poolWaitMaxMs,
      requestErrorCodes: Object.fromEntries([...requestErrorCodes.entries()].sort()),
      serverErrorCodes: Object.fromEntries([...serverErrorCodes.entries()].sort()),
      pools: poolStats.map((stats) => ({
        label: stats.label, configuredMax: stats.max, totalCount: Number(stats.pool?.totalCount || 0), idleCount: Number(stats.pool?.idleCount || 0),
        waitingCount: Number(stats.pool?.waitingCount || 0), maxWaitingCount: stats.maxWaiting,
        acquire: snapshotTiming(stats.acquire), query: snapshotTiming(stats.query),
      })),
    };
    fs.appendFileSync(outputPath, JSON.stringify(row) + "\n");
    eventLoop.reset();
  }, 1000);
  timer.unref();
}
