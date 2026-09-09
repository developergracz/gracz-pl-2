# GRACZ.PL — P8 / P1-U-01 — FINAL CANONICAL AUDIT PACKAGE AND RESULT

**Status:** FINAL AUDIT COMPLETE / TECHNICAL CLOSURE ACHIEVED / MERGE-READY / MERGE NOT AUTHORIZED  
**Checkpoint:** 2026-09-09  
**Repository:** `developergracz/gracz-pl-2`  
**PR:** `#43`  
**Work item:** `P8 / P1-U-01`  
**Base main:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Base TREE:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**Final audited HEAD:** `c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f`  
**Final audited TREE:** `0ba0abce0993c145164b20f2881f118e0b71124d`  
**PR state:** `OPEN / NOT MERGED / MERGEABLE`  
**Commits:** `25`  
**Changed files:** `13`  
**Merge / deploy / production authorization:** `NONE`

---

## 1. Purpose and supersession

This file supersedes the earlier P8 handoff package that referenced historical HEAD `d7220f57d60779584048cc5c695d40dbb948b9cb`, 8 commits and 7 changed files.

That earlier package remains part of repository history and is not rewritten as if it had audited the later corrected snapshots.

This current package records the final exact P8 snapshot, correction history, independent audit chain, exact-head CI evidence, remaining non-blocking hardening item and Lead closure decision.

A PASS does not authorize merge.

---

## 2. Exact final identity

```text
REPOSITORY = developergracz/gracz-pl-2
PR = #43
TITLE = P1-U-01: canonical game type dictionary — READY FOR INDEPENDENT AUDIT
BASE BRANCH = main
BASE SHA = ad0739190fe2f9d1657b2b77c8b5f8e825830c08
BASE TREE = 04f72af50f6fad2ba01bf7eaa6b4d856267d517b
HEAD BRANCH = fix/p1-u-01-canonical-game-types-p8
FINAL HEAD = c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f
FINAL TREE = 0ba0abce0993c145164b20f2881f118e0b71124d
COMMITS = 25
CHANGED FILES = 13
PR OPEN = YES
MERGED = NO
```

This closure is valid only for that exact HEAD/TREE.

---

## 3. Exact changed-file surface

PR #43 currently changes exactly:

1. `.github/workflows/p1-u-01-p8.yml`
2. `modern/checkers-engine/e2e/tournaments.browser.mjs`
3. `modern/checkers-engine/package.json`
4. `modern/checkers-engine/src/game-types.js`
5. `modern/checkers-engine/src/lobby.js`
6. `modern/checkers-engine/src/platform-lobby-http.js`
7. `modern/checkers-engine/src/rankings.js`
8. `modern/checkers-engine/src/tournaments.js`
9. `modern/checkers-engine/test/p1-u-01-game-types-p8.test.js`
10. `modern/checkers-engine/test/p8-tournament-hardening.test.js`
11. `modern/checkers-engine/test/p8-tournament-start-boundary.test.js`
12. `modern/checkers-engine/web/tournaments.html`
13. `modern/checkers-engine/web/tournaments.js`

This corrects the final Claude report's incidental statement that Lobby/Rankings integration files were unchanged; they are part of the final PR diff and were independently verified by Lead.

---

## 4. Canonical game identity contract

Final canonical IDs:

- `checkers`
- `gomoku`
- `thousand`

Compatibility alias:

- `warcaby -> checkers`

Non-canonical values include:

- `warcaby`
- `szachy`
- `all`

`all` remains a Rankings-only aggregate selector.

`CANONICAL_GAME_TYPES` is a frozen ARRAY. A separate private `CANONICAL_SET` is used for membership checks.

Registry validation fails closed for duplicate canonical IDs, self-aliases, alias/canonical collisions, aliases claimed more than once including inside one definition, and malformed registry tokens.

---

## 5. Legacy compatibility contract

Historical `warcaby` is read as canonical `checkers` without rewriting the stored historical value through a migration.

Historical `szachy` remains explicitly unsupported legacy data:

```text
game = null
gameSupported = false
legacyGame = szachy
```

The stored DB value remains `szachy`.

Active Tournament actions fail closed with:

`TOURNAMENT_GAME_UNSUPPORTED / 409`.

Unknown arbitrary garbage does not automatically receive the dedicated historical `szachy` compatibility projection.

---

## 6. P8 correction history — preserved chronology

The P8 audit chain was iterative. Intermediate failures remain historical evidence and are not rewritten as PASS.

### Original P8 findings

The following were discovered and later corrected/closed:

- `P8-AUD-F01` through `P8-AUD-F05`,
- `P8-GPT2-F01` — concurrent JOIN overbooking / duplicate current seed risk,
- `P8-GPT2-F02` — duplicate alias within one registry definition,
- `P8-GPT2-F03` — missing explicit historical unsupported START/REPORT regression coverage.

