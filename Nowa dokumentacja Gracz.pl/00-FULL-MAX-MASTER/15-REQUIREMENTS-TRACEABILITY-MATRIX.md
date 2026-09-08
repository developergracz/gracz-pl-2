# GRACZ.PL — REQUIREMENTS → CODE → TEST → EVIDENCE TRACEABILITY MATRIX

**Document:** TOM 15 / Requirements Traceability  
**Status:** LIVING DOCUMENTATION / EVIDENCE-BASED / NOT FROZEN  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Verified current-main baseline:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Verified current-main TREE:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**P8 / PR #43:** OPEN / NOT MERGED / independent Claude audit pending  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This matrix is the canonical traceability layer between Gracz.pl requirements, architectural decisions, implementation, database structures, API contracts, automated tests, CI evidence, independent audit evidence and closure state.

The purpose is to answer, for every important requirement:

1. where the requirement came from,
2. which component implements it,
3. which API/table/state boundary it affects,
4. which test proves the intended contract,
5. which exact-head CI/audit evidence exists,
6. whether the requirement is implemented, audited, merged, deployed or only planned,
7. what evidence is still missing.

This matrix does **not** replace source code, tests, PRs, audit reports, detailed architecture documents or the Evidence Register. It cross-links them.

Historical P1 exact evidence for PR #29/#30/#36/#37/#38/#39 is canonically reconstructed in `17-HISTORICAL-EVIDENCE-BACKFILL-P1.md` and should be used instead of generic `historical closed` wording.

---

## 2. Status vocabulary

- `CLOSED` — requirement satisfied for the defined technical scope and formally closed.
- `MERGED / CLOSED` — implementation and required audit/merge gates completed for the defined scope.
- `IMPLEMENTED / AUDIT PENDING` — code exists on controlled branch but final independent audit/merge closure is incomplete.
- `CURRENT-MAIN VERIFIED` — behavior confirmed in source on the stated main baseline; does not imply production deployment.
- `PARTIAL` — only part of the intended requirement is implemented or migrated.
- `PLANNED / NOT AUTHORIZED` — design direction exists but implementation is not authorized.
- `NOT VERIFIED` — evidence is insufficient for a stronger claim.
- `PRODUCTION NOT CLAIMED` — no production deployment claim is made by this matrix.

No status automatically implies deployment.

---

## 3. Evidence hierarchy

Preferred evidence order:

1. exact source/commit/TREE,
2. exact PR/diff,
3. exact-head automated CI,
4. real PostgreSQL/concurrency/browser evidence where relevant,
5. Lead review,
6. independent audit,
7. merge commit,
8. deployment/production verification.

A design document alone cannot prove implementation. A green CI run alone cannot prove independent audit. A merge cannot prove production deployment.

---

# 4. CORE ARCHITECTURE / MATCH RUNTIME TRACEABILITY

