# GRACZ.PL — FULL PROJECT AUDIT PLAN & CHECKLIST

**Document:** TOM 45 / Full Audit Plan  
**Status:** PREPARED / NOT EXECUTED / NOT FROZEN  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Current-main baseline at preparation:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Current-main TREE:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**P8 / PR #43:** OPEN / NOT MERGED / independent Claude audit pending  
**Execution gate:** full-project audit starts only after P8 is formally closed on main  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This document defines the canonical scope, evidence requirements, output format and pass/fail gates for the post-P8 full technical audit of Gracz.pl.

The audit must not be a high-level review. It must verify actual source code, tests, PostgreSQL behavior, CI, documentation alignment, concurrency, security, privacy, restart behavior and operational assumptions against an exact `main` HEAD/TREE.

The audit result must be traceable into:

- `01-EVIDENCE-REGISTER.md`,
- `04-IMPLEMENTATION-AUDIT-REGISTER.md`,
- `15-REQUIREMENTS-TRACEABILITY-MATRIX.md`,
- `18-FINDINGS-CORRECTIONS-REMEDIATION-REGISTER.md`.

---

## 2. Audit entry gate

The full-project audit MUST NOT start until all are true:

- P8 / P1-U-01 independent audit completed,
- all P8 blocking findings closed,
- P8 merge separately authorized by Owner + Lead,
- P8 merged,
- exact post-P8 `main` SHA and TREE recorded,
- required main CI green on that exact baseline,
- repository status/history reviewed for stale or overlapping implementation branches.

If any condition is false: `FULL PROJECT AUDIT = HOLD`.

---

## 3. Required auditors and roles

### Lead Architect — GPT-5.6 Sol

- freezes audit baseline,
- defines canonical scope,
- checks source/evidence,
- validates every finding,
- assigns remediation status,
- does not automatically accept external findings.

### Claude — independent technical/security auditor

- performs wide independent review,
- returns structured findings with evidence,
- does not modify code,
- does not authorize merge/deploy.

### GPT-2 — implementation engineer

- only after Lead accepts a finding and issues bounded correction mandate.

### Copilot

- optional implementation/code navigation support,
- not final auditor.

### Gemini

- not required for normal full-project audit,
- required later for GFPE mathematical/statistical review.

---

## 4. Required final audit package

Before Claude starts, prepare:

1. exact `main` HEAD/TREE,
2. repository tree,
3. package/runtime versions,
4. current FULL MAX MASTER index,
5. architecture master + component catalog,
6. API contract catalog,
7. PostgreSQL data catalog,
8. traceability matrix,
9. ADR master,
10. historical evidence backfill,
11. findings/remediation register,
12. relevant CI workflow inventory,
13. exact recent CI run IDs/results,
14. known technical debt / stale branch register,
15. explicitly excluded production secrets and credentials.

---

# 5. AUDIT DOMAINS

## A. Architecture / composition / trust boundaries

Verify:

- `src/main.js` composition root,
- bounded-context separation,
- authoritative vs non-authoritative components,
- HTTP → service → persistence → realtime flow,
- cyclic/implicit dependencies,
- duplicated policy across games,
- hidden fallback paths,
- trust boundary violations,
- design docs vs actual runtime.

Required verdict: `PASS / FINDINGS`.

---

## B. Checkers

Verify at minimum:

- server-authoritative legal move validation,
- forced capture / multi-capture,
- flying king rules,
- draw/repetition/no-progress behavior,
- MatchRuntime move cutover,
- CAS conflict handling,
- idempotency,
- stale ownership fencing,
- viewer projections,
- reconnect/restart semantics,
- legacy actions/chat/disconnect paths that remain outside MatchRuntime,
- browser journey regressions.

---

## C. Gomoku

Verify:

- PostgreSQL durable source of truth when configured,
- schema verification fail-closed,
- revision CAS,
- `requestId` idempotency semantics,
- cross-instance race behavior,
- restart recovery,
- corrupt persisted-state rejection,
- no stale overwrite,
- current non-MatchRuntime architecture and migration debt.

---

## D. Thousand / Tysiąc

Verify:

- authoritative service/repository boundaries,
- revision CAS,
- restart recovery,
- projection/private card leakage,
- rules consistency,
- existing RNG behavior,
- all uses of `Math.random()` or equivalent,
- explicit classification as NOT FairPlay MAX,
- readiness for future GFPE adapter,
- current technical debt before card-game production.

No claim of FairPlay compliance is permitted.

---

## E. Shared MatchRuntime / P7

Verify:

- repository contract,
- ownership claim/fencing,
- `ownershipEpoch`,
- `expectedVersion`,
- durable idempotency records,
- command hash stability,
- replay semantics,
- current authoritative snapshot on replay,
- persistence-before-publication,
- signal-only realtime,
- mandatory projection,
- multi-instance races,
- restart behavior,
- stale writer failure.

---

## F. P8 canonical game types

After P8 merge verify:

- exact canonical IDs,
- aliases,
- unknown fail-closed behavior,
- lobby integration,
- ranking selector separation,
- tournament compatibility mapping,
- no hidden fallback to a valid game,
- documentation consistency.

---

## G. PostgreSQL / transactions / integrity

Verify all active runtime tables and critical structures against TOM 14:

- PK/FK/UNIQUE/CHECK/indexes,
- transaction boundaries,
- atomicity,
- isolation assumptions,
- CAS predicates,
- advisory locks where used,
- race safety,
- schema initialization/runtime DDL boundaries,
- referential-integrity gaps,
- application-only invariants,
- data corruption handling,
- least-privilege assumptions,
- migration ownership.

---

## H. Auth / account / session security

Verify:

- password hashing and parameters,
- registration code storage,
- password reset token hashing,
- auth session lifecycle,
- session revocation,
- password-reset revocation behavior,
- cookie/session attributes,
- same-origin/CSRF-related controls,
- brute-force protections,
- account enumeration,
- session fixation/replay risks,
- failure modes when shared infrastructure is unavailable.

---

## I. RBAC / MFA / privileged operations

Verify:

- Guest/Player/Moderator/Admin/Owner boundaries,
- privilege escalation prevention,
- Owner assignment restrictions,
- MFA required actions,
- MFA secret encryption,
- recovery paths,
- negative-path coverage,
- audit trail for privileged operations,
- open P1-B-01 scope.

This area must produce explicit pass/finding status, not a general security opinion.

---

## J. Crypto / secrets / key separation

Verify:

- AUTH vs MFA vs message vs attachment key separation,
- production fail-closed config,
- HKDF/AES-GCM usage where applicable,
- nonce/IV handling,
- legacy decrypt fallback scope,
- key rotation assumptions,
- plaintext logging risks,
- secret-like metadata sanitization,
- no accidental reuse of auth secret for encryption.

GFPE keys are outside current implementation and must remain marked future-only.

---

## K. Private messaging / attachments / privacy projection

Verify:

- encrypted-at-rest subject/body,
- attachment encryption/validation,
- sender/recipient access control,
- deletion semantics,
- file-size/type validation,
- private data in logs/realtime,
- metadata leakage,
- role/admin visibility,
- backup implications.

---

## L. Realtime / distributed infrastructure

Verify:

- local-before-shared request limiting,
- shared PostgreSQL rate limiting,
- fail-closed shared-infra behavior,
- health bypass semantics,
- event allowlists,
- payload size limits,
- PostgreSQL LISTEN/NOTIFY behavior,
- reconnect/reload authoritative state,
- event loss behavior,
- private state never treated as realtime authority.

---

## M. Tournaments / rankings / lobby

Verify:

- tournament concurrent report/advance safety,
- uniqueness/round-board constraints,
- authorization to report results,
- ranking aggregation correctness,
- game-type normalization,
- room ownership/identity derivation from session,
- invite/join/create authorization,
- invalid game identifiers.

---

## N. Health / readiness / failure handling

Verify:

- liveness vs readiness distinction,
- PostgreSQL dependency probe,
- timeouts,
- failure to 503,
- health-path rate-limit bypass,
- startup/shutdown behavior,
- resource cleanup,
- process signal handling,
- dependency outage behavior.

---

## O. DR / backup / restore

Verify P1-R-01 against current main:

- encrypted backup,
- key validation,
- checksums,
- decrypt preflight,
- source/target identity checks,
- disposable restore marker,
- source read-only behavior,
- reconciliation,
- redacted JSON evidence,
- isolated PostgreSQL source/target,
- scheduled synthetic rehearsal,
- no accidental production target.

---

## P. CI / test quality

Inventory and assess:

- unit,
- integration,
- real PostgreSQL,
- concurrency,
- negative-path,
- restart/recovery,
- browser,
- dependency audit,
- gitleaks,
- CodeQL,
- workflow path filters,
- exact-head evidence quality,
- skipped/conditional tests,
- flaky or weak assertions,
- test gaps relative to critical invariants.

Green CI alone is not a PASS if critical contracts are untested.

---

## Q. Supply chain / dependencies

Verify:

- package-lock consistency,
- production dependencies,
- unnecessary packages,
- outdated/EOL dependencies,
- install scripts,
- GitHub Actions pinning strategy,
- dependency audit policy,
- SBOM readiness,
- future Rust/WASM supply-chain boundary not yet active.

---

## R. Frontend / browser / mobile / accessibility

Verify critical journeys:

- registration/login,
- lobby/rooms,
- Checkers,
- Gomoku,
- Tysiąc views if exposed,
- private messaging,
- rankings/tournaments,
- portrait/landscape behavior,
- responsive layout,
- keyboard/focus,
- labels/contrast,
- error rendering,
- reconnect UX.

Do not claim WCAG compliance unless separately evidenced.

---

## S. SEO / domains / production assumptions

Verify code/config/documentation alignment only unless live production evidence is separately authorized and gathered:

- canonical/meta/robots/sitemap,
- noindex/indexability state,
- maintenance page,
- domain assumptions,
- DNS/Cloudflare documentation,
- no inference that prepared code equals deployed production state.

---

## T. Documentation / ADR / evidence integrity

Verify:

- docs vs source drift,
- stale SHA references,
- contradictory statuses,
- outdated PR references,
- superseded architecture claims,
- ADR status accuracy,
- Traceability Matrix completeness,
- Evidence Register claims,
- historical backfill consistency,
- AS-BUILT not declared prematurely.

---

## U. Technical debt / legacy / dead paths

Identify and classify:

- `server.js` vs `server-p7.js`,
- file/memory fallback stores,
- historical poker branches,
- stale PR branches,
- compatibility aliases,
- legacy decrypt paths,
- dead/unreachable code,
- duplicated game-runtime logic,
- code that should be TEST-ONLY or DEV-ONLY but can reach production.

Each item receives `KEEP / MIGRATE / REMOVE / DEFER / NEEDS EVIDENCE`.

---

## V. Horizontal scaling / resilience

Verify behavior with multiple instances for:

- Checkers MatchRuntime ownership,
- shared rate limiting,
- realtime notifications,
- auth sessions,
- tournaments,
- Gomoku CAS,
- Tysiąc revision behavior,
- background/lifecycle jobs,
- startup initialization,
- process crash/restart.

---

# 6. Mandatory attack/negative scenarios

At minimum audit/test evidence must cover:

- stale writes,
- duplicate requests,
- same idempotency key with different payload,
- concurrent writes from two instances,
- DB outage,
- malformed persisted state,
- invalid/unknown game ID,
- unauthorized role operation,
- missing/invalid MFA,
- replayed session/token,
- oversized/malformed message attachment,
- private-state leakage attempt,
- realtime event loss/reorder assumption,
- restore source/target identity collision,
- missing/invalid crypto config in production mode.

---

# 7. Finding format

Every Claude finding must include:

```text
ID: FULL-AUD-Fxxx
SEVERITY: CRITICAL | HIGH | MEDIUM | LOW | INFO
MERGE/RELEASE BLOCKING: YES | NO
COMPONENT:
LOCATION:
PROBLEM:
IMPACT:
EVIDENCE:
REPRODUCTION / REASONING:
RECOMMENDED CORRECTION:
```

Lead then records triage in TOM 18.

---

# 8. Final verdict vocabulary

Claude final verdict must be exactly one of:

- `FULL PROJECT AUDIT — PASS`
- `FULL PROJECT AUDIT — PASS WITH NON-BLOCKING FINDINGS`
- `FULL PROJECT AUDIT — FAIL — CORRECTION REQUIRED`

Lead may not convert Claude PASS into project closure until all evidence and scope have been independently verified.

---

# 9. Closure gate

Project technical audit may be marked closed only when:

- exact final `main` SHA/TREE recorded,
- all CRITICAL/HIGH blocking findings closed,
- all Lead-designated blocking MEDIUM findings closed,
- corrective branches tested,
- exact-head CI green,
- required PostgreSQL/concurrency/security/browser evidence green,
- Claude re-audit completed if required,
- TOM 18 has closure evidence,
- TOM 15 traceability updated,
- Evidence Register updated,
- no unresolved contradiction between docs and source.

Only then may Lead record:

`FULL PROJECT TECHNICAL AUDIT = PASS`.

---

## 10. Current state

```text
AUDIT PLAN = PREPARED
AUDIT EXECUTION = NOT STARTED
P8 / PR #43 = OPEN / CLAUDE AUDIT PENDING
POST-P8 MAIN BASELINE = NOT YET ESTABLISHED
FULL PROJECT AUDIT = HOLD UNTIL P8 CLOSED
GFPE IMPLEMENTATION = NOT AUTHORIZED
PRODUCTION = NOT CHANGED
```
