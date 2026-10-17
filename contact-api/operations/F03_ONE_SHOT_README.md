# F-03: one guarded operator invocation (2026-10-17)

Implementation is NOT proof of execution. The one-shot Node program validates real external release evidence, verifies the pinned legacy snapshot and no competing sessions, then installs the isolated schema and imports history before any business writer starts.

Known verified data: 2 newsletter contacts, 32 consent events, 1 confirmed event; newest event 2026-10-15T19:29:31.474Z. Separate registry digest 12bf844cedef7c9b3dd4dba578f50435b9a763996c56abed3934f269e9494f1f, with four baseline rows. The intended immutable exclusive import cutoff is 2026-10-15T19:29:32.000Z.

Last observed Render state: F-02 maintenance API live, external DB allowlist empty, autoDeploy disabled, one session inspection with no other clients. This snapshot does not prove all-writer permanent retirement. The Owner's local isolated backup restore was reported PASS; secret escrow equivalence to production remains HOLD.

NOT AUTO-AUTHORIZED: Real operator evidence must meet every requirement in newsletter-migration-preflight.mjs, with current truthfully verified references and digests, including backup/secret escrow, full writer retirement, pending launches and uncertain provider deliveries. Store this restricted JSON outside the checkout. Never paste credentials or the JSON into a chat. A manufactured receipt is prohibited.

Only after the verified receipt exists, in the clean reviewed private Render checkout, with the existing pg dependency and secrets already available to the operator:

Read-only offline evidence preflight (no DB connection):

NEWSLETTER_MIGRATION_DATABASE_URL="$DATABASE_URL" F03_PRIVATE_RENDER_TLS_EXCEPTION=GRACZ_F03_RENDER_PRIVATE_TLS_R1 node contact-api/operations/newsletter-f03-one-shot.mjs --preflight /restricted/release-evidence.json

Single execute only after independent operator execution GO (does write schema and import):

NEWSLETTER_MIGRATION_DATABASE_URL="$DATABASE_URL" F03_PRIVATE_RENDER_TLS_EXCEPTION=GRACZ_F03_RENDER_PRIVATE_TLS_R1 NEWSLETTER_MIGRATION_CONFIRM=INSTALL_NEWSLETTER_SCHEMA node contact-api/operations/newsletter-f03-one-shot.mjs --execute /restricted/release-evidence.json

PINNED HISTORY: If any contact/event/confirmed count or newest event changes, stop before migration and re-review the release boundary. The script never sends email, resumes an uncertain provider call, launches a writer, adjusts Render settings or activates public intake.

POST-IMPORT: Keep maintenance API until the separate Render business build/start settings can be safely changed. Start the new backend with NEWSLETTER_INTAKE_PAUSED=true, verify schema readiness and matching frontend, then separately enable public intake. Current Render connector cannot change build/start settings, so no claims of production activation without platform evidence.

On failure after a committed schema install, preserve the additive schema and cutover seal, and seek fresh evidence before re-running. Never run global CONTACT migration 005, manually paste SQL, clear pending email reservations, or resurrect the old writer.