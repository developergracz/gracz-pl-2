import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P1-AUD3-07 main runtime wires the health handler before application routes", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /import \{ handleHealthRequest \} from "\.\/health\.js";/);
  assert.match(main, /if\(await handleHealthRequest\(request,response,\{store\}\)\)return;/);
});
