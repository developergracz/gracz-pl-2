# GRACZ.PL — ENVIRONMENT & CONFIGURATION CATALOG

**Document:** TOM 19 / Environment & Configuration Catalog  
**Status:** LIVING / CURRENT-MAIN BASELINE / NOT AS-BUILT  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Verified source baseline:** `main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Production values:** NOT RECORDED HERE  
**Secrets:** VALUES MUST NEVER BE STORED IN THIS DOCUMENT

---

## 1. Purpose

This catalog documents configuration contracts without recording secret values. It distinguishes:

- configuration declared in `.env.example`,
- configuration validated by `src/config.js`,
- variables read directly by runtime services,
- development/test fallbacks,
- production-required settings,
- fail-open vs fail-closed behavior,
- unresolved deployment/AS-BUILT evidence.

A variable being documented does not prove it is configured in production.

---

## 2. Core runtime configuration

| Variable | Class | Current-main behavior | Production expectation | Failure behavior | Verified consumer |
|---|---|---|---|---|---|
| `NODE_ENV` | non-secret | defaults to `development`; allowed: development/test/staging/production | must accurately reflect environment | invalid value throws at startup | `src/config.js` |
| `HOST` | non-secret | defaults `0.0.0.0` | platform-specific | no special validation beyond use | `src/config.js`, `main.js` |
| `PORT` | non-secret | defaults 3000; must be integer 1..65535 | platform-provided or explicit | invalid value throws at startup | `src/config.js` |
| `DATA_DIR` | non-secret path | defaults `data`; used by file fallbacks | should not be authoritative production storage | invalid filesystem behavior surfaces at runtime | `src/config.js`, `main.js` |
| `DATABASE_URL` | SECRET-CONNECTION / sensitive | empty => null; enables PostgreSQL services when set | required for intended durable multi-instance production model | many domains fall back to memory/file when absent; must be audited per environment | `src/config.js`, `main.js` |
| `PUBLIC_BASE_URL` | non-secret URL | declared in `.env.example`; runtime use must be separately inventoried | canonical public origin | `NOT FULLY VERIFIED` | `.env.example`; full consumer trace pending |

---

## 3. Authentication and encryption secrets

| Variable | Domain | Validation | Production requirement | Separation rule | Failure behavior |
|---|---|---|---|---|---|
| `AUTH_SECRET` | authentication token signing/verification | minimum 32 UTF-8 bytes | REQUIRED in all current `loadConfig()` modes | must differ from dedicated encryption keys | startup throws if missing/short |
| `MESSAGE_ENCRYPTION_KEY` | private messages | minimum 32 bytes; rejects trivial placeholder/repeated-char patterns | REQUIRED when `NODE_ENV=production` | != AUTH_SECRET, != attachment/MFA keys | production startup throws if missing/weak |
| `ATTACHMENT_ENCRYPTION_KEY` | private attachments | same dedicated-secret validation | REQUIRED in production | separate from all other listed encryption keys | production startup throws |
| `MFA_ENCRYPTION_KEY` | MFA secret encryption | same dedicated-secret validation | REQUIRED in production | separate from AUTH/message/attachment | production startup throws |
| `AUDIT_HASH_SALT` | audit/source hashing | declared in `.env.example`; direct consumer must be verified in full audit | SHOULD be dedicated production secret | must not be reused as auth/encryption key | exact startup contract `NOT YET CENTRALIZED` |
| `BACKUP_ENCRYPTION_KEY` | backup/DR encryption | declared in `.env.example`; DR tooling owns contract | REQUIRED for encrypted backup workflow | separate from application secrets | DR must fail closed if missing/invalid |

### Current architectural rule

`AUTH_SECRET`, message encryption, attachment encryption and MFA encryption are separate cryptographic domains. `src/config.js` rejects equality among the dedicated encryption keys and equality with `AUTH_SECRET`.

This catalog does not record entropy source, current production key material, rotation dates or key IDs. Those belong in a future key-lifecycle register.

---

## 4. PostgreSQL behavior boundary

When `DATABASE_URL` is present in current `main`, `main.js` selects PostgreSQL-backed implementations for major domains including:

- Checkers session store / MatchRuntime persistence,
- distributed traffic guard,
- PostgreSQL realtime hub,
- accounts,
- secure accounts,
- auth sessions,
- message attachments,
- moderation,
- RBAC,
- MFA,
- Global Chat,
- tournaments,
- rankings,
- newsletter,
- Tysiąc repository,
- Gomoku service.

When absent, the runtime currently has a mixture of file, memory and null/non-durable fallbacks depending on domain.

**Audit requirement:** production must not accidentally run critical authoritative services in development fallback mode. Full audit must classify each fallback as `DEV ONLY / TEST ONLY / ALLOWED / PRODUCTION BLOCKED`.

---

## 5. Mail provider configuration

| Variable | Class | Behavior | Failure mode |
|---|---|---|---|
| `RESEND_API_KEY` | secret external-provider credential | used by `SecureMailService`; empty disables provider | mail send throws `EMAIL_PROVIDER_NOT_CONFIGURED` / HTTP-style 503 |
| `EMAIL_FROM` | non-secret but operational | sender identity; default/fallback exists | provider may reject invalid/unverified sender |
| `NEWSLETTER_FROM` | compatibility/non-primary | fallback used by mail service if `EMAIL_FROM` absent | same operational implications |

`SecureMailService` fails closed for actual mail delivery when provider configuration is absent; it does not silently report success.

---

## 6. Cloudflare Turnstile / request-origin configuration

Declared configuration:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_HOSTNAME`
- `TRUST_CLOUDFLARE_HEADERS`
- `TRUST_PROXY_HEADERS`
- `ALLOW_TURNSTILE_ON_TEST_HOSTS`

