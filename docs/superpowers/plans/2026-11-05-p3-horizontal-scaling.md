# P3 horizontal scaling implementation plan

> Execute inline with superpowers:executing-plans. Owner mandate is the specification; no further design approval required for the authorized implementation.

**Goal:** synchronize Gomoku and Warcaby across independent API processes; PostgreSQL remains authoritative.
**Architecture:** existing version-checked HTTP commands commit before notifications. Optional Redis/Valkey Pub/Sub transports invalidations, never game state or identities. The existing WebSocket adapter rechecks authorization and reads PostgreSQL; reconnect and bounded periodic reconciliation repair lost invalidations. HTTP remains available. No production activation in this change.
**Tech stack:** Node 24, existing pg/ws, Redis client, PostgreSQL, Valkey.
**Spec:** Owner mandate pasted in this chat, P3 then PASS then P4.

## Constraints
- Branch from current main; preserve identity, game rules and visual assets.
- No production load, paid resources or activation of production Redis without Owner approval.
- P3 acceptance requires two processes, real PostgreSQL and Valkey, authenticated players and failure recovery.
- P4 starts only after P3 PASS and merge; no estimated 30,000-player PASS.

## Review focus
- Lost final notification must recover even if no later move occurs.
- Unauthorized clients and revoked sessions must never receive another player's projection.
- Concurrent/replayed HTTP writes must retain optimistic version protection.
- Redis outage must not change the outcome of a PostgreSQL commit.
- Queues, subscriptions, read concurrency and reconnect work must be bounded.

## Tasks
- [x] 1. Add and run a failing two-process integration test for cross-instance moves/chat, both games, stale writes, clocks/undo, reconnect and access denial. Use disposable loopback services only.
- [x] 2. Extend `contact-api/auth/gomoku-realtime.mjs` as the shared transport, with an optional Redis bus and indexed rooms, bounded publication/admission/read queues, reconciliation and reconnect. Wire `server.mjs` without enabling production configuration.
- [x] 3. Update `public-identity.mjs`: shared change hook, a trusted internal combined snapshot read, lazy match initialization and bounded game-query work. Keep public HTTP contracts and version guards.
- [x] 4. Connect `checkers-console.mjs` to the existing realtime client, keeping HTTP fallback and all UI/rules unchanged. Verify browser behavior and existing relevant regression tests.
- [ ] 5. Run acceptance against two independent processes, including Redis outage and abrupt instance loss. Record actual results/configuration, review diff, create PR and respect GitHub protections when merging.
- [ ] 6. Only after P3 PASS/merge, create P4 branch and run progressive real-player load tests in an isolated environment; report measured failures or concrete infrastructure blockers.

P3 review: fixed incomplete POST bodies exhausting DB admission (RED→GREEN).
Required CI exposed the explicit production import manifest; registered the reviewed optional bus and Redis client without weakening the import gate. Full contact-api suite: 571/571 PASS.

Resume: integrated main 560b88b5, corrected invitation schema initialization order exposed by fresh-database CI. Fresh PostgreSQL/Valkey P3 integration 4/4; current full contact-api suite 586/586 PASS.
