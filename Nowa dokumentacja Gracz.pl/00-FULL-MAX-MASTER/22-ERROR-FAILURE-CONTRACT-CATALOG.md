# GRACZ.PL — ERROR & FAILURE CONTRACT CATALOG

**Document:** TOM 22 / Error & Failure Contract Catalog  
**Status:** LIVING / CURRENT-MAIN VERIFIED / NOT FROZEN  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Current-main reference:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This catalog defines the observable failure contract of Gracz.pl across HTTP, domain services, concurrency, persistence, security, realtime and operations.

Canonical review chain:

`FAILURE -> INTERNAL ERROR TYPE/CODE -> HTTP/EXTERNAL RESULT -> RETRY SEMANTICS -> AUDIT/LOG -> PRIVACY -> TEST -> RESIDUAL GAP`

The goal is not to force every component to use identical errors. The goal is to make every failure intentional, bounded and reviewable.

---

## 2. Global policy

1. Client input errors should not become 500.
2. Authentication failure should not reveal whether a protected resource exists.
3. Authorization failure should not disclose private state.
4. Optimistic-concurrency conflicts are normal domain conflicts and must remain distinct from infrastructure failures.
5. Idempotent replay must not be reported as a new mutation.
6. Persistence success followed by realtime publication failure must not roll back authoritative state.
7. Unknown internal errors must return sanitized generic messages while preserving server-side diagnostics.
8. Security-sensitive logs/audit metadata must not include passwords, tokens, raw secrets, private cards or full private-message content.
9. Retry guidance must distinguish `safe retry`, `retry with refreshed version/state`, `do not retry`, and `operator intervention`.
10. Every public error code must remain stable or be versioned/migrated deliberately.

---

## 3. Recommended HTTP semantic classes

| Class | Typical status | Retry model | Notes |
|---|---:|---|---|
| malformed/invalid input | 400 | no retry until corrected | schema/rule/input error |
| unauthenticated | 401 | re-authenticate | no private resource disclosure |
| forbidden | 403 | no retry without permission change | RBAC/MFA/origin policy |
| not found | 404 | usually no | may be intentionally neutralized for privacy |
| concurrency/idempotency conflict | 409 | refresh/retry with same idempotency semantics | normal race outcome |
| payload too large | 413 | reduce request | bounded parser |
| rate limit | 429 | delayed retry | should support operational tuning |
| feature unavailable by design | 501 | no automatic retry unless capability changes | e.g. disabled realtime surface |
| dependency unavailable | 502/503 | bounded retry | exact mapping must be explicit |
| internal failure | 500 | no blind retry for mutation | sanitized client message |

Current code is not yet guaranteed to use these classes uniformly across every handler; that is an explicit full-audit check.

---

# 4. AUTH / SESSION

| Code / family | Source | Meaning | External behavior | Retry | Audit/privacy |
|---|---|---|---|---|---|
| `UNAUTHENTICATED` | `src/auth.js` | malformed/missing/invalid token family | commonly 401 in protected handlers | re-authenticate | never log raw token |
| `SESSION_EXPIRED` | `src/auth.js` | token expired | 401 | re-authenticate | safe to expose as code |
| invalid signature / wrong issuer/audience | `src/auth.js` | token integrity/source failure | auth failure | no retry with same token | security signal candidate |
| revoked/inactive session family | `src/auth-sessions.js` | server-side session no longer valid | protected request rejected | re-authenticate | audit session revocation where relevant |

**Audit gap:** auth/session HTTP mapping must be checked endpoint-by-endpoint for consistency between cookie and bearer paths.

---

# 5. ACCOUNT RECOVERY / REQUEST SAFETY

Verified current handler: `src/account-recovery-handler.js`.

| Code | HTTP | Meaning | Retry |
|---|---:|---|---|
| `REQUEST_TOO_LARGE` | 413 | recovery JSON body exceeds bound | only with smaller request |
| `INVALID_JSON` | 400 | malformed JSON | correct request |
| security/rate-limit error | usually error status; fallback 429 | same-origin/challenge/rate protection | delayed / corrected context |
| `RECOVERY_ERROR` | fallback | sanitized recovery failure | do not infer account existence |

