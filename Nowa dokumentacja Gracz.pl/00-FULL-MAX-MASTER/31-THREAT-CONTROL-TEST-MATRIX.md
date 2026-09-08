# GRACZ.PL — THREAT → CONTROL → TEST MATRIX

**Document:** TOM 31 / Security Threat-Control-Test Traceability  
**Status:** LIVING / CURRENT-MAIN + FUTURE-GFPE BOUNDARY / NOT FROZEN  
**Repository:** `developergracz/gracz-pl-2`  
**Current-main reference at preparation:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Purpose:** map threats to implemented controls, tests, evidence and explicit gaps.

---

## 1. Principle

A security claim is useful only if the chain is visible:

`THREAT -> CONTROL -> IMPLEMENTATION -> NEGATIVE TEST -> EVIDENCE -> RESIDUAL GAP`

This matrix distinguishes:

- `VERIFIED CONTROL` — implemented and supported by code/test/evidence,
- `PARTIAL` — control exists but coverage or scope remains incomplete,
- `AUDIT REQUIRED` — implementation exists but full negative-path review remains open,
- `PLANNED` — design only, no implementation evidence,
- `NOT VERIFIED` — insufficient proof.

No row implies production deployment unless production evidence exists separately.

---

# 2. AUTHENTICATION / SESSION THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-AUTH-001 | Password plaintext disclosure | salted/password-hash storage | `secure-accounts.js`, PostgreSQL account layer | auth/account tests | `VERIFIED CONTROL`; full crypto parameters re-audit required |
| THC-AUTH-002 | Forged session token | server-side signed auth token | `auth.js` | auth tests | `VERIFIED CONTROL` |
| THC-AUTH-003 | Stolen token remains valid after reset/logout | server-side session revocation | `auth-sessions.js`, recovery/logout flows | session/recovery tests | `VERIFIED CONTROL`; race-depth audit required |
| THC-AUTH-004 | Account enumeration during registration/recovery | neutral responses / hashed verification material | secure account/recovery handlers | security tests | `PARTIAL`; full endpoint-by-endpoint audit required |
| THC-AUTH-005 | Session fixation/cookie misuse | `__Host-gracz_session`, same-origin model | HTTP/auth handlers | browser/auth tests | `AUDIT REQUIRED` for cookie flags across all paths |
| THC-AUTH-006 | Credential spraying | local + distributed request limiting, Turnstile/adaptive challenge where applicable | `traffic-guard.js`, `distributed-infrastructure.js`, security service | P6/security tests | `VERIFIED/PARTIAL`; production thresholds need operational evidence |

---

# 3. RBAC / MFA / PRIVILEGE THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-RBAC-001 | Player accesses admin endpoint | trusted session + role gate | `admin-security-handler.js`, newsletter admin | security/admin tests | `VERIFIED CONTROL` |
| THC-RBAC-002 | Moderator assigns owner/admin improperly | role hierarchy and permission checks | `rbac-service.js` | RBAC tests | `AUDIT REQUIRED`; P1-B-01 remains open for deep reassessment |
| THC-RBAC-003 | Administrator self-escalation to owner | only owner may assign owner | `rbac-service.js` | RBAC tests | `VERIFIED CONTROL`; negative matrix in TOM 21 |
| THC-RBAC-004 | Privileged operation without MFA | privileged MFA gate | `admin-security-handler.js`, privileged wrapper, newsletter admin | MFA/security tests | `PARTIAL/AUDIT REQUIRED` for complete operation coverage |
| THC-RBAC-005 | MFA secret disclosure at rest | dedicated encrypted MFA secret domain | `mfa-service.js`, `MFA_ENCRYPTION_KEY` | PR #36/security tests | `VERIFIED CONTROL` for defined crypto separation scope |
| THC-RBAC-006 | MFA replay/bruteforce | code verification + rate limiting on privileged endpoints | MFA/security services | tests where present | `AUDIT REQUIRED` for window/replay/rate-limit exhaustiveness |
| THC-RBAC-007 | Unauthorized role history tampering | DB-backed role history + audit | `rbac-service.js`, audit layer | source evidence | `PARTIAL`; DB immutability of role history not equivalent to audit-log protections |

