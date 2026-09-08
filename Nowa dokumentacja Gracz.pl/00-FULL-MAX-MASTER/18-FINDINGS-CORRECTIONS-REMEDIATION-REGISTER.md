# GRACZ.PL — FINDINGS / CORRECTIONS / REMEDIATION REGISTER

**Document:** TOM 18 / Findings, Corrections & Remediation Register  
**Status:** LIVING / APPEND-ONLY CORRECTION HISTORY / NOT FROZEN  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Current-main reference:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**P8 / PR #43:** OPEN / NOT MERGED / independent Claude audit pending  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This register is the canonical lifecycle record for every material technical, security, architecture, data, reliability, privacy, test, documentation and governance finding discovered during Gracz.pl reviews or audits.

It connects:

`FINDING -> LEAD TRIAGE -> DECISION -> CORRECTION MANDATE -> IMPLEMENTATION -> EXACT SHA/TREE -> TEST EVIDENCE -> RE-AUDIT -> CLOSURE`

The register prevents findings from disappearing between an audit report and a later implementation. It also prevents an AI-generated or human-generated finding from being corrected automatically without Lead verification.

This document does not authorize code changes, merge, deployment, migrations or production changes.

---

## 2. Non-negotiable governance rules

1. Every finding receives a stable ID.
2. Original auditor IDs are preserved when available.
3. A historical finding without a preserved original ID may receive a `HIST-*` backfill ID; that ID must be explicitly marked as documentation-assigned, not an original auditor ID.
4. No finding is implemented directly from an auditor report. Lead first verifies the finding against code/evidence.
5. Lead may classify a finding as `ACCEPTED`, `REJECTED`, `SEVERITY CHANGED`, `DUPLICATE`, `DEFERRED`, `RISK ACCEPTED` or `NEEDS EVIDENCE`.
6. `ACCEPTED` does not equal authorization to merge.
7. A correction must have a bounded scope and evidence plan.
8. A fix is not `CLOSED` merely because code was changed.
9. Closure requires adequate verification for the risk: focused tests, regressions, database/concurrency/security evidence where applicable, Lead re-review and required independent re-audit.
10. Historical failed/intermediate runs remain historical; they are never rewritten as final PASS.
11. Production status is separate from code closure.
12. Findings and corrections are append-only in meaning. If a conclusion changes, add a superseding record rather than silently erasing history.

---

## 3. Canonical status model

### Discovery / triage

- `NEW` — finding received, not yet verified.
- `TRIAGE` — Lead is checking evidence, scope and severity.
- `NEEDS EVIDENCE` — insufficient proof for a decision.

### Lead decision

- `ACCEPTED` — finding is technically valid.
- `REJECTED` — finding is not valid; rationale/evidence required.
- `SEVERITY CHANGED` — finding is valid but severity was reclassified.
- `DUPLICATE` — same root issue already exists under another canonical ID.
- `DEFERRED` — valid but intentionally moved to a later authorized scope.
- `RISK ACCEPTED` — Owner/Lead explicitly accept residual risk; must record rationale and expiry/review trigger if applicable.

### Correction lifecycle

- `CORRECTION AUTHORIZED` — bounded correction mandate exists.
- `FIX IN PROGRESS` — implementation branch active.
- `FIX IMPLEMENTED` — code exists on controlled branch; not yet closed.
- `RE-REVIEW PENDING` — Lead verification pending.
- `RE-AUDIT PENDING` — independent re-audit required and pending.
- `CLOSED` — required evidence and audit gates completed for defined scope.
- `SUPERSEDED` — replaced by another finding/decision.

No status automatically implies `MERGED`, `DEPLOYED` or `PRODUCTION VERIFIED`.

---

## 4. Severity model

