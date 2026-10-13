# B1 duplicate opt-in hardening — review evidence

Baseline: `4fa9b909667651a2580e28b404539dfe4306b950`. Scope: B1 only; merge and production remain on hold.

## Behavior

Resend remains authoritative for delivery state. Signup checks suppression, global unsubscribe, the configured Segment and Topic, including pagination. Unknown or malformed provider responses fail closed. Active contacts receive no additional DOI or welcome. Withdrawn contacts cannot be reactivated by submitting a form: a fresh valid DOI confirmation is required.

PostgreSQL migration `005_newsletter_opt_in_requests.sql` adds one HMAC-keyed reservation per address, with atomic claim and request-ID-fenced completion. Existing unexpired ledger requests are imported as `legacy_pending`; consent events remain append-only. No raw address, bearer token or message body is stored in the reservation table.

NEW, PENDING, ACTIVE and suppressed successful submissions use the same public `request_received` contract. Validation and actual failures remain errors. Concurrent requests in progress share neutral acceptance for five minutes; this grace affects only the response, never reservation ownership or resend eligibility.

Retries within the original send reuse the existing idempotency key and identical payload. Ambiguous outcomes are durable `unknown` reservations. Neither unknown nor abandoned inflight reservations are automatically recycled, including after restart or expiry. This deliberately favors preventing duplicate mail over automatic recovery.

## Local verification (2026-10-13)

All mail providers were local HTTP fixtures; no real mail was sent. Integration tests used a disposable PostgreSQL 16 Docker database on loopback, never production.

| Check | PASS | FAIL | SKIPPED |
| --- | ---: | ---: | ---: |
| `node --test test/*.test.mjs` | 56 | 0 | 0 |
| `node --test --test-concurrency=1 integration/*.test.mjs` | 41 | 0 | 0 |
| `npm run check` (syntax checks) | 27 | 0 | 0 |

SEO and security-header gates also passed. Coverage includes concurrent independent Node processes, actual HTTP API restart, migration cutover, accepted-mail/lost-acknowledgement recovery, timeout/429/503, malformed provider data, pagination, stale tokens, neutral route responses and contact-form regression. Counts include Node test subtests and parents.

The existing test fixture was extracted into `test-support/newsletter-provider.mjs`; the large deletion in `newsletter.test.mjs` is not removal of those helpers. The in-progress PostgreSQL integration file was preserved and expanded.

An internal read-only review found malformed successful contact responses and malformed resource names could be treated as absence. Both received failing regression tests and were corrected before the final successful runs.

## Production prerequisites and limitations

- Apply the additive migration only under a separate production mandate. Coordinate cutover so old API instances cannot continue issuing unreserved requests; mixed old/new writers do not provide global deduplication.
- Verify production Resend suppression-read permissions and configured Topic/Segment behavior under separate authorization. Live provider access was intentionally not tested; missing permissions cause safe unavailability.
- Unknown or abandoned reservations need separately reviewed, evidence-based operational recovery. B1 adds no recovery endpoint or automatic resend after the provider idempotency horizon.
- Public status/body parity is tested; this is not a proof of resistance to statistical network-timing analysis.
- PRs #215 and #217 overlap related code and must be reconciled separately before any merge; neither was imported here.
- GitHub CI evidence is recorded on the draft PR. Local PASS alone does not assert CI PASS.

No deployment, production migration, secret rotation, paid service, Owner Admin or STATUS_CHECK B2 is authorized by this change.
