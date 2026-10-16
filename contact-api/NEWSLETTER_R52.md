# Newsletter R5.2 — PostgreSQL checkout fault correction

Base: `c85432df36a74a162e7d834d64c3870130dabb29`; same branch and DRAFT PR #254.
Scope: F-01 only, its adversarial tests and minimal safe DB diagnostics. B1/B2,
Premium, R4/R5/R5.1, API contracts, SQL candidates and migrations remain unchanged.

## Cause and correction

Verified installed dependencies: `pg 8.23.1`, `pg-pool 3.14.0`. In pg-pool
`_acquireClient`, `connect` is emitted for a new client before `acquire`, installing
release, removing the idle error listener, and invoking the pending checkout callback.
An error parsed immediately after ReadyForQuery can precede the caller's resumed
`await pool.connect()`. A listener installed only in that continuation is too late.

`createDatabase` now registers a pool `connect` handler before any acquisition. A
WeakSet ensures precisely one permanent defensive error listener per client. A WeakMap
records faults that occur before local handlers can run; queryBounded/transaction reject
those clients before BEGIN, instead of assuming a swallowed event means success.
Local operation listeners and connectionError checks remain. The permanent listener
never calls release: ownership remains with pg for idle clients and the operation for
checked-out clients. Error clients are discarded once, and queryBounded removes its
local listener on either outcome; the permanent guard absorbs later events.

No global uncaughtException handler, resend policy, outbox, timeout release or relaxed
COMMIT rule was introduced. The error object is retained only weakly for its client and
is not logged. Logs contain a fixed operation identifier and SQLSTATE/allowlisted
transport code (otherwise PG_ERROR). Raw error messages/detail, SQL, connection strings,
recipient/IP identifiers and secrets are omitted. Failed rollback has a separate safe
PG_ROLLBACK_ERROR event; the original transaction error remains the rejection reason.

## Reproduction and evidence

Before changing database.mjs, ran the new real-API test on isolated PostgreSQL18:

```sh
cd contact-api
# DATABASE_URL is a synthetic loopback gracz_test URL, never production.
node --test --test-name-pattern='R5.2 real API' integration/newsletter-r52.persistence.integration.test.mjs
```

Observed **1 FAIL**, child exit **1**, `Unhandled 'error' event`, SQLSTATE **57P01**,
`terminating connection due to administrator command`. This is a newly reproduced
failure, not reliance on the auditor's 3/3 report. The local reproduction used Node24
with `--test-isolation=none`; standard CI uses its configured Node20 test runner.

The TCP fixture forwards real PostgreSQL startup/authentication/backend-key messages.
It holds the first ReadyForQuery, calls real `pg_terminate_backend(pid)` using a separate
admin connection, then delivers ReadyForQuery and the resulting real FATAL together.
This deterministically exercises the parser/Promise-continuation ordering; it neither
mocks the pg client nor fabricates the server error. Only disposable loopback DBs pass
the existing guard. The new tests also exercise an ordinary transaction termination
without this packet ordering fixture.

| Mandate test | Evidence |
|---|---|
| A checkout | 300 successive actual backend terminations per PG version, alternating transaction/queryBounded. All operations reject, pool max1, waiting queue0. Then30 healthy bounded queries reuse one client, one permanent checked-out listener, and close leaves totalCount0. Removed clients have bounded listener counts. 120s suite limit. |
| B real API | Actual server.mjs child receives concurrent ready/subscribe while backend termination is enabled, repeated3 rounds. Controlled503, health200, no process crash or provider sends; recovery restores readiness and one synthetic local-provider DOI. stderr checked for unhandled events, listener warnings and sensitive request/connection contents. |
| C transactions | Real checkout failure before BEGIN; real termination after INSERT proves rollback and subsequent fresh transaction succeeds. Existing real proxy drops actual COMMIT acknowledgement and restart preserves uncertain markers. Unit faults at BEGIN/work/COMMIT/ROLLBACK and release preserve original failures and single release. A late release event after acknowledged COMMIT does not retroactively claim an uncommitted transaction. |
| D bounded query | Actual read-only transaction rejects DDL with25006; subsequent query recovers and normal pooled work remains read-write. Existing real pg_sleep statement cancellation and transport blackhole/recovery tests retained. Late result/error after deadline unit test proves one rejection/release and local listener cleanup. |
| E restart/concurrency | Existing PG regression covers SIGTERM/SIGINT/SIGKILL/deadline, six competing restarted processes, atomic markers, append-only consent, proof replay, withdrawal precedence and unknown holds. No changes to these mechanisms. |

The 300 operations are counted inside one integration test, not reported as300 extra
Node test cases. All API/provider activity uses synthetic loopback fixtures. No live
Resend request, production database or Render service is involved.

## Provider idempotency window

A finite provider idempotency window is not the durable deduplication boundary. B1
inflight/unknown reservations and public external_effect dispatches do not become
available just because their expiry timestamps pass. See the existing PG test
`expired uncertain request is not recycled after restart or opt-out`, proof-store
`expired unknown dispatch remains permanently blocked after restart`, and real-process
SIGKILL/deadline cases which age dispatch rows by2days and restart without another DOI.
These pass in the full regression. No live assertion about the provider's current
retention contract is made; PostgreSQL protection does not depend on that duration.
Missing provider history is never proof of non-delivery. R5.1's restricted operator
investigation procedure remains in force; no automatic release tool was added.

## Validation and remaining gates

Final local totals: backend82 PASS; PG16 integration102 PASS; PG18 integration102 PASS;
newsletter browser26 PASS; consent5 PASS; Premium5 PASS; syntax46 PASS; PG18 DR10 checks
PASS. All final runs0 FAIL/0 SKIPPED. SEO/CSP and diff checks PASS. Each integration
total includes13 memory-adapter checks/parents and2 static/guard checks;87 reported
cases exercise real PostgreSQL, with parent counts included. Exact-head GitHub Actions
links and results are recorded in PR #254 after publication.
Local PG18 uses the repeatable `bash scripts/test-newsletter-pg18.sh`: two fresh local
containers, full integration, logical dump/restore and10 checks. PG16 runs the same
full integration suite. Browser APIs are mocked; actual API process tests use a local
provider. Node reported totals include parent tests and the existing memory/static
cases; they must not be described as an equal number of independent PG scenarios.

F-01 correction requires independent reproduction by Claude/Factory on the published
new HEAD. This implementation does not grant merge approval. F-02 old-writer stop,
auto-deploy/overlap/rollback and Owner GO remain HOLD. F-03 migration005/CONTACT CONTRACT
identity, registry and checksum decision remain HOLD. F-04 uncertain DOI recovery and
retention policy remain HOLD. Production PITR, RPO/RTO, restore and secret escrow are
still separate decisions; a synthetic logical restore is not their approval.

**MERGE READY: NO. PRODUCTION READY: NO. MIGRATION READY: NO.**
**MIGRATION005: HARD HOLD. PR #254 remains DRAFT.**
