const pg = require("pg");
const {
  DEFAULT_POSTGRES_POOL_MAX,
  configuredPoolBudget,
  validateConfiguredPoolBudget,
} = require("./postgres-pool-budget.cjs");
const { secureSslConfig } = require("./postgres-ssl-policy.cjs");

const OriginalPool = pg.Pool;
const configuredProfile = validateConfiguredPoolBudget(process.env);
let allocatedPoolMax = 0;

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
