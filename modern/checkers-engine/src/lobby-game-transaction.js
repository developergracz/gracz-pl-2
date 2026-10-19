import { createGameSession, deserializeSession, serializeSession } from "./session.js";
import { createThousandInitialState, shuffleThousandDeck } from "./thousand-engine.js";
import { createGomokuState, normalizeGomokuPlayers, sameGomokuPlayers } from "./gomoku-service.js";

export class LobbyGameIdentityConflictError extends Error {
  constructor(gameId) {
    super(`Identyfikator gry ${gameId} istnieje, ale należy do innego zestawu graczy.`);
    this.name = "LobbyGameIdentityConflictError";
    this.code = "LOBBY_GAME_IDENTITY_CONFLICT";
    this.status = 409;
  }
}

/**
 * Atomic same-database game creation for Lobby.
 *
 * The caller owns the PostgreSQL transaction and supplies its client. This
 * coordinator deliberately writes through that exact client so durable game
 * creation and the Lobby `playing` transition can commit or roll back as one
 * unit. Existing deterministic game ids are reconciled by participant identity
 * to heal orphan games produced by the pre-correction lifecycle.
 */
export async function ensureLobbyGameInTransaction({
  client,
  room,
  thousandService = null,
  gomokuService = null,
} = {}) {
  assertClient(client);
  assertRoom(room);

  if (room.gameType === "thousand") {
    if (!thousandService || !thousandService.repository?.pool) throw unavailable("Tysiąca");
    return ensureThousand(client, room, thousandService);
  }

  if (room.gameType === "gomoku") {
    if (!gomokuService || !gomokuService.pool) throw unavailable("Gomoku");
    return ensureGomoku(client, room, gomokuService);
  }

  if (room.gameType !== "checkers") throw new TypeError("Nieobsługiwany typ gry Lobby.");
  return ensureCheckers(client, room);
}

async function ensureCheckers(client, room) {
  const gameId = `game-${room.roomId}`;
  const session = createGameSession({
    gameId,
    whitePlayerId: room.seats[0].id,
    blackPlayerId: room.seats[1].id,
  });
  const inserted = await client.query(
    `INSERT INTO gracz_game_sessions(game_id,state,version)
     VALUES($1,$2,1)
     ON CONFLICT(game_id) DO NOTHING
     RETURNING game_id`,
    [gameId, serializeSession(session)],
  );
  if (inserted.rowCount === 1) return gameId;

  const existing = await client.query(
    `SELECT state FROM gracz_game_sessions WHERE game_id=$1 FOR SHARE`,
    [gameId],
  );
  if (!existing.rows[0]) throw new Error(`Nie udało się odczytać istniejącej sesji ${gameId}.`);
  const current = deserializeSession(existing.rows[0].state);
  const same = current?.players?.white?.id === room.seats[0].id
    && current?.players?.black?.id === room.seats[1].id;
  if (!same) throw new LobbyGameIdentityConflictError(gameId);
  return gameId;
}

async function ensureThousand(client, room, service) {
  const gameId = `thousand-${room.roomId}`;
  const players = normalizeThousandPlayers(room.seats.map((seat) => ({
    userId: seat.id,
    displayName: seat.name,
  })));
  const random = typeof service.random === "function" ? service.random : Math.random;
  const deck = shuffleThousandDeck(undefined, random);
  const state = createThousandInitialState({ dealerIndex: 0, deck, playerCount: players.length });
  const inserted = await client.query(
    `INSERT INTO gracz_thousand_games(game_id,players,state,revision)
     VALUES($1,$2::jsonb,$3::jsonb,1)
     ON CONFLICT(game_id) DO NOTHING
     RETURNING game_id`,
    [gameId, JSON.stringify(players), JSON.stringify(state)],
  );
  if (inserted.rowCount === 1) return gameId;

  const existing = await client.query(
    `SELECT players FROM gracz_thousand_games WHERE game_id=$1 FOR SHARE`,
    [gameId],
  );
  if (!existing.rows[0]) throw new Error(`Nie udało się odczytać istniejącej gry Tysiąc ${gameId}.`);
  const currentPlayers = Array.isArray(existing.rows[0].players)
    ? existing.rows[0].players
    : JSON.parse(existing.rows[0].players || "[]");
  if (!samePlayerIds(currentPlayers, players)) throw new LobbyGameIdentityConflictError(gameId);
  return gameId;
}

