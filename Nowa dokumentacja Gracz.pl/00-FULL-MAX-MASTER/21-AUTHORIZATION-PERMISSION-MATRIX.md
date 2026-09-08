# GRACZ.PL — AUTHORIZATION / PERMISSION MATRIX

**Document:** TOM 21 / Authorization & Permission Matrix  
**Status:** LIVING / CURRENT-MAIN BASELINE / SECURITY AUDIT INPUT  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Verified baseline:** `main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Production authorization:** NONE

---

## 1. Purpose

This document maps identities, roles, permissions, authentication, MFA and audit requirements for current Gracz.pl operations.

It is an audit input, not a claim that every row is already fully negative-tested.

---

## 2. Canonical roles

Current RBAC roles in `src/rbac-service.js`:

- `player`
- `moderator`
- `administrator`
- `owner`

Unauthenticated users are represented here as `guest`, although `guest` is not a stored RBAC role.

Role levels:

```text
player = 0
moderator = 10
administrator = 20
owner = 30
```

Owner has wildcard `*` permission.

---

## 3. Canonical permission sets

### player

- `game.play`
- `profile.manage`
- `message.send`
- `chat.use`

### moderator

All player permissions plus:

- `moderation.review`
- `moderation.warn`
- `moderation.ban`
- `newsletter.read`
- `newsletter.security.read`

### administrator

All normal user permissions plus:

- moderation permissions,
- `admin.users`
- `admin.audit`
- `admin.settings`
- `newsletter.read`
- `newsletter.manage`
- `newsletter.email.reveal`
- `newsletter.security.read`

### owner

- `*`

---

## 4. MFA policy

`RbacService.requiresMfa(role)` returns true for:

- moderator,
- administrator,
- owner.

Important distinction:

- role policy may mark MFA as required,
- specific handler paths may additionally enforce a fresh TOTP code for the operation.

The full audit must verify both concepts independently.

---

# 5. HIGH-LEVEL ACCESS MATRIX

Legend:

- `YES` — intended/current allowed role path,
- `NO` — should be denied,
- `COND` — additional ownership/session/state condition,
- `MFA` — fresh MFA required for operation,
- `AUDIT` — security/audit event expected.

| Capability | Guest | Player | Moderator | Administrator | Owner |
|---|---:|---:|---:|---:|---:|
| public/static pages | YES | YES | YES | YES | YES |
| register/login/recovery entry | YES | YES* | YES* | YES* | YES* |
| play game | NO | YES | YES | YES | YES |
| manage own profile | NO | YES | YES | YES | YES |
| send private message | NO | YES | YES | YES | YES |
| use global chat | NO | YES | YES | YES | YES |
| moderation review/warn/ban | NO | NO | YES | YES | YES |
| admin security panel | NO | NO | YES | YES | YES |
| view newsletter dashboard/subscribers/stats | NO | NO | YES | YES | YES |
| view newsletter security events | NO | NO | YES | YES | YES |
| reveal subscriber email | NO | NO | NO | MFA | MFA |
| change user role | NO | NO | NO | MFA, limited | MFA |
| assign `owner` role | NO | NO | NO | NO | MFA |
| view audit health | NO | NO | NO | MFA | MFA |
| configure own privileged MFA | NO | NO | COND | YES | YES |

`*` Authenticated users accessing public auth entry points are not automatically a security issue; exact UX/route behavior must be validated separately.

---

# 6. ADMIN SECURITY HANDLER MATRIX

Current handler boundary: `/admin/security*`.

All paths require:

1. same-origin assertion,
2. valid session cookie,
3. active server-side auth session if token ID is present,
4. role other than `player`,
5. admin-security rate limit.

| Endpoint / operation | Moderator | Administrator | Owner | Fresh MFA | Permission |
|---|---:|---:|---:|---:|---|
| `GET /admin/security` | YES | YES | YES | NO | role != player |
| `GET /admin/security/panel.js` | YES | YES | YES | NO | role != player |
| `GET /admin/security/me` | YES | YES | YES | NO | role != player |
| `POST /admin/security/mfa/setup` | YES | YES | YES | NO for setup | moderator exception; higher roles require `admin.settings` |
| `POST /admin/security/mfa/enable` | YES | YES | YES | submitted enrollment code | own MFA flow |
| `POST /admin/security/roles` | NO | YES | YES | YES | `admin.users` + `setRole()` rules |
| `GET /admin/security/audit-health` | NO | YES | YES | YES | `admin.audit` |

### Role-change constraints

`setRole()` currently enforces:

- actor must be at least administrator,
- actor cannot change another account whose current role is equal/higher than actor,
- only Owner can assign `owner`,
- assigning moderator-or-higher requires verified MFA,
- role changes are persisted with role history and audit recording.

### Audit target

Full audit must negative-test:

- administrator attempts to assign owner,
- administrator attempts to modify owner,
- administrator modifies peer administrator,
- moderator attempts any role mutation,
- missing MFA,
- invalid MFA,
- replayed MFA code timing behavior,
- self-demotion/self-role edge cases,
- last-owner safety policy (not proven here),
- concurrent role changes.

---

# 7. NEWSLETTER ADMIN MATRIX

Current handler boundary: `/admin/newsletter*`.

Common requirements:

- same-origin,
- authenticated active session,
- rate limit,
- RBAC permission,
- audit event.

| Operation | Moderator | Administrator | Owner | Fresh MFA | Permission |
|---|---:|---:|---:|---:|---|
| dashboard | YES | YES | YES | NO | `newsletter.read` |
| subscriber list | YES | YES | YES | NO | `newsletter.read` |
| subscriber detail | YES | YES | YES | NO | `newsletter.read` |
| stats | YES | YES | YES | NO | `newsletter.read` |
| security events | YES | YES | YES | NO | `newsletter.security.read` |
| reveal full subscriber email | NO | YES | YES | YES | `newsletter.email.reveal` |

Email reveal also has a stricter dedicated rate limit.

Audit concern: moderator access to newsletter subscriber metadata must be reviewed against minimum-privilege/privacy requirements even when full email reveal is denied.

---

# 8. GAME / LOBBY / TOURNAMENT / RANKING ACCESS

## Games

Authenticated identity is required for authoritative player mutations.

Player identity must be derived from server session/token, never trusted from arbitrary client body fields.

Additional access is state-dependent:

- player must belong to match/game where required,
- player must act on their turn,
- stale versions/revisions must fail,
- viewer projection may differ by user.

## Lobby

Create/join/invite operations should derive actor identity from authenticated session.

Full audit must verify:

- no impersonation through request body user IDs,
- room-owner-only operations,
- invite target validation,
- invalid canonical game type after P8.

## Tournaments

Result reporting is conditional on tournament owner or participating player rules implemented by service.

Administrative tournament capabilities must not silently inherit global RBAC unless explicitly designed.

## Rankings

Read operations may be broadly accessible depending endpoint design; mutations should arise from authoritative game/tournament processing, not arbitrary client requests.

---

# 9. PRIVATE MESSAGING / ATTACHMENTS

Expected authorization contract:

- authenticated user only,
- sender identity server-derived,
- recipient validated,
- only sender/recipient may access message content/attachments according to service policy,
- deletion is per-user semantic where implemented,
- administrator/owner visibility is NOT assumed by RBAC wildcard unless an explicit audited endpoint exists.

This is important: `owner=*` in RBAC must not be interpreted as automatic database-level entitlement to arbitrary private content. Application endpoints still need explicit privacy policy.

Full privacy/security audit must test unauthorized cross-user attachment/message reads.

---

# 10. MODERATION

Current RBAC grants moderator/administrator/owner:

- review,
- warn,
- ban.

Full audit must verify:

- exact handler/API enforcement,
- cannot moderate higher-privilege accounts contrary to policy,
- audit logging,
- appeal workflow authorization,
- ban expiration/revocation semantics,
- self-action edge cases,
- moderation does not expose unrelated private content.

---

# 11. OWNER BOOTSTRAP

`GRACZ_OWNER_USER_ID` can bootstrap first Owner when:

- value matches expected identifier format,
- account exists,
- no Owner already exists.

Bootstrap creates an Owner role with `mfa_required=TRUE` and records audit event.

Audit requirements:

- confirm this cannot create second Owner automatically once one exists,
- confirm restart behavior,
- test concurrent startup/bootstrap,
- decide whether production should remove variable after bootstrap,
- define recovery procedure if only Owner account becomes inaccessible.

---

# 12. SAME-ORIGIN / AUTH SESSION BOUNDARY

Admin security and newsletter admin handlers explicitly call same-origin security checks.

Trusted user flow currently includes:

- `__Host-gracz_session` cookie,
- token verification,
- server-side session-active check when token ID exists.

Full audit must verify consistency across all mutation handlers, not only admin handlers.

---

# 13. Required negative-path matrix for full audit

At minimum execute/verify:

1. Guest → game mutation = denied.
2. Guest → admin endpoint = 401/denied.
3. Player → admin security = denied.
4. Player → newsletter admin = denied.
5. Moderator → role mutation = denied.
6. Moderator → subscriber email reveal = denied.
7. Administrator → assign Owner = denied.
8. Administrator → modify equal/higher role = denied.
9. Missing MFA on privileged role mutation = denied.
10. Invalid MFA = denied.
11. Expired/revoked session = denied.
12. Cross-user message read = denied.
13. Cross-user attachment read = denied.
14. Client-supplied fake userId cannot impersonate player.
15. Unauthorized tournament result report = denied.
16. Invalid/unsupported game type fails closed after P8.
17. Same-origin violation on privileged endpoint = denied.
18. Rate-limit exhaustion produces bounded error without privilege bypass.

---

# 14. Open authorization questions

These are not to be guessed:

- Is moderator access to newsletter subscriber metadata intentionally required?
- What is the final Owner recovery / last-Owner policy?
- Which privileged actions require fresh MFA vs merely enabled MFA?
- Should role self-change be constrained further?
- Which administrative operations may inspect private messages, if any? Default should be no implicit access.
- Are all moderation APIs protected by the same RBAC service?
- Is every state-changing endpoint consistently same-origin/CSRF protected?
- Does P1-B-01 require additional dedicated negative-path CI?

---

## 15. Current conclusion

```text
AUTHORIZATION MATRIX = BASELINE CREATED
CANONICAL ROLES = player / moderator / administrator / owner
OWNER = wildcard RBAC, but privacy endpoints still require explicit authorization
PRIVILEGED ROLE CHANGE = ADMIN+ AND MFA
OWNER ASSIGNMENT = OWNER ONLY
NEWSLETTER EMAIL REVEAL = ADMIN/OWNER + MFA
P1-B-01 = REQUIRES POST-P8 FULL AUDIT REASSESSMENT
PRODUCTION AUTHORIZATION = NONE
```
