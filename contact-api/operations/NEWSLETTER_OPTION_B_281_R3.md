# PR #281 — R3 corrective delta and review handoff

Baseline: `cbea6a6a8745dbe594226ae011fbbc88a16ae341`.
Owner accepted Claude R2: PASS WITH NON-BLOCKING FINDINGS, 0 P0 / 0 P1.
This document concerns only R3; it does not repeat or supersede the full R2 audit.
**DRAFT / PRODUCTION HARD HOLD. NO MERGE, DEPLOY, PRODUCTION SQL, SECRET ROTATION,
REAL SENDS OR NEWSLETTER ACTIVATION.** #282 remains outside this change.

## Disposition

| Finding | Status | Correction or remaining limitation |
| --- | --- | --- |
| P2-1 / R3-A | FIXED | Explicit reviewed first-party and external import manifests, transitive AST traversal, canonical URL membership, ambiguous specifier rejection and mutation fixtures. Symlink checkout root accepted; per-file aliases rejected. |
| P2-2 / R3-B | FIXED | HTML/JS revoke the claim that historical links remain usable. Failed actions clear their token and controls, replace click-oriented copy and focus accessible feedback. |
| P2-3 | DEFERRED | Explicitly excluded by Owner R3 mandate; separate Owner decision remains required. No closure or production readiness inferred. |
| P2-4 | DEFERRED | Explicitly excluded by Owner R3 mandate; separate Owner decision remains required. No closure or production readiness inferred. |
| P3-1 | FIXED | Backend lockfile with integrity hashes; npm ci in backend CI and future business build; dedicated backend production CVE audit. Existing security jobs remain. |
| P3-2 | FIXED | Properly formed synthetic legacy envelopes, five newsletter endpoints with error contract, rejected contact plus successful synthetic contact with newsletter denied, all-table snapshots and restart. Only expected local CONTACT effects are permitted. |
| P3-3 | FIXED | Neutral error heading/copy for 4xx, 503, other 5xx and transport failures; hidden revoked-link control, focused feedback, no retained retry token. |
| P3-4 | DEFERRED (partially fixed) | All-zero/repeated-byte material now rejected with tests. No entropy/provenance guarantee is claimed. Immediate cross-process revocation remains unimplemented: immutable offline keyring replacement and stopping all old instances are still required. A mutable local flag would not solve fleet revocation. Module remains unwired; separate lifecycle design/review required before activation. |
| P3-5 | FIXED | Recursive .js/.cjs/.mjs syntax discovery; first-party symlinks explicitly refused rather than silently skipped. Dependencies excluded. |
| P3-6 | FIXED | URL membership replaces OS-dependent path denylist. POSIX/Windows-style URL fixtures plus real symlink checkout/escape tests. Native Windows execution is not claimed. |
| P3-7 | FIXED | Backend engines >=24.19.0 <25; backend CI pinned 24.21.0. Local verification 24.19.0. Independent frontend/other-package Node choices remain outside backend runtime requirements. No live runtime configuration changed. |
| P3-8 | FIXED | Required runner checks actual per-file execution and final counts; skip, todo, failure, cancellation or empty suite fails. PG entrypoint requires guarded disposable URL. Synthetic runner tests exercise rejection. |
| P3-9 | NOT APPLICABLE | Business build's node --check of newsletter.mjs parses syntax only; it neither imports nor executes the module. Retained for legacy regression source hygiene. Default maintenance path remains unchanged and inert. |

## Validation

Required local commands:

- `npm --prefix contact-api ci --ignore-scripts --no-audit --no-fund`
- `npm --prefix contact-api test` and `npm --prefix contact-api run check`
- `bash scripts/test-newsletter-option-b-pg.sh 16` and `18`
- Playwright 1.56.1, `tests/newsletter/playwright.config.cjs` and `tests/consent/playwright.config.cjs`
- `node --test scripts/test-newsletter-maintenance-notice.mjs scripts/test-footer-newsletter-premium-validation.mjs`
- `node scripts/check-maintenance-seo.mjs` and `node scripts/check-security-headers.mjs`
- `bash contact-api/maintenance/build.sh` (default inert branch only)
- `npm --prefix contact-api audit --omit=dev --audit-level=high`
- Gitleaks 8.24.3 redacted scan of the R3 commit; unmodified scanning policy.

