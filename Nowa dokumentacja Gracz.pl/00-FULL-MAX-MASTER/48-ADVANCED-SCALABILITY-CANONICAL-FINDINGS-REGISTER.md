# GRACZ.PL — ADVANCED SCALABILITY CANONICAL FINDINGS REGISTER

**Date:** 2026-09-09  
**Status:** OPEN / CORRECTION REQUIRED  
**Audit target:** `main`  
**Exact main SHA:** `06186b4120054d177c0d3d66517edcf2de3ff857`  
**Exact TREE:** `0ba0abce0993c145164b20f2881f118e0b71124d`  
**Owner:** Czesław Socha  
**Lead:** ChatGPT / Lead Architect  
**Auditors considered:** Lead, Gemini, ChatGPT-2  
**Claude:** FINAL CLOSURE AUDITOR AFTER CORRECTIONS + TESTS + BENCHMARK

## 1. Purpose

This document is the canonical Lead-triaged register for Advanced Scalability findings. It preserves the independent-audit evidence but does not accept any auditor verdict blindly.

Canonical lifecycle:

`finding -> Lead verification -> canonical classification -> correction -> tests/CI -> benchmark -> final Claude closure audit -> Lead verification`.

No item in this document authorizes merge, deploy, Render/ENV/DNS/Cloudflare changes or production database changes.

## 2. Current overall verdict

```text
ADVANCED SCALABILITY GATE = OPEN / HOLD
DURABLE GAME-STATE FOUNDATION = STRONG
HORIZONTAL RUNTIME = NOT YET CLOSED
NUMERIC CAPACITY = UNKNOWN
FUNDAMENTAL REWRITE = NOT REQUIRED
REDIS REQUIRED NOW = NOT PROVEN
KAFKA REQUIRED NOW = NO
KUBERNETES REQUIRED NOW = NO
WEBSOCKET REQUIRED NOW = NO
CORRECTIONS BEFORE SERIOUS HORIZONTAL SCALE = YES
CORRECTIONS BEFORE HONEST CAPACITY CLAIM = YES
```

Gemini final `PASS WITH NON-BLOCKING FINDINGS` is NOT accepted as the canonical verdict because its own report marked several findings scale-blocking and contained material factual inaccuracies.

ChatGPT-2 final `FAIL — CORRECTION REQUIRED` is accepted at verdict level after Lead verification, with severity/priority adjustments below.

## 3. Canonical findings

### AS-CAN-F01 — PostgreSQL aggregate connection budget is not centrally controlled

**Severity:** HIGH  
**Scale blocking:** YES before adding serious horizontal replicas  
**Wave:** A

Verified architecture creates 19 independent PostgreSQL pools in one production process. Code-derived theoretical per-replica pool ceiling is 76 connections, including node-postgres default `max=10` where no explicit max is configured. This is a theoretical ceiling, not steady-state usage; pools grow lazily. One Checkers LISTEN connection is long-lived.

Formula:

`TOTAL_DB_CONNECTIONS = REPLICA_COUNT × 76 + OPS/ADMIN + DB_RESERVED`

Production `max_connections`, replica count and reserve are currently UNKNOWN. Therefore immediate PgBouncer adoption is NOT yet mandated; first correction is explicit centralized budgeting/pool composition and measurement.

### AS-CAN-F02 — Lobby state is process-local

**Severity:** HIGH  
**Scale blocking:** YES  
**Wave:** A

`LobbyService` stores `#rooms`, `#presence`, and `#invitations` in local `Map` instances. A room or invitation created on Node A is not visible on Node B. Restart removes waiting-room state.

**Data corruption:** NO durable corruption.  
**Multi-node functionality:** FAIL.

### AS-CAN-F03 — Tysiąc realtime is process-local

**Severity:** HIGH  
**Scale blocking:** YES for multi-node  
**Wave:** A

Tysiąc durable revision-CAS is strong, but `ThousandRealtimeHub` stores subscribers in a local `Map` and has no cross-node signal bus. Node A can commit a valid action while a subscriber on Node B receives no realtime update.

