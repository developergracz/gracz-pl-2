import { createHash, randomUUID } from "node:crypto";

export class MatchRuntimeOwnershipError extends Error {
  constructor(matchId, ownershipEpoch) {
    super(`Właściciel runtime dla ${matchId} jest nieaktualny (epoch ${ownershipEpoch}).`);
    this.name = "MatchRuntimeOwnershipError";
    this.code = "MATCH_RUNTIME_STALE_OWNERSHIP";
    this.status = 409;
  }
}

export class MatchRuntimeVersionConflictError extends Error {
  constructor(matchId, expectedVersion, currentVersion) {
    super(`Konflikt wersji ${matchId}: oczekiwano ${expectedVersion}, aktualna wersja ${currentVersion}.`);
    this.name = "MatchRuntimeVersionConflictError";
    this.code = "MATCH_RUNTIME_VERSION_CONFLICT";
    this.status = 409;
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
  }
}

export class MatchRuntimeIdempotencyConflictError extends Error {
  constructor(matchId, idempotencyKey) {
    super(`Klucz idempotencji ${idempotencyKey} został już użyty dla innego polecenia w ${matchId}.`);
    this.name = "MatchRuntimeIdempotencyConflictError";
    this.code = "MATCH_RUNTIME_IDEMPOTENCY_CONFLICT";
    this.status = 409;
  }
}

export class MatchRuntime {
  #ownership = new Map();

  constructor({ repository, engine, ownerId = randomUUID(), publish = null } = {}) {
    if (!repository
      || typeof repository.loadMatchRuntime !== "function"
      || typeof repository.claimMatchOwnership !== "function"
      || typeof repository.executeMatchRuntimeCommand !== "function") {
      throw new TypeError("Repozytorium Match Runtime nie implementuje wymaganego kontraktu.");
    }
    if (!engine || typeof engine.applyCommand !== "function" || typeof engine.project !== "function") {
      throw new TypeError("Adapter silnika Match Runtime musi implementować applyCommand() oraz project().");
    }
    if (publish !== null && typeof publish !== "function") throw new TypeError("publish musi być funkcją albo null.");
    assertToken(ownerId, "ownerId");
    this.repository = repository;
    this.engine = engine;
    this.ownerId = ownerId;
    this.publish = publish;
  }

  async load(matchId, viewerId = null) {
    assertMatchId(matchId);
    const loaded = await this.repository.loadMatchRuntime(matchId);
    return {
      matchId,
      version: loaded.version,
      ownershipEpoch: loaded.ownershipEpoch,
      snapshot: this.#project(loaded.state, viewerId),
    };
  }

  async claimOwnership(matchId) {
    assertMatchId(matchId);
    const claimed = await this.repository.claimMatchOwnership(matchId, this.ownerId);
    this.#ownership.set(matchId, claimed.ownershipEpoch);
    return claimed.ownershipEpoch;
  }

  async executeCommand({ matchId, expectedVersion, idempotencyKey, command, viewerId = null, ownershipEpoch = null } = {}) {
    assertMatchId(matchId);
    assertVersion(expectedVersion);
    assertToken(idempotencyKey, "idempotencyKey");
    if (!command || typeof command !== "object" || Array.isArray(command)) throw new TypeError("Polecenie Match Runtime musi być obiektem.");

    const epoch = ownershipEpoch ?? this.#ownership.get(matchId) ?? await this.claimOwnership(matchId);
    assertEpoch(epoch);
    const commandHash = hashCommand(command);

    const committed = await this.repository.executeMatchRuntimeCommand({
      matchId,
      ownerId: this.ownerId,
      ownershipEpoch: epoch,
      expectedVersion,
      idempotencyKey,
      commandHash,
      execute: async (state) => this.engine.applyCommand({ state, command }),
    });

    if (!committed.replayed && this.publish) {
      const eventType = typeof this.engine.eventType === "function" ? this.engine.eventType(command) : "match.updated";
      try {
        await this.publish({ matchId, version: committed.version, eventType });
      } catch {
        // Persistence is authoritative. Publication is deliberately non-authoritative and signal-only.
      }
    }

    return {
      matchId,
      version: committed.version,
      ownershipEpoch: epoch,
      replayed: committed.replayed === true,
      snapshot: this.#project(committed.state, viewerId),
    };
  }

  #project(state, viewerId) {
    return this.engine.project(state, viewerId);
  }
}

function hashCommand(command) {
  return createHash("sha256").update(stableJson(command)).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertMatchId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new TypeError("Nieprawidłowy identyfikator meczu.");
}
function assertVersion(value) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError("expectedVersion musi być dodatnią liczbą całkowitą.");
}
function assertEpoch(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError("ownershipEpoch musi być dodatnim monotonicznym tokenem.");
}
function assertToken(value, name) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new TypeError(`${name} musi mieć od 1 do 128 znaków.`);
}
