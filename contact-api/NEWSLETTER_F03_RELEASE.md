# F-03 — controlled public newsletter release (#257)

Implementation artifact only. **NO MERGE / NO DEPLOY / NO PRODUCTION SQL / NO LIVE
RESEND / NO RENDER MUTATION** authorized by this document. Public B1/B2 release
has no dependency on #258, WebAuthn or the administrator panel.

## What changes, and what stays authoritative

Base: #254 R5.2 `7ecb81af6a73d0eedb0340a65c880010caca0075`.
F-02 reference: #255 `5c1d37338b31ee75b65e688b8ba155102a9a6780`.
Premium footer reference: #253 `64433ad934df1754181dc2a6f788420754183e27`;
#254 already incorporates Premium validation and its tests. Do not blindly merge
#253 over #254's later newsletter controller.

This PR is stacked on #254, on its own branch. Review only this PR's delta.
Neither #254 nor #255 branch is modified. Runtime B1/B2, HMAC-only storage,
CAS, provider suppression, consent event immutability and uncertain-send holds
are unchanged. Normal `npm --prefix contact-api run migrate` is unchanged.

The new identity is `newsletter/001_opt_in_requests`, recorded exclusively in
`public.newsletter_schema_migrations`. The existing candidate bytes remain at
`persistence/candidates/005_newsletter_opt_in_requests.sql`, SHA-256
`66566f04025ab96aff2d03e3426e70a38f8d13c657a81a81c503ed00cb304b99`.
That historical filename is NOT global migration 005. No candidate is moved into
`migrations/`; no global checksum is rewritten. Table, cutover seal and separate
ledger row commit together. A repeat checks identity, schema and seal without
rewriting them; loss of the commit acknowledgement requires re-verification,
never deletion or force repair. Partial/orphan/unknown state is HOLD.

Global 001 creates contact, consent and idempotency tables; 002 extends reply
claims; 003 adds newsletter state-version/suppression; 004 only adds contact
ciphertext columns. Newsletter candidate creates one separate table and adds a
cutover marker to idempotency storage; it does not redact or alter contact data.
CONTACT CONTRACT005 is reserved for later contact plaintext redaction/constraints
(see PRODUCTION_BACKFILL_RUNBOOK.md, migration 005 entry gate). **No final CONTACT
SQL exists in this checkout**, so tests prove namespace/ledger coexistence using
an explicitly labelled simulated `005_contact_data_contract.sql` registry row,
not compatibility with unseen destructive SQL. Future actual CONTACT SQL still
requires its own review. The executor accepts that optional row only with an
explicit checksum pin (`contactContractSha256` in evidence); other extra rows fail.
Newsletter installation does not require CONTACT005 to run first.

## Executor and evidence

No package start/build/migrate hook invokes this executor. The CLI has no
ambient DATABASE_URL fallback and no automatic retry. It accepts only production
mode with a clean Git checkout, exact approved HEAD, explicit target URL, fresh
complete evidence and an execute confirmation. It requires verified TLS.
URLs with any query string/fragment are rejected (including host/db/SSL overrides).
The effective checked-out driver host/port/database/user and server database/user
are checked. Test mode is a library API limited to loopback `gracz_test` only.
It is not a production CLI switch.

Copy `operations/newsletter-migration-evidence.example.json` to restricted operator
storage **outside the checkout**. It deliberately fails validation until every
field is completed. Do not put secrets, addresses, tokens or user records in it.
Each evidence item is an operator-verified reference and SHA-256 of the restricted
artifact; these hashes are NOT digital signatures and the tool does NOT fetch or
independently validate external evidence. Owner/DB operator must inspect the actual
artifacts before marking them verified. A fabricated JSON cannot establish safety.
Keep approval delivery and DB credentials restricted to the authorized operator.

Bind the receipt to final release code HEAD, target (keys in example order), exact
candidate checksum and exact sorted registry JSON digest. `issuedAt`, `expiresAt`
and `writersStoppedAt` are UTC ISO timestamps; validity is at most one hour and
writer-retirement verification must be within one hour. Refresh evidence after an
interruption; never backdate a stop. This is an execution-window check, not a
live distributed writer fence. All launch sources must remain frozen throughout.
A server/client clock disagreement that invalidates a seal is HOLD, not permission
to edit the seal.