**Durable state:** SAFE.  
**Cross-node realtime:** FAIL.  
**Preferred direction:** reuse signal-only PostgreSQL LISTEN/NOTIFY pattern unless benchmark proves another broker necessary.

### AS-CAN-F04 — Global Chat realtime/presence are process-local

**Severity:** HIGH  
**Scale blocking:** YES for generic multi-node chat/presence  
**Wave:** A

Messages are durable in PostgreSQL, but `presence`, `subscribers`, local spam state and `broadcast()` are process-local. Node B is not guaranteed to receive a realtime event emitted on Node A; online presence differs by replica.

**Message durability:** PASS.  
**Cross-node realtime/presence:** FAIL.

### AS-CAN-F05 — MatchRuntime stale ownership is fenced but lacks bounded recovery/routing

**Severity:** HIGH  
**Scale blocking:** YES for generic round-robin multi-node Checkers runtime  
**Wave:** A

`MatchRuntime` caches ownership epoch in `#ownership`. PostgreSQL correctly rejects a stale epoch with `MATCH_RUNTIME_STALE_OWNERSHIP`, protecting state. The runtime does not clear/reclaim/reroute automatically after that rejection, so repeated requests to a stale node can repeatedly fail with 409.

**State corruption:** NO.  
**Horizontal functional completeness:** INCOMPLETE.

### AS-CAN-F06 — SSE admission/backpressure/drain controls are incomplete

**Severity:** HIGH  
**Scale blocking:** YES before serious realtime scale / rolling multi-node deployment  
**Wave:** A

Across SSE implementations there is no common explicit per-user/per-game/global admission budget and no common handling of `response.write() === false` backpressure. Checkers lacks an application heartbeat equivalent to Tysiąc/Global Chat. Shutdown currently closes realtime hubs only inside the `server.close()` callback, creating a long-lived-SSE drain hazard.

Required Wave A result: bounded admission model, backpressure-safe behavior, explicit drain ordering and shutdown deadline.

### AS-CAN-F07 — Readiness does not represent all globally critical dependencies

**Severity:** HIGH operational / MEDIUM code complexity  
**Scale blocking:** YES before robust multi-replica deployment  
**Wave:** A

`/health/ready` checks only the primary `store.healthCheck()`. A node can report ready while the fail-closed distributed limiter is unavailable, causing normal application traffic to return 503. Feature-specific dependencies need tiered health semantics rather than blindly failing the whole node.

### AS-CAN-F08 — Runtime schema/DDL initialization is unsafe as a general multi-replica deployment model

**Severity:** HIGH operational  
**Scale blocking:** YES before reliable rolling multi-replica startup  
**Wave:** A

Many services run DDL at startup. Some initialization paths use advisory locking, but not all. `AuditService` performs trigger/function DDL without a shared cross-replica serialization contract. This creates feasible startup races/lock contention.

Wave A target is not a giant migration redesign; it is a safe, explicit separation/serialization contract for schema preparation versus normal replica boot.

### AS-CAN-F09 — SecurityMonitor request-window algorithm scales poorly

**Severity:** HIGH  
**Scale blocking:** YES before serious load benchmark  
**Wave:** B

`SecurityMonitor` stores a 15-minute event window and repeatedly scans/filter()s it on each response. Event count is time-bounded but not count-bounded. Under sustained traffic, CPU/allocation cost grows sharply with RPS.

This is a CPU/RAM monitoring-path problem, not proof that distributed brute-force enforcement is absent.

### AS-CAN-F10 — Auth-session validation causes SELECT + UPDATE write amplification

**Severity:** HIGH  
**Scale blocking:** YES before serious authenticated scale  
**Wave:** B

A normal existing session commonly executes `has(tokenId)` (SELECT) followed by `assertActive()` (UPDATE `last_seen_at=NOW()`). This creates DB round-trip and WAL amplification on ordinary authenticated traffic.

Correction must preserve revocation and idle-timeout semantics.

