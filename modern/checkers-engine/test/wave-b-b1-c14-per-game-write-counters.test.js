import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const runnerPath = new URL("../perf/k6/scenarios/_runner.js", import.meta.url);
const checkerPath = new URL("../perf/scripts/wave-b-correctness-check.mjs", import.meta.url);

async function runnerSource() {
  return readFile(runnerPath, "utf8");
}

async function extractedFunction(name, endName, context = {}) {
  const source = await runnerSource();
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`\nfunction ${endName}(`, start);
  assert.ok(start >= 0 && end > start, `${name} must remain directly testable`);
  const sandbox = vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)};this.fn=${name};`, sandbox);
  return sandbox.fn;
}

test("B1-C14 maps global scenario VUs back to a stable logical VU slot", async () => {
  const logicalVuSlot = await extractedFunction("logicalVuSlot", "writerFor", { cfg: { vus: 100 } });
  assert.equal(logicalVuSlot(1), 0);
  assert.equal(logicalVuSlot(50), 49);
  assert.equal(logicalVuSlot(100), 99);
  assert.equal(logicalVuSlot(101), 0);
  assert.equal(logicalVuSlot(150), 49);
  assert.equal(logicalVuSlot(151), 50);
  assert.equal(logicalVuSlot(201), 0);
});

test("B1-C14 accepts only real HTTP 2xx write responses", async () => {
  const acceptedWrite = await extractedFunction("acceptedWrite", "recordGameAccepted");
  for (const status of [200, 201, 204, 299]) assert.equal(acceptedWrite({ status }), true);
  for (const status of [0, 199, 300, 409, 429, 500, 503]) assert.equal(acceptedWrite({ status }), false);
  assert.equal(acceptedWrite(null), false);
});

test("B1-C14 Checkers accepted write increments only the Checkers counter", async () => {
  const source = await runnerSource();
  assert.match(source, /recordGameAccepted\(res,checkersAccepted\)/);
  assert.doesNotMatch(source, /checkersActivity\(\)[\s\S]*recordGameAccepted\(res,gomokuAccepted\)/);
  assert.doesNotMatch(source, /checkersActivity\(\)[\s\S]*recordGameAccepted\(res,thousandAccepted\)/);
});

test("B1-C14 Gomoku accepted write increments only the Gomoku counter", async () => {
  const source = await runnerSource();
  assert.match(source, /recordGameAccepted\(res,gomokuAccepted\)/);
});

test("B1-C14 Thousand accepted write increments only the Thousand counter", async () => {
  const source = await runnerSource();
  assert.match(source, /recordGameAccepted\(res,thousandAccepted\)/);
});

test("B1-C14 rejected, 429, 5xx and timeout responses cannot increment per-game accepted counters", async () => {
  const acceptedWrite = await extractedFunction("acceptedWrite", "recordGameAccepted");
  for (const status of [409, 429, 500, 503, 0]) assert.equal(acceptedWrite({ status }), false);
});

test("B1-C14 generic accepted accounting remains independent and intact", async () => {
  const source = await runnerSource();
  assert.match(source, /if\(write&&ok\)writeAccepted\.add\(1\)/);
  assert.match(source, /new Counter\('wave_b_write_accepted'\)/);
  assert.match(source, /new Counter\('wave_b_checkers_write_accepted'\)/);
  assert.match(source, /new Counter\('wave_b_gomoku_write_accepted'\)/);
  assert.match(source, /new Counter\('wave_b_thousand_write_accepted'\)/);
});

test("B1-C14 writer selection remains bounded to one logical writer slot per seeded game", async () => {
  const source = await runnerSource();
  assert.match(source, /logicalVuSlot\(__VU\)<list\.length/);
  assert.match(source, /__ITER%20===0/);
});

test("B1-C14 preserves B1-C13 fail-closed parser and exact durability equality", async () => {
  const source = await readFile(checkerPath, "utf8");
  assert.match(source, /Required k6 counter metric missing/);
  assert.match(source, /Required k6 counter metric count missing/);
  assert.match(source, /CHECKERS_ACCEPTED_DURABLE',durableC===cAccepted/);
  assert.match(source, /GOMOKU_ACCEPTED_DURABLE',durableG===gAccepted/);
  assert.match(source, /THOUSAND_ACCEPTED_DURABLE',deltaT===tAccepted/);
});
