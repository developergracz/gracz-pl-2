import { createServer } from "node:http";

import {
  SessionError,
  createGameSession,
  disconnectPlayer,
  getSessionSnapshot,
  reconnectPlayer,
  submitMove,
} from "./session.js";
import { SessionNotFoundError } from "./store.js";
import { RealtimeHub } from "./realtime.js";
import { AuthError } from "./auth.js";
import { LobbyError } from "./lobby.js";

export function createGameHttpServer({ store, auth = null, lobby = null, logger = { error() {} }, realtime = new RealtimeHub() }) {
  if (!store) throw new TypeError("Magazyn sesji jest wymagany.");
  return createServer(async (request, response) => {
    try {
      await route(request, response, store, realtime, auth, lobby);
    } catch (error) {
      logger.error(error);
      sendError(response, error);
    }
  }).on("close", () => realtime.close());
}

async function route(request, response, store, realtime, auth, lobby) {
  const url = new URL(request.url, "http://localhost");
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { status: "ok" });
  }
  if (request.method === "POST" && url.pathname === "/auth/session" && auth) {
    const userId = request.headers["x-authenticated-user-id"];
    const displayName = request.headers["x-authenticated-display-name"];
    const token = auth.issue({ userId, displayName });
    return sendJson(response, 201, { token, user: { userId, displayName } });
  }
  if (lobby && url.pathname === "/lobby/rooms") {
    const user = trustedUser(request, auth);
    if (request.method === "GET") return sendJson(response, 200, { rooms: lobby.listRooms() });
    if (request.method === "POST") {
      const body = await readJson(request);
      return sendJson(response, 201, lobby.createRoom({
        ownerId: user.userId, ownerName: user.displayName, roomName: body.roomName,
      }));
    }
  }
  const lobbyMatch = lobby && url.pathname.match(/^\/lobby\/rooms\/([a-zA-Z0-9_-]{1,128})\/join$/);
  if (lobbyMatch && request.method === "POST") {
    const user = trustedUser(request, auth);
    return sendJson(response, 200, await lobby.joinRoom({
      roomId: lobbyMatch[1], playerId: user.userId, playerName: user.displayName,
    }));
  }
  if (request.method === "POST" && url.pathname === "/games") {
    const body = await readJson(request);
    const session = createGameSession(body);
    await store.create(session);
    return sendJson(response, 201, { gameId: session.gameId });
  }

  const match = url.pathname.match(/^\/games\/([a-zA-Z0-9_-]{1,128})(?:\/(moves|disconnect|reconnect|events))?$/);
  if (!match) return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Nie znaleziono endpointu." } });
  const [, gameId, action] = match;
  const playerId = trustedUser(request, auth).userId;
  let session = await store.get(gameId);

  if (request.method === "GET" && action === "events") {
    realtime.subscribe(session, playerId, response);
    return;
  }

  if (request.method === "GET" && !action) {
    return sendJson(response, 200, getSessionSnapshot(session, playerId));
  }
  if (request.method === "POST" && action === "moves") {
    const body = await readJson(request);
    const result = submitMove(session, { playerId, requestId: body.requestId, move: body.move });
    await store.save(result.session);
    realtime.publish(result.session, "game.updated");
    return sendJson(response, 200, {
      duplicate: result.duplicate,
      eventSequence: result.event.sequence,
      snapshot: getSessionSnapshot(result.session, playerId),
    });
  }
  if (request.method === "POST" && action === "disconnect") {
    session = disconnectPlayer(session, playerId);
    await store.save(session);
    realtime.publish(session, "player.disconnected");
    return sendJson(response, 200, { disconnected: true });
  }
  if (request.method === "POST" && action === "reconnect") {
    const result = reconnectPlayer(session, playerId);
    await store.save(result.session);
    realtime.publish(result.session, "player.reconnected");
    return sendJson(response, 200, result.snapshot);
  }
  return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });
}

function trustedUser(request, auth) {
  if (auth) {
    const authorization = request.headers.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) throw new AuthError("Brak tokenu logowania.");
    return auth.verify(authorization.slice(7));
  }
  // Nagłówek może ustawiać wyłącznie zaufana warstwa logowania/API gateway.
  const playerId = request.headers["x-player-id"];
  if (typeof playerId !== "string" || playerId.length < 1 || playerId.length > 128) {
    throw new HttpError("Brak tożsamości gracza.", "UNAUTHENTICATED", 401);
  }
  return { userId: playerId, displayName: playerId };
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16_384) throw new HttpError("Żądanie jest za duże.", "PAYLOAD_TOO_LARGE", 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError("Nieprawidłowy JSON.", "INVALID_JSON", 400);
  }
}

function sendError(response, error) {
  if (error instanceof HttpError) return sendJson(response, error.status, errorBody(error));
  if (error instanceof SessionNotFoundError) return sendJson(response, 404, errorBody(error));
  if (error instanceof AuthError) return sendJson(response, 401, errorBody(error));
  if (error instanceof LobbyError) return sendJson(response, error.code === "ROOM_NOT_FOUND" ? 404 : 409, errorBody(error));
  if (error?.code === "SESSION_EXISTS") return sendJson(response, 409, errorBody(error));
  if (error instanceof SessionError || error?.name === "IllegalMoveError" || error instanceof TypeError) {
    return sendJson(response, 400, errorBody(error));
  }
  return sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "Wewnętrzny błąd serwera." } });
}

function errorBody(error) {
  return { error: { code: error.code ?? "INVALID_REQUEST", message: error.message } };
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

class HttpError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
