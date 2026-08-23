import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { FileAccountService } from "./accounts.js";
import { PostgresAccountService } from "./postgres-accounts.js";
import { SecureAccountService } from "./secure-accounts.js";
import { MessageAttachmentService } from "./message-attachments.js";
import { AuthService } from "./auth.js";
import { MemoryAuthSessionStore, PostgresAuthSessionStore } from "./auth-sessions.js";
import { loadConfig } from "./config.js";
import { LobbyService } from "./lobby.js";
import { GlobalChatService, createGlobalChatHandler } from "./global-chat.js";
import { TournamentService, createTournamentHandler } from "./tournaments.js";
import { RankingService, createRankingHandler } from "./rankings.js";
import { NewsletterService, NewsletterError, createNewsletterHandler } from "./newsletter.js";
import { hardenNewsletterTokens } from "./newsletter-token-security.js";
import { moderateNick } from "./nick-moderation.js";
import { protectNewsletterRequest, verifyNewsletterHuman, isRateLimitError } from "./public-security.js";
import { createGameHttpServer } from "./server.js";
import { FileSessionStore } from "./store.js";
import { PostgresSessionStore } from "./postgres-session-store.js";

const config = loadConfig();
const turnstileEnabled = Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
const webRoot = fileURLToPath(new URL("../web", import.meta.url));

const store = config.databaseUrl ? new PostgresSessionStore(config.databaseUrl) : new FileSessionStore(join(config.dataDirectory, "sessions"));
if (config.databaseUrl && store.ready) await store.ready;
const baseAccounts = config.databaseUrl ? new PostgresAccountService(config.databaseUrl, config.authSecret) : new FileAccountService(join(config.dataDirectory, "accounts.json"));
if (config.databaseUrl && baseAccounts.ready) await baseAccounts.ready;
const accounts = config.databaseUrl ? new SecureAccountService(baseAccounts, config.databaseUrl) : baseAccounts;
if (config.databaseUrl && accounts.ready) await accounts.ready;
const authSessions = config.databaseUrl ? new PostgresAuthSessionStore(config.databaseUrl) : new MemoryAuthSessionStore();
if (authSessions.ready) await authSessions.ready;
const messageAttachments = config.databaseUrl ? new MessageAttachmentService(config.databaseUrl, config.authSecret) : null;
if (messageAttachments?.ready) await messageAttachments.ready;

const auth = new AuthService({ secret: config.authSecret });
const globalChat = new GlobalChatService(config.databaseUrl || null); await globalChat.ready;
const globalChatHandler = createGlobalChatHandler({ service: globalChat, auth, authSessions });
const tournaments = new TournamentService(config.databaseUrl || null); await tournaments.ready;
const tournamentHandler = createTournamentHandler({ service: tournaments, auth, authSessions });
const rankings = new RankingService(config.databaseUrl || null); await rankings.ready;
const rankingHandler = createRankingHandler({ service: rankings, auth, authSessions });
const newsletter = new NewsletterService(config.databaseUrl || null); await newsletter.ready;
await hardenNewsletterTokens(newsletter);

function assertAllowedNewsletterNick(nick) {
  const cleanNick = String(nick || "").trim();
  if (!cleanNick) return;
  const moderation = moderateNick(cleanNick);
  if (moderation.allowed) return;
  if (moderation.reason === "reserved") {
    throw new NewsletterError("Ten nick jest zastrzeżony przez administrację Gracz.pl. Wybierz inny.", "NICK_RESERVED", 400);
  }
  throw new NewsletterError("Ten nick zawiera niedozwolone lub obraźliwe treści. Wybierz inny nick.", "NICK_BLOCKED", 400);
}

const originalCheckNickAvailability = newsletter.checkNickAvailability.bind(newsletter);
newsletter.checkNickAvailability = async (nick) => {
  assertAllowedNewsletterNick(nick);
  return originalCheckNickAvailability(nick);
};

const originalNewsletterSubscribe = newsletter.subscribe.bind(newsletter);
newsletter.subscribe = async (input = {}) => {
  assertAllowedNewsletterNick(input.preferredNick);
  const human = await verifyNewsletterHuman(input);
  if (!human.ok) throw new NewsletterError("Potwierdź, że nie jesteś botem i spróbuj ponownie.", "HUMAN_VERIFICATION_REQUIRED", 403);
  return originalNewsletterSubscribe(input);
};

const newsletterHandler = createNewsletterHandler(newsletter);
const server = createGameHttpServer({ store, accounts, authSessions, messageAttachments, auth, lobby: new LobbyService({ sessionStore: store }), webRoot, logger: console });

