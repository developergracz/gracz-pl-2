// Reviewed first-party business graph. Additions require explicit security review.
// This is a regression boundary, not a sandbox for malicious source/dependencies.
export const productionModules=Object.freeze([
  'server.mjs',
  'lifecycle.mjs',
  'premium-reply.mjs',
  'security/newsletter-recovery-hold.mjs',
  // Fresh isolated DOI; no legacy consent or marketing-provider import.
  'new-only-newsletter.mjs',
  // Owner-only guarded admin graph. Disabled by default.
  'admin-r1/owner-router.mjs',
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
