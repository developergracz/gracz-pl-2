# GRACZ.PL FAIRPLAY MAX
## GFPE — TEST & VALIDATION PLAN DRAFT

**Status:** DRAFT / NOT EXECUTED / NOT FROZEN  
**Date:** 2026-09-08  
**Implementation:** NOT AUTHORIZED  
**Depends on:** GFPE-0, GFPE-1, GFPE-2 draft  
**Required reviewers:** Lead + Claude + Gemini  
**Production claim:** NONE

---

# 1. Purpose

This document defines the future test laboratory required before any FairPlay MAX implementation may be accepted.

Testing must prove more than "shuffle looks random". The campaign must separately verify:

- deterministic correctness,
- cryptographic protocol binding,
- unbiased bounded sampling,
- shuffle reproducibility,
- concurrency safety,
- restart/recovery,
- privacy projection,
- ledger/proof integrity,
- cross-language equivalence,
- statistical regression behavior.

Statistical tests are detection/regression tools and do not replace cryptographic review.

---

# 2. Test layers

Required layers:

1. known-answer vectors,
2. unit tests,
3. property-based tests,
4. fuzz tests,
5. cross-language equivalence,
6. PostgreSQL integration,
7. concurrency/multi-node,
8. restart/recovery,
9. fault injection,
10. corruption/tamper tests,
11. privacy/projection tests,
12. verifier tests,
13. statistical campaign,
14. browser/WASM verifier tests,
15. CI/security/supply-chain gates.

No single layer substitutes for the others.

---

# 3. Known-answer vectors

Before implementation freeze, create canonical vectors containing only safe test data.

Each vector should define:

```text
protocolVersion
gameType
gameRulesVersion
fairPlaySessionId
handId
serverSeed
playerSeeds[]
commitments[]
transcriptBytes/transcriptHash
HKDF inputs
shuffleKey
PRF blocks
bounded-sampling outputs
canonical pre-shuffle deck
final shuffled deck
deckCommitment
Merkle root where applicable
expected proof fields
```

Requirements:

- vector IDs immutable,
- vectors version-controlled,
- no production seeds/keys,
- Node/Rust/WASM implementations must produce identical outputs byte-for-byte.

---

# 4. Commitment tests

Mandatory cases:

- valid player commitment verifies,
- valid server commitment verifies,
- one-bit seed change breaks commitment,
- nonce change breaks commitment,
- playerId change breaks commitment,
- seat change breaks commitment,
- handId change breaks commitment,
- protocolVersion change breaks commitment,
- wrong domain label fails,
- reveal without prior commitment fails,
- duplicate commitment policy follows frozen protocol,
- reveal after phase closed fails,
- malformed encoding fails closed.

---

# 5. Canonicalization tests

Test that logically identical allowed inputs produce exactly one canonical byte sequence.

Mandatory cases:

- object key order variation,
- Unicode edge cases,
- null vs absent optional field,
- numeric normalization,
- empty string vs missing value,
- array ordering,
- seat ordering,
- invalid duplicate semantic fields,
- unsupported protocol fields.

Cross-language canonical bytes must be identical.

---

# 6. HKDF / key derivation tests

Mandatory:

- known-answer vector,
- one changed seed changes shuffleKey,
- one changed handId changes shuffleKey,
- one changed protocolVersion changes shuffleKey,
- reordered player contributions must follow canonical seat order and not accidental input order,
- missing contribution follows explicit protocol policy,
- same complete transcript reproduces same key,
- different transcript does not collide in test corpus,
- domain separation prevents reuse as another key purpose.

---

# 7. PRF stream tests

Mandatory:

- deterministic block sequence,
- counter progression exact,
- no accidental counter reuse,
- exact byte order/endian behavior,
- stream cursor restart recovery,
- Node/Rust/WASM parity,
- very long stream does not wrap supported counter range,
- invalid counter/state fails closed.

---

# 8. Bounded sampling correctness