---

# 4. PRIVATE DATA / MESSAGING THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-PRIV-001 | Private message plaintext at rest | AEAD encryption | message storage in `postgres-accounts.js` | PR #36/crypto tests | `VERIFIED CONTROL` |
| THC-PRIV-002 | Encryption key reuse across domains | dedicated Message/Attachment/MFA secrets + startup separation checks | `config.js` | PR #36 | `VERIFIED CONTROL` |
| THC-PRIV-003 | Unauthorized attachment read | sender/recipient authorization + encrypted blob | `message-attachments.js` | attachment tests | `VERIFIED/PARTIAL`; explicit full negative role matrix still useful |
| THC-PRIV-004 | Private data leakage through logs | safe error/redaction and limited audit metadata | `main.js`, audit service | security tests/source review | `AUDIT REQUIRED` across every logger/provider path |
| THC-PRIV-005 | Deleted message destroyed for other participant incorrectly | per-participant deletion semantics | message storage/service | message tests | `VERIFIED CONTROL`; retention/legal policy open |
| THC-PRIV-006 | Newsletter admin reveals email without strong authorization | `newsletter.email.reveal` + MFA + rate limit + audit | newsletter admin handler | admin tests/source | `VERIFIED CONTROL`; P1-B-01/full audit recheck required |

---

# 5. WEB / HTTP / BROWSER THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-WEB-001 | Cross-site state-changing request | same-origin enforcement | `SecurityService.assertSameOrigin`, main routing | security tests | `VERIFIED/PARTIAL`; all mutation routes must be inventoried |
| THC-WEB-002 | XSS/active content | CSP, server rendering/escaping, moderation filters | `main.js`, web handlers, moderation | browser/security tests | `AUDIT REQUIRED`; frontend DOM sinks must be reviewed |
| THC-WEB-003 | Clickjacking | `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'` | `main.js` | source/browser headers | `VERIFIED CONTROL` |
| THC-WEB-004 | MIME sniffing | `X-Content-Type-Options: nosniff` | `main.js` | source | `VERIFIED CONTROL` |
| THC-WEB-005 | Sensitive browser caching | `no-store` on sensitive admin/API assets | handlers | source/tests | `PARTIAL`; endpoint inventory review required |
| THC-WEB-006 | Host/proxy spoofing | explicit Cloudflare/proxy trust configuration | env/security code | TOM 19 | `AUDIT REQUIRED`; production topology not yet AS-BUILT |
| THC-WEB-007 | Challenge bypass in production | Turnstile production configuration / fail-closed flows | security/public handlers | security tests | `PARTIAL`; actual production ENV not verified |

---

# 6. CHECKERS / MATCHRUNTIME INTEGRITY THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-MR-001 | Two writers overwrite same version | PostgreSQL CAS `expectedVersion` | MatchRuntime/session store | PR #29/#40 tests | `CLOSED FOR DEFINED SCOPE` |
| THC-MR-002 | Stale process writes after ownership transfer | `ownershipEpoch` fencing | MatchRuntime | P7 ownership tests | `CLOSED` |
| THC-MR-003 | Retry executes command twice | durable idempotency key + command hash | MatchRuntime commands | P7 tests | `CLOSED` |
| THC-MR-004 | Realtime publishes uncommitted mutation | persist-before-publish | MatchRuntime | P1-C-01/P7 tests | `CLOSED` for move path |
| THC-MR-005 | Realtime becomes source of truth | signal-only design + reload authoritative DB state | realtime/session store | P6/P7 tests | `VERIFIED CONTROL` |
| THC-MR-006 | Private authoritative state leaked to player | mandatory viewer projection | adapter/MatchRuntime | P7-F01/F02 tests | `CLOSED` for defined P7 path |
| THC-MR-007 | Restart loses active match | durable PostgreSQL session state | Postgres session store | P7 restart tests | `CLOSED` for defined scope |
| THC-MR-008 | Legacy Checkers paths bypass MatchRuntime guarantees | partial cutover acknowledged | `server.js`/legacy action/chat paths | architecture evidence | `PARTIAL / FULL AUDIT REQUIRED` |

