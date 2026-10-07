# CONTACT FORM SECURITY MAX R1

This module protects the public contact form and its delivery path.

## Implemented controls

- strict origin allowlist and method allowlist
- JSON-only requests with a 16 KB request limit
- server-side schema-style validation and input length limits
- hardened email syntax validation
- DNS MX verification with timeout and cache
- common email-domain typo detection
- disposable-email denylist
- administrative contact address cannot be used as visitor identity
- Resend `reply_to` points to the validated visitor address
- IP rate limiting
- hashed-email rate limiting
- honeypot
- minimum form completion time and form expiry
- duplicate-content detection
- cryptographic client idempotency key and server-side replay cache
- race-safe in-flight idempotency reservation
- conservative anti-spam content checks
- risk scoring for suspicious submissions
- temporary abuse strikes / blocking
- optional adaptive Cloudflare Turnstile verification
- mail-provider circuit breaker
- privacy-reduced logs (email hash, not full email)
- API security headers and no-store responses

## Optional adaptive challenge

Turnstile is dormant unless both variables exist:

- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_SITE_KEY`

Risk threshold variables:

- `RISK_CHALLENGE_THRESHOLD` (default 55)
- `RISK_BLOCK_THRESHOLD` (default 85)

Without Turnstile configuration, ordinary submissions continue to work. Very high-risk submissions may still be blocked by the local risk engine.

## Existing mail variables

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `CONTACT_TO`

## Deployment rule

Do not merge or deploy this branch solely because CI is green. Before production:

1. independent security audit
2. mail-delivery audit including Reply-To
3. browser-runtime test from gracz.pl
4. verify valid WP/Gmail/Outlook addresses
5. verify invalid syntax, no-MX domain, disposable address, admin address, too-fast submit, duplicate submit and rate-limit paths
6. confirm Resend delivery and that Reply sends to the visitor
7. if Turnstile is enabled, test challenge success/failure and update frontend CSP before enabling it

## WAF / edge readiness

The API is compatible with an upstream WAF/reverse proxy. A future edge layer should restrict direct backend access at infrastructure level rather than trusting a browser-supplied secret header.

## Render client IP trust model

- Use `X-Forwarded-For` for the client IP on Render.
- Treat the first valid address as the real client address, per Render's documented behavior.
- Do not trust `CF-Connecting-IP` directly in application code.
- The public `.onrender.com` endpoint remains reachable, so Origin/CORS is not an authentication boundary.

## GRACZ.PL PREMIUM MAIL RESPONSE R1

This layer turns administrator replies into branded transactional messages instead of plain mailbox replies.

### Flow

1. A visitor submits the public contact form.
2. The owner receives a branded administration email.
3. If `CONTACT_REPLY_SECRET` is configured, that email contains **Odpowiedz przez gracz.pl**.
4. The link opens `/kontakt/odpowiedz/#token=...`.
5. The token stays in the URL fragment, is removed from browser history immediately, and is never sent to the static-site HTTP server.
6. The reply page retrieves only a masked recipient and ticket metadata from the API.
7. The owner writes a reply.
8. The API validates the encrypted token and sends a branded HTML + plain-text email through Resend.
9. The recipient can reply normally; `Reply-To` points back to `CONTACT_TO`.

### Security properties

- AES-256-GCM encrypted/authenticated reply tokens
- independent secret: `CONTACT_REPLY_SECRET` (minimum 32 characters)
- 7-day token expiry
- one-send reservation in the running instance plus provider idempotency
- recipient email is not exposed in the reply-page HTML or JavaScript
- recipient shown in the UI is masked
- token is carried in URL fragment, not query string
- reply page is `noindex,nofollow,noarchive`
- `Referrer-Policy: no-referrer` on the reply page
- no analytics/cookie scripts on the reply page
- strict Origin/CORS checks
- separate reply-panel IP rate limit
- 16 KB request-body cap
- reply body limited to 5000 characters
- all dynamic HTML is escaped
- reply API logs only hashed recipient identity, request IDs and provider IDs
- Resend idempotency key is derived from the encrypted token's random JTI

### Required production variable

`CONTACT_REPLY_SECRET`

Generate it from a cryptographically secure random source. Do not reuse `RESEND_API_KEY`, passwords, or any user credential.

If this variable is absent, the existing contact form still works and the admin mail remains deliverable, but the secure premium-reply button is disabled.

