# GRACZ.PL — MASTER HISTORIA PROJEKTU

**Status:** LIVING DOCUMENT / KANONICZNA HISTORIA ROBOCZA  
**Data pierwszego utworzenia:** 08.09.2026  
**Repozytorium:** `developergracz/gracz-pl-2`  
**Bazowy `main` przy utworzeniu dokumentu:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Bazowy TREE:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**Gałąź dokumentacyjna:** `docs/master-history-gracz-pl-2026-09-08`

---

## 0. Cel dokumentu

Ten dokument ma być jednym, trwałym punktem odniesienia dla historii tworzenia nowego Gracz.pl — od stanu początkowego, przez odtworzenie gier i dokumentację V3, po kolejne poprawki P1, MatchRuntime, DR, P8 oraz rozpoczęcie pre-designu Gracz.pl FairPlay MAX.

Dokument ma być aktualizowany po kolejnych istotnych krokach projektu.

Zasada nadrzędna:

> **Nie wolno dopisywać faktów, których nie potwierdzają artefakty repozytorium, raporty audytowe, CI, decyzje Owner/Lead lub inne trwałe dowody.**

Jeżeli dokładna data, SHA, liczba lub stan nie są pewne, należy to jawnie oznaczyć jako `HISTORICAL / RECONSTRUCTED / NEEDS EVIDENCE`, zamiast zgadywać.

Ten dokument nie autoryzuje merge, deploy, migracji ani operacji produkcyjnych.

---

# 1. Początek projektu — cel Gracz.pl

Gracz.pl został przyjęty jako długoterminowy projekt odbudowy i modernizacji dawnego portalu gier, z horyzontem utrzymania około 10–15 lat.

Najważniejsze cele od początku:

- odtworzenie zachowania dawnych gier Flash w nowoczesnej technologii,
- uruchomienie stabilnego multiplayera,
- zachowanie charakteru i funkcji dawnych Warcabów i Gomoku,
- stworzenie wspólnej platformy użytkowników, pokoi, zaproszeń, rankingów, turniejów, wiadomości i administracji,
- od początku projektowanie pod bezpieczeństwo, skalowalność i wysokie obciążenie,
- unikanie architektury, która przy wzroście liczby użytkowników wymagałaby przebudowy całego systemu,
- pełna kontrola Owner/Admin nad systemem,
- rozwój własnych gier i mechanizmów zamiast zależności od zamkniętych rozwiązań zewnętrznych.

Repozytoria historycznie używane w projekcie:

- `developergracz/Gracz-Application` — wcześniejsze źródło,
- `developergracz/gracz-pl-2` — docelowe repozytorium nowej wersji i dokumentacji.

Domena główna:

- `gracz.pl`

Dodatkowa domena pozostająca w zasobach Ownera:

- `e-mail.pl`

---

# 2. Pierwsze odtworzenie gier i środowiska testowego

Na wcześniejszym etapie projektu odtworzono działającą wersję testową Warcabów multiplayer w środowisku Render.

Historyczny serwis testowy był wykorzystywany do realnego grania i ręcznej oceny:

- wejścia do pokoju,
- oczekiwania na drugiego gracza,
- ruchów multiplayer,
- czatu,
- układu planszy,
- konsoli gry,
- zachowania przy reconnect,
- wyglądu w przeglądarce i na telefonie.

W tej fazie zgłaszano m.in. problemy z:

- przyciskami `Dołącz`, `Połącz ponownie`, `Start`,
- stanem `Oczekiwanie`,
- skalowaniem gry,
- układem prawej konsoli,
- rozciągniętym chatem,
- grafiką planszy i pionków,
- zgodnością mobilną i orientacją poziomą telefonu.

Wymagania zachowania Warcabów obejmowały m.in. zachowanie charakterystycznych reguł dawnej wersji, w tym kontynuowanego wielokrotnego bicia damą, poprawnego odtwarzania planszy i elementów UI.

Równolegle rozwijano lub planowano:

- Gomoku,
- Tysiąca,
- pokoje i listę graczy,
- zaproszenia,
- profil,
- prywatne wiadomości,
- ranking,
- turnieje,
- system logowania i rejestracji.

---

# 3. Decyzja o profesjonalizacji projektu

