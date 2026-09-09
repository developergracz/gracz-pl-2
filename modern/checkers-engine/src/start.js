import { withPostgresStartupSchemaLock } from "./postgres-startup-schema-lock.js";

const databaseUrl = String(process.env.DATABASE_URL || "").trim();

if (databaseUrl) {
  await withPostgresStartupSchemaLock(databaseUrl, async () => {
    await import("./main.js");
  });
} else {
  await import("./main.js");
}
