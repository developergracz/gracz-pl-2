# CONTACT FORM SECURITY MAX R1

This module protects the public contact form and its delivery path.

## Implemented controls

- strict origin allowlist and method allowlist
- JSON-only requests with a 16 KB request limit
- server-side schema-style validation and input length limits
- hardened email syntax validation
- DNS MX verification with timeout and cache
- common email-domain typo detection
- disposable-email denylist
- administrative contact address cannot be used as visitor identity
- Resend `reply_to` points to the validated visitor address
- IP rate limiting
- hashed-email rate limiting
- honeypot
- minimum form completion time and form expiry
- duplicate-content detection
- cryptographic client idempotency key and server-side replay cache
- race-safe in-flight idempotency reservation
- conservative anti-spam content checks
- risk scoring for suspicious submissions
- temporary abuse strikes / blocking
- optional adaptive Cloudflare Turnstile verification
- mail-provider circuit breaker
- privacy-reduced logs (email hash, not full email)
- API security headers and no-store responses

## Optional adaptive challenge

Turnstile is dormant unless both variables exist:

- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_SITE_KEY`

Risk threshold variables:

- `RISK_CHALLENGE_THRESHOLD` (default 55)
- `RISK_BLOCK_THRESHOLD` (default 85)

Without Turnstile configuration, ordinary submissions continue to work. Very high-risk submissions may still be blocked by the local risk engine.

## Existing mail variables

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `CONTACT_TO`

## Deployment rule

Do not merge or deploy this branch solely because CI is green. Before production:

1. independent security audit
2. mail-delivery audit including Reply-To
3. browser-runtime test from gracz.pl
4. verify valid WP/Gmail/Outlook addresses
5. verify invalid syntax, no-MX domain, disposable address, admin address, too-fast submit, duplicate submit and rate-limit paths
6. confirm Resend delivery and that Reply sends to the visitor
7. if Turnstile is enabled, test challenge success/failure and update frontend CSP before enabling it

## WAF / edge readiness

The API is compatible with an upstream WAF/reverse proxy. A future edge layer should restrict direct backend access at infrastructure level rather than trusting a browser-supplied secret header.
