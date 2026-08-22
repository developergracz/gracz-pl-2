import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { FileAccountService } from "./accounts.js";
import { PostgresAccountService } from "./postgres-accounts.js";
import { SecureAccountService } from "./secure-accounts.js";
import { MessageAttachmentService } from "./message-attachments.js";
import { AuthService } from "./auth.js";
import { MemoryAuthSessionStore, PostgresAuthSessionStore } from "./auth-sessions.js";
import { loadConfig } from "./config.js";
import { LobbyService } from "./lobby.js";
import { createGameHttpServer } from "./server.js";
import { FileSessionStore } from "./store.js";
import { PostgresSessionStore } from "./postgres-session-store.js";

const config = loadConfig();

const store = config.databaseUrl
  ? new PostgresSessionStore(config.databaseUrl)
  : new FileSessionStore(join(config.dataDirectory, "sessions"));
if (config.databaseUrl && store.ready) await store.ready;

const baseAccounts = config.databaseUrl
  ? new PostgresAccountService(config.databaseUrl, config.authSecret)
  : new FileAccountService(join(config.dataDirectory, "accounts.json"));
if (config.databaseUrl && baseAccounts.ready) await baseAccounts.ready;

const accounts = config.databaseUrl
  ? new SecureAccountService(baseAccounts, config.databaseUrl)
  : baseAccounts;
if (config.databaseUrl && accounts.ready) await accounts.ready;

const authSessions = config.databaseUrl
  ? new PostgresAuthSessionStore(config.databaseUrl)
  : new MemoryAuthSessionStore();
if (authSessions.ready) await authSessions.ready;

const messageAttachments = config.databaseUrl
  ? new MessageAttachmentService(config.databaseUrl, config.authSecret)
  : null;
if (messageAttachments?.ready) await messageAttachments.ready;

const server = createGameHttpServer({
  store,
  accounts,
  authSessions,
  messageAttachments,
  auth: new AuthService({ secret: config.authSecret }),
  lobby: new LobbyService({ sessionStore: store }),
  webRoot: fileURLToPath(new URL("../web", import.meta.url)),
  logger: console,
});

// Warstwa nagłówków ochronnych. Inline JS/CSS pozostaje czasowo dopuszczony tylko
// dlatego, że część odziedziczonego frontendu nie została jeszcze rozdzielona na
// osobne pliki. Docelowo polityka CSP przejdzie na nonce/hash bez unsafe-inline.
server.prependListener("request", (_request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Origin-Agent-Cluster", "?1");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'none'; worker-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
  );
  response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
});

server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;

server.listen(config.port, config.host, () => {
  console.log(`CheckersEngine działa na http://${config.host}:${config.port}`);
  console.log(`Magazyn kont: ${config.databaseUrl ? "PostgreSQL + wersjonowane haszowanie" : "plik lokalny (tryb developerski)"}`);
  console.log(`Magazyn sesji gier: ${config.databaseUrl ? "PostgreSQL" : "plik lokalny (tryb developerski)"}`);
  console.log(`Rejestr sesji logowania: ${config.databaseUrl ? "PostgreSQL" : "pamięć procesu (tryb developerski)"}`);
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
      process.exit(0);
    } catch (error) {
      console.error("Błąd podczas zamykania aplikacji:", error);
      process.exit(1);
    }
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown(signal));
}
