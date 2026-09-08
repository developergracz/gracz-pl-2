# GRACZ.PL — SECRET & KEY LIFECYCLE REGISTER

**Document:** TOM 20 / Secret & Key Lifecycle Register  
**Status:** LIVING / CURRENT-MAIN VERIFIED + FUTURE-GFPE PLANNED / NOT FROZEN  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Current-main reference:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Secret values recorded in this document:** `NONE`  
**Merge / deploy / production authorization:** `NONE`

---

## 1. Purpose

This register defines the intended ownership, cryptographic purpose, separation, minimum quality, rotation, revocation and historical-read expectations for material Gracz.pl secrets and keys.

It deliberately records **names and contracts only**. It must never contain real secret values, recovery codes, private keys, database passwords, API tokens or encrypted secret payloads.

Canonical lifecycle chain:

`CREATE -> VALIDATE -> STORE -> USE -> OBSERVE -> ROTATE -> LEGACY READ / MIGRATE -> REVOKE -> DESTROY`

A secret existing in configuration does not prove that production storage, rotation or revocation procedures are complete.

---

## 2. Non-negotiable rules

1. No production secret is committed to Git.
2. Secrets for separate security domains must not be reused.
3. `AUTH_SECRET` must not be reused as the active MFA, private-message, attachment or future GFPE key.
4. Production crypto material must fail closed when required configuration is absent or invalid.
5. Rotation must preserve availability only where a bounded, audited compatibility mechanism exists.
6. Historical decrypt/verification support must be explicit and observable; it must not become an indefinite silent fallback.
7. New encrypted records should identify the active key/version where long-lived rotation is required.
8. Revoked keys must never sign/encrypt new material.
9. Public verification keys may remain available after private signing-key retirement when historical proof verification requires it.
10. Production secret-manager/KMS/HSM state is not claimed until independently verified in the production AS-BUILT phase.

---

# 3. CURRENT-MAIN SECRET INVENTORY

| Secret / credential | Domain | Current purpose | Current implementation / algorithm | Current validation | Current rotation state | Status / gap |
|---|---|---|---|---|---|---|
| `AUTH_SECRET` | Authentication | signs account and guest session tokens | HMAC-SHA-256 in `src/auth.js`; also currently available as legacy crypto input in selected domains | config requires >=32 bytes; AuthService requires >=32 chars | no explicit `keyId` or multi-active auth signing-key ring in current main | `ACTIVE`; rotation procedure requires full-audit design |
| `MESSAGE_ENCRYPTION_KEY` | Private messaging | encrypt/decrypt private-message subject/body | dedicated key derived from secret; authenticated encryption path in PostgreSQL account/message service | production config requires dedicated >=32-byte-quality secret and separation from AUTH/MFA/attachments | current code supports legacy decrypt using old `AUTH_SECRET`, but encrypted rows do not expose a formal long-lived key registry | `ACTIVE / LEGACY COMPATIBILITY`; keyId/re-encryption lifecycle gap |
| `ATTACHMENT_ENCRYPTION_KEY` | Private message attachments | encrypt/decrypt PNG/JPEG attachment payloads | HKDF-SHA-256 domain-derived key + AES-256-GCM, 96-bit random IV and AAD | production config requires dedicated >=32-byte-quality secret and separation | legacy decrypt can use old `AUTH_SECRET`; no canonical persistent keyId in attachment row | `ACTIVE / LEGACY COMPATIBILITY`; rotation ledger/re-encryption gap |
| `MFA_ENCRYPTION_KEY` | MFA | encrypt stored TOTP secrets | HKDF-SHA-256 (`gracz.pl/mfa/v1`) -> AES-256-GCM; AAD binds userId | service requires >=32 bytes; production config requires dedicated separated secret | legacy decrypt can use old `AUTH_SECRET`; no canonical persistent keyId in current MFA row | `ACTIVE / LEGACY COMPATIBILITY`; rotation/re-encryption gap |
| `AUDIT_HASH_SALT` | Audit/privacy | salts SHA-256 fingerprints of source and user-agent | `SHA256(hashSalt + ':' + value)` in `audit-service.js` | `.env.example` defines dedicated value, but AuditService currently falls back to `AUTH_SECRET` and then empty string | no key/salt version stored with historical fingerprint | `ACTIVE WITH GAP`; dedicated production requirement and rotation semantics need correction/review |
| `BACKUP_ENCRYPTION_KEY` | DR/backup | protects PostgreSQL backup stream | backup script validates Base64 that decodes to exactly 32 bytes; the environment string is supplied to OpenSSL `enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -salt` as passphrase input | fail-closed validation in backup script | no documented multi-key archive manifest/keyId mapping yet | `ACTIVE FOR DR TOOLING`; historical-backup key retention/rotation register required before production AS-BUILT |
| `DATABASE_URL` | Database credential | authenticates application/ops PostgreSQL connection | provider/role credential in connection string | presence/format depends on component; app can use non-DB development fallback in some paths | provider-specific rotation procedure not canonically documented | `SECRET CREDENTIAL`; least-privilege + rotation verification required |
| `RESEND_API_KEY` | External mail provider | authenticates Resend API requests | Bearer API credential in `secure-mail-service.js` | missing provider makes send fail with `EMAIL_PROVIDER_NOT_CONFIGURED` | provider rotation procedure not documented in repo | `SECRET CREDENTIAL`; external-provider lifecycle gap |
| `TURNSTILE_SECRET_KEY` | Bot-defense provider | server-side Cloudflare Turnstile verification | provider secret used by challenge verification path | production registration/recovery design is fail-closed when challenge config required | provider rotation procedure not documented | `SECRET CREDENTIAL`; verify during full audit |
| `SECURITY_ALERT_WEBHOOK` | Security operations | optional alert receiver URL/credential-bearing endpoint | optional external HTTPS endpoint | optional | no canonical rotation/revocation runbook | `OPTIONAL SECRET-LIKE CONFIG`; treat as confidential |

