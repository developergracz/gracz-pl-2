# GRACZ.PL — P8 / P1-U-01 — CLAUDE INDEPENDENT AUDIT PACKAGE

**Status:** READY FOR INDEPENDENT AUDIT / NO MERGE AUTHORIZATION  
**Repository:** `developergracz/gracz-pl-2`  
**PR:** `#43`  
**Work item:** `P8 / P1-U-01`  
**Base main:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**P8 final HEAD:** `d7220f57d60779584048cc5c695d40dbb948b9cb`  
**P8 final TREE:** `4cbb8504036d26ed2e257f52a475968f5d4cd827`  
**PR state at package creation:** `OPEN / NOT MERGED / mergeable`  
**Lead review:** `PASS`  
**Independent Claude audit:** `PENDING`  
**Merge / deploy / production authorization:** `NONE`

---

## 1. Purpose

This package is the canonical handoff for Claude's independent final audit of P8 / P1-U-01.

Claude must audit the **actual PR #43 diff and surrounding code**, not only this summary. This package defines the required identity, scope, invariants, evidence, audit questions and output contract.

A green CI result does not replace independent audit. A Claude PASS does not authorize merge. Owner + Lead authorization remains a separate gate.

---

## 2. Exact PR identity

```text
REPOSITORY = developergracz/gracz-pl-2
PR = #43
TITLE = P1-U-01: canonical game type dictionary — READY FOR INDEPENDENT AUDIT
BASE = main
BASE SHA = ad0739190fe2f9d1657b2b77c8b5f8e825830c08
HEAD BRANCH = fix/p1-u-01-canonical-game-types-p8
HEAD SHA = d7220f57d60779584048cc5c695d40dbb948b9cb
TREE = 4cbb8504036d26ed2e257f52a475968f5d4cd827
COMMITS = 8
CHANGED FILES = 7
MERGED = NO
```

Claude must stop and report an identity mismatch if the PR HEAD being audited is not exactly the HEAD above, unless Lead provides an explicit superseding audit package.

---

## 3. Changed files — exact P8 surface

PR #43 changes exactly:

1. `.github/workflows/p1-u-01-p8.yml`
2. `modern/checkers-engine/src/game-types.js`
3. `modern/checkers-engine/src/lobby.js`
4. `modern/checkers-engine/src/platform-lobby-http.js`
5. `modern/checkers-engine/src/rankings.js`
6. `modern/checkers-engine/src/tournaments.js`
7. `modern/checkers-engine/test/p1-u-01-game-types-p8.test.js`

Claude must inspect all seven files plus relevant unchanged surrounding code they call into.

---

## 4. Intended P8 contract

P8 establishes one canonical game-type vocabulary for the currently implemented runtime.

Canonical internal IDs:

- `checkers`
- `gomoku`
- `thousand`

Compatibility alias:

- `warcaby -> checkers`

Required principles:

- unknown identifiers fail closed,
- malformed/empty identifiers fail closed,
- aliases normalize to one canonical identity,
- `all` is a rankings selector, not a game identity,
- module capabilities are enforced centrally,
- unsupported capability use fails closed,
- `gomoku` is not ranking-capable in the current registry,
- new tournament writes use canonical identities,
- legacy tournament rows containing `warcaby` remain readable as `checkers` without production data migration,
- invalid identifiers must not silently default to `checkers`, `warcaby`, `all` or another valid value,
- no production migration is part of P8.

---

## 5. Registry contract to verify

`src/game-types.js` defines the canonical registry and normalization boundary.

Expected definitions:

### checkers

- id: `checkers`
- label: `Warcaby`
- aliases: `warcaby`
- implemented: true
- players: 2 / 2 / default 2
- capabilities: lobby=true, rankings=true, tournaments=true

### gomoku

- id: `gomoku`
- aliases: none
- implemented: true
- players: 2 / 2 / default 2
- capabilities: lobby=true, rankings=false, tournaments=true

### thousand

- id: `thousand`
- aliases: none
- implemented: true
- players: min 2 / max 4 / default 3
- capabilities: lobby=true, rankings=true, tournaments=true

