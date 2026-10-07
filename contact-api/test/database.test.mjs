import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createDatabase } from "../persistence/database.mjs";

test("PostgreSQL idle pool errors are handled without an unhandled EventEmitter crash", async () => {
  let poolInstance = null;
  const logs = [];

  class FakePool extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.ended = false;
      poolInstance = this;
    }

    async query() {
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }

    async end() {
      this.ended = true;
    }
  }

  const database = createDatabase({
    connectionString: "postgres://test:test@127.0.0.1:5432/gracz",
    poolFactory: FakePool,
    logger: {
      error(message, details) {
        logs.push({ message, details });
      },
    },
  });

  await database.ping();

  assert.ok(poolInstance);
  assert.equal(poolInstance.listenerCount("error"), 1);

  const poolError = Object.assign(new Error("terminating connection"), {
    code: "57P01",
  });

  assert.doesNotThrow(() => {
    poolInstance.emit("error", poolError);
  });

  assert.deepEqual(logs, [
    {
      message: "gracz.pl PostgreSQL pool error",
      details: {
        code: "57P01",
        message: "terminating connection",
      },
    },
  ]);

  await database.close();
  assert.equal(poolInstance.ended, true);
});
