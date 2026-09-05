import { createHash } from "node:crypto";

import { AuthError } from "./auth.js";
import { DistributedRateLimitError, SharedInfrastructureUnavailableError } from "./distributed-infrastructure.js";
import { createCheckersMatchRuntimeAdapter } from "./checkers-match-runtime-adapter.js";
import { MatchRuntime } from "./match-runtime.js";
import { RateLimitError } from "./rate-limit.js";
import { SessionError, getSessionSnapshot } from "./session.js";
import { createGameHttpServer as createLegacyGameHttpServer } from "./server.js";
import { SessionNotFoundError } from "./store.js";
import { TrafficLimitError } from "./traffic-guard.js";

const SESSION_COOKIE = "__Host-gracz_session";
const COOKIE_TOKEN_MARKER = "cookie";
const MOVE_PATH = /^\/games\/([a-zA-Z0-9_-]{1,128})\/moves$/;

export function createGameHttpServer(options = {}) {
  const {
    store,
    auth = null,
    authSessions = null,
    trafficGuard,
    sharedTrafficGuard = null,
    sharedRequestGuardExternally = false,
    logger = { error() {} },
    realtime,
  } = options;

  const server = createLegacyGameHttpServer(options);
  if (!supportsMatchRuntime(store)) return server;

  const matchRuntime = new MatchRuntime({
    repository: store,
    engine: createCheckersMatchRuntimeAdapter(),
    publish: async ({ matchId, eventType }) => realtime.publish({ gameId: matchId }, eventType),
  });

  const legacyRequestHandler = server.listeners("request")[0];
  server.removeListener("request", legacyRequestHandler);
  server.on("request", async (request, response) => {
    const match = new URL(request.url, "http://localhost").pathname.match(MOVE_PATH);
    if (request.method !== "POST" || !match) return legacyRequestHandler(request, response);

    try {
      trafficGuard.assertAllowed(request);
      if (sharedTrafficGuard && !sharedRequestGuardExternally) await sharedTrafficGuard.assertAllowed(request);
      assertSameOriginMutation(request);

      const user = await trustedUser(request, auth, authSessions);
      await assertAccountLimits(trafficGuard, sharedTrafficGuard, { request, userId: user.userId, action: "move" });
      const playerId = user.userId;
      const gameId = match[1];
      const body = await readJson(request);
      assertRequestId(body.requestId);

      const loaded = await store.loadMatchRuntime(gameId);
      const idempotencyKey = checkersMoveIdempotencyKey(playerId, body.requestId);
      const processedSequence = loaded.state.processedRequests?.[`${playerId}:${body.requestId}`];

      if (processedSequence && !await hasDurableRuntimeCommand(store, gameId, idempotencyKey)) {
        return sendJson(response, 200, {
          duplicate: true,
          eventSequence: processedSequence,
          snapshot: getSessionSnapshot(loaded.state, playerId),
        });
      }

      const result = await matchRuntime.executeCommand({
        matchId: gameId,
        expectedVersion: loaded.version,
        idempotencyKey,
        command: {
          type: "move",
          playerId,
          requestId: body.requestId,
          move: body.move,
        },
        viewerId: playerId,
      });

      const eventSequence = result.snapshot.lastEventSequence;
      const snapshot = result.replayed
        ? getSessionSnapshot((await store.loadMatchRuntime(gameId)).state, playerId)
        : result.snapshot;

      return sendJson(response, 200, {
        duplicate: result.replayed,
        eventSequence,
        snapshot,
      });
    } catch (error) {
      logger.error(error);
      return sendMoveError(response, error);
    }
  });

  return server;
}

function supportsMatchRuntime(store) {
  return typeof store?.loadMatchRuntime === "function"
    && typeof store?.claimMatchOwnership === "function"
    && typeof store?.executeMatchRuntimeCommand === "function";
}

function assertRequestId(requestId) {
  if (typeof requestId !== "string" || requestId.length < 1 || requestId.length > 128) {
    throw new SessionError("Pole requestId musi być krótkim tekstem.", "INVALID_ID");
  }
}

function checkersMoveIdempotencyKey(playerId, requestId) {
  return createHash("sha256").update(`checkers:move:${playerId}:${requestId}`).digest("hex");
}

async function hasDurableRuntimeCommand(store, matchId, idempotencyKey) {
  const { rowCount } = await store.pool.query(
    "SELECT 1 FROM gracz_match_runtime_commands WHERE match_id = $1 AND idempotency_key = $2 LIMIT 1",
    [matchId, idempotencyKey],
  );
  return rowCount > 0;
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
  if (typeof playerId !== "string" || playerId.length < 1 || playerId.length > 128) {
    const error = new Error("Brak tożsamości gracza.");
    error.code = "UNAUTHENTICATED";
    error.status = 401;
    throw error;
  }
  return { userId: playerId, displayName: playerId };
}

async function assertAccountLimits(localGuard, sharedGuard, input) {
  localGuard.assertAccountAllowed(input);
  if (sharedGuard) await sharedGuard.assertAccountAllowed(input);
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

function assertSameOriginMutation(request) {
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite === "cross-site") throw httpError("Żądanie z obcej strony zostało zablokowane.", "CROSS_SITE_REQUEST", 403);
  const origin = request.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; }
  catch { throw httpError("Nieprawidłowe źródło żądania.", "CROSS_SITE_REQUEST", 403); }
  if (originHost !== request.headers.host) throw httpError("Żądanie z obcej strony zostało zablokowane.", "CROSS_SITE_REQUEST", 403);
}

async function readJson(request, maxBytes = 16_384) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBytes) throw httpError("Żądanie jest za duże.", "PAYLOAD_TOO_LARGE", 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw httpError("Nieprawidłowy JSON.", "INVALID_JSON", 400); }
}

function sendMoveError(response, error) {
  if (response.headersSent || response.writableEnded) return;
  if (error instanceof SessionNotFoundError) return sendJson(response, 404, errorBody(error));
  if (error instanceof AuthError) return sendJson(response, 401, errorBody(error));
  if (error instanceof TrafficLimitError || error instanceof RateLimitError || error instanceof DistributedRateLimitError) {
    response.setHeader("Retry-After", String(error.retryAfterSeconds || 1));
    return sendJson(response, 429, errorBody(error));
  }
  if (error instanceof SharedInfrastructureUnavailableError) return sendJson(response, 503, errorBody(error));
  if (error instanceof SessionError || error?.name === "IllegalMoveError" || error instanceof TypeError) return sendJson(response, 400, errorBody(error));
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) return sendJson(response, error.status, errorBody(error));
  return sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "Wewnętrzny błąd serwera." } });
}

function httpError(message, code, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function errorBody(error) {
  return { error: { code: error.code ?? "INVALID_REQUEST", message: error.message } };
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
