import assert from "node:assert/strict";
import test from "node:test";

import { AuthError, AuthService } from "../src/auth.js";
import { LobbyService } from "../src/lobby.js";
import { MemorySessionStore } from "../src/store.js";
import { createGameHttpServer } from "../src/server.js";

test("signed login token identifies user and detects tampering", () => {
  const auth = new AuthService({ secret: "a-secure-test-secret-with-at-least-32-characters" });
  const token = auth.issue({ userId: "alice", displayName: "Alicja" });
  assert.equal(auth.verify(token).userId, "alice");
  assert.throws(() => auth.verify(`${token}x`), AuthError);
});

test("expired login token is rejected", () => {
  let now = 1_000_000;
  const auth = new AuthService({ secret: "a-secure-test-secret-with-at-least-32-characters", ttlSeconds: 60, clock: () => now });
  const token = auth.issue({ userId: "alice", displayName: "Alicja" });
  now += 61_000;
  assert.throws(() => auth.verify(token), (error) => error.code === "SESSION_EXPIRED");
});

test("server issues HttpOnly Secure SameSite cookie and accepts it as session", async () => {
  const store = new MemorySessionStore();
  const auth = new AuthService({ secret: "a-secure-test-secret-with-at-least-32-characters" });
  const server = createGameHttpServer({ store, auth });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${baseUrl}/auth/session`, {
      method: "POST",
      headers: { "x-authenticated-user-id": "alice", "x-authenticated-display-name": "Alicja" },
    });
    assert.equal(login.status, 201);
    const setCookie = login.headers.get("set-cookie");
    assert.match(setCookie, /__Host-gracz_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(";")[0];
    const me = await fetch(`${baseUrl}/auth/me`, { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.userId, "alice");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("lobby creates waiting room and starts game when second player joins", async () => {
  const store = new MemorySessionStore();
  const lobby = new LobbyService({ sessionStore: store, idGenerator: () => "room-1" });
  const waiting = lobby.createRoom({ ownerId: "alice", ownerName: "Alicja", roomName: "Szybka gra" });
  assert.equal(waiting.status, "waiting");
  assert.equal(waiting.gameType, "checkers");
  const playing = await lobby.joinRoom({ roomId: "room-1", playerId: "bob", playerName: "Robert" });
  assert.equal(playing.status, "playing");
  assert.equal(playing.gameId, "game-room-1");
  assert.equal((await store.get(playing.gameId)).players.black.id, "bob");
});

test("Thousand lobby waits for three players and starts shared game only on third seat", async () => {
  const store = new MemorySessionStore();
  const created = [];
  const thousandService = {
    async createGame(input) { created.push(structuredClone(input)); return { gameId: input.gameId, revision: 1 }; },
  };
  const lobby = new LobbyService({ sessionStore: store, thousandService, idGenerator: () => "room-1000" });
  let room = lobby.createRoom({ ownerId: "alice", ownerName: "Alicja", roomName: "Tysiąc", gameType: "thousand" });
  assert.equal(room.maxPlayers, 3);
  assert.equal(room.filledSeats, 1);
  room = await lobby.joinRoom({ roomId: "room-1000", playerId: "bob", playerName: "Robert" });
  assert.equal(room.status, "waiting");
  assert.equal(room.filledSeats, 2);
  assert.equal(created.length, 0);
  room = await lobby.joinRoom({ roomId: "room-1000", playerId: "carol", playerName: "Karolina" });
  assert.equal(room.status, "playing");
  assert.equal(room.filledSeats, 3);
  assert.equal(room.gameId, "thousand-room-1000");
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].players.map((player) => player.userId), ["alice", "bob", "carol"]);
});

test("Thousand invitations carry the game type and second accepted invite starts the game", async () => {
  const store = new MemorySessionStore();
  const thousandService = { async createGame(input) { return { gameId: input.gameId, revision: 1 }; } };
  let id=0;
  const lobby = new LobbyService({ sessionStore: store, thousandService, idGenerator: () => `id-${++id}` });
  lobby.touchUser({ userId:"alice",displayName:"Alicja" });
  lobby.touchUser({ userId:"bob",displayName:"Robert" });
  lobby.touchUser({ userId:"carol",displayName:"Karolina" });
  const room=lobby.createRoom({ownerId:"alice",ownerName:"Alicja",roomName:"Tysiąc",gameType:"thousand"});
  const first=lobby.createInvitation({fromId:"alice",fromName:"Alicja",toId:"bob",roomId:room.roomId});
  assert.equal(first.gameType,"thousand");
  let result=await lobby.respondInvitation({invitationId:first.invitationId,userId:"bob",userName:"Robert",accept:true});
  assert.equal(result.room.status,"waiting");
  const second=lobby.createInvitation({fromId:"alice",fromName:"Alicja",toId:"carol",roomId:room.roomId});
  result=await lobby.respondInvitation({invitationId:second.invitationId,userId:"carol",userName:"Karolina",accept:true});
  assert.equal(result.room.status,"playing");
  assert.match(result.room.gameId,/^thousand-/);
});

test("two logged-in users create and join a room through the real API", async () => {
  const store = new MemorySessionStore();
  const auth = new AuthService({ secret: "a-secure-test-secret-with-at-least-32-characters" });
  const lobby = new LobbyService({ sessionStore: store, idGenerator: () => "room-api" });
  const server = createGameHttpServer({ store, auth, lobby });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = async (userId, displayName) => {
      const response = await fetch(`${baseUrl}/auth/session`, {
        method: "POST",
        headers: { "x-authenticated-user-id": userId, "x-authenticated-display-name": displayName },
      });
      return (await response.json()).token;
    };
    const aliceToken = await login("alice", "Alicja");
    const bobToken = await login("bob", "Robert");
    const created = await fetch(`${baseUrl}/lobby/rooms`, {
      method: "POST",
      headers: { authorization: `Bearer ${aliceToken}`, "content-type": "application/json" },
      body: JSON.stringify({ roomName: "Pokój Alicji" }),
    });
    assert.equal(created.status, 201);
    const room = await created.json();
    const joined = await fetch(`${baseUrl}/lobby/rooms/${room.roomId}/join`, {
      method: "POST", headers: { authorization: `Bearer ${bobToken}` },
    });
    assert.equal(joined.status, 200);
    const playing = await joined.json();
    assert.equal(playing.status, "playing");
    assert.equal((await store.get(playing.gameId)).players.white.id, "alice");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});