- `CRITICAL` — credible immediate compromise, irreversible corruption, systemic auth/crypto failure or equivalent production-blocking risk.
- `HIGH` — serious confidentiality/integrity/availability or authorization/concurrency issue requiring correction before the relevant release gate.
- `MEDIUM` — material correctness, resilience, security-depth or maintainability issue; normally blocks the affected work item unless Lead explicitly rules otherwise.
- `LOW` — limited risk, narrow edge case, maintainability or hardening issue.
- `INFO` — observation/recommendation; no defect proven by itself.

Severity and merge blocking are separate fields. A finding must explicitly state `MERGE BLOCKING = YES/NO`.

---

## 5. Finding ID namespaces

Preserve source-specific IDs where they already exist. For new work use:

- `P8-AUD-Fxx` — Claude independent audit of P8 / P1-U-01.
- `FULL-AUD-Fxxx` — post-P8 full-project audit.
- `LEAD-Fxxx` — Lead-discovered finding outside a source audit namespace.
- `GFPE-AUD-Fxxx` — FairPlay MAX protocol/implementation audit.
- `GFPE-MATH-Fxxx` — mathematical/statistical finding, including Gemini review.
- `OPS-Fxxx` — operations/DR/production-readiness finding.
- `PRIV-Fxxx` — privacy/data-lifecycle finding.
- `HIST-*` — documentation backfill only when original historical ID is unavailable.
- `INC-*` — non-audit incident/remediation record.

IDs are never recycled.

---

## 6. Required finding record

Every material finding should contain:

```text
FINDING ID:
SOURCE:
DATE:
AUDITOR / REVIEWER:
WORK ITEM / PR:
BASE / HEAD / TREE EXAMINED:
SEVERITY (SOURCE):
SEVERITY (LEAD FINAL):
MERGE BLOCKING:
AFFECTED COMPONENTS:
LOCATION:
FINDING:
IMPACT:
EVIDENCE:
ROOT CAUSE:
LEAD DECISION:
CORRECTION REQUIREMENT:
CORRECTION MANDATE:
FIX BRANCH:
FIX COMMIT(S):
FINAL FIX HEAD / TREE:
FOCUSED TESTS:
REGRESSION TESTS:
SECURITY / DB / CONCURRENCY EVIDENCE:
LEAD RE-REVIEW:
INDEPENDENT RE-AUDIT:
MERGE COMMIT:
DEPLOYMENT / PRODUCTION STATE:
RESIDUAL RISK:
FINAL STATUS:
CLOSURE DATE:
```

Unknown fields remain `NOT RECORDED`, `NOT APPLICABLE` or `PENDING`; they are not guessed.

---

# 7. ACTIVE FINDINGS QUEUE

At this checkpoint there are **no P8 audit findings recorded yet** because Claude's independent audit of PR #43 has not been completed.

```text
P8 / PR #43
AUDIT = PENDING
P8-AUD-Fxx = NOT CREATED YET
MERGE = NOT AUTHORIZED
```

When the Claude A-N report arrives, each reported issue will be entered here before any correction mandate is issued.

The Lead will independently verify every reported issue against the exact P8 HEAD `d7220f57d60779584048cc5c695d40dbb948b9cb` and surrounding current-main code.

---

# 8. HISTORICAL CLOSED FINDINGS — SEEDED CANONICAL EXAMPLES

These records are included to establish continuity with already completed work and demonstrate the required remediation chain.

## 8.1 P6-F01 — local-before-shared production request limiter ordering

**Original ID:** `P6-F01`  
**Source:** Lead review of P6 / P1-AUD3-01  
**PR:** `#39`  
**Source severity:** `MEDIUM`  
**Lead final severity:** `MEDIUM`  
**Merge blocking at discovery:** `YES for P6 closure until corrected`  
**Final status:** `CLOSED`

### Finding

The production request-level limiter composition allowed the PostgreSQL shared limiter to run before the process-local `TrafficGuard` under sustained single-instance flood.

### Impact

The shared database-backed layer could receive avoidable request pressure before the cheaper local defense-in-depth layer rejected abusive traffic.

### Required correction

For every non-health request:

1. process-local TrafficGuard,
2. PostgreSQL shared TrafficGuard,
3. remaining application/security routing.