| ID | Requirement | Source / rationale | Implementation | Data / API boundary | Tests / verification | Evidence | Status / gap |
|---|---|---|---|---|---|---|---|
| RT-ARCH-001 | Authoritative match state must survive process restart | P7 / architecture master | `src/postgres-session-store.js`, `src/match-runtime.js` | `gracz_game_sessions` | P7 PostgreSQL runtime tests, restart/replay coverage | PR #40; HEAD `5b70c2d...`; TREE `81da9ee0...`; Lead PASS / GPT-2 PASS / Claude PASS | `MERGED / CLOSED`; production deployment not claimed |
| RT-ARCH-002 | Concurrent writers must not both commit the same logical version | P1-C-01 + P7 | PostgreSQL version/CAS in session store and MatchRuntime | `gracz_game_sessions.version`; Checkers move path | Checkers CAS/concurrency tests; P7 runtime tests | TOM 17: PR #29 HEAD `f2167bf3...`, TREE `b08662e9...`, merge `c81b7819...`, exact-head CI GREEN; PR #40 final MatchRuntime evidence | `CLOSED` for defined Checkers/P7 scope; historical PR #29 final audit-report provenance is partial; full-project re-audit still required |
| RT-ARCH-003 | Stale process ownership must fail closed | P7 | `claimMatchOwnership`, `ownershipEpoch` fencing | `gracz_match_runtime_ownership` | P7 ownership/fencing tests | PR #40; Claude final PASS | `MERGED / CLOSED` |
| RT-ARCH-004 | Duplicate mutation retry must be durable and idempotent | P7 | command hash + idempotency record | `gracz_match_runtime_commands`; Checkers move API | P7 idempotency/replay tests | PR #40; exact implementation evidence in current main | `MERGED / CLOSED` |
| RT-ARCH-005 | Realtime must be non-authoritative and emitted only after persistence | Architecture + P7 | MatchRuntime publication after successful persistence; PostgreSQL signal hub | Checkers realtime / `LISTEN/NOTIFY` | P7 replay/publication tests; regression CI | PR #40; P8 regression CI also covers P7 `19/19` | `MERGED / CLOSED` for P7 path |
| RT-ARCH-006 | Player response must be a viewer-safe projection, not raw authoritative state | P7 privacy findings F01/F02 | MatchRuntime adapter `project(viewerId)` / session projections | API response / realtime snapshot | P7 privacy/projection tests | PR #40; Claude final PASS | `MERGED / CLOSED` for defined scope |
| RT-ARCH-007 | Shared MatchRuntime should be reused rather than duplicated across future games | Architecture target | Checkers adapter exists; Gomoku/Thousand not fully migrated | common runtime boundary | no full cross-game proof yet | Architecture Master / Games Master | `PARTIAL`; future migration must be separately authorized/audited |

---

# 5. CHECKERS TRACEABILITY

| ID | Requirement | Implementation | Data/API | Test evidence | Audit/evidence | Status / gap |
|---|---|---|---|---|---|---|
| RT-CHK-001 | Legal move rules are server-authoritative | `src/index.js` Checkers engine | game state / move API | `test/checkers-engine.test.js` and regressions | repeated P7/P8 regressions | `CURRENT-MAIN VERIFIED` |
| RT-CHK-002 | Forced captures and multi-capture sequence must be enforced by engine | Checkers engine move generation/transition | move command | Checkers engine suite | P8 focused Checkers regression `26/26 PASS` on P8 HEAD | `CURRENT-MAIN VERIFIED`; final product rules should remain versioned |
| RT-CHK-003 | Concurrent Checkers mutation must conflict rather than overwrite | PostgreSQL CAS / MatchRuntime | `POST /games/:id/moves` | P1-C-01 + P7 HTTP/runtime tests | TOM 17 PR #29 exact HEAD/TREE/merge/CI + PR #40 closure | `CLOSED` for defined path |
| RT-CHK-004 | Duplicate move request must not repeat mutation | MatchRuntime durable idempotency | `gracz_match_runtime_commands` | P7 replay tests | PR #40 | `CLOSED` |
| RT-CHK-005 | Failed/stale mutation must not publish realtime state | persistence-before-signal contract | Checkers realtime | P1-C-01 / P7 negative tests | TOM 17 PR #29 exact evidence + P7 | `CLOSED` for defined move path |
| RT-CHK-006 | Checkers remains compatibility anchor during shared-runtime evolution | architecture governance | engine + adapter + HTTP | regression suites | P8 exact-head CI includes Checkers regression and browser journey | `ONGOING INVARIANT` |

---

# 6. GOMOKU TRACEABILITY

