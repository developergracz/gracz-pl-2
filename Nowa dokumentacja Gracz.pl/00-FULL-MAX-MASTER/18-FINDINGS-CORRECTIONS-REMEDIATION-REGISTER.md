# GRACZ.PL — FINDINGS / CORRECTIONS / REMEDIATION REGISTER

**Document:** TOM 18 / Findings, Corrections & Remediation Register  
**Status:** LIVING / APPEND-ONLY IN MEANING / CURRENT CHECKPOINT SYNCHRONIZED  
**Date checkpoint:** 2026-09-09  
**Repository:** `developergracz/gracz-pl-2`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Current-main reference:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**P8 / PR #43:** `OPEN / NOT MERGED / TECHNICAL CLOSURE ACHIEVED / MERGE-READY`  
**Merge / deploy / production authorization:** `NONE`

---

## 1. Purpose

This register is the canonical lifecycle record for material technical, security, architecture, data, reliability, privacy, test, documentation and governance findings discovered during Gracz.pl reviews and audits.

Canonical lifecycle:

`FINDING -> LEAD TRIAGE -> DECISION -> CORRECTION MANDATE -> IMPLEMENTATION -> EXACT SHA/TREE -> TEST EVIDENCE -> RE-AUDIT -> CLOSURE`

The register prevents an auditor finding from being implemented blindly and prevents failed/intermediate evidence from being silently rewritten as final PASS.

This document does not authorize merge, deployment, migration, production database mutation, Render, ENV, DNS or Cloudflare changes.

Repository history retains all previous TOM 18 versions. This checkpoint supersedes stale status text from the 2026-09-08 version while preserving its historical meaning and evidence.

---

## 2. Non-negotiable governance rules

1. Every material finding receives a stable ID where one exists.
2. Original auditor IDs are preserved.
3. Backfill IDs use `HIST-*` only when the original historical ID was not preserved.
4. No auditor report directly authorizes implementation.
5. Lead independently verifies evidence, severity and merge-blocking status.
6. `ACCEPTED` does not equal merge authorization.
7. Corrections must be bounded and have an evidence plan.
8. Code change + green CI alone does not close a finding when re-audit is required.
9. Historical failed/intermediate CI remains historical.
10. Production state is separate from code closure.
11. Finding history is append-only in meaning; later decisions supersede rather than erase earlier conclusions.
12. Owner Czesław Socha retains separate final merge/deploy/production authorization.

---

## 3. Canonical status model

### Discovery / triage

- `NEW`
- `TRIAGE`
- `NEEDS EVIDENCE`

### Lead decision

- `ACCEPTED`
- `REJECTED`
- `SEVERITY CHANGED`
- `DUPLICATE`
- `DEFERRED`
- `RISK ACCEPTED`

### Correction lifecycle

- `CORRECTION AUTHORIZED`
- `FIX IN PROGRESS`
- `FIX IMPLEMENTED`
- `RE-REVIEW PENDING`
- `RE-AUDIT PENDING`
- `CLOSED`
- `SUPERSEDED`

No status automatically implies `MERGED`, `DEPLOYED` or `PRODUCTION VERIFIED`.

---

## 4. Severity model

- `CRITICAL` — credible immediate compromise, irreversible corruption or systemic security failure.
- `HIGH` — serious confidentiality/integrity/availability or correctness issue normally blocking the release gate.
- `MEDIUM` — material correctness/resilience/security-depth issue normally blocking its work item unless Lead rules otherwise.
- `LOW` — limited risk, hardening or test-quality issue.
- `INFO` — observation/recommendation with no demonstrated defect by itself.

Severity and merge-blocking are separate fields.

---

## 5. Finding namespaces