Health paths must bypass both request-level limiters.

### Correction evidence

Corrective commits preserved in PR #39:

- `3a8ea6294319d3c8ee60304a16d4fb1c7bfde1df` — runtime local-before-shared correction,
- `7a450c7102420a7e56065139855ee86338c806d0` — executable P6-F01 behavioral gate,
- `c4669ea81bc2d0404f95d75a17a793a065ed725a` — final source-contract assertion resynchronization.

Final HEAD:

`c4669ea81bc2d0404f95d75a17a793a065ed725a`

Final TREE:

`3b6dbca54ff33e06691ecbe002bdc96f0215f151`

### Final tests / CI

Final authoritative P6 run:

`33962992847 = SUCCESS`

Including:

- focused P6 `23/23 PASS`,
- P6-F01 behavioral `5/5 PASS`,
- no shared call after local 429,
- local allow -> one local + one shared enforcement,
- health paths bypass both,
- sanitized shared-infrastructure failure,
- P4 no-publish-after-409 regression,
- PostgreSQL CAS regression,
- crypto, Gomoku and readiness regressions,
- full Node suite,
- browser Checkers/Gomoku,
- npm audit,
- gitleaks,
- CodeQL.

Final merge:

`c5c34aabe4fcd04b087e25161778798146030c9b`

The merge record explicitly states Owner-authorized merge after Lead PASS and independent Claude audit. Deployment and production migration were not authorized.

### Closure

`P6-F01 = CLOSED`.

---

## 8.2 P7-F01 — signal-only / private-state boundary

**Original ID:** `P7-F01`  
**Source:** Lead review of P7 / P1-U-02  
**PR:** `#40`  
**Final status:** `CLOSED`

### Finding / correction objective

Ensure the shared MatchRuntime realtime path remains signal-only and does not turn transport notifications into a second authoritative/private-state channel.

### Closure evidence

PR #40 records:

- `P7-F01 signal-only/private-state boundary — CLOSED`,
- final HEAD `5b70c2d95fc937f0b516b7fafbce22bb8f59f432`,
- final TREE `81da9ee04a15fea2ea329d9e19e61cf9f6b438e6`,
- final pre-PR CI run `33991937667 = SUCCESS`,
- Lead PASS / independent review chain completed before merge,
- merge commit `f88070b0f1d13a3ef353a46714f456c452876872`.

An individual correction commit was not reconstructed in TOM 18 and is therefore not guessed.

`P7-F01 = CLOSED` for P7 defined scope.

---

## 8.3 P7-F02 — fail-closed projection contract

**Original ID:** `P7-F02`  
**Source:** Lead review of P7 / P1-U-02  
**PR:** `#40`  
**Final status:** `CLOSED`

### Finding / correction objective

A shared runtime must not return raw authoritative state when a game adapter cannot provide a valid viewer-safe projection. Projection is mandatory and fails closed.

### Closure evidence

PR #40 explicitly records:

`P7-F02 fail-closed projection contract — CLOSED`.

Closure is tied to the final P7 HEAD/TREE and the completed P7 audit/merge chain above. No individual historical correction commit is invented here.

`P7-F02 = CLOSED` for P7 defined scope.

---

## 8.4 P7-F03 — current authoritative snapshot on durable replay

**Original ID:** `P7-F03`  
**Source:** Lead review of P7 / P1-U-02  
**PR:** `#40`  
**Final status:** `CLOSED`

### Finding / correction objective

A durable idempotent replay must return the current authoritative player-safe snapshot rather than an obsolete or unsafe response representation.

### Closure evidence

PR #40 explicitly records:

`P7-F03 current authoritative snapshot on replay — CLOSED`.

Final P7 exact identity:

- HEAD `5b70c2d95fc937f0b516b7fafbce22bb8f59f432`,
- TREE `81da9ee04a15fea2ea329d9e19e61cf9f6b438e6`,
- CI `33991937667 = SUCCESS`,
- merge `f88070b0f1d13a3ef353a46714f456c452876872`.

