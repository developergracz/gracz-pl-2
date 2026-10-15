# OWNER access security proposal — HOLD

This is a concrete review proposal, NOT an implemented authentication mechanism.
Owner authorized isolated coding on 2026-10-15 (issue #247 comment 6200558900).
No evidence of independent approval of this authentication design was supplied.
**Blocker: independent architecture/AppSec review of the exact hosting origin/RP,
bootstrap, recovery, durable session schema and credential policy, then explicit
Owner authentication implementation GO.** Claude/Factory reviews required by #247
remain external gates; a Codex code review does not satisfy them.

## Trust boundaries and proposed deployment

Browser → same-origin private admin routes → server authorization → read-only
Resend adapter and existing HMAC consent evidence. Existing infrastructure only.
The candidate browser origin is exactly `https://gracz.pl`, RP ID `gracz.pl`.
Reject www, preview, Render direct origins, HTTP, ports and suffix matches. Never
derive origin/RP from Host or forwarded headers. Same-origin API routing on the
existing hosting must be verified before adopting this proposal; no proxy/DNS/
Render change is authorized here. Inventory every gracz.pl subdomain before RP
approval because RP scope and compromised sibling origins matter. If existing
hosting cannot safely provide this origin, redesign and review; no automatic
cross-origin cookie fallback or new paid service.

## Identity, enrollment and MFA

Assign one immutable random principal ID with OWNER role in a server-only durable
identity registry through a separately approved offline administrative procedure.
No public registration, email allowlist auto-promotion, client role field, legacy
moderator/administrator permissions or newsletter membership grants access.
Before first enrollment, verify the Owner out-of-band through the established
operational identity channel. Issue a 256-bit random one-time enrollment challenge,
store only its hash, TTL 10 minutes, bind to that principal and ceremony; consume
atomically. Deliver through the trusted operational channel, never URL/query logs.
Enrollment endpoints remain absent until this procedure and schema are approved.

Use a maintained WebAuthn verifier: challenge 32 random bytes, TTL 120 seconds,
one use, server-side ceremony binding; verify exact origin, RP hash, type, signature,
user presence AND user verification (`required`), credential-to-principal binding,
and supported algorithms. Ignore client role/identity claims. Distinct registration
and authentication challenges. Store credential public key/ID and authenticator
metadata, never private keys. Repeated or missing challenges fail closed.
Require two independently controlled credentials before enabling access (prefer
one hardware security key kept offline). Review synced-passkey assurance, backup
flags, counter rollback and the limits of calling UV a second factor; no claim
that all passkeys provide the same phishing-resistant MFA assurance. Counter
anomalies lock the credential for review; no automatic new account or email fallback.

## Recovery and lockout

Loss of one key: authenticate with backup key, fresh UV step-up, enroll replacement,
revoke lost credential and every prior session. Loss of all keys: deny online
access; reviewed offline identity re-verification plus Owner/independent operator
approval and documented incident record. Do not make an email link or support
knowledge question an OWNER bypass. Store offline recovery material under the
existing approved secret escrow policy; no material generated in this PR. Test
recovery on synthetic identities and a restored disposable registry before launch.
The review must settle escrow custody and who can authorize emergency recovery.

## Sessions and cookies

Proposed registry in existing PostgreSQL (separate reviewed migration; never use
or rename migration 005). Store SHA-256 of a random 256-bit opaque session token,
principal ID, credential ID, created/last-seen timestamps, expiry and revocation.
Issue only after successful UV. Rotate on login, privilege/recovery changes and
reauthentication; revoke previous token atomically. Absolute lifetime 8 hours,
idle timeout 15 minutes, step-up freshness 5 minutes for credential management.
Every route checks durable active session, exact OWNER role and credential state.
DB failure means denial; no memory-only/JWT fallback across restarts or replicas.

Cookie: `__Host-gracz_owner`, Secure, HttpOnly, SameSite=Strict, Path=/, no Domain,
Max-Age at most 28800, with shorter server-enforced idle expiry. Never localStorage,
URL tokens or JS-readable cookies. POST logout with CSRF validation atomically
revokes session, clears cookie and UI memory, returns no-store; all subsequent
requests and back-forward restored pages must recheck authorization. Revoke all
sessions after recovery, credential removal or role change. Failures cannot retain
stale PII on screen. No session/auth code is included in this release.

## Request defenses

All admin HTML, assets, list, details, summary, errors and future auth endpoints go
through an explicit deny-by-default router. Route mounting requires reviewed auth;
no enable environment variable in this PR. No export, mutation, send or bulk route.
Opaque random subscriber handles and cursors scoped to the validated session,
filter and five-minute TTL; bounded caches discarded at logout. Never expose
provider IDs, HMAC subjects or arbitrary-address lookup routes.

No CORS response headers. Validate exact Origin on browser POST, reject cross-site
Fetch Metadata; approved same-origin GETs remain side-effect-free. Use synchronizer
CSRF tokens on login, enrollment, logout and credential operations in addition to
Strict cookies; reject missing Origin on browser mutations. Do not put email search
terms into URLs or access logs: use a read-only POST search body after review.
CSP: self scripts/styles/connect only, default none, base/form/frame denied; no
inline scripts, analytics or external assets. Headers no-store, no-referrer,
nosniff, frame DENY and CORP same-origin. Review same-origin public script risk and
CSP against actual hosting before approving RP origin.

Proposed auth limits: 5 failed assertions / 15 minutes / principal, 10 / 15 minutes
per short-lived HMAC(IP), 60 / minute global; cooldown with generic errors, bounded
challenge issuance (5 / minute / source), no user enumeration. Distributed limiter
must survive restarts and be atomic across replicas; store only short-lived keys.
Avoid permanent attacker-triggered account lockout. Data reads: single inflight
list, at most one page/second/session, 10 contacts, at most 21 Resend GETs/page,
2-second individual deadlines and 25-second outer deadline. Production transport
must enforce streaming byte bounds and honor abort; injected objects in tests are
already materialized. Suppression evidence source/permissions and nested response
pagination contract require offline provider documentation review before wiring.
Current skeleton intentionally shows unknown when suppression cannot be proved.

## Auditing, privacy and operations

Skeleton read service requires an audit sink and emits fixed action plus random
request ID before returning data. Audit failure blocks list/detail access. Synthetic
preview keeps only 100 metadata events in memory. This is not the durable security
log required for release. Approved future sink must additionally record server-
assigned actor ID, action, fixed outcome code, UTC time and request ID for auth,
recovery, denials, read access and logout. No email, query, path with subject,
provider response, raw error, cookie, challenge, credential secret or consent HMAC.
Propose 30-day restricted audit retention and aggregate alert thresholds for review;
legal/operational owner must approve. No external analytics vendor. Test log injection,
secret canaries, retention and sink failures. No live sink configured here.

PostgreSQL remains consent evidence keyed by existing HMAC derivation, never a
second plaintext subscriber DB. Detail reader accepts only server-computed HMAC
and projects allowlisted event types/dates. Missing, conflicting or unavailable
evidence is explicit. Pending-only HMAC rows cannot produce plaintext lists.
Global counts and pending aggregates remain unavailable until a bounded, separately
reviewed authoritative aggregation contract exists. Page counts are verified and
labeled as page counts; no extrapolation to global totals.

## Approval checklist (all HOLD)

- Exact routing, RP/origin/subdomain inventory and browser threat model.
- Server-only Owner bootstrap, enrollment and UV/MFA policy.
- Offline recovery, escrow custody and loss-of-all-keys exercise.
- Durable session/credential/limiter schema and existing database DR compatibility.
- Least-privilege provider reads, suppression proof and snapshot/pagination semantics.
- Durable PII-safe audit, privacy/retention and incident handling review.
- Independent Claude/Factory architecture/security PASS and Owner auth coding GO.
- Later exact-head implementation audit, CI, Owner merge GO and separate deploy GO.
