import { randomUUID } from "node:crypto";

export class GomokuError extends Error {
  constructor(message, code = "GOMOKU_ERROR") { super(message); this.name = "GomokuError"; this.code = code; }
}

export function assertGomokuSize(size) {
  if (!Number.isInteger(size) || size < 5 || size > 25) throw new TypeError("Rozmiar planszy Gomoku musi wynosić od 5 do 25 pól.");
  return size;
}

export function normalizeGomokuPlayers(players) {
  if (!Array.isArray(players) || players.length !== 2) throw new GomokuError("Gomoku wymaga dokładnie dwóch graczy.", "INVALID_PLAYERS");
  const normalized = players.map((player) => {
    const userId = String(player?.userId ?? "").trim();
    const displayName = String(player?.displayName ?? "").trim();
    if (!userId || userId.length > 128 || !displayName || displayName.length > 128) throw new GomokuError("Dane gracza są nieprawidłowe.", "INVALID_PLAYER");
    return { userId, displayName: displayName.normalize("NFC") };
  });
  if (normalized[0].userId === normalized[1].userId) throw new GomokuError("Partia wymaga dwóch różnych graczy.", "DUPLICATE_PLAYER");
  return normalized;
}

export function createGomokuState({ gameId, players, size = 15, now = Date.now() } = {}) {
  assertGomokuSize(size);
  const normalized = normalizeGomokuPlayers(players);
  return {
    gameId,
    size,
    players: { black: normalized[0], white: normalized[1] },
    turn: "black",
    status: "active",
    winner: null,
    moves: [],
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function sameGomokuPlayers(game, players) {
  const normalized = normalizeGomokuPlayers(players);
  return game?.players?.black?.userId === normalized[0].userId && game?.players?.white?.userId === normalized[1].userId;
}

export function gomokuPlayerView(game, userId) {
  const color = gomokuColorFor(game, userId);
  if (!color) throw new GomokuError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  return structuredClone({ ...game, color, canMove: game.status === "active" && game.turn === color });
}

export function hasGomokuRequest(game, userId, requestId) {
  return Boolean(requestId) && Array.isArray(game?.moves) && game.moves.some((move) => move.requestId === requestId && move.userId === userId);
}

export function transitionGomokuMove(game, userId, { row, column, requestId = null } = {}, now = Date.now()) {
  const color = gomokuColorFor(game, userId);
  if (!color) throw new GomokuError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
  if (requestId !== null && (typeof requestId !== "string" || requestId.length < 1 || requestId.length > 128)) throw new GomokuError("Identyfikator żądania jest nieprawidłowy.", "INVALID_REQUEST_ID");
  if (hasGomokuRequest(game, userId, requestId)) return game;
  if (game.status !== "active") throw new GomokuError("Partia została już zakończona.", "GAME_FINISHED");
  if (game.turn !== color) throw new GomokuError("Teraz trwa ruch przeciwnika.", "OUT_OF_TURN");
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= game.size || column >= game.size) throw new GomokuError("Wybrane pole jest nieprawidłowe.", "INVALID_MOVE");
  if (game.moves.some((move) => move.row === row && move.column === column)) throw new GomokuError("To pole jest już zajęte.", "FIELD_OCCUPIED");

  const next = structuredClone(game);
  next.moves.push({ row, column, color, userId, requestId: requestId || null, sequence: next.moves.length + 1 });
  next.revision += 1;
  next.updatedAt = now;
  if (hasFive(next.moves, row, column, color)) { next.status = "finished"; next.winner = color; }
  else if (next.moves.length === next.size * next.size) next.status = "draw";
  else next.turn = color === "black" ? "white" : "black";
  return next;
}

export class GomokuService {
  #games = new Map();
  constructor({ idGenerator = randomUUID, size = 15 } = {}) {
    assertGomokuSize(size);
    this.idGenerator = idGenerator;
    this.size = size;
  }

  createGame({ gameId = null, players } = {}) {
    const normalized = normalizeGomokuPlayers(players);
    const id = gameId || `gomoku-${this.idGenerator()}`;
    if (this.#games.has(id)) {
      const existing = this.#games.get(id);
      if (!sameGomokuPlayers(existing, normalized)) throw new GomokuError("Identyfikator partii jest już używany przez innych graczy.", "GAME_ALREADY_EXISTS");
      return gomokuPlayerView(existing, normalized[0].userId);
    }
    const game = createGomokuState({ gameId: id, players: normalized, size: this.size, now: Date.now() });
    this.#games.set(id, game);
    return gomokuPlayerView(game, normalized[0].userId);
  }

  view(gameId, userId) {
    return gomokuPlayerView(this.#requireGame(gameId), userId);
  }

  move(gameId, userId, input = {}) {
    const current = this.#requireGame(gameId);
    const next = transitionGomokuMove(current, userId, input, Date.now());
    if (next !== current) this.#games.set(String(gameId), next);
    return gomokuPlayerView(next, userId);
  }

  #requireGame(gameId) {
    const game = this.#games.get(String(gameId));
    if (!game) throw new GomokuError("Partia Gomoku nie istnieje.", "GAME_NOT_FOUND");
    return game;
  }
}

function gomokuColorFor(game, userId) {
  if (game?.players?.black?.userId === userId) return "black";
  if (game?.players?.white?.userId === userId) return "white";
  return null;
}
function hasFive(moves, row, column, color) {
  const occupied = new Set(moves.filter((move) => move.color === color).map((move) => `${move.row}:${move.column}`));
  return [[1,0],[0,1],[1,1],[1,-1]].some(([dr, dc]) => 1 + count(occupied, row, column, dr, dc) + count(occupied, row, column, -dr, -dc) >= 5);
}
function count(occupied, row, column, dr, dc) { let total = 0; for (let r = row + dr, c = column + dc; occupied.has(`${r}:${c}`); r += dr, c += dc) total += 1; return total; }