For each relevant bound `n` used by shuffle positions:

- output always in `0..n-1`,
- rejection threshold exactly implemented,
- values `>= limit` are rejected,
- accepted values mapped with modulo only after rejection,
- deterministic byte consumption identical across languages,
- no infinite loop under test source,
- injected adversarial source can force multiple rejections safely.

Known-answer vectors must include at least one case that exercises rejection, not only first-attempt acceptance.

---

# 9. Fisher-Yates deterministic tests

Mandatory:

- same shuffleKey => same deck,
- one-bit key difference generally changes permutation,
- output length equals input length,
- output multiset exactly equals input multiset,
- no duplicate cards introduced,
- no card lost,
- canonical input order versioned,
- zero/one-card generic edge tests if utility supports them,
- Tysiąc 24-card adapter exact vector,
- Poker 52-card adapter exact vector when activated,
- multi-deck Blackjack shoe exact vector when activated.

---

# 10. Property-based shuffle tests

For large generated input sets:

- permutation invariant always holds,
- deterministic replay holds,
- frozen deck immutable,
- cursor monotonic,
- consumed positions unique,
- legal adapter operations consume exact number of positions,
- invalid cursor/state transition rejected.

Property framework choice is implementation-time decision; no second toolchain should be added without justification.

---

# 11. Deck freeze / commitment tests

Mandatory:

- commitment stable for identical frozen deck/context,
- changing card at one position changes commitment,
- swapping two positions changes commitment,
- handId change changes commitment,
- gameRulesVersion change changes commitment,
- post-freeze mutation API unavailable/rejected,
- persisted deck integrity verified after restart,
- corrupted persisted card sequence fails closed.

---

# 12. Deal cursor tests

Mandatory:

- first deal consumes expected position(s),
- cursor advances exactly once,
- burn consumes position and records burn event,
- retry same idempotency key consumes zero extra cards,
- conflicting retry payload fails,
- stale expectedVersion fails,
- stale ownershipEpoch fails,
- cursor cannot move backward,
- cursor cannot skip unless adapter operation explicitly consumes positions,
- exhaustion fails safely,
- no duplicate position consumption under concurrency.

---

# 13. Multi-node concurrency laboratory

At minimum simulate Node A / Node B:

1. same hand/version/epoch competing deal,
2. one writer wins, other conflicts,
3. new owner epoch fences old node,
4. stale node retry after fencing remains rejected,
5. duplicate exact request across two nodes returns one logical result,
6. conflicting same idempotency key across nodes fails,
7. commit/reveal transition races,
8. abort vs deal race,
9. proof generation vs terminal-state race,
10. reconnect arriving during deal does not create new deck.

Invariant:

```text
ONE LOGICAL POSITION -> AT MOST ONE AUTHORITATIVE CONSUMPTION
```

---

# 14. Crash / restart fault matrix

Inject crash at boundaries:

- before commit record,
- after commitment persisted,
- before reveal persisted,
- after reveal persisted,
- after seed derivation before deck persistence,
- after deck persistence before DECK_COMMITTED marker,
- after state commit before realtime signal,
- after cursor commit before client receives response,
- during proof generation,
- during ledger checkpoint creation.

After restart verify:

- no regenerated seed for existing hand,
- no reshuffle,
- no cursor rollback,
- no duplicate card consumption,
- idempotent retry returns correct state,
- integrity checks run,
- impossible partial state fails closed or follows explicitly recoverable state machine.

---

# 15. Database transaction tests

Real PostgreSQL required.

Test:

- transaction rollback leaves no partial deal,
- ledger/state coupling atomic where required,
- CAS/version conflict,
- ownership fencing,
- unique IDs,
- handId reuse rejection,
- concurrent session creation,
- concurrent abort/completion,
- key metadata lookup consistency,
- connection loss mid-transaction,
- retry after serialization/deadlock-type errors only where protocol safely permits.

---

# 16. Abort / grinding tests

Mandatory:

