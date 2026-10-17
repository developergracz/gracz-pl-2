# Newsletter F-02 — komunikat konserwacyjny i wycofanie zgody (R1)
Mode: **DRAFT / NO DEPLOY / NO MERGE**. Base: `b6e4a9bc3e3d0d1952ede20130146e7fc5501cd7`.

The current production API is intentionally inert. This change makes the public forms fail-closed by a hardcoded `NEWSLETTER_PUBLIC_INTAKE_ENABLED=false` flag (both the shared footer controller and dedicated newsletter page). It is intentionally **not** an automatic readiness probe: browser access to the maintenance `/health` endpoint cannot authorize public intake. The ordinary `/newsletter/ready` endpoint may be inaccessible cross-origin and is not a release switch.

The dedicated newsletter page visibly explains maintenance and provides the existing published contact mailbox for a **manually handled** consent withdrawal request. It does not invent an unsubscribe endpoint or claim that a sent message has already withdrawn consent. A trained operator must authenticate the requester appropriately, verify the existing subscriber record and record/process revocation through the approved private channel. During maintenance there is no automatic consent withdrawal; this is a known P1 service interruption requiring an owner-approved operational resolution, not a compliance PASS.

Link actions (confirm/unsubscribe/status) are disabled during maintenance without submitting any tokens. Users should retain the original email and not share bearer links. Future activation requires a **separate owner-approved change**, coordinated API readiness, validated database cutover, and a new cache-busting asset version on every footer-bearing page. Until that GO, keeping this gate false is intentional.

Local offline check: `node --test scripts/test-newsletter-maintenance-notice.mjs`.
No credentials, test emails, PostgreSQL writes or production mutation are needed.
