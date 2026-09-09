# Gracz.pl — Wave B k6 Load / Stress / Resilience Specification

Status: PRE-RUN SPEC — benchmark execution must follow this document.

Source snapshot:
- Wave A HEAD: `4bf1783608afafd199e23dfcb65972681b5529db`
- Wave A TREE: `70c66c308bcf4ed26dae92b67bd0f5c23b91846c`
- Wave B branch: `perf/advanced-scalability-wave-b`

## 1. Purpose

Wave B measures sustainable concurrency, latency, failure behavior, PostgreSQL saturation, SSE/realtime capacity, horizontal scaling efficiency, reconnect dispersion, security-monitor cardinality behavior, and correctness under load. It is evidence generation, not a CI-green exercise.

No Wave B benchmark may target production. No benchmark result is valid unless its exact git snapshot and environment identity are recorded.

## 2. Benchmark environment

Primary execution environment:
- ephemeral GitHub Actions hosted `ubuntu-latest` runner;
- Node.js 24.x;
- one isolated PostgreSQL service container shared by all application replicas in a run;
- application replicas are separate Node processes from the exact Wave B checkout, listening on distinct loopback ports;
- k6 runs on the same isolated runner unless a dedicated benchmark environment is later explicitly authorized;
- no production Render, production database, DNS, Cloudflare or production ENV access.

Every run records:
- `git rev-parse HEAD` and tree;
- UTC timestamp;
- `uname -a`, `/etc/os-release`, `lscpu`, memory total/available;
- Node version;
- PostgreSQL server version and `SHOW max_connections`;
- k6 version;
- replica count and ports;
- application pool configuration;
- PostgreSQL connection inventory before/during/after the run.

### Environment validity caveat

GitHub-hosted runner CPU/RAM may vary between runs. Therefore results are valid for the recorded runner identity only. Capacity conclusions above the measured runner ceiling must be classified `ENVIRONMENT LIMITED`, not application PASS. Dedicated hardware is required for authoritative 2k–10k capacity claims if the hosted runner saturates first.

Initial safety ceiling on the hosted runner:
- HTTP/mixed workload: up to 1,000 concurrent VUs before evidence supports increasing;
- long-lived SSE: up to approximately 1,000 concurrent streams before evidence supports increasing;
- breaking-point escalation above those values is conditional on runner CPU/RAM and PostgreSQL headroom.

## 3. Harness layout

```text
modern/checkers-engine/perf/
  WAVE-B-K6-LOAD-STRESS-RESILIENCE-SPEC.md
  WAVE-B-CAPACITY-REPORT.md
  k6/
    config/
      thresholds.js
      profiles.js
    helpers/
      http.js
      auth.js
      metrics.js
      deterministic.js
      sse.js
    datasets/
      README.md
    scenarios/
      01-http-baseline.js
      02-authenticated-browse.js
      03-lobby-load.js
      04-checkers-gameplay.js
      05-gomoku-gameplay.js
      06-thousand-gameplay.js
      07-global-chat.js
      08-rankings.js
      09-sse-connections.js
      10-mixed-platform.js
      11-reconnect-storm.js
      12-stress-breaking-point.js
      13-fault-injection-load.js
    reports/
      .gitkeep
  scripts/
    wave-b-runner.sh
    wave-b-env-snapshot.sh
    wave-b-postgres-sample.sh
    wave-b-correctness-check.mjs
```

Exact helper names may evolve, but scenario intent and evidence fields remain mandatory.

## 4. Deterministic test-data strategy

- Benchmark data uses a run prefix derived from `WAVE_B_RUN_ID` and deterministic integer VU/iteration IDs.
- Test accounts, lobby rooms, game IDs, request IDs and chat messages are deterministic within a run.
- Randomized traffic selection uses a declared `WAVE_B_SEED`; helper PRNG must be deterministic where scenario choice affects reproducibility.
- No production account or production identifier is used.
- Setup creates only data required by the selected scenario.
- Cleanup removes run-prefixed rows when supported; destructive cleanup is allowed only in the isolated benchmark database.
- Correctness checks query the isolated benchmark database after destructive/stress phases.

## 5. User models and traffic ratios

### B1 mixed workload target distribution

- 20% anonymous/home/lobby reads
- 15% authenticated user activity
- 15% Lobby operations
- 15% Checkers activity
- 10% Gomoku activity
- 5% Tysiąc activity
- 10% Global Chat
- 5% rankings
- 5% miscellaneous platform requests

The harness reports realized operation counts so the actual ratio can be compared with the target.

### Behavioral rules

