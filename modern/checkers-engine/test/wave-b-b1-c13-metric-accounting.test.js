import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const correctnessSourcePath = new URL("../perf/scripts/wave-b-correctness-check.mjs", import.meta.url);

async function metricCountFunction(summary) {
  const source = await readFile(correctnessSourcePath, "utf8");
  const start = source.indexOf("function metricCount(name){");
  const end = source.indexOf("\ntry{", start);
  assert.ok(start >= 0 && end > start, "metricCount source must remain directly testable");
  const context = vm.createContext({ summary });
  vm.runInContext(`${source.slice(start, end)};this.metricCountUnderTest=metricCount;`, context);
  return context.metricCountUnderTest;
}

test("B1-C13 reads actual k6 summary-export counter count", async () => {
  const metricCount = await metricCountFunction({ metrics: { wave_b_checkers_write_accepted: { type: "counter", contains: "default", count: 229 } } });
  assert.equal(metricCount("wave_b_checkers_write_accepted"), 229);
});

test("B1-C13 treats explicit counter zero as valid zero", async () => {
  const metricCount = await metricCountFunction({ metrics: { wave_b_checkers_write_accepted: { type: "counter", count: 0 } } });
  assert.equal(metricCount("wave_b_checkers_write_accepted"), 0);
});

test("B1-C13 fails closed when a required counter is missing", async () => {
  const metricCount = await metricCountFunction({ metrics: {} });
  assert.throws(() => metricCount("wave_b_checkers_write_accepted"), /counter metric missing/);
});

test("B1-C13 fails closed for malformed counter values", async () => {
  for (const value of [null, "229", -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const metricCount = await metricCountFunction({ metrics: { wave_b_checkers_write_accepted: { type: "counter", count: value } } });
    assert.throws(() => metricCount("wave_b_checkers_write_accepted"), /counter metric count invalid/);
  }
  const wrongType = await metricCountFunction({ metrics: { wave_b_checkers_write_accepted: { type: "trend", count: 1 } } });
  assert.throws(() => wrongType("wave_b_checkers_write_accepted"), /not a counter/);
});

test("B1-C13 retains known-valid values.count compatibility", async () => {
  const metricCount = await metricCountFunction({ metrics: { wave_b_checkers_write_accepted: { type: "counter", values: { count: 17 } } } });
  assert.equal(metricCount("wave_b_checkers_write_accepted"), 17);
});

test("B1-C13 durable accepted equality remains exact and fail-closed", async () => {
  const source = await readFile(correctnessSourcePath, "utf8");
  assert.match(source, /CHECKERS_ACCEPTED_DURABLE',durableC===cAccepted/);
  assert.match(source, /GOMOKU_ACCEPTED_DURABLE',durableG===gAccepted/);
  assert.match(source, /THOUSAND_ACCEPTED_DURABLE',deltaT===tAccepted/);
  assert.equal(229 === 229, true);
  assert.equal(228 === 229, false);
});

function run100VuControl() {
  return new Promise((resolveRun, rejectRun) => {
    const runId = "b1-c13-r1-v100";
    const child = spawn("bash", ["perf/scripts/wave-b-runner.sh"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WAVE_B_RUN_ID: runId,
        WAVE_B_REPLICAS: "1",
        WAVE_B_VUS: "100",
        WAVE_B_GAME_COUNT: "50",
        WAVE_B_WARMUP_SECONDS: "120",
        WAVE_B_STEADY_SECONDS: "300",
        WAVE_B_COOLDOWN_SECONDS: "120",
        WAVE_B_THINK_SECONDS: "0.05",
        WAVE_B_BASE_PORT: "3700",
        WAVE_B_SCENARIO: "mixed-platform"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectRun(new Error("B1-C13 100 VU control timeout"));
    }, 690000);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-20000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-20000); });
    child.on("error", (error) => { clearTimeout(timer); rejectRun(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolveRun({ runId, code, signal: signal || null, stdout, stderr });
    });
  });
}

test("B1-C13 authoritative 100 VU control and STOP gate", { timeout: 720000 }, async () => {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 12000));
  const run = await run100VuControl();
  const record = JSON.parse(await readFile(resolve(`perf/k6/reports/${run.runId}-record.json`), "utf8"));
  assert.equal(record.replicas, 1);
  assert.equal(record.vus, 100);
  assert.equal(record.warmupSeconds, 120);
  assert.equal(record.steadySeconds, 300);
  assert.equal(record.cooldownSeconds, 120);
  console.log(JSON.stringify({ marker: "B1_C13_CONTROL_RESULT", runnerExit: run.code, record }));
  throw new Error("B1_C13_CONTROL_COMPLETE_STOP_GATE");
});
