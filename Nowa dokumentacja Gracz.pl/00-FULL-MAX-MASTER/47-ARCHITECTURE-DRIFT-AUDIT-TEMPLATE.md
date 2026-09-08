# GRACZ.PL — ARCHITECTURE DRIFT AUDIT TEMPLATE

**Document:** TOM 47 / Architecture Drift Audit Template  
**Status:** READY FOR POST-P8 FULL AUDIT  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Current-main reference before P8 closure:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**P8 / PR #43:** OPEN / AUDIT PENDING / NOT CURRENT MAIN  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This template is the canonical method for comparing:

`HISTORICAL V3 TARGET DESIGN -> CURRENT CODE AS-IS -> CURRENT MASTER DOCS -> TEST/EVIDENCE -> ACTUAL ARCHITECTURE DECISION`

It prevents two opposite errors:

1. treating every difference from the 31.08.2026 architecture document as a defect,
2. treating every newer implementation as automatically correct merely because code changed later.

The audit must determine whether code and design are aligned, evolved intentionally, incomplete, drifting or require a new ADR.

---

## 2. Primary architecture sources

Claude/Lead should compare at minimum:

- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`
- `01-ARCHITEKTURA/03-SKONSOLIDOWANA-ARCHITEKTURA-SYSTEMOWA-GRACZ-PL-V3.md`
- `00-FULL-MAX-MASTER/02-ARCHITEKTURA-MASTER.md`
- `00-FULL-MAX-MASTER/12-ARCHITEKTURA-KOMPONENT-PO-KOMPONENCIE.md`
- `00-FULL-MAX-MASTER/13-API-I-KONTRAKTY-SYSTEMU-MASTER.md`
- `00-FULL-MAX-MASTER/16-ARCHITECTURE-DECISION-REGISTER-ADR-MASTER.md`
- `00-FULL-MAX-MASTER/19-ENVIRONMENT-CONFIGURATION-CATALOG.md`
- `00-FULL-MAX-MASTER/20-SECRET-KEY-LIFECYCLE-REGISTER.md`
- `00-FULL-MAX-MASTER/21-AUTHORIZATION-PERMISSION-MATRIX.md`
- `00-FULL-MAX-MASTER/22-ERROR-FAILURE-CONTRACT-CATALOG.md`
- `00-FULL-MAX-MASTER/24-CONCURRENCY-AND-INVARIANTS-MATRIX.md`
- `00-FULL-MAX-MASTER/25-STATE-MACHINE-CATALOG.md`
- `00-FULL-MAX-MASTER/31-THREAT-CONTROL-TEST-MATRIX.md`
- `00-FULL-MAX-MASTER/39-TECHNICAL-DEBT-LEGACY-DEAD-CODE-REGISTER.md`
- `00-FULL-MAX-MASTER/45-FULL-AUDIT-PLAN-AND-CHECKLIST.md`
- `00-FULL-MAX-MASTER/46-FULL-AUDIT-EVIDENCE-MANIFEST.md`

Historical architecture documents are evidence of design intent, not proof of current implementation.

---

## 3. Required classification vocabulary

Every reviewed architecture claim must receive exactly one primary classification:

### `ALIGNED`

Current code implements the design intent without material drift.

### `IMPLEMENTED BEYOND OLD AS-IS`

The historical architecture document's AS-IS statement is obsolete because later authorized work improved the implementation in the intended direction.

Example candidate: common MatchRuntime after P7.

### `TARGET NOT YET IMPLEMENTED`

The design remains valid, but current code has not yet reached it.

Example candidates may include universal transactional outbox, final service separation or complete GFPE.

### `ARCHITECTURE DRIFT`

Current implementation materially differs from an important design invariant without an established superseding decision.

This requires finding/ADR analysis; it is not automatically a code bug.

### `INTENTIONAL DIVERGENCE / SUPERSEDED DESIGN`

The old design should no longer be treated as target because a later validated decision replaced it.

A new ADR or explicit superseding evidence is required.

### `LEGACY / COMPATIBILITY`

The code remains intentionally for migration/backward compatibility and is not the preferred new-write path.

### `DEAD / REMOVE CANDIDATE`

The path appears non-authoritative or unreachable and may be removable after proof.

### `REQUIRES ADR`

Evidence is insufficient to decide whether code or old design should win; explicit architecture decision required.

### `PRODUCTION EVIDENCE REQUIRED`

Repo/design state is known but production topology/configuration claim cannot be made without fresh production readback.

---

## 4. Required audit record per architecture topic

For every material topic, produce:

```text
ARCH-ID:
TOPIC:
HISTORICAL DESIGN SOURCE:
HISTORICAL CLAIM:
HISTORICAL CLASSIFICATION (AS-IS/TARGET):
CURRENT MAIN SHA/TREE:
CURRENT CODE SOURCES:
CURRENT TEST/EVIDENCE:
CURRENT MASTER DOCS:
OBSERVED CURRENT BEHAVIOR:
CLASSIFICATION:
SECURITY IMPACT:
CONCURRENCY IMPACT:
SCALING IMPACT:
OPERATIONS IMPACT:
DATA/PRIVACY IMPACT:
REQUIRES CODE CHANGE: YES/NO/UNKNOWN
REQUIRES DOC CHANGE: YES/NO
REQUIRES ADR: YES/NO
MERGE BLOCKING: YES/NO
FINDING ID IF ANY:
RECOMMENDED FINAL BASELINE WORDING:
```

---

## 5. Mandatory architecture domains

### A. Composition model

Check whether current modular-monolith/runtime composition remains appropriate and whether any physical service separation is actually required now.

### B. PostgreSQL authority

Verify PostgreSQL remains authoritative where durability/scaling requires it and identify unsafe memory/file downgrade paths.

### C. MatchRuntime

Compare the old statement `common Match Runtime not implemented` with current P7 code and evidence. Determine exact scope implemented vs still game-specific.

### D. Concurrency model

Compare target CAS/fencing/idempotency with actual Checkers, Gomoku, Tysiąc and tournaments.

### E. Realtime

Compare old local-only/backplane claims with P6/current PostgreSQL realtime hub and any remaining process-local state.

### F. Event/outbox architecture

Determine which side effects remain request-path/best-effort and whether universal outbox remains necessary target architecture.

### G. Auth/session/RBAC/MFA

Compare target identity boundaries with actual persistent session, role, MFA and privileged access design.

### H. Cryptography/key separation

Verify the later dedicated-key implementation against the older architecture security intent; classify legacy decrypt bridges separately.

### I. Games platform

Compare game engines and adapters with target common platform boundaries.

### J. Canonical game identifiers

Audit only after P8 is formally closed/merged. Before that, classify PR #43 as pending delta, not current architecture.

### K. DR / backup / recovery

Compare older target recovery design with P1-R-01 implemented/tested scope and remaining production RPO/RTO evidence gaps.

### L. Observability

Check audit, health/readiness, security monitoring, logs/metrics and remaining SLO/tracing gaps.

### M. External providers

Check Turnstile/mail/webhook/provider calls against adapter/failure-isolation target design.

### N. Scaling

Determine whether current modular monolith plus shared PostgreSQL controls can scale safely before any microservice split; reject microservice creation without evidence-based need.

### O. FairPlay MAX boundary

Confirm GFPE remains a future architecture layer and is not falsely described as implemented.

### P. Production topology

Repo target vs actual production must remain separate until fresh production evidence exists.

---

## 6. Known historical AS-IS statements that require explicit re-check

The 31.08.2026 consolidated architecture records historical AS-IS observations including:

- no full shared realtime backplane,
- no common MatchRuntime,
- insufficient single-writer guarantees,
- incomplete CAS coverage,
- process-local/transient state limitations,
- missing universal outbox/workers.

The audit must not copy these forward without re-verification.

Some are expected to classify as `IMPLEMENTED BEYOND OLD AS-IS` after P5/P6/P7/DR, while others may remain `TARGET NOT YET IMPLEMENTED` or `PARTIAL`.

---

## 7. Architecture drift severity

Architecture drift severity is independent of code-finding severity.

- `A0 — INFORMATIONAL`: documentation stale only; code is aligned/evolved safely.
- `A1 — LOW`: minor inconsistency with limited operational impact.
- `A2 — MEDIUM`: material divergence requiring ADR or bounded correction.
- `A3 — HIGH`: divergence threatens security, authoritative state, concurrency, privacy, recoverability or scaling.
- `A4 — CRITICAL`: architecture allows direct integrity/security compromise or unrecoverable authoritative inconsistency.

Any A3/A4 should normally become a `FULL-AUD-Fxxx` candidate in TOM 18 after Lead verification.

---

## 8. Rules for deciding whether code or document should change

Prefer **documentation update** when:

- later implementation fulfills original intent more strongly,
- the historical AS-IS is merely stale,
- later ADR/evidence intentionally supersedes old wording.

Prefer **code correction** when:

- current implementation violates an active security/concurrency/privacy invariant,
- divergence is accidental or undocumented,
- code creates fail-open behavior against approved architecture.

Require **ADR first** when:

- both options are defensible,
- cost/scaling/operational tradeoff is material,
- target design itself may need revision.

Never patch code merely to make it look like an old diagram.

---

## 9. Required final output from architecture-drift phase

Claude/Lead should produce:

1. architecture-domain summary table,
2. stale historical claims list,
3. current aligned/evolved areas,
4. real architecture drift findings,
5. target-not-yet-implemented list,
6. ADR-required decisions,
7. dead/legacy/remove candidates,
8. production-evidence-required items,
9. exact list of documentation to update,
10. recommendation for new post-audit architecture baseline.

---

## 10. Post-audit baseline rule

Do **not** overwrite the 31.08.2026 V3 design baseline.

After:

- P8 closure,
- full-project audit,
- blocking remediation,
- final main SHA/TREE verification,

create a new document such as:

`GRACZ.PL ARCHITECTURE BASELINE 2.0 — POST FULL AUDIT`

It must include:

- exact main SHA/TREE,
- audit report identity,
- closed architecture findings,
- active AS-IS architecture,
- remaining TARGET DESIGN,
- superseded decisions,
- production-evidence boundary.

Historical documents remain immutable evidence of evolution.

---

## 11. Governance

This template authorizes no implementation, merge, deploy, migration, architecture redesign or production change.

Architecture findings enter TOM 18 before correction mandates.

---

## 12. Current status

`TOM 47 = READY FOR POST-P8 FULL AUDIT`.