Required functions/classes:

- `GAME_DEFINITIONS`
- `CANONICAL_GAME_TYPES`
- `GameTypeError`
- `normalizeGameType()`
- `isCanonicalGameType()`
- `getGameDefinition()`
- `requireGameType()`
- `requireGameDefinition()`

Expected error semantics:

- invalid unknown/malformed identity -> `INVALID_GAME_TYPE`, HTTP-oriented status 400,
- valid game but unsupported module capability -> `UNSUPPORTED_GAME_TYPE`, status 400.

Audit immutability/freeze semantics as well as normalization behavior.

---

## 6. Integration invariants

### Lobby

Claude must verify:

- create-room normalizes alias before storing room identity,
- duplicate/waiting-room matching compares canonical identity,
- seat-count logic uses canonical game definition,
- explicit invalid input is not masked by defaults,
- `warcaby` and `checkers` cannot create two separate logical identities for the same game,
- HTTP handler preserves intended default behavior only when the field is genuinely omitted, not when explicit invalid input is supplied.

### Rankings

Claude must verify:

- `all` remains aggregate selector and is not passed through as a game identity,
- `warcaby` normalizes to `checkers`,
- invalid filters fail closed,
- `gomoku` correctly fails as unsupported ranking game under current capability model,
- no historical permissive fallback converts invalid game input to `all`.

### Tournaments

Claude must verify:

- new writes normalize `warcaby` to `checkers`,
- new invalid game values fail closed,
- missing game input does not silently become a valid tournament game,
- new persistence uses canonical game identity,
- legacy persisted `warcaby` rows remain unchanged at rest but project as `checkers` on read,
- list/detail/filter behavior remains consistent across legacy and canonical rows,
- no unintended production data migration is required by this implementation,
- concurrency behavior from P1-H-01 is not weakened.

---

## 7. Negative cases that must be inspected

The P8 tests explicitly exercise invalid inputs including:

- `szachy`
- `poker`
- `blackjack`
- `war`
- `tysiac`
- `draughts`
- empty string
- whitespace-only string
- `null`
- `undefined`
- number
- object

Claude should additionally reason about:

- mixed case,
- leading/trailing whitespace,
- unexpected Unicode/lookalike strings where relevant,
- future aliases colliding with canonical IDs,
- future duplicate aliases,
- unsupported capability names,
- mutation attempts against exported registry objects.

If a future-hardening issue is non-blocking, classify it accordingly instead of conflating it with a current correctness defect.

---

## 8. Exact-head CI evidence

Final P8 CI run recorded for exact HEAD:

`34147638975 = SUCCESS`

The P8 workflow includes:

- syntax/static checks,
- focused P8 canonical-game contract tests,
- Checkers regression,
- Gomoku regression,
- Thousand regression,
- tournament concurrency regression,
- P5 readiness regression,
- P6 distributed infrastructure regression,
- P7 MatchRuntime regression,
- full Node test suite,
- production dependency audit,
- browser Checkers/Gomoku,
- isolated P1-R-01 DR regression,
- gitleaks,
- CodeQL.

Recorded focused results from the final evidence set:

- P8 focused: `8/8 PASS`
- Checkers focused regression: `26/26 PASS`
- Gomoku focused: `24/24 PASS`
- Thousand focused: `20/20 PASS`
- tournament concurrency: `2/2 PASS`
- P5 readiness: `14/14 PASS`
- P6: `23/23 PASS`
- P7: `19/19 PASS`
- full Node suite: `229/229 PASS`
- npm audit: `0 vulnerabilities`
- browser Checkers: PASS
- browser Gomoku: PASS
- isolated real PostgreSQL DR regression: PASS
- gitleaks: PASS
- CodeQL: PASS

Claude must assess whether the tests prove the intended contract and whether meaningful negative or integration cases remain uncovered.

---

# 9. Required independent audit — sections A–N

Claude must return a structured report covering all sections below.

## A. Identity / scope integrity

