export class MatchRuntimeError extends Error {
  constructor(message, code = "MATCH_RUNTIME_ERROR", status = 400) {
    super(message);
    this.name = "MatchRuntimeError";
    this.code = code;
    this.status = status;
  }
}

export class CommonMatchRuntime {
  #adapters = new Map();
  #queues = new Map();

  constructor({ adapters = {} } = {}) {
    for (const [gameType, adapter] of Object.entries(adapters)) this.register(gameType, adapter);
  }

  register(gameType, adapter) {
    const key = normalizeGameType(gameType);
    if (!adapter || typeof adapter.execute !== "function" || typeof adapter.getView !== "function") {
      throw new TypeError("Adapter Match Runtime musi implementować execute() i getView().");
    }
    this.#adapters.set(key, adapter);
    return this;
  }

  has(gameType) {
    return this.#adapters.has(normalizeGameType(gameType));
  }

  async execute(input) {
    const command = normalizeCommand(input);
    const adapter = this.#adapter(command.gameType);
    return this.#serialize(command.gameType, command.matchId, async () => {
      const result = await adapter.execute(command);
      return normalizeResult(command, result);
    });
  }

  async getView({ gameType, matchId, actorUserId }) {
    const normalizedGameType = normalizeGameType(gameType);
    const normalizedMatchId = requireText(matchId, "matchId", 128);
    const normalizedActor = requireText(actorUserId, "actorUserId", 128);
    const adapter = this.#adapter(normalizedGameType);
    const result = await adapter.getView({
      gameType: normalizedGameType,
      matchId: normalizedMatchId,
      actorUserId: normalizedActor,
    });
    return normalizeViewResult(normalizedGameType, normalizedMatchId, result);
  }

  #adapter(gameType) {
    const adapter = this.#adapters.get(gameType);
    if (!adapter) throw new MatchRuntimeError(`Gra ${gameType} nie ma adaptera Match Runtime.`, "MATCH_GAME_NOT_REGISTERED", 404);
    return adapter;
  }

  #serialize(gameType, matchId, operation) {
    const key = `${gameType}:${matchId}`;
    const previous = this.#queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.#queues.set(key, current);
    return current.finally(() => {
      if (this.#queues.get(key) === current) this.#queues.delete(key);
    });
  }
}

export function createMatchCommand({
  commandId,
  gameType,
  matchId,
  commandType,
  actorUserId,
  expectedVersion = null,
  payload = {},
  correlationId = null,
  causationId = null,
} = {}) {
  return normalizeCommand({
    commandId,
    gameType,
    matchId,
    commandType,
    actorUserId,
    expectedVersion,
    payload,
    correlationId,
    causationId,
  });
}

export function assertExpectedVersion(actualVersion, expectedVersion) {
  if (expectedVersion === null || expectedVersion === undefined) return;
  if (!Number.isInteger(actualVersion) || actualVersion < 0) {
    throw new MatchRuntimeError("Adapter zwrócił nieprawidłową wersję meczu.", "MATCH_INVALID_VERSION", 500);
  }
  if (actualVersion !== expectedVersion) {
    throw new MatchRuntimeError("Stan meczu jest nieaktualny. Odśwież widok i ponów komendę.", "MATCH_STALE_VERSION", 409);
  }
}

function normalizeCommand(input) {
  if (!input || typeof input !== "object") throw new MatchRuntimeError("Komenda Match Runtime jest wymagana.", "MATCH_INVALID_COMMAND");
  const commandId = requireText(input.commandId, "commandId", 128);
  const gameType = normalizeGameType(input.gameType);
  const matchId = requireText(input.matchId, "matchId", 128);
  const commandType = requireText(input.commandType, "commandType", 96).toLowerCase();
  const actorUserId = requireText(input.actorUserId, "actorUserId", 128);
  const expectedVersion = normalizeExpectedVersion(input.expectedVersion);
  const payload = input.payload === undefined ? {} : input.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MatchRuntimeError("Payload komendy musi być obiektem.", "MATCH_INVALID_PAYLOAD");
  }
  return Object.freeze({
    commandId,
    gameType,
    matchId,
    commandType,
    actorUserId,
    expectedVersion,
    payload: structuredClone(payload),
    correlationId: optionalText(input.correlationId, "correlationId", 128),
    causationId: optionalText(input.causationId, "causationId", 128),
  });
}

function normalizeResult(command, result) {
  if (!result || typeof result !== "object") {
    throw new MatchRuntimeError("Adapter nie zwrócił wyniku komendy.", "MATCH_INVALID_ADAPTER_RESULT", 500);
  }
  const version = Number(result.version);
  if (!Number.isInteger(version) || version < 0) {
    throw new MatchRuntimeError("Adapter nie zwrócił prawidłowej wersji meczu.", "MATCH_INVALID_ADAPTER_RESULT", 500);
  }
  return Object.freeze({
    gameType: command.gameType,
    matchId: command.matchId,
    commandId: command.commandId,
    commandType: command.commandType,
    version,
    duplicate: result.duplicate === true,
    view: result.view === undefined ? null : structuredClone(result.view),
    metadata: result.metadata === undefined ? null : structuredClone(result.metadata),
  });
}

function normalizeViewResult(gameType, matchId, result) {
  if (!result || typeof result !== "object") {
    throw new MatchRuntimeError("Adapter nie zwrócił widoku meczu.", "MATCH_INVALID_ADAPTER_RESULT", 500);
  }
  const version = Number(result.version);
  if (!Number.isInteger(version) || version < 0) {
    throw new MatchRuntimeError("Adapter nie zwrócił prawidłowej wersji meczu.", "MATCH_INVALID_ADAPTER_RESULT", 500);
  }
  return Object.freeze({
    gameType,
    matchId,
    version,
    view: structuredClone(result.view),
  });
}

function normalizeGameType(value) {
  const gameType = requireText(value, "gameType", 64).toLowerCase();
  if (!/^[a-z][a-z0-9_-]*$/.test(gameType)) {
    throw new MatchRuntimeError("Nieprawidłowy typ gry.", "MATCH_INVALID_GAME_TYPE");
  }
  return gameType;
}

function normalizeExpectedVersion(value) {
  if (value === null || value === undefined) return null;
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) {
    throw new MatchRuntimeError("expectedVersion musi być nieujemną liczbą całkowitą.", "MATCH_INVALID_EXPECTED_VERSION");
  }
  return version;
}

function requireText(value, field, maxLength) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength) {
    throw new MatchRuntimeError(`Pole ${field} jest wymagane i może mieć maksymalnie ${maxLength} znaków.`, "MATCH_INVALID_COMMAND");
  }
  return text;
}

function optionalText(value, field, maxLength) {
  if (value === null || value === undefined || value === "") return null;
  return requireText(value, field, maxLength);
}
