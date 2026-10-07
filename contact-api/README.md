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


## Render client IP trust model

- Use `X-Forwarded-For` for the client IP on Render.
- Treat the first valid address as the real client address, per Render's documented behavior.
- Do not trust `CF-Connecting-IP` directly in application code.
- The public `.onrender.com` endpoint remains reachable, so Origin/CORS is not an authentication boundary.


## GRACZ.PL PREMIUM MAIL RESPONSE R1

This layer turns administrator replies into branded transactional messages instead of plain mailbox replies.

### Flow

1. A visitor submits the public contact form.
2. The owner receives a branded administration email.
3. If `CONTACT_REPLY_SECRET` is configured, that email contains **Odpowiedz przez gracz.pl**.
4. The link opens `/kontakt/odpowiedz/#token=...`.
5. The token stays in the URL fragment, is removed from browser history immediately, and is never sent to the static-site HTTP server.
6. The reply page retrieves only a masked recipient and ticket metadata from the API.
7. The owner writes a reply.
8. The API validates the encrypted token and sends a branded HTML + plain-text email through Resend.
9. The recipient can reply normally; `Reply-To` points back to `CONTACT_TO`.

### Security properties

- AES-256-GCM encrypted/authenticated reply tokens
- independent secret: `CONTACT_REPLY_SECRET` (minimum 32 characters)
- 7-day token expiry
- one-send reservation in the running instance plus provider idempotency
- recipient email is not exposed in the reply-page HTML or JavaScript
- recipient shown in the UI is masked
- token is carried in URL fragment, not query string
- reply page is `noindex,nofollow,noarchive`
- `Referrer-Policy: no-referrer` on the reply page
- no analytics/cookie scripts on the reply page
- strict Origin/CORS checks
- separate reply-panel IP rate limit
- 16 KB request-body cap
- reply body limited to 5000 characters
- all dynamic HTML is escaped
- reply API logs only hashed recipient identity, request IDs and provider IDs
- Resend idempotency key is derived from the encrypted token's random JTI

### Required production variable

`CONTACT_REPLY_SECRET`

Generate it from a cryptographically secure random source. Do not reuse `RESEND_API_KEY`, passwords, or any user credential.

If this variable is absent, the existing contact form still works and the admin mail remains deliverable, but the secure premium-reply button is disabled.

### Production acceptance test

After deployment:

1. submit one real contact message from a non-administrative mailbox;
2. verify the owner email is branded and contains **Odpowiedz przez gracz.pl**;
3. open the button and confirm the UI shows only a masked destination address;
4. send a test answer;
5. verify the recipient receives the branded gracz.pl HTML email;
6. verify plain-text fallback exists;
7. click Reply in the recipient mailbox and confirm it targets `CONTACT_TO`;
8. reuse the original secure link and confirm the API rejects the second send.