### Historical snapshot `589ef546...`

HEAD:

`589ef54609071474b55b40578690bde55822ff65`

A historical Gemini PASS against this earlier stage was not sufficient for closure because Lead found factual reporting errors around START/LEAVE locking at that snapshot. The historical result is retained as evidence and is not projected onto later heads.

### START / membership atomicity finding

`P8-LEAD-F01 / P8-GPT2-FINAL-F01`

Root issue:

Tournament START was not fully serialized with membership finalization and initial round materialization was not sufficiently bounded as one authoritative transaction.

Production correction snapshot:

`5cf8fae9b8028cfbf6216fcd163a58e2825901a8`

This corrected JOIN / LEAVE / START production behavior and added boundary tests.

Historical P8 workflow run:

`34289959902`

The first boundary cases passed, while one expected-rejection test failed because the test attached its rejection handler too late, causing the expected rejection to be reported as unhandled. Lead determined the production correction was sound; the failure was in the test harness.

Test-only correction snapshot:

HEAD:

`f3b782c3f0112239a4787fabed8f037425a2268b`

TREE:

`17f49f52dfc4388dca5fc79c5e6ae8e9d08182fd`

Production logic was unchanged from `5cf8...`.

Final exact-head CI at `f3b782...` was green:

- P8 `34290089821`,
- P1-H-01 `34290089760`,
- Security Gate `34290089824`,
- CheckersEngine `34290089818`,
- Greetings `34290089815`.

### CREATE atomicity blocker

ChatGPT-2 then discovered:

`P8-GPT2-CLOSURE-F01 — Tournament creation is not atomic with creation of the mandatory owner membership`.

ChatGPT-2 source severity: HIGH / merge blocking YES.

Lead independently accepted the defect and reclassified final severity to:

`MEDIUM / MERGE BLOCKING = YES`.

The defect pre-existed in base main but remained incompatible with the P8 closure condition of zero known merge-blocking technical findings.

Correction commit:

`a58440924408b8c47800bfc726e6f7831bdd3733`

Final proof/test commit:

`c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f`

---

## 7. Final PostgreSQL CREATE invariant

Final `TournamentService.create()` uses one checked-out PostgreSQL client and one transaction:

```text
BEGIN
INSERT gracz_tournaments
INSERT gracz_tournament_players owner seed=1
COMMIT
```

On failure:

```text
ROLLBACK
```

Always:

```text
client.release()
```

Both writes occur on the same transaction client.

This closes `P8-GPT2-CLOSURE-F01`.

---

## 8. Final real-PostgreSQL CREATE evidence

`p8-tournament-start-boundary.test.js` includes three final CREATE tests:

1. external observer cannot see tournament or owner between parent INSERT and owner INSERT/COMMIT,
2. concurrent JOIN cannot claim mandatory owner seed 1,
3. forced mandatory owner-membership insertion failure rolls back both tournament and player state.

The first and third tests use deterministic SQL-level control points and independent observer connections.

The CREATE-vs-JOIN test has one known test-quality limitation recorded separately as `P8-GPT2-ULTIMATE-F01`.

---

## 9. Membership / START / REPORT transaction invariants

### JOIN

PostgreSQL JOIN serializes through parent tournament `SELECT ... FOR UPDATE`, then performs status/membership/capacity/seed checks and INSERT under the same transaction.

`MAX(current seed)+1` protects concurrent current joins but is not claimed to be globally monotonic or never reused after a highest-seed player leaves.

### LEAVE

LEAVE uses the same parent tournament lock, revalidates status/owner constraints and performs DELETE in the same transaction.

### START

START locks the parent tournament row first. The roster SELECT itself does NOT use `FOR UPDATE`; authoritative serialization comes from JOIN/LEAVE/START all obeying the same parent-row lock discipline.

Within the same transaction START performs:

- owner/game/status validation,
- current-roster read,
- pairing generation,
- `status='live'`,
- `current_round=1`,
- all initial match insertion,
- COMMIT.

### REPORT / advance

REPORT locks tournament before match, updates result/standings and calls `advanceDatabase` on the same transaction client before COMMIT.

Final deadlock conclusion is bounded as:

`NO FEASIBLE DEADLOCK CYCLE FOUND IN CURRENT AUDITED PATHS`.

---

## 10. Final exact-head CI

For final HEAD:

`c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f`

all required PR-triggered workflows are `SUCCESS`:

```text
34291690126 — P1-U-01 Canonical Game Types P8 — SUCCESS
34291690070 — P1-H-01 Tournament Concurrency — SUCCESS
34291690134 — Security Gate — SUCCESS
34291690072 — CheckersEngine — SUCCESS
34291690139 — Greetings — SUCCESS
```

The authoritative P8 run includes successful:

