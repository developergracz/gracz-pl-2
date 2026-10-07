import { createDatabase } from "./persistence/database.mjs";
import { createPersistenceRepositories } from "./persistence/repositories.mjs";
import { createNewsletterManager } from "./newsletter.mjs";

const enabled = String(process.env.NEWSLETTER_RECONCILE_ENABLED || "") === "1";
if (!enabled) {
  throw new Error(
    "Newsletter reconciliation runner is disabled. Set NEWSLETTER_RECONCILE_ENABLED=1 explicitly."
  );
}

const args = process.argv.slice(2);
if (args.length !== 1 || !String(args[0] || "").trim()) {
  throw new Error(
    "Usage: NEWSLETTER_RECONCILE_ENABLED=1 npm run reconcile:newsletter -- user@example.com"
  );
}

const database = createDatabase();
if (!database.enabled) {
  throw new Error("DATABASE_URL is required for newsletter reconciliation.");
}

const persistence = createPersistenceRepositories(database);

const newsletter = createNewsletterManager({
  secret: process.env.NEWSLETTER_SECRET,
  resendApiKey: process.env.NEWSLETTER_RESEND_API_KEY,
  resendApiBase: process.env.RESEND_API_BASE || "https://api.resend.com",
  emailEndpoint: process.env.RESEND_ENDPOINT || "https://api.resend.com/emails",
  emailFrom: process.env.EMAIL_FROM || "gracz.pl <kontakt@gracz.pl>",
  replyTo: process.env.CONTACT_TO || "",
  baseUrl: process.env.NEWSLETTER_URL || "https://gracz.pl/newsletter/",
  consentStore: persistence.newsletter,
  consentHashSecret: process.env.NEWSLETTER_CONSENT_HASH_SECRET,
});

if (!newsletter.enabled) {
  throw new Error(
    "Newsletter reconciliation requires NEWSLETTER_SECRET, NEWSLETTER_CONSENT_HASH_SECRET and NEWSLETTER_RESEND_API_KEY."
  );
}

try {
  const result = await newsletter.reconcile(String(args[0]).trim());
  process.stdout.write(JSON.stringify({ ok: true, ...result }) + "\n");
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      ok: false,
      code: error?.code || "NEWSLETTER_RECONCILIATION_FAILED",
      message: error?.message || "Newsletter reconciliation failed.",
    }) + "\n"
  );
  process.exitCode = 1;
} finally {
  await database.close();
}