| ID | Requirement | Implementation | Data/API | Test evidence | Audit/evidence | Status / gap |
|---|---|---|---|---|---|---|
| RT-GOM-001 | Gomoku authoritative state must be durable in PostgreSQL when DB is configured | `src/postgres-gomoku-service.js` | `gracz_gomoku_games` | PostgreSQL durability tests | TOM 17 PR #37 actual final HEAD `5d155fd...`, TREE `2e7ad8c...`, merge `d002027...`, exact-head CI GREEN | `CLOSED` for durability scope |
| RT-GOM-002 | Gomoku schema mismatch must fail closed | `#verifySchema()` in PostgreSQL service | required table/columns/PK | PostgreSQL schema tests | TOM 17 PR #37 + current-main source | `CLOSED` for defined scope |
| RT-GOM-003 | Concurrent Gomoku move must use revision CAS | `UPDATE ... WHERE revision=?` | `gracz_gomoku_games.revision` | `p1-aud3-04-gomoku-http-concurrency.test.js`, PostgreSQL tests | TOM 17 PR #37; P8 CI Gomoku `24/24 PASS` | `CLOSED` for current service |
| RT-GOM-004 | Duplicate requestId may resolve as idempotent replay, not duplicate move | `resolveGomokuIdempotentMove()` | move API / state history | Gomoku service + concurrency tests | TOM 17 PR #37 / regression CI | `CURRENT-MAIN VERIFIED` |
| RT-GOM-005 | Corrupt persisted Gomoku state must be rejected | `decodeState()` validation | DB read boundary | PostgreSQL validation tests | current-main implementation + TOM 17 PR #37 final closure commit | `CURRENT-MAIN VERIFIED` |
| RT-GOM-006 | Gomoku should eventually align with common MatchRuntime where justified | architecture target | not yet fully migrated | n/a | Games Master | `PLANNED / NOT AUTHORIZED` |

---

# 7. THOUSAND TRACEABILITY

| ID | Requirement | Implementation | Data/API | Test evidence | Audit/evidence | Status / gap |
|---|---|---|---|---|---|---|
| RT-THO-001 | Tysiąc state must be durable in PostgreSQL when DB is configured | `src/thousand-repository.js` | `gracz_thousand_games` | Thousand repository/service tests | P8 regression Thousand `20/20 PASS` | `CURRENT-MAIN VERIFIED` |
| RT-THO-002 | Concurrent Tysiąc write must fail on stale revision | repository CAS | `revision`, `expectedRevision` | service/repository tests | current-main + regression CI | `CURRENT-MAIN VERIFIED` |
| RT-THO-003 | Player view must not simply expose raw authoritative state | `thousandPublicView` / service projection | HTTP response | Thousand service tests | current-main | `CURRENT-MAIN VERIFIED`; privacy must be re-audited before card-game production |
| RT-THO-004 | Final Tysiąc rules must be explicitly versioned and frozen before FairPlay integration | product/architecture requirement | NOT YET FINAL | rules document not frozen | no final rules audit yet | `PLANNED / REQUIRED BEFORE GFPE GAME ADAPTER` |
| RT-THO-005 | Tysiąc must not use game-local RNG once FairPlay MAX is adopted | GFPE-0 invariant | current engine still has local RNG; future FairPlay adapter required | future GFPE tables/proofs | no implementation/test evidence | `PLANNED / NOT AUTHORIZED`; current implementation is explicitly NOT FairPlay MAX |
| RT-THO-006 | Tysiąc is intended as first full card-game validation of GFPE | FairPlay roadmap | future adapter | future MatchRuntime + GFPE | future test laboratory | `PLANNED` |

---

# 8. CANONICAL GAME TYPE / P8 TRACEABILITY

