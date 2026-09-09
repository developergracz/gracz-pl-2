import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const databaseUrl = process.env.WAVE_B_TEST_DATABASE_URL || null;
function runNode(args, env = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, { cwd: resolve("."), env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", rejectRun);
    child.once("close", (code, signal) => resolveRun({ code, signal, stdout, stderr }));
  });
}

test("B1-C15 preload measures pool acquire/query timing without changing query semantics", { skip: !databaseUrl, timeout: 10_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "gracz-b1-c15-"));
  const obs = join(dir, "obs.jsonl");
  const script = `
    const pg=require("pg");
    const pool=new pg.Pool({connectionString:process.env.WAVE_B_TEST_DATABASE_URL,max:2});
    (async()=>{
      const client=await pool.connect();
      const first=await client.query("SELECT pg_sleep(0.025), 42::int AS answer");
      if(Number(first.rows[0].answer)!==42) process.exitCode=11;
      client.release();
      const second=await pool.query("SELECT 7::int AS answer");
      if(Number(second.rows[0].answer)!==7) process.exitCode=12;
      console.error("Application request error:",{code:"SHARED_INFRASTRUCTURE_UNAVAILABLE"});
      await new Promise(resolve=>setTimeout(resolve,1250));
      await pool.end();
    })().catch(error=>{console.error(error);process.exitCode=13});
  `;
  try {
    const result = await runNode(["--require", "./perf/scripts/wave-b-observability-preload.cjs", "-e", script], { WAVE_B_OBS_FILE: obs, WAVE_B_TEST_DATABASE_URL: databaseUrl });
    assert.equal(result.code, 0, result.stderr);
    const rows = (await readFile(obs, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    assert.ok(rows.length >= 1);
    const final = rows.at(-1);
    assert.equal(final.requestErrorCodes.SHARED_INFRASTRUCTURE_UNAVAILABLE, 1);
    const pool = final.pools.find((item) => item.configuredMax === 2);
    assert.ok(pool, "instrumented pool snapshot missing");
    assert.ok(pool.acquire.count >= 2);
    assert.ok(pool.query.count >= 2);
    assert.ok(pool.query.p95Ms >= 20, `expected pg_sleep timing, got ${pool.query.p95Ms}`);
    assert.equal(pool.acquire.errors, 0);
    assert.equal(pool.query.errors, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("B1-C15 diagnostics are benchmark-only and do not tune production limits", async () => {
  const [preload, runner, postgres] = await Promise.all([
    readFile("perf/scripts/wave-b-observability-preload.cjs", "utf8"),
    readFile("perf/scripts/wave-b-runner.sh", "utf8"),
    readFile("perf/scripts/wave-b-postgres-sample.sh", "utf8"),
  ]);
  assert.match(preload, /Pool\.prototype\.connect/);
  assert.match(preload, /Client\.prototype\.query/);
  assert.doesNotMatch(preload, /connectionTimeoutMillis\s*=/);
  assert.doesNotMatch(preload, /\.options\.max\s*=/);
  assert.match(runner, /wave-b-host-sample\.sh/);
  assert.match(postgres, /wait_event_type='Client'/);
  assert.match(postgres, /wait_event_type='Lock'/);
});