W miarę rozwoju projektu przyjęto, że dalsza praca nie będzie prowadzona jako seria luźnych poprawek UI, lecz jako kontrolowana modernizacja całego systemu.

Przyjęto model ról:

- **Owner — Czesław Socha** — finalna decyzja biznesowa i zgoda na merge/deploy/produkcję,
- **Lead Architect — ChatGPT** — architektura, mandaty, weryfikacja, klasyfikacja findingów i decyzje techniczne,
- **Implementation Engineer — drugi ChatGPT / ChatGPT-2** — implementacja wyłącznie w zakresie mandatów,
- **Claude** — niezależny audyt techniczny i red-team,
- **Copilot** — wsparcie repozytorium, kodu i testów,
- inne modele mogą być używane pomocniczo do niezależnego przeglądu matematyki/statystyki.

Przyjęto zasadę, że samo stwierdzenie `PASS` przez implementatora nie jest dowodem wystarczającym do merge.

Docelowy proces:

`MANDATE → IMPLEMENTATION → CI → LEAD REVIEW → INDEPENDENT AUDIT → OWNER AUTHORIZATION → MERGE`

---

# 4. Nowa dokumentacja Gracz.pl V3

Pod koniec sierpnia 2026 projekt przeszedł do budowy pełnego pakietu dokumentacyjnego V3.

Katalog kanoniczny:

`Nowa dokumentacja Gracz.pl/`

Dokumentacja została rozdzielona na obszary:

- architektura,
- baza danych AS-IS,
- docelowa baza V3,
- migracje,
- gates i bramki produkcyjne,
- decyzje architektoniczne ADR,
- review provenance,
- Privacy/Legal,
- dokumentację etapów i audytów.

Pakiet z czasem rozrósł się do około 190 plików w stanie odnotowanym w `00-STATUS-I-SPIS-TRESCI.md` z 06.09.2026.

Najważniejsze zasady dokumentacji:

- oddzielenie stanu AS-IS od architektury docelowej,
- oddzielenie projektu od autoryzacji wykonania,
- zachowanie dowodów i historii decyzji,
- brak utożsamiania `READY FOR IMPLEMENTATION` z pozwoleniem na wykonanie,
- brak utożsamiania dokumentacyjnego PASS z produkcyjnym GO.

---

# 5. Etapy V3 i produkcyjny freeze

Według statusu dokumentacji z 06.09.2026:

- `ETAP 1B — CLOSED`,
- `ETAP 2 — CLOSED`,
- `ETAP 3 — CLOSED`,
- `Gate 15 = GO TO ETAP 4 / PRODUCTION V3 NO-GO`,
- `ETAP 4 = OPEN`,
- `E4.0 = OPERATIONALLY COMPLETE / FREEZE ACTIVE`,
- `E4.1 = IN PROGRESS / H BLOCKED`,
- `E4.1-H = PENDING / SAFE HOLD`,
- `E4.2–E4.10 = NOT AUTHORIZED / NOT COMPLETE`,
- `Production V3 = NO-GO`.

Produkcja była traktowana jako środowisko chronione i read-only dla działań badawczych, dopóki osobne bramki nie zostaną spełnione.

Nie wolno było wykonywać nieautoryzowanych:

- deployów,
- restartów,
- migracji,
- zmian Render,
- zmian ENV,
- zmian DNS,
- zmian Cloudflare,
- zmian produkcyjnej bazy.

---

# 6. PostgreSQL, migracje i restore

W ramach E4.1 przeprowadzono kontrolę pakietu migracji oraz lokalnego PostgreSQL.

Historycznie zweryfikowano m.in.:

- integralność migracji `001–014`,
- lokalny PostgreSQL,
- połączenie i tożsamość instancji,
- tryb READ ONLY podczas kontroli produkcji,
- backup anchor,
- restore validation,
- porównanie restore z produkcją,
- kontrolę historycznych danych szyfrowanych.

W dokumentacji z 06.09.2026 zapisano m.in. potwierdzenie zgodności restore z produkcją na poziomie 28/28 tabel i 17 711/17 711 rekordów dla badanego snapshotu.

Jednocześnie świeży gate E4.1-H pozostawał `PENDING / SAFE HOLD` i nie został zastąpiony historycznym testem.