`GRACZ_OWNER_USER_ID`, `EMAIL_FROM`, `TURNSTILE_SITE_KEY`, host/port and public URLs are configuration but are not cryptographic secrets.

---

# 4. CURRENT DOMAIN SEPARATION

The current configuration layer enforces that active:

- `MESSAGE_ENCRYPTION_KEY`,
- `ATTACHMENT_ENCRYPTION_KEY`,
- `MFA_ENCRYPTION_KEY`

must differ from `AUTH_SECRET` and from each other when present.

This is a strong current-main control.

However, current compatibility code intentionally permits **legacy decryption** with the former `AUTH_SECRET` in MFA, private-message and attachment domains. That fallback exists to read old ciphertext and emits a `crypto.legacy_decrypt` signal where implemented.

Required audit question:

> Is legacy decrypt bounded, observable and removable, or can it silently become a permanent secondary key?

A future closure plan should define:

1. measurement of remaining legacy ciphertext,
2. controlled re-encryption to the current dedicated domain key,
3. verification that no legacy records remain,
4. removal/disablement of legacy AUTH_SECRET decryption,
5. evidence captured in TOM 18 if code correction is required.

---

# 5. AUTH_SECRET LIFECYCLE

## Current use

`AuthService` signs tokens using HMAC-SHA-256. New account session tokens use token version 2 with issuer, audience, `jti`, `iat` and `exp`. Current main does not expose a signing `keyId` inside the token contract.

## Rotation risk

Replacing `AUTH_SECRET` immediately invalidates all tokens signed with the previous secret unless an explicit bounded multi-key verification strategy exists.

Additionally, old `AUTH_SECRET` may still be needed temporarily for legacy decrypt of historical MFA/messages/attachments.

Therefore an AUTH rotation must not be performed as an isolated ENV edit without a documented migration sequence.

## Target lifecycle

```text
AUTH-KID-N = ACTIVE_SIGN
AUTH-KID-N-1 = VERIFY_ONLY for bounded grace period (if adopted)
older keys = REVOKED / DESTROYED when no dependency remains
```

The exact key-ring implementation is `NOT IMPLEMENTED` and must be reviewed before production adoption.

---

# 6. MESSAGE / ATTACHMENT / MFA KEY LIFECYCLE

For long-lived encrypted data, target architecture should support explicit key identity.

Recommended future record contract:

```text
cryptoVersion
keyId
algorithm
iv/nonce
authTag
ciphertext
```

Existing rows do not uniformly carry a formal `keyId` field. Consequently, current legacy compatibility relies on trying the primary key and then the legacy key.

That is acceptable only as a bounded migration bridge, not as the final 10–15 year key-management model.

Target rotation sequence:

1. provision new dedicated secret as `ACTIVE_WRITE`,
2. old key becomes `READ_ONLY`,
3. all new writes use new key,
4. background/bounded migration re-encrypts old records transactionally,
5. sampled/full verification proves successful decrypt under new key,
6. metrics/audit prove no old-key reads remain,
7. old key becomes `REVOKED`,
8. after retention/recovery window, private material is destroyed.

