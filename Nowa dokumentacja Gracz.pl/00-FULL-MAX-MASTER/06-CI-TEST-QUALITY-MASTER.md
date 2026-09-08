# GRACZ.PL — CI / TEST / QUALITY MASTER

**Status:** LIVING CONSOLIDATION

## 1. Purpose

This volume defines the evidence standard for claiming that a Gracz.pl work item is technically ready. A green single test is insufficient for cross-cutting or security-sensitive changes.

## 2. Test layers

Target quality stack:

- unit tests,
- service/integration tests,
- HTTP contract tests,
- real PostgreSQL tests,
- concurrency/race tests,
- restart/recovery tests,
- browser journeys,
- negative/security tests,
- dependency/security scans,
- property-based tests where useful,
- fuzzing for parsers/crypto/state machines where useful,
- statistical campaigns for FairPlay randomness.

## 3. Exact-head evidence

For every major closure, the documentation should capture:

- exact commit SHA,
- exact TREE SHA,
- workflow/run ID,
- job names,
- final status,
- relevant test counts,
- known warnings/non-blocking observations,
- scope exclusions.

CI from a different commit must not be used as proof for the final implementation unless equivalence is explicitly established.

## 4. Regression principle

A focused test suite proves the new contract; regression suites prove it did not break important existing behavior.

Cross-cutting work should normally include both.

## 5. P8 current recorded evidence

For P8 exact HEAD `d7220f57d60779584048cc5c695d40dbb948b9cb`, recorded CI includes:

- P8 focused contract `8/8 PASS`,
- Checkers focused `26/26`,
- Gomoku `24/24`,
- Thousand `20/20`,
- tournament concurrency `2/2`,
- P5 `14/14`,
- P6 `23/23`,
- P7 `19/19`,
- full Node suite `229/229`,
- npm audit `0 vulnerabilities`,
- browser Checkers PASS,
- browser Gomoku PASS,
- isolated PostgreSQL DR regression PASS,
- gitleaks PASS,
- CodeQL PASS.

This evidence is strong but does not replace independent code audit.

## 6. Failure semantics

Tests should verify not only success paths but also fail-closed behavior, including:

- invalid input,
- unauthorized access,
- duplicate request,
- stale version,
- stale owner/epoch,
- DB transaction failure,
- restart during lifecycle,
- malformed persisted state,
- unsupported game type/capability,
- missing cryptographic prerequisites,
- proof mismatch in future GFPE.

## 7. Browser/mobile quality

Final user-facing release evidence should include:

- desktop browser journey,
- mobile viewport,
- landscape/portrait behavior,
- reconnect flows,
- latency/error state UX,
- accessibility basics,
- no sensitive-state leakage in browser payloads.

## 8. FairPlay MAX quality stack

GFPE requires a stricter laboratory:

- deterministic test vectors,
- property tests,
- fuzzing,
- crypto primitive interoperability checks,
- rejection-sampling/bias tests,
- deck-permutation invariants,
- duplicate-card detection,
- commit/reveal mismatch tests,
- abort/replay tests,
- multi-node/fencing tests,
- restart recovery,
- proof verification tests,
- large statistical campaigns,
- independent mathematical/statistical review.

Statistical success is not a substitute for cryptographic correctness.

## 9. Quality gates

Recommended gate order for high-risk work:

```text
implementation
 -> focused tests
 -> regression tests
 -> real PostgreSQL/concurrency
 -> security/dependency scans
 -> Lead review
 -> independent audit
 -> corrections if needed
 -> rerun full gate
 -> Owner/Lead merge decision
```

## 10. Current status

```text
CI/QUALITY MASTER = LIVING
P8 CI = GREEN ON RECORDED EXACT HEAD
P8 INDEPENDENT AUDIT = PENDING
FULL PROJECT QUALITY AUDIT = NOT STARTED
GFPE TEST LAB = DESIGN ONLY / NOT IMPLEMENTED
```
