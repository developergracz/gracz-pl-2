import { randomUUID } from "node:crypto";

export class GomokuError extends Error {
  constructor(message, code = "GOMOKU_ERROR") { super(message); this.name = "GomokuError"; this.code = code; }
}

export class GomokuService {
  #games = new Map();
  constructor({ idGenerator = randomUUID, size = 15 } = {}) {
    if (!Number.isInteger(size) || size < 5 || size > 25) throw new TypeError("Rozmiar planszy Gomoku musi wynosić od 5 do 25 pól.");
    this.idGenerator = idGenerator;
    this.size = size;
  }

  createGame({ gameId = null, players } = {}) {
    if (!Array.isArray(players) || players.length !== 2) throw new GomokuError("Gomoku wymaga dokładnie dwóch graczy.", "INVALID_PLAYERS");
    const normalized = players.map((player) => {
      const userId = String(player?.userId ?? "").trim();
      const displayName = String(player?.displayName ?? "").trim();
      if (!userId || userId.length > 128 || !displayName || displayName.length > 128) throw new GomokuError("Dane gracza są nieprawidłowe.", "INVALID_PLAYER");
      return { userId, displayName: displayName.normalize("NFC") };
    });
    if (normalized[0].userId === normalized[1].userId) throw new GomokuError("Partia wymaga dwóch różnych graczy.", "DUPLICATE_PLAYER");
    const id = gameId || `gomoku-${this.idGenerator()}`;
    if (this.#games.has(id)) {
      const existing = this.#games.get(id);
      const samePlayers = existing.players.black.userId === normalized[0].userId && existing.players.white.userId === normalized[1].userId;
      if (!samePlayers) throw new GomokuError("Identyfikator partii jest już używany przez innych graczy.", "GAME_ALREADY_EXISTS");
      return this.view(id, normalized[0].userId);
    }
    const game = { gameId: id, size: this.size, players: { black: normalized[0], white: normalized[1] }, turn: "black", status: "active", winner: null, moves: [], revision: 0, createdAt: Date.now(), updatedAt: Date.now() };
    this.#games.set(id, game);
    return this.view(id, normalized[0].userId);
  }

  view(gameId, userId) {
    const game = this.#requireGame(gameId);
    const color = this.#colorFor(game, userId);
    if (!color) throw new GomokuError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
    return structuredClone({ ...game, color, canMove: game.status === "active" && game.turn === color });
  }

  move(gameId, userId, { row, column, requestId = null } = {}) {
    const game = this.#requireGame(gameId);
    const color = this.#colorFor(game, userId);
    if (!color) throw new GomokuError("Gracz nie należy do tej partii.", "PLAYER_NOT_IN_GAME");
    if (requestId !== null && (typeof requestId !== "string" || requestId.length < 1 || requestId.length > 128)) throw new GomokuError("Identyfikator żądania jest nieprawidłowy.", "INVALID_REQUEST_ID");
    // A client may repeat a request after losing the HTTP response. Idempotency
    // must be checked before turn and finished-game validation because the
    // original move may already have changed both values.
    if (requestId && game.moves.some((move) => move.requestId === requestId && move.userId === userId)) return this.view(gameId, userId);
    if (game.status !== "active") throw new GomokuError("Partia została już zakończona.", "GAME_FINISHED");
    if (game.turn !== color) throw new GomokuError("Teraz trwa ruch przeciwnika.", "OUT_OF_TURN");
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= game.size || column >= game.size) throw new GomokuError("Wybrane pole jest nieprawidłowe.", "INVALID_MOVE");
    if (game.moves.some((move) => move.row === row && move.column === column)) throw new GomokuError("To pole jest już zajęte.", "FIELD_OCCUPIED");
    game.moves.push({ row, column, color, userId, requestId: requestId || null, sequence: game.moves.length + 1 });
    game.revision += 1; game.updatedAt = Date.now();
    if (hasFive(game.moves, row, column, color)) { game.status = "finished"; game.winner = color; }
    else if (game.moves.length === game.size * game.size) { game.status = "draw"; }
    else game.turn = color === "black" ? "white" : "black";
    return this.view(gameId, userId);
  }

  #requireGame(gameId) { const game = this.#games.get(String(gameId)); if (!game) throw new GomokuError("Partia Gomoku nie istnieje.", "GAME_NOT_FOUND"); return game; }
  #colorFor(game, userId) { if (game.players.black.userId === userId) return "black"; if (game.players.white.userId === userId) return "white"; return null; }
}

function hasFive(moves, row, column, color) {
  const occupied = new Set(moves.filter((move) => move.color === color).map((move) => `${move.row}:${move.column}`));
  return [[1,0],[0,1],[1,1],[1,-1]].some(([dr, dc]) => 1 + count(occupied, row, column, dr, dc) + count(occupied, row, column, -dr, -dc) >= 5);
}
function count(occupied, row, column, dr, dc) { let total = 0; for (let r = row + dr, c = column + dc; occupied.has(`${r}:${c}`); r += dr, c += dc) total += 1; return total; }
