import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RandomSource,
  RandomSourceError,
  createFullDeck,
  nextBoundedInt,
} from "../src/index.js";

class SeededTestRandomSource {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  nextInt(maxExclusive) {
    // Test-only deterministic xorshift32. This is NOT a production CSPRNG.
    let x = this.state || 0x6d2b79f5;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state % maxExclusive;
  }
}

test("RandomSource base boundary fails until infrastructure implements nextInt", () => {
  assert.throws(() => new RandomSource().nextInt(10), (error) => error instanceof RandomSourceError && error.code === "POKER_RANDOM_SOURCE_NOT_IMPLEMENTED");
});

test("same deterministic seed gives identical shuffle", () => {
  const first = createFullDeck().shuffle(new SeededTestRandomSource(12345)).codes;
  const second = createFullDeck().shuffle(new SeededTestRandomSource(12345)).codes;
  assert.deepEqual(first, second);
});

test("different deterministic sources give different shuffle order", () => {
  const first = createFullDeck().shuffle(new SeededTestRandomSource(1)).codes;
  const second = createFullDeck().shuffle(new SeededTestRandomSource(2)).codes;
  assert.notDeepEqual(first, second);
});

test("production domain contains no Math.random()", async () => {
  const paths = [
    new URL("../src/domain/card.js", import.meta.url),
    new URL("../src/domain/deck.js", import.meta.url),
    new URL("../src/domain/random-source.js", import.meta.url),
    new URL("../src/index.js", import.meta.url),
  ];
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.equal(source.includes("Math.random("), false, `${path.pathname} must not call Math.random()`);
  }
});

test("malformed RandomSource negative/out-of-range values are rejected", () => {
  for (const value of [-1, 10]) {
    assert.throws(
      () => nextBoundedInt({ nextInt: () => value }, 10),
      (error) => error instanceof RandomSourceError && error.code === "POKER_RANDOM_VALUE_OUT_OF_RANGE",
    );
  }
});

test("malformed RandomSource non-integer values are rejected", () => {
  for (const value of [1.5, Number.NaN, Infinity, "1", null]) {
    assert.throws(
      () => nextBoundedInt({ nextInt: () => value }, 10),
      (error) => error instanceof RandomSourceError && error.code === "POKER_RANDOM_VALUE_OUT_OF_RANGE",
    );
  }
});
