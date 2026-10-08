import pg from "pg";

const { Client } = pg;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const DEFAULT_DATABASES = new Set(["gracz_test"]);

function guardError(message) {
  const error = new Error(message);
  error.code = "DESTRUCTIVE_TEST_DATABASE_REJECTED";
  return error;
}

function allowedDatabaseNames() {
  const allowed = new Set(DEFAULT_DATABASES);
  const extra = String(
    process.env.CONTACT_API_DESTRUCTIVE_TEST_DATABASE_ALLOWLIST || ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const name of extra) allowed.add(name);
  return allowed;
}

export function inspectEffectiveTestDatabase(connectionString) {
  const normalized = String(connectionString || "").trim();
  if (!normalized) {
    throw guardError("DATABASE_URL is required for destructive integration tests.");
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw guardError("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw guardError("Destructive integration tests require a PostgreSQL URL.");
  }

  if (!parsed.hostname) {
    throw guardError(
      "Destructive integration tests require an explicit loopback hostname."
    );
  }

  for (const [rawKey] of parsed.searchParams) {
    const key = String(rawKey).toLowerCase();
    if (key === "host" || key === "hostaddr") {
      throw guardError(
        "DATABASE_URL host overrides are forbidden for destructive integration tests."
      );
    }
  }

  const client = new Client({ connectionString: normalized });
  const effectiveHost = String(client.connectionParameters?.host || "")
    .replace(/^\[(.*)\]$/, "$1")
    .toLowerCase();
  const databaseName = String(client.connectionParameters?.database || "");

  if (!LOOPBACK_HOSTS.has(effectiveHost)) {
    throw guardError(
      "Refusing destructive integration tests against a non-loopback PostgreSQL host."
    );
  }

  if (!allowedDatabaseNames().has(databaseName)) {
    throw guardError(
      "Refusing destructive integration tests against an unapproved database name."
    );
  }

  return Object.freeze({
    host: effectiveHost,
    databaseName,
  });
}

export function assertDisposableDatabaseUrl(connectionString) {
  inspectEffectiveTestDatabase(connectionString);
}