Final receipts and exact SHA belong in the PR body / Owner report. Counts are not
transferred between commits. CodeQL is verified through GitHub CI, not claimed as
locally executed. Browser tests use only intercepted endpoints and local static
files; local consent configuration selects installed Chromium without source changes.

Observed intermediate failures are not hidden: the added graph/notice/weak-key
regressions failed before fixes. The new runner initially mishandled Node summary
metadata and empty-file pseudo-tests; its fixture suite now covers these cases.
An initial consent run failed to launch because Playwright's bundled browser was
absent; the installed Chromium run is used for the local receipt. Under concurrent
local load an existing legacy process configuration test observed readiness 503
immediately after liveness 200. It now waits boundedly for readiness independently
and still asserts 200; failing subtests clean up their process. No production
readiness timeout or assertion was weakened. PG logs now use unique files, avoiding
cross-run truncation/interleaving. Final full PG gates must pass without skips.

## Review boundary

One independent Claude review of **baseline..new HEAD only**:

1. Manifest/canonicalization and the new graph mutations; confirm held manager and
   business import boundary remain unchanged. Reviewed pg is terminal, not a
   recursively sandboxed dependency; lockfile and production audit cover it.
2. Public copy and all action error states; no successful action claimed on error,
   no historical bearer restored, accessible feedback retained.
3. Synthetic HTTP/PG test changes and strict runner: full state comparisons for
   newsletter requests; for successful CONTACT, only its own tables/idempotency
   namespace may change, while newsletter state is identical. Restart includes
   both types of data. Provider trap distinguishes local contact from newsletter.
4. Deterministic installation/security gate, module discovery and backend Node
   requirement. Default maintenance build/start and SQL checksums unchanged.
5. Repeated-byte key refusal only; active/retired/compromised semantics unchanged.
   Assess documented P3-4 deferral without treating it as production authorization.

No mailbox verification, alias mapping, private withdrawal register, provider/DNS
configuration or production evidence was added. All prior escrow, mapping,
withdrawal/reconciliation and activation gates remain. Owner operational statements
in #282 do not prove a completed withdrawal service. No full recovery is claimed.

## Exact R3 file scope

- `.github/workflows/maintenance-seo.yml`
- `.github/workflows/security-gate.yml`
- `contact-api/integration/newsletter-option-b.integration.test.mjs`
- `contact-api/integration/newsletter-r4-process.integration.test.mjs`
- `contact-api/maintenance/build.sh`
- `contact-api/operations/NEWSLETTER_OPTION_B_281_R3.md`
- `contact-api/package-lock.json`
- `contact-api/package.json`
- `contact-api/scripts/check-modules.mjs`
- `contact-api/scripts/run-tests.mjs`
- `contact-api/security/newsletter-purpose-keys.mjs`
- `contact-api/test-support/held-http-server.mjs`
- `contact-api/test-support/production-import-graph.mjs`
- `contact-api/test-support/production-import-manifest.mjs`
- `contact-api/test-support/synthetic-legacy-envelopes.mjs`
- `contact-api/test/newsletter-purpose-keys.test.mjs`
- `contact-api/test/production-import-graph.test.mjs`
- `contact-api/test/strict-runner.test.mjs`
- `contact-api/test/syntax-discovery.test.mjs`
- `docs/superpowers/plans/2026-10-19-newsletter-r3.md`
- `maintenance-site/assets/newsletter-full-max-r1.js`
- `maintenance-site/newsletter/index.html`
- `scripts/test-newsletter-maintenance-notice.mjs`
- `scripts/test-newsletter-option-b-pg.sh`
- `tests/newsletter/maintenance.spec.cjs`
- `tests/newsletter/newsletter.spec.cjs`

Local final receipt: backend 165/165, PG16 113/113, PG18 113/113, newsletter browser 76/76, consent browser 5/5, maintenance/Premium 8/8; all zero FAIL/SKIP. Syntax, SEO, CSP, inert maintenance build and backend production npm audit passed. GitHub exact-SHA receipt is recorded in PR metadata after completion.
