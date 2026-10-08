# A1 — Governance reconciliation (documentation proposal)

Date: 2026-10-08  
Status: **PROPOSED / NOT BINDING / DOCS-ONLY**  
Repository: `developergracz/gracz-pl-2`  
Audited base `main`: `bfc5b8d8d4b07e18da26768dda84b978d1237d6f`

## Scope and authority

This note reconciles the two October 8 architecture and execution ZIP proposals (39 and 62 files) with existing project practice. It does **not** adopt those ZIPs wholesale, create a new superior governance hierarchy, or authorize implementation, deployment, DB changes, or spending. The authoritative snapshot must be refreshed before merge.

## Confirmed findings to reconcile

| Topic | Disposition | Next gate |
|---|---|---|
| Exact commit SHA, independent evidence, fail-closed review | KEEP | Scope-specific audit |
| ZIP `main=e9d5…` | HISTORICAL | Record live SHA per review |
| Contact encryption key escrow marked UNKNOWN in ZIP | SUPERSEDED by Owner-reported PASS | Keep provenance, never store secret value |
| Production `main` ruleset | Snapshot stale; A0 reports active protection, PR requirement and `codeql`, `node-security`, `secrets` checks | Recheck settings at merge |
| `README.md` mentions Jenkins, OpenVPN, `master`, no PR for solo developer | OBSOLETE DEPLOYMENT GUIDANCE | Separate, carefully reviewed README PR/update; do not erase historical architecture |
| PostgreSQL Free, no proven PITR/restore | HOLD on backfill, migration 005 and destructive changes | Owner-approved recovery plan, export and restore rehearsal |
| Resend delivery webhook coverage | DESIGN GAP | Dedicated security-reviewed design, not runtime work in A1 |
| Legacy/draft open PR inventory | NEEDS REVIEW | Classify ownership, exact head, touched files and collision risk; no automatic closure |
| GitHub Actions references pinned to tags | IMPROVEMENT PROPOSAL | Separate supply-chain PR and CI review |

## Proposed documentary update (separate scope)

1. Correct `README.md` to distinguish the **current** GitHub `main` + Render deployment from **historical** Jenkins/OpenVPN instructions, after verifying the exact deployed services and production workflow.
2. Provide an operator-friendly authority map and state transitions: `READY_FOR_REVIEW`, `READY_TO_MERGE`, `DEPLOYED`, `CLOSED` are **distinct** and must not be inferred from a green CI badge.
3. Map current checks, review requirements, owners and any accepted exceptions to evidenced settings. Do not claim a mandatory approving review where the ruleset does not require one.
4. Keep CODEOWNERS and protection-rule changes out of this documentation-only PR. Such changes need separate ownership/security approval.

## STOP / acceptance

Stop on changed base or unreviewed overlap; no changing code, workflows, runtime, DNS, Render, secrets, consent, contact/newsletter flows, database or cost. This note cannot authorize any production action. Review the exact diff and current GitHub configuration before merge. **Merge requires a separate explicit Owner GO.**
