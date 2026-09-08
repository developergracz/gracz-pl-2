# GRACZ.PL — FULL PROJECT AUDIT — EVIDENCE MANIFEST

**Document:** TOM 46 / Full Audit Evidence Manifest  
**Status:** PREPARED / HOLD UNTIL P8 FORMALLY CLOSED  
**Repository:** `developergracz/gracz-pl-2`  
**Current-main reference at preparation:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Prepared for:** Lead + Claude post-P8 full-project audit  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

TOM 45 defines **what must be audited**. This manifest defines **where the primary evidence is located**.

For each audit domain it maps:

`DOMAIN -> SOURCE CODE -> DATA/API -> TESTS -> HISTORICAL PR/EVIDENCE -> MASTER DOCS -> EXPECTED AUDIT OUTPUT`

The manifest is a navigation aid, not a substitute for repository inspection. Claude and Lead must inspect surrounding code, test implementation and real Git history rather than accepting document claims at face value.

---

## 2. Evidence hierarchy

Preferred evidence order:

1. exact source at audited main SHA/TREE,
2. exact migrations/schema and runtime wiring,
3. exact tests,
4. exact-head CI/workflow runs,
5. PR diff/history and audit findings,
6. MASTER documentation,
7. production evidence where a production claim is made.

If documentation conflicts with code, the discrepancy becomes an audit finding; documentation does not override runtime reality.

---

# 3. CORE RUNTIME / ARCHITECTURE

| Audit domain | Primary source | Test/evidence | Historical work | MASTER references | Audit focus |
|---|---|---|---|---|---|
| Application composition | `modern/checkers-engine/src/main.js` | runtime wiring tests, browser suites | P5/P6/P7 | TOM 02, 12, 13, 15, 16 | dependency wiring, fallback modes, startup/shutdown, trust boundaries |
| Main HTTP runtime | `src/server-p7.js`, `src/server.js` | HTTP/security/regression tests | P7 | TOM 12, 13, 16 | active vs legacy path, duplicated routing, stale code |
| Configuration | `src/config.js`, `.env.example` | config/security tests | PR #36 | TOM 03, 19 | fail-closed secrets, environment differences, undeclared env usage |
| Health/readiness | `src/health.js` | P5 readiness tests | PR #38 | TOM 07, 15, 17, 45 | liveness vs readiness, DB dependency semantics |

---

# 4. MATCHRUNTIME / CHECKERS

| Domain | Source | Tests | Evidence | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| MatchRuntime core | `src/match-runtime.js` | `p1-u-02-match-runtime-postgres.test.js`, P7 focused tests | PR #40 / Claude PASS | TOM 08, 15, 16, 18, 24 | CAS, fencing, idempotency, persistence-before-publish |
| PostgreSQL session runtime | `src/postgres-session-store.js` | P1-C-01 + P7 PostgreSQL tests | PR #29 + #40 | TOM 05, 14, 17, 24 | expectedVersion, ownershipEpoch, command replay, restart |
| Checkers engine | `src/index.js` | `checkers-engine.test.js` | repeated regression | TOM 08, 15 | legal rules, forced capture, draw semantics, state integrity |
| Checkers adapter | `src/checkers-match-runtime-adapter.js` | P7 adapter/projection tests | PR #40 | TOM 08, 15 | pure transition vs runtime policy, projection fail-closed |
| Checkers move HTTP | `src/server-p7.js` | P1-C-01 HTTP + P7 slice tests | PR #29/#40 | TOM 13, 24 | idempotency key derivation, conflict response, private state |
| Legacy Checkers paths | `src/server.js`, session/chat/action paths | regressions | pre/P7 history | TOM 12, 39 future debt register | partial cutover, duplicated concurrency semantics |

---

# 5. GOMOKU

| Domain | Source | Tests | Evidence | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| Domain service | `src/gomoku-service.js` | Gomoku unit/multiplayer tests | current-main | TOM 08, 15 | pure rules, move history, idempotent replay semantics |
| PostgreSQL service | `src/postgres-gomoku-service.js` | `p1-aud3-04-gomoku-postgres.test.js` | PR #37 | TOM 14, 17, 24 | schema fail-closed, revision CAS, restart recovery |
| HTTP | `src/gomoku-http.js` | `p1-aud3-04-gomoku-http-concurrency.test.js` | PR #37 | TOM 13, 15 | conflict mapping, auth, retry semantics |

---

