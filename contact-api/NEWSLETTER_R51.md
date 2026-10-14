# Newsletter R5.1 — targeted correction and release gates

Base: `4219554aa7d5c84223876d2ec686a3d0ccdac32c`, same draft PR #254.
This document supersedes R5/R4 release instructions and R5's missing-variable default.
B1/B2/Premium, atomic effect markers, sealed import and append-only ledger remain intact.

## Finding matrix

| Finding | Correction / evidence | Remaining gate |
|---|---|---|
| A P2 readiness | Checked-out readiness query has a 2s transport deadline, 1.5s server statement timeout, read-only transaction and destructive release on failure. Pool acquisition separately defaults to 5s (configured bound 0.5–30s). No Promise.race orphan query. Coalesced promise clears after rejection. Real PG proxy drops responses; eight callers time out, then the same store recovers using a fresh connection. pg_sleep proves server-side cancellation. | Independent review |
| B P2 privacy / pause | Removed IP SHA prefix from abuse logs; reason/count remain. Missing, empty and invalid pause values block intake; only explicit false/0, normalized for case/whitespace, enable it. Process tests cover contact success during pause, readiness 503, health 200 and restart with explicit enable. Confirm/unsubscribe remain available. | Explicit Owner enable decision, not implied by deployment |
| C P2 shutdown / uncertainty | Retained 25s upper bound and durable uncertain holds. Existing SIGTERM/SIGINT drain, deadline, SIGKILL, lost COMMIT and concurrent-restart tests retained. Budget and reconciliation procedure below. | Verify actual Render termination grace before release; evidence-based operator review |
| D P1 cutover | Separate old-writer stop barrier and staged alternatives below. Pause env alone is explicitly insufficient on current production. Auto-deploy/build migrator and contact intake included. | Owner authorization, verified writer stop, migration identity and DR approval — HOLD |
| E P2 focus / reproducibility | Failed confirm/unsubscribe focus the complete explanation; same-token retry remains keyboard accessible. Desktop/mobile assertions. Local PG18/DR script creates two fresh disposable databases and verifies restored rows, reservations, replay protection and ledger immutability. No added CI job. | Production DR/RPO/RTO approval remains separate |

## Readiness semantics and configuration

`/health` is process liveness; it performs no readiness I/O. `/newsletter/ready` and
subscribe admission fail closed if schema, database, configuration or intake is unavailable.
Readiness uses a dedicated checked-out connection from the existing pool, never a write
transaction. After any error it destroys that connection instead of issuing an unbounded
ROLLBACK or returning a busy connection. PostgreSQL statement_timeout cancels server work;
the transport deadline destroys the local socket even if the network silently drops all
responses. An unreachable server cannot acknowledge cancellation, so this is deliberately
read-only and server cancellation is independently bounded once the statement arrives.
Acquisition and query budgets are sequential, normally at most approximately 7s plus
scheduler delay. This is not a hard real-time guarantee under event-loop starvation.

Production operator intent must be explicit: unset/empty/true/1/typos => paused;
`NEWSLETTER_INTAKE_PAUSED=false` or `0` => eligible, still subject to schema/provider checks.
This flag does not stop confirm/unsubscribe and is NOT a full database write barrier.
No live environment variable was changed by this task.

## Shutdown budget and safe handling of uncertainty

Current Resend code permits four attempts per provider call, each 10s by default.
Network backoffs are 0.35+0.70+1.40s: up to **42.45s**. HTTP Retry-After is capped
at 5s per gap: conservative budget **55s**. The internal maximum 30s attempt timeout
would permit **135s** per call. Sequential preflight calls add further time. These are
nominal I/O/backoff budgets, not guarantees under process stalls. A 25s drain cannot
promise completion. Extending it beyond an unverified Render termination grace would
not solve this. On deadline the process exits nonzero; it never clears effect markers.
SIGKILL remains safe through durable reservations, independent of graceful shutdown.
The actual service-specific termination grace must be verified by the authorized release
operator; the often quoted Render default is not evidence of LIVE configuration.

Use existing private `createNewsletterOperations(db).inspect()` for aggregate aged/unknown
alarms. It is not an HTTP endpoint and does not emit addresses, tokens or subject hashes.
Proposed privileged investigation tooling (separate approval, not a new auto-retry engine):

