# GRACZ.PL — FULL MAX MASTER DOCUMENTATION

**Status:** LIVING DOCUMENTATION / NOT FROZEN  
**Repository:** `developergracz/gracz-pl-2`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Production authorization:** NONE  
**Deploy authorization:** NONE

## 1. Cel

Ten pakiet jest nadrzędną, dowodową dokumentacją Gracz.pl: historia, target design, rzeczywisty AS-IS kodu, bezpieczeństwo, dane, testy, audyty, operacje, FairPlay MAX, Advanced Scalability i przyszły finalny AS-BUILT.

Dokumentacja bezwzględnie rozdziela:

- historyczny stan projektu,
- target design,
- current-main AS-IS,
- pending branch/PR delta,
- test evidence,
- independent audit evidence,
- merge state,
- production state.

Żaden dokument nie autoryzuje merge, deployu, migracji, Render/ENV/DNS/Cloudflare ani produkcji, chyba że osobny jawny mandat Ownera mówi inaczej.

## 2. Źródła prawdy

1. aktualny kod i historia Git,
2. exact PR/commit SHA/TREE i GitHub Actions,
3. MASTER docs + V3 docs,
4. zachowane raporty audytowe,
5. jawne decyzje Owner + Lead,
6. fresh production evidence dla twierdzeń produkcyjnych.

W przypadku sprzeczności wygrywa najświeższy dowód o najwyższej jakości dla danego rodzaju twierdzenia.

## 3. MASTER — governance / evidence / audit control

- `00-INDEKS-GLOWNY-FULL-MAX.md`
- `01-EVIDENCE-REGISTER.md`
- `04-IMPLEMENTATION-AUDIT-REGISTER.md`
- `15-REQUIREMENTS-TRACEABILITY-MATRIX.md`
- `17-HISTORICAL-EVIDENCE-BACKFILL-P1.md`
- `18-FINDINGS-CORRECTIONS-REMEDIATION-REGISTER.md`
- `P8-CLAUDE-INDEPENDENT-AUDIT-PACKAGE.md`
- `P8-POST-AUDIT-DECISION-TEMPLATE.md`
- `45-FULL-AUDIT-PLAN-AND-CHECKLIST.md`
- `46-FULL-AUDIT-EVIDENCE-MANIFEST.md`
- `47-ARCHITECTURE-DRIFT-AUDIT-TEMPLATE.md`
- `48-ADVANCED-SCALABILITY-CANONICAL-FINDINGS-REGISTER.md`
- `49-ADVANCED-SCALABILITY-WAVE-A-CORRECTION-MANDATE.md`

Project history/log surfaces:

- `../00B-MASTER-HISTORIA-PROJEKTU-GRACZ-PL.md`
- `../00C-DZIENNIK-KROKOW-PROJEKTU-GRACZ-PL.md`

## 4. Architecture / API / decisions

- `02-ARCHITEKTURA-MASTER.md`
- `12-ARCHITEKTURA-KOMPONENT-PO-KOMPONENCIE.md`
- `13-API-I-KONTRAKTY-SYSTEMU-MASTER.md`
- `16-ARCHITECTURE-DECISION-REGISTER-ADR-MASTER.md`
- `22-ERROR-FAILURE-CONTRACT-CATALOG.md`
- `25-STATE-MACHINE-CATALOG.md`
- `39-TECHNICAL-DEBT-LEGACY-DEAD-CODE-REGISTER.md`
- `47-ARCHITECTURE-DRIFT-AUDIT-TEMPLATE.md`
- `48-ADVANCED-SCALABILITY-CANONICAL-FINDINGS-REGISTER.md`

Historical architecture V3 remains preserved under `01-ARCHITEKTURA/`; historical AS-IS claims are superseded where later P5/P6/P7/P8 and Advanced Scalability evidence proves a newer state.

## 5. Data / PostgreSQL / concurrency

- `05-DATA-POSTGRESQL-MASTER.md`
- `14-POSTGRESQL-DATA-CATALOG-TABELA-PO-TABELI.md`
- `24-CONCURRENCY-AND-INVARIANTS-MATRIX.md`
- `48-ADVANCED-SCALABILITY-CANONICAL-FINDINGS-REGISTER.md`

