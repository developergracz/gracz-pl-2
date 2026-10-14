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
  logger = console,
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

        const pool = new Pool({
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

        // node-postgres emits "error" for idle clients when PostgreSQL
        // restarts, fails over or a network connection is reset. Without a
        // listener EventEmitter treats that event as unhandled and exits the
        // process. Log it and let pg discard the broken idle client so later
        // requests can acquire a healthy connection.
        if (typeof pool?.on === "function") {
          pool.on("error", (error) => {
            try {
              logger?.error?.("gracz.pl PostgreSQL pool error", {
                code: error?.code || "PG_POOL_ERROR",
                message: error?.message || "Idle PostgreSQL client failed",
              });
            } catch {}
          });
        }

        return pool;
      })();
    }

    return poolPromise;
  }

  async function query(text, params = []) {
    const pool = await getPool();
    return pool.query(text, params);
  }

  // Readiness only: bounded acquisition (pool connectionTimeoutMillis), then a
  // server statement timeout plus a transport deadline. On any failure destroy
  // the checked-out connection; never return a busy/aborted transaction to pool.
  async function queryBounded(text, params = [], {timeoutMs = 2000} = {}) {
    const budget = boundedInteger(timeoutMs, 2000, 100, 5000);
    const pool = await getPool();
    const client = await pool.connect();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // pg release(true) destroys the socket, terminating outstanding I/O.
        // Keep the error listener through destruction to absorb late events.
        client.release(Boolean(error));
        if (!error) client.removeListener('error', onError);
        if (error) reject(error); else resolve(result);
      };
      const onError = error => finish(error);
      const timer = setTimeout(() => finish(persistenceError(
        'Newsletter readiness query deadline exceeded.', 'PERSISTENCE_QUERY_TIMEOUT'
      )), budget);
      client.on('error', onError);
      (async () => {
        await client.query('BEGIN READ ONLY');
        if (settled) return;
        await client.query("SELECT set_config('statement_timeout', $1, true)", [String(Math.floor(budget * 0.75))]);
        if (settled) return;
        const result = await client.query(text, params);
        if (settled) return;
        await client.query('COMMIT');
        finish(null, result);
      })().catch(onError);
    });
  }

  async function transaction(work) {
    if (typeof work !== "function") {
      throw new TypeError("transaction work must be a function");
    }

    const pool = await getPool();
    const client = await pool.connect();
    let connectionError = null, rollbackError = null;
    // Checked-out clients emit their own error (the idle pool listener is not
    // attached here). A lost COMMIT response must reject, not crash the API.
    const onClientError = error => { connectionError = error; };
    client.on?.('error', onClientError);
    try {
      await client.query("BEGIN");
      const result = await work(client);
      if (connectionError) throw connectionError;
      await client.query("COMMIT");
      if (connectionError) throw connectionError;
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (failure) { rollbackError = failure; }
      throw error;
    } finally {
      client.release(connectionError || rollbackError || undefined);
      client.removeListener?.("error", onClientError);
    }
  }

  async function ping() {
    await query("SELECT 1 AS ok");
    return true;
  }

  async function getConnectionIdentity() {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const parameters = client.connectionParameters;
      if (!parameters) throw persistenceError('Connection identity unavailable.');
      return Object.freeze({host: String(parameters.host || '').replace(/^\[|\]$/g, ''), database: String(parameters.database || '')});
    } finally { client.release(); }
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
    queryBounded,
    ping,
    getConnectionIdentity,
    close,
  });
}
