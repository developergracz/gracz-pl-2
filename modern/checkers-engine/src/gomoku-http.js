import { AuthError } from "./auth.js";
import { GomokuError } from "./gomoku-service.js";

const SESSION_COOKIE = "__Host-gracz_session";

export function createGomokuHttpHandler({ service, auth, authSessions = null } = {}) {
  if (!service) throw new TypeError("Serwis Gomoku jest wymagany.");
  if (!auth) throw new TypeError("Uwierzytelnianie jest wymagane dla Gomoku.");
  return async function gomokuHttpHandler(request, response) {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith("/gomoku/games/")) return false;
    try {
      assertSameOriginMutation(request);
      const user = await trustedUser(request, auth, authSessions);
      const match = url.pathname.match(/^\/gomoku\/games\/([a-zA-Z0-9_-]{1,128})(?:\/(moves))?$/);
      if (!match) return sendJson(response, 404, { error: { code: "GOMOKU_ROUTE_NOT_FOUND", message: "Nie znaleziono endpointu Gomoku." } });
      const [, gameId, action] = match;
      if (request.method === "GET" && !action) return sendJson(response, 200, service.view(gameId, user.userId));
      if (request.method === "POST" && action === "moves") {
        const body = await readJson(request);
        return sendJson(response, 200, service.move(gameId, user.userId, body));
      }
      return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Niedozwolona metoda." } });
    } catch (error) {
      if (error instanceof AuthError) return sendJson(response, 401, errorBody(error));
      if (error instanceof GomokuError) {
        const status = error.code === "GAME_NOT_FOUND" ? 404 : ["OUT_OF_TURN", "FIELD_OCCUPIED", "GAME_FINISHED"].includes(error.code) ? 409 : error.code === "PLAYER_NOT_IN_GAME" ? 403 : 400;
        return sendJson(response, status, errorBody(error));
      }
      if (Number.isInteger(error?.status)) return sendJson(response, error.status, errorBody(error));
      console.error("Gomoku API error:", error);
      return sendJson(response, 500, { error: { code: "GOMOKU_INTERNAL_ERROR", message: "Wewnętrzny błąd gry Gomoku." } });
    }
  };
}

async function trustedUser(request, auth, authSessions) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE] || bearerToken(request);
  if (!token || token === "cookie") throw new AuthError("Brak aktywnej sesji logowania.");
  const user = auth.verify(token);
  if (authSessions && user.tokenId) {
    if (await authSessions.has(user.tokenId)) await authSessions.assertActive(user);
    else await authSessions.create(user);
  }
  return user;
}
function parseCookies(header) { const result = {}; for (const part of String(header ?? "").split(";")) { const index = part.indexOf("="); if (index < 1) continue; const key = part.slice(0,index).trim(), value = part.slice(index+1).trim(); try { result[key] = decodeURIComponent(value); } catch { result[key] = value; } } return result; }
function bearerToken(request) { const value = String(request.headers.authorization ?? ""); return value.startsWith("Bearer ") ? value.slice(7).trim() || null : null; }
function assertSameOriginMutation(request) { if (!["POST","PUT","PATCH","DELETE"].includes(request.method)) return; if (request.headers["sec-fetch-site"] === "cross-site") throw httpError("Żądanie z obcej strony zostało zablokowane.","CROSS_SITE_REQUEST",403); const origin = request.headers.origin; if (!origin) return; let host; try { host = new URL(origin).host; } catch { throw httpError("Nieprawidłowe źródło żądania.","CROSS_SITE_REQUEST",403); } if (host !== request.headers.host) throw httpError("Żądanie z obcej strony zostało zablokowane.","CROSS_SITE_REQUEST",403); }
async function readJson(request, maxBytes = 8192) { const chunks=[]; let length=0; for await (const chunk of request) { length += chunk.length; if (length > maxBytes) throw httpError("Żądanie jest za duże.","PAYLOAD_TOO_LARGE",413); chunks.push(chunk); } try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw httpError("Nieprawidłowy JSON.","INVALID_JSON",400); } }
function errorBody(error) { return { error: { code: error.code || "GOMOKU_ERROR", message: error.message } }; }
function sendJson(response, status, body) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(body)); return true; }
function httpError(message, code, status) { const error = new Error(message); error.code = code; error.status = status; return error; }