---

# 7. Audyt dokumentacji i backlog P1

Po zakończeniu głównej dokumentacji V3 przeprowadzono niezależne przeglądy architektury i dokumentacji.

Historyczny audyt techniczny utrwalił 10 technicznych pozycji P1:

1. `P1-AUD3-01` — shared rate limiting / realtime,
2. `P1-AUD3-02 / P1-C-01` — Checkers persistence CAS,
3. `P1-AUD3-03` — crypto key separation,
4. `P1-AUD3-04` — Gomoku durability,
5. `P1-H-01` — tournament concurrency,
6. `P1-R-01` — recurring DR restore,
7. `P1-AUD3-07` — readiness,
8. `P1-B-01` — RBAC/MFA tests,
9. `P1-U-01` — canonical game type dictionary,
10. `P1-U-02` — common Match Runtime.

Audyt nie oznaczał, że wszystkie te elementy są od razu wdrażane równocześnie. Przyjęto sekwencyjne zamykanie jednego kontrolowanego zakresu po drugim.

Osobno pozostawało pięć otwartych Privacy/Legal P1 blokujących `REVIEWED DESIGN`, ale nie unieważniających zakończenia samego pakietu dokumentacyjnego V3.

---

# 8. Sekwencyjne zamykanie technicznych P1

## 8.1 P1-C-01 / P1-AUD3-02 — Checkers Session CAS

PR:

`#29`

Zakres obejmował ochronę zapisu sesji Checkers przed utratą nowszego stanu przy równoległych zapisach.

Kluczowe własności:

- PostgreSQL CAS,
- expected version,
- stabilny konflikt HTTP 409,
- brak publikacji realtime po przegranym CAS,
- zachowanie poprawnego retry i idempotency.

Status:

`MERGED / CLOSED`

---

## 8.2 P1-H-01 — Tournament Advancement Concurrency

PR:

`#30`

Cel:

- ochrona turniejów przed podwójnym advance,
- dokładnie jeden zwycięski writer przy równoległym wyniku,
- brak podwójnego naliczenia wyniku.

Status:

`MERGED / CLOSED`

---

## 8.3 P1-AUD3-03 — Crypto Key Separation

PR:

`#36`

Cel:

- oddzielenie kluczy szyfrowania od `AUTH_SECRET`,
- osobne domeny kluczy,
- bezpieczna zgodność z legacy read,
- single-write na nowych dedicated keys,
- fail-closed w produkcji przy brakujących lub ponownie użytych sekretach.

Status:

`MERGED / CLOSED`

---

## 8.4 P1-AUD3-04 — Gomoku Durability / Concurrency / Recovery

PR:

`#37`

Cel:

- durable PostgreSQL state,
- CAS i revision,
- restart recovery,
- trwała idempotency,
- ochrona przed concurrent create i stale writes.

Status:

`MERGED / CLOSED`

---

## 8.5 P1-AUD3-07 — Liveness / Readiness

PR:

`#38`

Cel:

- rozdzielenie liveness i readiness,
- bounded PostgreSQL health check,
- brak zawieszenia readiness,
- fail-closed przy niedostępnej wymaganej zależności,
- sanitization publicznej odpowiedzi.

Status:

`MERGED / CLOSED`

---

## 8.6 P1-AUD3-01 — Shared Rate Limiting / Realtime Backplane

PR:

`#39`

Cel:

- shared infrastruktura dla wielu instancji,
- wspólne rate limiting counters,
- realtime oparty na signal-only publication,
- authoritative re-read po sygnale,
- brak publikacji pełnego prywatnego state,
- fail-closed przy niedostępnej wymaganej infrastrukturze.

Status:

`MERGED / CLOSED`

---

# 9. P7 / P1-U-02 — Common MatchRuntime

PR:

`#40`

Final implementation HEAD:

`5b70c2d95fc937f0b516b7fafbce22bb8f59f432`

Final TREE:

`81da9ee04a15fea2ea329d9e19e61cf9f6b438e6`

Merge commit:

`f88070b0f1d13a3ef353a46714f456c452876872`

Audyt:

- Lead PASS,
- ChatGPT-2 independent PASS,
- Claude final PASS.

