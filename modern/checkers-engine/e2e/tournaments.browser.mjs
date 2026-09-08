import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { TournamentService } from "../src/tournaments.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const webRoot = fileURLToPath(new URL("../web", import.meta.url));
const user = { userId:"p8-owner", displayName:"P8 Owner" };
const tournaments = new TournamentService(null);

await tournaments.create(user, { title:"P8 Checkers Browser", game:"checkers" });
await tournaments.create(user, { title:"P8 Thousand Browser", game:"thousand" });
tournaments.memory.set("a8f00000-0000-4000-8000-000000000099", {
  tournament: {
    tournamentId:"a8f00000-0000-4000-8000-000000000099",
    ownerId:user.userId,
    ownerName:user.displayName,
    title:"P8 Historical Chess Browser",
    description:"",
    game:"szachy",
    format:"swiss",
    status:"registration",
    visibility:"public",
    maxPlayers:16,
    rounds:5,
    timeControl:"5+0",
    rated:true,
    startsAt:null,
    currentRound:0,
    createdAt:new Date(0).toISOString(),
    finishedAt:null,
  },
  players:[],
  matches:[],
});

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/auth/me") return json(response, 200, { user });
    if (request.method === "GET" && url.pathname === "/tournaments") return json(response, 200, { tournaments:await tournaments.list(user, Object.fromEntries(url.searchParams)) });
    if (request.method === "POST" && url.pathname === "/tournaments") return json(response, 201, { tournament:await tournaments.create(user, await readJson(request)) });
    const detail = url.pathname.match(/^\/tournaments\/([0-9a-f-]{36})$/i);
    if (request.method === "GET" && detail) return json(response, 200, await tournaments.detail(user, detail[1]));
    const asset = ({
      "/tournaments.html":"tournaments.html",
      "/tournaments.js":"tournaments.js",
      "/tournaments.css":"tournaments.css",
    })[url.pathname];
    if (request.method === "GET" && asset) return staticFile(response, asset);
    return json(response, 404, { error:{ message:"Not found" } });
  } catch (error) {
    return json(response, error.status || 500, { error:{ code:error.code || "E2E_ERROR", message:error.message || "E2E error" } });
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless:true });

async function createViaUi(page, game, title) {
  await page.locator("#create-tournament").click();
  await page.locator("#ct-title").fill(title);
  await page.locator("#ct-game").selectOption(game);
  await page.locator("#create-submit").click();
  await page.locator("#detail-dialog").waitFor({ state:"visible" });
  await page.locator("#detail-dialog [data-close]").click();
  await page.locator("#detail-dialog").waitFor({ state:"hidden" });
}

try {
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.goto(`${baseUrl}/tournaments.html`);
  await page.locator("#tournament-list .t-card").first().waitFor();

  const filterValues = await page.locator("#game-filter option").evaluateAll((options) => options.map((option) => option.value));
  const createValues = await page.locator("#ct-game option").evaluateAll((options) => options.map((option) => option.value));
  assert.deepEqual(filterValues, ["all", "checkers", "gomoku", "thousand"]);
  assert.deepEqual(createValues, ["checkers", "gomoku", "thousand"]);
  assert.equal(filterValues.includes("warcaby"), false);
  assert.equal(filterValues.includes("szachy"), false);
  assert.equal(createValues.includes("szachy"), false);

  const initialCards = await page.locator("#tournament-list .t-card").evaluateAll((cards) => cards.map((card) => card.textContent));
  assert.ok(initialCards.some((text) => text.includes("P8 Checkers Browser") && text.includes("Warcaby")));
  assert.ok(initialCards.some((text) => text.includes("P8 Thousand Browser") && text.includes("Tysiąc")));
  assert.ok(initialCards.some((text) => text.includes("P8 Historical Chess Browser") && text.includes("historyczne")));

  await page.locator("#game-filter").selectOption("checkers");
  await page.waitForFunction(() => document.querySelectorAll("#tournament-list .t-card").length === 1);
  assert.match(await page.locator("#tournament-list .t-card").textContent(), /P8 Checkers Browser/);
  await page.locator("#game-filter").selectOption("all");

  await createViaUi(page, "checkers", "P8 Created Checkers Browser");
  await createViaUi(page, "thousand", "P8 Created Thousand Browser");

  const created = await tournaments.list(user, {});
  assert.equal(created.find((item) => item.title === "P8 Created Checkers Browser")?.game, "checkers");
  assert.equal(created.find((item) => item.title === "P8 Created Thousand Browser")?.game, "thousand");
  assert.deepEqual(browserErrors, []);
  console.log("Tournament browser contract passed: canonical filter/create/render + legacy unsupported read");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await tournaments.close();
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function staticFile(response, file) {
  const extension = file.split(".").at(-1);
  const type = ({ html:"text/html", js:"text/javascript", css:"text/css" })[extension] || "application/octet-stream";
  const content = await readFile(join(webRoot, file));
  response.writeHead(200, { "content-type":`${type}; charset=utf-8`, "cache-control":"no-store" });
  response.end(content);
}

function json(response, status, body) {
  response.writeHead(status, { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" });
  response.end(JSON.stringify(body));
}
