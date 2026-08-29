import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const webUrl = new URL("../web/", import.meta.url);

test("newsletter exposes the existing secure account registration flow", async () => {
  const [html, newsletterScript, accountScript] = await Promise.all([
    readFile(new URL("coming-soon.html", webUrl), "utf8"),
    readFile(new URL("coming-soon.js", webUrl), "utf8"),
    readFile(new URL("auth-cookie-migration.js", webUrl), "utf8"),
  ]);

  assert.match(html, /href="\/lobby\.html#register"/);
  assert.match(html, /UTWÓRZ KONTO GRACZA/);
  assert.match(newsletterScript, /location\.assign\('\/lobby\.html#register'\)/);
  assert.match(accountScript, /location\.hash !== "#register"/);
  assert.match(accountScript, /registerTab\.click\(\)/);
});

test("newsletter request remains separate from account credentials", async () => {
  const newsletterScript = await readFile(new URL("coming-soon.js", webUrl), "utf8");

  assert.doesNotMatch(newsletterScript, /password|recoveryEmail|verificationCode/);
  assert.match(newsletterScript, /fetch\('\/newsletter\/subscribe'/);
});

test("production entry point serves every expanded registration module", async () => {
  const mainScript = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.match(mainScript, /"\/auth-cookie-migration\.js":"auth-cookie-migration\.js"/);
  assert.match(mainScript, /"\/adaptive-challenge\.js":"adaptive-challenge\.js"/);
  assert.match(mainScript, /<script src="\/auth-cookie-migration\.js" defer><\/script>/);
  assert.match(mainScript, /<script src="\/adaptive-challenge\.js" defer><\/script>/);
});
