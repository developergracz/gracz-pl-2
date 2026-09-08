# GRACZ.PL — TECHNICAL DEBT / LEGACY / DEAD CODE REGISTER

**Document:** TOM 39 / Technical Debt, Legacy & Dead Code Register  
**Status:** LIVING / AUDIT INPUT / NOT FROZEN  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Current-main reference:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This register prevents old code, compatibility paths, historical branches and unfinished target architecture from being mistaken for active production design.

Each item is classified as one of:

- `ACTIVE` — current supported runtime path.
- `COMPATIBILITY` — intentionally retained for bounded backward compatibility.
- `TEST/DEV ONLY` — useful outside production authority.
- `HISTORICAL REFERENCE` — preserved evidence/reuse candidate; not active main.
- `TARGET NOT IMPLEMENTED` — documented future architecture.
- `REMOVE CANDIDATE` — potentially removable after proof/audit.
- `DEBT / DECISION REQUIRED` — requires explicit architecture or product decision.

Nothing is deleted merely because it appears in this register.

---

# 2. RUNTIME SERVER PATHS

## TD-001 — `server-p7.js` vs `server.js`

**Observed:** TOM 12/current composition root records `server-p7.js` as the active P7 Checkers HTTP path while older `server.js` remains in repository.

**Classification:**

- `server-p7.js` = `ACTIVE`
- `server.js` = `DEBT / REMOVE CANDIDATE` until reachability/import/test audit proves exact role

**Risk:** two server implementations can drift in security, concurrency, projection or error semantics.

**Required closure:** full audit must classify imports, tests, runtime reachability and safe removal/compatibility need.

---

# 3. MEMORY / FILE FALLBACKS

## TD-002 — non-PostgreSQL repositories/services

Current code retains memory/file implementations for selected development/test-compatible paths, including game/session/service layers.

**Classification:** `TEST/DEV ONLY` or `DEBT / DECISION REQUIRED` per component.

**Risk:** accidental production startup without PostgreSQL could produce non-durable or single-process behavior.

**Required audit:** establish exact production fail-closed startup contract for every authoritative component and confirm no production path can silently downgrade to memory/file authority.

---

# 4. TYSIĄC RANDOMNESS

## TD-003 — game-local RNG

Current `ThousandGameService` accepts injected `random` and defaults to `Math.random`; `shuffleThousandDeck` uses it for Fisher-Yates.

**Classification:** `ACTIVE CURRENT-MAIN / KNOWN TEMPORARY DEBT`.

**Risk:** unacceptable for FairPlay MAX target and unsuitable as final cryptographically auditable deal source.

**Decision:** do not patch ad hoc before GFPE. Replace only through reviewed GFPE integration after protocol freeze.

---

# 5. GOMOKU / TYSIĄC OUTSIDE COMMON MATCHRUNTIME

## TD-004 — heterogeneous game concurrency runtimes

- Checkers = common MatchRuntime/P7.
- Gomoku = separate revision CAS/requestId model.
- Tysiąc = separate revision/expectedRevision repository model.

**Classification:** `ACTIVE / ARCHITECTURAL DEBT OR INTENTIONAL HETEROGENEITY — DECISION REQUIRED`.

**Risk:** repeated concurrency/error/restart patterns and inconsistent invariants.

**Required audit:** determine whether migration to MatchRuntime is justified per game or whether shared contracts without full migration are sufficient.

---

# 6. REALTIME / OUTBOX

## TD-005 — no universal transactional outbox

Target V3 architecture describes stronger event/outbox separation. Current main has signal-only realtime improvements and shared PostgreSQL realtime infrastructure, but not a universal transactional outbox for all side effects/providers.

**Classification:** `TARGET NOT IMPLEMENTED / DEBT DECISION REQUIRED`.

**Risk:** post-commit publication/provider failure can create ambiguous client/provider outcomes if handlers await non-authoritative side effects.

**Specific audit candidate:** Tysiąc realtime publish after persisted mutation.

---

# 7. LEGACY CRYPTO DECRYPT PATHS

## TD-006 — `AUTH_SECRET` legacy decrypt compatibility

MFA, private messages and attachments have dedicated active keys but may attempt legacy decryption using old `AUTH_SECRET` after authenticated decrypt failure.

**Classification:** `COMPATIBILITY`.

**Strength:** fallback is narrowed to authenticated-decryption failure and emits legacy-decrypt signal where implemented.

**Debt:** no canonical completion percentage, ciphertext keyId or formal retirement date/criterion.

**Required closure:** inventory remaining legacy ciphertext, migrate/re-encrypt under authorized procedure, then retire fallback only with evidence.

---

# 8. AUDIT HASH SALT FALLBACK

## TD-007 — `AUDIT_HASH_SALT -> AUTH_SECRET -> empty`

Current `AuditService` constructor permits fallback from dedicated audit salt to `AUTH_SECRET`, then empty string.

**Classification:** `DEBT / SECURITY AUDIT REQUIRED`.

**Risk:** domain separation and pseudonymization quality depend on environment wiring.

**Action:** no code change before finding validation; full audit should decide whether production must fail closed on missing dedicated `AUDIT_HASH_SALT`.

---

# 9. KEY ROTATION METADATA

## TD-008 — missing persistent `keyId` for long-lived encrypted data

Messages, attachments and MFA have dedicated cryptographic domains but current stored records do not provide a complete general key-ring/keyId lifecycle.

**Classification:** `DEBT / FUTURE HARDENING`.

**Risk:** multi-generation key rotation and historical decrypt become harder to manage safely over a 10–15 year lifetime.

**Reference:** TOM 20.

---

# 10. OLD ARCHITECTURE `AS-IS`

