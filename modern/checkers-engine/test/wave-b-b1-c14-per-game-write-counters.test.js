import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const runnerPath = new URL("../perf/k6/scenarios/_runner.js", import.meta.url);
const checkerPath = new URL("../perf/scripts/wave-b-correctness-check.mjs", import.meta.url);

async function runnerSource() {
  return readFile(runnerPath, "utf8");
}

async function functionSlice(name, endName) {
  const source = await runnerSource();
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`\nfunction ${endName}(`, start);
  assert.ok(start >= 0 && end > start, `${name} must remain directly testable`);
  return source.slice(start, end);
}

async function extractedFunction(name, endName, context = {}) {
  const source = await functionSlice(name, endName);
  const sandbox = vm.createContext(context);
  vm.runInContext(`${source};this.fn=${name};`, sandbox);
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

test("B1-C14 recordGameAccepted increments only the supplied game counter", async () => {
  const acceptedWrite = (res) => Boolean(res && res.status >= 200 && res.status < 300);
  const recordGameAccepted = await extractedFunction("recordGameAccepted", "recordCheckersAccepted", { acceptedWrite });
  const checkers = { count: 0, add(n) { this.count += n; } };
  const gomoku = { count: 0, add(n) { this.count += n; } };
  recordGameAccepted({ status: 200 }, checkers);
  assert.equal(checkers.count, 1);
  assert.equal(gomoku.count, 0);
  for (const status of [409, 429, 500, 503, 0]) recordGameAccepted({ status }, checkers);
  assert.equal(checkers.count, 1);
});

test("B1-C14 Checkers accepted counter increments only for newly applied 2xx mutations", async () => {
  const acceptedWrite = (res) => Boolean(res && res.status >= 200 && res.status < 300);
  const payload = (res) => res.body;
  const checkersAccepted = { count: 0, add(n) { this.count += n; } };
  const recordCheckersAccepted = await extractedFunction("recordCheckersAccepted", "httpBaseline", { acceptedWrite, payload, checkersAccepted });
  recordCheckersAccepted({ status: 200, body: { duplicate: false } });
  assert.equal(checkersAccepted.count, 1);
  recordCheckersAccepted({ status: 200, body: { duplicate: true } });
  recordCheckersAccepted({ status: 200, body: {} });
  recordCheckersAccepted({ status: 409, body: { duplicate: false } });
  assert.equal(checkersAccepted.count, 1);
});

test("B1-C14 Checkers write path uses only the Checkers new-mutation accepted counter", async () => {
  const source = await functionSlice("checkersActivity", "gomokuActivity");
  assert.match(source, /recordCheckersAccepted\(res\)/);
  assert.doesNotMatch(source, /recordGameAccepted\(res,checkersAccepted\)/);
  assert.doesNotMatch(source, /gomokuAccepted|thousandAccepted/);
});

test("B1-C14 Gomoku write path uses only the Gomoku accepted counter", async () => {
  const source = await functionSlice("gomokuActivity", "thousandActivity");
  assert.match(source, /recordGameAccepted\(res,gomokuAccepted\)/);
  assert.doesNotMatch(source, /checkersAccepted|thousandAccepted/);
});

test("B1-C14 Thousand write path uses only the Thousand accepted counter", async () => {
  const source = await functionSlice("thousandActivity", "globalChat");
  assert.match(source, /recordGameAccepted\(res,thousandAccepted\)/);
  assert.doesNotMatch(source, /checkersAccepted|gomokuAccepted/);
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
  const source = await functionSlice("writerFor", "acceptedWrite");
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