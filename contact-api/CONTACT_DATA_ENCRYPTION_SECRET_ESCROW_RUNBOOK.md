# Contact encryption secret escrow runbook

Status: **PLANNED — verification required before production backfill**

This runbook defines the recovery-copy requirements for
`CONTACT_DATA_ENCRYPTION_SECRET`.

It does **not** authorize reading the secret into logs, GitHub, CI output, chat,
tickets, documentation, screenshots, or source control.

## Why escrow is required

The encrypted `contact_cases` metadata is protected by application-layer
AES-256-GCM using the production `CONTACT_DATA_ENCRYPTION_SECRET`.

A database backup without the exact encryption secret is insufficient for
recovering encrypted contact metadata.

Therefore production backfill remains blocked until an independent recovery copy
of the existing production secret has been verified outside the running Render
service.

## Current evidence

Production startup has already confirmed:

- durable persistence is enabled;
- contact-data encryption is configured;
- a real post-cutoff contact row was written successfully;
- that row's ciphertext authenticated successfully with the currently deployed
  production key.

This proves the runtime key is operational. It does **not** prove that an
independent recovery copy exists.

## Escrow requirements

The escrow copy must:

1. contain the exact current production `CONTACT_DATA_ENCRYPTION_SECRET`;
2. exist outside the running Render service;
3. be stored in an operator-controlled password manager, secret vault, or
   equivalent encrypted secret store;
4. be recoverable without depending on Render being available;
5. be protected by strong account authentication and recovery controls;
6. never be committed to Git;
7. never be pasted into GitHub issues, pull requests, CI variables, logs, chat,
   email, or documentation;
8. never be embedded into database backups;
9. remain separate from `CONTACT_REPLY_SECRET`,
   `NEWSLETTER_SECRET`, `NEWSLETTER_CONSENT_HASH_SECRET`, API keys, and
   passwords.

## Verification procedure

The operator must verify escrow without exposing the secret value.

1. Open the Render environment settings for `gracz-contact-api`.
2. Confirm the variable name `CONTACT_DATA_ENCRYPTION_SECRET` exists.
3. Do not copy the value into notes, source control, terminals with command
   history, or chat.
4. Store the exact value in the approved secure vault/password manager.
5. Close Render.
6. Open the recovery copy from the secure vault.
7. Verify that the recovery copy is present and accessible.
8. Do not compare by printing either value to logs.
9. Record only:
   - escrow status: PASS/FAIL;
   - verification date;
   - vault/provider name if desired;
   - operator identity if operationally required.
10. Never record the secret itself.

## Stronger verification option

If the operator can perform a controlled local comparison without exposing the
secret, compare cryptographic fingerprints locally:

- compute SHA-256 of the Render value in a trusted local session;
- compute SHA-256 of the escrow copy in the same trusted local session;
- compare the fingerprints;
- do not store either secret;
- do not store the fingerprint in public logs or issues;
- record only whether the comparison matched.

A fingerprint match verifies equality while avoiding disclosure of the secret
itself.

## Rotation rule

Do **not** rotate `CONTACT_DATA_ENCRYPTION_SECRET` as part of:

- the Render Postgres Free-to-paid upgrade;
- backup creation;
- restore rehearsal;
- contact-data backfill;
- migration 005 preparation.

A future key rotation requires a separate audited design because existing
ciphertext must remain decryptable.

## Recovery rehearsal

Before production backfill:

1. verify database recovery capability according to
   `RENDER_POSTGRES_UPGRADE_RUNBOOK.md`;
2. verify this escrow gate;
3. confirm the recovery copy can be retrieved by the operator;
4. confirm application/decryption verification still succeeds with the active
   production secret;
5. keep the secret outside logs and source control.

The recovery rehearsal must demonstrate that both required assets exist:

- recoverable database state;
- recoverable encryption secret.

## PASS criteria

Escrow gate is PASS only when all of the following are true:

- runtime encryption remains healthy;
- the exact existing production secret has an independent secure copy;
- the operator can retrieve that copy;
- the copy is outside Render;
- no secret value was exposed during verification;
- no key rotation occurred;
- the recovery procedure is documented.

## STOP conditions

Status remains **HOLD** if any of the following applies:

- no independent secret copy exists;
- the operator cannot retrieve the copy;
- it is uncertain whether the copy matches the current production secret;
- the secret was rotated without a dedicated migration plan;
- the secret appears in source control, logs, tickets, chat, or screenshots;
- the only copy exists in Render;
- recovery of the database has not yet been verified.

## Backfill gate

Only after both:

- this escrow gate is PASS; and
- the database recovery gate in
  `RENDER_POSTGRES_UPGRADE_RUNBOOK.md` is PASS

may the operator proceed to the controlled production backfill described in
`PRODUCTION_BACKFILL_RUNBOOK.md`.

Migration 005 remains a separate future gate.