No re-encryption job is authorized by this document.

---

# 7. AUDIT HASH SALT — SPECIFIC GAP

Current `AuditService` constructor resolves:

```text
AUDIT_HASH_SALT || AUTH_SECRET || ""
```

This means the dedicated audit salt is **not yet fail-closed enforced by the service itself**.

Risks:

- domain separation may be weakened if production omits `AUDIT_HASH_SALT`,
- rotation of `AUTH_SECRET` can alter fingerprint comparability if fallback was used,
- empty salt remains technically possible outside a properly controlled environment,
- historical audit fingerprints do not currently record `saltId`.

Lead classification at documentation stage:

`AUDIT REQUIRED / POTENTIAL REMEDIATION CANDIDATE`

Do not create a code correction until full audit/Lead triage confirms scope and severity.

Target design should use a dedicated audit pseudonymization key/salt and explicit version metadata if cross-rotation correlation is required.

---

# 8. BACKUP KEY LIFECYCLE

Current backup tool is fail-closed on missing/invalid `BACKUP_ENCRYPTION_KEY` and prevents plaintext dump persistence in its normal pipeline.

Important semantic detail:

- the script validates that the configured Base64 text decodes to exactly 32 bytes,
- OpenSSL then receives the environment value as **passphrase input** to PBKDF2,
- therefore the current tool must not be documented as simply passing a raw 256-bit AES key directly to `enc`.

For production archive rotation, final operations documentation must map each retained backup to the key generation/version required to restore it.

Target metadata outside the encrypted backup payload should include only non-secret identifiers such as:

```text
backupId
createdAt
encryptionProfile
backupKeyId
checksum
sourceClusterIdentity
```

Never store the secret key beside the backup archive.

Before deleting an old backup key, prove that no retained backup still requires it or that retention policy authorizes those backups' destruction.

---

# 9. EXTERNAL PROVIDER CREDENTIALS