async function ensureGomoku(client, room, service) {
  const gameId = `gomoku-${room.roomId}`;
  const players = normalizeGomokuPlayers(room.seats.map((seat) => ({
    userId: seat.id,
    displayName: seat.name,
  })));
  const now = Date.now();
  const game = createGomokuState({
    gameId,
    players,
    size: Number.isInteger(service.size) ? service.size : 15,
    now,
  });
  const inserted = await client.query(
    `INSERT INTO gracz_gomoku_games(game_id,state,revision,created_at,updated_at)
     VALUES($1,$2::jsonb,$3,to_timestamp($4 / 1000.0),to_timestamp($5 / 1000.0))
     ON CONFLICT(game_id) DO NOTHING
     RETURNING game_id`,
    [gameId, JSON.stringify(game), game.revision, game.createdAt, game.updatedAt],
  );
  if (inserted.rowCount === 1) return gameId;

  const existing = await client.query(
    `SELECT state FROM gracz_gomoku_games WHERE game_id=$1 FOR SHARE`,
    [gameId],
  );
  if (!existing.rows[0]) throw new Error(`Nie udało się odczytać istniejącej gry Gomoku ${gameId}.`);
  const current = typeof existing.rows[0].state === "string"
    ? JSON.parse(existing.rows[0].state)
    : existing.rows[0].state;
  if (!sameGomokuPlayers(current, players)) throw new LobbyGameIdentityConflictError(gameId);
  return gameId;
}

function normalizeThousandPlayers(players) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) {
    const error = new Error("Tysiąc obsługuje od dwóch do czterech graczy.");
    error.code = "INVALID_PLAYER_COUNT";
    throw error;
  }
  const seen = new Set();
  return players.map((player, index) => {
    const userId = String(player?.userId ?? "").trim().toLowerCase();
    const displayName = String(player?.displayName ?? "").trim();
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(userId)) throw invalidThousandPlayer(index);
    if (displayName.length < 1 || displayName.length > 64) throw invalidThousandPlayer(index);
    if (seen.has(userId)) {
      const error = new Error("Każde miejsce przy stole musi należeć do innego gracza.");
      error.code = "DUPLICATE_PLAYER";
      throw error;
    }
    seen.add(userId);
    return { userId, displayName };
  });
}

function samePlayerIds(left, right) {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  return left.every((player, index) => String(player?.userId ?? "").trim().toLowerCase() === right[index].userId);
}

function invalidThousandPlayer(index) {
  const error = new Error(`Nieprawidłowy identyfikator lub nazwa gracza na miejscu ${index + 1}.`);
  error.code = "INVALID_PLAYER";
  return error;
}

function unavailable(label) {
  const error = new Error(`Silnik ${label} nie udostępnia trwałej warstwy PostgreSQL wymaganej przez atomowy start Lobby.`);
  error.code = "GAME_SERVICE_UNAVAILABLE";
  return error;
}

function assertClient(client) {
  if (!client || typeof client.query !== "function") throw new TypeError("Klient transakcji PostgreSQL jest wymagany.");
}

function assertRoom(room) {
  if (!room || typeof room.roomId !== "string" || !room.roomId) throw new TypeError("Pokój Lobby jest wymagany.");
  if (!Array.isArray(room.seats) || !room.seats.length || room.seats.some((seat) => !seat?.id)) throw new TypeError("Wszystkie miejsca Lobby muszą być zajęte.");
}
