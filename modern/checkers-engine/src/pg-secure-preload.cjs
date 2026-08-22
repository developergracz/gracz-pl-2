const pg = require("pg");

const OriginalPool = pg.Pool;

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

class SecurePool extends OriginalPool {
  constructor(config = {}) {
    const next = { ...config };
    if (typeof next.connectionString === "string" && next.connectionString.trim()) {
      next.ssl = secureSslConfig(next.connectionString);
    }
    super(next);
  }
}

pg.Pool = SecurePool;
