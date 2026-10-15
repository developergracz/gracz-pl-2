# F-02 R1 — independent Contact API maintenance artifact

**IMPLEMENTATION ONLY — NO PRODUCTION AUTHORIZATION.** No deployment/settings change
is performed by this PR. Newsletter PR #254 / `7ecb81af6a73d0eedb0340a65c880010caca0075`
is a reference, not a dependency. This branch starts from fetched main
`bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e` and does not modify F-01 or PR254.

## Artifact contract

Only `server.mjs`, `build.sh`, `start.sh` are required; no node_modules, package install,
DB module, provider module, app bootstrap, dotenv loader, filesystem writes or business
background jobs. The sole runtime import is Node's HTTP server. Existing database/provider
environment values are ignored. Scripts remove inherited NODE_OPTIONS/NODE_PATH so Node
preloads cannot inadvertently start production code. PATH/Node binary must come from the
trusted platform runtime. Do not inject wrappers or preloads around these commands.

| Request | Result |
|---|---|
| GET /health (optional query) |200, `{ok:true,mode:"maintenance",businessReady:false,artifact:"contact-api-maintenance-r1"}` |
| Every other valid HTTP route/method, including /newsletter/ready |503, fixed `{ok:false,error:"maintenance",message:"API jest tymczasowo niedostępne. Spróbuj ponownie później."}` |
| HEAD on any route |503 with no body, per HTTP semantics |
| Expect/upgrade/CONNECT |503, connection closed, no tunnel or business dispatch |

Responses are no-store and carry X-Gracz-API-Mode: maintenance (normal HTTP), with
Retry-After:60 on503. Request payloads/identities/tokens are never parsed or logged.
Only production origins https://gracz.pl and https://www.gracz.pl are reflected in CORS;
OPTIONS also503, so browsers may show their generic network-error message for preflighted
requests. No frontend must interpret health200 as permission to enable forms. This window
interrupts contact, Premium reply, confirm, unsubscribe and status-check as well as intake.
Existing consumers already handle unsuccessful API responses; queued user actions must be
retried manually after release, never silently replayed by this artifact.

Malformed HTTP, oversized headers and timed-out connections may be rejected/closed by
Node's parser/timeouts without a JSON response. No such path invokes business code.
PORT defaults to10000; require integer1–65535. HOST defaults to0.0.0.0. Startup errors
log fixed codes only. SIGTERM/SIGINT close the listener/connections; there is no pending
business operation to drain. HTTP resource timers are not business background jobs.

## Explicit build/start procedure (future authorized execution only)

Node>=20 and POSIX sh are sufficient. Do NOT use npm start, npm install, npm run migrate,
the production build command, or a Docker image that starts the business server.

| Render service root | Build command | Start command |
|---|---|---|
| Repository root |`sh contact-api/maintenance/build.sh`|`sh contact-api/maintenance/start.sh`|
| contact-api |`sh maintenance/build.sh`|`sh maintenance/start.sh`|

Build performs only `node --check`; start execs the standalone server. No package hooks
or migrator run. Confirm the actual configured root before choosing the row. Also disable
or replace any production pre-deploy command that invokes SQL/business code, and inspect
Docker entrypoints, custom build wrappers and inherited launch/preload settings. Treat an
unaccounted hook as a blocker. Do not change secrets. No service plan/size/new instance
purchase is part of this proposal.

Local verification, without production credentials:

```sh
sh contact-api/maintenance/build.sh
HOST=127.0.0.1 PORT=4179 sh contact-api/maintenance/start.sh
# In another terminal:
curl -i http://127.0.0.1:4179/health
curl -i -X POST http://127.0.0.1:4179/contact
node --test contact-api/test/maintenance.test.mjs
npm --prefix contact-api test
```

Tests copy only the three artifact files into a temporary directory, start an actual
process, exercise route/method matrices, raw HTTP events and signals, and point synthetic
DB/provider environment values at a loopback connection canary. No DB/provider connection
is accepted. The build is also tested with an invalid inherited preload. Existing CI
runs this test through the current backend test glob; no workflow or runner is added.

## Authorized future cutover: evidence gates, not health-only inference

Owner-supplied LIVE facts: frontend gracz-pl-maintenance and API gracz-contact-api both
auto-deploy ON; API healthCheckPath=/health; API build runs the production migrator;
PostgreSQL18 plan0.1c-256mb. Legacy production ignores NEWSLETTER_INTAKE_PAUSED.
**Neither setting pause nor seeing this artifact's health response stops old writers.**

1. **Authorization/window:** Owner approves the exact maintenance commit/artifact digest,
   API outage including contact/proof endpoints, both-service deployment freeze and rollback
   target. Record operator, service IDs, root directories, current/replacement deploy IDs,
   exact revisions and UTC window in a restricted release record. Obtain separate DB/DR GO
   before any later schema work. PR approval alone authorizes none of these operations.
2. **Freeze all launch sources:** authorized operator disables auto-deploy on both services,
   controls manual deploy/rollback access, cancels or waits for all queued/running deploys,
   and inventories preview/worker/cron/other processes using the production DB/provider.
   Include direct Render hostnames, contact newsletter opt-in and already admitted work.
   Inspect build/start/pre-deploy hooks before any build: the existing migrator command
   must be replaced by the syntax-only maintenance build for this window. Do not merge
   either PR while auto-deploy can turn that merge into an uncontrolled production build.