- `P8-AUD-Fxx` — original/supplemental P8 audit findings.
- `P8-GPT2-*` — ChatGPT-2 P8 findings where original IDs were assigned.
- `P8-LEAD-*` — Lead P8 findings.
- `FULL-AUD-Fxxx` — later full-project audit.
- `LEAD-Fxxx` — Lead finding outside a more specific namespace.
- `GFPE-AUD-Fxxx` — FairPlay MAX protocol/implementation audit.
- `GFPE-MATH-Fxxx` — FairPlay mathematical/statistical finding.
- `OPS-Fxxx` — operations/DR/production readiness.
- `PRIV-Fxxx` — privacy/data lifecycle.
- `HIST-*` — documentation backfill only.
- `INC-*` — operational/governance incident.

IDs are never recycled.

---

# 6. PRE-P8 HISTORICAL CLOSED RECORDS

These records preserve continuity from the previous TOM 18 checkpoint.

## 6.1 P6-F01 — local-before-shared production request limiter ordering

**PR:** `#39`  
**Lead severity:** `MEDIUM`  
**Merge blocking at discovery:** `YES for P6 closure`  
**Final status:** `CLOSED`

Correction commits:

- `3a8ea6294319d3c8ee60304a16d4fb1c7bfde1df`
- `7a450c7102420a7e56065139855ee86338c806d0`
- `c4669ea81bc2d0404f95d75a17a793a065ed725a`

Final P6 HEAD:

`c4669ea81bc2d0404f95d75a17a793a065ed725a`

Final P6 TREE:

`3b6dbca54ff33e06691ecbe002bdc96f0215f151`

Authoritative P6 run:

`33962992847 = SUCCESS`

Final merge:

`c5c34aabe4fcd04b087e25161778798146030c9b`

Deployment/production migration were not authorized by that closure.

---

## 6.2 P7-F01 — signal-only/private-state boundary

**PR:** `#40`  
**Final status:** `CLOSED`

Final P7 identity:

- HEAD `5b70c2d95fc937f0b516b7fafbce22bb8f59f432`
- TREE `81da9ee04a15fea2ea329d9e19e61cf9f6b438e6`
- CI `33991937667 = SUCCESS`
- merge `f88070b0f1d13a3ef353a46714f456c452876872`

The finding required the shared MatchRuntime realtime path to remain signal-only and not become a second authoritative/private-state channel.

`P7-F01 = CLOSED` for P7 defined scope.

---

## 6.3 P7-F02 — fail-closed projection contract

**PR:** `#40`  
**Final status:** `CLOSED`

Projection is mandatory; a shared runtime cannot fall back to raw authoritative state when an adapter lacks a viewer-safe projection.

Closure is tied to the final P7 identity and audit chain above.

`P7-F02 = CLOSED`.

---

## 6.4 P7-F03 — current authoritative snapshot on durable replay

**PR:** `#40`  
**Final status:** `CLOSED`

A durable idempotent replay returns the current authoritative player-safe snapshot rather than an obsolete/unsafe representation.

Closure identity is the same final P7 HEAD/TREE/CI/merge recorded above.

`P7-F03 = CLOSED`.

---

## 6.5 HIST-PR36-FINDING-01 — legacy crypto fallback too broad

**Documentation-assigned ID:** `HIST-PR36-FINDING-01`  
**PR:** `#36`  
**Final status:** `CLOSED`

The correction narrowed legacy `AUTH_SECRET` fallback so it is attempted only after genuine authenticated AES-256-GCM authentication failure rather than generic exceptions.

Final corrective commit:

`bbb48464f164a9c0687a65e5b660f447e069c189`

TREE:

`43ead9cc3c54023c18d27236f1f41c21a81b22ee`

Exact-head CI:

- Greetings `33909692336 = SUCCESS`
- Security Gate `33909692327 = SUCCESS`
- CheckersEngine `33909692352 = SUCCESS`

Final merge:

`05989fa219cc92a299a3f3a193f3dfda5762bbca`

Production re-encryption/ENV/deployment were not part of this correction.

---

## 6.6 INC-P5-GOV-001 — unintended repository content commit and normal revert

**Type:** repository governance incident  
**Final status:** `CLOSED`