After separate authorization for read-only production inspection, compute the
registry digest from the canonical query result, with the same Node/pg serializer:

```js
const rows = (await database.query(
  'SELECT version,trim(checksum) AS checksum FROM public.schema_migrations ORDER BY version'
)).rows;
const registrySha256 = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
```

Use the approved private DB access path; do not open the external IP allowlist.
The production executor also requires baseline001–004 file checksums to match.

Install the existing backend dependency in the approved clean checkout with
`npm --prefix contact-api install --ignore-scripts --no-package-lock --no-audit --no-fund`.
Do not use the production build command to prepare the operator checkout.

Offline preflight (no DB connection, run from repository root):

```sh
# NEWSLETTER_MIGRATION_DATABASE_URL supplied through approved secret injection;
# never echo it or put it in command history. Receipt file is outside checkout.
node contact-api/persistence/newsletter-migrator.mjs --preflight /restricted/release-evidence.json
```

This verifies evidence structure only. It does not establish readiness or perform
schema discovery. After final Owner/DB execution GO and the gates below:

```sh
NEWSLETTER_MIGRATION_CONFIRM=INSTALL_NEWSLETTER_SCHEMA \
  node contact-api/persistence/newsletter-migrator.mjs --execute /restricted/release-evidence.json
```

Success reports only status, migration ID, SQL digest and registry digest.
Failure logs a fixed code only. A repeat returns `verified` only after schema,
ledger and seal checks. Do not copy SQL manually, use force flags, rewrite checksums,
reset a seal or treat `verified` as authorization to start writers.

## One safe integration and deployment sequence (future Owner-approved window)

1. **Approve and pin the source set**, this focused delta review, CI and the outage
   window. Keep all PRs DRAFT until the Owner separately authorizes integration.
   Record current production deployments/revisions and approved inert rollback.
   Verify DR restore rehearsal with usable backup/export/PITR capability, measured
   RPO/RTO and secret escrow (newsletter signing/hash keys and contact encryption).
   Local synthetic tests do not satisfy this production evidence.
2. **Freeze both Render services and every other launch source before any merge.**
   Owner-authorized operator disables autoDeploy, verifies actual settings-save
   behavior, cancels queued launches and controls manual deploys/rollbacks/previews,
   workers/cron/one-offs. Record actual root/source/build/start/predeploy/Blueprint
   settings. Current main build runs `npm --prefix contact-api run migrate` even
   for a frontend-only merge. Do not merge while that can launch automatically.
3. **Prepare frontend outage behavior**, with no silent request replay. Cached
   pages/direct clients still exist. Deliver pinned #255 F-02 using its independent
   syntax-only build and inert start; empty predeploy and no npm hooks. For repo
   root: `sh contact-api/maintenance/build.sh` and
   `sh contact-api/maintenance/start.sh`; for contact-api root omit `contact-api/`.
   Follow #255's SHA/digest and specific-commit delivery procedure. Confirm platform
   supports this delivery before selecting source or saving commands.
4. **Prove complete old-writer retirement**, not just `/health`200 or maintenance503.
   Inventory every replica, overlapping/draining deploy, worker, cron, preview and
   manual process. Verify actual termination grace and terminal instance evidence;
   zero pending restarts/rollback launches. Correlate authorized read-only DB
   sessions/transactions, last writes, and accepted/rejected/uncertain provider
   attempts. Record one signed last-write boundary. All business routes, including
   confirm/unsubscribe/contact opt-in, must be stopped. Pending provider delivery
   may continue; it is not permission to resend. Missing proof means HOLD.
5. **Integrate source while inert and frozen**, under separate merge permission:
   #255 first, then #254 (which includes the reviewed #253 Premium behavior), then
   this stacked F-03 PR retargeted to main after #254. Preserve #255 maintenance
   artifact/test changes and #254's later clock/security fixes when resolving any
   overlaps. Do not merge obsolete #248 or overwrite #254 with #253. Run the
   focused backend, PG16/18, footer and newsletter browser gates on the resulting
   integration HEAD; pin that HEAD in the operator receipt. If exact #253 commit
   ancestry is required by repository policy, reconcile it explicitly before this
   step; the runtime must retain #254's final controller.