### Production acceptance test

After deployment:

1. submit one real contact message from a non-administrative mailbox;
2. verify the owner email is branded and contains **Odpowiedz przez gracz.pl**;
3. open the button and confirm the UI shows only a masked destination address;
4. send a test answer;
5. verify the recipient receives the branded gracz.pl HTML email;
6. verify plain-text fallback exists;
7. click Reply in the recipient mailbox and confirm it targets `CONTACT_TO`;
8. reuse the original secure link and confirm the API rejects the second send.

## Newsletter FULL MAX PREMIUM R1

Newsletter uses a separate consent from contact-form processing and requires double opt-in.

### Production flow

1. User checks the optional Newsletter box in the contact form or uses `/newsletter/`.
2. Backend sends a confirmation email. No active Resend newsletter contact is created yet.
3. The confirmation token is AES-256-GCM encrypted and carried in the URL fragment (`#confirm=`).
4. The landing page removes the fragment from browser history and requires an explicit button click.
5. After confirmation, backend ensures:
   - Segment: `gracz.pl Newsletter`
   - public Topic: `Newsletter gracz.pl`
   - Topic default: `opt_out`
6. The confirmed contact is added to the Segment and set to Topic `opt_in`.
7. A FULL MAX PREMIUM welcome email contains an unsubscribe token.
8. Unsubscribe changes Topic to `opt_out` and removes the contact from the newsletter Segment.

### Required environment variables

- `NEWSLETTER_SECRET` — independent random secret, minimum 32 characters.
- `NEWSLETTER_RESEND_API_KEY` — separate Resend API key with permissions required for Contacts, Segments, Topics and confirmation/welcome email sending.
- `NEWSLETTER_URL=https://gracz.pl/newsletter/`
- `RESEND_API_BASE=https://api.resend.com`

Do not reuse a send-only contact-form key if it lacks Contacts/Segments/Topics permissions.

### Privacy and security

- Newsletter consent is optional and never required to send a contact message.
- A failed newsletter request never causes an already-valid contact message to fail.
- No active marketing contact exists before confirmation.
- Confirmation link lifetime: 30 days.
- Confirmation and unsubscribe tokens are encrypted/authenticated.
- Tokens are placed in URL fragments and are not sent to the static server in the request URL.
- Confirmation is not automatic on page load, protecting against mail-link scanners.
- Newsletter endpoint has separate IP and email rate limits, honeypot and form-timing checks.
- Server logs use request IDs and hashed email identifiers rather than raw subscriber addresses.
- Broadcasts should target the dedicated Segment and Topic so opt-out state is respected.

## R4.1 durable persistence foundation

R4.1 introduces the PostgreSQL foundation required by the Contact + Premium Reply + Newsletter R4 architecture.

### Scope

- PostgreSQL connection wrapper with explicit transactions.
- Ordered, checksummed SQL migrations protected by a PostgreSQL advisory lock.
- Durable tables for:
  - contact cases,
  - one-time Premium Reply token state,
  - critical idempotency,
  - newsletter operational state,
  - append-only first-party newsletter consent events.
- Repository primitives with atomic reply-token claim and idempotency reservation.
- PostgreSQL integration tests executed in GitHub Actions against a real PostgreSQL service.
- Append-only protection for the consent-event ledger enforced inside PostgreSQL.

### Production variables

- `DATABASE_URL` — required before any R4 critical flow is switched to durable persistence.
- `DB_POOL_MAX` — optional, default 10.
- `DB_IDLE_TIMEOUT_MS` — optional, default 30000.
- `DB_CONNECT_TIMEOUT_MS` — optional, default 5000.

The PostgreSQL driver does not override TLS settings from the provider connection string. Use the Render-provided connection URL and its TLS parameters.

### Commands

- `npm run migrate` — apply pending checksummed migrations.
- `npm run test:persistence` — run PostgreSQL integration tests.

### Fail-closed rule

Critical R4 guarantees must never silently fall back to process-memory Maps when PostgreSQL is unavailable. The persistence layer returns `PERSISTENCE_NOT_CONFIGURED` when no database is configured.

**R4.1 does not yet switch the live contact, Premium Reply or newsletter flows to PostgreSQL.** That wiring belongs to the next staged PRs so existing production behavior remains unchanged until each durable path is independently tested and audited.


## R4.2 durable Premium Reply

