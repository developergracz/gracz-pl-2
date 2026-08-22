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

const config = loadConfig();
const store = new FileSessionStore(join(config.dataDirectory, "sessions"));
const accounts = config.databaseUrl
  ? new PostgresAccountService(config.databaseUrl, config.authSecret)
  : new FileAccountService(join(config.dataDirectory, "accounts.json"));
const messageAttachments = config.databaseUrl
  ? new MessageAttachmentService(config.databaseUrl, config.authSecret)
  : null;

const server = createGameHttpServer({
  store,
  accounts,
  messageAttachments,
  auth: new AuthService({ secret: config.authSecret }),
  lobby: new LobbyService({ sessionStore: store }),
  webRoot: fileURLToPath(new URL("../web", import.meta.url)),
  logger: console,
});

server.listen(config.port, config.host, () => {
  console.log(`CheckersEngine działa na http://${config.host}:${config.port}`);
  console.log(`Magazyn kont: ${config.databaseUrl ? "PostgreSQL" : "plik lokalny (nietrwały na Render Free)"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(async () => {
    if (typeof accounts.close === "function") await accounts.close();
    if (messageAttachments && typeof messageAttachments.close === "function") await messageAttachments.close();
    process.exit(0);
  }));
}
