import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { FileAccountService } from "./accounts.js";
import { AuthService } from "./auth.js";
import { loadConfig } from "./config.js";
import { LobbyService } from "./lobby.js";
import { createGameHttpServer } from "./server.js";
import { FileSessionStore } from "./store.js";

const config = loadConfig();
const store = new FileSessionStore(join(config.dataDirectory, "sessions"));
const server = createGameHttpServer({
  store,
  accounts: new FileAccountService(join(config.dataDirectory, "accounts.json")),
  auth: new AuthService({ secret: config.authSecret }),
  lobby: new LobbyService({ sessionStore: store }),
  webRoot: fileURLToPath(new URL("../web", import.meta.url)),
  logger: console,
});

server.listen(config.port, config.host, () => {
  console.log(`CheckersEngine działa na http://${config.host}:${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
