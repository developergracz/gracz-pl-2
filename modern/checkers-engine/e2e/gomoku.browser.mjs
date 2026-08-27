import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { AuthService } from "../src/auth.js";
import { createGomokuHttpHandler } from "../src/gomoku-http.js";
import { GomokuService } from "../src/gomoku-service.js";
import { LobbyService } from "../src/lobby.js";
import { createGameHttpServer } from "../src/server.js";
import { MemorySessionStore } from "../src/store.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const store = new MemorySessionStore();
const auth = new AuthService({ secret: "gomoku-browser-test-secret-with-more-than-32-characters" });
const gomoku = new GomokuService();
const lobby = new LobbyService({ sessionStore: store, gomokuService: gomoku, idGenerator: () => "browser-gomoku-room" });
const webRoot = fileURLToPath(new URL("../web", import.meta.url));
const server = createGameHttpServer({ store, auth, lobby, webRoot });
const gomokuHandler = createGomokuHttpHandler({ service: gomoku, auth });
const baseHandler = server.listeners("request")[0];
server.removeAllListeners("request");
server.on("request", async (request, response) => {
  if (await gomokuHandler(request, response)) return;
  return baseHandler(request, response);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

async function enterAs(page, userId, displayName) {
  const token = auth.issue({ userId, displayName });
  await page.goto(`${baseUrl}/gomoku-players.html`);
  await page.evaluate((session) => sessionStorage.setItem("gracz-session", JSON.stringify(session)), { token, user: { userId, displayName } });
  await page.reload();
  await page.getByRole("button", { name: /UTWÓRZ STÓŁ GOMOKU/ }).waitFor({ state: "visible" });
}

try {
  const chooserContext = await browser.newContext();
  const chooserPage = await chooserContext.newPage();
  await chooserPage.goto(`${baseUrl}/lobby.html`);
  await chooserPage.evaluate((session) => sessionStorage.setItem("gracz-session", JSON.stringify(session)), {
    token: auth.issue({ userId: "chooser", displayName: "Tester" }),
    user: { userId: "chooser", displayName: "Tester" },
  });
  await chooserPage.reload();
  await chooserPage.locator("#open-gomoku-mode").click();
  await chooserPage.getByRole("dialog", { name: "Jak chcesz zagrać w Gomoku?" }).waitFor({ state: "visible" });
  assert.equal(await chooserPage.getByRole("link", { name: /WERSJA LOKALNA/ }).getAttribute("href"), "/gomoku.html?mode=local");
  assert.equal(await chooserPage.getByRole("link", { name: /GRA ONLINE/ }).getAttribute("href"), "/gomoku-players.html");
  await chooserContext.close();

  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();
  await enterAs(alicePage, "alice", "Alicja");
  await alicePage.getByRole("button", { name: /UTWÓRZ STÓŁ GOMOKU/ }).click();
  await alicePage.getByText("Oczekuje na drugiego gracza").waitFor({ state: "visible" });

  await enterAs(bobPage, "bob", "Robert");
  await bobPage.getByRole("button", { name: "DOŁĄCZ" }).click();
  await bobPage.waitForURL(/\/gomoku\.html\?game=gomoku-browser-gomoku-room/);
  await alicePage.waitForURL(/\/gomoku\.html\?game=gomoku-browser-gomoku-room/);
  assert.equal(await bobPage.locator("#board .cell").count(), 225);
  assert.equal(await alicePage.locator("#board .cell").count(), 225);

  const moves = [[alicePage, 7, 0], [bobPage, 8, 0], [alicePage, 7, 1], [bobPage, 8, 1], [alicePage, 7, 2], [bobPage, 8, 2], [alicePage, 7, 3], [bobPage, 8, 3], [alicePage, 7, 4]];
  for (const [index, [page, row, column]] of moves.entries()) {
    const cell = page.locator(`.cell[data-row="${row}"][data-column="${column}"]`);
    await cell.waitFor({ state: "visible" });
    await cell.click();
    await page.locator("#moves").waitFor({ state: "visible" });
    await page.waitForFunction((expected) => Number(document.querySelector("#moves")?.textContent) >= expected, index + 1);
  }
  await alicePage.getByText("Wygrały czarne!", { exact: true }).waitFor({ state: "visible" });
  await bobPage.getByText("Wygrały czarne!", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
  assert.equal(await alicePage.locator(".stone").count(), 9);
  assert.equal(await bobPage.locator(".stone").count(), 9);
  console.log("Gomoku browser journey passed: chooser → table → two players → synchronized win");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