P7 wprowadził wspólny `MatchRuntime` jako fundament serwerowo-autorytatywnych gier.

Najważniejsze właściwości:

- PostgreSQL `expectedVersion` / CAS,
- `ownershipEpoch` fencing,
- durable idempotency,
- restart recovery,
- mandatory player projection,
- fail-closed brak surowego state,
- signal-only realtime,
- Checkers jako reference adapter,
- cutover ścieżki ruchu Checkers do MatchRuntime,
- kompatybilność z legacy processed requests.

W ramach P7 domknięto findingi:

- `P7-F01` — signal/private-state boundary,
- `P7-F02` — fail-closed projection,
- `P7-F03` — current snapshot on replay.

Ważne ograniczenie:

Gomoku i Tysiąc nie zostały jeszcze w tym momencie przeniesione na MatchRuntime.

Status:

`MERGED / CLOSED`

---

# 10. P1-R-01 — Recurring PostgreSQL DR Restore Program

Historyczny PR `#35` pozostał stale/reference-only i nie jest wersją finalną.

Finalna implementacja została wykonana na resync branch.

Final HEAD:

`535eaac04522c53f1ee8506881a70461cfabc22a`

TREE:

`6f3b73c0525b1157d764a358127af8afa32c4d41`

PR:

`#41`

Merge commit:

`b276c92342203eb6c2e591b30219219b8ab7cf10`

Zakres obejmował m.in.:

- fail-closed backup/restore scripts,
- szyfrowany streaming `pg_dump → OpenSSL AES-256-CBC/PBKDF2`,
- SHA-256 checksum,
- decryptability preflight przed destructive restore,
- source/target identity checks,
- odrzucenie restore do tej samej bazy/tego samego klastra,
- disposable marker,
- source read-only queries,
- structured JSON evidence,
- redaction,
- CI z realnymi odseparowanymi klastrami PostgreSQL.

Final CI:

`34053197756 — SUCCESS`

Status:

`MERGED / CLOSED`

Produkcja nie została użyta do automatycznego restore rehearsal.

---

# 11. Checkpoint dokumentacyjny po P7 i P1-R-01

Gałąź:

`docs/post-p1-r-01-p8-checkpoint`

Docs commit:

`43a9dd7ff111b46107af1e7f6ebdb056c345ebb7`

TREE:

`04f72af50f6fad2ba01bf7eaa6b4d856267d517b`

PR:

`#42`

Merge commit / obowiązujący `main` po checkpoint:

`ad0739190fe2f9d1657b2b77c8b5f8e825830c08`

TREE:

`04f72af50f6fad2ba01bf7eaa6b4d856267d517b`

Checkpoint utrwalił:

- P7 = CLOSED,
- P1-R-01 = CLOSED,
- P8 = next controlled phase,
- brak deployu i zmian produkcyjnych.

---

# 12. P8 / P1-U-01 — Canonical Game Type Dictionary

Po analizie backlogu jako P8 wybrano:

`P1-U-01 — Canonical Game Type Dictionary`

Canonical internal IDs:

- `checkers`,
- `gomoku`,
- `thousand`.

Compatibility alias:

- `warcaby → checkers`.

Założenia:

- brak drugiej runtime identity dla `warcaby`,
- nieznane gry fail-closed,
- `all` pozostaje rankingowym selektorem agregującym, a nie game type,
- brak `szachy`, `poker`, `blackjack`, `war`, `tysiac`, `draughts` bez jawnej rejestracji,
- jeden centralny registry dla Lobby / Rankings / Tournaments.

Gałąź implementacyjna:

`fix/p1-u-01-canonical-game-types-p8`

Base:

`ad0739190fe2f9d1657b2b77c8b5f8e825830c08`

Final HEAD:

`d7220f57d60779584048cc5c695d40dbb948b9cb`

Final TREE:

`4cbb8504036d26ed2e257f52a475968f5d4cd827`

Liczba commitów:

`8`

Liczba zmienionych plików:

`7`

Final branch CI:

`34147638975 — PASS`

Lead Review:

`PASS`

PR:

`#43`

Tytuł:

`P1-U-01: canonical game type dictionary — READY FOR INDEPENDENT AUDIT`

