"use strict";

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

function decodeDatabaseCa(caBase64) {
  const compact = String(caBase64 || "").replace(/\s+/g, "");
  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 === 1) {
    throw new Error("DATABASE_SSL_CA_BASE64 nie jest prawidłowym Base64.");
  }

  const ca = Buffer.from(compact, "base64").toString("utf8");
  if (!ca.includes("-----BEGIN CERTIFICATE-----") || !ca.includes("-----END CERTIFICATE-----")) {
    throw new Error("DATABASE_SSL_CA_BASE64 nie zawiera certyfikatu CA w formacie PEM.");
  }
  return ca;
}

function secureSslConfig(connectionString, environment = process.env) {
  if (isLocalConnection(connectionString) || isRenderPrivatePostgres(connectionString)) return false;

  const caBase64 = String(environment?.DATABASE_SSL_CA_BASE64 || "").trim();
  if (caBase64) {
    return {
      rejectUnauthorized: true,
      ca: decodeDatabaseCa(caBase64),
    };
  }

  return { rejectUnauthorized: true };
}

module.exports = {
  connectionHost,
  isLocalConnection,
  isRenderPrivatePostgres,
  secureSslConfig,
};
