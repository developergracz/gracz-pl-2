# Newsletter F-03 implementation plan

Goal: implement #257 without changing R5.2 runtime, candidate SQL, normal migrator or CONTACT CONTRACT reservation.
Spec: https://github.com/developergracz/gracz-pl-2/issues/257 (including Owner priority comment).
Architecture: explicit offline executor, dedicated newsletter ledger and immutable candidate digest; transactional schema/seal/ledger installation; operator evidence binds release to target and code. No automatic build/start integration.

- [x] Add failing integration cases for isolated install/repeat, corruption, rollback/restart, target/evidence refusal and 005 namespace coexistence.
- [x] Implement `persistence/newsletter-migrator.mjs` and `newsletter-migration-preflight.mjs`. Keep candidates/005 byte-identical; namespace identity `newsletter/001_opt_in_requests` is independent of global numbering. Validate baseline checksum registry, complete newsletter catalog and seal. Refuse orphan/partial installs.
- [x] Route disposable test helper through new executor so existing B1/B2 concurrent tests exercise it; run complete backend and PG16/18 suites. Extend existing CI matrix.
- [x] Write exact public-release runbook and evidence template; pin #254/#255 and include #253 compatibility. Review new delta independently, resolve important findings, publish one DRAFT PR.

Review focus: target overrides, stale/fabricated evidence versus actual operator proof, lost commit response, schema drift after successful install, unexpected registry rows. Tests must cover technical refusal; documents must distinguish attestations from verified external facts.

Execution ruling: proceed inline under existing Owner implementation mandate, using the clean dedicated task checkout and new branch. No planning approval pause or production actions. Final delta review only; no repeat full audit.

Progress: baseline backend82/82; first missing-executor regression failed, then isolated install passed. Six migration regressions and two preflight tests pass. Full local PG16/18 each108/108 (including nested/memory cases). Added driver host/port/user binding. Runtime and candidate SQL remain unchanged. Final delta review and GitHub CI pending.

Final implementation: backend84/84, PG16/18 each111/111, footer5/5, syntax/SEO/CSP/diff PASS. Independent delta reviewer P1 UNLOGGED reproduced RED then fixed GREEN; full suites rerun. Effective-port substitution covered. Lost-COMMIT transport coverage limitation documented without overstating the fresh-pool test. DRAFT publication and CI recorded in PR handoff.
