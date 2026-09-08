# GRACZ.PL — OPERATIONS / DR / OBSERVABILITY MASTER

**Status:** LIVING CONSOLIDATION  
**Production execution authorization:** NONE

## 1. Purpose

This volume defines the operational evidence required before Gracz.pl can be described as production-ready or production-proven.

## 2. Operational domains

Final production documentation must cover:

- deployment topology,
- service ownership,
- health/readiness,
- logging,
- metrics,
- tracing,
- alerting,
- backup,
- restore,
- incident response,
- rollback,
- capacity/scaling,
- secrets rotation,
- certificate/domain dependencies.

## 3. Readiness vs liveness

A process being alive does not mean it is safe to receive traffic.

Readiness should reflect dependencies that are required for correct service behavior and fail closed when a critical dependency is unavailable.

## 4. Observability baseline

The target operational model should expose at minimum:

- request/error rate,
- latency percentiles,
- DB connection/pool pressure,
- transaction failures,
- conflict/CAS/fencing rates,
- realtime disconnect/reconnect rates,
- job failures,
- backup/restore job status,
- game-specific health indicators,
- future FairPlay abort/proof mismatch metrics.

## 5. Logging

Operational logs should support incident reconstruction through:

- correlation/request ID,
- match/table/session IDs where safe,
- build SHA/version,
- node identity,
- structured event type,
- sanitized error data.

Sensitive secrets/private cards/raw cryptographic material must not be logged.

## 6. DR program

P1-R-01 established a recurring PostgreSQL disaster-recovery validation program with real isolated PostgreSQL clusters and fail-closed identity checks.

Closed program properties include:

- encrypted streaming backup,
- key validation,
- checksum,
- decrypt preflight,
- source/target database and cluster identity checks,
- disposable restore target marker,
- source read-only protection,
- reconciliation,
- redacted JSON evidence,
- scheduled CI validation.

This does not authorize or prove a production restore event.

## 7. RPO / RTO

Final production documentation must explicitly define and later measure:

- RPO — acceptable data-loss window,
- RTO — acceptable recovery-time window.

Design targets must not be recorded as measured production values until evidence exists.

## 8. Incident runbooks required

At minimum:

- API/service outage,
- database unavailable,
- database corruption,
- failed migration,
- backup failure,
- restore failure,
- abnormal concurrency conflict spike,
- realtime outage,
- auth/security incident,
- compromised secret/key,
- FairPlay proof anomaly,
- rollback to known-good release.

## 9. Deployment governance

Every production release should eventually record:

- release identifier,
- source SHA/TREE,
- migration set,
- CI evidence,
- audit status,
- Owner authorization,
- deployment timestamp,
- environment/config delta,
- health verification,
- rollback point,
- post-deploy observation.

## 10. Scale readiness

The final audit must evaluate:

- horizontal service scaling,
- DB connection limits/pooling,
- contention hot spots,
- realtime fanout,
- tournament concurrency,
- match ownership/fencing,
- background job duplication,
- cache consistency if introduced,
- rate-limiting behavior across multiple instances.

## 11. Current production boundary

Current documentation work must not alter:

- Render runtime,
- production database,
- environment variables,
- DNS,
- Cloudflare,
- production secrets,
- active production migration state.

## 12. Current status

```text
OPERATIONS MASTER = LIVING
P1-R-01 DR PROGRAM = CLOSED
PRODUCTION RESTORE = NOT EXECUTED HERE
PRODUCTION DEPLOYMENT AUTHORIZATION = NONE
FULL OBSERVABILITY AS-BUILT = NOT YET VERIFIED
PRODUCTION V3 READINESS = NOT CLAIMED
```
