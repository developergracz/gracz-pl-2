import assert from "node:assert/strict";
import test from "node:test";

import { MatchRuntime } from "../src/match-runtime.js";

const repository = {
  async loadMatchRuntime() { throw new Error("must not load"); },
  async claimMatchOwnership() { throw new Error("must not claim"); },
  async executeMatchRuntimeCommand() { throw new Error("must not execute"); },
};

test("P7-F02 MatchRuntime rejects engine without project() and never falls back to raw state", () => {
  assert.throws(
    () => new MatchRuntime({
      repository,
      ownerId: "projection-contract",
      engine: {
        applyCommand({ state }) { return state; },
      },
    }),
    (error) => error instanceof TypeError && /project\(\)/.test(error.message),
  );
});
