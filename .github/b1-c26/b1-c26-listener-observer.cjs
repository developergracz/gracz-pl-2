"use strict";

const fs = require("node:fs");
const path = require("node:path");

const runId = String(process.env.WAVE_B_RUN_ID || "b1-c26-r1-v100");
const obsPath = process.env.WAVE_B_OBS_FILE || "";
const reportDir = obsPath ? path.dirname(obsPath) : path.resolve("perf/k6/reports");
const outputPath = path.join(reportDir, `${runId}-b1-c26-listener-observer.json`);
const markerPath = `/tmp/b1-c20-k6-start-${runId}`;
const warmupMs = Number(process.env.WAVE_B_WARMUP_SECONDS || 120) * 1000;
const steadyMs = Number(process.env.WAVE_B_STEADY_SECONDS || 300) * 1000;

const pooledClients = new WeakSet();
const listeners = new Map();
let steadyMidSnapshot = null;
let windowInfo = null;

function sqlText(args) {
  const first = args[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && typeof first.text === "string") return first.text;
  return "";
}

function clientState(client, meta) {
  return {
    backendPid: client?.processID ?? meta.backendPid ?? null,
    pooledAtListen: Boolean(meta.pooledAtListen),
    listenSql: meta.listenSql,
    observedAt: meta.observedAt,
    streamDestroyed: Boolean(client?.connection?.stream?.destroyed),
    ending: Boolean(client?._ending),
    appearsLive: !Boolean(client?.connection?.stream?.destroyed) && !Boolean(client?._ending),
  };
}

function snapshot() {
  return [...listeners.entries()].map(([client, meta]) => clientState(client, meta));
}

function write() {
  try {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      runId,
      generatedAt: new Date().toISOString(),
      window: windowInfo,
      steadyMidSnapshot,
      current: snapshot(),
    }, null, 2) + "\n");
  } catch {}
}

try {
  const pg = require("pg");
  const priorPoolConnect = pg.Pool.prototype.connect;
  const priorClientQuery = pg.Client.prototype.query;

  pg.Pool.prototype.connect = function b1c26ObservePoolConnect(callback) {
    if (typeof callback === "function") {
      return priorPoolConnect.call(this, (error, client, release) => {
        if (client) pooledClients.add(client);
        callback(error, client, release);
      });
    }
    const result = priorPoolConnect.call(this);
    return Promise.resolve(result).then((client) => {
      if (client) pooledClients.add(client);
      return client;
    });
  };

  pg.Client.prototype.query = function b1c26ObserveClientQuery(...args) {
    const text = sqlText(args);
    if (/^\s*LISTEN\s+gracz_global_chat_realtime\b/i.test(text)) {
      listeners.set(this, {
        backendPid: this.processID ?? null,
        pooledAtListen: pooledClients.has(this),
        listenSql: text.trim().slice(0, 160),
        observedAt: new Date().toISOString(),
      });
      write();
    }
    return priorClientQuery.apply(this, args);
  };
} catch (error) {
  console.error("B1-C26 listener observer failed to instrument pg:", error);
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
      steadyStartEpochMs: k6StartEpochMs + warmupMs,
      steadyEndEpochMs: k6StartEpochMs + warmupMs + steadyMs,
    };
    const steadyMidEpochMs = k6StartEpochMs + warmupMs + Math.floor(steadyMs / 2);
    const delay = Math.max(0, steadyMidEpochMs - Date.now());
    setTimeout(() => {
      steadyMidSnapshot = snapshot();
      write();
    }, delay);
  } catch (error) {
    console.error("B1-C26 listener observer could not establish steady window:", error);
  }
});

process.on("exit", write);
