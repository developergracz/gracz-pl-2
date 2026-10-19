# #280 offline validation report

Scope: containment and key primitive only. Activation HARD HOLD.
Node v24.19.0; synthetic keys and example.test mailboxes; local fake providers only.
The PR identifies the exact reviewed commit SHA and independent audit verdict.

| Command (repository root unless stated) | Result |
| --- | --- |
| `cd contact-api && env -i PATH="$PATH" NODE_ENV=test npm test` | Baseline 125/125; final 131/131 PASS, no skips |
| `bash scripts/test-newsletter-option-b-pg.sh 16` | 113/113 PASS, no skips, disposable PostgreSQL 16 |
| `bash scripts/test-newsletter-option-b-pg.sh 18` | 113/113 PASS, no skips, disposable PostgreSQL 18 |
| `CHROMIUM_PATH=/usr/bin/chromium NODE_PATH=/tmp/newsletter-e2e/node_modules /tmp/newsletter-e2e/node_modules/.bin/playwright test --config=tests/newsletter/playwright.config.cjs` | 58/58 PASS, desktop/mobile, requests intercepted |
| `node --test --test-isolation=none scripts/test-newsletter-maintenance-notice.mjs scripts/test-footer-newsletter-premium-validation.mjs` | 7/7 PASS |
| `cd contact-api && npm run check` | PASS; added modules and UI also checked using `node --check` |
| `node scripts/check-security-headers.mjs` | PASS, 19 HTML files |
| `node scripts/check-maintenance-seo.mjs` | PASS, 17 sitemap URLs, 19 favicon-covered pages |
| `bash -n scripts/test-newsletter-option-b-pg.sh` / `git diff --check` | PASS |

Setup: `npm install --ignore-scripts --no-package-lock --no-audit --no-fund --cache
/tmp/gracz-npm-cache` in contact-api. No package lock existed, so initial `npm ci
--offline` failed without installing. Playwright 1.56.1 installed under /tmp.
Browser download was blocked by network policy (403); used the already installed
`/usr/bin/chromium`, as supported by repository config. No policy bypass.

Local images pulled using explicit local Docker socket; no external Docker context:
`postgres:16-alpine` digest
`sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`;
`postgres:18-alpine` digest
`sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873`.
Script binds random loopback ports, discards inherited DB environment, uses only
`gracz_test`, and removes its own container on exit. Test log: /tmp/280-pg16.log or
/tmp/280-pg18.log. Never use production URLs with integration tests.

## What the evidence establishes

- Actual business HTTP process remains held even with synthetic old keys and
  pause=false; 503 on readiness/all actions and zero provider calls.
- `n1`/`ns1` links never POST in all three UI actions, after navigation/restoration;
  no fake withdrawal-completed message. Source route rejects before body processing.
- Independent purpose-key round trips, random nonces, purpose/key substitution,
  expiration, forged/legacy envelopes, missing/unknown/retired/compromised keys,
  duplicate purpose/key material and identity normalization behavior.
- New PG fixture: 2 contacts / 32 events / 1 confirmation; exact every-public-table
  snapshot unchanged around held actions/restarts. Withdrawal/provider block,
  unknown DOI, inflight dispatch, consumed proof, budget, registry and seal remain.
- Existing PG suites still exercise concurrency, expired dedup, provider uncertainty,
  lost COMMIT acknowledgement, SIGKILL/restart, replay tombstones, cutover and
  checkout failures. Their legacy process cases run on a guarded test-only adapter;
  those are characterization of existing fences, NOT new recovery-flow tests.

## Failures investigated (not hidden)

Initial new key/hold tests failed before modules/wiring existed; revoked-token
browser test failed because the baseline still enabled old links. Both turned green.
The pre-existing maintenance static assertion also failed on #276 baseline; it now
asserts explicit compromised-format rejection plus preserved intake controls, with
behavioral browser coverage. No test was removed or skipped.

Initial full PG runs rejected formerly successful legacy API calls with 503, and
left old test child processes alive after assertions failed; those task-owned
processes were stopped. Moving three process suites to the guarded synthetic legacy
entrypoint preserved their original crash/replay assertions. One interim full run
was 112/113: R5.2 checkout test expected DB work via the now-inert business readiness.
It now uses the same guarded characterization entrypoint; actual production HOLD
has its own HTTP test. Final full runs are the results in the table.

## Explicitly unexecuted / unimplemented

New recovery challenge issuance/consumption, evidence adapter, alias concurrency/
collision/mapping, verified withdrawal executor and recovery-specific lost-COMMIT
handling are NOT implemented or integration-tested. Their precise schema/transaction
plan and evidence gates are in NEWSLETTER_OPTION_B_280.md. No synthetic test is
reported as production mapping proof. No operator rehearsal, escrow comparison,
production migration, provider inventory, native pg_dump drill for this change,
Windows restore suite, legal review or production readiness check was performed.
Existing PG logical-restore tests did run. GitHub CI status, if any, is separate
from these local results. No real emails, production reads/writes, merge or deploy.

The first run of the checked-in PG18 runner exposed a startup race: socket-only
`pg_isready` could observe Docker's temporary initialization server, then lose the
connection when initialization restarted PostgreSQL. The runner now checks TCP
127.0.0.1 inside the container (the temporary server is socket-only); final full
PG16/18 runs use that readiness barrier. No test assertion was relaxed.
