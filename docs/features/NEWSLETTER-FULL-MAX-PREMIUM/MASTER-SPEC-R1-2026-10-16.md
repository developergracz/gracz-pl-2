# GRACZ.PL — NEWSLETTER FULL MAX PREMIUM
## Master Product Requirements, Architecture & Acceptance — R1 / 2026-10-16

**Status:** OWNER-approved product scope; documentation only. **NOT production implementation.**
**Repository:** developergracz/gracz-pl-2. **Priority:** P0 base newsletter + OWNER admin; P1 analytics/campaigns after safety gates; advertiser platform separate HOLD.
**Authority:** Owner decisions 2026-10-16. No automatic merge, deploy, schema change, DNS/Render change, Resend send, paid services or access to live subscriber data.
**Related:** #258 draft synthetic OWNER admin R1, #247 OWNER access, newsletter lifecycle code, newsletter/consent policies, RODO/CMP, Disaster Recovery/P0. Existing migrations and #254–#256 must not be overwritten. Migration 005 HARD HOLD.

### 1. Scope and boundaries
Newsletter Full Max Premium owns: registration surfaces, double opt-in (DOI), unsubscribe, user consent/evidence, suppression/duplicates, subscriber list and history for OWNER, own-brand messaging, opt-in segment preferences, campaign creation and sending through controlled queues, own-campaign analytics, click-to-registration attribution, observability and reporting.
**Advertiser Admin is a separate future application (HOLD):** partner onboarding, ad inventory, pricing, paid ad orders, invoices/accounting, advertiser accounts, approval workflow and financial reports. Newsletter may later expose a privacy-safe, reviewed sending capability for approved partner campaigns; no advertiser may access individual subscriber addresses, consent histories or privileged OWNER APIs. Partner marketing requires a distinct verified legal basis/scope, never assumed from normal gracz.pl opt-in. No partner mass-mail functionality within this initial delivery.