# 6. TYSIĄC

| Domain | Source | Tests | Evidence | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| Engine | `src/thousand-engine.js` | `thousand-engine.test.js` | current-main | TOM 08, 15 | rule correctness, hidden information, current RNG boundary |
| Service | `src/thousand-service.js` | `thousand-service.test.js` | current-main/P8 regression | TOM 08, 13, 15 | projection, revision handling, command semantics |
| Repository | `src/thousand-repository.js` | repository/service tests | current-main | TOM 14, 24 | CAS, persistence, restart behavior |
| HTTP | `src/thousand-http.js` | service/HTTP tests | current-main | TOM 13 | auth, expectedRevision, viewer projection |
| Realtime | `src/thousand-realtime.js` | service/realtime tests where present | current-main | TOM 13, 23 future | signal vs state exposure |
| RNG boundary | current `ThousandGameService` / engine | current tests | current-main | GFPE docs | explicitly not FairPlay MAX; ensure future `NO FAIRPLAY = NO DEAL` migration boundary |

---

# 7. CANONICAL GAME TYPES / P8

P8 is not part of current main until formally merged.

Primary P8 evidence:

- PR #43,
- `src/game-types.js`,
- `src/lobby.js`,
- `src/platform-lobby-http.js`,
- `src/rankings.js`,
- `src/tournaments.js`,
- `test/p1-u-01-game-types-p8.test.js`,
- `.github/workflows/p1-u-01-p8.yml`,
- final CI `34147638975`,
- `P8-CLAUDE-INDEPENDENT-AUDIT-PACKAGE.md`.

After merge, the full audit must use the actual post-merge main SHA/TREE, not the preparation baseline written in this manifest.

---

# 8. AUTH / ACCOUNTS / SESSIONS

| Domain | Source | Data | Tests/evidence | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| Authentication | `src/auth.js` | auth token/session boundaries | auth tests | TOM 03, 13, 15 | token integrity, expiry, cookie semantics |
| Auth sessions | `src/auth-sessions.js` | `gracz_auth_sessions` | session tests | TOM 14, 19 | server-side revocation, restart, race behavior |
| Account storage | `src/postgres-accounts.js`, `src/accounts.js` | account/recovery/message tables | account tests | TOM 14 | password storage, PII, fallback modes |
| Secure accounts | `src/secure-accounts.js` | verification/reset data | security tests | TOM 03, 15 | password hashing, reset/recovery, enumeration |
| Recovery | `src/account-recovery-handler.js` | reset tokens/auth sessions | recovery tests | TOM 13 | session revocation and anti-abuse |

---

# 9. RBAC / MFA / PRIVILEGED OPERATIONS

| Domain | Source | Data/API | Tests/evidence | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| RBAC | `src/rbac-service.js` | `gracz_roles`, `gracz_role_history` | security tests | TOM 19, 21, 24 | hierarchy, self-change, owner assignment, transaction semantics |
| MFA | `src/mfa-service.js` | `gracz_mfa` | MFA/crypto tests | TOM 03, 21 | secret encryption, replay/window, enable/verify flows |
| Privileged wrapper | `src/privileged-auth-wrapper.js` | sensitive account operations | security tests | TOM 21 | consistent MFA enforcement |
| Admin security handler | `src/admin-security-handler.js` | `/admin/security/*` | admin tests | TOM 13, 21 | auth + same-origin + RBAC + MFA + audit |
| Newsletter admin | `src/newsletter-admin-handler.js`, service | `/admin/newsletter/*` | newsletter admin tests | TOM 13, 21 | sensitive email reveal, MFA, rate limits, audit |

P1-B-01 must be specifically reassessed during the full audit rather than presumed closed.

---

# 10. CRYPTO / SECRETS / PRIVATE MESSAGING

| Domain | Source | Data | Historical evidence | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| Crypto separation | `src/config.js` and consumers | env secret domains | PR #36 | TOM 03, 17, 19 | no AUTH/MFA/message/attachment key reuse |
| Private messages | `src/postgres-accounts.js` | `gracz_messages` | PR #36/current tests | TOM 14, 15 | AEAD, nonce/tag handling, legacy fallback scope |
| Attachments | `src/message-attachments.js` | `gracz_message_attachments` | current tests | TOM 14, 15 | validation, encrypted blob access, authz |
| Audit sanitization | `src/audit-service.js` | `gracz_audit_log` | security tests | TOM 03, 14 | secret/PII redaction, append-only properties |