Current Advanced Scalability evidence identifies 19 independent production PostgreSQL pools with a code-derived theoretical per-replica pool ceiling of 76 connections. This is a configuration ceiling, not measured steady-state usage. Production PostgreSQL `max_connections` and operational reserve remain UNKNOWN until environment evidence is collected.

## 6. Security / configuration / authorization / threats

- `03-SECURITY-AND-TRUST-MASTER.md`
- `19-ENVIRONMENT-CONFIGURATION-CATALOG.md`
- `20-SECRET-KEY-LIFECYCLE-REGISTER.md`
- `21-AUTHORIZATION-PERMISSION-MATRIX.md`
- `22-ERROR-FAILURE-CONTRACT-CATALOG.md`
- `31-THREAT-CONTROL-TEST-MATRIX.md`

These catalogs cover environment contracts, secrets/key domains, RBAC/MFA, failure semantics, threat-control-test traceability and explicit security gaps without storing secret values.

Advanced Scalability currently preserves the PostgreSQL distributed limiter as a valid fail-closed cross-node security control; replacement by Redis/local async counters is NOT authorized without benchmark evidence.

## 7. Games / MatchRuntime

- `08-GAMES-MATCHRUNTIME-MASTER.md`
- `24-CONCURRENCY-AND-INVARIANTS-MATRIX.md`
- `25-STATE-MACHINE-CATALOG.md`
- `48-ADVANCED-SCALABILITY-CANONICAL-FINDINGS-REGISTER.md`

Current distinction:

- Checkers = common MatchRuntime/P7 with PostgreSQL ownership fencing/idempotency and PG LISTEN/NOTIFY signal path,
- Gomoku = separate revision CAS/requestId path; correctness strong, current online UI polls every 1200 ms,
- Tysiąc = separate revision/expectedRevision path; durable state strong, realtime currently process-local and not multi-node complete,
- Lobby rooms/presence/invitations = process-local and not multi-node complete,
- Global Chat messages = durable in PostgreSQL, but realtime/presence currently process-local,
- P8 canonical game-type dictionary = MERGED / TECHNICALLY CLOSED.

## 8. FairPlay MAX / GFPE

- `../04-FAIRPLAY-MAX/00-GFPE-0-GFPE-1-PRE-DESIGN-WYMAGANIA-I-THREAT-MODEL.md`
- `../04-FAIRPLAY-MAX/01-GFPE-2-CRYPTOGRAPHIC-PROTOCOL-DRAFT.md`
- `../04-FAIRPLAY-MAX/02-GFPE-TEST-AND-VALIDATION-PLAN-DRAFT.md`

Status:

- GFPE-0 Requirements = PRE-DESIGN COMPLETE,
- GFPE-1 Threat Model = PRE-DESIGN COMPLETE,
- GFPE-2 Cryptographic Protocol = DRAFT CREATED / NOT FROZEN,
- GFPE Test & Validation Plan = DRAFT CREATED / NOT EXECUTED,
- GFPE implementation = NOT AUTHORIZED,
- production use = NO.

## 9. CI / quality / operations / privacy / product

- `06-CI-TEST-QUALITY-MASTER.md`
- `07-OPERATIONS-DR-OBSERVABILITY-MASTER.md`
- `09-PRODUCT-UX-SEO-DOMAINS-MASTER.md`
- `10-PRIVACY-LEGAL-GOVERNANCE-MASTER.md`
- `11-FINAL-AS-BUILT-CHECKLIST.md`
- `49-ADVANCED-SCALABILITY-WAVE-A-CORRECTION-MANDATE.md`

## 10. Current checkpoint — 09.09.2026

### P8 / P1-U-01

```text
PR #43 = MERGED
FINAL AUDITED P8 HEAD = c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f
FINAL AUDITED P8 TREE = 0ba0abce0993c145164b20f2881f118e0b71124d
MERGE COMMIT / CURRENT MAIN = 06186b4120054d177c0d3d66517edcf2de3ff857
CURRENT MAIN TREE = 0ba0abce0993c145164b20f2881f118e0b71124d
P8 TECHNICAL CLOSURE = ACHIEVED
POST-MERGE CHECKERSENGINE = PASS
POST-MERGE SECURITY GATE = PASS
DEPLOY = NO
PRODUCTION CHANGE = NO
```

### Advanced Scalability

Audit target:

```text
MAIN = 06186b4120054d177c0d3d66517edcf2de3ff857
TREE = 0ba0abce0993c145164b20f2881f118e0b71124d
```