- abort is durable,
- abort does not delete commitments/reveals already recorded,
- same handId cannot restart,
- new hand uses fresh server seed,
- repeated abort sequence measurable,
- operator/admin cannot silently convert aborted hand into completed hand,
- abort reason/phase present,
- selective abort does not trigger hidden fallback shuffle.

Statistical campaign should analyze abort rate by table/player/build/time window.

---

# 17. Ledger tests

Mandatory:

- correct prevHash chaining,
- changing historical record breaks later chain,
- deleting record breaks continuity,
- reordering records breaks continuity,
- checkpoint covers exact sequence range,
- signature verifies with correct public key,
- wrong key fails,
- changed checkpoint payload fails,
- retired valid key can verify historical checkpoint according to policy,
- revoked/compromised key behavior follows frozen policy.

---

# 18. Proof / verifier tests

Mandatory:

- valid proof verifies,
- corrupted signature fails,
- wrong protocolVersion unsupported/fails,
- changed handId fails,
- changed deck commitment fails,
- wrong build/key identity fails where bound,
- missing required reveal/proof component produces `INSUFFICIENT_DISCLOSURE`,
- partial Poker proof does not claim full hidden-deck verification,
- malicious extra fields cannot alter signed semantic meaning,
- canonical parsing rejects ambiguous encodings.

Verifier must never silently downgrade invalid proof to success.

---

# 19. Merkle selective-reveal tests

When Poker selective proof is implemented:

- correct leaf proof verifies,
- wrong position fails,
- wrong card fails,
- wrong salt fails,
- wrong sibling hash fails,
- tree ordering deterministic,
- duplicate-card leaf set detectable by full private validation,
- selective verifier clearly states that unrevealed leaves are not publicly inspected,
- no folded/mucked card leakage in public bundle.

---

# 20. Privacy tests

For each viewer role:

- own private cards visible when rules permit,
- opponent hidden cards absent,
- folded/mucked cards not leaked,
- server seeds not leaked before allowed disclosure,
- full deck not present in realtime payload,
- logs contain no private cards/seeds,
- audit metadata contains hashes/IDs instead of raw secret material where appropriate,
- admin/owner UI does not automatically expose active private deck.

Use structural assertions, not only UI screenshots.

---

# 21. Realtime tests

- signal emitted only after authoritative commit,
- lost signal recoverable by state reload,
- duplicate signal harmless,
- out-of-order signal cannot overwrite newer version,
- payload contains no full authoritative private state,
- reconnect uses current persisted state,
- signal failure does not roll back already committed state unless protocol explicitly requires transactional outbox in future design.

---

# 22. Statistical test campaign

This campaign detects implementation regressions/bias; it does not prove cryptographic security alone.

Candidate tests:

- per-card position frequency,
- per-position card frequency,
- pair adjacency frequency,
- suit/rank distribution by position,
- permutation-derived summary metrics,
- chi-square where assumptions are valid,
- serial/autocorrelation checks on sampled outputs,
- rejection-rate distribution per bound,
- duplicate permutation collision monitoring at expected scale,
- abort correlation analysis.

Results must include:

- sample size,
- test definition,
- expected distribution,
- significance threshold,
- multiple-testing correction strategy where needed,
- raw aggregate data/artifact hash,
- interpretation limits.

Gemini must independently review the statistical methodology before acceptance thresholds are frozen.

---

# 23. Statistical anti-patterns

Do NOT claim fairness because:

- 1,000 shuffles "look random",
- average rank is near expected,
- one chi-square p-value is > 0.05,
- no duplicate deck appeared,
- screenshots appear varied.

Do NOT repeatedly tune implementation until p-values look favorable without preserving failed runs; that creates selection bias.

All campaign definitions should be frozen before final acceptance run.

---

# 24. Fuzzing

Fuzz targets should include:

- proof parser,
- canonical transcript parser,
- commitment/reveal validation,
- persisted GFPE state decoder,
- Merkle proof parser,
- adapter operation parser,
- malformed card/deck encodings,
- invalid protocol state transitions.

