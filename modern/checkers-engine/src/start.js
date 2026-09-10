import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import poolBudget from "./postgres-pool-budget.cjs";
import { withPostgresStartupSchemaLock } from "./postgres-startup-schema-lock.js";

const { validateStartupClusterConnectionBudget } = poolBudget;

export async function startApplication({
  environment = process.env,
  importMain = () => import("./main.js"),
  withStartupLock = withPostgresStartupSchemaLock,
} = {}) {
  if (!environment || typeof environment !== "object") throw new TypeError("Środowisko uruchomieniowe jest wymagane.");
  if (typeof importMain !== "function") throw new TypeError("Funkcja inicjalizacji aplikacji jest wymagana.");
  if (typeof withStartupLock !== "function") throw new TypeError("Funkcja blokady inicjalizacji PostgreSQL jest wymagana.");

  const databaseUrl = String(environment.DATABASE_URL || "").trim();
  if (!databaseUrl) return importMain();

  return withStartupLock(databaseUrl, async ({ capacity } = {}) => {
    validateStartupClusterConnectionBudget({ environment, capacity });
    return importMain();
  });
}

const runningDirectly = Boolean(
  process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
);

if (runningDirectly) {
  await startApplication();
}
