# GRACZ.PL — FULL MAX MASTER DOCUMENTATION

**Status:** LIVING DOCUMENTATION / NOT FROZEN  
**Repository:** `developergracz/gracz-pl-2`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Production authorization:** NONE  
**Merge authorization:** NONE  

## 1. Cel

Ten pakiet ma być nadrzędną, dowodową dokumentacją całego portalu Gracz.pl — od stanu historycznego i odbudowy systemu, przez architekturę V3, implementację technicznych P1, audyty, testy, PostgreSQL, DR, bezpieczeństwo, MatchRuntime, gry, FairPlay MAX, operacje produkcyjne, aż do finalnego AS-BUILT.

Dokumentacja ma odróżniać bezwzględnie:

- stan historyczny,
- projekt docelowy,
- kod zaimplementowany,
- kod zmergowany,
- testy wykonane,
- audyty niezależne,
- działania produkcyjne,
- elementy planowane lub niewykonane.

Żaden dokument nie autoryzuje merge, deployu, migracji, zmian Render/ENV/DNS/Cloudflare ani działań produkcyjnych.

## 2. Źródła prawdy

1. Aktualny kod i historia Git w `developergracz/gracz-pl-2`.
2. Zweryfikowane PR, commit SHA, TREE SHA i GitHub Actions.
3. `Nowa dokumentacja Gracz.pl/` wraz z ADR, audytami i checkpointami.
4. Niezależne raporty audytowe, gdy zostaną utrwalone.
5. Jawne decyzje Owner + Lead.

W przypadku sprzeczności wygrywa najnowszy dowód o najwyższej jakości, nie starszy opis statusowy.

## 3. Struktura docelowa

### TOM 0 — GOVERNANCE / HISTORIA / EVIDENCE

- `00B-MASTER-HISTORIA-PROJEKTU-GRACZ-PL.md`
- `00C-DZIENNIK-KROKOW-PROJEKTU-GRACZ-PL.md`
- `00-FULL-MAX-MASTER/00-INDEKS-GLOWNY-FULL-MAX.md`
- `00-FULL-MAX-MASTER/01-EVIDENCE-REGISTER.md`
- `00-FULL-MAX-MASTER/04-IMPLEMENTATION-AUDIT-REGISTER.md`

### TOM 1 — ARCHITEKTURA SYSTEMOWA

- architektura logiczna i fizyczna,
- granice zaufania,
- frontend/API/realtime,
- MatchRuntime,
- silniki gier,
- PostgreSQL,
- background jobs,
- storage i cache,
- observability,
- infrastruktura i deployment model.

### TOM 2 — DATA / POSTGRESQL

- AS-IS,
- V3 target model,
- migracje,
- constraints,
- indeksy,
- concurrency,
- ownership,
- retention,
- backup i restore.

### TOM 3 — SECURITY

- auth,
- session security,
- RBAC/MFA,
- secrets,
- crypto separation,
- rate limiting,
- abuse prevention,
- supply chain,
- vulnerability management,
- incident response.

### TOM 4 — GAMES / MATCH RUNTIME

- Checkers,
- Gomoku,
- Thousand,
- shared MatchRuntime,
- idempotency,
- CAS,
- ownershipEpoch,
- restart recovery,
- projections,
- realtime signaling.

### TOM 5 — FAIRPLAY MAX / GFPE

- requirements,
- threat model,
- cryptographic protocol,
- deterministic shuffle,
- commitments,
- Verify Hand,
- ledger,
- key management,
- adapters Tysiąc/Poker/Blackjack/Wojna,
- test laboratory.

### TOM 6 — CI / TEST / QUALITY

- unit,
- integration,
- PostgreSQL,
- concurrency,
- browser,
- fault injection,
- property tests,
- fuzz,
- security gates,
- CodeQL,
- gitleaks,
- dependency audit.

### TOM 7 — OPERATIONS / DR / OBSERVABILITY

- health/readiness,
- logging,
- metrics,
- tracing,
- alerting,
- SLO,
- backup,
- restore drills,
- RPO/RTO,
- incident runbooks,
- rollback.

### TOM 8 — PRODUCT / UX / SEO / DOMAINS

- homepage,
- auth UX,
- profiles,
- rooms/players,
- messaging,
- mobile/responsive,
- accessibility,
- SEO,
- domains/DNS/Cloudflare,
- maintenance mode.

### TOM 9 — PRIVACY / LEGAL / GOVERNANCE

- retention,
- deletion,
- legal hold,
- privacy decisions,
- audit provenance,
- Owner authorizations,
- release governance.

### TOM 10 — FINAL AS-BUILT

Tworzony dopiero po finalnym pełnym audycie, korektach, zatwierdzonym wdrożeniu i weryfikacji produkcyjnej.

## 4. Aktualny checkpoint — 08.09.2026

- dokumentacja V3 istnieje i pozostaje bazą historyczno-architektoniczną,
- P7 / P1-U-02 = CLOSED,
- P1-R-01 recurring PostgreSQL DR = CLOSED,
- P8 / P1-U-01 = implementation complete / PR #43 open / independent Claude audit pending,
- P8 merge = NOT AUTHORIZED,
- production/deploy = NOT AUTHORIZED,
- FairPlay MAX = PRE-DESIGN ONLY,
- GFPE-0 + GFPE-1 = rozpoczęte jako PRE-DESIGN,
- pełny projektowy audyt całego Gracz.pl ma nastąpić po formalnym zamknięciu P8.

## 5. Reguła aktualizacji

Po każdym istotnym kroku aktualizowane są co najmniej:

1. `00C-DZIENNIK-KROKOW-PROJEKTU-GRACZ-PL.md`,
2. `01-EVIDENCE-REGISTER.md`, jeśli powstał nowy dowód,
3. `04-IMPLEMENTATION-AUDIT-REGISTER.md`, jeśli zmienił się status implementacji/audytu,
4. odpowiedni tom domenowy,
5. historia MASTER, gdy krok zmienia stan projektu.

## 6. Finalny warunek FULL MAX DOCUMENTATION

Pakiet może zostać oznaczony `FINAL / AS-BUILT` dopiero gdy:

- zakończono pełny audyt całego projektu,
- wszystkie blocking findings zostały zamknięte,
- finalny main jest jednoznacznie wskazany SHA/TREE,
- test evidence jest kompletny,
- operacje produkcyjne są udokumentowane,
- konfiguracja produkcyjna została zweryfikowana,
- FairPlay MAX i gry są opisane zgodnie z faktycznym stanem,
- rozbieżności `design vs implementation vs production` są jawnie rozstrzygnięte.
