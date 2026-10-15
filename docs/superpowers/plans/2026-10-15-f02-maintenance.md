# F-02 inert API Implementation Plan

> For agentic workers: execute inline using superpowers:executing-plans; keep PR254 isolated.

**Goal:** Prepare the independently deployable maintenance artifact requested by Owner's F-02 R1 mandate (2026-10-15); implementation only.
**Architecture:** Standalone Node HTTP listener, no application imports. Direct build/start scripts bypass package scripts and migrator. Existing test job discovers the new contract/process test.
**Tech Stack:** Node >=20 built-ins, POSIX shell, node:test.
**Spec:** Owner mandate in this chat: GET /health200, all business routes503, no email/DB/background operations; stop-writer evidence and safe rollback before any future cutover.

## Global Constraints
- Separate branch from fetched main bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e; do not change PR254/F-01.
- NO merge, deploy, Render changes, production SQL/email, new services. Migration005 HARD HOLD.

## Review Focus
- Unknown routes/methods, query strings and malformed bodies must never reach production handlers.
- Expect/upgrade/CONNECT must not open alternate execution paths.
- Health success proves only the responding maintenance instance, never disappearance of old writers.
- Existing credentials/provider endpoints must not activate clients; standalone copy runs without node_modules.
- Rollback must keep inert service, never revive legacy sender or erase consent/reservations.

## Task 1 — artifact and tests
- [x] Add process tests in contact-api/test/maintenance.test.mjs; run failing test for absent artifact.
- [x] Create maintenance/server.mjs and build.sh/start.sh; fixed health/503 contract, direct Node invocation and bounded shutdown.
- [x] Test routes/methods/bodies, HTTP alternate events, environment canary endpoints, isolation, signals, startup validation and build commands.
- [ ] Run full backend tests and existing CI (no new workflow).

## Task 2 — operational proposal
- [x] Create maintenance/README.md: exact future commands for both Render root layouts, approvals, deploy overlap, old-instance termination evidence, migrator control and rollback to inert artifact.
- [ ] Review complete diff independently; commit/push separate branch and create DRAFT PR.

## Execution ledger
- Ruling: use external sibling worktree to preserve PR254 directory and untracked test artifacts; no new ignore rule needed.
- Ruling: no production package changes; direct scripts and existing test discovery keep maintenance independently usable on main and the newsletter revision.

- Final review: separate read-only reviewer found duplicate response on parser error; reproduced RED and fixed by closing malformed sockets.
- Final fix: refused upgrade with half-open peer could delay shutdown; reproduced RED and explicitly destroyed rejected socket after response flush. Both covered by raw-socket regressions.
- Initial RED: missing independent artifact assertion failed. Final suite results are in the PR; no production actions.

- Verification:9/9 artifact tests and43/43 full main-based backend tests PASS,0FAIL/0SKIPPED;23 existing syntax checks plus standalone build PASS; SEO/CSP PASS. Publication and exact-HEAD CI evidence will be recorded in the DRAFT PR.