Audit state:

```text
LEAD DEEP SCALABILITY AUDIT = MATERIAL FINDINGS / FAIL GATE
GEMINI DEEP AUDIT = USEFUL, BUT FINAL PASS VERDICT REJECTED AFTER LEAD VERIFICATION
CHATGPT-2 DEEP AUDIT = FAIL — CORRECTION REQUIRED
LEAD VERIFICATION OF CHATGPT-2 = ACCEPTED WITH SEVERITY / PRIORITY ADJUSTMENTS
CANONICAL FINDINGS REGISTER = CREATED (TOM 48)
WAVE A CORRECTION MANDATE = CREATED (TOM 49)
CLAUDE FINAL CLOSURE AUDIT = DEFERRED UNTIL CORRECTIONS + CI + BENCHMARK
NUMERIC CAPACITY = UNKNOWN
ADVANCED SCALABILITY GATE = OPEN / HOLD
```

Canonical program:

```text
Wave A: horizontal correctness / multi-node operations
-> Wave B: pre-benchmark hot paths + security/session/static/tournament correctness + observability
-> k6 + custom SSE/multi-node benchmark, 1 -> 2 -> 4 replicas
-> Wave C only where measurement justifies architecture changes
-> Claude FINAL ADVANCED SCALABILITY CLOSURE AUDIT
-> Lead final verification
-> scalability gate decision
```

### Full-project audit

`HOLD UNTIL ADVANCED SCALABILITY PROGRAM REACHES CLOSURE GATE`.

## 11. Important current gaps intentionally preserved

- Advanced Scalability findings remain OPEN until correction/test/audit closure,
- process-local Lobby state is not horizontally functional,
- Tysiąc realtime is not cross-node,
- Global Chat realtime/presence are not cross-node,
- MatchRuntime stale ownership is safely fenced but bounded recovery/routing is incomplete,
- PostgreSQL aggregate connection budget is not yet centrally governed,
- SSE admission/backpressure/drain contract incomplete,
- readiness does not yet cover all globally critical dependencies,
- runtime DDL/startup model needs multi-replica hardening,
- SecurityMonitor high-RPS complexity requires correction before serious benchmark,
- auth-session touch write amplification remains,
- static asset path is not optimized for serious public scale,
- Tournament list filtering after generic LIMIT 200 is a dataset-scale correctness defect,
- SSE authorization lifetime/revocation contract incomplete,
- PostgreSQL distributed limiter requires benchmark before any replacement decision,
- ranking all-time replay is not a long-term scale-ready read model,
- Gomoku polling cost requires benchmark-driven decision,
- no universal transactional outbox,
- Tysiąc current RNG is not GFPE/FairPlay MAX,
- complete keyId/key-ring model remains future hardening,
- final retention/legal-hold matrix incomplete,
- final SBOM/supply-chain register incomplete,
- final mobile/accessibility acceptance evidence incomplete,
- final production topology/configuration/RPO/RTO AS-BUILT absent,
- numeric capacity remains UNKNOWN until controlled load testing,
- GFPE implementation absent by design.

## 12. Update rules

After material work, update as applicable:

1. project journal,
2. Evidence Register,
3. Implementation/Audit Register,
4. Requirements Traceability Matrix,
5. ADR Register,
6. Findings/Remediation Register,
7. Advanced Scalability Canonical Findings Register,
8. Wave correction package/evidence,
9. TOM 20 for secret/key lifecycle changes,
10. TOM 22 for public/internal failure contract changes,
11. TOM 24 for concurrency invariant changes,
12. TOM 25 for lifecycle/state changes,
13. TOM 31 for threat/control/test changes,
14. TOM 39 for debt/legacy changes,
15. architecture-drift output after full audit,
16. appropriate domain tom.

## 13. Final FULL MAX condition

`FINAL / AS-BUILT` may be declared only after:

- Advanced Scalability closure,
- full-project audit complete,
- all blocking findings closed,
- final main exact SHA/TREE established,
- test/audit/benchmark evidence complete,
- authorized production deployment evidence exists,
- production configuration/topology verified,
- architecture drift resolved/documented,
- FairPlay MAX status described exactly as implemented,
- design vs implementation vs production differences explicitly resolved.

Until then:

`FULL MAX MASTER DOCUMENTATION = LIVING / NOT FROZEN`.