Historical evidence:

- incident commit `74eedcb7856c9616c88daf3f674b9721345af793`
- unintended file `SHOULD-NOT-EXIST`
- repair commit `f47f9880adccb2cbb5ccf180dcc6902980e69304`
- repair method `NORMAL REVERT`
- repaired TREE `2e7ad8c027ece18ffe1da175221274a1ee6a4255`
- no history rewrite
- net authorized-content difference after repair: none

---

# 7. P8 / P1-U-01 — FINAL FINDING AND REMEDIATION HISTORY

## 7.1 Exact final P8 identity

```text
REPOSITORY = developergracz/gracz-pl-2
PR = #43
BASE = ad0739190fe2f9d1657b2b77c8b5f8e825830c08
BASE TREE = 04f72af50f6fad2ba01bf7eaa6b4d856267d517b
FINAL HEAD = c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f
FINAL TREE = 0ba0abce0993c145164b20f2881f118e0b71124d
COMMITS = 25
CHANGED FILES = 13
PR STATE = OPEN
MERGED = NO
```

Final canonical internal game IDs:

- `checkers`
- `gomoku`
- `thousand`

Compatibility alias:

- `warcaby -> checkers`

Historical unsupported value:

- `szachy` -> `game:null / gameSupported:false / legacyGame:"szachy"`

Exact historical Tournament action error:

`TOURNAMENT_GAME_UNSUPPORTED / 409`.

---

## 7.2 P8-AUD-F01 through P8-AUD-F05

The original P8 audit stream identified five issues covering canonical UI identifiers, historical `szachy` read safety, Lobby invalid-game contract, registry collision safety and Tournament browser/CI coverage.

Final state after corrections and re-audits:

```text
P8-AUD-F01 = CLOSED
P8-AUD-F02 = CLOSED
P8-AUD-F03 = CLOSED
P8-AUD-F04 = CLOSED
P8-AUD-F05 = CLOSED
```

Closure was independently re-checked on final HEAD `c69fbcd...` by Gemini, ChatGPT-2, Claude and Lead.

---

## 7.3 P8-GPT2-F01 — concurrent JOIN overbooking / duplicate current seed

**Source:** ChatGPT-2  
**Final status:** `CLOSED`

PostgreSQL JOIN now serializes through parent tournament `SELECT ... FOR UPDATE`, rechecks status/membership/capacity and computes current `MAX(seed)+1` within the same transaction.

Nuance retained explicitly: seed is not claimed to be globally monotonic or never reused after a highest-seed player leaves.

Real PostgreSQL hardening verifies final-seat and multi-seat concurrent JOIN behavior.

---

## 7.4 P8-GPT2-F02 — duplicate alias in one registry definition

**Source:** ChatGPT-2  
**Final status:** `CLOSED`

Registry validation now fails closed for duplicate alias claims, including duplicates within the same definition, self-aliases, alias/canonical collisions and malformed registry tokens.

---

## 7.5 P8-GPT2-F03 — missing explicit historical unsupported START/REPORT coverage

**Source:** ChatGPT-2  
**Final status:** `CLOSED`

Focused negative regressions cover historical unsupported action rejection with zero mutation.

---

## 7.6 Historical snapshot `589ef546...` — supplemental audit not accepted as closure

Historical HEAD:

`589ef54609071474b55b40578690bde55822ff65`

A historical Gemini audit returned PASS at this stage, but Lead rejected its use as final closure evidence because the report contained false claims about START/LEAVE locking on that snapshot.

This historical PASS remains recorded as historical evidence only. It is not retroactively rewritten or projected onto later heads.

---

## 7.7 P8-LEAD-F01 / P8-GPT2-FINAL-F01 — START membership boundary / initial round atomicity

**Source:** Lead + ChatGPT-2  
**Merge blocking at discovery:** `YES`  
**Final status:** `CLOSED`

Root issue:

START was not sufficiently serialized with membership finalization and initial round materialization required a single transaction boundary.

Production correction:

`5cf8fae9b8028cfbf6216fcd163a58e2825901a8`

The correction established parent tournament-row serialization for JOIN/LEAVE/START and one transaction for START status/current-round/initial matches.

### Historical CI failure — preserved

P8 run:

`34289959902`

At this corrected production snapshot, the first boundary tests passed; a fifth test failed because an expected rejection handler was attached too late, so Node reported the expected rejection as unhandled.

Lead determined this was a test-harness defect, not a production rollback/locking defect.

### Test-only correction

HEAD:

`f3b782c3f0112239a4787fabed8f037425a2268b`

TREE:

`17f49f52dfc4388dca5fc79c5e6ae8e9d08182fd`

Production behavior remained unchanged from `5cf8...`.

Exact-head CI at `f3b782...`:

- P8 `34290089821 = SUCCESS`
- P1-H-01 `34290089760 = SUCCESS`
- Security Gate `34290089824 = SUCCESS`
- CheckersEngine `34290089818 = SUCCESS`
- Greetings `34290089815 = SUCCESS`

---

## 7.8 Gemini audit on `f3b782...` — PASS with Lead reporting corrections

Gemini returned PASS on `f3b782...`.

Lead accepted the core technical result but corrected report statements including:

- `CANONICAL_GAME_TYPES` is a frozen ARRAY, not a Set,
- invalid Lobby game reaches 400 through the actual GameTypeError/status handling path rather than the incorrectly described special mapping,
- historical `szachy` action error is `TOURNAMENT_GAME_UNSUPPORTED / 409`,
- START roster SELECT itself is not `FOR UPDATE`; parent tournament locking provides serialization,
- the start-boundary suite at that stage proved visibility but did not include a forced failed-match-insert rollback test,
- deadlock wording must be bounded,
- `package.json` is changed in P8; correct claim is `NO NEW EXTERNAL RUNTIME DEPENDENCIES`,
- real Tournament tables use `gracz_*` names.

These are report-quality corrections and do not alter historical code evidence.

---

## 7.9 P8-GPT2-CLOSURE-F01 — CREATE not atomic with mandatory owner membership

**Source:** ChatGPT-2 final closure audit on `f3b782...`  
**ChatGPT-2 severity:** `HIGH`  
**ChatGPT-2 merge blocking:** `YES`  
**Lead decision:** `ACCEPTED / SEVERITY CHANGED`  
**Lead final severity:** `MEDIUM`  
**Lead merge blocking:** `YES`  
**Final status:** `CLOSED`

### Finding

PostgreSQL `TournamentService.create()` wrote the tournament and mandatory owner membership as separate autocommit operations.

### Impact

The parent tournament could become externally visible before owner membership, allowing an outsider to claim seed 1 under the then-current join logic. Failure of the owner insert could also leave an orphan tournament without its mandatory owner participant.

The defect pre-existed in base main; nevertheless it was a known blocker incompatible with P8 closure.

### Correction

Production commit:

`a58440924408b8c47800bfc726e6f7831bdd3733`

Final proof/test commit:

`c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f`

Final transaction:

```text
BEGIN
INSERT gracz_tournaments
INSERT gracz_tournament_players owner seed=1
COMMIT
```

On error:

`ROLLBACK`

Always:

`client.release()`

Both inserts use one checked-out transaction client.

### Focused real-PostgreSQL evidence

The final boundary suite proves:

1. tournament and owner are externally invisible after real parent INSERT and before owner INSERT/COMMIT,
2. concurrent JOIN cannot end in outsider seed 1 / owner seed 1,
3. forced owner-membership insertion failure rolls back tournament and player rows to zero.

`P8-GPT2-CLOSURE-F01 = CLOSED` after exact-head CI and final independent re-audits.

---

# 8. FINAL `c69fbcd...` AUDIT CHAIN

## 8.1 Exact-head CI

