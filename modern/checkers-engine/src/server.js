import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
import { TrafficGuard, TrafficLimitError, clientSource } from "./traffic-guard.js";
import { AdaptiveBotDefense, ChallengeRequiredError, ChallengeFailedError } from "./adaptive-bot-defense.js";

const SESSION_COOKIE = "__Host-gracz_session";
const COOKIE_TOKEN_MARKER = "cookie";

export function createGameHttpServer({
  store,
  auth = null,
  authSessions = null,
  accounts = null,
  messageAttachments = null,
  lobby = null,
  webRoot = null,
  loginRateLimiter = new LoginRateLimiter(),
  trafficGuard = new TrafficGuard(),
  botDefense = new AdaptiveBotDefense(),
  logger = { error() {} },
  realtime = new RealtimeHub(),
}) {
  if (!store) throw new TypeError("Magazyn sesji jest wymagany.");
  return createServer(async (request, response) => {
    try {
      trafficGuard.assertAllowed(request);
      await route(request, response, store, realtime, auth, authSessions, accounts, messageAttachments, lobby, webRoot, loginRateLimiter, trafficGuard, botDefense);
    } catch (error) {
      logger.error(error);
      sendError(response, error);
    }
  }).on("close", () => realtime.close());
}

async function route(request, response, store, realtime, auth, authSessions, accounts, messageAttachments, lobby, webRoot, loginRateLimiter, trafficGuard, botDefense) {
  const url = new URL(request.url, "http://localhost");
  assertSameOriginMutation(request);
  if (request.method === "GET" && url.pathname === "/health") return sendJson(response, 200, { status: "ok" });
  if (request.method === "GET" && url.pathname === "/security/challenge-config") {
    return sendJson(response, 200, { enabled: botDefense.enabled, provider: botDefense.enabled ? "turnstile" : null, siteKey: botDefense.enabled ? botDefense.siteKey : null });
  }
  if (request.method === "GET" && webRoot) {
    const staticFile = ({
      "/": "lobby.html", "/lobby.html": "lobby.html", "/lobby.js": "lobby.js", "/lobby.css": "lobby.css",
      "/lobby-checkers.css": "lobby-checkers.css", "/lobby-gomoku-alignment.css": "lobby-gomoku-alignment.css",
      "/homepage-consoles.js": "homepage-consoles.js", "/profile-modal.js": "profile-modal.js", "/auth-cookie-migration.js": "auth-cookie-migration.js", "/adaptive-challenge.js": "adaptive-challenge.js", "/settings-link.js": "settings-link.js",
      "/messages.html": "messages.html", "/messages.css": "messages.css", "/messages.js": "messages.js",
      "/players.html": "players.html", "/players.js": "players.js", "/players.css": "players.css", "/regulamin.html": "regulamin.html",
      "/settings.html": "settings.html", "/settings.css": "settings.css", "/settings.js": "settings.js",
      "/game.html": "index.html", "/app.js": "app.js", "/styles.css": "styles.css", "/classic-console.css": "classic-console.css"
    })[url.pathname];
    if (staticFile) return sendStatic(response, join(webRoot, staticFile), staticFile === "lobby.html");
  }

  if (request.method === "POST" && url.pathname === "/auth/register" && auth && accounts) {
    const body = await readJson(request);
    const source = clientSource(request);
    trafficGuard.assertRegistrationAttempt({ request, accountId: body.userId });
    await botDefense.verifyIfRequired({ source, accountId: body.userId, endpoint: "register", token: body.challengeToken });
    try {
      const account = await accounts.register(body);
      botDefense.recordRegistration({ source });
      await establishSession(response, auth, authSessions, account);
      return sendJson(response, 201, { token: COOKIE_TOKEN_MARKER, user: account });
    } catch (error) {
      botDefense.recordFailure({ source, accountId: body.userId, endpoint: "register" });
      throw error;
    }
  }

  if (request.method === "POST" && url.pathname === "/auth/login" && auth && accounts) {
    const credentials = await readJson(request);
    const source = clientSource(request);
    trafficGuard.assertCredentialAttempt({ request, accountId: credentials.userId, endpoint: "login" });
    const rateKey = `${source}:${String(credentials.userId).toLowerCase()}`;
    loginRateLimiter.assertAllowed(rateKey);
    await botDefense.verifyIfRequired({ source, accountId: credentials.userId, endpoint: "login", token: credentials.challengeToken });
    try {
      const account = await accounts.authenticate(credentials);
      loginRateLimiter.recordSuccess(rateKey);
      botDefense.recordSuccess({ source, accountId: credentials.userId });
      await establishSession(response, auth, authSessions, account);
      return sendJson(response, 200, { token: COOKIE_TOKEN_MARKER, user: account });
    } catch (error) {
      loginRateLimiter.recordFailure(rateKey);
      botDefense.recordFailure({ source, accountId: credentials.userId, endpoint: "login" });
      throw error;
    }
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    if (auth && authSessions) {
      try {
        const user = await trustedUser(request, auth, authSessions);
        if (user.tokenId) await authSessions.revoke(user.tokenId);
      } catch (error) {
        if (!(error instanceof AuthError)) throw error;
      }
    }
    clearSessionCookie(response);
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "GET" && url.pathname === "/auth/me" && auth) {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "session" });
    return sendJson(response, 200, { user: { userId: user.userId, displayName: user.displayName } });
  }

  if (request.method === "POST" && url.pathname === "/auth/migrate" && auth) {
    const token = bearerToken(request);
    if (!token) throw new AuthError("Brak tokenu do migracji sesji.");
    const user = auth.verify(token);
    if (authSessions && user.tokenId && await authSessions.has(user.tokenId)) await authSessions.assertActive(user);
    await establishSession(response, auth, authSessions, user);
    if (authSessions && user.tokenId && await authSessions.has(user.tokenId)) await authSessions.revoke(user.tokenId);
    return sendJson(response, 200, { token: COOKIE_TOKEN_MARKER, user: { userId: user.userId, displayName: user.displayName } });
  }

  if (request.method === "POST" && url.pathname === "/auth/reset-password" && accounts?.resetPasswordWithEmail) {
    const body = await readJson(request);
    const source = clientSource(request);
    trafficGuard.assertCredentialAttempt({ request, accountId: body.userId, endpoint: "reset" });
    const rateKey = `${source}:reset:${String(body.userId ?? "").toLowerCase()}`;
    loginRateLimiter.assertAllowed(rateKey);
    await botDefense.verifyIfRequired({ source, accountId: body.userId, endpoint: "reset", token: body.challengeToken });
    try {
      await accounts.resetPasswordWithEmail(body);
      if (authSessions) await authSessions.revokeAll(String(body.userId ?? "").toLowerCase());
      loginRateLimiter.recordSuccess(rateKey);
      botDefense.recordSuccess({ source, accountId: body.userId });
      clearSessionCookie(response);
      return sendJson(response, 200, { ok: true, message: "Hasło zostało zmienione. Wszystkie wcześniejsze sesje zostały zakończone." });
    } catch (error) {
      loginRateLimiter.recordFailure(rateKey);
      botDefense.recordFailure({ source, accountId: body.userId, endpoint: "reset" });
      throw error;
    }
  }

  if (request.method === "POST" && url.pathname === "/auth/session" && auth && !accounts) {
    const userId = request.headers["x-authenticated-user-id"];
    const displayName = request.headers["x-authenticated-display-name"];
    const token = await establishSession(response, auth, authSessions, { userId, displayName });
    return sendJson(response, 201, { token, user: { userId, displayName } });
  }

  if (accounts && auth && url.pathname === "/account/profile") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "profile" });
    if (request.method === "GET") return sendJson(response, 200, { profile: await accounts.getProfile(user.userId) });
    if (request.method === "PUT") {
      const profile = await accounts.updateProfile(user.userId, await readJson(request));
      const nextUser = { userId: profile.userId, displayName: profile.displayName };
      await establishSession(response, auth, authSessions, nextUser);
      if (authSessions && user.tokenId) await authSessions.revoke(user.tokenId);
      return sendJson(response, 200, { profile, user: nextUser, token: COOKIE_TOKEN_MARKER });
    }
    return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });
  }

  if (accounts && auth && url.pathname === "/players/search" && request.method === "GET") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "search" });
    return sendJson(response, 200, { players: await accounts.searchPlayers(user.userId, url.searchParams.get("q") ?? "") });
  }

  if (accounts && auth && url.pathname === "/messages") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "message" });
    if (request.method === "GET") {
      const result = await accounts.listPrivateMessages(user.userId, url.searchParams.get("folder") ?? "inbox");
      if (messageAttachments && result.messages?.length) {
        const meta = await messageAttachments.getMetaForMessages(result.messages.map((message) => message.messageId));
        result.messages = result.messages.map((message) => ({ ...message, attachment: meta.get(message.messageId) ?? null }));
      }
      return sendJson(response, 200, result);
    }
    if (request.method === "POST") return sendJson(response, 201, { message: await accounts.sendPrivateMessage(user.userId, await readJson(request)) });
    return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });
  }

  const attachmentMatch = messageAttachments && accounts && auth && url.pathname.match(/^\/messages\/([0-9a-f-]{36})\/attachment$/i);
  if (attachmentMatch) {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "attachment" });
    if (request.method === "POST") return sendJson(response, 201, { attachment: await messageAttachments.save(user.userId, attachmentMatch[1], await readJson(request, 1_500_000)) });
    if (request.method === "GET") return sendJson(response, 200, { attachment: await messageAttachments.get(user.userId, attachmentMatch[1]) });
    return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });
  }

  const privateMessageMatch = accounts && auth && url.pathname.match(/^\/messages\/([0-9a-f-]{36})$/i);
  if (privateMessageMatch) {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "message" });
    if (request.method === "PATCH") return sendJson(response, 200, await accounts.updatePrivateMessage(user.userId, privateMessageMatch[1], (await readJson(request)).action));
    if (request.method === "DELETE") return sendJson(response, 200, await accounts.deletePrivateMessage(user.userId, privateMessageMatch[1]));
    return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });
  }

  if (lobby && url.pathname === "/lobby/state" && request.method === "GET") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "lobby" });
    lobby.touchUser(user);
    return sendJson(response, 200, { rooms: lobby.listRooms(), players: lobby.listPlayers(), invitations: lobby.listInvitations(user.userId) });
  }
  if (lobby && url.pathname === "/lobby/invitations" && request.method === "POST") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "invitation" });
    lobby.touchUser(user);
    const body = await readJson(request);
    return sendJson(response, 201, lobby.createInvitation({ fromId: user.userId, fromName: user.displayName, toId: body.toId, roomId: body.roomId }));
  }
  const invitationMatch = lobby && url.pathname.match(/^\/lobby\/invitations\/([a-zA-Z0-9_-]{1,128})\/respond$/);
  if (invitationMatch && request.method === "POST") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "invitation" });
    const body = await readJson(request);
    return sendJson(response, 200, await lobby.respondInvitation({ invitationId: invitationMatch[1], userId: user.userId, userName: user.displayName, accept: body.accept === true }));
  }
  if (lobby && url.pathname === "/lobby/rooms") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "room" });
    lobby.touchUser(user);
    if (request.method === "GET") return sendJson(response, 200, { rooms: lobby.listRooms() });
    if (request.method === "POST") {
      const body = await readJson(request);
      return sendJson(response, 201, lobby.createRoom({ ownerId: user.userId, ownerName: user.displayName, roomName: body.roomName }));
    }
  }
  const lobbyMatch = lobby && url.pathname.match(/^\/lobby\/rooms\/([a-zA-Z0-9_-]{1,128})\/join$/);
  if (lobbyMatch && request.method === "POST") {
    const user = await trustedUser(request, auth, authSessions);
    trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "room" });
    lobby.touchUser(user);
    return sendJson(response, 200, await lobby.joinRoom({ roomId: lobbyMatch[1], playerId: user.userId, playerName: user.displayName }));
  }

  if (request.method === "POST" && url.pathname === "/games") {
    const body = await readJson(request);
    if (auth) {
      const user = await trustedUser(request, auth, authSessions);
      trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: "game" });
      if (body.whitePlayerId !== user.userId) throw new HttpError("Nie możesz utworzyć partii w imieniu innego gracza.", "FORBIDDEN", 403);
    }
    const session = createGameSession(body); await store.create(session);
    return sendJson(response, 201, { gameId: session.gameId });
  }
  const match = url.pathname.match(/^\/games\/([a-zA-Z0-9_-]{1,128})(?:\/(moves|disconnect|reconnect|events|chat|actions))?$/);
  if (!match) return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Nie znaleziono endpointu." } });
  const [, gameId, action] = match;
  const user = await trustedUser(request, auth, authSessions);
  trafficGuard.assertAccountAllowed({ request, userId: user.userId, action: action === "chat" ? "chat" : action === "moves" ? "move" : "game" });
  const playerId = user.userId;
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