### 2. Functional requirements and acceptance conditions
**NL-01 — Signup:** Operable on gracz.pl homepage and every relevant subpage footer and approved registration/auth modals; accessibility (keyboard, focus, screen reader), responsive mobile/desktop, polished matching Full Max Premium visuals, unambiguous Polish validation/errors, anti-bot, IP/user rate limiting, non-leaky response behavior. Verify each published route and footer. Avoid duplicated frontend form logic.
**NL-02 — DOI:** pending -> confirmation mail -> explicit confirmed; one-time expiring hashed tokens, atomic transitions and replay denial, delivery errors/pending states visible honestly; no marketing send until required consent+confirmation conditions hold. Re-send with cooldown and limits; contact/provider consistency after restart.
**NL-03 — Duplicates:** atomic idempotent reservation based on normalized address, concurrency/restart/retry proof, appropriate non-enumerating UX and user-friendly duplicate/pending messaging. Database unique constraints and integration tests.
**NL-04 — Unsubscribe:** one-click compliant unsubscribe for promotional campaigns, working preference center when supported; provider suppression and local records reconciled, revocation before any next send; no mandatory login and no resurrection via retry or delayed event. Preserve required evidence under approved retention.
**NL-05 — Data provenance:** exact server-side signup and DOI timestamps (UTC with seconds and preferably millisecond storage); Poland display using Europe/Warsaw with DST and timezone label; event history for requested, confirmation sent, confirmed, resent, preferences changed, unsubscribed, suppressed. Display source: homepage/footer/modal/subpage/campaign when reliably known. Versions and proof of consent, lawful basis, trusted evidence availability and data quality states. No manufactured historical fields.
**NL-06 — Optional location:** only country/approximate region if actually derived lawfully and deemed necessary, source and precision shown, explicit unknown state. No GPS, street location, covert enrichment or indefinite raw IP retention; undertake DPIA/legality assessment if indicated. Location by IP is approximate and personal data.
**NL-07 — OWNER panel:** single private authenticated OWNER identity, WebAuthn/passkey design subject to independent architecture/AppSec approval, audited enrollment/recovery, durable revocable sessions, least privilege and short idle expiry, CSRF/cookie controls, server-side authorization on every API, audit logs, pagination and bounded queries, resilience and accessible UI. Never expose secrets, tokens, raw consent hashes or plain subscriber DB to browser. Never reuse legacy #18 plaintext approach. Do not deploy/admin-enable #258 without separate approval.
**NL-08 — Dashboard:** clearly distinguish page-local, globally verified and unavailable totals, not false zero; active, pending, unsubscribed, suppressed, DOI success, acquisition per source, trend per day/week/month, error/delivery health, data freshness and completeness. No claims of full counts from sampled/cursor-limited Resend pages.
**NL-09 — OWN campaigns:** OWNER drafts and versioned templates (logo, accessible HTML + plain text, preview, test-send to approved internal inbox), scheduled and manual campaigns, optional interest segment and selected eligible recipients, selection ALL means all eligible **at send time**, never all stored addresses. Recipient counts validated and refreshed before send. Double confirmation for bulk send, dry-run estimates, safe template rendering/sanitization, link allowlist, clear marketing identification, footer identity and unsubscribe, review logs. Timezone-aware schedule and quiet/cadence policies. No unrestricted freeform bulk-send endpoint.
**NL-10 — Queue/idempotency:** batch sending, per-provider quotas, backpressure, retry with exponential bounds, deterministic per-campaign/per-recipient idempotency, transactional enqueue/outbox patterns, exact states, processing leases and crash recovery; fail-safe stop/cancel. Check suppression and consent again immediately before delivery. Explicit approval and realistic send quotas required before enabling production.
**NL-11 — Delivery observability:** signed verified Resend webhooks with replay protection and bounded retention, delivery/bounce/complaint/suppression reports; privacy-aware clicks and clearly labeled unreliable open metrics. Provider failure means degraded/unknown, not active or delivered.
**NL-12 — Conversion analytics:** measure campaign email delivered -> unique verified click -> actual landing session -> new gracz.pl account creation, and optionally returning active player, with explicit attribution windows, deduplication and separation between first-/last-touch metrics. UTM campaign/source/medium and non-PII signed opaque click reference, short-lived link/session attribution only with appropriate legal basis/cookie consent where relevant. Never put email, DOI token, account token or raw subscriber identifier in URL. Reject email security scanners/bots in click counts, record confidence/unknowns, do not retroactively invent attribution. Server-side registration event may reference pseudonymous campaign context only where lawful, and on registration success exactly once. Registration must work even when analytics is down.
**NL-13 — Privacy/reporting:** minimal schema, purpose limitation, DSAR/export/deletion process, consent audit trail, retention schedule for each event, encryption in transit/at rest where applicable, restricted admin audit read and no third-party access to identifiable data. GA4 Consent Mode v2 policy maintained; distinguish aggregate event counts from identified users.
**NL-14 — Notifications:** explicit operational warnings for provider errors, suspected spam spikes, high bounce/complaint rates, queue failure, API 429/5xx, reconciliation drift, stale backups. No needless subscriber PII in error logs.

### 3. Minimum proposed data contracts (design, NOT migration approval)
- `newsletter_subscribers` canonical normalized address + status + persisted timestamp fields and consent version; confirm compatibility with existing `gracz_newsletter_subscribers` / current store first.
- `newsletter_events`: immutable typed `event_id`, `subscriber_id`, `occurred_at timestamptz`, source code, quality/evidence marker, allowed metadata.
- `newsletter_consent_history`: purpose/scope/version/time/source/proof; distinguish own-brand newsletter vs optional partner advertising; never silently expand scope.
- `newsletter_campaigns` and `campaign_versions`: purpose, approved template, owner review, segment snapshot rules, scheduled_at, state machine (draft/review/approved/queued/sending/paused/completed/failed/cancelled).
- `campaign_recipient_jobs`: consent-filtered recipient at send time, provider idempotency key, outbox state, timestamps, failure class, suppression proof.
- `campaign_events`: verified provider message state + de-duplicated click/visit/registration events with appropriate pseudonyms, no PII in links, TTL/retention.
- `owner_audit`: immutable action log with actor, time, action, decision, target type, minimized metadata.
These are illustrative logical contracts: inspect existing DB migrations, contact-api, modern/checkers-engine and Resend models before any SQL. **Never use reserved migration 005.** No live data migrations under this mandate.

