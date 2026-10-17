const pg = require("pg");
const {
  DEFAULT_POSTGRES_POOL_MAX,
  configuredPoolBudget,
  validateConfiguredPoolBudget,
} = require("./postgres-pool-budget.cjs");

const OriginalPool = pg.Pool;
const configuredProfile = validateConfiguredPoolBudget(process.env);
let allocatedPoolMax = 0;

function connectionHost(connectionString) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return "";
  }
}

function isLocalConnection(connectionString) {
  return ["localhost", "127.0.0.1", "::1"].includes(connectionHost(connectionString));
}

function isRenderPrivatePostgres(connectionString) {
  const host = connectionHost(connectionString);
  // Render's internal PostgreSQL hostname is a private-network dpg-* name
  // without a public DNS suffix. Traffic stays on Render's private network.
  return /^dpg-[a-z0-9-]+$/i.test(host) && !host.includes(".");
}

function secureSslConfig(connectionString) {
  if (isLocalConnection(connectionString) || isRenderPrivatePostgres(connectionString)) return false;

  const caBase64 = String(process.env.DATABASE_SSL_CA_BASE64 || "").trim();
  if (caBase64) {
    let ca;
    try {
      ca = Buffer.from(caBase64, "base64").toString("utf8");
    } catch {
      throw new Error("DATABASE_SSL_CA_BASE64 nie jest prawidłowym Base64.");
    }
    if (!ca.includes("BEGIN CERTIFICATE")) {
      throw new Error("DATABASE_SSL_CA_BASE64 nie zawiera certyfikatu CA w formacie PEM.");
    }
    return { rejectUnauthorized: true, ca };
  }

  return { rejectUnauthorized: true };
}

function normalizedPoolMax(value) {
  const max = value == null ? DEFAULT_POSTGRES_POOL_MAX : Number(value);
  if (!Number.isSafeInteger(max) || max < 1 || max > 1024) {
    throw new TypeError("PostgreSQL Pool max musi być liczbą całkowitą od 1 do 1024.");
  }
  return max;
}

class SecurePool extends OriginalPool {
  constructor(config = {}) {
    const next = { ...config };
    const max = normalizedPoolMax(next.max);
    const runtimeBudget = configuredPoolBudget(process.env);
    const projected = allocatedPoolMax + max;
    if (projected > runtimeBudget) {
      const error = new Error(
        `Runtime PostgreSQL pool allocation ${projected} przekracza POSTGRES_POOL_BUDGET=${runtimeBudget}.`,
      );
      error.code = "POSTGRES_POOL_BUDGET_EXCEEDED";
      throw error;
    }
    next.max = max;
    if (typeof next.connectionString === "string" && next.connectionString.trim()) {
      next.ssl = secureSslConfig(next.connectionString);
    }
    super(next);
    allocatedPoolMax = projected;
  }
}

Object.defineProperties(SecurePool, {
  graczPoolBudget: { value: configuredProfile, enumerable: false },
  graczAllocatedPoolMax: { get: () => allocatedPoolMax, enumerable: false },
});

pg.Pool = SecurePool;