---

# 7. GOMOKU INTEGRITY THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-GOM-001 | Concurrent move overwrite | revision CAS | PostgreSQL Gomoku service | PR #37 tests | `CLOSED` |
| THC-GOM-002 | Lost response retry duplicates move | requestId/idempotent replay resolution | Gomoku service | PR #37 tests | `CLOSED` |
| THC-GOM-003 | Incompatible/missing schema accepted | runtime schema verification fail-closed | PostgreSQL Gomoku service | PR #37 tests | `CLOSED` |
| THC-GOM-004 | Corrupt persisted state accepted | state decode/validation | Gomoku service | tests/source | `VERIFIED CONTROL` |
| THC-GOM-005 | Realtime leak/race | current Gomoku architecture has no authoritative realtime publisher dependency | service/http | architecture evidence | `CURRENT DESIGN`; future realtime integration must re-audit |

---

# 8. TYSIĄC INTEGRITY / PRIVACY THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-THO-001 | Stale write overwrites newer game | revision/expectedRevision CAS | Thousand repository/service | Thousand tests | `VERIFIED CONTROL` |
| THC-THO-002 | Player sees authoritative hidden state | public/player projection | Thousand service | service tests | `VERIFIED/PARTIAL`; full privacy re-audit required before card-game production |
| THC-THO-003 | Restart loses state | PostgreSQL repository | Thousand repository | tests | `VERIFIED CONTROL` |
| THC-THO-004 | Current game-local RNG falsely represented as FairPlay | explicit documentation boundary | current engine/service | TOM 13/15/GFPE docs | `KNOWN GAP BY DESIGN`; must be replaced before GFPE production |
| THC-THO-005 | Rules drift without versioning | planned rulesVersion freeze | not final | no final evidence | `PLANNED / REQUIRED BEFORE GFPE ADAPTER` |

---

# 9. TOURNAMENT / LOBBY / RANKING THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-TUR-001 | Two result submissions advance bracket inconsistently | DB transaction + `FOR UPDATE` + conditional state | tournaments | PR #30 concurrency test | `CLOSED` |
| THC-TUR-002 | Duplicate completed result accepted | completed-state conflict | tournaments | concurrency test | `CLOSED` |
| THC-GAME-001 | Unknown game silently becomes valid | P8 canonical registry fail-closed | PR #43 | P8 tests | `IMPLEMENTED / AUDIT PENDING / NOT MAIN` |
| THC-GAME-002 | `warcaby` and `checkers` split identity | controlled alias normalization | P8 | P8 cross-module test | `IMPLEMENTED / AUDIT PENDING` |
| THC-GAME-003 | `all` treated as game identity | rankings-specific selector boundary | P8 | P8 test | `IMPLEMENTED / AUDIT PENDING` |
| THC-GAME-004 | Legacy tournament data becomes unreadable | read normalization without migration | P8 tournaments | P8 legacy row test | `IMPLEMENTED / AUDIT PENDING` |

---

# 10. RATE LIMITING / ABUSE / SHARED INFRA THREATS

| ID | Threat | Control | Implementation | Test/evidence | Status / gap |
|---|---|---|---|---|---|
| THC-ABUSE-001 | Single-node flood reaches DB limiter first | local-before-shared limiter order | production rate-limit composition | P6-F01 | `CLOSED` |
| THC-ABUSE-002 | Multi-instance bypass of process-local limits | PostgreSQL shared limiter | distributed infrastructure | PR #39 tests | `CLOSED FOR DEFINED SCOPE` |
| THC-ABUSE-003 | Shared limiter failure silently disables defense | shared infrastructure fail-closed | distributed infra | P6 tests | `CLOSED` |
| THC-ABUSE-004 | Realtime arbitrary event injection | allowed event types + payload bounds | PostgresRealtimeHub | P6 tests | `VERIFIED CONTROL` |
| THC-ABUSE-005 | Health endpoints blocked by rate limiting | explicit health bypass | main/rate-limit composition | P6-F01/P5 tests | `VERIFIED CONTROL` |

