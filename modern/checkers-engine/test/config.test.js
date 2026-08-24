import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

test("loadConfig tworzy bezpieczną konfigurację wdrożenia", () => {
  const config = loadConfig({ AUTH_SECRET: "x".repeat(32), PORT: "8080", HOST: "127.0.0.1", DATA_DIR: "state" });
  assert.equal(config.port, 8080);
  assert.equal(config.host, "127.0.0.1");
  assert.match(config.dataDirectory, /state$/);
  assert.equal(Object.isFrozen(config), true);
});

test("loadConfig odrzuca słaby sekret i nieprawidłowy port", () => {
  assert.throws(() => loadConfig({ AUTH_SECRET: "za-krótki" }), /AUTH_SECRET/);
  assert.throws(() => loadConfig({ AUTH_SECRET: "x".repeat(32), PORT: "70000" }), /PORT/);
});
