const VERSION = 1;
const MESSAGE_TYPES = new Set(["game.move", "game.state", "game.error"]);

export class ProtocolError extends Error {
  constructor(message, code = "INVALID_MESSAGE") {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
  }
}

export function createMoveMessage({ gameId, playerId, move, requestId }) {
  requireText(gameId, "gameId");
  requireText(playerId, "playerId");
  requireText(requestId, "requestId");
  validateMove(move);
  return Object.freeze({
    version: VERSION,
    type: "game.move",
    gameId,
    playerId,
    requestId,
    payload: { move: structuredClone(move) },
  });
}

export function encodeMessage(message) {
  validateEnvelope(message);
  return JSON.stringify(message);
}

export function decodeMessage(raw) {
  if (typeof raw !== "string" || raw.length > 16_384) {
    throw new ProtocolError("Wiadomość musi być tekstem krótszym niż 16 KB.");
  }
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    throw new ProtocolError("Wiadomość nie jest prawidłowym JSON-em.");
  }
  validateEnvelope(message);
  if (message.type === "game.move") validateMove(message.payload?.move);
  return message;
}

function validateEnvelope(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new ProtocolError("Wiadomość musi być obiektem.");
  }
  if (message.version !== VERSION) throw new ProtocolError("Nieobsługiwana wersja protokołu.", "UNSUPPORTED_VERSION");
  if (!MESSAGE_TYPES.has(message.type)) throw new ProtocolError("Nieznany typ wiadomości.", "UNKNOWN_TYPE");
  requireText(message.gameId, "gameId");
  if (message.type === "game.move") {
    requireText(message.playerId, "playerId");
    requireText(message.requestId, "requestId");
  }
}

function validateMove(move) {
  for (const position of [move?.from, move?.to]) {
    if (!Number.isInteger(position?.row) || !Number.isInteger(position?.column)
      || position.row < 0 || position.row > 7 || position.column < 0 || position.column > 7) {
      throw new ProtocolError("Ruch zawiera nieprawidłowe współrzędne.", "INVALID_MOVE");
    }
  }
}

function requireText(value, field) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) {
    throw new ProtocolError(`Pole ${field} musi być krótkim tekstem.`);
  }
}
