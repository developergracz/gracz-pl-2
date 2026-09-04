import assert from "node:assert/strict";
import test from "node:test";

import { SessionConcurrencyConflictError } from "../src/postgres-session-store.js";

test("P1-C-01 conflict error exposes stable API contract", () => {
  const error = new SessionConcurrencyConflictError("game-1", 4);
  assert.equal(error.name, "SessionConcurrencyConflictError");
  assert.equal(error.code, "SESSION_CONCURRENCY_CONFLICT");
  assert.equal(error.status, 409);
});
