import pg from "pg";

const { Pool } = pg;

export class PostgresCommunityPool {
  #closePromise = null;

  constructor(connectionString) {
    if (typeof connectionString !== "string" || !connectionString.trim()) {
      throw new TypeError("DATABASE_URL jest wymagany dla puli Community PostgreSQL.");
    }

    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  async close() {
    this.#closePromise ??= this.pool.end();
    await this.#closePromise;
  }
}