1. Open an access-controlled case keyed by the random B1 request UUID or dispatch UUID.
   Read both durable marker states, epoch, phase and timestamps in one consistent snapshot.
   Do not put email/IP hashes, raw recipient addresses, tokens or provider payloads in logs.
2. Reconstruct the exact operation idempotency key in the restricted case: DOI uses
   `newsletter-confirm/` plus SHA-256(request UUID).hex.slice(0,40). Link to authenticated
   provider message ID/events and their timestamps. Preserve evidence and provenance;
   a screenshot, missing search result or expired provider idempotency window is not proof.
3. Accepted/delivered, timeout, 429/5xx, missing response and absent/expired provider history
   all prohibit new sending. Accepted email is NOT proof of consent. The existing valid
   mailbox confirmation path can reconcile consent and holds transactionally; it does not
   resend DOI. Unsubscribed/suppressed state must never be overridden by operator inference.
4. Any proposed manual state correction requires independent approval of evidence of
   **no external effect**, an exact owner/phase CAS for both layers, and immutable case
   evidence. There is no generic release-by-age or force-resend tool in this change.
   If evidence cannot establish non-delivery, keep the hold. Do not rewrite/delete consent
   events. Restore/reconciliation must preserve all replay tombstones and uncertain holds.

## Executable release proposal — NOT execution authorization

LIVE facts supplied by Owner: frontend `gracz-pl-maintenance` auto-deploy ON; API
`gracz-contact-api` auto-deploy ON; `/health` health check; API build runs migrator;
PostgreSQL18 on `0.1c-256mb`. No Free-plan or disabled-auto-deploy assumptions.
**Old production ignores NEWSLETTER_INTAKE_PAUSED.** Setting it before merge does not stop
old standalone or contact-form opt-in, already admitted work, or overlapping instances.

### Variant 1: controlled API maintenance window (recommended)

1. Obtain Owner authorization for the window, frontend/API auto-deploy changes, full API
   interruption (including contact, confirm and unsubscribe), exact release commit, migration
   identity/checksum/registry review and a tested rollback/DR plan. Until then no merge.
2. Authorized operator disables auto-deploy on **both** services and freezes manual deploys,
   jobs and rollback automation. Verify no queued/running build or deploy can start writers.
   A merge with the present settings could start an API build and its migrator before a
   human schema check; it is not a staging operation. Review the built migrator's enumerated
   files. The candidate directory stays excluded; contact CONTRACT 005 is resolved separately.
3. Place the frontend into an explicitly approved maintenance state for writes. Deploy a
   separately approved **inert maintenance API artifact** on the existing API service:
   `/health` 200, all business routes 503, no DB credentials consumed, no provider client,
   no background tasks. Its separately reviewed build must not invoke the migrator. No new
   service/plan is needed. This artifact is a release prerequisite, not implemented here.
   Wait until **every old instance/process has exited**, not merely until maintenance
   responds. During replacement overlap old requests may still finish: do not migrate yet.
   Verify zero old writers using platform instance/deploy evidence, DB sessions/last-write
   evidence and provider attempt inventory. Direct onrender.com traffic now also reaches
   only the inert artifact; a custom-domain block alone would be insufficient.
   Alternatively, authorized suspension can establish the stop barrier, but only if the
   platform can subsequently launch the approved new revision without first resuming the
   old revision. Do not assume it can: if that is unverified, use the inert-artifact path.
   If neither path proves zero old writers, abort the cutover. Existing unknown provider
   outcomes remain held; absence of a DB session alone does not prove no background sender.
4. With all writers stopped, take and verify the approved backup/snapshot and inventory
   schema_migrations, old pending operations and last consent timestamps. Apply only the
   separately approved additive schema proposal under its separately allocated identity;
   never copy candidate 005 into the build migrator or change existing checksums. No final
   migration number is assigned here. Seal/import requires a trustworthy pre-writer boundary;
   existing R4 stores without one require a separately reviewed evidence-based plan.
5. Import once through privileged `importHistoricalOptIns({cutoverBefore,writersStopped:true})`
   using the fixed exclusive UTC cutoff after the last verified legacy event and no later
   than the install seal. Check counts, exclusions, and same-cutoff idempotence. Keep all
   writers stopped through import, including confirm/unsubscribe. The first R5 claim closes
   import permanently; do not fabricate/reset the seal or writerStarted flag.
