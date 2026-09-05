import { randomUUID } from "node:crypto";
import pg from "pg";

import {
  GomokuError,
  assertGomokuSize,
  createGomokuState,
  gomokuPlayerView,
  normalizeGomokuPlayers,
  resolveGomokuIdempotentMove,
  sameGomokuPlayers,
  transitionGomokuMove,
} from "./gomoku-service.js";

const { Pool } = pg;
const TABLE = "gracz_gomoku_games";
const TEST_BEFORE_CAS = Symbol("P1-AUD3-04 before-CAS test seam");
const REQUIRED_COLUMNS = Object.freeze({
  game_id: new Set(["character varying", "text"]),
  state: new Set(["jsonb"]),
  revision: new Set(["integer"]),
  created_at: new Set(["timestamp with time zone"]),
  updated_at: new Set(["timestamp with time zone"]),
});

export class GomokuConcurrencyConflictError extends GomokuError {
  constructor(gameId, expectedRevision) {
    super(`Stan partii ${gameId} zmienił się równolegle przy revision ${expectedRevision}.`, "GOMOKU_CONCURRENCY_CONFLICT");
    this.name = "GomokuConcurrencyConflictError";
    this.status = 409;
  }
}

export class GomokuPersistenceError extends GomokuError {
  constructor(message, code = "GOMOKU_PERSISTENCE_ERROR", cause = null) {
    super(message, code);
    this.name = "GomokuPersistenceError";
    if (cause) this.cause = cause;
  }
}

export function postgresGomokuTestOptions(beforeCas) {
  if (typeof beforeCas !== "function") throw new TypeError("Testowy hook beforeCas musi być funkcją.");
  return { [TEST_BEFORE_CAS]: beforeCas };
}

