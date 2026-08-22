const pg = require("pg");

const OriginalPool = pg.Pool;

function isLocalConnection(connectionString) {
  try {
    const url = new URL(connectionString);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function secureSslConfig(connectionString) {
  if (isLocalConnection(connectionString)) return false;

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
