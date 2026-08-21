import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { MemoryAccountService } from "../src/accounts.js";
import { AuthService } from "../src/auth.js";
import { LobbyService } from "../src/lobby.js";
import { createGameHttpServer } from "../src/server.js";
import { MemorySessionStore } from "../src/store.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const store = new MemorySessionStore();
const auth = new AuthService({ secret: "browser-test-secret-with-more-than-32-characters" });
const accounts = new MemoryAccountService();
const lobby = new LobbyService({ sessionStore: store, idGenerator: () => "browser-room" });
const webRoot = fileURLToPath(new URL("../web", import.meta.url));
const server = createGameHttpServer({ store, auth, accounts, lobby, webRoot });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

async function register(page, { userId, displayName, password }) {
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "Nowe konto" }).click();
  await page.locator('[name="userId"]').fill(userId);
  await page.locator('[name="displayName"]').fill(displayName);
  await page.locator('[name="password"]').fill(password);
  await page.locator("#auth-form button[type=submit]").click();
  await page.getByText("Zalogowany jako").waitFor();
}

try {
  const alice = await browser.newContext();
  const alicePage = await alice.newPage();
  await register(alicePage, {
    userId: "alice",
    displayName: "Alicja",
    password: "alice-secret-123",
  });
  await alicePage.locator("#host-seat").click();
  await alicePage.getByText("Szybka gra", { exact: true }).waitFor();

  const bob = await browser.newContext();
  const bobPage = await bob.newPage();
  await register(bobPage, {
    userId: "bob-user",
    displayName: "Robert",
    password: "robert-secret-123",
  });
  await bobPage.locator("#guest-seat").click();
  await bobPage.waitForURL(/\/game\.html\?game=game-browser-room/);
  await bobPage.locator(".square").first().waitFor();
  assert.equal(await bobPage.locator(".square").count(), 64);
  assert.match(await bobPage.locator("#status").textContent(), /Twój ruch|Ruch przeciwnika/);
  console.log("Browser journey passed: register → lobby → room → HTML5 board");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