R4.2 removes the production one-time-send guarantee from process memory and moves Premium Reply token state into PostgreSQL.

### Production behavior

- A Premium Reply link is issued only after its hashed JTI has been stored durably.
- The raw encrypted token is never stored in PostgreSQL.
- The database stores only the SHA-256 JTI hash plus lifecycle metadata.
- Reply claims are atomic across processes and instances.
- A used token remains used after process restart.
- Concurrent requests cannot both reserve the same token.
- The first reply body fingerprint is persisted. A retry may resend only the exact same normalized body, preventing a changed payload from reusing the same provider idempotency key after an ambiguous provider failure.
- Provider delivery continues to use the deterministic `contact-reply/<hash>` idempotency key.
- Failed provider attempts release the durable claim but retain the message fingerprint.
- Successful provider delivery transitions the token to `used` and marks the parent contact case reply status as `sent`.
- No production fallback to an in-memory token registry exists.

### Deployment order

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Run `npm --prefix contact-api run migrate`.
3. Verify migration `002_durable_premium_reply.sql` is applied.
4. Deploy the API.
5. Confirm `/health` reports:
   - `persistenceConfigured: true`
   - `premiumReplyConfigured: true`
   - `premiumReplyDurableState: true`
6. Run a real contact-form acceptance test.
7. Send one Premium Reply.
8. Restart the API process.
9. Reuse the original link and verify it is rejected as already used.

### Failure semantics

If `CONTACT_REPLY_SECRET` is configured but no durable token store is available, Premium Reply is disabled instead of silently falling back to memory. Contact delivery can still operate, but no Premium Reply link is issued.

If the database fails while a Premium Reply token is being issued or claimed, the secure reply operation fails closed.

A special in-memory store exists only for the isolated Node regression test process and is enabled solely with `NODE_ENV=test` plus `PREMIUM_REPLY_TEST_MEMORY_STORE=1`. It is not a production fallback.


## R4.3 durable contact idempotency

R4.3 moves the contact-form idempotency guarantee out of process memory and into PostgreSQL.

### Production behavior

- Client idempotency keys are never stored raw in PostgreSQL; gracz.pl stores a SHA-256 hash.
- The request fingerprint is persisted with the idempotency record.
- Completed safe responses are stored as replay data.
- A completed request can be replayed after API restart without sending a second provider email.
- Concurrent requests using the same key cannot both reserve the provider delivery.
- A reused key with a different request fingerprint is rejected with an idempotency conflict.
- Explicit pre-delivery failures may release the reservation so the same request can be retried.
- Network failures and other ambiguous provider outcomes keep the durable record in `inflight` state rather than silently allowing another delivery.
- Expired `inflight` records are not automatically recycled. This is intentional fail-closed behavior until later reconciliation tooling exists.
- Expired `done` records may be recycled after the configured idempotency retention window.
- The idempotency key is no longer coupled to the visitor IP address, so a legitimate retry remains stable if the network address changes.

### Failure semantics

If durable contact idempotency is unavailable, the contact submission path returns `CONTACT_IDEMPOTENCY_NOT_CONFIGURED` instead of falling back to the former in-memory map.

After the provider request has started, ambiguous failures do not delete the durable reservation. This prevents a restart or retry from causing an untracked duplicate send.

If the provider explicitly rejects the request with a retry-safe 4xx response other than HTTP 408, the reservation may be released.

### Test-only adapter

The normal Node regression suite uses an explicit in-memory adapter only when both conditions are true:

- `NODE_ENV=test`
- `CONTACT_IDEMPOTENCY_TEST_MEMORY_STORE=1`

This adapter is not available as a production fallback.

### Production acceptance test

After deployment with PostgreSQL enabled:

1. submit a valid contact form request and keep its idempotency key;
2. verify the first request is delivered once;
3. repeat the same request with the same key and confirm the stored 200 response is replayed without a second provider call;
4. restart the API and repeat the same request again;
5. confirm the response is still replayed from PostgreSQL;
6. use the same key with a changed payload and confirm `IDEMPOTENCY_CONFLICT`;
7. verify a concurrent same-key pair reaches the mail provider at most once.


## R4.4 first-party newsletter consent ledger

R4.4 makes gracz.pl the durable source of truth for newsletter consent history while keeping Resend as the delivery and marketing execution layer.

### Stored first-party state