| ID | Requirement | Implementation on P8 branch | Modules affected | Tests | Evidence | Status / gap |
|---|---|---|---|---|---|---|
| RT-P8-001 | Canonical runtime IDs are exactly `checkers`, `gomoku`, `thousand` | `src/game-types.js` | registry | P8 contract tests | PR #43 HEAD `d7220f57...`; P8 focused `8/8 PASS` | `IMPLEMENTED / AUDIT PENDING` |
| RT-P8-002 | `warcaby` is a compatibility alias to `checkers`, not a second identity | registry normalization | Lobby / Rankings / Tournaments | P8 alias tests | PR #43 + exact-head CI `34147638975` | `IMPLEMENTED / AUDIT PENDING` |
| RT-P8-003 | Unknown game IDs must fail closed | `requireGameType` / capability checks | Lobby / Rankings / Tournaments | invalid-ID tests include `szachy`, `poker`, `blackjack`, `war`, `tysiac`, `draughts`, empty/null/etc. | PR #43 | `IMPLEMENTED / AUDIT PENDING` |
| RT-P8-004 | Ranking selector `all` must not be treated as a game identity | rankings integration | Rankings | P8 ranking tests | PR #43 | `IMPLEMENTED / AUDIT PENDING` |
| RT-P8-005 | Legacy tournament `warcaby` rows may be read as canonical `checkers` without production migration | tournament mapping | tournaments persistence/read | P8 legacy read test | PR #43 | `IMPLEMENTED / AUDIT PENDING` |
| RT-P8-006 | P8 must not be treated as current main until audit + authorization + merge | governance | documentation/status | n/a | PR #43 remains OPEN / NOT MERGED | `GOVERNANCE INVARIANT` |

---

# 9. AUTH / SESSION / ACCOUNT TRACEABILITY

| ID | Requirement | Implementation | Data/API | Tests/evidence | Status / gap |
|---|---|---|---|---|---|
| RT-AUTH-001 | Passwords must not be stored in plaintext | `secure-accounts.js` / PostgreSQL account service | `gracz_accounts.salt`, `password_hash`, hash version | auth/account tests | `CURRENT-MAIN VERIFIED`; full security re-audit required |
| RT-AUTH-002 | Session lifecycle must support server-side revocation | `auth-sessions.js` | `gracz_auth_sessions`; auth endpoints | auth session tests / current-main source | `CURRENT-MAIN VERIFIED` |
| RT-AUTH-003 | Password reset must revoke prior active sessions | account recovery/auth handler | auth sessions + reset tokens | recovery tests where present | `CURRENT-MAIN VERIFIED`; traceability to exact tests should be expanded in later coverage matrix |
| RT-AUTH-004 | Registration/recovery secrets/codes must be hashed at rest | secure account flows | `gracz_registration_codes`, `gracz_password_reset_tokens` | security/account tests | `CURRENT-MAIN VERIFIED` |
| RT-AUTH-005 | Sensitive privileged operations require RBAC and MFA policy | `rbac-service.js`, `mfa-service.js`, privileged wrapper | `gracz_roles`, `gracz_mfa`, admin API | existing security tests | `PARTIAL / FULL AUDIT REQUIRED`; historical P1-B-01 remains open backlog for reassessment |
| RT-AUTH-006 | MFA secret material must be encrypted with separate key domain | `mfa-service.js` AES-256-GCM + HKDF | `gracz_mfa` | crypto/security tests | TOM 17 PR #36: HEAD `bbb48464...`, TREE `43ead9cc...`, exact-head CI GREEN; independently audited earlier head + corrective finding preserved in PR body | `CLOSED` for defined key-separation scope; production key lifecycle still not AS-BUILT |

---

# 10. PRIVATE MESSAGING / ATTACHMENTS TRACEABILITY

| ID | Requirement | Implementation | Data boundary | Tests/evidence | Status / gap |
|---|---|---|---|---|---|
| RT-MSG-001 | Private message subject/body must be encrypted at rest | `postgres-accounts.js` message crypto | `gracz_messages.subject/body` | messaging/crypto tests | TOM 17 PR #36 + current-main source | `CURRENT-MAIN VERIFIED` |
| RT-MSG-002 | Message encryption key domain must be separate from auth/MFA | dedicated message key derivation | ENV/key domain | crypto separation work | TOM 17 PR #36 exact HEAD/TREE/merge/CI | `CLOSED` for defined scope |
| RT-MSG-003 | Attachment binary must be validated and encrypted | `message-attachments.js` | `gracz_message_attachments` | attachment tests | current-main source + TOM 17 PR #36 | `CURRENT-MAIN VERIFIED` |
| RT-MSG-004 | Only authorized sender/recipient may access message attachment | attachment service authorization checks | attachment read/write API | attachment/account tests | current-main | `CURRENT-MAIN VERIFIED`; future privacy audit should explicitly negative-test all role/user combinations |
| RT-MSG-005 | Message deletion semantics must avoid unintended immediate destruction for the other participant | sender/recipient deletion flags | `gracz_messages` | account/message tests | current-main | `CURRENT-MAIN VERIFIED`; retention/legal policy still open |

