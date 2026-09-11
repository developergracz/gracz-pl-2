import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import { DistributedGlobalChatService } from "../src/distributed-global-chat.js";
import { LobbyService } from "../src/lobby.js";
import { PostgresCommunityPool } from "../src/postgres-community-pool.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";

const { Client } = pg;
const databaseUrl = process.env.P1_C_01_DATABASE_URL || process.env.DATABASE_URL || "";
const pgTest = databaseUrl ? test : test.skip;

function memoryGameDependency() {
  return { async createGame() { throw new Error("not used by C38 ownership tests"); } };
}

test("B1-C38 production composition wires exactly one Community owner and keeps SessionStore separate", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const communitySource = await readFile(new URL("../src/postgres-community-pool.js", import.meta.url), "utf8");
  const chatSource = await readFile(new URL("../src/distributed-global-chat.js", import.meta.url), "utf8");

  assert.equal((main.match(/new PostgresCommunityPool\(config\.databaseUrl\)/g) || []).length, 1);
  assert.match(main, /new DistributedGlobalChatService\(\{pool:community\.pool,logger:/);
  assert.match(main, /new LobbyService\(\{sessionStore:store,thousandService,gomokuService,pool:config\.databaseUrl\?community\.pool:null\}\)/);
  assert.doesNotMatch(main, /new DistributedGlobalChatService\(\{pool:store\.pool/);
  assert.doesNotMatch(main, /new LobbyService\([^\n]*pool:config\.databaseUrl\?store\.pool:null/);

  assert.match(communitySource, /export class PostgresCommunityPool/);
  assert.match(communitySource, /this\.pool = new Pool\(\{/);
  assert.match(communitySource, /\bmax:\s*4\b/);
  assert.match(communitySource, /idleTimeoutMillis:\s*30_000/);
  assert.match(communitySource, /connectionTimeoutMillis:\s*10_000/);
  assert.doesNotMatch(communitySource, /CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX/i);

  assert.match(chatSource, /client=this\.#listenerClientFactory\(\)/);
  assert.match(chatSource, /await client\.connect\(\)/);
  assert.match(chatSource, /LISTEN \$\{REALTIME_CHANNEL\}/);
  assert.doesNotMatch(chatSource.slice(chatSource.indexOf("async #openListener()"), chatSource.indexOf("#listenerLost")), /this\.pool\.connect\(\)/);

  const globalClose = main.indexOf("await globalChat.close()");
  const lobbyClose = main.indexOf('if(typeof lobby.close==="function")await lobby.close()');
  const communityClose = main.indexOf("if(community)await community.close()");
  const sessionClose = main.indexOf('if(typeof store.close==="function")await store.close()');
  assert.ok(globalClose >= 0 && lobbyClose > globalClose && communityClose > lobbyClose && sessionClose > communityClose);
});

test("B1-C38 owner validates connection string without creating schema", () => {
  assert.throws(() => new PostgresCommunityPool(""), /DATABASE_URL/);
  assert.throws(() => new PostgresCommunityPool("   "), /DATABASE_URL/);
});

pgTest("B1-C38 Lobby and GlobalChat borrow Community while SessionStore retains its own max=4 pool", { timeout: 20_000 }, async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const community = new PostgresCommunityPool(databaseUrl);
  let chat;
  try {
    await store.ready;
    const lobby = new LobbyService({
      sessionStore: store,
      thousandService: memoryGameDependency(),
      gomokuService: memoryGameDependency(),
      pool: community.pool,
    });
    await lobby.ready;
    chat = new DistributedGlobalChatService({ pool: community.pool });
    await chat.ready;

    assert.equal(store.pool.options.max, 4);
    assert.equal(community.pool.options.max, 4);
    assert.notEqual(community.pool, store.pool);

    assert.equal(lobby.pool, community.pool);
    assert.notEqual(lobby.pool, store.pool);
    assert.equal(chat.pool, community.pool);
    assert.notEqual(chat.pool, store.pool);

    assert.ok(Number.isInteger(chat.listenerBackendPid) && chat.listenerBackendPid > 0);
    assert.equal(
      community.pool.totalCount - community.pool.idleCount,
      0,
      "dedicated GlobalChat LISTEN must not occupy a checked-out Community pool client after readiness",
    );

    const control = new Client({ connectionString: databaseUrl });
    await control.connect();
    try {
      const { rows } = await control.query(
        "SELECT state,wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [chat.listenerBackendPid],
      );
      assert.equal(rows.length, 1, "dedicated listener backend must exist outside Community pool checkout");
    } finally {
      await control.end();
    }

    let endCalls = 0;
    const originalEnd = community.pool.end.bind(community.pool);
    community.pool.end = (...args) => {
      endCalls += 1;
      return originalEnd(...args);
    };

    await chat.close();
    chat = null;
    await lobby.close();
    assert.equal(endCalls, 0, "borrowers must not end Community pool");

    const communityUsable = await community.pool.query("SELECT 1 AS usable");
    assert.equal(Number(communityUsable.rows[0]?.usable), 1);

    await community.close();
    await community.close();
    assert.equal(endCalls, 1, "Community owner must end its physical pool exactly once");

    const sessionUsable = await store.pool.query("SELECT 1 AS usable");
    assert.equal(Number(sessionUsable.rows[0]?.usable), 1, "closing Community must not close SessionStore pool");
  } finally {
    if (chat) await chat.close().catch(() => {});
    await community.close().catch(() => {});
    await store.close().catch(() => {});
  }
});

pgTest("B1-C38 closing SessionStore does not close Community pool", { timeout: 15_000 }, async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const community = new PostgresCommunityPool(databaseUrl);
  try {
    await store.ready;
    assert.notEqual(store.pool, community.pool);
    await store.close();
    const { rows } = await community.pool.query("SELECT 1 AS usable");
    assert.equal(Number(rows[0]?.usable), 1);
  } finally {
    await store.close().catch(() => {});
    await community.close().catch(() => {});
  }
});
