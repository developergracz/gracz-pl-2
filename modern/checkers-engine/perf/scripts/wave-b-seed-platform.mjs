import { LobbyService } from "../../src/lobby.js";
import { PostgresSessionStore } from "../../src/postgres-session-store.js";
import { PostgresThousandRepository } from "../../src/thousand-repository.js";
import { ThousandGameService } from "../../src/thousand-service.js";
import { PostgresGomokuService } from "../../src/postgres-gomoku-service.js";

export async function createWaveBSeedPlatform(databaseUrl) {
  if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
    throw new TypeError("DATABASE_URL required for Wave B seed platform");
  }

  let store = null;
  let thousandService = null;
  let gomokuService = null;

  try {
    store = new PostgresSessionStore(databaseUrl);
    await store.ready;

    const thousandRepository = new PostgresThousandRepository(databaseUrl);
    thousandService = new ThousandGameService({ repository: thousandRepository });
    await thousandRepository.ready;

    gomokuService = new PostgresGomokuService(databaseUrl);
    await gomokuService.ready;

    const lobby = new LobbyService({
      sessionStore: store,
      thousandService,
      gomokuService,
      pool: store.pool,
    });
    await lobby.ready;

    let closed = false;
    return Object.freeze({
      lobby,
      async close() {
        if (closed) return;
        closed = true;
        const results = await Promise.allSettled([
          gomokuService.close(),
          thousandService.close(),
          store.close(),
        ]);
        const failure = results.find((result) => result.status === "rejected");
        if (failure) throw failure.reason;
      },
    });
  } catch (error) {
    await Promise.allSettled([
      gomokuService?.close?.(),
      thousandService?.close?.(),
      store?.close?.(),
    ]);
    throw error;
  }
}
