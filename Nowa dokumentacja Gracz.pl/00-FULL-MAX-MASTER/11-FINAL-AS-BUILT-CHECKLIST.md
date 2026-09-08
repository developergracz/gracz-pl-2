# GRACZ.PL — FINAL AS-BUILT CHECKLIST

**Status:** TEMPLATE / NOT READY FOR SIGN-OFF

This document is intentionally incomplete. It defines what must be proven before the Gracz.pl master documentation can be frozen as final AS-BUILT.

## 1. Source baseline

- [ ] final `main` commit SHA recorded
- [ ] final TREE SHA recorded
- [ ] release tag/version recorded
- [ ] all intended PRs merged
- [ ] stale/historical PRs classified
- [ ] no undocumented hotfix exists outside source control

## 2. Architecture

- [ ] system diagram matches deployed reality
- [ ] service boundaries verified
- [ ] MatchRuntime usage verified
- [ ] game adapters verified
- [ ] realtime authority model verified
- [ ] horizontal scaling model verified
- [ ] FairPlay/GFPE boundary verified if implemented

## 3. PostgreSQL / data

- [ ] production schema version verified
- [ ] migrations reconciled
- [ ] constraints/indexes documented
- [ ] DB roles/permissions verified
- [ ] backup schedule verified
- [ ] restore evidence current
- [ ] RPO/RTO measured or explicitly classified as target-only
- [ ] privacy/retention behavior verified

## 4. Security

- [ ] auth/session controls verified
- [ ] RBAC/MFA findings closed or accepted explicitly
- [ ] secrets separated
- [ ] secret rotation plan exists
- [ ] CodeQL final run PASS
- [ ] gitleaks final run PASS
- [ ] dependency audit final run PASS
- [ ] threat models current
- [ ] no unresolved blocking security finding

## 5. Games

For each production game:

- [ ] rules version recorded
- [ ] state machine documented
- [ ] persistence documented
- [ ] reconnect/restart tested
- [ ] concurrency tested
- [ ] private projection tested
- [ ] browser/mobile journey tested
- [ ] game-specific known limitations recorded

## 6. FairPlay MAX / GFPE

If deployed:

- [ ] protocol version frozen
- [ ] crypto primitives frozen and documented
- [ ] deterministic test vectors PASS
- [ ] commit/reveal tests PASS
- [ ] shuffle uniformity implementation reviewed
- [ ] proof format frozen
- [ ] key lifecycle documented
- [ ] restart/multi-node tests PASS
- [ ] Claude independent audit PASS
- [ ] Gemini statistical review PASS where required
- [ ] Lead final verification PASS
- [ ] public claims match actual capabilities

## 7. CI / quality

- [ ] exact-release CI PASS
- [ ] unit/integration suites PASS
- [ ] PostgreSQL suites PASS
- [ ] concurrency suites PASS
- [ ] browser suites PASS
- [ ] mobile/responsive evidence PASS
- [ ] failure-path tests PASS
- [ ] known non-blocking warnings documented

## 8. Operations

- [ ] production topology recorded
- [ ] deployment runbook verified
- [ ] rollback runbook verified
- [ ] health/readiness verified
- [ ] logs/metrics/alerts verified
- [ ] incident contacts/ownership recorded
- [ ] backup/restore runbook verified
- [ ] domain/TLS/DNS configuration verified

## 9. Product / UX / SEO

- [ ] primary user journeys verified
- [ ] login/registration verified
- [ ] rooms/players/invitations verified
- [ ] profile/messaging verified if in release
- [ ] mobile portrait/landscape verified
- [ ] accessibility review completed
- [ ] SEO metadata reflects intended indexing state
- [ ] sitemap/robots verified
- [ ] domain canonicalization verified

## 10. Privacy / legal / governance

- [ ] open Privacy/Legal P1 resolved or explicitly accepted by authorized decision
- [ ] retention/deletion behavior verified
- [ ] legal-hold behavior verified where applicable
- [ ] Owner production authorization recorded
- [ ] audit provenance complete
- [ ] marketing claims reviewed for factual accuracy

## 11. Final evidence package

- [ ] Evidence Register complete
- [ ] Implementation & Audit Register complete
- [ ] changelog/release history complete
- [ ] all blocking findings closed
- [ ] final independent full-project re-audit PASS
- [ ] final Lead PASS
- [ ] Owner sign-off recorded

## 12. Final status block

Do not fill until all applicable gates are evidenced.

```text
GRACZ.PL MASTER DOCUMENTATION = NOT YET FINAL
FINAL AS-BUILT = NOT YET AUTHORIZED
PRODUCTION CERTIFICATION BY THIS DOCUMENT = NONE
```