Password-reset request intentionally returns neutral `202` when identity data may or may not match an account. This anti-enumeration property must remain preserved.

Mail send in password-reset request path is currently best-effort after token generation. Full audit must decide whether this failure mode is acceptable and whether orphan reset tokens require cleanup/telemetry.

---

# 6. MATCHRUNTIME / CHECKERS COMMON RUNTIME

Verified current errors in `src/match-runtime.js`:

| Code | HTTP | Meaning | Required caller reaction |
|---|---:|---|---|
| `MATCH_RUNTIME_STALE_OWNERSHIP` | 409 | stale writer / old `ownershipEpoch` | reload ownership; stale node must not mutate |
| `MATCH_RUNTIME_VERSION_CONFLICT` | 409 | `expectedVersion` no longer current | reload authoritative state and re-evaluate command |
| `MATCH_RUNTIME_IDEMPOTENCY_CONFLICT` | 409 | same idempotency key reused for different command hash | do not retry under same conflicting key |

Constructor/input `TypeError` failures are programming/validation failures and should never leak stack traces to clients.

Publication failure after committed persistence is deliberately swallowed because realtime is signal-only and non-authoritative. Required invariant: committed state remains success; consumers recover by authoritative reload.

---

# 7. GOMOKU

Verified domain codes in `src/gomoku-service.js` include:

`INVALID_PLAYERS`, `INVALID_PLAYER`, `DUPLICATE_PLAYER`, `PLAYER_NOT_IN_GAME`, `INVALID_REQUEST_ID`, `GOMOKU_IDEMPOTENCY_CONFLICT`, `GAME_FINISHED`, `OUT_OF_TURN`, `INVALID_MOVE`, `FIELD_OCCUPIED`, `GAME_ALREADY_EXISTS`, `GAME_NOT_FOUND`.

`GOMOKU_IDEMPOTENCY_CONFLICT` explicitly carries HTTP 409 at domain level.

The PostgreSQL implementation additionally has revision/CAS semantics. Full audit must verify that HTTP mapping preserves the distinction between:

- invalid move,
- not found,
- stale revision/concurrency,
- idempotency conflict,
- database/internal failure.

No raw authoritative/private state should be attached to error payloads.

---

# 8. TYSIĄC

Verified service/domain codes include:

- `INVALID_PLAYER_COUNT`
- `INVALID_PLAYER`
- `DUPLICATE_PLAYER`
- `NOT_GAME_PLAYER`
- `INVALID_GAME_ID`
- `STALE_GAME_REVISION`
- rule errors such as `ROUND_NOT_FINISHED`, `INVALID_BID`, `BID_TOO_LOW`, `INVALID_TALON`, `INVALID_GIFTS`, `CARD_NOT_IN_HAND`, `INVALID_CONTRACT`, `CONTRACT_BELOW_BID`, `NOT_PLAYER_TURN`, `ILLEGAL_CARD`.

Verified HTTP mapping in `src/thousand-http.js`:

| Failure | HTTP |
|---|---:|
| auth failure | 401 |
| repository not found | 404 |
| repository concurrency / `STALE_GAME_REVISION` | 409 |
| rule/service/type validation | 400 |
| `CROSS_SITE_REQUEST` | 403 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `INVALID_JSON` | 400 |
| `THOUSAND_RATE_LIMIT` | 429 |
| `THOUSAND_ROUTE_NOT_FOUND` | 404 |
| `METHOD_NOT_ALLOWED` | 405 |
| `THOUSAND_REALTIME_DISABLED` | 501 |
| unknown internal error | 500 / `THOUSAND_INTERNAL_ERROR` |

Important current design observation: realtime publish is awaited after service mutation. Full audit must verify whether a publication exception after successful persistence can incorrectly convert a committed mutation into an HTTP failure/retry hazard. This must be compared with the P7 signal-only invariant.

---

# 9. TOURNAMENTS

Verified current-main codes include:

- `TOURNAMENT_TITLE` — 400
- `TOURNAMENT_NOT_FOUND` — 404
- `REGISTRATION_CLOSED` — 409
- `TOURNAMENT_FULL` — 409
- `OWNER_CANNOT_LEAVE` — 409
- `TOURNAMENT_STARTED` — 409
- `TOURNAMENT_FORBIDDEN` — 403
- `NOT_ENOUGH_PLAYERS` — 409
- `INVALID_RESULT` — 400
- `MATCH_NOT_FOUND` — 404
- `MATCH_FORBIDDEN` — 403
- `MATCH_COMPLETED` — 409

Tournament result reporting uses PostgreSQL transaction and row locks. Conflict-like outcomes must remain deterministic under concurrent reporting.

P8 changes canonical game-type validation for tournaments but is not part of current main until formal closure/merge.

---

# 10. MFA / PRIVILEGED SECURITY

Representative security-sensitive failures include:

- `MFA_NOT_CONFIGURED`
- `MFA_REQUIRED`
- `MFA_INVALID`
- `MFA_DECRYPT_FAILED`
- RBAC/privileged-access forbidden families.

Rules:

- failed MFA must never disclose TOTP secret,
- decrypt failure is an internal security failure, not a user-correctable validation error,
- privileged operation failure should be auditable,
- repeated challenge failures should integrate with abuse/rate controls where policy requires.

---

# 11. CRYPTO / PRIVATE MESSAGES / ATTACHMENTS

Authenticated-decryption failures are intentionally typed internally in crypto-sensitive paths.

Public behavior must not distinguish cryptographic details such as tag mismatch vs wrong legacy key in a way that creates an oracle.

Representative message/attachment errors include `MESSAGE_NOT_FOUND`, `INVALID_MESSAGE`, `INVALID_ATTACHMENT`, `MESSAGES_DISABLED` and account-not-found families.

Legacy decrypt success emits a security signal where implemented; legacy decrypt failure must not silently fall through into plaintext or unauthenticated data.

---

# 12. POSTGRESQL / SHARED INFRASTRUCTURE

Failure classes to preserve:

1. connection/startup failure,
2. schema/readiness mismatch,
3. serialization/concurrency conflict,
4. constraint violation,
5. timeout/capacity failure,
6. shared rate-limit backend failure,
7. realtime LISTEN/NOTIFY failure,
8. DR/backup validation failure.

Security-critical shared infrastructure should fail closed where the security model requires it. Availability-only signals may degrade without changing authoritative state where explicitly designed.

---

# 13. DR / BACKUP

Backup tooling fails closed for missing/invalid `DATABASE_URL` or `BACKUP_ENCRYPTION_KEY`, invalid key encoding/length, empty encrypted output and checksum verification failure.

DR errors are operator-facing and must not be converted to application client errors.

---

# 14. LOGGING / AUDIT RULES

Every failure family should be classified as one of:

- `NO LOG REQUIRED`
- `STRUCTURED OPERATIONAL LOG`
- `SECURITY AUDIT EVENT`
- `ALERT CANDIDATE`
- `INCIDENT CANDIDATE`.

Never include secret material, bearer/session token, password, raw MFA secret, private message content or hidden game/card state.

---

# 15. FULL-AUDIT CHECKLIST

Claude/Lead must verify:

- every handler has deterministic error mapping,
- no domain 4xx becomes accidental 500,
- no internal stack/error object leaks to browser,
- 409 semantics are consistent and retry-safe,
- idempotent replay and idempotency conflict are distinguishable,
- post-commit realtime failure cannot create duplicate mutation risk,
- rate-limit responses are bounded and non-enumerating,
- database outages do not create unsafe fail-open behavior,
- crypto failures are non-oracular,
- error logs remain privacy-safe,
- P8 game-type errors remain fail-closed after merge.

Any material inconsistency becomes `FULL-AUD-Fxxx` in TOM 18.

---

## 16. Current status

`TOM 22 = BASELINE CREATED / FULL-AUDIT REVIEW REQUIRED`

This document records current contracts; it does not authorize code corrections.