- syntax/static checks,
- canonical P8 contract,
- Tournament concurrency and legacy hardening,
- Tournament start/membership boundary serialization including atomic CREATE tests,
- Checkers/Gomoku/Thousand regressions,
- Tournament concurrency regression,
- P5/P6/P7 regressions,
- full Node suite,
- production dependency audit,
- Browser Checkers/Gomoku/Tournaments,
- P1-R-01 DR regression,
- gitleaks,
- CodeQL.

The final PR adds no new external runtime dependency.

---

## 11. Final supplemental Gemini audit

Verdict:

`P8 / P1-U-01 GEMINI ULTIMATE CLOSURE AUDIT — PASS`

Lead accepted its technical PASS but corrected factual report details, including frozen array vs Set, real `gracz_*` table names, exact legacy error contract, START roster locking description, package.json change, transaction wording for reads and bounded deadlock wording.

No new production blocker resulted from those reporting corrections.

---

## 12. Final ChatGPT-2 audit

Verdict:

`P8 / P1-U-01 CHATGPT-2 ULTIMATE CLOSURE AUDIT — PASS WITH NON-BLOCKING FINDINGS`

Finding:

`P8-GPT2-ULTIMATE-F01`

Final Lead classification:

```text
FACTUALLY VALID = YES
SEVERITY = LOW
MERGE BLOCKING = NO
PRODUCTION DEFECT = NO
TEST HARDENING = YES
```

Reason:

The CREATE-vs-JOIN regression launches JOIN and releases CREATE without a second deterministic JOIN-side signal proving JOIN reached its SQL statement while CREATE was paused. This reduces the precision of that individual race test but does not invalidate production correctness because atomic CREATE visibility is independently and deterministically proven, and PostgreSQL READ COMMITTED cannot expose the uncommitted parent row without the owner row.

No P8 re-audit is required solely for this optional hardening item.

---

## 13. Final Claude canonical audit

Verdict:

`P8 / P1-U-01 FINAL CLAUDE CANONICAL AUDIT — PASS WITH NON-BLOCKING FINDINGS`

Claude independently confirmed:

- all prior merge-blocking P8 findings closed,
- canonical registry and historical compatibility valid,
- atomic CREATE valid,
- JOIN/LEAVE/START serialization valid,
- initial-round visibility atomic,
- REPORT/advance transaction boundary valid,
- ChatGPT-2 LOW finding factually valid but non-blocking,
- zero newly discovered merge-blocking technical findings.

### Claude report evidence-gap closure

Claude marked exact GitHub Actions runs as an evidence gap because of his own access limitation. Lead independently accessed the GitHub Actions run data and verified all exact-head run IDs and required job/step conclusions as SUCCESS.

Therefore this evidence gap is closed at Lead verification level.

### Claude report corrections

Claude's claim that `lobby.js`, `platform-lobby-http.js` and `rankings.js` were unchanged was incorrect. All three are in the 13-file PR diff and their P8 changes were independently inspected by Lead.

Claude also stated he had not fully reviewed every line of `e2e/tournaments.browser.mjs`. Lead independently reviewed the real Playwright test; it opens the active Tournament UI, checks canonical filter/create values, filters Checkers, creates tournaments through UI and verifies historical unsupported rendering with no browser errors.

These are report-quality corrections, not production findings.

---

## 14. Final finding status

Closed for P8 defined scope:

- `P8-AUD-F01` through `P8-AUD-F05`,
- `P8-GPT2-F01`,
- `P8-GPT2-F02`,
- `P8-GPT2-F03`,
- `P8-LEAD-F01`,
- `P8-GPT2-FINAL-F01`,
- `P8-GPT2-CLOSURE-F01`.

Known residual non-blocking item:

- `P8-GPT2-ULTIMATE-F01` — LOW / TEST HARDENING / NON-BLOCKING / NO PRODUCTION DEFECT.

```text
KNOWN MERGE-BLOCKING TECHNICAL FINDINGS = 0
KNOWN NON-BLOCKING FINDINGS = 1
```

---

## 15. Lead final closure state

```text
P8 TECHNICAL CLOSURE = ACHIEVED
P8 EXACT-HEAD CI = PASS
GEMINI FINAL = PASS
CHATGPT-2 FINAL = PASS WITH NON-BLOCKING FINDINGS
CLAUDE FINAL CANONICAL = PASS WITH NON-BLOCKING FINDINGS
LEAD FINAL VERIFICATION = PASS
P8 STATUS = MERGE-READY
MERGE AUTHORIZATION = NO
MERGE = NO
DEPLOY = NO
PRODUCTION CHANGE = NO
```

---

## 16. Next gate

The next repository-code action is a separate Owner merge authorization for exact PR #43 / HEAD `c69fbcd582ee056ef7b5c0c3fdb0f9eb3042f47f`.

If HEAD changes, this merge-readiness record must be re-evaluated.

After a future authorized merge and exact new-main verification, begin the separate:

`ADVANCED SCALABILITY AUDIT`.

No merge or deployment is authorized by this document.
