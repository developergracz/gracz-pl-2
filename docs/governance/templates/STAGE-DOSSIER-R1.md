# TEMPLATE — dossier etapu FULL MAX PRO R1

> Skopiuj do osobnego pliku dla rzeczywistego etapu; nie wypełniaj brakujących dowodów domysłami. Stan początkowy: DRAFT.

## A. Identity / authority
- ID etapu i revision: TODO
- Repo / visibility: TODO
- Owner / accountable decision: TODO
- Implementer / branch owner: TODO
- Lead Architect: TODO
- Independent reviewer (eligibility check): TODO
- Baseline: main HEAD, date, remote: TODO
- Branch / PR / issue / final HEAD / tree (**FULL SHA**, exact GitHub URLs): TODO
- Work dates and change log: TODO
- Status (human evidence lifecycle): PROPOSED | ACTIVE | IMPLEMENTED | READY_FOR_INDEPENDENT_REVIEW | REVIEW_HOLD | BLOCKED | REVIEW_PASS | READY_TO_MERGE | MERGED | CLOSED | SUPERSEDED
- Operational status, separate from lifecycle: NOT_DEPLOYED | DEPLOYED | PRODUCTION_HOLD | UNKNOWN
- Relationship to other active PRs and ownership conflict check: TODO

## B. Scope and design
- Problem and measurable acceptance criteria: TODO
- Included functionality: TODO
- Excluded functionality: TODO
- Inputs / outputs / API contracts / backward compatibility: TODO
- Data ownership, storage, migrations, retention: TODO
- ADR with options, trade-offs and adopted decision reference: TODO
- Dependencies and stop conditions: TODO

## C. Change inventory (repeat for each item)
| Requirement | File / symbol / migration | Why | Impact | Test ID | Evidence |
|---|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO | TODO |

## D. Security and privacy
- Threat model and trust boundaries: TODO
- Authentication, authorization, rate limits, abuse and failure modes: TODO
- Personal data / privacy / consent / suppression: TODO
- Credential custody (NO VALUES): TODO
- Observability without PII, redaction and retention: TODO
- Open findings P0/P1/P2/P3, assigned owner, dates and closure proof: TODO

## E. Test and audit evidence
| Test category | Exact command or CI job | Environment & version | HEAD | PASS / FAIL / SKIP | Evidence URL / reason |
|---|---|---|---|---|---|
| Unit | TODO | TODO | TODO | UNKNOWN | TODO |
| Contract | TODO | TODO | TODO | UNKNOWN | TODO |
| Integration / PostgreSQL | TODO | TODO | TODO | UNKNOWN | TODO |
| Browser / accessibility / mobile | TODO | TODO | TODO | UNKNOWN | TODO |
| Security / secrets / dependencies | TODO | TODO | TODO | UNKNOWN | TODO |
| Negative / fault injection / concurrency | TODO | TODO | TODO | UNKNOWN | TODO |

- Independent review author, exact HEAD and verdict: TODO
- Reviewer not implementer: UNKNOWN
- Evidence of red/green reproduction for corrections: TODO
- Final-head CI rerun after every change: UNKNOWN
- Work not tested / coverage limitation: TODO
- Source-drifts / superseded results: TODO
- Lost workspace / continuation recovery: refreshed main HEAD, work-item owner, PR state, new tests and missing evidence: TODO
- Evidence provenance and publication: GitHub URL or OWNER-PROVIDED / PERSISTENCE PENDING; do not call unrecorded audit closed: TODO

## F. Operations / roll-forward / rollback
- Migration slot ownership, checked conflicts: TODO
- **Pre-merge deploy coupling:** actual Render service, branch, autoDeploy, build/preDeploy command, migration invocation and pending DDL; independent read-only verification ref/date: UNKNOWN / MERGE HOLD until proven safe
- `005_*` reservation / CONTRACT collision impact: BLOCKS_MERGE where the PR can introduce it
- Database backup, isolated restore and decrypt readiness: UNKNOWN / HOLD
- Old/new writer compatibility, health probes and cutover: TODO
- Rollback and retention, failure to rollback: TODO
- Paid services, cost approval, credential rights: NOT AUTHORIZED until explicit GO
- Production deployment and post-deploy observations: NOT AUTHORIZED until explicit GO

## G. Closure decision
- Gate ID mapping (shared across projects): G0 SOURCE / G1 DESIGN / G2 IMPLEMENTATION / G3 REVIEW / G4 OWNER MERGE / G5 POST-MERGE / G6 RELEASE/PAID / G7 CLOSURE
- All required gates, with dated links: TODO
- Carried risks and successor ownership: TODO
- Recommendation: HOLD / PASS FOR REVIEW / READY_TO_MERGE / CLOSED WITH EXCLUSIONS
- Owner decision quote or reference: TODO
- Owner-authorized target HEAD: TODO
- Merge SHA / deployment SHA (if applicable): NOT EXECUTED
- Closure date and evidence canonical location: NOT CLOSED

**Guard:** A scoped CODING CLOSED can be recorded while PRODUCTION HOLD remains in force; a production-scope CLOSED requires G6 release proof. Coding complete ≠ independent PASS ≠ merge ready ≠ deployed; closure requires all DoD obligations for its stated scope.
