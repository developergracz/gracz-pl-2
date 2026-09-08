# GRACZ.PL — STATE MACHINE CATALOG

**Document:** TOM 25 / State Machine Catalog  
**Status:** LIVING / CURRENT-MAIN VERIFIED + GFPE DRAFT BOUNDARY  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Current-main reference:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This catalog formalizes lifecycle states and legal transitions for security-sensitive and game-sensitive workflows.

Canonical rule:

`STATE + COMMAND + PRECONDITIONS -> NEXT STATE + DURABLE EFFECTS + EVENTS`

Any state transition not explicitly permitted by code or design must be treated as suspicious during audit.

---

## 2. Classification

- `CURRENT VERIFIED` — state/transition observed in current main.
- `PARTIAL` — state model exists but full transition graph requires deeper audit.
- `TARGET` — intended architecture, not yet fully implemented.
- `GFPE DRAFT` — pre-design only; no implementation claim.

---

# 3. AUTH TOKEN LIFECYCLE

Current token model:

```text
ISSUED -> ACTIVE -> EXPIRED
             \
              -> REVOKED / SESSION INACTIVE
```

Account token v2 binds issuer, audience, token version, `jti`, subject, name, issued-at and expiry. Guest token is intentionally separate and does not use the same durable-session semantics.

Illegal/invalid states:

- invalid signature,
- wrong issuer/audience,
- future-invalid timing,
- malformed token,
- revoked/inactive session treated as active.

Audit requirement: cookie and bearer paths must resolve to the same security semantics where both are supported.

---

# 4. PASSWORD RESET LIFECYCLE

Current conceptual flow:

```text
RESET REQUEST
   -> NEUTRAL 202 RESPONSE
   -> TOKEN CREATED? --no--> END
          |
         yes
          v
   MAIL ATTEMPT
          |
          v
   TOKEN PENDING
      -> CONSUMED
      -> EXPIRED
      -> INVALIDATED
```

The request handler intentionally hides whether account/email matched.

Audit questions:

- whether mail-send failure can leave a valid token that user never received,
- token expiry/one-time-use semantics,
- reset vs active-session revocation ordering,
- concurrent reset attempts,
- token reuse after password change.

Status: `PARTIAL / FULL-AUDIT REQUIRED`.

---

# 5. MFA LIFECYCLE

Verified current service semantics:

```text
NOT_CONFIGURED
   -> begin()
PENDING / DISABLED SECRET STORED
   -> enable(valid TOTP)
ENABLED
   -> verify(valid/invalid challenge)
```

`begin()` can replace stored setup material and resets `enabled=FALSE` before successful enable.

Error paths include `MFA_NOT_CONFIGURED`, `MFA_REQUIRED`, `MFA_INVALID`, `MFA_DECRYPT_FAILED`.

Audit requirement: privileged workflows must not treat `PENDING` as `ENABLED`; key-rotation/legacy-decrypt failure must not silently downgrade MFA.

---

# 6. MATCHRUNTIME OWNERSHIP / COMMAND LIFECYCLE

Logical command flow:

```text
LOAD AUTHORITY
   -> CLAIM OWNERSHIP(epoch N)
   -> EXECUTE(expectedVersion, epoch N, idempotencyKey)
        -> COMMIT NEW VERSION
        -> REPLAY EXISTING RESULT
        -> VERSION CONFLICT
        -> STALE OWNERSHIP
        -> IDEMPOTENCY CONFLICT
```

Key invariants:

- `ownershipEpoch` monotonic,
- stale owner cannot write,
- `expectedVersion` must match,
- same idempotency key + same command can replay without second mutation,
- same idempotency key + different command fails,
- persistence precedes publication,
- projection is viewer-safe.

Status: `CURRENT VERIFIED` for P7 scope.

---

# 7. CHECKERS MATCH STATE

The Checkers engine has domain-specific game state plus MatchRuntime version/ownership state.

High-level domain lifecycle:

```text
CREATED / ACTIVE
   -> MOVE
   -> ACTIVE
   -> WINNER DETERMINED
   -> DRAW DETERMINED
```

Within active play, forced capture/multi-capture and promotion rules constrain legal transitions.

Audit requirement: domain end-state must prohibit further authoritative moves while allowing read/replay.

---

# 8. GOMOKU STATE MACHINE

Verified current state:

```text
active
  -> valid move -> active
  -> five-in-row -> finished
  -> full board without winner -> draw
```

`turn` alternates `black <-> white` while active.

Transition preconditions:

- actor must be player,
- correct turn,
- coordinates valid,
- cell unoccupied,
- game active,
- requestId either unused or exact idempotent replay.

Terminal states `finished` and `draw` reject further new moves.

Concurrency layer adds durable `revision` CAS in PostgreSQL-backed mode.

Status: `CURRENT VERIFIED`, but not migrated to common MatchRuntime.

---

# 9. TYSIĄC ROUND / GAME STATE MACHINE

Verified current engine states include:

```text
bidding
  -> talon
  -> discard
  -> contract
  -> playing
  -> round-ended
  -> game-ended
  -> redeal
```

`startNextThousandRound()` permits a new round only from:

- `round-ended`
- `game-ended`
- `redeal`

and creates a fresh state beginning again at `bidding` with incremented round number and next dealer.

Core verified transitions:

```text
bidding --bid/pass--> bidding or talon/redeal
 talon --declarer takes talon--> discard
 discard --valid gifts/discards--> contract
 contract --valid contract--> playing
 playing --legal cards/tricks--> playing
 playing --round completion--> round-ended or game-ended
```

Current concurrency envelope:

```text
record.revision
  -> expectedRevision match
  -> apply action
  -> repository save CAS
  -> revision + 1
```

