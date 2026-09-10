"use strict";

const fs = require("node:fs");
const path = require("node:path");

const runId = String(process.env.WAVE_B_RUN_ID || "b1-c23-r1-v100");
const obsPath = process.env.WAVE_B_OBS_FILE || "";
const reportDir = obsPath ? path.dirname(obsPath) : path.resolve("perf/k6/reports");
const outputPath = path.join(reportDir, `${runId}-b1-c23-listener-events.jsonl`);

function append(event) {
  try {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.appendFileSync(outputPath, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
  } catch {}
}

try {
  const pg = require("pg");
  const pooledClients = new WeakSet();
  const originalPoolConnect = pg.Pool.prototype.connect;
  const originalClientQuery = pg.Client.prototype.query;
  const originalClientEnd = pg.Client.prototype.end;

  pg.Pool.prototype.connect = function b1c23PoolConnect(callback) {
    if (typeof callback === "function") {
      return originalPoolConnect.call(this, (error, client, release) => {
        if (client) pooledClients.add(client);
        callback(error, client, release);
      });
    }
    let result;
    try { result = originalPoolConnect.call(this); } catch (error) { throw error; }
    return Promise.resolve(result).then((client) => {
      if (client) pooledClients.add(client);
      return client;
    });
  };

  pg.Client.prototype.query = function b1c23ClientQuery(...args) {
    const first = args[0];
    const text = typeof first === "string" ? first : (first && typeof first === "object" ? String(first.text || "") : "");
    const isGlobalChatListen = /^\s*LISTEN\s+gracz_global_chat_realtime\b/i.test(text);
    let result;
    try { result = originalClientQuery.apply(this, args); } catch (error) { throw error; }
    if (!isGlobalChatListen) return result;
    const recordReady = () => append({
      type: "listen_ready",
      backendPid: this.processID ?? null,
      pooled: pooledClients.has(this),
      listenSql: text.trim().slice(0, 160),
    });
    if (result && typeof result.then === "function") {
      return result.then((value) => { recordReady(); return value; });
    }
    recordReady();
    return result;
  };

  pg.Client.prototype.end = function b1c23ClientEnd(...args) {
    if (this.processID) append({ type: "client_end", backendPid: this.processID, pooled: pooledClients.has(this) });
    return originalClientEnd.apply(this, args);
  };
} catch (error) {
  append({ type: "observer_error", name: String(error?.name || "Error"), code: String(error?.code || "") });
}