---

# 11. RATE LIMITING / REALTIME / ABUSE

| Domain | Source | Tests/evidence | Historical work | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| Local traffic guard | `src/traffic-guard.js` | P6-F01 tests | PR #39 | TOM 18, 24 | local-first behavior, memory abuse |
| Shared rate limiting | `src/distributed-infrastructure.js` | P6 tests | PR #39 | TOM 14, 17, 24 | cross-node limits, fail-closed DB dependency |
| Production composition | `src/production-rate-limit.js`, `main.js` | P6 runtime contract | PR #39 | TOM 18 | ordering and health bypass |
| PostgreSQL realtime | `src/distributed-infrastructure.js` | P6 tests | PR #39 | TOM 08, 13 | event allowlist, payload bounds, non-authoritative semantics |
| Security monitor | `src/security-monitor.js` | security tests | current-main | TOM 03, 07 | event aggregation/alerting and false assumptions |
| Moderation | `src/moderation-service.js` | moderation tests | current-main | TOM 03, 14 | bypass, appeals, persistence, authorization |

---

# 12. TOURNAMENTS / RANKINGS / LOBBY

| Domain | Source | Data/tests | Evidence | MASTER refs | Audit focus |
|---|---|---|---|---|---|
| Tournaments | `src/tournaments.js` | tournament tables + P1-H-01 test | PR #30 | TOM 13, 17, 24 | `FOR UPDATE`, duplicate result, standings, P8 identity integration |
| Rankings | `src/rankings.js` | computed ranking queries/tests | P8 pending | TOM 13, 15 | invalid selector behavior, canonical game IDs |
| Lobby | `src/lobby.js`, `src/platform-lobby-http.js` | room/session state tests | P8 pending | TOM 13, 15 | identity from auth session, game dispatch, room lifecycle |

---

# 13. NEWSLETTER / MAIL / EXTERNAL SECURITY CONTROLS

| Domain | Source | Data/config | MASTER refs | Audit focus |
|---|---|---|---|---|
| Newsletter public | `src/newsletter.js` | newsletter tables | TOM 13, 14 | double opt-in, anti-enumeration, token hashing |
| Mail | `src/secure-mail-service.js` | `RESEND_API_KEY`, `EMAIL_FROM` | TOM 19 | fail-closed provider behavior, logging/PII |
| Lifecycle/analytics | newsletter lifecycle/analytics modules | lifecycle tables | TOM 14 | purpose limitation, retention |
| Turnstile/security | security service + public handlers | Turnstile env | TOM 19 | production hostname, proxy/header trust, bypass controls |

---

# 14. POSTGRESQL / DATA MODEL

Primary evidence:

- current migrations/schema sources,
- runtime table initialization where still used,
- `05-DATA-POSTGRESQL-MASTER.md`,
- `14-POSTGRESQL-DATA-CATALOG-TABELA-PO-TABELI.md`,
- `24-CONCURRENCY-AND-INVARIANTS-MATRIX.md`.

Audit each active table for:

- owner/domain,
- PK/FK/UNIQUE/CHECK,
- indexes,
- application-only integrity gaps,
- transaction boundaries,
- PII/secret classification,
- retention/deletion,
- backup consequences,
- migration provenance,
- horizontal-scaling safety.

The current catalog inventory contains 30 verified current-main PostgreSQL tables/structures at the preparation baseline. Recount against the actual post-P8 audit main.

---

# 15. DR / OPERATIONS

Primary source/evidence:

- `ops/backup-postgres.sh`
- `ops/test-restore-postgres.sh`
- `ops/dr-restore-rehearsal.sh`
- `ops/test-dr-restore-program.sh`
- `ops/DR-RESTORE-RUNBOOK.md`
- PR #41 / merge `b276c923...`
- CI `34053197756`
- TOM 07 / TOM 17 / TOM 45.

Audit:

- encrypted backup,
- key handling,
- checksums,
- isolated target identity,
- source read-only behavior,
- disposable target marker,
- reconciliation,
- redacted evidence,
- scheduled synthetic rehearsal,
- production-vs-test assumptions,
- actual production RPO/RTO remains unproven until measured.

---

# 16. CI / SUPPLY CHAIN

Primary evidence:

- `.github/workflows/*`,
- `package.json` / lockfile,
- CodeQL,
- gitleaks,
- npm audit,
- Node 24 runtime,
- Playwright browser tests.