Important limitation: current shuffle uses injected `random` with default `Math.random`; this state machine is NOT FairPlay MAX compliant and must not be treated as final card-deal authority.

Status: `CURRENT VERIFIED / GFPE MIGRATION REQUIRED LATER`.

---

# 10. TOURNAMENT STATE MACHINE

Verified current tournament lifecycle:

```text
registration
   -> start by owner with >=2 players
live
   -> rounds/matches progress
finished
```

Player membership transitions while `registration`:

```text
NOT_JOINED -> JOINED
JOINED -> LEFT
```

Forbidden transitions:

- join after registration closed,
- owner leaving own tournament,
- leave after tournament started,
- start by non-owner,
- start twice,
- report result for unauthorized match,
- complete same match twice.

Match lifecycle:

```text
scheduled -> completed
```

Concurrent result reporting is protected by PostgreSQL transaction/row locking in the durable path.

P8 will change the game-identifier contract around tournament creation/listing after formal merge.

Status: `CURRENT VERIFIED / P8 DELTA PENDING`.

---

# 11. PRIVATE MESSAGE LIFECYCLE

Observed persisted flags represent a multi-view lifecycle rather than one scalar state:

- created,
- unread/read,
- recipient archived/unarchived,
- sender deleted,
- recipient deleted,
- attachment optional and immutable after defined conditions.

Logical model:

```text
CREATED/UNREAD
   -> READ
   -> ARCHIVED / UNARCHIVED (recipient view)
   -> DELETED_BY_SENDER
   -> DELETED_BY_RECIPIENT
```

Attachment constraints create additional transition rules, e.g. attachment cannot be replaced and cannot be added after recipient read.

Audit requirement: combined flag states must not expose message/attachment after user-side deletion rules say it is hidden.

Status: `PARTIAL / FULL-AUDIT REQUIRED`.

---

# 12. RBAC ROLE LIFECYCLE

Current design uses current role plus role history/audit.

Conceptual flow:

```text
PLAYER
  -> MODERATOR
  -> ADMIN
  -> OWNER (special controlled assignment)
```

and controlled demotions where policy permits.

Every privileged transition must satisfy actor authorization, target constraints, MFA/step-up policy where required, durable update and audit trail.

Status: `PARTIAL / P1-B-01 REASSESSMENT REQUIRED`.

---

# 13. BACKUP / DR LIFECYCLE

Backup artifact lifecycle:

```text
PRECHECK
 -> READ-ONLY SOURCE DUMP STREAM
 -> ENCRYPTED PARTIAL
 -> FINAL ENCRYPTED BACKUP
 -> CHECKSUM CREATED
 -> CHECKSUM VERIFIED
```

DR rehearsal lifecycle:

```text
IDENTITY PRECHECK
 -> DECRYPT/PREFLIGHT
 -> DISPOSABLE TARGET VERIFY
 -> RESTORE
 -> RECONCILIATION
 -> EVIDENCE
 -> CLEANUP
```

Any preflight/source-target identity/key/checksum violation fails closed.

Status: `CURRENT VERIFIED for P1-R-01 scope`.

---

# 14. REALTIME CONNECTION LIFECYCLE

High-level:

```text
CONNECT/SUBSCRIBE
 -> ACTIVE SIGNAL CHANNEL
 -> SIGNAL RECEIVED
 -> AUTHORITATIVE RELOAD AS NEEDED
 -> DISCONNECT/RECONNECT
```

Realtime is not a business-state machine authority. Missed signal must be recoverable through authoritative read.

Audit requirement: local-process SSE state vs shared PostgreSQL backplane and cleanup behavior under disconnect/restart.

---

# 15. P8 GAME-TYPE NORMALIZATION STATE

P8 is not current main yet.

Pending contract after successful closure/merge:

```text
input canonical checkers/gomoku/thousand -> canonical ID
warcaby -> checkers
unknown / unsupported -> FAIL CLOSED
rankings selector all -> aggregate selector only, not a game ID
```

Status: `IMPLEMENTED IN PR #43 / AUDIT PENDING / NOT CURRENT MAIN`.

---

# 16. GFPE FAIRPLAY PROTOCOL STATE MACHINE — DRAFT ONLY

From GFPE-2 draft:

```text
CREATED
 -> COMMIT_OPEN
 -> COMMIT_CLOSED
 -> REVEAL_OPEN
 -> REVEAL_CLOSED
 -> SEED_DERIVED
 -> DECK_FROZEN
 -> DECK_COMMITTED
 -> DEALING
 -> COMPLETED
```

Any non-terminal phase may transition to durable:

```text
ABORTED
```

with explicit reason/evidence.

No backward transition, silent reseed, hidden reshuffle or handId reuse is allowed.

Status: `GFPE DRAFT / NOT FROZEN / NOT IMPLEMENTED`.

---

# 17. FULL-AUDIT STATE-MACHINE QUESTIONS

Claude/Lead must check:

- every terminal state truly blocks forbidden mutations,
- every transition has authorization and concurrency preconditions,
- retry cannot duplicate side effects,
- restart cannot resurrect stale/transient state incorrectly,
- combined boolean flags cannot form unsafe impossible states,
- DB constraints agree with application-state transitions,
- realtime cannot advance state by itself,
- legacy paths do not bypass newer state-machine guards,
- P8 aliases cannot create split game identity,
- future GFPE state transitions are transactionally compatible with MatchRuntime.

Any material issue becomes `FULL-AUD-Fxxx` in TOM 18.

---

## 18. Current status

`TOM 25 = BASELINE CREATED / FULL-AUDIT REVIEW REQUIRED`

No code or production state was changed by this document.