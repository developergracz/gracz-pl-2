# TEMPLATE — audit & closure gate FULL MAX PRO R1

## Preflight
- [ ] Re-fetched live main and all overlapping PR HEADs.
- [ ] Owner / implementer / reviewer roles documented; no self-review claim.
- [ ] Exact base SHA, final review HEAD and changed-file list recorded.
- [ ] Full scope compared with requirements and legacy/current behavior.
- [ ] No secrets, credentials, subscriber PII, tokens, production extracts or protected backups in public PR **even if an individual offered approval**. Redacted metadata only.

## Implementation quality
- [ ] Change log covers every runtime, SQL, frontend, CI and docs file.
- [ ] API contracts, error neutrality, permissions and cross-module regressions checked.
- [ ] Database migration collision and old/new writer compatibility checked; slot 005 / protected migrations **BLOCKS_MERGE** until reconciled.
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
- [ ] Read-only live evidence of affected service(s): branch tracking, autoDeploy on/off, effective build/preDeploy command, migration runner, pending DDL, production/writer impact. If the merge could trigger unapproved DDL and any material coupling is unknown, **MERGE HOLD**.
- [ ] Owner explicitly approves reviewed HEAD before merge, not merely a screenshot.
- [ ] Post-merge main SHA verified; required push CI and actual integration behavior checked. Distinguish PR review tree from merge tree when `main` has moved; no false byte-identical claim.
- [ ] Docs/CPAED status updated where applicable, preserving prior historical records.
- [ ] Production preflight separately approved, including DR/restore, secrets and migration gate.
- [ ] Release verification proves deployed SHA and safe postflight.
- [ ] Dossier closure decision identifies exactly what is and is not CLOSED; CODING CLOSED does not imply DEPLOYED. Required G5 POST-MERGE and G6 RELEASE are tracked separately.
- [ ] Next stage approved separately; no implied B2 / Admin / L6 authorization.

**G0 SOURCE → G1 DESIGN → G2 IMPLEMENTATION → G3 INDEPENDENT REVIEW → G4 OWNER MERGE → G5 POST-MERGE → G6 RELEASE/PAID → G7 CLOSURE** are the shared names for both repos, not new machine-authority states.

**Unchecked required item => HOLD / NOT PROVEN.** A docs-only change may mark runtime tests N/A with a concrete reason, never PASS.