### AS-CAN-F11 — Static asset requests consume application DB limiter + filesystem/no-cache path

**Severity:** HIGH for serious anonymous traffic  
**Scale blocking:** YES before serious public-load benchmark  
**Wave:** B

Extended assets are read via `fs.promises.readFile()` per request, served `no-store/no-cache`, and request composition applies the shared request guard before asset routing. Static traffic therefore consumes PostgreSQL limiter writes plus filesystem work.

Direction: clear static/cache/CDN boundary without weakening API/security controls.

### AS-CAN-F12 — Tournament filters are applied after generic SQL LIMIT 200

**Severity:** HIGH  
**Scale blocking:** YES for tournament discovery correctness  
**Wave:** B

`tournaments.list()` retrieves a generic ordered `LIMIT 200` and only then applies `status/game/mine/search` filtering in JavaScript. With >200 tournaments, valid matching records outside the first 200 can become invisible.

This is a real user-visible correctness defect at dataset scale, not merely an optimization.

### AS-CAN-F13 — Established SSE authorization lifetime is not tied to subsequent session revocation

**Severity:** HIGH security/privacy  
**Scale blocking:** NO by itself  
**Wave:** B

Authorization is checked when an SSE stream is opened, but existing streams do not have a common reauthorization/max-lifetime/revocation contract. A revoked/logged-out session may remain connected and continue receiving personalized events until the stream ends.

### AS-CAN-F14 — PostgreSQL distributed rate limiter is a potential hot-write path

**Severity:** MEDIUM/HIGH risk, measurement required  
**Scale blocking:** BENCHMARK-DEPENDENT  
**Wave:** C decision after benchmark

Each distributed counter uses synchronous `INSERT ... ON CONFLICT DO UPDATE`, often multiple counters per request. This can create WAL, row-lock and connection pressure.

However the current design is cross-node and fail-closed. Immediate replacement with Redis/local async flush is NOT authorized by evidence. Benchmark first.

### AS-CAN-F15 — Rankings replay full durable history per request

**Severity:** HIGH long-term scale risk  
**Scale blocking:** YES before large historical dataset  
**Wave:** C / may move earlier if benchmark or dataset growth requires

All-time ranking reads ended games, reconstructs events, sorts and recomputes ratings in Node for every request. Cost grows with historical game count.

Likely long-term direction: durable ranking projection/read model; exact design deferred until benchmark and product requirements.

### AS-CAN-F16 — Gomoku 1.2s polling causes structural read amplification

**Severity:** MEDIUM/HIGH  
**Scale blocking:** BENCHMARK-DEPENDENT  
**Wave:** C

Frontend polls every 1200 ms. Correctness remains protected by PostgreSQL CAS, but many connected clients can generate significant authenticated GET, limiter, session and game-read traffic.

Do not force SSE/WebSocket before measurement.

### AS-CAN-F17 — Tournament standings recomputation is O(players) write-heavy under tournament lock

**Severity:** MEDIUM  
**Scale blocking:** NO for small launch; benchmark required  
**Wave:** C

Each result can trigger two per-player UPDATE passes plus associated reads while the tournament parent row is locked. Correctness is strong; hot large tournaments may experience queueing.

### AS-CAN-F18 — MatchRuntime idempotency command table has no visible retention/compaction policy

**Severity:** MEDIUM  
**Scale blocking:** NO initially  
**Wave:** C / storage policy

Every accepted command stores full `result_state`. No retention/compaction policy is currently visible. Long-term storage/WAL growth must be measured and governed.

### AS-CAN-F19 — Strong scrypt and filesystem work can contend for libuv worker resources

**Severity:** MEDIUM  
**Scale blocking:** MEASUREMENT REQUIRED  
**Wave:** C

Do not weaken scrypt. Remove unnecessary static filesystem work from hot request path and benchmark controlled authentication bursts.

### AS-CAN-F20 — Numeric capacity is not measured

**Severity:** GATE REQUIREMENT  
**Scale blocking:** YES for capacity claims  
**Wave:** BENCHMARK