- Game clients use legal commands only unless the scenario explicitly tests conflict handling.
- Expected `409` concurrency conflicts and expected `429` rate-limit responses are counted separately from infrastructure failures.
- SSE scenarios keep connections open and measure establishment, lifetime, event delivery, disconnect, reconnect and recovery.
- Player-private state must never be logged by the harness.

## 6. Scenario matrix

| Phase | Scenario | Main objective | Initial levels |
|---|---|---|---|
| B1 | HTTP baseline + mixed platform | single-replica supported load | 100, 250, 500, 1,000 clients |
| B2 | mixed platform | horizontal scaling | 1, 2, 4 replicas |
| B3 | SSE connections | idle/keepalive capacity | 100, 500, 1,000; then 2,000/5,000 only if environment permits |
| B4 | realtime fanout | event-to-client latency/projection cost | 100, 500, 1,000 active games where feasible |
| B5 | reconnect storm | backoff/jitter dispersion and recovery | 100, 500, 1,000; 2,000+ conditional |
| B6 | PostgreSQL saturation | DB/pool bottleneck and WA-05 | rising mixed load + 1/2/4 replicas |
| B6b | SecurityMonitor cardinality | WA-06 memory/DB cardinality | controlled high-cardinality event batches |
| B7 | breaking point | first sustained SLO/resource breach | 2,000, 5,000, 10,000 only after lower levels and only if environment permits |
| B8 | fault injection | correctness/recovery under load | app kill/restart, LISTEN termination, temporary PG interruption, rolling restart |
| B9 | soak | leaks and latency drift | 30–60 min moderate supported load |

## 7. Ramp profiles

### Supported-load steps

Each B1 level uses:
- warm-up: 2 minutes;
- steady state: 5 minutes;
- cool-down: 2 minutes.

If memory, pool wait, latency or GC trends have not stabilized, steady state is extended.

### Breaking-point profile

Breaking-point tests increase one bounded step at a time. The harness stops escalation if any safety stop condition fires:
- runner memory available < 10%;
- application process repeatedly crashes;
- PostgreSQL connection budget exceeds safe configured limit;
- sustained 5xx >= 5%;
- sustained timeout >= 5%;
- correctness invariant failure;
- runner itself is CPU-starved such that application vs environment bottleneck cannot be distinguished.

## 8. Endpoint-class thresholds

### Fast read endpoints
- p95 <= 200 ms
- p99 <= 500 ms

### Normal game/API commands
- p95 <= 300 ms
- p99 <= 750 ms

### Complex/ranking/aggregate reads
- p95 <= 500 ms
- p99 <= 1,000 ms

### Error thresholds
- unexpected error rate < 1% at supported operating load;
- server 5xx < 0.1% at supported operating load;
- expected 409/429 are classified separately and do not count as infrastructure/server failures.

### Correctness thresholds — zero tolerance
- lost committed game state;
- revision rollback/regression;
- duplicate durable deterministic games;
- duplicate accepted state transition;
- cross-player/private-state leak;
- Lobby `playing` without a valid deterministic game;
- unrecoverable stale SSE state;
- ranking materialization corruption.

Any zero-tolerance correctness failure is phase `FAIL — CORRECTION REQUIRED` regardless of latency.

## 9. Mandatory metrics

### HTTP
- requests/sec;
- p50/p90/p95/p99/max;
- unexpected error rate;
- 5xx rate;
- timeout rate;
- expected 409 count/rate;
- expected 429 count/rate.

### Application
- CPU;
- RSS;
- heap used;
- event-loop delay where instrumentation is available;
- process crashes/restarts;
- active requests;
- active SSE connections.

### PostgreSQL
- `numbackends` / active/idle connections;
- waiting/blocked sessions;
- pool acquisition wait where application instrumentation is available;
- query latency where measurable;
- transactions/sec;
- locks and lock waits;
- deadlocks;
- long-running queries;
- server CPU/memory if container stats are available;
- WAL growth (`pg_wal_lsn_diff`) where supported;
- disk I/O/container stats where available.

### Realtime
- active SSE;
- disconnects;
- reconnects;
- reconnect latency;
- listener reconnect count;
- subscriber recycle count;
- stale-revision rejection;
- missed-state reconciliation/recovery;
- publish-to-client latency where an event timestamp/correlation token can be safely observed.

### Game correctness
- CAS/concurrency conflicts;
- duplicate transitions;
- lost accepted moves;
- revision regressions;
- orphan games;
- Lobby/game mismatch.

### Chat
- accepted messages;
- semantic rate-limit rejects;
- duplicate rejects;
- reconciliation count.

## 10. Horizontal scaling calculations

For equivalent workload:

`efficiency_2x = throughput_2_replicas / (2 * throughput_1_replica)`