`main.js` currently enables Turnstile-related CSP allowances only when both site and secret key variables are present.

The exact registration/password-reset challenge enforcement is implemented outside centralized `loadConfig()` and MUST be separately checked in the full audit for:

- missing-key fail-closed behavior in production,
- hostname verification,
- proxy/header trust spoofing,
- test-host exceptions not reachable in production.

Status: `DECLARED / PARTIALLY CENTRALIZED / FULL SECURITY AUDIT REQUIRED`.

---

## 7. Owner bootstrap

`GRACZ_OWNER_USER_ID`

Declared purpose in `.env.example`:

- one-time Owner role bootstrap,
- target account must already exist,
- once an Owner exists, the value must not promote additional accounts automatically.

This is security-critical configuration.

Full audit must verify:

- exact consuming code,
- one-time semantics,
- restart behavior,
- behavior when value changes,
- behavior with malformed/nonexistent user ID,
- audit event generation,
- whether production should remove/empty this variable after bootstrap.

Status: `SECURITY-SENSITIVE / CONSUMER & AS-BUILT REVIEW REQUIRED`.

---

## 8. Security alerting

`SECURITY_ALERT_WEBHOOK`

Declared as optional HTTPS alert receiver.

Required properties before production claim:

- HTTPS only,
- no credentials/private message contents in payload,
- bounded timeout,
- failure must not crash authoritative game state,
- failures should be observable,
- webhook URL itself treated as sensitive configuration.

Current exact operational wiring: `TO BE VERIFIED IN FULL AUDIT`.

---

## 9. HTTP/server constants currently code-defined, not ENV-defined

Current `main.js` sets:

- `requestTimeout = 20_000 ms`,
- `headersTimeout = 10_000 ms`,
- `keepAliveTimeout = 5_000 ms`,
- `maxHeadersCount = 100`,
- Auth token TTL = `3600` seconds,
- fixed security headers/CSP/HSTS policy.

These are configuration-like constants but not currently environment variables.

Lead decision for each should later be:

- keep code-fixed as invariant,
- make configurable within bounded validated range,
- or move to environment-specific deployment configuration.

Do not make them configurable automatically; unnecessary knobs increase risk.

---

## 10. Environment matrix

### Development

Allowed current characteristics may include:

- `NODE_ENV=development`,
- no PostgreSQL with file/memory fallbacks,
- encryption keys optional except `AUTH_SECRET`,
- mail provider optional,
- Turnstile may be absent.

### Test

- controlled test secrets only,
- disposable PostgreSQL where integration tests require it,
- no production credentials,
- provider calls mocked/stubbed where appropriate.

### Staging

Target policy (not AS-BUILT verified):

- PostgreSQL durable backends,
- dedicated non-production secrets,
- same security modes as production where possible,
- external providers sandbox/non-production configuration,
- no sharing of production encryption material.

### Production

Target/current code requirements include:

- `NODE_ENV=production`,
- valid `AUTH_SECRET`,
- dedicated message/attachment/MFA encryption keys,
- durable PostgreSQL expected by architecture,
- least-privileged DB credentials,
- verified Turnstile configuration for protected flows,
- mail provider if mail-dependent user journeys are enabled,
- separate backup encryption material,
- secure secret-manager storage.

Actual production values/state are **NOT VERIFIED BY THIS DOCUMENT**.

---

## 11. Fail-closed / fail-open classification

| Area | Current/target behavior |
|---|---|
| invalid `PORT` / `NODE_ENV` | fail closed at startup |
| missing/weak `AUTH_SECRET` | fail closed at startup |
| missing dedicated encryption keys in production | fail closed at startup |
| duplicate/reused encryption keys | fail closed at startup |
| missing `DATABASE_URL` | fallback behavior exists; acceptable for dev, production policy must explicitly forbid critical non-durable mode |
| mail provider missing | mail action fails closed with service error |
| Turnstile missing in production protected flow | expected fail closed; exact end-to-end verification required |
| backup encryption key missing | DR workflow must fail closed |
| shared PostgreSQL request limiter unavailable when required | application security path designed fail closed; verify in full audit |

---

## 12. Prohibited documentation practices

Never place in repository documentation:

- actual secret values,
- production database passwords,
- API keys,
- MFA seed material,
- backup passphrases,
- auth tokens/cookies,
- private webhook secrets,
- copies of environment dumps containing secrets.

Evidence should record only variable presence policy, key IDs/fingerprints where safe, validation result and rotation metadata.

---

## 13. Open configuration gaps for full audit

1. Exhaustive consumer mapping for every `.env.example` variable.
2. Explicit production prohibition/guard for file/memory authoritative fallbacks.
3. `PUBLIC_BASE_URL` runtime consumer confirmation.
4. `AUDIT_HASH_SALT` exact validation/consumer contract.
5. Turnstile end-to-end fail-closed and hostname/header-trust validation.
6. `GRACZ_OWNER_USER_ID` one-time bootstrap semantics.
7. `SECURITY_ALERT_WEBHOOK` exact wiring and privacy behavior.
8. Secret rotation/lifecycle document.
9. Staging/production actual environment inventory without secret values.
10. Configuration drift detection between deployment and repository expectations.

---

## 14. Current conclusion

```text
ENVIRONMENT CATALOG = BASELINE CREATED
SOURCE = CURRENT MAIN ad073919...
CENTRAL CONFIG VALIDATION = PARTIAL BUT STRONG FOR CORE CRYPTO SETTINGS
PRODUCTION VALUES = NOT RECORDED / NOT VERIFIED
PRODUCTION FALLBACK POLICY = REQUIRES FULL AUDIT
SECRET VALUES IN DOCUMENTATION = PROHIBITED
MERGE / DEPLOY = NOT AUTHORIZED
```
