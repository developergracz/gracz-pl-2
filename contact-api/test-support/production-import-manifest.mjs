// Reviewed first-party business graph. Additions require explicit security review.
// This is a regression boundary, not a sandbox for malicious source/dependencies.
export const productionModules=Object.freeze([
  'server.mjs',
  'lifecycle.mjs',
  'premium-reply.mjs',
  'security/newsletter-recovery-hold.mjs',
  'security/contact-data-crypto.mjs',
  'persistence/database.mjs',
  'persistence/repositories.mjs',
  'persistence/newsletter-opt-in-store.mjs',
  'persistence/newsletter-cutover.mjs',
  'persistence/memory-reply-token-store.mjs',
  'persistence/memory-idempotency-store.mjs',
  'routes/newsletter-route.mjs',
  'routes/premium-reply-route.mjs',
  'operations/newsletter-f03-readonly-diagnostics.mjs',
]);
export const productionDependencies=Object.freeze([
  'node:http','node:crypto','node:dns/promises','node:net','node:url','pg',
]);