## TD-009 — 31.08.2026 architecture baseline contains stale AS-IS claims

`01-ARCHITEKTURA/03-SKONSOLIDOWANA-ARCHITEKTURA-SYSTEMOWA-GRACZ-PL-V3.md` correctly labels itself design baseline, but its AS-IS section predates P5/P6/P7/DR and still states e.g. no common MatchRuntime and no full shared realtime backplane.

**Classification:** `HISTORICAL REFERENCE`, not active current-AS-IS.

**Decision:** preserve document; do not rewrite history. After full audit create a new post-audit architecture baseline rather than silently replacing the 31.08 version.

---

# 11. P8 PENDING DELTA

## TD-010 — split game-type contract between current main and PR #43

Current main still contains pre-P8 game identifier behavior in some modules; PR #43 centralizes canonical IDs and fail-closed normalization.

**Classification:** `TEMPORARY OPEN WORK / NOT DEBT AFTER FORMAL CLOSURE`.

**Rule:** do not document P8 as current-main until independent audit and authorized merge complete.

---

# 12. HISTORICAL POKER BRANCHES

## TD-011 — `poker-m1-card-deck`

Branch exists and contains historical Poker M1 work.

**Classification:** `HISTORICAL REFERENCE / REUSE CANDIDATE`.

**Rule:** do not merge or continue directly. Re-audit against future GFPE + current runtime contracts before reuse.

## TD-012 — `poker-m2-hand-evaluator`

Branch exists and continues historical Poker domain work.

**Classification:** `HISTORICAL REFERENCE / REUSE CANDIDATE`.

**Rule:** evaluator/domain logic may be reusable after code audit; no historical shuffle/randomness contract may bypass GFPE.

---

# 13. STALE / HISTORICAL PRS

## TD-013 — PR #31–#35

These remain historical/reference surfaces rather than canonical final implementation unless a specific artifact is explicitly cited.

**Classification:** `HISTORICAL REFERENCE`.

**Risk:** future documentation or automation could accidentally cite stale HEADs as final evidence.

**Control:** TOM 17 evidence backfill and Implementation/Audit Register.

---

# 14. PRODUCTION AS-BUILT GAP

## TD-014 — design/implementation evidence exceeds production evidence

The project has strong repo-level architecture/test documentation, but final verified production topology/configuration/deployment/rollback evidence is intentionally not yet claimed.

**Classification:** `TARGET NOT YET VERIFIED`.

**Required closure:** after technical audit, authorized deployment and fresh production readback, create final AS-BUILT topology/configuration evidence.

---

# 15. OBSERVABILITY / SLO / CAPACITY GAPS

## TD-015 — incomplete final production SLO/SLI/capacity baseline

Health/readiness and audit/security monitoring exist, but final measured production SLO, RPO/RTO and capacity thresholds are not yet frozen as AS-BUILT.

**Classification:** `DEBT / OPERATIONS MATURITY`.

---

# 16. RETENTION / LEGAL-HOLD GAPS

## TD-016 — unresolved retention/deletion policy for multiple data classes

Database structures exist for accounts/messages/audit/chat/newsletter/game data, but not every class has final product/legal retention and deletion semantics.

**Classification:** `DEBT / GOVERNANCE DECISION REQUIRED`.

**Reference:** TOM 10, TOM 14 and future retention matrix.

---

# 17. SUPPLY-CHAIN INVENTORY GAP

## TD-017 — no final SBOM/supply-chain register

The runtime has deliberately few dependencies and CI includes dependency/security checks, but a final SBOM/dependency provenance/upgrade policy register is not yet frozen.

**Classification:** `DEBT / PRE-FULL-AUDIT HARDENING`.

---

# 18. UI / MOBILE / ACCESSIBILITY EVIDENCE

## TD-018 — incomplete full acceptance evidence

Browser journeys exist, but final mobile orientation/responsive/accessibility evidence across all product surfaces remains incomplete.

**Classification:** `DEBT / PRODUCT QUALITY`.

---

# 19. GFPE / FAIRPLAY MAX

## TD-019 — GFPE is design, not implementation

GFPE-0/1 are pre-design complete; GFPE-2 and validation plan are draft. No GFPE implementation, database migration, signing keys or production proof system exists.

**Classification:** `TARGET NOT IMPLEMENTED` — explicitly not technical debt in current non-FairPlay runtime.

**Rule:** never imply compliance before freeze, implementation, tests and independent review.

---

# 20. REMOVAL / DEBT CLOSURE RULE

No item can be removed from this register merely because code was deleted or changed.

Closure evidence should include as applicable:

1. exact finding/decision,
2. approved mandate/ADR,
3. final SHA/TREE,
4. import/reachability proof,
5. focused tests,
6. regression tests,
7. security/concurrency evidence,
8. independent re-audit where required,
9. migration/compatibility evidence,
10. production evidence if production behavior changed.

---

## 21. Current priority groups

### Full-audit priority

- TD-001 server path duplication
- TD-002 production memory/file downgrade risk
- TD-005 post-commit side-effect semantics
- TD-006 legacy crypto retirement
- TD-007 audit salt fallback
- TD-010 P8 pending canonical-ID delta

### Post-audit architecture decision

- TD-004 common MatchRuntime coverage
- TD-008 keyId/key-ring model
- TD-009 new architecture baseline
- TD-014 production AS-BUILT

### GFPE-era

- TD-003 Tysiąc RNG replacement
- TD-011/012 Poker historical reuse
- TD-019 GFPE implementation

---

## 22. Current status

`TOM 39 = BASELINE CREATED / FULL-AUDIT INPUT`

No cleanup, deletion, merge or production change is authorized by this register.