`efficiency_4x = throughput_4_replicas / (4 * throughput_1_replica)`

Report raw throughput and efficiency. Poor scaling is flagged when additional replicas materially increase PostgreSQL wait/query latency without proportionate useful throughput.

## 11. SSE capacity rules

- Each browser/client SSE stream must not reserve a PostgreSQL connection.
- PostgreSQL LISTEN connections are replica-level long-lived reservations, not subscriber-level reservations.
- Measure ordinary-query pool usage before/after adding SSE clients.
- Establishment rate, memory per connection, keepalive overhead and delivery latency are reported.
- Idle SSE success alone does not qualify realtime capacity; B4 fanout must run with active events.

## 12. Reconnect-storm validation

Controlled recovery actions may include:
- terminating the PostgreSQL LISTEN backend;
- terminating/restarting one benchmark app replica;
- intentionally closing the benchmark SSE path.

Measure reconnect attempts per second and recovery distribution. A synchronized reconnect cliff is a failure if dispersion/backoff is expected. Fresh connections after recovery must receive authoritative current state.

## 13. PostgreSQL saturation and WA-05

For each replica count, report:

`SAFE ORDINARY QUERY CONNECTION BUDGET = TOTAL PG CONNECTION BUDGET - LONG-LIVED LISTENER RESERVATIONS - OPERATIONAL HEADROOM`

Evidence must include:
- PostgreSQL `max_connections`;
- configured application pool budget;
- number of long-lived listeners per replica;
- observed active/idle sessions;
- selected operational headroom;
- projected 1/2/4 replica connection use.

Wave B fails WA-05 if allowed app scaling can exhaust PostgreSQL `max_connections` without bounded controls/headroom.

## 14. WA-06 SecurityMonitor cardinality

Generate bounded batches of distinct synthetic sources, paths and safe test identifiers. Measure:
- process memory before/after;
- retained in-memory cardinality;
- cleanup behavior;
- CPU;
- persisted row count where applicable;
- WAL/database growth where available.

If retention-only bounding permits dangerous growth during the observed window, classify the issue before correction.

## 15. Fault injection under load

Mandatory B8 scenarios:
A. kill one app replica;
B. restart one app replica;
C. terminate PostgreSQL LISTEN backend;
D. temporary PostgreSQL interruption;
E. PostgreSQL reconnect/recovery;
F. rolling restart of app replicas;
G. SSE reconnect storm.

Each records request errors, successful reconnect percentage, convergence time, durable-write correctness, duplicate-write evidence, stale-state evidence and recovery latency.

## 16. Soak test

Minimum planned duration: 30 minutes; preferred 60 minutes if CI time/environment permits.

Track memory/RSS, heap, PostgreSQL sessions, SSE subscribers, listener count, latency percentiles and error rates over time. Any monotonic resource growth without release is investigated as a potential leak.

## 17. Correction policy

Do not optimize before evidence. Every discovered defect receives:
- ID;
- severity;
- scenario/run ID;
- measured evidence;
- root cause;
- affected module/file;
- proposed bounded fix;
- expected impact;
- classification P0/P1/P2/P3.

Production-code corrections require the exact-head rerun subset and 7/7 required CI. Redis/Kafka/RabbitMQ/new database/cache/search infrastructure is not introduced without Lead authorization.

## 18. Cleanup

- All benchmark data is isolated and run-prefixed.
- Benchmark database may be dropped/recreated between destructive phases.
- App processes and k6 processes are terminated after each run.
- PostgreSQL remains isolated to the benchmark runner/service container.
- Raw outputs are stored as CI artifacts under a run-specific path when the workflow supports it.

## 19. Reproducibility record

Every compact run record contains:

```text
RUN ID
HEAD
TREE
UTC
ENVIRONMENT
NODE
POSTGRES
K6
REPLICAS
VUS/CONNECTIONS
DURATION
SEED
RPS
P50
P90
P95
P99
MAX
ERROR %
5XX %
TIMEOUT %
CPU
RAM/RSS
DB CONNECTIONS
POOL WAIT
NOTES
PASS/FAIL/ENVIRONMENT LIMITED
```

## 20. Safe-capacity rule

`SAFE OPERATING LIMIT` is not the maximum non-crashing level. It must preserve at least 30% headroom below the measured saturation/breaking point unless stronger evidence supports a larger margin.

## 21. Final acceptance categories

Each phase is classified exactly as one of:
- `PASS`
- `PASS WITH LIMIT`
- `FAIL — CORRECTION REQUIRED`
- `ENVIRONMENT LIMITED`

The final Wave B verdict is separate from phase verdicts and does not authorize merge, deployment, production changes or formal closure.
