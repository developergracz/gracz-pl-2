import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { FileAccountService } from "./accounts.js";
import { PostgresAccountService } from "./postgres-accounts.js";
import { MessageAttachmentService } from "./message-attachments.js";
import { AuthService } from "./auth.js";
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

const accounts = config.databaseUrl
  ? new PostgresAccountService(config.databaseUrl, config.authSecret)
  : new FileAccountService(join(config.dataDirectory, "accounts.json"));
if (config.databaseUrl && accounts.ready) await accounts.ready;

const messageAttachments = config.databaseUrl
  ? new MessageAttachmentService(config.databaseUrl, config.authSecret)
  : null;
if (messageAttachments?.ready) await messageAttachments.ready;

const server = createGameHttpServer({
  store,
  accounts,
  messageAttachments,
  auth: new AuthService({ secret: config.authSecret }),
  lobby: new LobbyService({ sessionStore: store }),
  webRoot: fileURLToPath(new URL("../web", import.meta.url)),
  logger: console,
});

// Nagłówki ochronne ustawiane przed głównym handlerem HTTP. Polityka CSP pozostawia
// inline CSS/JS wyłącznie przejściowo, dopóki frontend lobby nie zostanie rozdzielony
// na pliki bez skryptów inline. Pozostałe źródła są ograniczone do tej samej domeny.
server.prependListener("request", (_request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  response.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
});

// Jawne limity HTTP ograniczają ryzyko połączeń wiszących oraz prostych ataków
// typu slow-client. Wartości są konserwatywne dla lekkiego API gier i lobby.
server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;

server.listen(config.port, config.host, () => {
  console.log(`CheckersEngine działa na http://${config.host}:${config.port}`);
  console.log(`Magazyn kont: ${config.databaseUrl ? "PostgreSQL" : "plik lokalny (tryb developerski)"}`);
  console.log(`Magazyn sesji gier: ${config.databaseUrl ? "PostgreSQL" : "plik lokalny (tryb developerski)"}`);
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
