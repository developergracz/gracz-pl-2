import { createServer } from "node:http";

import {
  SessionError,
  createGameSession,
  disconnectPlayer,
  getSessionSnapshot,
  reconnectPlayer,
  sendChatMessage,
  submitGameAction,
  submitMove,
} from "./session.js";
import { SessionNotFoundError } from "./store.js";
import { RealtimeHub } from "./realtime.js";
import { AuthError } from "./auth.js";
import { LobbyError } from "./lobby.js";
import { AccountError } from "./accounts.js";
import { LoginRateLimiter, RateLimitError } from "./rate-limit.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function createGameHttpServer({ store, auth = null, accounts = null, lobby = null, webRoot = null, loginRateLimiter = new LoginRateLimiter(), logger = { error() {} }, realtime = new RealtimeHub() }) {
  if (!store) throw new TypeError("Magazyn sesji jest wymagany.");
  return createServer(async (request, response) => {
    try { await route(request, response, store, realtime, auth, accounts, lobby, webRoot, loginRateLimiter); }
    catch (error) { logger.error(error); sendError(response, error); }
  }).on("close", () => realtime.close());
}

async function route(request, response, store, realtime, auth, accounts, lobby, webRoot, loginRateLimiter) {
  const url = new URL(request.url, "http://localhost");
  if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { status: "ok" });
  if (request.method === "GET" && webRoot) {
    const staticFile = ({ "/": "lobby.html", "/lobby.html": "lobby.html", "/lobby.js": "lobby.js", "/lobby.css": "lobby.css", "/lobby-checkers.css": "lobby-checkers.css", "/lobby-gomoku-alignment.css": "lobby-gomoku-alignment.css", "/game.html": "index.html", "/app.js": "app.js", "/styles.css": "styles.css", "/classic-console.css": "classic-console.css" })[url.pathname];
    if (staticFile) return sendStatic(response, join(webRoot, staticFile));
  }
  if (request.method === "POST" && url.pathname === "/auth/register" && auth && accounts) {
    const account = await accounts.register(await readJson(request));
    return sendJson(response, 201, { token: auth.issue(account), user: account });
  }
  if (request.method === "POST" && url.pathname === "/auth/login" && auth && accounts) {
    const credentials = await readJson(request);
    const rateKey = `${request.socket.remoteAddress ?? "unknown"}:${String(credentials.userId).toLowerCase()}`;
    loginRateLimiter.assertAllowed(rateKey);
    try {
      const account = await accounts.authenticate(credentials);
      loginRateLimiter.recordSuccess(rateKey);
      return sendJson(response, 200, { token: auth.issue(account), user: account });
    } catch (error) { loginRateLimiter.recordFailure(rateKey); throw error; }
  }
  if (request.method === "POST" && url.pathname === "/auth/session" && auth) {
    const userId = request.headers["x-authenticated-user-id"];
    const displayName = request.headers["x-authenticated-display-name"];
    const token = auth.issue({ userId, displayName });
    return sendJson(response, 201, { token, user: { userId, displayName } });
  }

  if (lobby && url.pathname === "/lobby/state" && request.method === "GET") {
    const user = trustedUser(request, auth);
    lobby.touchUser(user);
    return sendJson(response, 200, { rooms: lobby.listRooms(), players: lobby.listPlayers(), invitations: lobby.listInvitations(user.userId) });
  }
  if (lobby && url.pathname === "/lobby/invitations" && request.method === "POST") {
    const user = trustedUser(request, auth);
    lobby.touchUser(user);
    const body = await readJson(request);
    return sendJson(response, 201, lobby.createInvitation({ fromId: user.userId, fromName: user.displayName, toId: body.toId, roomId: body.roomId }));
  }
  const invitationMatch = lobby && url.pathname.match(/^\/lobby\/invitations\/([a-zA-Z0-9_-]{1,128})\/respond$/);
  if (invitationMatch && request.method === "POST") {
    const user = trustedUser(request, auth);
    const body = await readJson(request);
    return sendJson(response, 200, await lobby.respondInvitation({ invitationId: invitationMatch[1], userId: user.userId, userName: user.displayName, accept: body.accept === true }));
  }
  if (lobby && url.pathname === "/lobby/rooms") {
    const user = trustedUser(request, auth);
    lobby.touchUser(user);
    if (request.method === "GET") return sendJson(response, 200, { rooms: lobby.listRooms() });
    if (request.method === "POST") {
      const body = await readJson(request);
      return sendJson(response, 201, lobby.createRoom({ ownerId: user.userId, ownerName: user.displayName, roomName: body.roomName }));
    }
  }
  const lobbyMatch = lobby && url.pathname.match(/^\/lobby\/rooms\/([a-zA-Z0-9_-]{1,128})\/join$/);
  if (lobbyMatch && request.method === "POST") {
    const user = trustedUser(request, auth);
    lobby.touchUser(user);
    return sendJson(response, 200, await lobby.joinRoom({ roomId: lobbyMatch[1], playerId: user.userId, playerName: user.displayName }));
  }

  if (request.method === "POST" && url.pathname === "/games") {
    const body = await readJson(request); const session = createGameSession(body); await store.create(session);
    return sendJson(response, 201, { gameId: session.gameId });
  }
  const match = url.pathname.match(/^\/games\/([a-zA-Z0-9_-]{1,128})(?:\/(moves|disconnect|reconnect|events|chat|actions))?$/);
  if (!match) return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Nie znaleziono endpointu." } });
  const [, gameId, action] = match;
  const playerId = trustedUser(request, auth).userId;
  let session = await store.get(gameId);
  if (request.method === "GET" && action === "events") { realtime.subscribe(session, playerId, response); return; }
  if (request.method === "GET" && !action) return sendJson(response, 200, getSessionSnapshot(session, playerId));
  if (request.method === "POST" && action === "moves") {
    const body = await readJson(request); const result = submitMove(session, { playerId, requestId: body.requestId, move: body.move });
    await store.save(result.session); realtime.publish(result.session, "game.updated");
    return sendJson(response, 200, { duplicate: result.duplicate, eventSequence: result.event.sequence, snapshot: getSessionSnapshot(result.session, playerId) });
  }
  if (request.method === "POST" && action === "chat") { session = sendChatMessage(session, { playerId, text: (await readJson(request)).text }); await store.save(session); realtime.publish(session, "chat.message"); return sendJson(response, 201, getSessionSnapshot(session, playerId)); }
  if (request.method === "POST" && action === "actions") { session = submitGameAction(session, { playerId, action: (await readJson(request)).action }); await store.save(session); realtime.publish(session, "game.action"); return sendJson(response, 200, getSessionSnapshot(session, playerId)); }
  if (request.method === "POST" && action === "disconnect") { session = disconnectPlayer(session, playerId); await store.save(session); realtime.publish(session, "player.disconnected"); return sendJson(response, 200, { disconnected: true }); }
  if (request.method === "POST" && action === "reconnect") { const result = reconnectPlayer(session, playerId); await store.save(result.session); realtime.publish(result.session, "player.reconnected"); return sendJson(response, 200, result.snapshot); }
  return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });
}