6. **Back up and inspect under the stopped-writer barrier.** Confirm restorable
   backup and escrow, registry and current schema, uncertain DOI inventory and
   the exclusive import cutoff after the final legacy event. Issue fresh Owner/DB
   evidence bound to integration HEAD/target/registry. Run offline preflight, then
   explicitly execute only this isolated schema migration. Keep normal migrations
   001–004 and their ledger untouched. No CONTACT005 execution.
7. **Import legacy history before starting any new business process**, using the
   existing `importNewsletterHistory(database,{cutoverBefore,writersStopped:true})`
   from `persistence/newsletter-cutover.mjs` (or store `importHistoricalOptIns`).
   The separately approved fixed UTC cutoff must be after the last legacy event
   and no later than the installation seal. Record count and verify same-cutoff
   repeat returns0; inspect exclusions and unresolved provider attempts. The first
   R5 writer permanently closes import. Do not reset `writerStarted`, invent proof
   for unknown sends, expire their reservations, or rerun import after writer start.
8. **Deploy the pinned integrated API with intake paused.** Only now replace inert
   build/start with the reviewed business commands; verify root/hooks and that
   normal migrator applies nothing unexpected. Keep new executor out of build.
   Verify actual deployment SHA, `/health`200 and `/newsletter/ready`503 with
   `intakePaused:true` and `schemaReady:true`. `/health` alone is never release GO.
   Verify non-delivery contact/proof behavior under the approved validation plan.
9. **Deploy matching public frontend**, verify Premium footer validation, status
   panel, confirm/unsubscribe and generic errors against the matched API. After
   separate Owner enable GO, explicitly set intake enabled and require newsletter
   readiness200. Any controlled real email needs explicit authorization; none is
   sent by this task. Restoring autoDeploy is a separate final Owner decision.

At any failure: stay or return to the pinned inert artifact (or separately approved
complete suspension), verify failed/new writer retirement again, preserve additive
schema, consent/withdrawals, consumed tokens and all uncertain holds. Never roll back
to the legacy business revision, reverse SQL, or overwrite newer consent with an old
backup. A readiness failure is HOLD; it is not an instruction to retry provider sends.

## Remaining genuine release blockers

- Actual Render freeze/safe command delivery/complete all-writer retirement and
  no-restart evidence have not been obtained or executed by this task.
- Production schema/registry metadata and approved target/DB operator path remain
  unverified. No production DB connection or network change was made.
- Production restore/PITR-or-approved-recovery/export, RPO/RTO and secret escrow
  are not proven by local PG tests. No paid plan change is proposed.
- Provider uncertain DOI inventory, trustworthy last-write/import boundary and
  Owner disposition of unresolved/lost DOI must be recorded without auto-resends.
- Final integrated HEAD validation, Owner merge/execution/enable permissions and
  the production receipt are still required. This is not a deployment GO.

No #258 dependency or additional general audit is added.

## Implementation verification (2026-10-16)

Node24.19.0 local: backend84/84; full PostgreSQL16 and18 suites111/111 each;
Premium footer5/5; syntax, SEO, CSP and diff checks PASS. Zero failures/skips in
these final runs. Integration totals include nested parent and memory-adapter cases;
nine new F-03 cases exercise real disposable PostgreSQL on each version. Normal
migrator, baseline001–004, candidate SQL and B1/B2 runtime diff against #254 is empty.
`git merge-tree` against pinned #255 reports no conflicts (no branch/main merge).

One independent review of the new delta found UNLOGGED acceptance (P1). Regression
failed before the fix; executor now requires permanent control/ledger relations,
and both PG suites pass. Effective driver-port substitution is also covered.
F-03 restart tests kill an actual process before COMMIT and verify using a fresh
pool after a successful COMMIT; they do not themselves inject loss of a COMMIT
acknowledgement. Existing R5 backend-transport tests still run in the full suite.
No production verification, delivery or restore is claimed.
