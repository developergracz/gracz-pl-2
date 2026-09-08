# GRACZ.PL — DZIENNIK KROKÓW PROJEKTU

**Status:** APPEND-ONLY LIVING LOG  
**Utworzono:** 08.09.2026  
**Repozytorium:** `developergracz/gracz-pl-2`

---

## Zasada prowadzenia

Ten plik ma być krótkim, bieżącym dziennikiem projektu. Nie zastępuje pełnych raportów, PR ani audytów. Ma umożliwiać szybkie odtworzenie kolejności wydarzeń.

Po każdym znaczącym kroku dopisujemy nowy wpis na końcu.

Każdy wpis powinien zawierać, jeśli dotyczy:

- datę,
- work item / etap,
- branch,
- base SHA/TREE,
- final HEAD/TREE,
- PR,
- status CI,
- status Lead review,
- status independent audit,
- merge/deploy/production status,
- następny krok.

Nie usuwamy poprzednich wpisów. Korekty zapisujemy jako nowy wpis `CORRECTION / SUPERSEDES`.

---

# RECONSTRUCTED CHECKPOINTS

## 2026-08 — Odbudowa i modernizacja Gracz.pl

- rozwój nowoczesnej wersji Gracz.pl,
- odtworzenie Warcabów i Gomoku z wersji Flash,
- realne testy multiplayer na Render,
- prace nad lobby, czatem, profilem, wiadomościami, rankingami i turniejami,
- decyzja o budowie architektury pod długoterminową skalowalność i bezpieczeństwo.

Status: `HISTORICAL / RECONSTRUCTED`.

---

## 2026-08-29 → 2026-09-01 — Dokumentacja V3 i bramki

- skonsolidowano dokumentację w `Nowa dokumentacja Gracz.pl/`,
- ETAP 1B/2/3 zamknięte,
- Gate 15 = `GO TO ETAP 4 / PRODUCTION V3 NO-GO`,
- ETAP 4 otwarty,
- E4.1-H = `PENDING / SAFE HOLD`,
- production freeze pozostaje aktywny,
- architektura V3 została uznana za gotową projektowo do implementacji, ale bez automatycznej autoryzacji wykonania.

---

## 2026-09 — Techniczne P1

Zamykane sekwencyjnie m.in.:

- PR #29 — P1-C-01 / Checkers CAS — CLOSED,
- PR #30 — P1-H-01 tournament concurrency — CLOSED,
- PR #36 — crypto key separation — CLOSED,
- PR #37 — Gomoku durability — CLOSED,
- PR #38 — readiness — CLOSED,
- PR #39 — shared rate limiting/realtime — CLOSED.

---

## P7 / P1-U-02 — Common MatchRuntime

- PR #40,
- final HEAD `5b70c2d95fc937f0b516b7fafbce22bb8f59f432`,
- final TREE `81da9ee04a15fea2ea329d9e19e61cf9f6b438e6`,
- merge `f88070b0f1d13a3ef353a46714f456c452876872`,
- Lead PASS,
- ChatGPT-2 independent PASS,
- Claude final PASS,
- deploy = NO,
- production migration = NO.

Status: `MERGED / CLOSED`.

---

## P1-R-01 — Recurring PostgreSQL DR Restore Program

- stale PR #35 = reference only,
- final HEAD `535eaac04522c53f1ee8506881a70461cfabc22a`,
- TREE `6f3b73c0525b1157d764a358127af8afa32c4d41`,
- PR #41,
- merge `b276c92342203eb6c2e591b30219219b8ab7cf10`,
- final CI `34053197756` = SUCCESS,
- real isolated PostgreSQL DR = PASS,
- gitleaks = PASS,
- CodeQL = PASS,
- production restore = NO.

Status: `MERGED / CLOSED`.

---

## 2026-09-06 — Checkpoint dokumentacyjny przed P8

- branch `docs/post-p1-r-01-p8-checkpoint`,
- docs commit `43a9dd7ff111b46107af1e7f6ebdb056c345ebb7`,
- PR #42,
- main po merge `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`,
- TREE `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`,
- P8 = next controlled phase.

---

## 2026-09-07 — P8 / P1-U-01 implementation

- branch `fix/p1-u-01-canonical-game-types-p8`,
- base `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`,
- final HEAD `d7220f57d60779584048cc5c695d40dbb948b9cb`,
- final TREE `4cbb8504036d26ed2e257f52a475968f5d4cd827`,
- 8 commits,
- 7 changed files,
- canonical IDs = `checkers / gomoku / thousand`,
- alias = `warcaby → checkers`,
- unknown identifiers = fail-closed,
- final CI `34147638975` = PASS,
- Lead Review = PASS.

---

## 2026-09-07/08 — PR #43

- PR #43 opened,
- title `P1-U-01: canonical game type dictionary — READY FOR INDEPENDENT AUDIT`,
- base = `main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`,
- head = `d7220f57d60779584048cc5c695d40dbb948b9cb`,
- mergeable = YES,
- PR checks = PASS,
- auto-merge = NOT AUTHORIZED,
- merge = NOT AUTHORIZED,
- independent Claude audit = PENDING because Claude is temporarily unavailable / rate-limited.

