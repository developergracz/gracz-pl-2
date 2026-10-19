# PR #281 corrective delta R2 — Claude handoff

Baseline for this review ONLY: f17158cd1c07dca93657fc8c805f17ecb64cfe99.
The PR receipt records the new exact HEAD and CI results. Review baseline..HEAD,
not main..HEAD. Prior reports describe earlier revisions; this delta supersedes
inert-manager-only PG characterization and retry-on-503 UI behavior.

## P2 corrections

1. Production import boundary: Acorn (exact dev dependency 8.15.0) parses the full
   transitive server graph without executing modules. Static imports, side-effect
   imports, re-exports and literal dynamic imports are traversed. Computed imports,
   unreviewed external dependencies, require/createRequire/eval, paths outside the
   backend and symlink-resolved legacy/test modules fail closed. Node builtins and
   pg are reviewed terminal dependencies. Mutation fixtures demonstrate rejection
   through indirect, re-export and dynamic edges. This is a regression boundary,
   not a sandbox against malicious source changes or compromised dependencies.
2. Real HTTP + PostgreSQL: replace inert manager calls in the existing deterministic
   2/32/1 fixture with the actual server.mjs child process using the disposable DB.
   No legacy hook is installed. Both genuine process starts receive pause=false
   and synthetic legacy secrets. Readiness and 5 newsletter endpoints reject all
   n1/ns1/n2 synthetic tokens. Every public table is compared byte-for-byte through
   stable JSON snapshots after EACH action and shutdown. This includes contacts,
   append-only events, provider blocking, reservations, idempotency_keys (budgets,
   spent proofs, uncertain dispatches and cutover marker) and migration registries.
   Local provider trap sees zero calls; logs exclude fixture mailbox and tokens.
3. Key lifecycle policy: **active-only issuance AND verification**. Retired means
   administratively withdrawn from use; compromised means suspected/known exposure.
   Both have identical denial semantics here, including unsubscribe. There is NO
   retired verification grace period. Fresh active replacement is mandatory for
   every purpose; absent replacement fails ring construction. Eight additional
   tests cover both states across confirm/unsubscribe/status/identity, old-envelope
   refusal and fresh active use. n1/ns1 never regain trust. Identity replacement
   creates only an offline digest, never an alias or an active subscriber.
   The immutable keyring snapshot has no hot revocation: future operational
   retirement must stop all old instances and replace the snapshot before restart.
   This module remains offline/unwired; no production lifecycle is implemented.
   Verified withdrawal continuity remains an activation HARD HOLD, not a reason
   to accept compromised or retired bearers.
4. UI: HTTP503 and rejected 4xx action responses clear the in-memory action token,
   disable/hide the action control and do not invite another attempt. 503 explicitly
   says no subscription change is confirmed and not to retry now. Contact is a
   request requiring verification/handling, never a completed withdrawal claim.
   Ambiguous transport/5xx handling otherwise stays within existing scope. Browser
   tests assert one request, no false completion, no retry control, accessible focus
   and denial even after a synthetic click on the disabled element. Cache revision
   changes only the newsletter page asset reference.

## P3 corrections

- Remove public recoveryHeld readiness flag; preserve the established four-field
  fail-closed readiness contract. No exposure of internal incident state is needed.
- npm run check now discovers every first-party backend .mjs module recursively,
  including all new crypto, test-support, integration and check modules, excluding
  node_modules. Missing syntax coverage no longer depends on a manual long list.
- Name the legacy fixture factory createLegacyFixtureManager. The isolated test
  entrypoint has an explicit bridge alias to the production interface; the actual
  fixture no longer claims to be held. All guards stay unchanged. Full legacy
  R4/R5 process regressions continue to run on PG16 and PG18.

## Verification / review boundary

Commands: npm test and npm run check in contact-api; both
scripts/test-newsletter-option-b-pg.sh 16/18; existing Playwright newsletter config;
maintenance/Premium node tests; SEO/CSP gates; redacted Gitleaks scan of R2 commit.
Exact counts and run URLs are in the PR receipt. New 503 tests were observed failing
against the previous UI before the fix. Public readiness test failed with the old
extra flag. Import graph fixtures explicitly test guard failures.

No production migration/runtime activation, real email, configuration/DNS/Resend
change, merge or deploy. Historical SQL, migration checksums and persistence logic
are unchanged. No recovery/alias/verified-withdrawal engine implemented. HARD HOLD
and all missing Owner evidence remain. READY FOR DELTA AUDIT refers ONLY to this
corrective delta; it is not production readiness or a claim of Claude approval.
