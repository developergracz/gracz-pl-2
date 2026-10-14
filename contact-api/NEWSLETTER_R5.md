# Newsletter R5 — targeted corrective handoff

> Historical R5 evidence. R5.1 readiness, pause defaults and release procedure supersede
> this document: see [NEWSLETTER_R51.md](NEWSLETTER_R51.md).

Continue PR #254 and branch `codex/newsletter-b1-b2-r3-20261013` from audited R4
`1e7d5d12990e57c913fc75004ab35d342ebb8506`. B1, B2 STATUS_CHECK, Premium and R4
remain. This record supersedes R4's health and unfenced historical-import procedures.

## N-1–N-11 disposition

| Finding | R5 implementation / evidence | Disposition |
|---|---|---|
| N-1 atomic markers | Public admission and B1 effect markers are updated by one PostgreSQL transaction, with both owner/epoch CAS predicates. No provider send before successful COMMIT acknowledgement. SQL exception or killed worker between UPDATEs rolls back both. A local TCP proxy discards the actual PostgreSQL COMMIT response; both durable markers stay held, and a restarted worker sends nothing. Six concurrent new processes after proven rollback send exactly one DOI. Immutable failed-attempt evidence remains. | Implemented; independent review pending |
| N-2 liveness/readiness | `/health` performs no DB/newsletter readiness I/O and stays 200 while the HTTP process serves traffic; shutdown returns 503. `/newsletter/ready` returns 503 when disabled, paused, DB unavailable or schema incompatible; 200 only when intake is ready. Subscribe admission independently checks schema before accepting. Tests cover unreachable PG, missing table, restored availability, weakened constraints and readiness recovery. | Implemented |
| N-3 | No N-3 finding or requested change was supplied in this mandate. | Not assessed; no invented closure |
| N-4 pause parsing | Missing variable preserves default; only explicit `false`/`0` (case/whitespace normalized) enable intake. True/1 and every unknown, empty or malformed value pause it. Tests include misspellings and misleading off/no values. | Implemented |
| N-5 historical import | Removed implicit SQL history import. Explicit offline operation requires writersStopped=true and a valid fixed cutoff no later than the installation seal. A durable cutover marker and shared transaction lock close import at the first R5 B1 claim. Existing unsealed/R4 installations fail closed. Repeated authorized import is a no-op; cutoff cannot move. R5 events carry intakeVersion and are excluded. Released request evidence cannot become legacy_pending later. | Implemented; production cutover authorization still HOLD |
| N-6 Resend results | Proof of no send comes from persisted phase and fencing, not HTTP status. POST errors are classified uncertain, including 400/429/503; timeouts/5xx never release an attempted send. Read/preflight failures before effect may release. Tests use a provider that records delivery before returning an error and verify no new DOI after restart. Existing bounded same-key retries retained. | Implemented; no undocumented provider non-delivery guarantee assumed |
| N-7 PostgreSQL 18 DR | Real isolated PostgreSQL 18 integration and separate PostgreSQL18 pg_dump/psql restore drill; original PG16 CI retained. No production database connection. | Tested locally; production DR approval still HOLD |
| N-8 accessibility | Successful confirm, unsubscribe and status-check announce the complete result and move keyboard focus to the result live region; status-check errors focus their explanation too. Real desktop/mobile tests verify focus and full result. | Implemented |
| N-9 | No N-9 finding or requested change was supplied in this mandate. | Not assessed; no invented closure |
| N-10 log identifiers | Removed emailHash/recipientHash prefixes in contact/newsletter/reply logs. Random request/operation correlation IDs remain. Regression scans these log fields. | Implemented |
| N-11 schema checks | One catalog query verifies required types/NOT NULL, nondeferrable validated PK/UNIQUE, exact critical CHECK definitions and pre_send default in B1, plus atomic-key constraints and columns in idempotency storage. Concurrent probes share one promise; no success/failure TTL cache hides later DDL/outage. Tests remove PK, request uniqueness, NOT NULL and weaken CHECK with OR true, then restore. | Implemented |

## Atomicity and COMMIT uncertainty

Lock/update public admission first, then B1, inside the same transaction. Losing either
CAS aborts the entire transaction. A network send is reachable only after the database
returns successful COMMIT. On failure, cleanup uses owner-fenced SQL predicates for
pre-effect/pre-send only. These queries wait for conflicting transactions and inspect
committed state; they cannot erase a committed effect marker. Thus a proven rollback
can be released, whereas an acknowledged or unacknowledged committed effect stays held.
There is no timeout-based inference of non-delivery.

