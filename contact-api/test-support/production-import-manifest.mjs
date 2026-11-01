// Reviewed first-party business graph. Additions require explicit security review.
// This is a regression boundary, not a sandbox for malicious source/dependencies.
export const productionModules=Object.freeze([
  'server.mjs',
  // Public account signup and session UI; first-party API with hashed credentials.
  'auth/public-identity.mjs',
  'auth/page.mjs',
  'lifecycle.mjs',
  'premium-reply.mjs',
  'email/full-max-premium.mjs',
  'security/newsletter-recovery-hold.mjs',
  // Fresh isolated DOI; no legacy consent or marketing-provider import.
  'new-only-newsletter.mjs',
  // Owner-only guarded admin graph. Disabled by default.
  'admin-r1/owner-router.mjs',
  // Reviewed fixed-host, bounded read-only SEO probes; no external dependencies.
  'admin-r1/seo-live-reader.mjs',
  // Reviewed, read-only Google API adapters; fixed targets and no new packages.
  'admin-r1/seo-google-reader.mjs',
  'admin-r1/seo-speed-reader.mjs',
  // OWNER read-only summary: no network calls or dependencies; relies on reviewed probes.
  'admin-r1/seo-guardian.mjs',
  // Reviewed fixed-repository GitHub Actions:read adapter; no mutations or arbitrary URLs.
  'admin-r1/performance-reader.mjs',
  // OWNER-only scoped status e-mail rate-bucket introspection; no provider or consent changes.
  'admin-r1/newsletter-limit-control.mjs',
  // Read-only ClamAV/converter interface contract; all processing remains OFF.
  'attachment-lab/integration.mjs',
  'campaigns/draft-store.mjs',
  'campaigns/audience-proof-count.mjs',
  // OWNER test-send adapter is inert unless an explicit release flag and durable ledger exist.
  'campaigns/owner-test-send.mjs',
  'campaigns/owner-send.mjs',
  'campaigns/pg-dispatch-store.mjs',
  'campaigns/dispatch-coordinator.mjs',
  'campaigns/recipient-evidence-review.mjs',
  'campaigns/resend-transport.mjs',
  'campaigns/resend-result.mjs',
  'campaigns/prepare.mjs',
  'admin-r1/owner-auth.mjs',
  'admin-r1/owner-recovery-mailer.mjs',
  'admin-r1/deny.mjs',
  'admin-r1/new-only-reader.mjs',
  'admin-r1/summary.mjs',
  'admin-r1/trend-detail.mjs',
  'admin-r1/service.mjs',
  'admin-r1/provider.mjs',
  'security/contact-data-crypto.mjs',
  'persistence/database.mjs',
  'persistence/repositories.mjs',
  'persistence/newsletter-opt-in-store.mjs',
  'persistence/newsletter-cutover.mjs',
  'persistence/memory-reply-token-store.mjs',
  'persistence/memory-idempotency-store.mjs',
  'routes/newsletter-route.mjs',
  // Reviewed opt-out-only path: opt-in remains held.
  'routes/newsletter-withdrawal-route.mjs',
  'persistence/recovery/self-service-withdrawal.mjs',
  'persistence/recovery/withdrawal-send-fence.mjs',
  'persistence/recovery/withdrawal-send-fence.mjs',
  'persistence/recovery/withdrawal-challenge-mailer.mjs',
  'persistence/recovery/resend-provider-off.mjs',
  'routes/premium-reply-route.mjs',
  'operations/newsletter-f03-readonly-diagnostics.mjs',
]);
export const productionDependencies=Object.freeze([
  'node:http','node:crypto','node:dns/promises','node:net','node:url',
  'node:fs/promises','node:util','pg',
]);