---

# 11. POSTGRESQL / DATA INTEGRITY THREATS

| ID | Threat | Control | Evidence | Status / gap |
|---|---|---|---|---|
| THC-DB-001 | Application violates unique identity constraints | PK/UNIQUE/CHECK constraints where present | TOM 14 | `PARTIAL`; app-only relationships must be audited |
| THC-DB-002 | Orphaned sensitive data after account deletion | FK/cascade where defined | TOM 14 | `PARTIAL`; retention/deletion matrix not fully closed |
| THC-DB-003 | Runtime silently operates with malformed Gomoku schema | explicit verification | PR #37 | `CLOSED` |
| THC-DB-004 | Transaction partially commits role/result state | explicit DB transactions | RBAC/tournaments | tests/source | `VERIFIED/PARTIAL`; race audit required |
| THC-DB-005 | Production DB uses excessive privileges | least-privilege SQL/runbook direction | ops | TOM 05/07 | `NOT PRODUCTION VERIFIED` |

---

# 12. BACKUP / DR THREATS

| ID | Threat | Control | Implementation/evidence | Status / gap |
|---|---|---|---|---|
| THC-DR-001 | Backup confidentiality breach | encrypted backup stream | P1-R-01 | `CLOSED FOR PROGRAM SCOPE` |
| THC-DR-002 | Corrupt backup restored | checksum/decrypt preflight | P1-R-01 | `CLOSED` |
| THC-DR-003 | Restore accidentally targets source/prod | source/target identity + disposable marker + fail-closed checks | PR #41 | `CLOSED` |
| THC-DR-004 | Restore evidence leaks secrets | redacted JSON evidence | PR #41 | `CLOSED` |
| THC-DR-005 | DR procedure exists but never exercises real separate clusters | CI uses distinct PostgreSQL clusters | run `34053197756` | `CLOSED FOR SYNTHETIC PROGRAM`; production RPO/RTO still unmeasured |

---

# 13. AUDIT / LOGGING THREATS

| ID | Threat | Control | Evidence | Status / gap |
|---|---|---|---|---|
| THC-AUD-001 | Audit rows altered/deleted through normal app role | append-only DB protections | audit service/schema | `VERIFIED/PARTIAL`; full DB privilege audit required |
| THC-AUD-002 | Audit metadata contains passwords/tokens/secrets | sanitizer/redaction | audit service + safeError | security tests/source | `AUDIT REQUIRED` across all providers |
| THC-AUD-003 | Historical PASS claims cannot be substantiated | Evidence Register + TOM 17 | docs/Git history | `CONTROL IMPLEMENTED` for documentation governance |
| THC-AUD-004 | Auditor finding disappears during remediation | TOM 18 append-only lifecycle | documentation process | `CONTROL DEFINED`; must be enforced operationally |

---

# 14. CI / SUPPLY CHAIN THREATS

| ID | Threat | Control | Evidence | Status / gap |
|---|---|---|---|---|
| THC-SC-001 | Secret committed to repository | gitleaks | CI runs | `VERIFIED FOR RECORDED HEADS` |
| THC-SC-002 | Known high-severity dependency vulnerability | npm audit | CI | `VERIFIED FOR RECORDED HEADS`; continuous lifecycle needed |
| THC-SC-003 | Static code vulnerability | CodeQL | CI | `VERIFIED FOR RECORDED HEADS` |
| THC-SC-004 | Green CI on wrong commit | exact-head evidence policy | TOM 06/15/17 | `CONTROL DEFINED/USED` |
| THC-SC-005 | Compromised third-party action/dependency | workflow/dependency governance | workflows/lockfile | `AUDIT REQUIRED`; SBOM/supply-chain register still future work |
| THC-SC-006 | Optional tests silently skip DB/security path | REQUIRE_POSTGRES-style flags in critical workflows | CI workflows | `PARTIAL`; full workflow audit required |

