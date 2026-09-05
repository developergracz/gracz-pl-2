import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PostgresRealtimeHub } from "../src/distributed-infrastructure.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameSession, sendChatMessage } from "../src/session.js";

const databaseUrl = process.env.P1_AUD3_01_DATABASE_URL || "";
const requirePostgres = process.env.P1_AUD3_01_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_AUD3_01_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;

const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
const distributedSource = await readFile(new URL("../src/distributed-infrastructure.js", import.meta.url), "utf8");

test("P1-AUD3-01 runtime evaluates P5 health before the production request limiter composition", () => {
  const health = mainSource.indexOf("handleHealthRequest(request,response,{store})");
  const requestGate = mainSource.indexOf("await enforceRequest(request)");
  assert.ok(health >= 0);
  assert.ok(requestGate > health);
  assert.match(mainSource, /trafficGuard:routedTrafficGuard/);
  assert.match(mainSource, /sharedTrafficGuard:distributedTraffic/);
  assert.match(mainSource, /sharedRequestGuardExternally:true/);
});

test("P1-AUD3-01 outer request errors delegate to the tested production error mapper", () => {
  assert.match(mainSource, /sendProductionRequestError\(response,error\)/);
});

test("P1-AUD3-01 process guard remains first and shared account/credential enforcement follows it", () => {
  assert.match(serverSource, /trafficGuard\.assertAllowed\(request\)[\s\S]*sharedTrafficGuard[\s\S]*assertAllowed\(request\)/);
  assert.match(serverSource, /localGuard\.assertAccountAllowed\(input\)[\s\S]*sharedGuard\.assertAccountAllowed\(input\)/);
  assert.match(serverSource, /localGuard\.assertCredentialAttempt\(input\)[\s\S]*sharedGuard\.assertCredentialAttempt\(input\)/);
  assert.match(serverSource, /localGuard\.assertRegistrationAttempt\(input\)[\s\S]*sharedGuard\.assertRegistrationAttempt\(input\)/);
});

test("P1-AUD3-01 source keeps persistence before realtime publish and publish non-authoritative", () => {
  assert.match(serverSource, /await store\.save\(result\.session\); void realtime\.publish\(result\.session, "game\.updated"\)/);
  assert.match(serverSource, /await store\.save\(session\); void realtime\.publish\(session, "chat\.message"\)/);
  assert.match(distributedSource, /JSON\.stringify\(\{ gameId, type \}\)/);
  assert.match(distributedSource, /SELECT state FROM gracz_game_sessions WHERE game_id = \$1/);
  assert.doesNotMatch(distributedSource, /rejectUnauthorized\s*:\s*false/);
  assert.doesNotMatch(distributedSource, /\bssl\s*:/);
});

pgTest("P1-AUD3-01 realtime failure after persistence leaves authoritative state committed", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const hub = new PostgresRealtimeHub(databaseUrl);
  const gameId = `p6-persist-before-publish-${Date.now()}`;
  try {
    await Promise.all([store.ready, hub.ready]);
    const created = await store.create(createGameSession({ gameId, whitePlayerId: "white-a", blackPlayerId: "black-b" }));
    const updated = sendChatMessage(created, { playerId: "white-a", text: "persisted-before-backplane-failure" });
    const saved = await store.save(updated);

    await hub.close();
    assert.equal(await hub.publish(saved, "chat.message"), false);

    const reread = await store.get(gameId);
    assert.equal(reread.messages.at(-1)?.text, "persisted-before-backplane-failure");
  } finally {
    await hub.close();
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});
