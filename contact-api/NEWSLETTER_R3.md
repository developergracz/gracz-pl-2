# Newsletter R3 — implementation and release holds

Historical R3 record. See [NEWSLETTER_R4.md](NEWSLETTER_R4.md) for the corrective phase model, current tests and release gates.

Base: `bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e`.
Preserved B1 from #248 (`32b5de8beca8862ac2fda510c25a322857e74a70`), selectively integrated the four-file Premium patch from #253 (`64433ad934df1754181dc2a6f788420754183e27`). Original PRs and branches are untouched; main's #251 footer repair is retained.

## Implemented behavior

- B1 durable reservation, same-key provider retries, active-contact DOI suppression, append-only consent, confirm/unsubscribe and stale-token protection remain in the existing manager.
- Anonymous subscribe/contact opt-in and status requests acknowledge durable **admission**, not delivery. Provider classification and mail run afterward. Subscription-dependent provider duration/errors do not determine public response status/body. Input validation and admission/database/capacity failures remain honest errors.
- Admission uses HMAC-only entries in existing `idempotency_keys`, with a synchronous 64-slot per-process bound and one-minute duplicate window. Inflight admissions are never recycled, including after process death. This is a safety barrier, not a new durable mailing queue: a crash can leave work requiring evidence-based recovery.
- `POST /newsletter/status-request` is independent of marketing consent. Public success is `request_received`. Status-mail content does not contain membership. Suppression blocks delivery; unknown suppression permission fails closed internally.
- `POST /newsletter/status-check` accepts only an AEAD `ns1` envelope: HKDF-derived separate key, authenticated audience/purpose, random 256-bit nonce, ten-minute lifetime. PostgreSQL atomically consumes the nonce before reading Resend. Replay, expiry, wrong purpose and malformed tokens fail without disclosing status. Provider failure after consumption returns unavailable; it never becomes inactive.
- Verified states are active/pending/inactive, using suppression/global unsubscribe/Segment/Topic and bounded pending consent evidence. Checking status never modifies consent or activates delivery.
- Durable status-mail budget: three requests per address/hour, 100/hour globally, ten-minute dispatch cooldown. Suppression/budget rejection is neutral; ambiguous send never automatically recycles. IP limits and existing anti-spam remain. Budgets are separate from subscription membership.
- Footer Premium validation comes from #253. Dedicated page adds matching accessible validation and voluntary status request. Tokens are stripped on initial load and same-tab navigation, held only in memory, and discarded on leaving the page. No proof is consumed by a GET. Timeout means uncertain outcome, not permission for a new DOI.

## Migration 005: HARD HOLD, not renamed into approval

The preserved SQL is quarantined at `persistence/candidates/005_newsletter_opt_in_requests.sql`, outside the default migrator's scan. The automatic migration directory contains only the pre-existing 001–004. B2 proof/admission/budgets reuse migration 001's generic idempotency table with isolated scopes; no B2 schema migration is added.

`integration/newsletter-candidate.mjs` is a test-only installer guarded by the disposable database policy. It must never be imported by runtime or the production migrator. Candidate SQL was exercised on fresh, isolated local PostgreSQL 16; this does not allocate a production migration version or approve production execution.

Before merge/release, Owner and DB/DR review must decide:

1. Allocate the global migration identity/order relative to the separately reserved contact-data CONTRACT 005. Newsletter additive state is independent of plaintext redaction; CONTRACT need not be forced through merely to unblock newsletter numbering. Preserve deployed migration checksums; inspect the authorized migration ledger before choosing final allocation.
2. Approve DR/restore evidence and the Render build-time migration/deploy gate. No Render configuration was changed here. Any main merge can deploy API and run its migrator, including a frontend-only merge.
3. Quiesce/drain old unreserved newsletter writers before cutover. Mixed old/new versions cannot guarantee deduplication. Approved additive installation/import of legacy pending events must precede enabling new opt-in writers. Missing candidate table causes admission failure, not unsafe fallback.
4. Roll back by stopping new newsletter intake while retaining additive data and consent evidence. Do not revert to the old duplicate-sending writer or delete reservations/ledger. Restore only under a separate DR mandate with reconciliation of provider-accepted messages after the backup boundary.

## Ambiguous-operation recovery (no automated resend)

Record the incident/correlation, stop affected intake, inspect the internal HMAC reservation, request epoch and provider evidence under separate authorized operational access. B1 provider idempotency key is derived from the stored request UUID; status dispatch uses its stored fingerprint. `inspectDispatch` is internal read-only, not an HTTP endpoint. Never clear inflight merely because time elapsed, a process restarted, or the provider idempotency window expired. No delivery evidence means HOLD. Confirmed provider acceptance may support a separately reviewed fenced completion; a new send needs proof of non-delivery and explicit recovery authorization. No recovery mutation or live provider lookup was performed in this task.

Retention/pruning for technical proof and budget rows needs an approved operational policy before production. Generic contact idempotency release does not touch these scopes, and no generic expiry purge was added that could resurrect unknown sends or spent proofs.

## Test evidence from this implementation session

- Backend unit/contract/security/regression: 65 PASS, 0 FAIL, 0 SKIPPED.
- Fresh real isolated PostgreSQL 16 integration: 60 PASS, 0 FAIL, 0 SKIPPED (includes seven memory-adapter contract checks; the remainder exercise real PostgreSQL, including Node parent suites).
- HTTP checks include neutral status/body/cache/referrer headers and 30 bounded timing samples with blocked provider work. This tests absence of provider-latency coupling, not mathematical timing equality under arbitrary network/load.
- PostgreSQL tests include multi-process B1, HTTP API restart, actual status request/proof/replay, independent stores, crash-safe unknown reservations, atomic token consumption, budgets, migration cutover and immutable consent.
- Newsletter browser tests: 22 PASS, 0 FAIL, 0 SKIPPED; existing consent browser tests 5 PASS; footer validation 5 PASS; backend syntax 34 PASS. Newsletter tests use mocked HTTP provider/API; real browser DOM/navigation/accessibility behavior. These complement the real HTTP API/PG integration tests and are not live-provider end-to-end verification. Screenshots are CI artifacts.
- Existing consent, footer validation, SEO, security-header and syntax gates retained. Final browser counts and exact-head CI are recorded on the draft PR.

Local Node 24's isolated test runner reported file-level results in this environment; final local runs used `--test-isolation=none` to expose actual tests. CI uses its configured Node versions and its own test results. Test counts include nested suites as Node reports them.

Internal review found and fixed an admission-limit race with a 200-request regression. This is not the required independent Claude/Factory audit. Factory availability does not block coding; independent review and separate Owner merge/release GO remain pending.

CODING: implemented. TESTED: local evidence above, exact-head CI on PR. AUDITED: independent audit pending. MERGE READY: NO. PRODUCTION READY: NO.