Audit:

- exact-head binding,
- workflow permissions,
- action pinning/versioning,
- secret exposure,
- dependency lifecycle,
- reproducibility,
- missing SBOM/release evidence,
- false-green paths caused by optional environment fallbacks.

---

# 17. FRONTEND / PRODUCT / ACCESSIBILITY

Primary sources:

- `modern/checkers-engine/web/` including lobby, games, chat, messages, profile, ranking, tournaments, legal/privacy pages,
- browser tests,
- TOM 09 / TOM 13 / TOM 45.

Audit:

- auth/user-identity display,
- private data leakage,
- DOM injection/XSS risks,
- CSP compatibility,
- responsive portrait/landscape behavior,
- keyboard/focus/labels,
- error states,
- reconnect UX,
- stale UI state after conflicts.

Do not claim WCAG conformance without a dedicated verified accessibility audit.

---

# 18. DOCUMENTATION / GOVERNANCE

Primary MASTER docs:

- `00-INDEKS-GLOWNY-FULL-MAX.md`
- `01-EVIDENCE-REGISTER.md`
- `02-ARCHITEKTURA-MASTER.md`
- `03-SECURITY-AND-TRUST-MASTER.md`
- `04-IMPLEMENTATION-AUDIT-REGISTER.md`
- `05-DATA-POSTGRESQL-MASTER.md`
- `06-CI-TEST-QUALITY-MASTER.md`
- `07-OPERATIONS-DR-OBSERVABILITY-MASTER.md`
- `08-GAMES-MATCHRUNTIME-MASTER.md`
- `09-PRODUCT-UX-SEO-DOMAINS-MASTER.md`
- `10-PRIVACY-LEGAL-GOVERNANCE-MASTER.md`
- `11-FINAL-AS-BUILT-CHECKLIST.md`
- `12-ARCHITEKTURA-KOMPONENT-PO-KOMPONENCIE.md`
- `13-API-I-KONTRAKTY-SYSTEMU-MASTER.md`
- `14-POSTGRESQL-DATA-CATALOG-TABELA-PO-TABELI.md`
- `15-REQUIREMENTS-TRACEABILITY-MATRIX.md`
- `16-ARCHITECTURE-DECISION-REGISTER-ADR-MASTER.md`
- `17-HISTORICAL-EVIDENCE-BACKFILL-P1.md`
- `18-FINDINGS-CORRECTIONS-REMEDIATION-REGISTER.md`
- `19-ENVIRONMENT-CONFIGURATION-CATALOG.md`
- `21-AUTHORIZATION-PERMISSION-MATRIX.md`
- `24-CONCURRENCY-AND-INVARIANTS-MATRIX.md`
- `31-THREAT-CONTROL-TEST-MATRIX.md`
- `45-FULL-AUDIT-PLAN-AND-CHECKLIST.md`
- this TOM 46.

Audit must explicitly flag `design != implementation`, `implementation != merged`, and `merged != deployed` mismatches.

---

# 19. FAIRPLAY MAX — AUDIT BOUNDARY

FairPlay MAX is **not** part of the current production/runtime audit as an implemented subsystem.

Available design-only evidence:

- `04-FAIRPLAY-MAX/00-GFPE-0-GFPE-1-PRE-DESIGN-WYMAGANIA-I-THREAT-MODEL.md`
- `04-FAIRPLAY-MAX/01-GFPE-2-CRYPTOGRAPHIC-PROTOCOL-DRAFT.md`
- `04-FAIRPLAY-MAX/02-GFPE-TEST-AND-VALIDATION-PLAN-DRAFT.md`

Status remains:

`PRE-DESIGN / DRAFT / NOT FROZEN / IMPLEMENTATION NOT AUTHORIZED`.

The full current-main audit may assess whether the existing architecture is a safe foundation for future GFPE integration, but it must not treat GFPE design claims as implemented controls.

---

# 20. Audit completion evidence

The full audit is not complete until:

1. audited main SHA/TREE recorded,
2. all TOM 45 domains checked,
3. each material finding entered in TOM 18 as `FULL-AUD-Fxxx`,
4. Lead verifies each finding independently,
5. correction plan is created only for accepted findings,
6. blocking findings are closed with exact fix evidence and required re-audit,
7. final re-audit confirms no blocking findings remain,
8. only then can Lead recommend `FULL PROJECT TECHNICAL AUDIT = PASS`.

No audit document authorizes production release.