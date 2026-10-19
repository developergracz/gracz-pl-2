# PR #281 CI correction R1

Owner corrective mandate: fix PG16, PG18 and Gitleaks without relaxing Option B.
Prior audited HEAD: c1e5b65fd135d99effc508ab85c6927ec27fbfda.

## Root causes confirmed from GitHub job logs

- Maintenance SEO Gate run 39211543697, PostgreSQL jobs 117925842172 (16)
  and 117925841821 (18): Node 20.20.2 cannot import node:module registerHooks.
  The isolated legacy process harness requires Node >=22.15; production hold
  itself does not require the hook. Local validation used Node 24.19.0.
- Security Gate run 39211543757, secrets job 117925841855: one generic-api-key
  finding at test/newsletter-option-b.test.mjs:58. The literal is a deliberately
  invalid n1-format synthetic marker, submitted only to a loopback held server.
  It has no nonce/ciphertext/tag, is not read from environment or a secret store,
  and has no authority. Local Gitleaks 8.24.3 reproduced exactly one finding.

## Correction and preserved security boundaries

- Both backend workflow jobs now pin Node 24.21.0, observed in the successful
  Security Gate job. Local validation uses Node 24.19.0 (same supported major). A preflight explicitly imports registerHooks before the
  persistence suite. Production engines/runtime, guards and assertions unchanged.
- The fake bearer marker is now n1.test; its no-log assertion is updated together.
  The same endpoint matrix still verifies 503, zero provider calls and no logging.
- No Gitleaks configuration, allowlist, ignore file, rule or scan range changed.
  The PR's single implementation commit is amended so the flagged synthetic
  literal is absent from the scanned PR history, not just its working tree.
  Push uses a lease requiring the prior exact remote SHA; main is untouched.
- No runtime/security/storage/UI change. No test deletion or skip. The existing
  isolated process harness remains guarded by exact synthetic keys, loopback
  provider and disposable database checks. Full R4/R5 regression runs are required.

## Verification and exact-HEAD receipt

Local Node 24.19.0: backend 131/131, disposable PG16 and PG18 each 113/113,
zero skips. Commands: `env -i PATH="$PATH" NODE_ENV=test npm test` in contact-api;
`bash scripts/test-newsletter-option-b-pg.sh 16` and `18` at repository root.
Gitleaks 8.24.3 scans the amended commit using the same --no-merges --first-parent
parent..HEAD range as the action, with redaction and no exceptions.

The exact new SHA, independent audit and all GitHub workflow/job results are
recorded in the PR body after CI completes. Prior successful workflow results
are not substituted for results on the corrected HEAD. No production readiness
or recovery completion is implied by CI PASS.

HARD HOLD remains for unimplemented recipient recovery, alias reconciliation and
verified withdrawal; all Owner evidence and release gates from #280 remain.
NO MERGE / NO DEPLOY / NO PRODUCTION MUTATIONS / NO REAL EMAIL SENDS.

## Additional Claude audit follow-up

The maintenance revocation and Premium footer scripts are now executed by the
backend/SEO CI gate, and changes to either script trigger that workflow. No
assertion was removed. This addresses PR comment 6263188011.

Canonicalization decision before any future alias writes: legacy manager and ni2
trim the mailbox, preserve the local part exactly (including case, dots and plus
suffixes), and lowercase the domain. The old public HTTP normalizer additionally
converts an internationalized domain to ASCII before calling the manager; the
current offline ni2 primitive accepts ASCII domains only. A future verifier must
bind both original and canonical forms using a reviewed, versioned normalization
adapter; it must never guess an IDNA or Unicode-equivalent historical alias.
Case variants such as Case@example.test and case@example.test remain distinct.
No provider-specific dot/plus stripping, local-part folding or automatic merges.
Ambiguous provider treatment is QUARANTINED/NO SEND/NO NEW ACTIVE ID. Any change of
normalization version requires explicit mapping evidence and collision review.
Existing keyring tests already pin domain folding and local-part case distinction.

Future readiness must validate the separate newsletter migration ledger/checksum,
sealed import/cutover boundary, immutable imported/writerStarted markers, stopped
legacy writers and unresolved obligations, not merely table shape. Recovery proof
and withdrawal operator gates must also pass. This PR returns readiness=false
unconditionally; it neither performs nor claims those future readiness checks.

Claude audit handoff: compare the new exact HEAD against prior audited c1e5b65;
review workflow pin/preflight, mandatory revocation tests, synthetic fixture/log
assertion and this normalization decision. Confirm runtime HOLD and persistence
are unchanged. Results and exact SHA are in the PR receipt; no Claude review of
the new HEAD is claimed until that independent review actually occurs.