For each newsletter subject, PostgreSQL stores only a keyed one-way HMAC identifier derived from the normalized email address. The raw email address is not stored in the consent ledger.

The append-only event history records:

- `opt_in_requested`
- `opt_in_confirmed`
- `unsubscribe`
- `resubscribe`
- `provider_sync`
- later provider-delivery events reserved by the schema

The operational contact row stores the current state and confirmation/unsubscribe timestamps for reconciliation.

### Required secret

- `NEWSLETTER_CONSENT_HASH_SECRET` — independent random secret, minimum 32 characters.

Do not reuse `NEWSLETTER_SECRET`, `RESEND_API_KEY` or `NEWSLETTER_RESEND_API_KEY`.

The newsletter manager is not considered fully configured unless the durable consent store and this independent hashing secret are present.

### Event semantics

- requesting double opt-in appends an `opt_in_requested` event before the confirmation email is sent;
- successful confirmation appends `opt_in_confirmed` or `resubscribe`;
- unsubscribe appends `unsubscribe`;
- replaying the same encrypted confirmation or unsubscribe token does not append a duplicate event because event IDs are deterministic per token JTI;
- a pre-R4 subscriber already active in Resend can be imported as `provider_sync` without fabricating an original consent event;
- provider-side state remains secondary and will be reconciled against first-party state in R4.5.

### Privacy properties

- no raw email address in the first-party consent ledger;
- subject identifier uses HMAC-SHA-256 with a dedicated secret, not plain SHA-256;
- no raw confirmation or unsubscribe token is persisted;
- append-only protection remains enforced by PostgreSQL against UPDATE and DELETE.

### Deployment order

1. provision PostgreSQL and apply all migrations;
2. create a new independent `NEWSLETTER_CONSENT_HASH_SECRET`;
3. configure it in the API environment;
4. deploy the R4.4 code;
5. verify `/health` reports:
   - `persistenceConfigured: true`
   - `newsletterConfigured: true`
   - `newsletterConsentLedger: true`
6. run double-opt-in, unsubscribe and resubscribe acceptance tests;
7. verify the ledger contains the expected ordered events without duplicate events after token replay.

### Fail-closed rule

If the first-party consent ledger or its hashing secret is unavailable, newsletter subscription operations do not silently continue using Resend as the sole consent source of truth.

The existing test-only memory adapter is available only to automated tests. It is not a production fallback.


## R4.5 newsletter reconciliation

R4.5 reconciles gracz.pl's first-party consent state with Resend without allowing provider drift to silently reactivate a subscriber.

### Authority model

- The first-party PostgreSQL consent ledger is authoritative for consent history.
- Resend remains the delivery and marketing execution layer.
- Legacy Resend confirmation properties may be imported only when there is durable provider confirmation proof and the provider subscription is still fully active.
- A provider-side opt-out or inactive state never causes automatic reactivation.
- Reactivation after an inactive provider state requires a newly issued double-opt-in confirmation token.

### Reconciliation outcomes

The internal newsletter manager can return:

- `in_sync`
- `imported_subscribed`
- `repaired_unsubscribed`
- `repaired_pending`
- `fresh_confirmation_required`
- `unknown_subject`

The reconciliation routine is intentionally not exposed as a public unauthenticated HTTP endpoint in R4.5.

### Safe repair rules

- First-party `unsubscribed` + provider still opted in: force Topic `opt_out` and remove the newsletter Segment membership.
- First-party `pending` + provider active without durable legacy confirmation proof: force provider state back to non-marketing state.
- First-party `subscribed` + provider inactive: do not opt in automatically; record the observed drift and require fresh double opt-in.
- First-party `pending` + provider active with durable legacy confirmation proof: import as `provider_sync` once.
- Reconciliation observations use deterministic append-only `provider_sync` events so repeated checks do not create duplicate audit entries.

### Confirmation-token safety

Confirmation now evaluates first-party `confirmed_at` and `unsubscribed_at` timestamps before provider properties. Provider timestamps remain only a legacy/recovery signal.

An old token cannot reactivate a subscription after first-party unsubscribe or after a provider-side inactive transition. A token issued after the last confirmed/unsubscribed state may complete an explicit resubscription.

### R4.5 acceptance tests

- provider-hosted unsubscribe is not silently reactivated;
- first-party unsubscribe repairs provider drift;
- legacy active provider proof imports exactly once;
- existing stale-token, resubscribe, retry and partial-activation tests remain green.
