const DEFINITIONS = [
  {
    id: "checkers",
    label: "Warcaby",
    aliases: ["warcaby"],
    implemented: true,
    players: { min: 2, max: 2, default: 2 },
    capabilities: { lobby: true, rankings: true, tournaments: true },
  },
  {
    id: "gomoku",
    label: "Gomoku",
    aliases: [],
    implemented: true,
    players: { min: 2, max: 2, default: 2 },
    capabilities: { lobby: true, rankings: false, tournaments: true },
  },
  {
    id: "thousand",
    label: "Tysiąc",
    aliases: [],
    implemented: true,
    players: { min: 2, max: 4, default: 3 },
    capabilities: { lobby: true, rankings: true, tournaments: true },
  },
];

export function validateGameTypeDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    throw new TypeError("Rejestr typów gier musi zawierać co najmniej jedną definicję.");
  }

  const canonicalOwners = new Map();
  for (const definition of definitions) {
    const id = registryToken(definition?.id, "canonical game id");
    if (canonicalOwners.has(id)) throw new TypeError(`Duplikat canonical game id: ${id}`);
    canonicalOwners.set(id, id);
  }

  const claims = new Map(canonicalOwners);
  for (const definition of definitions) {
    const id = registryToken(definition.id, "canonical game id");
    if (!Array.isArray(definition.aliases)) throw new TypeError(`Aliases dla ${id} muszą być tablicą.`);
    for (const rawAlias of definition.aliases) {
      const alias = registryToken(rawAlias, `alias for ${id}`);
      if (alias === id) throw new TypeError(`Alias ${alias} nie może powielać własnego canonical id.`);
      const existingOwner = claims.get(alias);
      if (existingOwner && existingOwner !== id) {
        throw new TypeError(`Kolizja typu gry: ${alias} należy już do ${existingOwner}.`);
      }
      claims.set(alias, id);
    }
  }
  return true;
}

function registryToken(value, label) {
  if (typeof value !== "string" || value.length < 1 || value !== value.trim() || value !== value.toLowerCase() || !/^[a-z0-9_-]+$/.test(value)) {
    throw new TypeError(`Nieprawidłowy ${label}.`);
  }
  return value;
}

function freezeDefinition(definition) {
  return Object.freeze({
    ...definition,
    aliases: Object.freeze([...definition.aliases]),
    players: Object.freeze({ ...definition.players }),
    capabilities: Object.freeze({ ...definition.capabilities }),
  });
}

validateGameTypeDefinitions(DEFINITIONS);

export const GAME_DEFINITIONS = Object.freeze(
  Object.fromEntries(DEFINITIONS.map((definition) => {
    const frozen = freezeDefinition(definition);
    return [frozen.id, frozen];
  })),
);

export const CANONICAL_GAME_TYPES = Object.freeze(Object.keys(GAME_DEFINITIONS));

const CANONICAL_SET = new Set(CANONICAL_GAME_TYPES);
const NORMALIZATION = new Map();
for (const definition of Object.values(GAME_DEFINITIONS)) {
  NORMALIZATION.set(definition.id, definition.id);
  for (const alias of definition.aliases) NORMALIZATION.set(alias, definition.id);
}

export class GameTypeError extends Error {
  constructor(message = "Nieobsługiwany typ gry.", code = "INVALID_GAME_TYPE") {
    super(message);
    this.name = "GameTypeError";
    this.code = code;
    this.status = 400;
  }
}

export function normalizeGameType(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return NORMALIZATION.get(normalized) ?? null;
}

export function isCanonicalGameType(value) {
  return typeof value === "string" && CANONICAL_SET.has(value);
}

export function getGameDefinition(value) {
  const canonical = normalizeGameType(value);
  return canonical ? GAME_DEFINITIONS[canonical] : null;
}

export function requireGameType(value, { capability = null } = {}) {
  const canonical = normalizeGameType(value);
  if (!canonical) throw new GameTypeError();
  const definition = GAME_DEFINITIONS[canonical];
  if (capability && definition.capabilities[capability] !== true) {
    throw new GameTypeError("Ten typ gry nie jest obsługiwany w tym module.", "UNSUPPORTED_GAME_TYPE");
  }
  return canonical;
}

export function requireGameDefinition(value, options = {}) {
  const canonical = requireGameType(value, options);
  return GAME_DEFINITIONS[canonical];
}
