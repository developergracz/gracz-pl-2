import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function run100VuControl() {
  return new Promise((resolveRun, rejectRun) => {
    const runId = "b1-c14-r1-v100";
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
        WAVE_B_BASE_PORT: "3720",
        WAVE_B_SCENARIO: "mixed-platform",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectRun(new Error("B1-C14 100 VU control timeout"));
    }, 690000);
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${chunk}`.slice(-30000); });
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-30000); });
    child.on("error", (error) => { clearTimeout(timer); rejectRun(error); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolveRun({ runId, code, signal: signal || null, stdout, stderr });
    });
  });
}

test("B1-C14 authoritative 100 VU control and STOP gate", { timeout: 720000 }, async () => {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 12000));
  const run = await run100VuControl();
  const record = JSON.parse(await readFile(resolve(`perf/k6/reports/${run.runId}-record.json`), "utf8"));
  const summary = JSON.parse(await readFile(resolve(`perf/k6/reports/${run.runId}-k6-summary-export.json`), "utf8"));
  assert.equal(record.replicas, 1);
  assert.equal(record.vus, 100);
  assert.equal(record.warmupSeconds, 120);
  assert.equal(record.steadySeconds, 300);
  assert.equal(record.cooldownSeconds, 120);
  const counters = Object.fromEntries([
    "wave_b_write_attempts",
    "wave_b_write_accepted",
    "wave_b_checkers_write_accepted",
    "wave_b_gomoku_write_accepted",
    "wave_b_thousand_write_accepted",
  ].map((name) => [name, summary.metrics?.[name]?.count ?? summary.metrics?.[name]?.values?.count ?? null]));
  console.log(JSON.stringify({ marker: "B1_C14_CONTROL_RESULT", runnerExit: run.code, record, counters }));
  throw new Error("B1_C14_CONTROL_COMPLETE_STOP_GATE");
});
