# Newsletter gracz.pl — new-only DOI release

**Scope:** New addresses submitted AFTER activation and confirmed through a NEW one-time mailbox token. Historical subscriptions and the legacy n1/ns1 manager stay untouched and held. No historical import and no bulk marketing sends.

## Required release actions only

1. Restore/backup evidence: confirm an independently restorable production snapshot or valid PITR recovery before writing the database. Privately apply `001_new_only_doi.sql` once; grant the contact API role only its documented SELECT/INSERT/UPDATE privileges.
2. Generate **two different**, truly random 32-byte base64url secrets, offline or inside Render private settings, and configure `NEWSLETTER_NEW_ENCRYPTION_KEY` and `NEWSLETTER_NEW_SUBJECT_KEY`. Never reuse any legacy newsletter/contact/withdrawal secret. Keep `NEWSLETTER_INTAKE_PAUSED=true` and preserve the legacy `createHeldNewsletterManager()`.
3. Confirm the existing Resend **send-only** `RESEND_API_KEY` and sender `EMAIL_FROM` can deliver one transactional confirmation. Set `NEWSLETTER_NEW_ONLY_ENABLED=1` only after schema/privilege readiness. The existing public readiness endpoint activates **new subscribe only**, not old status links, old opt-out tokens, or contact-modal opt-in.
4. Use ONE newly controlled mailbox: submit the form, receive and explicitly click the `ni3` link, observe the confirmed first-party consent record and no replay/duplicate activation; verify public status errors for retired `n1`/`ns1` links. Revert the enable flag to 0 if any step fails.

## Explicit boundary

The dedicated `newsletter_new` ledger stores encrypted mailbox data, a purpose-keyed mailbox tag, a one-time challenge digest and an append-only confirmation event. No history is read, imported or deleted.

**No Resend marketing segment synchronization or campaigns are enabled by this PR.** Before sending a future newsletter, implement and verify a separate new-only recipient egress which checks revoked permissions and provider suppressions, and connects confirmed new-only ledger records to an isolated Resend audience. Until then, `active` means confirmed consent in the first-party ledger, NOT authorization to mail an old Resend audience.

Unsubscribe via the existing dedicated recipient-verification flow remains separately governed. Existing contact form, withdrawals and old records are unchanged. Leave marketing sends OFF until withdrawal outcomes are enforced against the new-only ledger.