function hostnameFromRequest(request) {
  const forwarded = String(request.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const host = forwarded || String(request.headers.host || "").trim();
  return host.toLowerCase().replace(/^https?:\/\//, "").split(":")[0].replace(/\.$/, "");
}

function isPublicDomain(request) {
  const hostname = hostnameFromRequest(request);
  return hostname === "gracz.pl" || hostname === "www.gracz.pl";
}

function blockPublicAccountAccess(request, response) {
  if (!isPublicDomain(request) || request.method !== "POST") return false;
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname !== "/auth/login" && pathname !== "/auth/register") return false;
  response.writeHead(403, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify({ error: { code: "PUBLIC_LAUNCH_DISABLED", message: "Logowanie i rejestracja są wyłączone do czasu oficjalnego uruchomienia Gracz.pl." } }));
  return true;
}

async function serveExtendedAsset(request, response) {
  if (request.method !== "GET") return false;
  const pathname = new URL(request.url, "http://localhost").pathname;
  const publicDomain = isPublicDomain(request);
  const landing = pathname === "/" || (publicDomain && pathname === "/lobby.html");
  const file = landing ? "coming-soon.html" : ({
    "/coming-soon.html": "coming-soon.html",
    "/coming-soon.css": "coming-soon.css",
    "/coming-soon.js": "coming-soon.js",
    "/regulamin-newslettera.html": "regulamin-newslettera.html",
    "/polityka-prywatnosci.html": "polityka-prywatnosci.html",
    "/legal.css": "legal.css",
    "/aktualnosci.html": "aktualnosci.html",
    "/news.css": "news.css",
    "/lobby.html": "lobby.html",
    "/homepage-consoles.js": "homepage-consoles.js",
    "/tournaments.html": "tournaments.html",
    "/tournaments.css": "tournaments.css",
    "/tournaments.js": "tournaments.js",
    "/community.html": "community.html",
    "/community.css": "community.css",
    "/community.js": "community.js",
    "/ranking.html": "ranking.html",
    "/ranking.css": "ranking.css",
    "/ranking.js": "ranking.js",
  })[pathname];
  if (!file) return false;
  const extension = file.split(".").at(-1);
  const contentType = ({ html: "text/html", css: "text/css", js: "text/javascript" })[extension] || "application/octet-stream";
  let content = await readFile(join(webRoot, file));
  if (file === "coming-soon.html") {
    const siteKey = String(process.env.TURNSTILE_SITE_KEY || "").replace(/["'<>]/g, "");
    content = Buffer.from(content.toString("utf8").replaceAll("__TURNSTILE_SITE_KEY__", siteKey));
  }
  response.writeHead(200, {
    "content-type": `${contentType}; charset=utf-8`,
    "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "pragma": "no-cache",
    "expires": "0",
    "surrogate-control": "no-store",
    "vary": "Host, X-Forwarded-Host",
  });
  response.end(content);
  return true;
}

const baseRequestHandler = server.listeners("request")[0];
server.removeAllListeners("request");
server.on("request", async (request, response) => {
  try {
    if (blockPublicAccountAccess(request, response)) return;
    protectNewsletterRequest(request);
    if (await serveExtendedAsset(request, response)) return;
    if (await newsletterHandler(request, response)) return;
    if (await globalChatHandler(request, response)) return;
    if (await tournamentHandler(request, response)) return;
    if (await rankingHandler(request, response)) return;
    return baseRequestHandler(request, response);
  } catch (error) {
    if (isRateLimitError(error)) {
      response.writeHead(429, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": String(error.retryAfterSeconds || 60) });
      response.end(JSON.stringify({ error: { code: "TOO_MANY_ATTEMPTS", message: error.message } }));
      return;
    }
    if (error?.message === "INVALID_ORIGIN") {
      response.writeHead(403, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ error: { code: "INVALID_ORIGIN", message: "Żądanie zostało odrzucone ze względów bezpieczeństwa." } }));
      return;
    }
    console.error("Application request error:", error?.name || "Error");
    if (!response.headersSent && !response.writableEnded) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ error: { code: "APP_INTERNAL_ERROR", message: "Wewnętrzny błąd aplikacji." } }));
    }
  }
});

server.prependListener("request", (_request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Origin-Agent-Cluster", "?1");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  response.setHeader("Cache-Control", "no-store");
  const turnstileOrigin = "https://challenges.cloudflare.com";
  const scriptSrc = turnstileEnabled ? `'self' 'unsafe-inline' ${turnstileOrigin}` : "'self' 'unsafe-inline'";
  const connectSrc = turnstileEnabled ? `'self' ${turnstileOrigin}` : "'self'";
  const frameSrc = turnstileEnabled ? turnstileOrigin : "'none'";
  response.setHeader("Content-Security-Policy", `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src ${connectSrc}; frame-src ${frameSrc}; font-src 'self'; object-src 'none'; media-src 'none'; worker-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`);
  response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
});

server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;
server.listen(config.port, config.host, () => {
  console.log(`Gracz.pl działa na http://${config.host}:${config.port}`);
  console.log("Strona główna: wersja w przygotowaniu + newsletter");
  console.log(`Newsletter: ${config.databaseUrl ? "PostgreSQL" : "tryb developerski"}`);
  console.log(`Turnstile: ${turnstileEnabled ? "włączony" : "wyłączony"}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Otrzymano ${signal}. Zamykanie serwera…`);
  server.close(async () => {
    try {
      if (typeof store.close === "function") await store.close();
      if (typeof accounts.close === "function") await accounts.close();
      if (typeof authSessions.close === "function") await authSessions.close();
      if (messageAttachments && typeof messageAttachments.close === "function") await messageAttachments.close();
      await newsletter.close();
      await globalChat.close();
      await tournaments.close();
      await rankings.close();
      process.exit(0);
    } catch (error) {
      console.error("Błąd podczas zamykania aplikacji:", error?.name || "Error");
      process.exit(1);
    }
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void shutdown(signal));