---

# 11. RBAC / MFA / AUDIT / MODERATION TRACEABILITY

| ID | Requirement | Implementation | Data/API | Evidence | Status / gap |
|---|---|---|---|---|---|
| RT-SEC-001 | Role escalation must be server-authorized | `rbac-service.js` | `gracz_roles`, `gracz_role_history` | current-main source + security tests | `CURRENT-MAIN VERIFIED`; P1-B-01 re-audit required |
| RT-SEC-002 | Moderator/admin/owner hierarchy must prevent lower role from assigning owner improperly | RBAC level checks | admin security APIs | security tests | `CURRENT-MAIN VERIFIED` |
| RT-SEC-003 | Privileged role change requires MFA where policy says so | RBAC + MFA wrapper | role mutation | security tests | `CURRENT-MAIN VERIFIED`; full matrix to be created in TOM 21 |
| RT-SEC-004 | Security/audit log must sanitize secret-like metadata | `audit-service.js` | `gracz_audit_log` | audit/security tests | current-main | `CURRENT-MAIN VERIFIED` |
| RT-SEC-005 | Audit log should be append-only at DB layer | immutable trigger + privilege revoke | `gracz_audit_log` | source verification; DB test coverage to be fully inventoried | `CURRENT-MAIN VERIFIED`; stronger tamper evidence can be future work |
| RT-SEC-006 | Moderation blocks active-content/phishing patterns and records decisions | `moderation-service.js` | decisions/appeals tables | moderation tests | current-main | `CURRENT-MAIN VERIFIED` |

---

# 12. SHARED RATE LIMITING / REALTIME TRACEABILITY

| ID | Requirement | Implementation | Data/API | Evidence | Status / gap |
|---|---|---|---|---|---|
| RT-INF-001 | Distributed request limiting must work across instances | `PostgresDistributedTrafficGuard` | `gracz_shared_rate_limits` | TOM 17 PR #39: final HEAD `c4669ea...`, TREE `3b6dbca...`, dedicated run `33962992847` + regressions GREEN; merge records Lead PASS + independent Claude audit | `CLOSED` for defined scope |
| RT-INF-002 | Failure of required shared guard must fail closed rather than silently disable protection | shared infrastructure unavailable error path | request boundary | TOM 17 PR #39 P6-F01 correction + exact-head CI | `CLOSED` for defined scope |
| RT-INF-003 | Realtime event channel must carry only bounded, allowed event types/signals | `PostgresRealtimeHub` allowlist + payload-size check | PostgreSQL `LISTEN/NOTIFY` | TOM 17 PR #39 + current-main | `CURRENT-MAIN VERIFIED` |
| RT-INF-004 | Realtime consumer must reload authoritative state from PostgreSQL | hub notification handler | `gracz_game_sessions` | integration tests / TOM 17 PR #39 | `CURRENT-MAIN VERIFIED` |

---

# 13. TOURNAMENTS / RANKINGS / LOBBY TRACEABILITY

