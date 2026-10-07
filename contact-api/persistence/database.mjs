function persistenceError(message, code = "PERSISTENCE_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function createDatabase({
  connectionString = process.env.DATABASE_URL,
  poolFactory,
  poolOptions = {},
} = {}) {
  const normalizedConnectionString = String(connectionString || "").trim();
  const enabled = Boolean(normalizedConnectionString);
  let poolPromise = null;

  async function getPool() {
    if (!enabled) {
      throw persistenceError(
        "DATABASE_URL is required for durable persistence.",
        "PERSISTENCE_NOT_CONFIGURED"
      );
    }

    if (!poolPromise) {
      poolPromise = (async () => {
        let Pool = poolFactory;
        if (!Pool) {
          const pg = await import("pg");
          Pool = pg.Pool || pg.default?.Pool;
        }
        if (typeof Pool !== "function") {
          throw persistenceError(
            "PostgreSQL Pool implementation is unavailable.",
            "PERSISTENCE_DRIVER_UNAVAILABLE"
          );
        }

        return new Pool({
          connectionString: normalizedConnectionString,
          max: boundedInteger(process.env.DB_POOL_MAX, 10, 1, 50),
          idleTimeoutMillis: boundedInteger(
            process.env.DB_IDLE_TIMEOUT_MS,
            30_000,
            1_000,
            300_000
          ),
          connectionTimeoutMillis: boundedInteger(
            process.env.DB_CONNECT_TIMEOUT_MS,
            5_000,
            500,
            30_000
          ),
          application_name: "gracz-contact-api",
          ...poolOptions,
        });
      })();
    }

    return poolPromise;
  }

  async function query(text, params = []) {
    const pool = await getPool();
    return pool.query(text, params);
  }

  async function transaction(work) {
    if (typeof work !== "function") {
      throw new TypeError("transaction work must be a function");
    }

    const pool = await getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  async function ping() {
    await query("SELECT 1 AS ok");
    return true;
  }

  async function close() {
    if (!poolPromise) return;
    const pool = await poolPromise;
    poolPromise = null;
    await pool.end();
  }

  return Object.freeze({
    enabled,
    query,
    transaction,
    ping,
    close,
  });
}