The repository has strong correctness/concurrency tests but no true capacity benchmark suite. Statements such as 1k/10k/100k concurrent users are NOT PROVEN.

Planned evidence package: k6 + custom Node SSE/multi-node harness, 1 -> 2 -> 4 replicas, measuring RPS, p50/p95/p99, errors, CPU/RSS, event-loop lag, pool usage/waiting, DB query latency/locks/WAL, SSE count/backpressure/realtime latency and failure behavior.

## 4. Rejected / corrected auditor claims

### Gemini claims rejected or corrected

- `AS-GEMINI-F01` "unbounded in-memory chat message buffer" = REJECTED AS WRITTEN. PostgreSQL is used in production; memory fallback is explicitly bounded to 1000 messages.
- `AS-GEMINI-F03` "SSE leak in platform-lobby-http.js" = REJECTED AS WRITTEN. That file is not the SSE implementation; Tysiąc already has 20s heartbeat + close cleanup.
- Gemini statement that Lobby is DB-backed / horizontally safe = REJECTED. Lobby rooms/presence/invitations are process-local Maps.
- Gemini statement that Global Chat uses PostgreSQL NOTIFY = REJECTED. Durable messages use PG, but realtime broadcast/presence are local.
- Gemini connection math `5 pools x 10 / 41 per replica` = REJECTED. Canonical code-derived model is 19 pools / theoretical ceiling 76.
- Immediate PgBouncer requirement = NOT YET PROVEN; evaluate after budget consolidation and environment measurement.
- Immediate Redis replacement of distributed limiter = NOT AUTHORIZED / NOT PROVEN.
- Gemini numeric stage/user-capacity estimates = NOT EVIDENCE; capacity remains UNKNOWN.

### ChatGPT-2 findings accepted with Lead adjustments

Accepted: Lobby local, Global Chat local realtime/presence, Tysiąc local realtime, MatchRuntime stale-owner recovery gap, rankings full-history replay, Tournament filter-after-LIMIT correctness defect, graceful SSE shutdown gap, runtime DDL risk, static path amplification, SSE auth lifetime, command-retention/storage risk.

Severity adjusted: Gomoku polling and PG limiter remain benchmark-driven rather than automatically requiring immediate architecture replacement.

## 5. Wave assignment

### Wave A — P0 horizontal correctness / multi-node operations

- AS-CAN-F01 connection budget
- AS-CAN-F02 Lobby
- AS-CAN-F03 Tysiąc realtime
- AS-CAN-F04 Global Chat realtime/presence
- AS-CAN-F05 MatchRuntime ownership recovery/routing
- AS-CAN-F06 SSE admission/backpressure/drain
- AS-CAN-F07 readiness
- AS-CAN-F08 startup DDL/multi-replica boot

### Wave B — before serious benchmark

- AS-CAN-F09 SecurityMonitor
- AS-CAN-F10 auth-session amplification
- AS-CAN-F11 static asset/cache boundary
- AS-CAN-F12 Tournament filter-before-limit/pagination
- AS-CAN-F13 SSE authorization lifetime
- minimum observability required by benchmark

### Wave C — benchmark-driven decisions

- AS-CAN-F14 distributed rate limiter architecture
- AS-CAN-F15 ranking projection/read model
- AS-CAN-F16 Gomoku polling/realtime
- AS-CAN-F17 Tournament standings write model
- AS-CAN-F18 MatchRuntime idempotency retention
- AS-CAN-F19 scrypt/threadpool capacity tuning

### Benchmark gate

- AS-CAN-F20 numeric capacity

## 6. Closure rule

A finding is not CLOSED because code changed. Closure requires:

1. exact corrected HEAD/TREE,
2. code review / Lead verification,
3. focused regression tests,
4. full required CI,
5. multi-node tests where applicable,
6. benchmark evidence where applicable,
7. independent final Claude audit on corrected snapshot,
8. Lead verification of Claude report.

Until then:

`ADVANCED SCALABILITY = OPEN / CORRECTION REQUIRED`.