---

# 15. OPERATIONS / AVAILABILITY THREATS

| ID | Threat | Control | Evidence | Status / gap |
|---|---|---|---|---|
| THC-OPS-001 | App reports healthy while DB-critical path is unavailable | readiness endpoint | P5 | `CLOSED FOR DEFINED READINESS SCOPE` |
| THC-OPS-002 | Process hangs during shutdown | explicit shutdown/close sequence | `main.js` | `SOURCE VERIFIED`; failure injection needed |
| THC-OPS-003 | Provider outage becomes silent data loss | mail/provider operations fail with explicit errors | secure mail service | `VERIFIED/PARTIAL`; provider-specific runbooks future |
| THC-OPS-004 | No measured production capacity/RPO/RTO | observability/SLO plans | TOM 07/45 | `NOT VERIFIED / PRODUCTION GATE` |

---

# 16. FAIRPLAY MAX / GFPE THREATS — DESIGN ONLY

These controls are **PLANNED**, not implemented.

| ID | Threat | Planned control | Design evidence | Status |
|---|---|---|---|---|
| THC-GFPE-001 | Server/client chooses cards after seeing state | commit/reveal + frozen deterministic deck | GFPE-0/1/2 | `PLANNED` |
| THC-GFPE-002 | Weak RNG / predictable seed | OS CSPRNG + HKDF/HMAC domain separation | GFPE-2 DRAFT | `PLANNED` |
| THC-GFPE-003 | Modulo bias | rejection sampling | GFPE-2 + test plan | `PLANNED` |
| THC-GFPE-004 | Deck modified after commitment | immutable frozen deck + commitment | GFPE-2 | `PLANNED` |
| THC-GFPE-005 | Two nodes deal same position differently | MatchRuntime CAS + ownershipEpoch + persisted cursor | GFPE integration design | `PLANNED` |
| THC-GFPE-006 | Restart reshuffles active hand | persisted protocol/deck/cursor recovery | GFPE-2 | `PLANNED` |
| THC-GFPE-007 | Selective abort/grinding | durable abort state + statistics | GFPE-0/1/2 | `PLANNED` |
| THC-GFPE-008 | FairPlay key reused from auth/MFA/message domains | dedicated signing/encryption/key lifecycle | GFPE-2 | `PLANNED` |
| THC-GFPE-009 | Proof forged | Ed25519 signed proof/checkpoint | GFPE-2 | `PLANNED` |
| THC-GFPE-010 | Poker proof leaks folded/mucked cards | selective per-position commitment/proof model | GFPE-2 | `PLANNED`; full ZK shuffle outside v1 |
| THC-GFPE-011 | Statistical test mistaken for cryptographic proof | explicit separation of crypto review and statistical regression | GFPE test plan | `CONTROL PRINCIPLE DEFINED` |
| THC-GFPE-012 | Game bypasses FairPlay and uses local RNG | `NO FAIRPLAY = NO DEAL` + no game-local RNG invariant | GFPE requirements | `PLANNED`; current Thousand is explicitly pre-GFPE |

---

# 17. Highest-priority open audit gaps

The post-P8 full audit must specifically resolve:

1. complete RBAC/MFA negative-path matrix and P1-B-01 status,
2. legacy/non-MatchRuntime mutation paths and concurrency consistency,
3. all logging/PII/secret-redaction paths,
4. production-vs-development fallback behavior,
5. retention/deletion/legal-hold gaps across data domains,
6. workflow/supply-chain hardening and SBOM readiness,
7. mobile/browser/accessibility security and UX gaps,
8. actual production topology/configuration assumptions,
9. Tysiąc hidden-state/privacy and future GFPE cutover boundary,
10. P8 independent audit and canonical game-type correctness.

---

## 18. Update rule

Whenever a threat is discovered, a control changes, a new test is added, or an audit closes a gap, update this matrix together with TOM 15 and TOM 18.

No planned GFPE row may be relabeled `VERIFIED CONTROL` until implementation, exact-head tests and required independent audits exist.