| ID | Requirement | Implementation | Data/API | Evidence | Status / gap |
|---|---|---|---|---|---|
| RT-TUR-001 | Concurrent tournament state transitions must not race into inconsistent results | tournament concurrency implementation | tournament tables/API | TOM 17 PR #30: HEAD `08419e82...`, TREE `83ea7215...`, merge `2445434c...`, dedicated exact-head run `33885568581` SUCCESS; P8 regression tournament concurrency `2/2 PASS` | `CLOSED` for defined scope; historical independent audit artifact not retained in PR timeline |
| RT-TUR-002 | Game-type selection must become canonical and fail closed | P8 registry integration | lobby/rankings/tournaments | P8 contract tests | PR #43 | `IMPLEMENTED / AUDIT PENDING` |
| RT-RNK-001 | Ranking game selector must not silently convert unknown game to aggregate `all` | P8 rankings change | rankings API | P8 ranking tests | PR #43 | `IMPLEMENTED / AUDIT PENDING` |
| RT-LOB-001 | Player identity joining/creating rooms must be server-derived from session | lobby handlers | lobby API | lobby/API tests | current-main | `CURRENT-MAIN VERIFIED` |
| RT-LOB-002 | Explicit invalid gameType must not be masked by default after P8 | P8 lobby change | `POST /lobby/rooms` | P8 tests | PR #43 | `IMPLEMENTED / AUDIT PENDING` |

---

# 14. POSTGRESQL / DR TRACEABILITY

| ID | Requirement | Implementation | Evidence | Status / gap |
|---|---|---|---|---|
| RT-DB-001 | Critical game/session state must use durable PostgreSQL path in configured environment | session/Gomoku/Thousand PostgreSQL services | code baseline + PostgreSQL tests + TOM 17 for Checkers/Gomoku historical durability tracks | `CURRENT-MAIN VERIFIED` |
| RT-DB-002 | Restore rehearsal must use isolated target, never production source | P1-R-01 DR scripts/workflow | PR #41; HEAD `535eaac...`; TREE `6f3b73c...`; CI `34053197756` | `MERGED / CLOSED`; production restore not claimed |
| RT-DB-003 | Backup stream must be encrypted and validated before restore | P1-R-01 | CI + DR evidence | `MERGED / CLOSED` |
| RT-DB-004 | Source/target DB and cluster identity must be checked fail-closed | P1-R-01 | real isolated PostgreSQL regression | `MERGED / CLOSED` |
| RT-DB-005 | Restore evidence must be redacted and machine-readable | P1-R-01 JSON evidence | PR #41 / CI | `MERGED / CLOSED` |
| RT-DB-006 | Production RPO/RTO must be measured separately from design targets | Operations Master | no production measurement yet | `NOT VERIFIED / FUTURE PRODUCTION GATE` |
| RT-DB-007 | Each active table must have ownership/retention/privacy semantics documented | TOM 14 PostgreSQL Data Catalog | 30-table current-main inventory | `BASELINE CREATED`; retention gaps remain explicit |

---

# 15. CI / QUALITY TRACEABILITY

| ID | Requirement | Evidence | Status |
|---|---|---|---|
| RT-QA-001 | Major cross-cutting work must have focused tests plus regressions | P8 CI run `34147638975`: focused P8 + Checkers + Gomoku + Thousand + tournament + P5/P6/P7 + full suite; TOM 17 backfills exact-head CI for P1 #29/#30/#36/#37/#38/#39 | `VERIFIED FOR RECORDED HEADS` |
| RT-QA-002 | Final implementation evidence must be tied to exact HEAD | P8 run references exact `d7220f57...`; TOM 17 ties six historical P1 tracks to exact final PR HEAD/TREE/merge | `VERIFIED FOR P8 + BACKFILLED HISTORICAL P1 SET` |
| RT-QA-003 | Security-sensitive work should include CodeQL/gitleaks/dependency audit | P8 run: CodeQL PASS, gitleaks PASS, npm audit 0 vulnerabilities; TOM 17 preserves corresponding historical evidence where available | `VERIFIED FOR P8; HISTORICAL EVIDENCE CLASSIFIED` |
| RT-QA-004 | Browser journeys should validate user-visible critical paths | P8 CI: Checkers browser PASS, Gomoku browser PASS | `VERIFIED FOR P8 HEAD`; mobile/accessibility broader evidence incomplete |
| RT-QA-005 | Green CI does not replace independent audit | governance / CI master | Claude P8 audit still pending despite green CI; TOM 17 separately marks historical audit-report gaps | `GOVERNANCE INVARIANT` |