3. **Prepare frontend:** under separate approval disable forms/show planned unavailability.
   Cached pages and direct API callers still exist; only the API replacement plus confirmed
   old-process termination establishes the writer barrier. Do not queue requests for replay.
4. **Controlled maintenance deployment:** select the approved maintenance revision and the
   exact independent build/start commands. Keep /health for Render liveness. During Render
   instance overlap the old instance can still accept/send: **NO SQL/import/cutover boundary
   may begin yet**, even when some probes already return maintenance. Observe rollout to
   completion and old-instance shutdown for the service's verified termination grace.
   Do not assume the newsletter's25s drain exists in legacy production or proves no send.
5. **Prove all old processes stopped:** record platform evidence that every pre-maintenance
   instance/deploy has terminated, no replacement/rollback is pending, and every inventoried
   writer is stopped or inert. Check process/deploy identity, not just the URL's response.
   If Render exposes only a load-balanced status and cannot prove retirement, request
   platform evidence or an Owner-authorized full suspension of all writer services. Verify
   that suspension/resumption cannot start legacy code before relying on it. Until this
   is proven the release remains HOLD; repeated maintenance responses alone are insufficient.
6. **Cross-check the barrier:** use separately authorized read-only DB/operator evidence
   to verify no old-writer sessions or active transactions remain; correlate last business
   write timestamps with retired-instance IDs. Sample custom and direct onrender.com
   routes: health marker200, all listed business paths503. Inventory provider attempts
   that were accepted before process termination; queued delivery can continue after the
   writer exits and must NOT be mistaken for a new send or cleared reservation. Lack of
   traffic or DB sessions alone is not proof that a sleeping/background writer is gone.
7. **Seal the stop record:** Owner/DB sign the combined platform + DB + provider timeline.
   Record the last verified legacy-write boundary. Only after this barrier and a separate
   migration/import approval may a later mandate operate on the schema. This PR runs no
   SQL, imports, registry updates or production probes. Migration005 remains HARD HOLD;
   allocation/checksum conflict with contact CONTRACT005 is unresolved by this artifact.
8. **Subsequent release (separate GO):** keep maintenance available while applying only
   independently approved additive schema/import steps. Then replace it with the exact
   independently audited new API revision, paused; overlap with inert instances is safe
   for business writes but mixed responses are expected. Recheck root/build/migrator
   commands and schema registry first. Prove no legacy revision can start. Validate the
   matched frontend and newsletter readiness separately; /health200 remains liveness only.
   Explicit enabling of intake and restoration of auto-deploy each need separate Owner GO.

### Stop-record checklist

The release record must contain all of: approved maintenance revision + digest; before/
after build/start/pre-deploy commands; both auto-deploy freeze evidence; inventory of all
writers; old deploy/instance retirement timestamps; no queued deploy/rollback evidence;
read-only DB transaction/session cross-check; provider uncertain-attempt inventory; health/
business response samples; signed last-write boundary; approved rollback target.
Missing any retirement/launch-source evidence means **writersStopped is not established**.
The artifact does not itself terminate other instances or enforce a distributed fence.

## Rollback / abort without reactivating legacy writers

- Before old instances are gone: stop the cutover, do not migrate/import, preserve evidence.
  Keep proceeding to an authorized inert/suspended state; never declare the barrier early.
- If the maintenance artifact fails: remain in frontend maintenance and use an approved
  complete service suspension (confirm all processes gone), or redeploy the same known-good
  inert artifact. A Render "rollback" button targeting the previous production deploy is
  forbidden for this procedure because it would revive an unreserved newsletter writer.
- If later new API verification fails: deploy this pinned inert artifact again using its
  syntax-only build/start and check retirement of the failed new instances. Preserve all
  additive schema, consent events, suppression/withdrawal and uncertain reservations. Do
  not reverse SQL or restore an older snapshot over newer consent as an application rollback.
- After any restart, keep exact maintenance/new-paused revisions pinned and auto-deploy
  frozen until separate Owner release approval. Never auto-unpause based on /health.

## Open blockers

Independent artifact/cutover audit; Owner execution approval; actual Render root/hook and
termination-grace verification; complete writer inventory/retirement evidence; maintenance
window communication; approved frontend behavior; migration identity/registry/checksum and
import authorization; production DR/PITR/RPO/RTO/secret escrow; uncertain DOI investigation
and retention policy. No live configuration has been read or changed to claim these closed.

**NO MERGE. NO DEPLOY. NO LIVE SQL/RESEND. MIGRATION005 HARD HOLD.**
**IMPLEMENTATION ONLY — NO PRODUCTION AUTHORIZATION.**

Implementation verification:9 artifact tests PASS (included in43 full main-based backend
tests),0FAIL/0SKIPPED.23 existing syntax checks plus standalone syntax build, SEO/CSP and
diff checks PASS. A separate read-only review found malformed-response framing; its
regression and a half-open upgraded-connection shutdown regression both failed before
their corrections and now pass. Exact-HEAD CI is recorded in the new DRAFT PR.
