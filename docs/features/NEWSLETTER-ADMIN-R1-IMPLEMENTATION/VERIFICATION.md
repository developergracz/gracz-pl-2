# Scope, collision inventory and acceptance register

Base: `bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e` (fresh origin/main).
Branch: `codex/newsletter-admin-r1`, isolated worktree. All implementation files new.

## Preflight evidence

- #254 at `7ecb81af6a73d0eedb0340a65c880010caca0075`: runtime newsletter,
  server/routes/config, persistence/candidates/repositories, package.json, shared
  backend tests, public newsletter UI, SEO scripts and workflows. None edited here.
- #255 at `5c1d37338b31ee75b65e688b8ba155102a9a6780`: maintenance artifact,
  maintenance test, shared newsletter test and F-02 plan. None edited here.
- #256 at `bc94b49b7114c604b6915b83c41f3bc926d5e5ee`: shared newsletter test.
  Not cherry-picked or edited. Main retains its existing test timing behavior.
- #245 at `28e35c7d9288df30625f7f561e3fcda48ecbe3b8`: reviewed architecture,
  OWNER admin and A01–A16 design. No edit to its branch/docs. Current Owner mandate
  authorizes this synthetic skeleton while preserving authentication review gate.
- Merged #18 inspected: incompatible `gracz_newsletter_subscribers` plaintext model,
  moderator/admin newsletter privileges and existing auth/MFA handler. None reused.
- No shared modified path with #254/#255/#256. New backend tests picked up by the
  existing test glob. No workflow/package/migration/hosting change.

## Verification commands and limits

- `npm --prefix contact-api test`: full backend tests, including new unit + actual
  loopback HTTP integration with mocked provider (no live Resend or DB).
- `node --test contact-api/test/newsletter-admin-r1.test.mjs`: new isolated tests.
- `playwright test -c tests/newsletter-admin/playwright.config.cjs`: 12 desktop/mobile
  Chromium scenarios, retries 0. Local system Chromium used; Playwright CDN download
  was blocked by network policy. Browser dependencies installed only in /tmp.
- `node scripts/check-maintenance-seo.mjs`, `node scripts/check-security-headers.mjs`,
  new-file syntax and `git diff --check`.
- Existing PostgreSQL persistence CI runs independently on disposable PostgreSQL.
  No production SQL or local production database access. No new SQL adapter executed.
- CI results and exact final HEAD are recorded in the draft PR; do not equate local
  PASS with GitHub CI PASS. Browser checks are local, not added to a shared workflow.

Initial new test module failed before implementation. Audit test failed 0 vs 2 events
before the audit hook. Independent code review found cancellation, cursor cycles and
contradictory topic records; three new regressions failed then passed after fixes.
Codex implementation review does not satisfy the separate Claude/Factory auth gate.

## A01–A16

| Scenario | Skeleton result | Remaining release gate |
|---|---|---|
| A01 anonymous denial | PASS: handler + HTTP 403, no subscriber data | Review actual mounted host routes |
| A02 wrong role / IDOR | PASS: forged OWNER/cookies and arbitrary IDs deny | Real role/session/credential tests HOLD |
| A03 MFA | HOLD: no login/enrollment code | Independent design review, UV and recovery tests |
| A04 session expiry/logout | HOLD; opaque read handles expire/clear in unit tests | Durable session lifecycle + browser cache tests |
| A05 CSRF/CORS/fixation | PASS for denied routes and foreign-origin preview | Real cookie/CSRF/session fixation HOLD |
| A06 pagination | PASS: opaque scoped/expired cursors, disjoint pages, cycle/duplicate rejection, bounded calls | Live contract/snapshot drift and larger scale HOLD |
| A07 provider truth | PASS: all activation evidence required, contradictory topic rejected, unknown suppression never active | Approved suppression source and least privilege HOLD |
| A08 pending HMAC | PASS: matched pending detail, aggregate unavailable, no hash/address reconstruction | Real read-only PG aggregate contract HOLD |
| A09 provider failures | PASS: mocked 429/500/503, timeout; browser clears stale data/counts | Production monitoring HOLD |
| A10 consent evidence | PASS: allowlisted projection, missing/conflicting/unavailable states, no writes | Read-only PG integration HOLD |
| A11 secret leakage | PASS scoped tests: fixed audit fields, error projection, no external browser resources or storage | Full credential/bundle production audit HOLD |
| A12 abuse limits | PASS: page budget, refresh throttle, inflight guard, cancellation | Distributed auth/reader limits and alerting HOLD |
| A13 browser/a11y | PASS Chromium desktop/mobile: layout, labels, keyboard dialog and focus return | Firefox/Safari/Edge, full WCAG/assistive tech HOLD |
| A14 writes/export | PASS: absent functions and private routes deny | Recheck after future mounting |
| A15 audit | PASS: fixed metadata, sink failure denies reads | Durable actor/outcome/denial audit and retention HOLD |
| A16 DR | HOLD: no schema/secret changes, no production DR performed | Session/credential recovery + existing DR compatibility |

## Bounds and deferred capability

Search/filter covers exactly one provider page of at most 10 contacts (21 GETs).
No hidden full-list scan. Counts describe that page; global total only when the
entire result fits one page. Pending global total is null. Suppression proof absent
means unknown, not active. Consent errors never fabricate events. Opaque cursor
history detects duplicates/cycles and caps a traversal at 1000 contacts, returning
`pagination_limit` with unavailable counts instead of silently truncating. 200
cursor/handle entries maximum each, five-minute TTL. Restart/reset loses cursors.
Large-scale snapshot consistency and larger traversals require a reviewed provider
contract. No claim that a changing provider collection is a transactional snapshot.

## PASS / FAIL / HOLD

PASS: isolated artifact, synthetic-only tests, permanent denial, bounded read model,
page-scoped verified counts, Polish responsive UI and failure-state semantics.
FAIL: none known in final scoped local verification; see exact-head CI in PR for
remote results. Historical failing RED tests are development evidence, not hidden.
HOLD: OWNER authentication design and implementation; real provider/PG wiring;
global counts/pending aggregates; production audit/limiter/session persistence;
full cross-browser/a11y/legal/DR review; independent Claude/Factory approval.
MERGE HOLD. DEPLOY HOLD. MIGRATION 005 HARD HOLD. No real data, campaigns, exports,
paid service, Render configuration, secret change or modification of other PRs.

Final local run (Node 24.19.0): backend **57 PASS / 0 FAIL / 0 SKIP**, including
23 new unit/HTTP cases. Browser **12 PASS / 0 FAIL** after the review fixes.
Syntax, SEO, public-site CSP and whitespace checks PASS. Browser package emitted
only the runner's FORCE_COLOR/NO_COLOR warning. No test retry-to-green used.
