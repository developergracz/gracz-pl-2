import assert from "node:assert/strict";
import test from "node:test";

import { AuthService } from "../src/auth.js";
import { MemoryAuthSessionStore } from "../src/auth-sessions.js";
import { createGameHttpServer } from "../src/server.js";
import { MemorySessionStore } from "../src/store.js";

test("logout revokes server-side session and old cookie cannot be reused", async () => {
  const auth = new AuthService({ secret: "a-secure-test-secret-with-at-least-32-characters" });
  const authSessions = new MemoryAuthSessionStore();
  const server = createGameHttpServer({ store: new MemorySessionStore(), auth, authSessions });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const issued = await fetch(`${baseUrl}/auth/session`, {
      method: "POST",
      headers: { "x-authenticated-user-id": "alice", "x-authenticated-display-name": "Alicja" },
    });
    assert.equal(issued.status, 201);
    const cookie = issued.headers.get("set-cookie");
    assert.match(cookie, /__Host-gracz_session=/);

    const beforeLogout = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
    assert.equal(beforeLogout.status, 200);

    const logout = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: { cookie } });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);

    const reused = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
    assert.equal(reused.status, 401);
    assert.equal((await reused.json()).error.code, "SESSION_REVOKED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("revoking all sessions invalidates every token for a user", async () => {
  const auth = new AuthService({ secret: "a-secure-test-secret-with-at-least-32-characters" });
  const authSessions = new MemoryAuthSessionStore();
  const firstToken = auth.issue({ userId: "alice", displayName: "Alicja" });
  const secondToken = auth.issue({ userId: "alice", displayName: "Alicja" });
  const first = auth.verify(firstToken);
  const second = auth.verify(secondToken);
  await authSessions.create(first);
  await authSessions.create(second);

  await authSessions.revokeAll("alice");

  await assert.rejects(() => authSessions.assertActive(first), (error) => error.code === "SESSION_REVOKED");
  await assert.rejects(() => authSessions.assertActive(second), (error) => error.code === "SESSION_REVOKED");
});