### 4. Architecture and segregation
Browser gracz.pl signup -> validated newsletter API -> durable PostgreSQL consent+subscriber state -> Resend transactional confirmation. After DOI: eligible selection -> private OWNER campaign control -> policy gate -> durable queue -> Resend -> signed webhooks -> reports. Analytics: recipient-safe signed campaign link -> approved landing and consent-aware tracking -> successful account registration event -> aggregate OWNER conversion dashboard.
Read-only OWNER admin #258 currently only synthetic, private, never mounted to live production; its bounded 10-contact provider page and evidence-unavailable states must not be falsely presented as global statistics. Keep separation between newsletter frontend, private admin, sending workers and future advertiser admin.

### 5. Security / quality gates
- Architecture + AppSec independent review of authentication/RP origin/bootstrap/recovery/cookies before implementing live OWNER access; explicit OWNER GO for release.
- Documented threat models for bot abuse, address enumeration, CSRF/XSS, SSRF in links, provider secret exposure, replay/webhooks, privilege escalation, bulk-email abuse, double-send, attribution fraud, privacy breaches.
- Unit/integration/e2e tests covering DOI replay, concurrency and duplicate writes, unsubscribe at queue race, suppression failure, provider 429/timeout/5xx, abort/stale UI, crash/restart/drain, quota, forged conversion, idempotency, WCAG keyboard/mobile, Poland DST.
- Independent acceptance on exact HEAD: backend + disposable PostgreSQL migrations/rollback, CodeQL/secrets/node-security/SEO/CSP, Playwright desktop/mobile and relevant browsers, separate production smoke with no real bulk send.
- Backup/restore verified as part of existing ZIP1 P0 DR gates; no reserved migrations, production SQL, live Resend credentials or deployment without owner approval.

### 6. Planned releases; never conflate planned with delivered
**P0-A:** existing newsletter frontend/footer, DOI, unsubscribe, duplicate atomicity, security and persistence, production evidence.
**P0-B:** OWNER R1 independent auth review, WebAuthn implementation and private deployment after approval; accurate list/detail with exact timestamp/source and consent proof.
**P1-C:** analytics dashboard, privacy-aware acquisition/unique click-to-account conversion with verified denominators and attribution.
**P1-D:** own-brand campaign builder, draft/test, reviewed schedule, eligible selection, queue, suppression, verified reports and staged rollout.
**P2-E:** optional approximate geo and advanced segmentation/alerts where lawful.
**Separate future program HOLD:** Advertiser Admin; no scope/permission merge.
**Separate parallel program:** Gracz Next L6 onward after newsletter P0, per owner priorities; e-mail.pl HOLD.

### 7. Acceptance checklist / operational definition of done
- Every intended live form path proven end-to-end, confirmed email, duplicate, pending, unsubscribe and complaints; no PII leak.
- OWNER access cannot be reached anonymously, from public web roots or legacy privileged roles; recovery/tested and audit retained.
- Subscriber detail shows exact local time with seconds and zone/source and states unknown appropriately.
- Page/global metrics supported by authoritative aggregation and freshness status, no inferred zeros.
- Campaign bulk-send cannot run without OWNER step-up, lawful segmentation, live consent/suppression checks, explicit second confirmation, quotas and idempotency.
- Conversion numbers reproducible from documented event semantics, campaign IDs, observation period, attribution consent and filter methodology; scanner noise separated.
- RODO/Poland marketing communications reviewed by qualified counsel before commercial or partner campaigns.
- Approval artifacts: independent reviews, reproducible CI, staging demonstration, rollback, cost estimate, DR evidence, owner GO and production smoke.
- Record each release PASS/HOLD/FAIL with evidence; this document is not authorization to merge.

### 8. Next actionable mandate (read-only until new approval)
Perform gap mapping on existing newsletter frontend, footer across pages, Resend/PG, auth & #258; produce exact paths/HEAD, blocked migrations and effort estimates. Prepare isolated implementation PRs beginning with P0; do not change live services. After Codex limits clear, use this spec as master scope, but preserve external audit / owner approval gates.
