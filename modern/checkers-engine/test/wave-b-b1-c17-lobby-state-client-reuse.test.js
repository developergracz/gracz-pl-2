import assert from "node:assert/strict";
import test from "node:test";

import { AuthService } from "../src/auth.js";
import { LobbyService } from "../src/lobby.js";
import { createPlatformLobbyHttpHandler } from "../src/platform-lobby-http.js";

function createPool({ failWhen = null } = {}) {
  const metrics = {
    connects: 0,
    releases: 0,
    poolQueries: 0,
    queries: [],
  };

  const client = {
    async query(text, params) {
      const sql = typeof text === "string" ? text : String(text?.text ?? "");
      metrics.queries.push({ sql, params });
      if (failWhen?.test(sql)) throw new Error("forced query failure");
      return { rows: [] };
    },
    release() {
      metrics.releases += 1;
    },
  };

  const pool = {
    async connect() {
      metrics.connects += 1;
      return client;
    },
    async query() {
      metrics.poolQueries += 1;
      throw new Error("readState must not use pool.query after acquiring its request-local client");
    },
  };

  return {
    pool,
    metrics,
    reset() {
      metrics.connects = 0;
      metrics.releases = 0;
      metrics.poolQueries = 0;
      metrics.queries.length = 0;
    },
  };
}

function memorySessionStore() {
  return { async create() {} };
}

test("B1-C17 /lobby/state database read uses one pool acquisition for the six existing queries", async () => {
  const fixture = createPool();
  const lobby = new LobbyService({ sessionStore: memorySessionStore(), pool: fixture.pool });
  await lobby.ready;
  fixture.reset();

  const state = await lobby.readState({ userId: "alice", displayName: "Alicja" });

  assert.deepEqual(state, { rooms: [], players: [], invitations: [] });
  assert.equal(fixture.metrics.connects, 1, "one logical state read must acquire exactly one client");
  assert.equal(fixture.metrics.releases, 1, "request-local client must be released exactly once");
  assert.equal(fixture.metrics.poolQueries, 0, "all state queries must use the acquired client");
  assert.equal(fixture.metrics.queries.length, 6, "SQL semantics stay at the existing six statements");
  assert.equal(fixture.metrics.queries.some(({ sql }) => /^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)), false,
    "read-only aggregation must not add a transaction");

  const sql = fixture.metrics.queries.map(({ sql: text }) => text).join("\n");
  assert.match(sql, /INSERT INTO gracz_lobby_presence/);
  assert.match(sql, /DELETE FROM gracz_lobby_presence/);
  assert.match(sql, /SELECT \* FROM gracz_lobby_rooms ORDER BY updated_at/);
  assert.match(sql, /SELECT user_id,display_name,seen_at FROM gracz_lobby_presence/);
  assert.match(sql, /SELECT \* FROM gracz_lobby_rooms WHERE status IN/);
  assert.match(sql, /SELECT \* FROM gracz_lobby_invitations WHERE to_id=\$1/);
});

test("B1-C17 request-local lobby client is released exactly once when a state query fails", async () => {
  const fixture = createPool({ failWhen: /SELECT \* FROM gracz_lobby_rooms ORDER BY updated_at/ });
  const lobby = new LobbyService({ sessionStore: memorySessionStore(), pool: fixture.pool });
  await lobby.ready;
  fixture.reset();

  await assert.rejects(
    () => lobby.readState({ userId: "alice", displayName: "Alicja" }),
    /forced query failure/,
  );

  assert.equal(fixture.metrics.connects, 1);
  assert.equal(fixture.metrics.releases, 1);
  assert.equal(fixture.metrics.poolQueries, 0);
});

test("B1-C17 GET /lobby/state routes through LobbyService.readState instead of six public calls", async () => {
  const auth = new AuthService({ secret: "b1-c17-test-secret-with-at-least-32-characters" });
  const token = auth.issue({ userId: "alice", displayName: "Alicja" });
  let readStateCalls = 0;
  const forbidden = () => { throw new Error("legacy lobby state path must not be called"); };
  const lobby = {
    async readState(user) {
      readStateCalls += 1;
      assert.equal(user.userId, "alice");
      return { rooms: [], players: [], invitations: [] };
    },
    touchUser: forbidden,
    listRooms: forbidden,
    listPlayers: forbidden,
    listInvitations: forbidden,
  };
  const handler = createPlatformLobbyHttpHandler({ lobby, auth });
  const response = {
    statusCode: null,
    body: null,
    writeHead(statusCode) { this.statusCode = statusCode; },
    end(body) { this.body = body; },
  };
  const request = {
    method: "GET",
    url: "/lobby/state",
    headers: { authorization: `Bearer ${token}` },
  };

  assert.equal(await handler(request, response), true);
  assert.equal(readStateCalls, 1);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { rooms: [], players: [], invitations: [] });
});