All required PR-triggered workflows for final HEAD `c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f` are `SUCCESS`:

```text
34291690126 — P1-U-01 Canonical Game Types P8 — SUCCESS
34291690070 — P1-H-01 Tournament Concurrency — SUCCESS
34291690134 — Security Gate — SUCCESS
34291690072 — CheckersEngine — SUCCESS
34291690139 — Greetings — SUCCESS
```

Authoritative P8 run includes successful:

- syntax/static checks,
- canonical contract,
- Tournament concurrency/legacy hardening,
- Tournament start/membership boundary serialization including atomic CREATE tests,
- Checkers regression,
- Gomoku regression,
- Thousand regression,
- Tournament concurrency regression,
- P5 readiness,
- P6 distributed infrastructure,
- P7 MatchRuntime,
- full Node suite,
- production dependency audit,
- Browser Checkers/Gomoku/Tournaments,
- P1-R-01 DR,
- gitleaks,
- CodeQL.

P1-H-01 real PostgreSQL concurrency, Security Gate and CheckersEngine exact-head jobs are also green.

---

## 8.2 Gemini final exact-snapshot audit

Verdict:

`P8 / P1-U-01 GEMINI ULTIMATE CLOSURE AUDIT — PASS`

Lead accepted the technical PASS while recording report corrections:

- frozen array vs Set,
- generic pseudo-table code vs actual `gracz_*` source,
- START roster SELECT no `FOR UPDATE`,
- exact `szachy` error contract,
- not every read needs transaction catch/finally,
- package.json did change,
- bounded deadlock wording.

No new production blocker resulted.

---

## 8.3 ChatGPT-2 final exact-snapshot audit

Verdict:

`P8 / P1-U-01 CHATGPT-2 ULTIMATE CLOSURE AUDIT — PASS WITH NON-BLOCKING FINDINGS`

### P8-GPT2-ULTIMATE-F01

**Title:** CREATE-vs-JOIN regression test does not deterministically prove JOIN reached the database before CREATE is released.  
**Severity:** `LOW`  
**Merge blocking:** `NO`  
**Production defect:** `NO`  
**Category:** `TEST HARDENING`  
**Lead decision:** `ACCEPTED / NON-BLOCKING / NO PRE-MERGE CORRECTION REQUIRED`  
**Current status:** `DEFERRED OPTIONAL HARDENING`

The test starts JOIN and releases CREATE without a second JOIN-side synchronization point. A schedule in which JOIN reaches SQL only after CREATE commits can therefore also pass.

This does not invalidate production correctness because:

- tournament + mandatory owner are one transaction,
- a separate deterministic real-PG test proves zero external partial visibility after the real parent INSERT,
- PostgreSQL READ COMMITTED cannot expose the uncommitted parent row to JOIN.

No P8 re-audit is required solely for this optional hardening item.

---

## 8.4 Claude final canonical audit

Verdict:

`P8 / P1-U-01 FINAL CLAUDE CANONICAL AUDIT — PASS WITH NON-BLOCKING FINDINGS`

Claude independently confirmed:

- all prior P8 merge blockers closed,
- canonical/legacy contracts valid,
- atomic CREATE valid,
- JOIN/LEAVE/START serialization valid,
- initial-round external visibility atomic,
- REPORT/advance transaction valid,
- `P8-GPT2-ULTIMATE-F01` factually valid and non-blocking,
- no new merge-blocking technical finding.

### Claude evidence gap — Lead closure

Claude could not directly verify exact GitHub Actions run results and therefore marked CI as an evidence gap. Lead independently queried the exact-head GitHub workflow runs/jobs and confirmed required CI success. The evidence gap is therefore closed at Lead verification level.

### Claude report corrections — preserved

Claude incorrectly stated that `lobby.js`, `platform-lobby-http.js` and `rankings.js` were unchanged. They are three of the exact 13 changed files in PR #43 and their final P8 changes were independently verified by Lead.

