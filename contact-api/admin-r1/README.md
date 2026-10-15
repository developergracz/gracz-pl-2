# Newsletter Admin R1 — inert read-only skeleton

**Not production ready. Authentication NOT implemented. No route mounted in the
business server.** `deny.mjs` unconditionally returns 403; it has no enable switch.
UI files are outside the published website roots. Do not publish this directory.

- `provider.mjs`: injected GET-only Resend-shaped transport, max 10 contacts and
  21 requests/page, per-call timeout, strict page validation. Missing suppression
  proof never means active. No default fetch, key, environment lookup or live client.
- `service.mjs`: one-page search/filter, opaque five-minute cursors and detail
  handles (max 200 each), rate limit, page counts, nullable global/pending counts,
  minimized HMAC-matched consent. No database writes or plaintext persistence.
  Create one instance per future approved session and clear on logout. No such
  session factory exists yet. The transport and consent/audit sink are injected.
- `deny.mjs`: permanent denial and private response headers. All future production
  mounting and authentication is held for independent review.
- `ui/`: responsive Polish dark/turquoise UI, explicit synthetic banner, accessible
  labels/dialog, cursor paging, bounded filters, provider-health and missing states.
- `testing/preview.mjs`: test-only server, fixed 23 `example.test` contacts, strict
  loopback Host/Origin checks; private routes still deny. It never reads credentials,
  imports business server or uses a real provider/database. Not an auth bypass for
  real data. No production startup/build command imports it.

Run unit + HTTP checks: `npm --prefix contact-api test`.
Run local synthetic preview: `node contact-api/admin-r1/testing/preview.mjs`
(open `http://127.0.0.1:4179`). No public bind option.
Browser checks: install `@playwright/test` in a disposable tools directory, then
`playwright test -c tests/newsletter-admin/playwright.config.cjs`; use NODE_PATH if
installed outside the repo. Optional `CHROMIUM_EXECUTABLE_PATH` selects an existing
local browser. Tests are desktop/mobile Chromium, not full cross-browser approval.

No production Resend contract verification is claimed. Transport must enforce
streaming 64 KiB bounds, honor AbortSignal, use a fixed approved provider origin,
validate least-privilege credentials and handle snapshot consistency before release.
No automatic provider retries or global scans. Page search is deliberately partial;
empty filtered pages keep the next cursor. Unknown provider state is distinct from
unsubscribed. A pending consent record is displayed only in matched detail; no
invention of pending plaintext addresses. Consent read errors preserve provider
state with explicit evidence-unavailable quality.

The security proposal and acceptance register live under
`docs/features/NEWSLETTER-ADMIN-R1-IMPLEMENTATION/`. Migration 005 remains HARD HOLD.