function trustedUser(request, auth) {
  if (auth) {
    const authorization = request.headers.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) throw new AuthError("Brak tokenu logowania.");
    return auth.verify(authorization.slice(7));
  }
  const playerId = request.headers["x-player-id"];
  if (typeof playerId !== "string" || playerId.length < 1 || playerId.length > 128) throw new HttpError("Brak tożsamości gracza.", "UNAUTHENTICATED", 401);
  return { userId: playerId, displayName: playerId };
}

async function readJson(request) {
  const chunks = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > 16_384) throw new HttpError("Żądanie jest za duże.", "PAYLOAD_TOO_LARGE", 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new HttpError("Nieprawidłowy JSON.", "INVALID_JSON", 400); }
}
function sendError(response, error) {
  if (error instanceof HttpError) return sendJson(response, error.status, errorBody(error));
  if (error instanceof SessionNotFoundError) return sendJson(response, 404, errorBody(error));
  if (error instanceof AuthError) return sendJson(response, 401, errorBody(error));
  if (error instanceof AccountError) return sendJson(response, error.code === "ACCOUNT_EXISTS" ? 409 : 400, errorBody(error));
  if (error instanceof RateLimitError) return sendJson(response, 429, errorBody(error));
  if (error instanceof LobbyError) return sendJson(response, error.code === "ROOM_NOT_FOUND" || error.code === "INVITATION_NOT_FOUND" ? 404 : 409, errorBody(error));
  if (error?.code === "SESSION_EXISTS") return sendJson(response, 409, errorBody(error));
  if (error instanceof SessionError || error?.name === "IllegalMoveError" || error instanceof TypeError) return sendJson(response, 400, errorBody(error));
  return sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "Wewnętrzny błąd serwera." } });
}
async function sendStatic(response, path) {
  const extension = path.split(".").at(-1); const contentType = ({ html: "text/html", js: "text/javascript", css: "text/css" })[extension] ?? "application/octet-stream";
  const content = await readFile(path); response.writeHead(200, { "content-type": `${contentType}; charset=utf-8`, "cache-control": "no-store" }); response.end(content);
}
function errorBody(error) { return { error: { code: error.code ?? "INVALID_REQUEST", message: error.message } }; }
function sendJson(response, status, body) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(body)); }
class HttpError extends Error { constructor(message, code, status) { super(message); this.code = code; this.status = status; } }
