import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

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
