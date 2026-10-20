# Newsletter campaigns — foundation R1 (DRAFT, NOT LIVE)

This is the first, non-sending coding stage for the Owner-approved campaign module.

## Scope of this change
- Validate subject, plain-text body, and the sole intended audience scope `confirmed_active_new_only`.
- Produce an HTML-escaped brand preview with explicit PREVIEW_ONLY_NO_SEND status.
- Fail closed on any attempt to dispatch. No endpoints, database migrations, Resend sends, UI send controls, or environment changes in this change.
- Run focused unit tests for draft validation, header-injection rejection, audience enforcement, and HTML escaping.

## Candidate database structure (not deployed)

The file `schema-r1.sql` defines draft/approval state and a unique campaign–recipient dispatch record. It is a schema candidate only: no migration runner invokes it, no sender can use it, and no production data is altered. The durable transition algorithm, consent fencing and recovery protocol are deliberately not yet implemented.

## Resend adapter (not wired, not enabled)

`resend-transport.mjs` is an internal, disabled-by-default transport adapter. It sends only if explicitly instantiated as enabled by a future, authorized dispatcher; no production component instantiates it. It adds an idempotency key and requires an unsubscribe URL, but this URL **must first be generated and validated through the deployed verified-withdrawal flow**. Do not invent unsubscribe tokens or claim a form visit is an immediate unsubscribe. The user must complete the existing verification flow. The adapter's email-address availability requires separately proven decryption and privacy controls. The consent check and the durable one-way `claim_delivery` transaction must be committed before any external request. Only the actual mail provider receipt can mark an attempt accepted; unknown states are held, not retried.

## Required implementation before a release
1. Finish the database candidate with immutable dispatch audit and controlled state transitions, durable campaign-recipient idempotency, explicit owner approval and recovery after uncertain Resend response.
2. Recheck confirmed opt-in and latest withdrawal/suppression immediately before each send; never send to historical contacts or pending/unsubscribed recipients. Consent purpose and permitted communication must match.
3. Resend transaction integration with bounded concurrency, safe retry only when non-delivery is proven, provider metadata reconciliation, and unsubscribe handling in each actual message.
4. Private OWNER CSRF-protected draft, test-send, approval, and history routes plus the Full Max Premium interface, with separate test/live gates.
5. Relevant CI tests; manual release authorization and production smoke check. Default dispatch disabled until all gates pass.

Owner R1 remains strictly read-only. This branch does not override that release boundary.
