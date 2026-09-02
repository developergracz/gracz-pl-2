import { randomUUID } from "node:crypto";
import pg from "pg";
import { GomokuError } from "./gomoku-service.js";

const { Pool } = pg;

export class PostgresGomokuService {
  constructor(connectionString, { idGenerator = randomUUID, size = 15 } = {}) {
    if (!connectionString) throw new TypeError("DATABASE_URL jest wymagany dla trwałego Gomoku.");
    if (!Number.isInteger(size) || size < 5 || size > 25) throw new TypeError("Rozmiar planszy Gomoku musi wynosić od 5 do 25 pól.");
    this.idGenerator = idGenerator;
    this.size = size;
    this.pool = new Pool({ connectionString, ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false }, max: 4 });
    this.ready = this.#init();
  }

  async #init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS gracz_gomoku_games (
      game_id VARCHAR(128) PRIMARY KEY,
      state JSONB NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  }

  async createGame({ gameId = null, players } = {}) {
    await this.ready;
    const normalized = normalizePlayers(players);
    const id = gameId || `gomoku-${this.idGenerator()}`;
    assertGameId(id);
    const game = { gameId: id, size: this.size, players: { black: normalized[0], white: normalized[1] }, turn: "black", status: "active", winner: null, moves: [], revision: 0, createdAt: Date.now(), updatedAt: Date.now() };
    try {
      await this.pool.query(`INSERT INTO gracz_gomoku_games(game_id,state,revision) VALUES($1,$2::jsonb,0)`, [id, JSON.stringify(game)]);
    } catch (error) {
      if (error?.code !== "23505") throw error;
      const existing = await this.#load(id);
      const same = existing.players.black.userId === normalized[0].userId && existing.players.white.userId === normalized[1].userId;
      if (!same) throw new GomokuError("Identyfikator partii jest już używany przez innych graczy.", "GAME_ALREADY_EXISTS");
    }
    return this.view(id, normalized[0].userId);
  }

  async view(gameId, userId) {
    await this.ready;
    return playerView(await this.#load(gameId), userId);
  }

  async move(gameId, userId, input = {}) {
    await this.ready;
    const current = await this.#load(gameId);
    const next = applyMove(current, userId, input);
    if (next === current) return playerView(current, userId);
    const result = await this.pool.query(
      `UPDATE gracz_gomoku_games SET state=$2::jsonb, revision=$3, updated_at=NOW() WHERE game_id=$1 AND revision=$4 RETURNING revision`,
      [gameId, JSON.stringify(next), next.revision, current.revision],
    );
    if (result.rowCount !== 1) {
      const latest = await this.#load(gameId);
      if (input.requestId && latest.moves.some((m) => m.requestId === input.requestId && m.userId === userId)) return playerView(latest, userId);
      const error = new GomokuError("Stan partii zmienił się równolegle. Odśwież partię i ponów ruch.", "GOMOKU_CONCURRENCY_CONFLICT");
      error.status = 409;
      throw error;
    }
    return playerView(next, userId);
  }

  async #load(gameId) {
    assertGameId(gameId);
    const { rows } = await this.pool.query(`SELECT state,revision FROM gracz_gomoku_games WHERE game_id=$1`, [gameId]);
    if (!rows[0]) throw new GomokuError("Partia Gomoku nie istnieje.", "GAME_NOT_FOUND");
    const game = typeof rows[0].state === "string" ? JSON.parse(rows[0].state) : rows[0].state;
    game.revision = Number(rows[0].revision);
    return game;
  }

  async close() { await this.pool.end(); }
}

function normalizePlayers(players) {
  if (!Array.isArray(players) || players.length !== 2) throw new GomokuError("Gomoku wymaga dokładnie dwóch graczy.", "INVALID_PLAYERS");
  const out = players.map((player) => {
    const userId = String(player?.userId ?? "").trim(); const displayName = String(player?.displayName ?? "").trim();
    if (!userId || userId.length > 128 || !displayName || displayName.length > 128) throw new GomokuError("Dane gracza są nieprawidłowe.", "INVALID_PLAYER");
    return { userId, displayName: displayName.normalize("NFC") };
  });
  if (out[0].userId === out[1].userId) throw new GomokuError("Partia wymaga dwóch różnych graczy.", "DUPLICATE_PLAYER");
  return out;
}

function playerView(game, userId) {
  const color = game.players.black.userId === userId ? "black" : game.players.white.userId === userId ? "white" : null;
  if (!color) throw new GomokuError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  return structuredClone({ ...game, color, canMove: game.status === "active" && game.turn === color });
}

function applyMove(game, userId, { row, column, requestId = null } = {}) {
  const color = game.players.black.userId === userId ? "black" : game.players.white.userId === userId ? "white" : null;
  if (!color) throw new GomokuError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  if (requestId !== null && (typeof requestId !== "string" || requestId.length < 1 || requestId.length > 128)) throw new GomokuError("Identyfikator żądania jest nieprawidłowy.", "INVALID_REQUEST_ID");
  if (requestId && game.moves.some((m) => m.requestId === requestId && m.userId === userId)) return game;
  if (game.status !== "active") throw new GomokuError("Partia została już zakończona.", "GAME_FINISHED");
  if (game.turn !== color) throw new GomokuError("Teraz trwa ruch przeciwnika.", "OUT_OF_TURN");
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= game.size || column >= game.size) throw new GomokuError("Wybrane pole jest nieprawidłowe.", "INVALID_MOVE");
  if (game.moves.some((m) => m.row === row && m.column === column)) throw new GomokuError("To pole jest już zajęte.", "FIELD_OCCUPIED");
  const next = structuredClone(game);
  next.moves.push({ row, column, color, userId, requestId: requestId || null, sequence: next.moves.length + 1 });
  next.revision += 1; next.updatedAt = Date.now();
  if (hasFive(next.moves, row, column, color)) { next.status = "finished"; next.winner = color; }
  else if (next.moves.length === next.size * next.size) next.status = "draw";
  else next.turn = color === "black" ? "white" : "black";
  return next;
}

function hasFive(moves,row,column,color){const occupied=new Set(moves.filter(m=>m.color===color).map(m=>`${m.row}:${m.column}`));return [[1,0],[0,1],[1,1],[1,-1]].some(([dr,dc])=>1+count(occupied,row,column,dr,dc)+count(occupied,row,column,-dr,-dc)>=5)}
function count(set,row,column,dr,dc){let n=0;for(let r=row+dr,c=column+dc;set.has(`${r}:${c}`);r+=dr,c+=dc)n++;return n}
function assertGameId(id){if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw new GomokuError("Identyfikator partii jest nieprawidłowy.","INVALID_GAME_ID")}
function isLocal(url){return url.includes("localhost")||url.includes("127.0.0.1")}
