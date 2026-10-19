# Newsletter R3 implementation plan

Goal: correct the existing #281 containment delta, preserving production HARD HOLD.
Architecture: explicit static production import manifest; neutral action UI; real held HTTP tests on disposable PG; deterministic backend CI. No runtime activation or recovery implementation.
Spec: Owner R3 mandate and P3 supplement, 2026-10-19, in the private task conversation.

## Constraints
- Existing branch/PR only; no merge, deploy, production SQL, secrets or real sends.
- Preserve n1/ns1 revocation, retired/compromised denial, immutable history and existing regressions.
- PostgreSQL 16/18, complete backend, browser, maintenance/SEO and security gates.
- No sensitive incident detail in public documentation.

## Review focus
- Unknown modules under benign names: manifest rejection before read.
- Symlinked checkout versus escaping symlink: canonical root and canonical module membership.
- Windows separators and encoded URL components: URL resolution and explicit rejection of ambiguous specifiers.
- Transport/malformed responses: no restored token, misleading action copy or retry invitation.
- Valid contact with newsletter opted in: ordinary contact effect distinguishable from prohibited newsletter effects.

## Tasks
- [x] Import graph: extend contact-api/test/production-import-graph.test.mjs with benign unknown modules, reexports/dynamic edges, symlink root/escape, Windows URL fixtures. Observe failures, add explicit manifest in test-support and canonical URL checks, rerun.
- [x] UI: extend tests/newsletter and scripts/test-newsletter-maintenance-notice.mjs for neutral HTML, revoked controls and all action errors. Observe failures, update maintenance-site assets/page, rerun.
- [x] HTTP/PG: extend held-http-server helper and newsletter-option-b integration fixture with valid synthetic legacy envelopes, response contract, contact opt-in, full snapshots, restart and provider classification. Run PG16/18 with zero skips.
- [x] CI: add backend lockfile/npm ci and production dependency audit, align backend Node floor, enforce no-skips through a test runner, cover js/cjs/mjs and reject symlinks in syntax gate. Keep default maintenance build inert.
- [ ] Verify full suites, scan commit, push existing branch, verify exact-SHA CI. Document all P2/P3 dispositions and provide delta-only handoff.