6. Replace the inert artifact with only the approved new API revision **paused** (unset
   already fails closed); restore the reviewed API build command only at this stage.
   Verify build logs and actual runtime commit; confirm no old process resumes. Require
   `/health` 200, `/newsletter/ready` 503 with intakePaused=true and schemaReady=true;
   inspect schema flags separately because paused readiness is intentionally non-200.
   Exercise contact without subscribing, and controlled non-delivery checks; no test live
   email is authorized by this mandate. Contact can resume now; proof routes are available.
7. Deploy the compatible frontend from the audited release, validate main/footer/newsletter/
   contact error contracts, then separately authorize explicit enable and require readiness
   200. Record cutover evidence. Restore auto-deploy only under a separate Owner decision.
   No automatic re-enable on boot, migration success or health 200.

Rollback: pause the new API, stop any incompatible writers, preserve additive schema,
cutover seal, ledger and reservations. Serve the compatible paused revision or maintenance
page. Never restart the legacy sender against the new state. Do not restore an old database
snapshot over newer consent/withdrawals without a separately approved recovery reconciliation.

### Variant 2: separately audited compatibility bridge

If contact downtime is unacceptable, first authorize a **separate** minimal bridge release
on current production: support explicit pause on every newsletter admission path (including
contact) while contact mail continues, and add observable drain/writer fencing. This bridge
is not implemented or authorized here. Disable both auto-deploys and control overlap;
prove every pre-bridge instance has exited and all pre-pause work is finished or fenced.
Then pause/drain the bridge and block remaining newsletter proof writers for the schema/import
window. Only after a verifiable all-writer barrier follow steps 4–7. If the bridge cannot
provide that barrier, use Variant 1. An env-only "staged release" is not a valid variant.
Neither option provisions a new paid service or changes LIVE in this task.

## Compatibility and repeatable local evidence

No response contract or route was changed. Neutral `request_received` responses remain;
paused subscribe/status-request return controlled 503, contact accepts the message with
`newsletter: temporarily_unavailable`, and proof routes remain available. The packaged
frontend already handles API errors and same-token retries. New frontend + old API must
not be exposed during cutover: old API lacks the readiness/pause contract. Keep the existing
frontend under maintenance until the new paused API is verified, then deploy the matched
frontend. Old cached pages can receive controlled failures; their old pending links remain
supported by new confirm/unsubscribe routes.

From the repository root, on a local machine with Node >=20, Docker and installed
contact-api dependencies, with the free local `postgres:18-alpine` image already present:

```sh
bash scripts/test-newsletter-pg18.sh
npm --prefix contact-api run check
npm --prefix contact-api test
node --test scripts/test-footer-newsletter-premium-validation.mjs
```

The script explicitly uses the local Unix Docker socket, ignores remote Docker/DB settings,
creates two unique containers with loopback ephemeral ports and synthetic credentials,
runs the entire persistence suite, seeds synthetic uncertain/consent/proof rows, pg_dumps,
restores into the second empty DB, and runs 10 DR checks. It removes only its own containers
on exit; evidence remains in the printed `/tmp/gracz-pg18-dr.*` directory. It never runs SQL
against a provided DATABASE_URL. No automatic image pull, new workflow, paid runner or
production connection. Existing PG16 GitHub CI remains unchanged. Local logical restore
is not production PITR or approval of retention, RPO/RTO, or secret escrow.

Final local verification: backend **75 PASS**, real PG18 persistence command **98 PASS**,
newsletter desktop/mobile **26 PASS**, consent **5 PASS**, Premium **5 PASS**, backend
syntax **45 PASS**, fresh PG18 dump/restore **10 checks PASS**; all final runs **0 FAIL,
0 SKIPPED**. SEO/CSP and shell syntax also pass. The repeatable script independently
repeated the 98-test suite on fresh containers before the restore drill. Integration
counts include 13 memory-adapter checks/parents and two static/guard checks; 83 reported
cases exercise real PostgreSQL, including nested parent counts. Browser APIs are mocked;
all provider calls are local fixtures. An intermediate keyboard-test assertion used
Shift+Tab despite the retry button following the result region; corrected to Tab and the
complete 26-test suite passed. Exact-head GitHub CI evidence is recorded in PR #254.
Independent R5→R5.1 audit, Owner release decision, migration allocation, verified old-writer
stop (including the approved maintenance artifact or verified suspension mechanism) and
approved production DR remain open gates.

**MERGE READY: NO. PRODUCTION READY: NO. MIGRATION 005: HARD HOLD.**
