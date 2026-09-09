import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

function run(command, args, { env = {}, timeoutMs = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      settled = true;
      reject(new Error(`command timed out: ${command} ${args.join(" ")}\n${stderr.slice(-12000)}`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-200000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-200000); });
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
      resolve({ code, signal, stdout, stderr });
    });
  });
}

function inBenchmarkRange(ip) {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)
    && parts.slice(2).every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
}

test("B3-C01 maps representative SSE client indexes deterministically inside 198.18.0.0/15", async () => {
  const indexes = [0, 1, 99, 499, 999, 9999];
  const probe = indexes.join(",");
  const first = await run(process.execPath, ["perf/scripts/wave-b-sse-load.mjs"], { env: { WAVE_B_SSE_IDENTITY_PROBE: probe } });
  const second = await run(process.execPath, ["perf/scripts/wave-b-sse-load.mjs"], { env: { WAVE_B_SSE_IDENTITY_PROBE: probe } });
  assert.equal(first.code, 0, first.stderr);
  assert.equal(second.code, 0, second.stderr);
  assert.equal(first.stdout.trim(), second.stdout.trim());
  const rows = JSON.parse(first.stdout);
  assert.deepEqual(rows.map((row) => row.index), indexes);
  assert.equal(new Set(rows.map((row) => row.ip)).size, indexes.length);
  assert.ok(rows.every((row) => inBenchmarkRange(row.ip)));
  assert.deepEqual(rows, [
    { index: 0, ip: "198.18.0.1" },
    { index: 1, ip: "198.18.0.2" },
    { index: 99, ip: "198.18.0.100" },
    { index: 499, ip: "198.18.1.244" },
    { index: 999, ip: "198.18.3.232" },
    { index: 9999, ip: "198.18.39.16" },
  ]);
});

test("B3-C01 SSE runner keeps proxy trust benchmark-local and uses canonical startup", async () => {
  const source = await readFile(new URL("../perf/scripts/wave-b-sse-runner.sh", import.meta.url), "utf8");
  assert.match(source, /NODE_ENV=test TRUST_PROXY_HEADERS=true WAVE_B_OBS_FILE=/);
  assert.match(source, /--require \.\/perf\/scripts\/wave-b-observability-preload\.cjs --require \.\/src\/pg-secure-preload\.cjs src\/start\.js/);
  assert.doesNotMatch(source, /src\/main\.js/);
  assert.doesNotMatch(source, /export\s+TRUST_PROXY_HEADERS/);
});

test("B3-C01 focused 500 SSE establishment control and STOP gate", { skip: process.env.GITHUB_ACTIONS !== "true", timeout: 240_000 }, async () => {
  const runId = `b3-c01-control-500-${process.env.GITHUB_RUN_ID || Date.now()}`;
  const result = await run("bash", ["perf/scripts/wave-b-sse-runner.sh"], {
    env: {
      WAVE_B_REPLICAS: "1",
      WAVE_B_SSE_CONNECTIONS: "500",
      WAVE_B_SSE_SECONDS: "30",
      WAVE_B_RUN_ID: runId,
      WAVE_B_BASE_PORT: "3900",
    },
    timeoutMs: 220_000,
  });
  const reportPath = `perf/k6/reports/${runId}-sse.json`;
  const recordPath = `perf/k6/reports/${runId}-record.json`;
  const metrics = JSON.parse(await readFile(reportPath, "utf8"));
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  const control = {
    runId,
    runnerExit: result.code,
    signal: result.signal || null,
    requestedConnections: 500,
    successfulConnections: metrics.successfulConnections,
    failedConnections: metrics.failedConnections,
    maxActive: metrics.maxActive,
    http429Responses: metrics.http429Responses,
    httpStatusCounts: metrics.httpStatusCounts,
    establishment: metrics.establishment,
    record,
  };
  await writeFile(`perf/k6/reports/${runId}-control-gate.json`, JSON.stringify(control, null, 2));

  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(record.sseExit, 0);
  assert.equal(record.pgSamplerExit, 0);
  assert.equal(record.appSamplerExit, 0);
  assert.equal(metrics.http429Responses, 0, JSON.stringify(control));
  assert.ok(metrics.successfulConnections >= 475, JSON.stringify(control));
  assert.ok(metrics.maxActive >= 475, JSON.stringify(control));

  throw new Error("B3_C01_CONTROL_COMPLETE_STOP_GATE");
});