export class PostgresGomokuService {
  constructor(connectionString, options = {}) {
    if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany dla trwałego Gomoku.");
    if (!options || typeof options !== "object") throw new TypeError("Opcje PostgresGomokuService muszą być obiektem.");
    if (Object.prototype.hasOwnProperty.call(options, "beforeCas")) throw new TypeError("beforeCas jest dostępny wyłącznie przez jawny seam testowy.");
    const { idGenerator = randomUUID, size = 15 } = options;
    const beforeCas = options[TEST_BEFORE_CAS] ?? null;
    assertGomokuSize(size);
    this.idGenerator = idGenerator;
    this.size = size;
    this.beforeCas = beforeCas;
    this.pool = new Pool({
      connectionString,
      ssl: isLocal(connectionString) ? false : { rejectUnauthorized: true },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    this.ready = this.#verifySchema();
  }

  async #verifySchema() {
    try {
      const { rows } = await this.pool.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1`,
        [TABLE],
      );
      const columns = new Map(rows.map((row) => [row.column_name, row]));
      for (const [name, allowedTypes] of Object.entries(REQUIRED_COLUMNS)) {
        const column = columns.get(name);
        if (!column || !allowedTypes.has(column.data_type) || column.is_nullable !== "NO") throw schemaError();
      }
      const primaryKey = await this.pool.query(
        `SELECT a.attname AS column_name
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
         WHERE c.contype = 'p' AND n.nspname = current_schema() AND t.relname = $1
         ORDER BY k.ord`,
        [TABLE],
      );
      if (primaryKey.rows.length !== 1 || primaryKey.rows[0].column_name !== "game_id") throw schemaError();
    } catch (error) {
      if (error instanceof GomokuPersistenceError) throw error;
      throw schemaError(error);
    }
  }

  async createGame({ gameId = null, players } = {}) {
    await this.ready;
    const normalized = normalizeGomokuPlayers(players);
    const id = gameId || `gomoku-${this.idGenerator()}`;
    assertGameId(id);
    const game = createGomokuState({ gameId: id, players: normalized, size: this.size, now: Date.now() });
    const result = await this.pool.query(
      `INSERT INTO gracz_gomoku_games(game_id, state, revision, created_at, updated_at)
       VALUES($1, $2::jsonb, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
       ON CONFLICT (game_id) DO NOTHING
       RETURNING game_id`,
      [id, JSON.stringify(game), game.revision, game.createdAt, game.updatedAt],
    );
    if (result.rowCount === 1) return gomokuPlayerView(game, normalized[0].userId);

    const existing = await this.#load(id);
    if (!sameGomokuPlayers(existing, normalized)) throw new GomokuError("Identyfikator partii jest już używany przez innych graczy.", "GAME_ALREADY_EXISTS");
    return gomokuPlayerView(existing, normalized[0].userId);
  }

  async view(gameId, userId) {
    await this.ready;
    return gomokuPlayerView(await this.#load(gameId), userId);
  }

  async move(gameId, userId, input = {}) {
    await this.ready;
    assertGameId(gameId);
    const current = await this.#load(gameId);
    const next = transitionGomokuMove(current, userId, input, Date.now());
    if (next === current) return gomokuPlayerView(current, userId);

    if (this.beforeCas) await this.beforeCas({ gameId, userId, expectedRevision: current.revision, requestId: input?.requestId ?? null });
    const result = await this.pool.query(
      `UPDATE gracz_gomoku_games
       SET state = $2::jsonb,
           revision = $3,
           updated_at = to_timestamp($4 / 1000.0)
       WHERE game_id = $1 AND revision = $5
       RETURNING revision`,
      [gameId, JSON.stringify(next), next.revision, next.updatedAt, current.revision],
    );
    if (result.rowCount === 1) return gomokuPlayerView(next, userId);

    const latest = await this.#load(gameId);
    if (resolveGomokuIdempotentMove(latest, userId, input)) return gomokuPlayerView(latest, userId);
    throw new GomokuConcurrencyConflictError(gameId, current.revision);
  }

  async #load(gameId) {
    assertGameId(gameId);
    const { rows } = await this.pool.query(
      `SELECT game_id, state, revision, created_at, updated_at
       FROM gracz_gomoku_games
       WHERE game_id = $1`,
      [gameId],
    );
    if (!rows[0]) throw new GomokuError("Partia Gomoku nie istnieje.", "GAME_NOT_FOUND");
    return decodeState(rows[0]);
  }

  async close() {
    await this.pool.end();
  }
}

function decodeState(row) {
  try {
    const game = typeof row.state === "string" ? JSON.parse(row.state) : structuredClone(row.state);
    const revision = Number(row.revision);
    if (!game || typeof game !== "object" || Array.isArray(game)) throw stateError();
    if (game.gameId !== row.game_id) throw stateError();
    assertGameId(game.gameId);
    assertGomokuSize(game.size);
    if (!Number.isInteger(revision) || revision < 0 || game.revision !== revision) throw stateError();
    if (!Number.isInteger(game.createdAt) || game.createdAt <= 0 || !Number.isInteger(game.updatedAt) || game.updatedAt < game.createdAt) throw stateError();
    if (new Date(row.created_at).getTime() !== game.createdAt || new Date(row.updated_at).getTime() !== game.updatedAt) throw stateError();
    if (!isCanonicalPlayer(game.players?.black) || !isCanonicalPlayer(game.players?.white)) throw stateError();
    const normalizedPlayers = normalizeGomokuPlayers([game.players.black, game.players.white]);
    if (normalizedPlayers[0].userId !== game.players.black.userId || normalizedPlayers[0].displayName !== game.players.black.displayName) throw stateError();
    if (normalizedPlayers[1].userId !== game.players.white.userId || normalizedPlayers[1].displayName !== game.players.white.displayName) throw stateError();
    if (!["black", "white"].includes(game.turn)) throw stateError();
    if (!["active", "finished", "draw"].includes(game.status)) throw stateError();
    if (![null, "black", "white"].includes(game.winner)) throw stateError();
    if (!Array.isArray(game.moves) || game.moves.length !== revision || game.moves.length > game.size * game.size) throw stateError();

    const occupied = new Set();
    const requests = new Set();
    let expectedColor = "black";
    for (let index = 0; index < game.moves.length; index += 1) {
      const move = game.moves[index];
      if (!move || typeof move !== "object" || Array.isArray(move)) throw stateError();
      if (!Number.isInteger(move.row) || !Number.isInteger(move.column) || move.row < 0 || move.column < 0 || move.row >= game.size || move.column >= game.size) throw stateError();
      if (move.color !== expectedColor) throw stateError();
      const expectedUserId = game.players[move.color].userId;
      if (typeof move.userId !== "string" || move.userId !== expectedUserId) throw stateError();
      if (move.requestId !== null && (typeof move.requestId !== "string" || move.requestId.length < 1 || move.requestId.length > 128)) throw stateError();
      if (move.sequence !== index + 1) throw stateError();
      const coordinate = `${move.row}:${move.column}`;
      if (occupied.has(coordinate)) throw stateError();
      occupied.add(coordinate);
      if (move.requestId !== null) {
        const requestKey = `${move.userId}\0${move.requestId}`;
        if (requests.has(requestKey)) throw stateError();
        requests.add(requestKey);
      }
      expectedColor = expectedColor === "black" ? "white" : "black";
    }

    const lastMove = game.moves.at(-1) || null;
    if (game.status === "active") {
      if (game.winner !== null || game.turn !== expectedColor) throw stateError();
    } else if (game.status === "draw") {
      if (game.winner !== null || game.moves.length !== game.size * game.size || !lastMove || game.turn !== lastMove.color) throw stateError();
    } else if (!lastMove || game.winner !== lastMove.color || game.turn !== game.winner) {
      throw stateError();
    }
    return game;
  } catch (error) {
    if (error instanceof GomokuPersistenceError && error.code === "GOMOKU_STATE_INVALID") throw error;
    throw stateError(error);
  }
}

function isCanonicalPlayer(player) {
  return Boolean(player)
    && typeof player === "object"
    && !Array.isArray(player)
    && typeof player.userId === "string"
    && player.userId.length >= 1
    && player.userId.length <= 128
    && player.userId === player.userId.trim()
    && typeof player.displayName === "string"
    && player.displayName.length >= 1
    && player.displayName.length <= 128
    && player.displayName === player.displayName.trim()
    && player.displayName === player.displayName.normalize("NFC");
}
function stateError(cause = null) {
  return new GomokuPersistenceError("Trwały stan Gomoku jest niespójny.", "GOMOKU_STATE_INVALID", cause);
}
function schemaError(cause = null) {
  return new GomokuPersistenceError("Schemat PostgreSQL dla Gomoku jest brakujący lub niezgodny.", "GOMOKU_SCHEMA_INVALID", cause);
}
function assertGameId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new GomokuError("Identyfikator partii jest nieprawidłowy.", "INVALID_GAME_ID");
}
function isLocal(url) { return url.includes("localhost") || url.includes("127.0.0.1"); }