`DATABASE_URL`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY` and secret-like webhook endpoints require operational lifecycle even though they are not application cryptographic keys.

Minimum target procedure for each:

1. identify owner/provider,
2. create replacement credential,
3. grant minimum permissions,
4. stage new credential,
5. validate readiness/health,
6. switch traffic/config,
7. revoke old credential,
8. verify no failures/unauthorized use,
9. record rotation evidence without recording credential value.

Production provider credentials must not be copied into audit reports or MASTER documentation.

---

# 10. FUTURE GFPE / FAIRPLAY MAX KEY REGISTER — PLANNED ONLY

GFPE implementation remains `NOT AUTHORIZED`.

Proposed key domains from GFPE-2:

| Planned key/material | Purpose | Proposed primitive | Historical requirement | Current status |
|---|---|---|---|---|
| GFPE server entropy | fresh per-hand/shoe entropy input | OS CSPRNG, target >=256 bits | normally not reused; disclosure policy protocol-dependent | `PLANNED` |
| GFPE shuffle key | deterministic per-hand shuffle derivation | HKDF-SHA-256 output | never reused across unrelated hands; ephemeral/derived | `PLANNED` |
| GFPE signing private key | signs proof/checkpoint payloads | Ed25519 | retired private key stops signing; corresponding public key retained for historical verification | `PLANNED` |
| GFPE signing public key | verifies historical proofs | Ed25519 public key | must remain resolvable by `signingKeyId` | `PLANNED` |
| GFPE seed-at-rest encryption key | protects retained secret entropy/reveal data where retention is required | AES-256-GCM or reviewed equivalent | old key retained read-only until protected records are migrated/expired | `PLANNED` |
| GFPE checkpoint/ledger signing domain | authenticates durable audit checkpoints | Ed25519 or explicitly separated reviewed design | `keyId` and validity interval required | `PLANNED / DESIGN REVIEW REQUIRED` |

GFPE keys must never reuse:

- `AUTH_SECRET`,
- MFA key,
- message key,
- attachment key,
- audit pseudonymization key/salt,
- backup key,
- database password,
- external provider token.

---

# 11. TARGET GFPE KEY METADATA

No private-key bytes belong in PostgreSQL metadata.

Future metadata may contain:

```text
keyId
purpose
algorithm
publicKey?          // only where public by design
createdAt
notBefore
notAfter?
status              // PREACTIVE / ACTIVE / VERIFY_ONLY / REVOKED / RETIRED
rotationVersion
providerRef?        // opaque KMS/Vault/HSM reference, not secret material
revokedAt?
revocationReason?
```

Historical proof verification rule:

> A proof signed by a key that was valid at proof creation must remain cryptographically verifiable after normal rotation, while clearly reporting later revocation/compromise status when relevant.

The exact compromise semantics must be frozen in a future GFPE key-lifecycle specification.

---

# 12. STORAGE TARGET

Current repository does not prove a final production secret-management platform.

Target preference:

- managed deployment secret store initially,
- future KMS/Vault/HSM-compatible abstraction for high-value GFPE signing/encryption keys,
- no key values in logs,
- no key values in CI artifacts,
- no key values in database metadata,
- minimum runtime access scope,
- separate production/staging/development material.

`PRODUCTION SECRET STORAGE = NOT VERIFIED` until production AS-BUILT inspection.

---

# 13. COMPROMISE / REVOCATION MODEL

For any suspected compromise:

1. identify affected keyId/domain,
2. stop new use of compromised key,
3. determine blast radius,
4. rotate dependent credentials/keys,
5. invalidate sessions or re-encrypt data where necessary,
6. preserve forensic/audit evidence,
7. determine whether historical signatures/proofs require a `COMPROMISED` verification warning,
8. verify all nodes received new configuration,
9. revoke provider-side credentials where applicable,
10. record incident/remediation in TOM 18.

A signing-key compromise, data-encryption-key compromise and provider-token compromise have different response plans; they must not share one generic runbook.

---

# 14. ROTATION EVIDENCE REQUIREMENTS

A future production rotation may be called `COMPLETE` only when evidence records at least:

```text
domain
oldKeyId / credentialId (non-secret identifier only)
newKeyId / credentialId
rotation start/end time
code/build SHA
nodes/environments affected
pre-check result
migration/re-encryption result if applicable
negative old-key-use check
health/readiness result
rollback decision
Lead verification
Owner authorization where production action required
```

Never record secret values in rotation evidence.

---

# 15. CURRENT GAPS FOR FULL AUDIT

Mandatory review items:

1. `AUDIT_HASH_SALT` fallback to `AUTH_SECRET` / empty string.
2. No formal current-main `keyId` on long-lived MFA/message/attachment ciphertext.
3. Legacy `AUTH_SECRET` decrypt paths require bounded retirement criteria.
4. AUTH signing-key rotation/grace strategy is not yet canonical.
5. Backup-key-to-retained-archive mapping is not yet canonical production evidence.
6. External-provider credential rotation runbooks are incomplete.
7. Production secret manager/KMS/Vault/HSM topology is not yet verified.
8. GFPE key lifecycle is design-only and must undergo Claude/Lead review before protocol freeze.

These are audit inputs, not automatic findings. Confirmed findings must enter TOM 18 before correction authorization.

---

# 16. AUDIT QUESTIONS

Claude/full-project audit should answer at minimum:

- Can compromise of one current secret directly compromise another domain?
- Are legacy decrypt fallbacks bounded and observable?
- Can a key be rotated without permanent data loss?
- Can an old key continue writing new ciphertext after rotation?
- Are key identities sufficient for long-lived encrypted data?
- Can production start with a missing/placeholder secret?
- Are provider credentials least-privileged and independently revocable?
- Does backup-key rotation preserve restore capability for retained archives?
- Are logs/audit/errors guaranteed not to expose secrets?
- Is the proposed GFPE signing-key lifecycle sufficient for historical Verify Hand proofs?

---

# 17. STATUS SUMMARY

```text
CURRENT DOMAIN SEPARATION = STRONG BASELINE / LEGACY COMPATIBILITY EXISTS
AUTH SECRET ROTATION = NOT FULLY SPECIFIED
MESSAGE KEY ROTATION = PARTIAL LEGACY SUPPORT / KEY-ID MODEL MISSING
ATTACHMENT KEY ROTATION = PARTIAL LEGACY SUPPORT / KEY-ID MODEL MISSING
MFA KEY ROTATION = PARTIAL LEGACY SUPPORT / KEY-ID MODEL MISSING
AUDIT HASH SALT SEPARATION = CONFIGURED BY INTENT / NOT FAIL-CLOSED IN SERVICE
BACKUP KEY VALIDATION = FAIL-CLOSED IN DR TOOLING
PRODUCTION SECRET MANAGER = NOT VERIFIED
GFPE KEY LIFECYCLE = PLANNED / NOT IMPLEMENTED
```

This document authorizes no code change, secret rotation, migration, merge, deploy or production action.
