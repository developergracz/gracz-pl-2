// Reviewed first-party business graph. Additions require explicit security review.
// This is a regression boundary, not a sandbox for malicious source/dependencies.
export const productionModules=Object.freeze([
  'server.mjs',
  // Public account signup and session UI; first-party API with hashed credentials.
  'auth/public-identity.mjs',
  // Search guest check: fixed gracz.pl redirect only, 90s single-use anonymous
  // in-memory ticket, allowed-origin POST validation, never exports cookies.
  'auth/search-access.mjs',
  // Reviewed OAuth registration: fixed provider hosts, PKCE/state/nonce, signed JWTs,
  // one-use DB handoff, no dynamic imports, account binding only by provider subject.
  'auth/oauth-registration.mjs',
  // Deterministic game engine: server-authoritative moves only; no external dependencies.
  'auth/game-engine.mjs',
  'auth/page.mjs',
  // Authenticated player UI; same-origin HTML/CSS/JS, no runtime imports or new dependencies.
  'auth/panel.mjs',
  // August UI is staged behind explicit route/feature flag; same verified session,
  // fixed local assets only, no legacy token authentication. Tournament backend
  // validates origin and session, uses parameterized PostgreSQL and owner checks.
  'auth/august-portal.mjs',
  'auth/august/tournaments-service.mjs',
  // Reviewed same-origin profile UI: fixed markup, DOM textContent, no new dependencies.
  'auth/profile-premium-ui.mjs',
  // Reviewed account-scoped queries and opt-in-only public profile; parameterized PostgreSQL.
  'auth/premium-profile.mjs',
  // Private address-book API: owner-scoped PostgreSQL, CSRF protection, no external calls.
  'auth/address-book.mjs',
  // Same-origin, owner-scoped security center; opaque session handles, bounded event history.
  'auth/security-center.mjs',
  // Owner-scoped privacy policies, atomic public-profile updates, session-only export.
  'auth/privacy-center.mjs',
  // Private notifications inbox projected from existing social and security events.
  'auth/notification-center.mjs',
  // Owner-specific inbox metadata for existing friend-only messages.
  'auth/message-center.mjs',
  // Owner-only invitation organization; existing social/challenges remains authoritative.
  'auth/challenge-center.mjs',
  // Dedicated Gomoku game console: no dependencies, online via authenticated same-origin API.
// Reviewed static GRACZ AI panel assets: same-origin only, textContent output,
  // explicit consent to send prompts to existing bounded Groq endpoint; no player-chat access.
  'auth/gracz-ai-chat-assets.mjs',
  'auth/gomoku-console.mjs',
  // Shared same-origin game subscriptions: bounded sockets/payloads and existing
  // session/match authorization. Optional Redis sends room invalidations only.
  'auth/gomoku-realtime.mjs',
  // Reviewed P3 bus: fixed channel, bounded queues; no sessions or game state in Redis.
  'auth/match-event-bus.mjs',
  'auth/gomoku-realtime-client.mjs',
  // Reviewed same-origin checkers console: static HTML/CSS/JS, existing authenticated match API.
  'auth/checkers-console.mjs',
  // P1 chess preview, no match API or gameplay actions.
  'auth/chess-console.mjs',
  'auth/chess-rules.mjs',
  'auth/chess-computer.mjs',
  // Reviewed chess invitations: only same-origin friend presence and authenticated friend-only challenges;
  // server validates scheduled time, sender/recipient, message length and privacy before persistence.
  'auth/chess-invitations.mjs',
  'auth/chess-invite-contract.mjs',
  'auth/chess-match.mjs',
  // Reviewed optional Groq AI chat: fixed HTTPS endpoint, server-only key, no persistence,
  // same-origin POST, bounded payload, rate and token limits, fail-closed without key.
  'routes/gomoku-ai-chat-route.mjs',
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
  'node:fs/promises','node:path','node:util','pg','ws','@redis/client',
]);
