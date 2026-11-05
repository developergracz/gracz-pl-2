# GRACZ.PL / Gomoku — P4 Capacity Report (2026-11-05)

**Decision: P4 30,000 concurrent players = HOLD / NOT PROVEN.**
**Isolated transport milestone: PASS at 512 simultaneous live WebSocket subscriptions.**
This report is evidence of current per-process transport behavior, not evidence of 30,000-player capacity.

## Provenance

- Test source: `contact-api/performance/gomoku-p4-capacity.test.mjs`
- Actual implementation under test: `contact-api/auth/gomoku-realtime.mjs` (`createGomokuRealtime`)
- CI: `.github/workflows/gomoku-p4-capacity.yml`
- GitHub Actions job ID: `127145120219`, successful, 2026-11-05 ~08:53 UTC.
- Associated PR: [#678](https://github.com/developergracz/gracz-pl-2/pull/678)
- Only loopback `127.0.0.1` was used; **zero artificial requests were sent to production**.

## Test methodology

- Genuine TCP/WebSocket client/server using installed `ws` and production P2 adapter.
- Synthetic in-memory authorization and matches. Two distinct fake users subscribed per match.
- Deterministic room IDs, no login secrets or real user data.
- Admission waves of 8 clients, every 560 ms to respect production's 20/s connection throttle.
- Stages: 100, 256, 500, 512 concurrent active WebSocket connections.
- Each stage tests notifications/fan-out to 48 client subscriptions (24 matches) after version increments.
- Extra 513th connection tested explicitly. Expected rejection `HTTP 503`.
- Percentile p95 means 95% of recorded samples did not exceed the listed duration.
- First-snapshot p95 measures connection setup **plus** subscription, auth stub and snapshot receipt; it is not handshake-only timing.
- Metrics measure the local CI process and do not predict internet latency or production resource use.

## Results

| Active WebSockets | First snapshot p95 | Match-change fan-out p95 | CI-process RSS |
|---:|---:|---:|---:|
| 100 | 17.9 ms | 8.0 ms | 78 MB |
| 256 | 8.8 ms | 6.0 ms | 86 MB |
| 500 | 6.4 ms | 5.3 ms | 96 MB |
| 512 | 5.7 ms | 4.4 ms | 102 MB |

- Test: PASS (1/1). Elapsed: 37 seconds.
- 513th connection: rejected with HTTP 503.
- Configured limit in production adapter: `maxConnections=512`, admission limit 20/s, and 4 connections/session nickname.
- Target 30,000: **not met**. Do not conflate cumulative simulated users or a synthetic test with concurrent authenticated live traffic.
- The arithmetic lower bound is `ceil(30000 / 512) = 59` process instances *if* each could consistently sustain 512 connections. This is **not** a sizing recommendation and excludes resource overhead, resilience capacity, shared state, DB queries, distribution imbalance and traffic from checkers/other APIs.

## Current infrastructure checked

- Render `gracz-contact-api` deploy LIVE on `main` (2026-11-05).
- One Frankfurt instance, plan details `0.5 CPU / 512 MB`.
- No Render Key Value/Redis instance found.
- The WebSocket adapter holds connections and subscriptions in process-local maps and sets. No multi-instance inter-process pub/sub has been validated.

## What remains to finish P4 at the requested 30,000 players

1. Agree a resource/budget plan and isolated staging topology. Do not point high loads to `gracz.pl` or live API.
2. Make cross-instance authorized match/chat/clock event distribution and session revocation work with horizontal scaling (P3 dependency).
3. Repeat progressive concurrent-player load with actual authentication, PostgreSQL, real moves/chats, network delays, reconnections, and normal login traffic.
4. Record p50/p95/p99, CPU/RAM, connection failure rates, queue/DB latency, sustained duration, recovery, and cost per concurrent player.
5. Mark 30,000 **PASS** only after sustained 30,000 simultaneous authenticated clients succeed within explicitly agreed service-level objectives; otherwise retain HOLD.

No production service configuration or billing was changed in this milestone.