---

# 16. PRODUCT / UX / SEO / OPERATIONS TRACEABILITY

| ID | Requirement | Current evidence | Status / gap |
|---|---|---|---|
| RT-UX-001 | Critical flows must work on desktop and mobile, portrait and landscape | requirements exist; browser tests cover selected desktop journeys | `PARTIAL`; full responsive/mobile matrix not yet complete |
| RT-UX-002 | Accessibility must be evaluated explicitly | Product/UX Master requires keyboard/focus/contrast/screen-reader review | `NOT VERIFIED` |
| RT-SEO-001 | SEO metadata state must distinguish prepared/merged/deployed/indexable | SEO history and separate draft work exist | `PARTIAL`; release-gate verification required |
| RT-OPS-001 | Health and readiness must be distinct | `src/health.js` `/health`, `/health/live`, `/health/ready`; TOM 17 PR #38 HEAD `6e49cde...`, TREE `d1b0a054...`, dedicated run `33952985147` SUCCESS | `CURRENT-MAIN VERIFIED` |
| RT-OPS-002 | Deployment, rollback, topology and post-deploy evidence must be captured before production AS-BUILT | Operations Master / AS-BUILT checklist | `PLANNED / NOT PRODUCTION VERIFIED` |
| RT-OPS-003 | Production topology must not be inferred from design docs | governance rule | no final production AS-BUILT claim | `GOVERNANCE INVARIANT` |

---

# 17. PRIVACY / LEGAL / GOVERNANCE TRACEABILITY

| ID | Requirement | Evidence | Status / gap |
|---|---|---|---|
| RT-GOV-001 | Owner authorizes merge/deploy/production separately from technical PASS | governance docs and work-item history | `ACTIVE GOVERNANCE RULE` |
| RT-GOV-002 | Historical Privacy/Legal HOLD must not be silently converted to PASS | Privacy/Legal Master | `OPEN / PRESERVED` |
| RT-GOV-003 | AI audit evidence is technical review, not legal opinion or formal certification | Governance Master | `ACTIVE GOVERNANCE RULE` |
| RT-GOV-004 | Every `PASS/CLOSED/MERGED/DEPLOYED` claim must point to evidence | Evidence Register + this matrix + TOM 17 historical P1 backfill | `ACTIVE DOCUMENTATION RULE` |
| RT-GOV-005 | P8 cannot merge until independent audit and Owner+Lead final authorization | PR #43 state / Implementation Register | `PENDING CLAUDE AUDIT` |

---

# 18. FAIRPLAY MAX / GFPE TRACEABILITY — PRE-DESIGN ONLY

| ID | Requirement | Design source | Implementation/test evidence | Status |
|---|---|---|---|---|
| RT-GFPE-001 | `NO FAIRPLAY = NO DEAL` | GFPE-0/1 pre-design | none | `PLANNED / NOT AUTHORIZED` |
| RT-GFPE-002 | No game-local RNG for FairPlay card ordering | GFPE requirements | none; current Thousand local RNG explicitly non-compliant with future target | `PLANNED` |
| RT-GFPE-003 | Commit/reveal entropy before deterministic shuffle | GFPE pre-design | none | `PLANNED` |
| RT-GFPE-004 | Shuffle must be deterministic and unbiased using rejection sampling | GFPE pre-design | none | `PLANNED`; Gemini statistical review later required |
| RT-GFPE-005 | Deck/shoe becomes immutable after commitment | GFPE invariants | none | `PLANNED` |
| RT-GFPE-006 | FairPlay keys must be separated from auth/MFA/message/session secrets | GFPE security design | none | `PLANNED` |
| RT-GFPE-007 | Historical proofs must remain verifiable after key rotation | GFPE invariant I-15 | none | `PLANNED` |
| RT-GFPE-008 | Reconnect/restart must not reshuffle or reuse deck positions | GFPE + MatchRuntime integration target | none | `PLANNED` |
| RT-GFPE-009 | Poker private-card verification must not leak folded/mucked cards | GFPE privacy design | none | `PLANNED`; full ZK shuffle explicitly outside v1 |
| RT-GFPE-010 | Claude reviews protocol/security; Gemini reviews math/statistics; GPT-2 implements under Lead mandate; Copilot assists code | Implementation & Audit Register | no GFPE implementation yet | `ROLE/GATE MODEL DEFINED` |