async function establishSession(response, auth, authSessions, user) {
  const token = auth.issue({ userId: user.userId, displayName: user.displayName });
  const claims = auth.verify(token);
  if (authSessions) await authSessions.create(claims);
  issueSessionCookie(response, token);
  return token;
}

async function trustedUser(request, auth, authSessions) {
  if (auth) {
    const cookieToken = parseCookies(request.headers.cookie)[SESSION_COOKIE];
    const token = cookieToken || bearerToken(request);
    if (!token || token === COOKIE_TOKEN_MARKER) throw new AuthError("Brak aktywnej sesji logowania.");
    const user = auth.verify(token);
    if (authSessions && user.tokenId) {
      if (await authSessions.has(user.tokenId)) await authSessions.assertActive(user);
      else await authSessions.create(user);
    }
    return user;
  }
  const playerId = request.headers["x-player-id"];
  if (typeof playerId !== "string" || playerId.length < 1 || playerId.length > 128) throw new HttpError("Brak tożsamości gracza.", "UNAUTHENTICATED", 401);
  return { userId: playerId, displayName: playerId };
}

function bearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  return token && token !== COOKIE_TOKEN_MARKER ? token : null;
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  }
  return cookies;
}

function issueSessionCookie(response, token) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict`);
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

function assertSameOriginMutation(request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite === "cross-site") throw new HttpError("Żądanie z obcej strony zostało zablokowane.", "CROSS_SITE_REQUEST", 403);
  const origin = request.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch { throw new HttpError("Nieprawidłowe źródło żądania.", "CROSS_SITE_REQUEST", 403); }
  if (originHost !== request.headers.host) throw new HttpError("Żądanie z obcej strony zostało zablokowane.", "CROSS_SITE_REQUEST", 403);
}

async function readJson(request, maxBytes = 16_384) {
  const chunks = []; let length = 0;
  for await (const chunk of request) { length += chunk.length; if (length > maxBytes) throw new HttpError("Żądanie jest za duże.", "PAYLOAD_TOO_LARGE", 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new HttpError("Nieprawidłowy JSON.", "INVALID_JSON", 400); }
}

function sendError(response, error) {
  if (response.headersSent || response.writableEnded) return;
  if (error instanceof HttpError) return sendJson(response, error.status, errorBody(error));
  if (error instanceof SessionNotFoundError) return sendJson(response, 404, errorBody(error));
  if (error instanceof AuthError) return sendJson(response, 401, errorBody(error));
  if (error instanceof ChallengeRequiredError) return sendJson(response, 403, { error: { code: error.code, message: error.message, challenge: { provider: "turnstile", siteKey: error.siteKey, reason: error.reason } } });
  if (error instanceof ChallengeFailedError) return sendJson(response, 403, errorBody(error));
  if (error instanceof TrafficLimitError || error instanceof RateLimitError) {
    response.setHeader("Retry-After", String(error.retryAfterSeconds || 1));
    return sendJson(response, 429, errorBody(error));
  }
  if (error instanceof AccountError) return sendJson(response, error.code === "ACCOUNT_EXISTS" ? 409 : ["ACCOUNT_NOT_FOUND","MESSAGE_NOT_FOUND"].includes(error.code) ? 404 : error.code === "MESSAGES_DISABLED" ? 403 : 400, errorBody(error));
  if (error instanceof LobbyError) return sendJson(response, error.code === "ROOM_NOT_FOUND" || error.code === "INVITATION_NOT_FOUND" ? 404 : 409, errorBody(error));
  if (error?.code === "SESSION_EXISTS") return sendJson(response, 409, errorBody(error));
  if (error instanceof SessionError || error?.name === "IllegalMoveError" || error instanceof TypeError) return sendJson(response, 400, errorBody(error));
  return sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "Wewnętrzny błąd serwera." } });
}

async function sendStatic(response, path, injectHomepageExtras = false) {
  const extension = path.split(".").at(-1);
  const contentType = ({ html: "text/html", js: "text/javascript", css: "text/css" })[extension] ?? "application/octet-stream";
  let content = await readFile(path);
  if (injectHomepageExtras) {
    const html = content.toString("utf8").replace("</body>", '<script src="/auth-cookie-migration.js" defer></script><script src="/adaptive-challenge.js" defer></script><script src="/homepage-consoles.js" defer></script><script src="/profile-modal.js" defer></script><script src="/settings-link.js" defer></script></body>');
    content = Buffer.from(html, "utf8");
  }
  response.writeHead(200, { "content-type": `${contentType}; charset=utf-8`, "cache-control": "no-store" });
  response.end(content);
}

function errorBody(error) { return { error: { code: error.code ?? "INVALID_REQUEST", message: error.message } }; }
function sendJson(response, status, body) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(body)); }
class HttpError extends Error { constructor(message, code, status) { super(message); this.code = code; this.status = status; } }