Claude also did not fully review every line of the Tournament browser E2E. Lead independently inspected the actual Playwright test and confirmed it opens the active UI, verifies canonical select values, filters Checkers, creates canonical tournaments through UI and renders historical unsupported data without browser errors.

These are reporting limitations, not production findings.

---

# 9. P8 FINAL CLOSURE LEDGER

```text
P8-AUD-F01 = CLOSED
P8-AUD-F02 = CLOSED
P8-AUD-F03 = CLOSED
P8-AUD-F04 = CLOSED
P8-AUD-F05 = CLOSED

P8-GPT2-F01 = CLOSED
P8-GPT2-F02 = CLOSED
P8-GPT2-F03 = CLOSED

P8-LEAD-F01 = CLOSED
P8-GPT2-FINAL-F01 = CLOSED
P8-GPT2-CLOSURE-F01 = CLOSED

P8-GPT2-ULTIMATE-F01 = LOW / NON-BLOCKING / OPTIONAL TEST HARDENING / DEFERRED

KNOWN MERGE-BLOCKING TECHNICAL FINDINGS = 0
KNOWN NON-BLOCKING FINDINGS = 1
```

---

# 10. Lead final P8 decision

```text
P8 TECHNICAL CLOSURE = ACHIEVED
P8 EXACT-HEAD CI = PASS
GEMINI FINAL = PASS
CHATGPT-2 FINAL = PASS WITH NON-BLOCKING FINDINGS
CLAUDE FINAL CANONICAL = PASS WITH NON-BLOCKING FINDINGS
LEAD FINAL VERIFICATION = PASS
P8 DOCUMENTATION CHECKPOINT = SYNCHRONIZED 2026-09-09
P8 STATUS = MERGE-READY
MERGE AUTHORIZATION = NO
MERGE = NO
AUTO-MERGE = NO
DEPLOY = NO
PRODUCTION MIGRATION = NO
PRODUCTION DATABASE CHANGE = NO
RENDER / ENV / DNS / CLOUDFLARE CHANGE = NO
```

The exact-snapshot closure applies to HEAD `c69fbcd...` / TREE `0ba0abce...` only.

If the PR HEAD changes before merge, merge-readiness must be re-evaluated.

---

# 11. Next gate

The next repository-code action requires a separate explicit Owner authorization to merge PR #43.

If authorized later, the merge must be guarded against final expected HEAD:

`c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f`.

After merge, record exact merge SHA, new main SHA/TREE and required post-merge checks before calling P8 `MERGED`.

After exact new-main verification, begin the separate:

`ADVANCED SCALABILITY AUDIT`.

No Advanced Scalability Audit has been started by this documentation update.

---

# 12. Later audit namespaces

```text
ADVANCED SCALABILITY AUDIT = NOT STARTED
FULL-AUD-Fxxx = NOT STARTED
GFPE-AUD-Fxxx = NOT STARTED
GFPE-MATH-Fxxx = NOT STARTED
FAIRPLAY MAX IMPLEMENTATION = NOT AUTHORIZED
```

Full-project and FairPlay findings continue to use the same finding -> triage -> correction -> evidence -> re-audit lifecycle.

---

# 13. Current checkpoint summary — 2026-09-09

```text
TOM 18 = SYNCHRONIZED
P6-F01 = CLOSED
P7-F01 = CLOSED
P7-F02 = CLOSED
P7-F03 = CLOSED
HIST-PR36-FINDING-01 = CLOSED
INC-P5-GOV-001 = CLOSED
P8 MERGE-BLOCKERS = 0
P8 NON-BLOCKING = 1 LOW TEST-HARDENING
P8 TECHNICAL CLOSURE = ACHIEVED
P8 = MERGE-READY
P8 MERGE = NOT AUTHORIZED
DEPLOY = NO
PRODUCTION CHANGE = NO
```

This register is the canonical bridge between audit findings and controlled remediation for Gracz.pl at the 2026-09-09 checkpoint.