`P7-F03 = CLOSED` for P7 defined scope.

---

## 8.5 HIST-PR36-FINDING-01 — legacy crypto fallback too broad

**Documentation-assigned ID:** `HIST-PR36-FINDING-01`  
**Important:** this is a TOM 18 backfill identifier because a stable original auditor finding ID was not preserved in the retrieved GitHub metadata.  
**Source:** independent review/corrective history of P1-AUD3-03  
**PR:** `#36`  
**Final status:** `CLOSED`

### Finding

The original crypto key-separation implementation required a narrow correction so legacy `AUTH_SECRET` fallback would be attempted only after a genuine authenticated AES-256-GCM authentication failure, not after malformed input, setup/programming errors or generic exceptions.

### Correction

Final corrective commit:

`bbb48464f164a9c0687a65e5b660f447e069c189`

TREE:

`43ead9cc3c54023c18d27236f1f41c21a81b22ee`

The correction introduced/used a typed `CryptoAuthenticationError` around GCM finalization and retained DUAL-READ / SINGLE-WRITE compatibility while ensuring new writes use the dedicated message, attachment and MFA encryption key domains.

### Exact-head CI evidence

For final HEAD `bbb48464...`:

- Greetings `33909692336 = SUCCESS`,
- Security Gate `33909692327 = SUCCESS`,
- CheckersEngine `33909692352 = SUCCESS`.

PR #36 additionally records focused crypto, real PostgreSQL crypto persistence/restart, full npm, browser, CodeQL, gitleaks and dependency-audit PASS results.

Final merge:

`05989fa219cc92a299a3f3a193f3dfda5762bbca`.

Production re-encryption, deployment and production ENV changes were not part of this correction.

`HIST-PR36-FINDING-01 = CLOSED` for the defined correction scope.

---

# 9. HISTORICAL INCIDENT / REMEDIATION LANE

Incidents are tracked separately from audit findings when the problem is procedural or operational rather than a discovered code defect.

## INC-P5-GOV-001 — unintended repository content commit and normal revert

**Type:** repository governance incident  
**Work item context:** P5 / P1-AUD3-07  
**Final status:** `CLOSED`

Historical evidence in PR #38 records:

- incident commit `74eedcb7856c9616c88daf3f674b9721345af793`,
- unintended file `SHOULD-NOT-EXIST` with content `x`,
- repair commit `f47f9880adccb2cbb5ccf180dcc6902980e69304`,
- repair method `NORMAL REVERT`,
- repaired TREE `2e7ad8c027ece18ffe1da175221274a1ee6a4255`,
- no history rewrite,
- net content difference to the authorized P5 base: none.

Classification remains:

`REPOSITORY GOVERNANCE INCIDENT / DOCUMENTED / REPAIRED / NON-P5-CODE / CLOSED`.

This incident is preserved because governance failures are part of AS-BUILT evidence even when runtime code is unaffected.

---

# 10. P8 AUDIT INTAKE CONTRACT

When Claude returns the P8 A-N report, perform this sequence before any code correction:

1. freeze the exact report as evidence,
2. assign/preserve every `P8-AUD-Fxx`,
3. capture source severity and merge-blocking claim,
4. Lead independently inspect exact diff, surrounding code and tests,
5. set Lead decision for each finding,
6. only accepted findings may enter a correction mandate,
7. group corrections only when root cause and regression boundary genuinely align,
8. each correction group receives exact branch/base/allowed files/acceptance tests,
9. after implementation capture HEAD/TREE and full CI,
10. Lead re-review,
11. Claude re-audit where required,
12. close each finding individually,
13. only then evaluate P8 merge authorization.

A global `PASS` after corrections cannot silently close a finding whose specific fix evidence is missing.

---

# 11. FULL-PROJECT AUDIT INTAKE CONTRACT

After P8 formal closure, full-project findings will use `FULL-AUD-Fxxx`.

Each finding must be mapped to at least one domain:

- architecture,
- Checkers,
- Gomoku,
- Thousand,
- MatchRuntime,
- PostgreSQL/data integrity,
- concurrency/idempotency,
- auth/session/account,
- RBAC/MFA,
- crypto/secrets,
- realtime/projection/privacy,
- messaging/attachments,
- tournaments/rankings/lobby,
- DR/restore,
- CI/test coverage,
- supply chain,
- observability/operations,
- UX/mobile/accessibility,
- documentation/design-code mismatch,
- technical debt/legacy/dead code,
- production-readiness assumptions.

The full audit remediation plan is derived from this register, not maintained as an untraceable separate list.

---

# 12. FAIRPLAY MAX / GFPE FINDING MODEL

FairPlay MAX will use the same lifecycle but stricter evidence requirements.

### Security/protocol findings

Use `GFPE-AUD-Fxxx` for:

- entropy/commit-reveal,
- transcript canonicalization,
- seed derivation,
- deterministic shuffle,
- rejection sampling,
- deck/shoe immutability,
- commitment/proof format,
- signing/key lifecycle,
- replay/downgrade protection,
- restart recovery,
- ledger integrity,
- privacy/selective reveal,
- MatchRuntime integration,
- supply-chain/implementation risks.

### Mathematical/statistical findings

Use `GFPE-MATH-Fxxx` for:

- distribution bias,
- modulo bias,
- statistical-test methodology,
- insufficient sample sizes,
- non-uniform position/card frequencies,
- correlation anomalies,
- repeatability/test-vector mismatch,
- false-positive/false-negative analysis.

Claude and Gemini findings remain independent evidence streams. Neither automatically overrides Lead verification.

---

# 13. Correction mandate minimum contents

Any GPT-2 implementation mandate derived from a finding must contain:

- canonical finding IDs being corrected,
- authorized base SHA/TREE,
- branch name,
- explicit allowed files or bounded module scope,
- forbidden changes,
- exact behavioral invariant to restore,
- backward-compatibility requirements,
- migration/DDL/production boundary,
- focused negative tests,
- regression suites,
- PostgreSQL/concurrency/security/browser requirements where applicable,
- final evidence format,
- no-merge/no-deploy boundary unless Owner separately authorizes.

Copilot may assist implementation/repository navigation but does not close a finding and is not an independent auditor.

---

# 14. Closure checklist

A finding may be `CLOSED` only when all applicable fields are satisfied:

- [ ] Lead accepted/reclassified it with rationale.
- [ ] Correction scope was explicitly authorized.
- [ ] Fix implementation is tied to exact SHA/TREE.
- [ ] Focused test proves the defect path.
- [ ] Negative test proves fail-closed/error behavior where relevant.
- [ ] Required regressions are green.
- [ ] PostgreSQL/concurrency evidence exists where relevant.
- [ ] Security scans/audits exist where relevant.
- [ ] Lead re-review is complete.
- [ ] Independent re-audit is complete when required.
- [ ] Residual risk is documented.
- [ ] Merge status is separately recorded.
- [ ] Deployment/production status is separately recorded.

Unchecked applicable items mean the finding remains open or explicitly risk-accepted/deferred.

---

# 15. Summary at checkpoint 2026-09-08

```text
TOM 18 = BASELINE CREATED
P6-F01 = CLOSED
P7-F01 = CLOSED
P7-F02 = CLOSED
P7-F03 = CLOSED
HIST-PR36-FINDING-01 = CLOSED
INC-P5-GOV-001 = CLOSED
P8-AUD-Fxx = NONE YET / CLAUDE AUDIT PENDING
FULL-AUD-Fxxx = NOT STARTED
GFPE-AUD-Fxxx = NOT STARTED
GFPE-MATH-Fxxx = NOT STARTED
P8 MERGE = NOT AUTHORIZED
DEPLOY = NO
PRODUCTION CHANGE = NO
```

This register is now the canonical bridge between audit findings and controlled remediation for Gracz.pl.