Expected behavior: bounded rejection without crash, secret leakage or partial mutation.

---

# 25. Cross-language equivalence

If Rust core + Node integration + WASM verifier are adopted:

All three must match for canonical vectors:

- canonical bytes,
- hashes,
- commitments,
- HKDF output,
- PRF blocks,
- bounded sampling,
- shuffle permutation,
- deck commitment,
- Merkle roots/proofs,
- checkpoint/proof verification.

Any mismatch is release-blocking until protocol/version issue is resolved.

---

# 26. Tysiąc acceptance laboratory

First full adapter must test:

- canonical 24-card deck,
- exact 2-player deal,
- exact 3-player deal,
- exact 4-player deal if final rules support it,
- musik/talon positions,
- no separate musik RNG,
- private projections,
- reconnect after partial deal,
- restart after deal,
- concurrent deal requests,
- abandoned/aborted game,
- proof at end according to allowed disclosure,
- final rulesVersion binding.

Tysiąc acceptance is required before Poker integration begins.

---

# 27. Poker future acceptance laboratory

After separate historical reuse audit and GFPE core acceptance:

- 52-card deck,
- hole card positions,
- burns,
- flop/turn/river,
- no `Math.random()` in FairPlay path,
- folded/mucked privacy,
- selective reveal proofs,
- multi-player seat changes,
- disconnect/reconnect,
- all-in/runout rules per frozen poker rulesVersion,
- evaluator correctness separate from shuffle correctness.

Historical M1/M2 code cannot bypass GFPE.

---

# 28. Security/supply-chain gates

Required before acceptance:

- npm audit for Node production dependencies,
- cargo audit/advisory equivalent if Rust introduced,
- CodeQL/static analysis where applicable,
- gitleaks/secrets scan,
- dependency/license inventory,
- SBOM generation,
- pinned/reviewed CI actions policy,
- no debug logging of seeds/cards/keys.

---

# 29. Performance / DoS tests

Measure with safe synthetic data:

- commitment verification throughput,
- shuffle latency,
- deal transaction latency,
- proof generation latency,
- verifier latency,
- DB contention under many tables,
- malicious repeated invalid reveal/proof inputs,
- oversized proof rejection,
- rate limiting around expensive verifier/admin operations.

Security must not be weakened to meet performance target.

---

# 30. Acceptance gates

GFPE Core cannot be accepted until:

- all known-answer vectors pass,
- cross-language equivalence passes if multi-language design used,
- property tests pass,
- real PostgreSQL integration passes,
- multi-node concurrency passes,
- crash/restart matrix passes,
- corruption/tamper tests pass,
- privacy tests pass,
- verifier tests pass,
- security scans pass,
- statistical campaign completes under pre-frozen methodology,
- Claude independent implementation audit passes,
- Gemini independent math/stat review passes,
- Lead verifies exact final HEAD/TREE and evidence.

---

# 31. Required evidence bundle

Final acceptance bundle should contain:

```text
exact source HEAD/TREE
protocolVersion
rulesVersion
buildGitSha
known-answer vector version/hash
exact commands
unit/property/fuzz results
PostgreSQL test evidence
concurrency evidence
restart/fault evidence
privacy evidence
verifier evidence
statistical report/artifact hashes
CodeQL/gitleaks/dependency results
Claude report
Gemini report
Lead final verification
```

No "expected result" may substitute for an executed test result.

---

## 32. Current conclusion

```text
GFPE TEST PLAN = DRAFT CREATED
TEST EXECUTION = NOT STARTED
ACCEPTANCE THRESHOLDS = NOT FROZEN
STATISTICAL METHODOLOGY = REQUIRES GEMINI REVIEW
SECURITY/PROTOCOL REVIEW = REQUIRES CLAUDE
IMPLEMENTATION = NOT AUTHORIZED
PRODUCTION USE = NO
```
