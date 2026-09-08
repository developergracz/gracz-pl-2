# GRACZ.PL — HISTORICAL EVIDENCE BACKFILL — P1 / PR #29, #30, #36, #37, #38, #39

**Document:** TOM 17 / Historical Evidence Backfill  
**Status:** LIVING DOCUMENTATION / EVIDENCE RECONSTRUCTION COMPLETE FOR DEFINED PR SET  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Current-main reference at documentation checkpoint:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Production/deploy authorization:** NONE

---

## 1. Cel

Ten dokument uzupełnia historyczny evidence trail dla technicznych P1, które zostały zamknięte przed P7/P8, ale w dotychczasowym MASTERZE nie miały jednego, precyzyjnego rejestru exact HEAD/TREE/merge/CI/audit provenance.

Zakres backfillu:

- PR #29 — `P1-C-01 / P1-AUD3-02` — Checkers session CAS/concurrency,
- PR #30 — `P1-H-01` — tournament concurrency,
- PR #36 — `P1-AUD3-03` — crypto key separation,
- PR #37 — `P1-AUD3-04` — Gomoku durability/concurrency/recovery,
- PR #38 — `P1-AUD3-07 / P5` — liveness/readiness,
- PR #39 — `P1-AUD3-01 / P6` — shared rate limiting/realtime backplane.

Backfill nie zmienia historycznych decyzji i nie otwiera ponownie work itemów. Jego celem jest podniesienie jakości dowodu oraz jawne oznaczenie miejsc, gdzie sam raport audytowy nie został zachowany w GitHub PR timeline.

---

## 2. Zasada jakości evidence

Stosowane klasy:

- `DIRECT` — dowód wynika bezpośrednio z GitHub metadata/commit/CI lub jawnego zapisu audytu w merge message,
- `DIRECT-PARTIAL` — część audytu jest jawnie zapisana w GitHub, ale pełny końcowy raport nie jest zachowany w PR timeline,
- `RECONSTRUCTED` — historyczny status jest wspierany przez commit/merge/project record, ale brak kompletnego niezależnego raportu w GitHub,
- `GAP` — element nie może być dziś potwierdzony mocniejszym artefaktem i musi pozostać jawnie oznaczony.

`MERGED` nie jest automatycznie dowodem `AUDIT PASS`, a `CI PASS` nie zastępuje niezależnego review.

---

# 3. SUMMARY MATRIX

| Work item | PR | Base | Final PR HEAD | Final TREE | Merge commit | Exact-head CI | Audit provenance quality | Historical status |
|---|---:|---|---|---|---|---|---|---|
| P1-C-01 / P1-AUD3-02 | #29 | `9f3b6551ced4...` | `f2167bf3bcab0247ae6e865a67c9afbf93f55efc` | `b08662e95962539bdd5bbb1dc7458e9d6f6b77a2` | `c81b7819b5a9e994b1bdc04a304288fca030fdcd` | GREEN | `RECONSTRUCTED / partial Claude-condition evidence` | `MERGED / CLOSED` |
| P1-H-01 | #30 | `c81b7819b5a9...` | `08419e823cb771d22862a9e14d99a87bc75adcfb` | `83ea72156d4946a41a42c95e5bbde374506c76cf` | `2445434c85ac838a88747906dfce77f78764b901` | GREEN | `GAP for preserved independent-report artifact` | `MERGED / CLOSED` |
| P1-AUD3-03 | #36 | `2445434c85ac...` | `bbb48464f164a9c0687a65e5b660f447e069c189` | `43ead9cc3c54023c18d27236f1f41c21a81b22ee` | `05989fa219cc92a299a3f3a193f3dfda5762bbca` | GREEN | `DIRECT-PARTIAL` | `MERGED / CLOSED` |
| P1-AUD3-04 | #37 | `05989fa219cc...` | `5d155fd058343355346fbb2b6637881ca3b73b66` | `2e7ad8c027ece18ffe1da175221274a1ee6a4255` | `d002027114a7ef28ec02436e39798b70267e8502` | GREEN | `DIRECT-PARTIAL / audited-history merge evidence` | `MERGED / CLOSED` |
| P1-AUD3-07 / P5 | #38 | `d002027114a7...` | `6e49cde56cf7e9ef4c1b74ca3fe0735485a91103` | `d1b0a05480e098a576cba518f1a11c5f2ad0d943` | `8d520a5c2fea80b458e0adcf59468c9d6921c985` | GREEN | `RECONSTRUCTED / final evidence strong, audit report not in PR timeline` | `MERGED / CLOSED` |
| P1-AUD3-01 / P6 | #39 | `8d520a5c2fea...` | `c4669ea81bc2d0404f95d75a17a793a065ed725a` | `3b6dbca54ff33e06691ecbe002bdc96f0215f151` | `c5c34aabe4fcd04b087e25161778798146030c9b` | GREEN | `DIRECT — merge explicitly records Lead PASS + independent Claude audit` | `MERGED / CLOSED` |