Status: `OPEN / NOT MERGED`.

---

## 2026-09-08 — FairPlay MAX PRE-DESIGN rozpoczęty

Owner i Lead uzgodnili, że podczas oczekiwania na audyt P8 można rozpocząć wyłącznie dokumentacyjny pre-design FairPlay MAX.

Rozpoczęto:

- `GFPE-0 — System Requirements`,
- `GFPE-1 — Threat Model`.

Założenia obejmują m.in.:

- common FairPlay Core dla Tysiąca/Pokera/Blackjacka/Wojny,
- no game-local RNG,
- `NO FAIRPLAY = NO DEAL`,
- multi-party commit–reveal,
- HKDF-SHA-256,
- HMAC-SHA-256,
- deterministic Fisher-Yates + rejection sampling,
- immutable deck/shoe,
- Ed25519 signatures,
- tamper-evident ledger,
- Verify Hand,
- strict privacy projection,
- MatchRuntime/CAS/ownershipEpoch integration,
- Tysiąc multiplayer jako pierwsza pełna gra walidacyjna.

Status:

`PRE-DESIGN ONLY / NOT FROZEN / IMPLEMENTATION NOT AUTHORIZED`.

---

## 2026-09-08 — Utworzenie MASTER HISTORIA + DZIENNIK

Gałąź dokumentacyjna:

`docs/master-history-gracz-pl-2026-09-08`

Base main:

`ad0739190fe2f9d1657b2b77c8b5f8e825830c08`

Utworzono:

- `00B-MASTER-HISTORIA-PROJEKTU-GRACZ-PL.md`,
- `00C-DZIENNIK-KROKOW-PROJEKTU-GRACZ-PL.md`.

Cel:

od tej chwili każdy ważny krok projektu ma otrzymywać trwały wpis, żeby finalna dokumentacja As-Built nie wymagała ponownego odtwarzania historii z rozmów.

Merge = `NOT AUTHORIZED`.
Deploy = `NO`.
Production change = `NO`.

---

## 2026-09-08 — FULL MAX MASTER DOCUMENTATION / architektura komponentowa

Na gałęzi `docs/master-history-gracz-pl-2026-09-08` zweryfikowano rzeczywisty układ runtime względem:

`main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`

TREE:

`04f72af50f6fad2ba01bf7eaa6b4d856267d517b`

Zweryfikowano m.in.:

- `modern/checkers-engine/package.json`,
- pełne drzewo `modern/checkers-engine/`,
- `src/main.js`,
- `src/match-runtime.js`,
- `src/index.js`,
- warstwy auth/RBAC/MFA/security/audit,
- Lobby, Rankings, Tournaments,
- Gomoku,
- Tysiąc,
- PostgreSQL persistence,
- distributed traffic/realtime,
- DR/ops,
- web UI oraz test surfaces.

Utworzono:

`00-FULL-MAX-MASTER/12-ARCHITEKTURA-KOMPONENT-PO-KOMPONENCIE.md`

Dokument opisuje odpowiedzialności komponentów, trust boundaries, source-of-truth matrix, test architecture, istniejące mocne strony oraz obszary obowiązkowe do pełnego audytu po P8.

P8 / PR #43 nie został uznany za część `main`; jego stan nadal pozostaje `OPEN / AUDIT PENDING`.

Merge = `NOT AUTHORIZED`.
Deploy = `NO`.
Production change = `NO`.

---

## 2026-09-08 — FULL MAX MASTER DOCUMENTATION / FULL API & CONTRACT CATALOG

Na baseline:

`main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`

TREE:

`04f72af50f6fad2ba01bf7eaa6b4d856267d517b`

zweryfikowano rzeczywiste handlery i kontrakty m.in.:

- `server.js`,
- `server-p7.js`,
- `platform-lobby-http.js`,
- `gomoku-http.js`,
- `gomoku-service.js`,
- `postgres-gomoku-service.js`,
- `thousand-http.js`,
- `thousand-service.js`,
- `tournaments.js`,
- `rankings.js`,
- `global-chat.js`,
- `newsletter.js`,
- `newsletter-admin-handler.js`,
- `admin-security-handler.js`,
- `health.js`.

Utworzono:

`00-FULL-MAX-MASTER/13-API-I-KONTRAKTY-SYSTEMU-MASTER.md`

Dokument kataloguje endpointy, auth, request/response semantics, błędy, concurrency/idempotency, PostgreSQL, realtime, privacy/projection i test references.

Jawnie rozdzielono:

- `CURRENT MAIN`,
- `P8 / PR #43 PENDING DELTA`.

Zapisano m.in. różnice:

- Checkers moves = P7 MatchRuntime/CAS/idempotency,
- Gomoku = własny PostgreSQL revision CAS + requestId,
- Thousand = własny revision/expectedRevision i obecny game-local RNG,
- P8 canonical game type contract nie jest jeszcze częścią `main`.

Merge = `NOT AUTHORIZED`.
Deploy = `NO`.
Production change = `NO`.

---

# NEXT ENTRY

Najbliższy oczekiwany wpis:

`P8 / PR #43 — CLAUDE INDEPENDENT AUDIT RESULT`
