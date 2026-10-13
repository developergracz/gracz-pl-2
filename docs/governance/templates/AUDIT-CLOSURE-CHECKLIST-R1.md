# TEMPLATE — audit & closure gate FULL MAX PRO R1

## Preflight
- [ ] Re-fetched live main and all overlapping PR HEADs.
- [ ] Owner / implementer / reviewer roles documented; no self-review claim.
- [ ] Exact base SHA, final review HEAD and changed-file list recorded.
- [ ] Full scope compared with requirements and legacy/current behavior.
- [ ] No unapproved secrets / PII / production extracts in PR.

## Implementation quality
- [ ] Change log covers every runtime, SQL, frontend, CI and docs file.
- [ ] API contracts, error neutrality, permissions and cross-module regressions checked.
- [ ] Database migration collision and old/new writer compatibility checked.
- [ ] Failure recovery, idempotency, rollback and bounded resources analyzed.
- [ ] Every P0/P1 finding fixed and re-tested, or explicit justified HOLD.
- [ ] P2/P3 findings tracked with owner; no hidden acceptance.

## Evidence
- [ ] Final exact-HEAD CI results linked; all required gates PASS.
- [ ] True unit/contract/DB integration/browser tests distinguished.
- [ ] Real isolated database for database claims; no production test side effects.
- [ ] Actual browser test of changed feature; unrelated E2E not used as substitute.
- [ ] Reviewer independence, environment and test versions identified.
- [ ] Unexpected skipped tests explained.
- [ ] Negative cases, timing/abuse risk, concurrency and restart cases addressed.
- [ ] Any new code change after audit triggers fresh exact-head re-review.

## Owner gates
- [ ] Owner explicitly approves reviewed HEAD before merge, not merely a screenshot.
- [ ] Post-merge main SHA verified; docs updated to match actual merged state.
- [ ] Production preflight separately approved, including DR/restore, secrets and migration gate.
- [ ] Release verification proves deployed SHA and safe postflight.
- [ ] Dossier closure decision identifies exactly what is and is not CLOSED.
- [ ] Next stage approved separately; no implied B2 / Admin / L6 authorization.

**Unchecked required item => HOLD / NOT PROVEN.** A docs-only change may mark runtime tests N/A with a concrete reason, never PASS.