The real lost-COMMIT-response regression additionally exposed an unhandled pg client
error while the client was checked out of the pool. Database transactions now handle
that event and discard a broken connection (also after failed rollback), preserving
the original failure and durable state instead of crashing the API. No send is retried
as a new operation after this failure. The proxy, PostgreSQL trigger faults and process
kills are test fixtures on loopback only, not provider or database mocks.

## Current Render facts and release ordering — no live changes

Owner-verified facts for this mandate: frontend `gracz-pl-maintenance` auto-deploy ON;
API `gracz-contact-api` auto-deploy ON, healthCheckPath `/health`; API build runs migrator;
PostgreSQL **18**, paid compute **0.1c-256mb**. Do not follow the historical Free-plan
upgrade assumptions. No Render setting, secret, plan or production schema was inspected
or changed in R5.

Keeping Render on `/health` preserves Contact API availability during newsletter-only
failures. A 200 there is explicitly NOT permission to enable newsletter intake.
Owner release procedure must independently require `/newsletter/ready` = 200 and
its schemaReady flag, after unpausing in a controlled release. While paused it returns
503 with explicit flags; confirmation, unsubscribe and status proof remain available.
The app's bounded 25s shutdown and R4 durable crash fencing are unchanged.

## One-time historical cutover proposal — MIGRATION 005 HARD HOLD

1. Owner/DB must resolve global migration allocation against contact-data CONTRACT 005,
   inspect the authorized registry, approve DR and the release window before any merge.
   Do not change an applied checksum or registry to make this candidate look approved.
2. Stop **all** legacy/R4 writers, including contact opt-in and old instances; verify the
   last write boundary. The caller's writersStopped flag records an operational assertion,
   not an automatic ability to stop old servers. Default Render instance overlap is unsafe.
3. On a fresh authorized installation only, apply the separately approved additive
   candidate while writers are stopped. It creates a nonexpiring `newsletter-cutover`
   seal in existing idempotency storage, fixing the latest allowed historical cutoff.
   No events are imported automatically. Choose an exclusive UTC upper bound strictly after the last verified legacy event and at or
   before that seal; then invoke `importHistoricalOptIns({cutoverBefore,writersStopped:true})`
   through privileged DB/operator access. There is no public endpoint or scheduled job.
4. Import and writer startup share an advisory transaction lock. Import completion records
   its immutable boundary; a same-boundary rerun before startup returns zero. The first
   new writer permanently sets writerStarted, even if its pre-send reservation later
   releases. Import then fails. R4-era databases lacking a trustworthy pre-writer seal
   are denied retroactive import; never fabricate a seal. They need a separate evidence-
   based DB plan, preserving existing reservations, rather than replaying this initializer.
5. Require readiness, diagnostics and separate Owner GO before normal intake. Rollback
   pauses intake and preserves all additive state and the cutover seal. Do not reopen
   import, delete uncertain holds, or restore the old unreserved sender.

`persistence/candidates/` remains outside the automatic migrator. The historical 005
filename is not a final migration allocation. No production SQL was executed. Existing
unnumbered R4 expansion proposal is still a proposal, not a rollout command.

## Verification and residual gates

Final local evidence: backend 75 PASS; PostgreSQL18 integration 92 PASS; PostgreSQL16 integration 92 PASS; newsletter browser 22 PASS; consent browser 5 PASS; Premium footer 5 PASS; syntax 44 PASS; PostgreSQL18 backup/restore 10 checks PASS. All: 0 FAIL, 0 SKIPPED. Integration totals include 13 memory-adapter checks/parents and two static/guard checks; the other 77 reported cases exercise real PostgreSQL. Exact-head CI links are reported in PR #254. Tests use synthetic
loopback gracz_test only; provider fixtures never send real email. Browser tests use
mocked API responses. Node totals include nested parent tests and identified memory
adapter checks. The PostgreSQL18 restore drill compares registry/control/consent rows,
checks unknown send fencing and spent proof replay, and verifies append-only triggers.
It is a local logical backup/restore test, not production PITR, escrow or RPO/RTO approval.

Next independent audit should target **R4→R5 diff**, especially atomic marker transaction,
COMMIT loss, liveness split, sealed cutover and their regression tests. Previously closed
B1/B2/Premium areas need regression confirmation, not an unnecessary full redesign audit.

Remaining gates: independent exact-HEAD audit; Owner merge/release authorization;
DB migration identity/checksum review; verified legacy-writer shutdown; production DR
and secret escrow approval; retained R4 lost/expired DOI and legal retention decisions.
A crash after the effect transaction but before network send conservatively remains
held. No automatic resend policy is introduced.

MERGE READY: NO. PRODUCTION READY: NO. MIGRATION 005: HARD HOLD.
