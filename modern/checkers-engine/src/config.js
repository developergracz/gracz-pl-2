import { resolve } from "node:path";

export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("PORT musi być liczbą całkowitą od 1 do 65535.");
  }

  const authSecret = environment.AUTH_SECRET;
  if (typeof authSecret !== "string" || authSecret.length < 32) {
    throw new TypeError("AUTH_SECRET musi mieć co najmniej 32 znaki.");
  }

  const databaseUrl = typeof environment.DATABASE_URL === "string" && environment.DATABASE_URL.trim()
    ? environment.DATABASE_URL.trim()
    : null;

  return Object.freeze({
    host: environment.HOST || "0.0.0.0",
    port,
    dataDirectory: resolve(environment.DATA_DIR || "data"),
    authSecret,
    databaseUrl,
  });
}
