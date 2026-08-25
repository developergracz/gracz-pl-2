# Gracz.pl — Security implementation status (2026-08-24)

This document is the implementation checklist for the modern Node/PostgreSQL platform. It distinguishes code that is present in the repository from controls that must be enabled in external infrastructure.

## Implemented in code

- Central `TokenService`: random high-entropy tokens, SHA-256 hashes only in persistent storage.
- Newsletter double opt-in: pending confirmation, hashed confirmation token, expiry, resend cooldown, hashed position token and hashed unsubscribe token.
- Newsletter anti-abuse: IP + identity rate limits, Turnstile verification, production host allow-list to prevent bypass through the Render hostname.
- Progressive brute-force lockouts for authentication attempts.
- Central `SecurityService`: trusted proxy/IP resolution, same-origin CSRF checks, Turnstile and generic rate limiting.
- Registration and password-reset flows require Turnstile in production and fail closed if it is not configured.
- Session registry: one-hour absolute token lifetime, 30-minute idle timeout, revocation on logout/password reset, HttpOnly/Secure/SameSite Strict `__Host-` cookie.
- Central append-only `AuditService`; UPDATE/DELETE are blocked by a PostgreSQL trigger. Sensitive fields are excluded and IP/User-Agent are fingerprinted.
- Security events cover authentication outcomes, account changes, password reset, message send/delete, role changes, MFA, HTTP security failures and privileged operations.
- RBAC roles: player, moderator, administrator, owner. Privilege escalation rules prevent administrators from assigning owner.
- Safe first-owner bootstrap through `GRACZ_OWNER_USER_ID`; it works only when no owner exists and the account already exists.
- TOTP MFA service for privileged users. Once MFA is configured, moderator/administrator/owner logins require the TOTP code; privileged admin operations always require MFA.
- Separate privileged `/admin/security/*` API and protected panel; player accounts are rejected.
- Separate encryption secrets supported for authentication, private messages, attachments and MFA.
- Private messages encrypted at rest; moderation wrapper blocks active HTML/script patterns, credential-phishing phrases and link spam before sending.
- Upload controls: PNG/JPEG only, MIME + extension + magic-byte validation, 1 MiB limit, randomized storage name, encrypted AES-256-GCM storage, no executable upload path.
- Moderation decisions plus an appeal data model. Automatic filters do not directly issue permanent bans.
- Runtime security anomaly monitoring hook for 401/403/429/5xx spikes with an optional alert webhook.
- Restrictive HTTP security headers and CSP. `unsafe-inline` is still temporarily retained for scripts/styles because the legacy lobby contains inline code; removing it is a tracked compatibility refactor rather than silently breaking the site.
- CI security gate: syntax/tests, npm production CVE audit, Gitleaks secret scan, CodeQL.
- Dependabot for npm and GitHub Actions.
- Environment separation supported through `NODE_ENV`; production secrets documented separately in `.env.example`.
- Encrypted PostgreSQL backup and restore-test scripts included in `modern/checkers-engine/ops`.
- Least-privilege PostgreSQL runtime-role template included. A separate migration role is required before enforcing it in production because legacy modules still perform startup DDL.

## External controls that must be enabled before production sign-off

These cannot be truthfully marked complete by changing source code alone:

1. **Cloudflare Turnstile** — create the production widget and set `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_HOSTNAME=gracz.pl` in the production secret manager.
2. **Cloudflare/Render origin protection** — users should enter through `gracz.pl`; direct Render production host should not expose protected public mutations. Application code already rejects newsletter mutations on unapproved production hosts.
3. **GitHub repository settings** — enable native GitHub secret scanning/push protection where available and require Security Gate/CheckersEngine checks before merging to protected `main`.
4. **Backups** — schedule `backup-postgres.sh`, store encrypted copies outside the primary Render database/account, define retention, and run `test-restore-postgres.sh` regularly against a disposable database.
5. **Database roles** — finish extracting startup DDL into migrations, then use separate migration and runtime roles. The runtime app role must not be superuser/owner.
6. **Monitoring destination** — configure `SECURITY_ALERT_WEBHOOK` or connect the security events to the chosen monitoring platform.
7. **Environment isolation** — use separate databases, secrets, mail credentials and Turnstile configuration for development, staging and production. Never copy production user data into test environments.
8. **Mail authentication** — validate SPF and DKIM first. Deploy DMARC in phases: `p=none` for observation, then `p=quarantine`, finally `p=reject` after legitimate mail streams are aligned.
9. **Restore evidence** — keep dated restore-test records. A backup is not accepted as reliable until restore is tested.
10. **Owner bootstrap** — set `GRACZ_OWNER_USER_ID` only for the intended initial owner account, verify the owner role, configure TOTP, then remove the bootstrap variable from production if desired.

## DMARC staged records

Do not copy blindly until SPF/DKIM are confirmed for every legitimate sender.

Observation phase:

`_dmarc.gracz.pl TXT "v=DMARC1; p=none; rua=mailto:dmarc@gracz.pl; adkim=s; aspf=s; pct=100"`

Enforcement phase after reports are clean:

`_dmarc.gracz.pl TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@gracz.pl; adkim=s; aspf=s; pct=100"`

Target state:

`_dmarc.gracz.pl TXT "v=DMARC1; p=reject; rua=mailto:dmarc@gracz.pl; adkim=s; aspf=s; pct=100"`

## Production sign-off rule

Production security is not considered complete until code controls, external configuration, backup restore evidence, MFA for every privileged account and required CI branch protections have all been verified.