---

# 19. TRACEABILITY GAPS REGISTER

The following gaps are intentionally open and must not be represented as closed:

1. **P8 independent Claude audit** is still missing.
2. **P8 merge authorization and merge** are not complete.
3. **P1-B-01 / RBAC-MFA negative-path depth** must be reassessed in the post-P8 full-project audit.
4. **Full-project audit** has not started.
5. **Historical P1 exact repository evidence backfill is complete** for PR #29/#30/#36/#37/#38/#39, but independent-audit report provenance is not uniformly preserved; TOM 17 explicitly records partial/gap classifications, especially PR #30 and PR #38.
6. **Mobile/responsive/accessibility** evidence is incomplete.
7. **Production topology/configuration/deployment** are not final AS-BUILT.
8. **Retention/deletion/legal-hold policy** is not fully closed across all data domains.
9. **Gomoku/Thousand migration to shared MatchRuntime** is not complete and is not authorized here.
10. **Final Tysiąc rulesVersion** is not frozen.
11. **GFPE-2 cryptographic protocol** is not yet designed/frozen.
12. **FairPlay MAX implementation/test/audit evidence** does not yet exist.
13. **Production RPO/RTO** are not measured values.
14. **SBOM / supply-chain release register** is not yet complete.
15. **Final release/deployment/rollback evidence** does not yet exist.

---

# 20. UPDATE RULE

This matrix is updated whenever any of the following occurs:

- requirement added, changed or superseded,
- architecture decision frozen or superseded,
- implementation branch created,
- test added or changed,
- CI evidence produced,
- audit finding created or closed,
- PR merged,
- production deployment executed,
- production verification changes an AS-BUILT claim,
- stronger historical evidence is recovered and supersedes a prior provenance classification.

Every row should evolve from left to right:

```text
REQUIREMENT
  -> DESIGN / DECISION
  -> IMPLEMENTATION
  -> DATA / API BOUNDARY
  -> TEST
  -> CI EVIDENCE
  -> LEAD REVIEW
  -> INDEPENDENT AUDIT
  -> MERGE
  -> DEPLOY / PRODUCTION EVIDENCE
```

Missing links remain explicit gaps rather than assumptions.

---

## 21. Current conclusion

```text
TRACEABILITY MATRIX = BASELINE CREATED / HISTORICAL P1 BACKFILL LINKED
CURRENT-MAIN BASELINE = ad0739190fe2f9d1657b2b77c8b5f8e825830c08
HISTORICAL P1 PR #29/#30/#36/#37/#38/#39 = EXACT REPOSITORY EVIDENCE BACKFILLED
P7 = CLOSED FOR DEFINED SCOPE
P1-R-01 = CLOSED FOR DEFINED SCOPE
P8 = IMPLEMENTED / LEAD PASS / CLAUDE AUDIT PENDING / NOT MERGED
FULL PROJECT AUDIT = NOT STARTED
GFPE = PRE-DESIGN ONLY / IMPLEMENTATION NOT AUTHORIZED
PRODUCTION AS-BUILT = NOT CLAIMED
```

This document is now the master bridge between requirements, code, tests, audit and evidence for the Gracz.pl FULL MAX documentation package.