Stan na 08.09.2026:

- PR OPEN,
- mergeable = YES,
- Greetings = PASS,
- Security Gate = PASS,
- P1-H-01 Tournament Concurrency = PASS,
- CheckersEngine = PASS,
- P1-U-01 Canonical Game Types P8 = PASS,
- AUTO-MERGE = NOT AUTHORIZED,
- MERGE = NOT AUTHORIZED,
- independent Claude audit = PENDING z powodu limitu/dostępności narzędzia.

**P8 NIE JEST JESZCZE FORMALNIE ZAMKNIĘTE.**

---

# 13. Co pozostaje po P8

Po formalnym zamknięciu P8 przyjęta sekwencja jest następująca:

1. merge/close P8 wyłącznie po Owner + Lead authorization,
2. krótki checkpoint dokumentacyjny,
3. FULL PROJECT AUDIT całego aktualnego `main`,
4. niezależny szeroki audyt Claude,
5. niezależna weryfikacja każdego findingu przez Lead,
6. canonical Correction / Remediation Register,
7. korekty wyłącznie na podstawie osobnych mandatów,
8. pełny CI i security regression po korektach,
9. pełny re-audyt całego projektu,
10. dopiero na czystym baseline przygotowanie finalnego As-Built,
11. dopiero potem właściwe projektowanie i implementacja Gracz.pl FairPlay MAX.

P1-B-01 pozostaje elementem do ponownego rozliczenia w pełnym audycie i nie powinien być automatycznie nazwany kolejnym P bez świeżej klasyfikacji.

---

# 14. Strategia gier karcianych i FairPlay MAX

W toku planowania rozwoju Gracz.pl przyjęto kierunek budowy własnego systemu uczciwości dla gier karcianych.

Nazwa robocza:

`GRACZ.PL FAIRPLAY MAX`

Nazwa techniczna rdzenia:

`GFPE — Gracz FairPlay Engine`

Pozycjonowanie:

- własny system Gracz.pl,
- bez formalnego twierdzenia o certyfikacji,
- kryptograficznie weryfikowalne tasowanie i rozdawanie,
- projektowany tak, aby w przyszłości mógł przejść zewnętrzny laboratoryjny review,
- pełna dokumentacja i dowody testowe.

System ma być wspólny dla:

- Tysiąca,
- Pokera,
- Blackjacka,
- Wojny,
- ewentualnych przyszłych gier karcianych.

Gra nie może posiadać własnego niezależnego RNG.

---

# 15. Docelowy kierunek techniczny FairPlay MAX

Pre-design zakłada dwie warstwy:

1. **Integration / Protocol Layer** — TypeScript strict, ESM, Node.js 24+,
2. **Crypto-critical Core** — Rust, opcjonalnie ten sam core kompilowany do WebAssembly dla browserowego Verify Hand.

Planowane standardowe prymitywy:

- OS CSPRNG,
- SHA-256,
- HMAC-SHA-256,
- HKDF-SHA-256,
- Ed25519,
- AES-256-GCM dla danych wrażliwych at-rest,
- RFC 8785 JCS lub równie precyzyjny kanoniczny format,
- PostgreSQL,
- deterministic Fisher-Yates,
- rejection sampling eliminujący modulo bias.

Zasada:

`NO FAIRPLAY = NO DEAL`

Nie wolno stosować fallbacków typu:

- `Math.random()`,
- timestamp seed,
- UUID seed,
- hard-coded test seed w produkcji,
- awaryjny drugi shuffle poza committed protocol.

---

# 16. Multi-party Commit–Reveal — kierunek pre-design

Planowany protokół bierze pod uwagę:

- server entropy,
- entropy graczy,
- immutable `handId`,
- protocol version,
- seat order,
- commit przed reveal,
- canonical transcript,
- HKDF-derived shuffle key,
- deterministic PRF stream,
- unbiased Fisher-Yates,
- deck commitment przed pierwszym deal.

Cel:

żadna pojedyncza strona nie powinna samodzielnie wybierać końcowego wyniku tasowania.

Abort po commit/reveal nie może usuwać historii i musi pozostać audytowalny.

---

# 17. Immutable Deck / Shoe

Po shuffle talia lub shoe zostaje zamrożona.