---

# 4. PR #29 — P1-C-01 / CHECKERS SESSION CAS

## 4.1 Identity

- PR: `#29`
- title: `P1-C-01: Checkers session CAS concurrency — READY FOR REVIEW`
- base: `main @ 9f3b6551ced4bf61524ebe96a6bff5c4c842a2d1`
- branch: `fix/p1-c-01-checkers-session-cas-rebuild`
- final PR HEAD: `f2167bf3bcab0247ae6e865a67c9afbf93f55efc`
- final TREE: `b08662e95962539bdd5bbb1dc7458e9d6f6b77a2`
- merge commit: `c81b7819b5a9e994b1bdc04a304288fca030fdcd`
- merge TREE: `b08662e95962539bdd5bbb1dc7458e9d6f6b77a2`
- PR commits: `19`
- changed files: `14`
- merged: `2026-09-04`.

Merge commit ma rodziców `9f3b655...` oraz finalny HEAD `f2167bf...`, a jego TREE jest identyczny z finalnym PR TREE.

## 4.2 Implemented contract

Repo evidence potwierdza m.in.:

- `version` w `gracz_game_sessions`,
- compare-and-swap update po oczekiwanej wersji,
- `SESSION_CONCURRENCY_CONFLICT`,
- HTTP `409`,
- brak realtime publish po konflikcie,
- startup initialization chronioną advisory lockiem,
- finalny commit `f2167bf...` o nazwie `close Claude multi-instance startup conditions`.

## 4.3 Exact-head CI

Dla finalnego HEAD `f2167bf...` PR-triggered workflow runs:

- `Greetings` — run `33880837982` — `SUCCESS`,
- `Security Gate` — run `33880837696` — `SUCCESS`,
- `CheckersEngine` — run `33880837643` — `SUCCESS`.

PR body dodatkowo deklaruje finalne: CheckersEngine PASS, Security Gate PASS, browser PASS i PostgreSQL concurrency PASS.

## 4.4 Audit provenance

GitHub PR timeline zawiera wcześniejszy `INDEPENDENT REVIEW GATE` na head `4b1d3ec...`, wymagający niezależnej akceptacji przed merge. Finalny commit `f2167bf...` jawnie odwołuje się do domknięcia warunków Claude dotyczących multi-instance startup.

Nie znaleziono jednak zachowanego w PR timeline formalnego finalnego review submission z pełnym raportem Claude dla exact final HEAD.

**Evidence class:** `RECONSTRUCTED / PARTIAL AUDIT PROVENANCE`.

**Historical closure:** pozostaje `MERGED / CLOSED`; backfill nie cofa zamknięcia, ale uczciwie oznacza brak pełnego finalnego raportu w samym GitHub PR timeline.

---

# 5. PR #30 — P1-H-01 / TOURNAMENT CONCURRENCY

## 5.1 Identity

- PR: `#30`
- base: `c81b7819b5a9e994b1bdc04a304288fca030fdcd`
- branch: `fix/p1-h-01-tournament-advancement-concurrency`
- final PR HEAD: `08419e823cb771d22862a9e14d99a87bc75adcfb`
- final TREE: `83ea72156d4946a41a42c95e5bbde374506c76cf`
- merge commit: `2445434c85ac838a88747906dfce77f78764b901`
- merge TREE: `83ea72156d4946a41a42c95e5bbde374506c76cf`
- commits: `5`
- changed files: `3`
- merged: `2026-09-04`.

## 5.2 Implemented contract

PR/merge diff potwierdza:

- transakcyjne blokowanie krytycznych operacji turniejowych,
- jednokrotny advancement rund,
- idempotentne raportowanie wyników,
- unique `(tournament_id, round, board)`,
- dedykowany workflow PostgreSQL concurrency.

## 5.3 Exact-head CI

Dla HEAD `08419e...`:

- `Greetings` — run `33885568448` — `SUCCESS`,
- `Security Gate` — run `33885568583` — `SUCCESS`,
- `CheckersEngine` — run `33885568596` — `SUCCESS`,
- `P1-H-01 Tournament Concurrency` — run `33885568581` — `SUCCESS`.

PR body zachowuje także wcześniejsze green evidence, ale exact-head runs powyżej są lepszym canonical backfill evidence.

## 5.4 Audit provenance

PR timeline zwrócił brak zachowanych komentarzy/review submissions. PR body kończy się `READY FOR INDEPENDENT PATCH REVIEW = YES`, a następnie PR został zmergowany.

Nie należy z samego merge wyprowadzać nazwiska/modelu niezależnego audytora ani literalnego verdictu.

**Evidence class:** `AUDIT ARTIFACT GAP`.

**Historical closure:** `MERGED / CLOSED` na podstawie istniejącego project governance record; pełny niezależny audit artifact powinien być traktowany jako historycznie niezachowany w GitHub PR timeline.

---

# 6. PR #36 — P1-AUD3-03 / CRYPTO KEY SEPARATION

## 6.1 Identity

- base: `2445434c85ac838a88747906dfce77f78764b901`
- branch: `fix/p1-aud3-03-crypto-key-separation`
- final PR HEAD: `bbb48464f164a9c0687a65e5b660f447e069c189`
- final TREE: `43ead9cc3c54023c18d27236f1f41c21a81b22ee`
- merge commit: `05989fa219cc92a299a3f3a193f3dfda5762bbca`
- merge TREE: `43ead9cc3c54023c18d27236f1f41c21a81b22ee`
- commits: `2`
- changed files: `9`.

## 6.2 Audit/correction chain

PR body jawnie zachowuje:

- previously independently audited HEAD `e90a3ccf7e967df67cf27ccd91959a93e8a278e9`,
- narrow corrective finding `Finding #1`,
- final corrective commit `bbb48464...`,
- zmianę legacy fallback tak, aby uruchamiał się tylko po typed authenticated AES-GCM failure,
- zachowanie DUAL-READ / SINGLE-WRITE,
- dedykowane keys dla messages/attachments/MFA,
- brak migration/re-encryption/production ENV/deploy.

## 6.3 Exact-head CI

Dla `bbb48464...`:

- `Greetings` — `33909692336` — `SUCCESS`,
- `Security Gate` — `33909692327` — `SUCCESS`,
- `CheckersEngine` — `33909692352` — `SUCCESS`.

PR body dodatkowo zachowuje test counts:

- config `6/6`,
- focused crypto separation `5/5`,
- real PostgreSQL crypto `1/1`,
- full npm: `152 total / 150 pass / 0 fail / 2 historical skips`,
- browser Checkers/Gomoku PASS,
- CodeQL/gitleaks/npm audit PASS.

## 6.4 Audit provenance quality

Istnienie niezależnego audytu przed corrective commit jest zapisane bezpośrednio w PR body. Brak osobnego finalnego review submission w PR timeline po corrective commit.

**Evidence class:** `DIRECT-PARTIAL`.

Historyczny status: `MERGED / CLOSED`.

---

# 7. PR #37 — P1-AUD3-04 / GOMOKU DURABILITY

## 7.1 Identity and correction of historical ambiguity

PR body zawiera wcześniejszy wpis:

`FINAL HEAD = af3a9ec276ab7333d455c9e595d0842fbd0f4fa0`.

Jest to **wcześniejszy audited checkpoint**, ale nie jest faktycznym headem zmergowanego PR.

GitHub PR metadata oraz merge commit potwierdzają:

- base: `05989fa219cc92a299a3f3a193f3dfda5762bbca`,
- branch: `fix/p1-aud3-04-gomoku-durable-persistence-resync`,
- final merged PR HEAD: `5d155fd058343355346fbb2b6637881ca3b73b66`,
- final TREE: `2e7ad8c027ece18ffe1da175221274a1ee6a4255`,
- merge commit: `d002027114a7ef28ec02436e39798b70267e8502`,
- merge TREE: `2e7ad8c027ece18ffe1da175221274a1ee6a4255`,
- commits: `2`,
- changed files: `8`.

Final commit `5d155fd...` ma parent `af3a9ec...` i message `P1-AUD3-04: close final audit conditions`.

## 7.2 Implemented contract

Final delta domknął m.in.:

- durable PostgreSQL source-of-truth,
- revision CAS,
- controlled conflict/reload,
- requestId idempotency and idempotency conflict,
- persisted recovery after restart,
- fail-closed persisted-state validation,
- TLS verification change in PostgresGomokuService,
- test-only seam isolation,
- HTTP `409` semantics.

## 7.3 Exact-head CI

Dla actual final HEAD `5d155fd...`:

- `Greetings` — `33944042420` — `SUCCESS`,
- `Security Gate` — `33944042417` — `SUCCESS`,
- `CheckersEngine` — `33944042416` — `SUCCESS`.

PR body posiada szczegółowy wcześniejszy audit/test evidence dla `af3a9ec...`; exact merged head jest dodatkowym corrective closure commit i ma green PR CI.

## 7.4 Audit provenance

Merge commit literalnie zawiera: `Preserve full audited commit history`, a final commit: `close final audit conditions`.

Nie znaleziono osobnego raportu w PR timeline.

**Evidence class:** `DIRECT-PARTIAL / STRONG INDIRECT AUDIT EVIDENCE`.

Historical status: `MERGED / CLOSED`.

---

# 8. PR #38 — P1-AUD3-07 / P5 READINESS

## 8.1 Identity

- base PR metadata: `d002027114a7ef28ec02436e39798b70267e8502`,
- branch: `fix/p1-aud3-07-readiness-resync`,
- final HEAD: `6e49cde56cf7e9ef4c1b74ca3fe0735485a91103`,
- final TREE: `d1b0a05480e098a576cba518f1a11c5f2ad0d943`,
- merge commit: `8d520a5c2fea80b458e0adcf59468c9d6921c985`,
- merge TREE: `d1b0a05480e098a576cba518f1a11c5f2ad0d943`,
- commits: `5`,
- changed files: `7`.

## 8.2 Governance incident preserved separately

PR body zachowuje odrębny, naprawiony repository governance incident:

- incident `74eedcb...` — przypadkowy `SHOULD-NOT-EXIST`,
- repair `f47f988...` — normal revert,
- repaired tree odpowiadał authorized P5 base content,
- incident nie był częścią P5 implementation count.

Backfill zachowuje to rozdzielenie.

## 8.3 Final HEAD note

Commit `6e49cde...` ma TREE `d1b0a054...` i **0 file changes**; repo metadata potwierdza no-op final commit. PR body klasyfikuje go jako accidental no-op / documented / non-blocking.

## 8.4 Exact-head CI

- `Greetings` `33952985186` — `SUCCESS`,
- `CheckersEngine` `33952985175` — `SUCCESS`,
- `P1-AUD3-07 Readiness` `33952985147` — `SUCCESS`,
- `Security Gate` `33952985162` — `SUCCESS`.

Final evidence in PR body:

- readiness aggregate `14/14 PASS`,
- HTTP `6/6`,
- real PostgreSQL `4/4`,
- runtime wiring `4/4`,
- full npm no failures,
- browser Checkers/Gomoku PASS,
- npm audit 0 vulnerabilities,
- gitleaks PASS,
- CodeQL PASS.

## 8.5 Audit provenance

PR timeline nie zachowuje niezależnego review report. PR body/merge zachowują bardzo bogaty final evidence package, ale sam audit verdict nie jest w GitHub timeline reprezentowany tak mocno jak w PR #39.

**Evidence class:** `RECONSTRUCTED / STRONG CI+MERGE EVIDENCE, AUDIT REPORT GAP`.

Historical status: `MERGED / CLOSED`.

---

# 9. PR #39 — P1-AUD3-01 / P6 SHARED RATE LIMIT + REALTIME

## 9.1 Identity

- base: `8d520a5c2fea80b458e0adcf59468c9d6921c985`,
- branch: `fix/p1-aud3-01-shared-rate-limit-realtime-resync-p6`,
- pre-correction HEAD: `c490d0403b0843acc3d59650529baf32ff217d93`,
- final HEAD: `c4669ea81bc2d0404f95d75a17a793a065ed725a`,
- final TREE: `3b6dbca54ff33e06691ecbe002bdc96f0215f151`,
- merge commit: `c5c34aabe4fcd04b087e25161778798146030c9b`,
- merge TREE: `3b6dbca54ff33e06691ecbe002bdc96f0215f151`,
- commits: `14`,
- changed files: `9`.

## 9.2 Lead finding chain

PR body zachowuje:

- `P6-F01` severity MEDIUM,
- Lead finding: local limiter ordering,
- corrective commits `3a8ea629...`, `7a450c7...`, `c4669ea...`,
- final local-before-shared behavior,
- fail-closed shared limiter failure,
- health bypass,
- signal-only PostgreSQL LISTEN/NOTIFY,
- persistence-before-publish,
- no publish after conflict invariant.

## 9.3 Exact-head CI

Dla `c4669ea...`:

- `Greetings` `33962992679` — `SUCCESS`,
- `P1-AUD3-07 Readiness` `33962992739` — `SUCCESS`,
- `Security Gate` `33962992733` — `SUCCESS`,
- `CheckersEngine` `33962992668` — `SUCCESS`,
- `P1-AUD3-01 Distributed Infrastructure` `33962992847` — `SUCCESS`.

Focused P6 body evidence:

- P6 `23/23`,
- P6-F01 `5/5`,
- P4 no-publish-after-409 `5/5`,
- real PostgreSQL CAS `3/3`,
- P3 crypto `6/6`,
- P4 Gomoku durability/concurrency `13/13`,
- P5 readiness `14/14`,
- full Node `202 total / 200 PASS / 0 FAIL / 2 SKIP`,
- browsers PASS,
- npm audit 0 vulnerabilities,
- gitleaks PASS,
- CodeQL PASS.

## 9.4 Audit provenance — strongest historical record in this set

Merge commit `c5c34a...` literalnie zapisuje:

`Owner-authorized merge after Lead PASS and independent Claude audit. No deployment or production migration authorized.`

To jest bezpośredni repo-level proof, że merge nastąpił po Lead PASS i niezależnym audycie Claude.

**Evidence class:** `DIRECT`.

Historical status: `MERGED / CLOSED`.

---

# 10. MERGE CHAIN / CONTENT CONTINUITY

Zweryfikowany łańcuch głównych merge commits:

```text
9f3b6551... baseline
  -> PR #29 merge c81b7819...
  -> PR #30 merge 2445434c...
  -> PR #36 merge 05989fa2...
  -> PR #37 merge d0020271...
  -> [repaired governance-only incident before P5]
  -> PR #38 merge 8d520a5c...
  -> PR #39 merge c5c34aab...
```

Dla każdego z sześciu work itemów finalny merge TREE odpowiada finalnemu zmergowanemu implementation TREE.

---

# 11. AUDIT PROVENANCE GAPS — FORMAL RECORD

Backfill ujawnił, że historyczny technical closure trail jest mocniejszy niż wcześniejszy MASTER summary, ale jakość zachowania samych niezależnych raportów audytowych nie jest jednakowa.

### Directly preserved

- PR #39: Lead PASS + independent Claude audit są jawnie zapisane w merge commit.

### Strong partial / indirect

- PR #36: PR body zachowuje previously independently audited HEAD + corrective finding.
- PR #37: merge zapisuje audited commit history, final commit domyka audit conditions.
- PR #29: final commit jawnie odwołuje się do Claude conditions, ale brak final review submission.

### Audit artifact gap in GitHub timeline

- PR #30.
- PR #38.

Nie oznacza to automatycznie, że audytu nie było. Oznacza wyłącznie, że na podstawie obecnie odczytanego GitHub evidence nie wolno twierdzić, że formalny raport jest przechowywany w PR timeline.

Final FULL PROJECT AUDIT po P8 i tak ponownie obejmie te subsystemy, dlatego luki provenance nie są traktowane jako powód do automatycznego re-open starych work itemów.

---

# 12. STALE / HISTORICAL PR BOUNDARY

Starsze stale PR-y #31–#35 pozostają reference-only, chyba że inny kanoniczny dokument jednoznacznie przypisuje im historyczny kontekst. W szczególności PR #35 nie jest finalnym P1-R-01 implementation.

TOM 17 nie zmienia tej zasady.

---

# 13. RESULT

```text
HISTORICAL P1 EVIDENCE BACKFILL — PR #29/#30/#36/#37/#38/#39 = COMPLETE FOR REPOSITORY-AVAILABLE EVIDENCE
EXACT HEADS = RECORDED
EXACT TREES = RECORDED
MERGE COMMITS = RECORDED
EXACT-HEAD PR CI = RECORDED
AUDIT PROVENANCE QUALITY = CLASSIFIED
HISTORICAL CLOSURE = PRESERVED
PRODUCTION DEPLOYMENT CLAIM = NONE
```

Następne kroki dokumentacyjne powinny wykorzystywać ten TOM jako canonical history evidence source zamiast ogólnych opisów `historical closed implementation`.