Verify exact BASE/HEAD/TREE, changed-file scope, absence of hidden migration/deployment effects and whether the diff matches the stated P8 work item.

## B. Canonical registry design

Review registry data model, immutability, normalization, alias handling, capability model, future extension safety and error semantics.

## C. Fail-closed validation

Check all paths for silent fallback, coercion, default masking, malformed inputs and ambiguous identities.

## D. Lobby integration

Review room creation, duplicate room behavior, canonical storage, player-count resolution, HTTP request parsing and downstream dispatch compatibility.

## E. Rankings integration

Review `all`, alias normalization, unsupported capability rejection, invalid inputs and compatibility with existing ranking behavior.

## F. Tournament integration

Review canonical writes, legacy reads, filtering, detail/list projections, missing/invalid game handling and interaction with existing tournament concurrency logic.

## G. Backward compatibility / persisted data

Review whether existing `warcaby` tournament records remain safely readable without migration and whether any current-main data path can become ambiguous or inaccessible.

## H. API / error contract

Review status/error behavior and whether callers receive stable, non-confusing errors without leaking internal state.

## I. Concurrency / state consistency regressions

Confirm P8 does not weaken prior CAS, transaction, idempotency, P1-H-01, P7 or other state-integrity guarantees.

## J. Tests / CI adequacy

Review focused tests, regression breadth, missing edge cases, exact-head evidence and workflow configuration.

## K. Security / privacy / supply chain

Look for injection/coercion issues, unsafe logs, secret exposure, privilege implications, dependency changes, workflow-permission expansion or other security regressions.

## L. Architecture / documentation alignment

Assess whether P8 matches current architecture and the stated single canonical game identity principle without falsely claiming capabilities that do not exist.

## M. Maintainability / future games

Assess whether the registry is reasonably extensible for future games without creating hidden coupling or duplicated dictionaries. Do not require premature Poker/FairPlay implementation.

## N. Final findings and verdict

Provide complete findings table and final verdict using the exact vocabulary below.

---

## 10. Finding format

Every finding must receive an ID:

`P8-AUD-F01`, `P8-AUD-F02`, ...

Each finding must contain:

```text
ID:
TITLE:
SEVERITY: CRITICAL | HIGH | MEDIUM | LOW | INFO
MERGE BLOCKING: YES | NO
LOCATION: exact file/function/line or precise scope
IMPACT:
EVIDENCE:
REPRODUCTION / REASONING:
REQUIRED CORRECTION:
REGRESSION RISK:
TEST REQUIRED:
```

Do not create a finding solely because a future feature is not implemented when it is explicitly outside P8 scope.

Do not silently downgrade a correctness/security issue because CI is green.

---

## 11. Allowed final verdicts — exact wording

Claude must end with exactly one of:

```text
P8 / P1-U-01 — PASS
```

or

```text
P8 / P1-U-01 — PASS WITH NON-BLOCKING FINDINGS
```

or

```text
P8 / P1-U-01 — FAIL — CORRECTION REQUIRED
```

If identity mismatch prevents a valid audit, do not issue PASS; report the mismatch explicitly.

---

## 12. Governance after Claude response

Claude's report is not executed automatically.

Required sequence:

```text
CLAUDE REPORT
  -> TOM 18 finding registration
  -> LEAD independent verification of every finding
  -> correction decision if needed
  -> bounded GPT-2 implementation mandate if authorized
  -> tests / exact-head CI
  -> re-audit if required
  -> Lead final verification
  -> separate Owner + Lead merge authorization
```

No merge, auto-merge, deploy, migration, production database change, Render change, ENV change, DNS change or Cloudflare change is authorized by this package.

---

## 13. Current gate

```text
P8 IMPLEMENTATION = COMPLETE ON CONTROLLED BRANCH
LEAD REVIEW = PASS
EXACT-HEAD CI = PASS
CLAUDE INDEPENDENT AUDIT = PENDING
P8-AUD-Fxx = NONE YET
MERGE AUTHORIZATION = NO
MERGE = NO
DEPLOY = NO
```

This file is the canonical single-message handoff for the independent P8 audit.