Po `DECK_FROZEN` niedozwolone jest:

- reshuffle w aktywnym rozdaniu,
- zmiana konkretnej karty,
- wygenerowanie „innej” następnej karty,
- cofnięcie cursor,
- ponowne wydanie tej samej pozycji.

Gra może tylko konsumować wcześniej committed sequence.

---

# 18. Verify Hand i prywatność

FairPlay MAX ma umożliwić użytkownikowi sprawdzenie integralności rozdania.

Planowany publiczny verifier powinien weryfikować m.in.:

- protocol version,
- podpis Ed25519,
- commitments,
- deck commitment / root,
- public card proofs,
- własne private card proofs,
- integrity ledgera,
- build/protocol identity.

W Pokerze nie wolno naiwnie ujawniać pełnego seed po każdym rozdaniu, jeśli pozwoliłoby to odtworzyć cudze spasowane/mucked karty.

Dlatego pre-design przewiduje możliwość per-position salted Merkle commitments i selective reveal.

Ważne ograniczenie:

prosty Merkle root nie jest sam w sobie publicznym dowodem, że ukryte liście tworzą poprawną losową permutację całej talii. Zaawansowane ZK/verifiable shuffle pozostaje osobnym przyszłym etapem, a nie częścią v1 bez dalszych analiz.

---

# 19. Integracja z MatchRuntime

FairPlay MAX ma budować na mechanizmach zamkniętych w P7, a nie je omijać.

W szczególności:

- `expectedVersion`,
- PostgreSQL CAS,
- `ownershipEpoch` fencing,
- durable idempotency,
- restart recovery,
- mandatory `project(viewerId)`,
- signal-only realtime.

Dla deal:

- tylko jeden node może przesunąć cursor,
- drugi writer przegrywa CAS/fencing,
- realtime nie publikuje authoritative private deck state.

---

# 20. Tysiąc jako pierwsza gra walidacyjna Full MAX

Po ukończeniu FairPlay MAX Core planowana jest pełna integracja z Tysiącem multiplayer.

Powód:

Tysiąc testuje prawie wszystkie ważne mechanizmy FairPlay, a jest prostszy systemowo i prywatnościowo od Pokera.

Zakres walidacji powinien objąć:

- 24-kartową talię,
- 2/3/4 graczy,
- prywatne ręce,
- musik/talony,
- deterministic frozen deck,
- reconnect,
- restart recovery,
- concurrency,
- persistence,
- Verify Hand,
- fault injection,
- miliony deterministycznie kontrolowanych rozdań w laboratorium testowym.

Dopiero po przejściu Tysiąca jako gry walidacyjnej planowane jest wejście w bardziej złożony Poker.

---

# 21. Kolejność docelowa po czystym baseline

Przyjęta kolejność techniczna:

`P8 → FULL PROJECT AUDIT → CORRECTIONS → RE-AUDIT → CLEAN MAIN → FAIRPLAY MAX SPEC → FAIRPLAY MAX CORE → TYSIĄC MULTIPLAYER VALIDATION → POKER → BLACKJACK → WOJNA`

Ta kolejność może zostać zmieniona wyłącznie jawnie, jeżeli późniejsze dowody techniczne wskażą lepszy wariant.

---

# 22. Rozpoczęcie FairPlay MAX PRE-DESIGN — 08.09.2026

Ze względu na czasowe ograniczenie dostępności Claude i brak możliwości zakończenia niezależnego audytu P8 w tym momencie, Owner i Lead uzgodnili wykorzystanie czasu na **PRE-DESIGN**, bez rozpoczynania implementacji.

08.09.2026 rozpoczęto:

- `GFPE-0 — SYSTEM REQUIREMENTS`,
- `GFPE-1 — THREAT MODEL`.

Status:

`PRE-DESIGN COMPLETE / NOT FROZEN / IMPLEMENTATION NOT AUTHORIZED`

Pre-design nie zmienia stanu P8 i nie daje zgody na kodowanie FairPlay Core.

---

# 23. Najważniejsze invariants FairPlay z pre-designu

Wstępny zestaw invariants:

- jedna logical session = jedna committed deck/shoe,
- commitment istnieje przed pierwszym deal,
- po freeze deck jest immutable,
- każda karta pochodzi z jednej pozycji committed deck,
- cursor jest monotoniczny,
- każda pozycja może zostać użyta najwyżej raz,
- brak fallback RNG,
- brak silent default FairPlay,
- brak reuse sekretów między subsystemami,
- realtime nie jest authoritative,
- private cards są chronione przez player projection,
- replay nie wykonuje mutacji drugi raz,
- concurrent writers nie mogą obaj wygrać,
- abort nie usuwa śladu rozdania,
- historyczny proof pozostaje weryfikowalny po rotacji kluczy.

---

# 24. Threat Model — główne klasy zagrożeń

Pre-design GFPE uwzględnia co najmniej:

- cheating client,
- colluding clients,
- compromised frontend,
- compromised app node,
- concurrent writers,
- operator/admin abuse,
- selective abort / grinding,
- seed reuse,
- weak RNG,
- modulo bias,
- rollback bazy,
- restart/VM snapshot,
- signing-key compromise,
- dependency/supply-chain compromise,
- private-state leak,
- realtime leak,
- log leak,
- replay proof,
- protocol downgrade,
- no-reveal timeout,
- reveal mismatch,
- persisted deck corruption,
- cursor manipulation,
- duplicate card / invalid deck composition.

Każde zagrożenie w finalnej specyfikacji musi zostać powiązane z konkretnym control + test.

---

# 25. Aktualny stan projektu na 08.09.2026

```text
MAIN = ad0739190fe2f9d1657b2b77c8b5f8e825830c08
MAIN TREE = 04f72af50f6fad2ba01bf7eaa6b4d856267d517b

P7 / P1-U-02 = MERGED / CLOSED
P1-R-01 = MERGED / CLOSED
P8 / P1-U-01 = PR #43 OPEN / LEAD PASS / INDEPENDENT CLAUDE AUDIT PENDING
P8 MERGE = NOT AUTHORIZED

PRODUCTION DEPLOYMENT = NOT AUTHORIZED
PRODUCTION MIGRATION = NOT AUTHORIZED
PRODUCTION DB CHANGE = NOT AUTHORIZED
RENDER / ENV / DNS / CLOUDFLARE = UNCHANGED

FAIRPLAY MAX = PRE-DESIGN ONLY
GFPE-0 = PRE-DESIGN COMPLETE
GFPE-1 = PRE-DESIGN COMPLETE
FAIRPLAY IMPLEMENTATION = NOT AUTHORIZED
SPEC FREEZE = NOT AUTHORIZED
```

---

# 26. Następny kontrolowany krok

Najbliższy obowiązujący krok w głównej ścieżce projektu:

**niezależny audyt Claude dla PR #43 / P8 / P1-U-01**.

Po jego wykonaniu:

- Lead weryfikuje każdy finding,
- ewentualne korekty wymagają mandatu,
- merge wymaga osobnej Owner + Lead authorization.

FairPlay PRE-DESIGN może być rozwijany dokumentacyjnie równolegle, ale nie może przejść do implementacji przed czystym baseline po pełnym audycie projektu.

---

# 27. Reguła aktualizacji tego dokumentu od teraz

Po każdym znaczącym kroku należy dopisać:

1. datę,
2. nazwę work item,
3. branch,
4. base SHA/TREE,
5. final HEAD/TREE,
6. PR,
7. zakres,
8. testy/CI,
9. wyniki Lead review,
10. wyniki niezależnego audytu,
11. findingi i korekty,
12. merge commit,
13. informację, czy zmieniono produkcję,
14. następny autoryzowany krok.

Nie wolno nadpisywać historii w sposób, który usuwa poprzedni stan. Błędny zapis należy oznaczyć jako superseded/corrected i pozostawić ślad korekty.

---

# 28. Status dokumentu

```text
MASTER PROJECT HISTORY = CREATED
COVERAGE = PROJECT ORIGIN → 08.09.2026 FAIRPLAY MAX PRE-DESIGN
MODE = LIVING DOCUMENT
EVIDENCE POLICY = DO NOT INVENT
MERGE AUTHORIZATION = NO
DEPLOY AUTHORIZATION = NO
PRODUCTION AUTHORIZATION = NO
```
