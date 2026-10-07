# GRACZ.PL SEARCH R3 — Implementation Record

Data pierwotna: 03.10.2026  
Aktualizacja stanu: 06.10.2026  
Status: **IMPLEMENTED / DEPLOYED / RENDER LIVE / DOCUMENTATION SYNCED**  
Repozytorium: `developergracz/gracz-pl-2`  
Publiczny moduł: `maintenance-site/assets/search.js`

## 1. Cel

SEARCH R3 rozszerza SEARCH R2 MAX bez przepisywania wyszukiwarki od zera. R2 pozostaje mechanizmem exact/fuzzy/filter/deep-link, a R3 dodaje lokalną warstwę rozumienia intencji i kontekstu pytań.

## 2. Funkcje R3

- rozpoznawanie pytań w języku naturalnym,
- intent detection: Zasady / Nauka / Prywatność / Konto / Pomoc,
- automatyczne rozpoznawanie kontekstu gry,
- lokalne concept matching dla Poker / Tysiąc / Warcaby / Gomoku,
- intent-aware i concept-aware ranking,
- preferencja treści zasad dla pytań o reguły,
- preferencja Academy/Poradników dla pytań edukacyjnych,
- inteligentna karta „Najlepsze źródło w gracz.pl”,
- jawny badge `R3 Smart`,
- informacja, że analiza działa lokalnie bez zewnętrznego AI,
- historia, filtry, komendy, literówki, synonimy i deep-linki,
- pełna strona wyników,
- osobne okno wyników z kontrolą powiększenia,
- skalowanie i dopasowanie wyszukiwarki do viewportu,
- obsługa powiększenia interfejsu wyszukiwarki,
- zabezpieczenie przed race condition przy kliknięciu zanim załaduje się silnik,
- fallback do `/szukaj/` jeżeli silnik nie załaduje się w określonym czasie.

## 3. Granica technologiczna

SEARCH R3 nie używa:

- zewnętrznego modelu generatywnego,
- embedding API,
- vector DB / semantic store,
- płatnego AI,
- klucza API AI,
- RAG,
- Player Context,
- My Trainer.

Te elementy należą do kontrolowanej roadmapy SEARCH R4.

## 4. Kluczowe pliki

- `maintenance-site/assets/search.js`
- `maintenance-site/assets/search.css`
- `maintenance-site/assets/search-index.js`
- `maintenance-site/assets/legal-links.js`
- `maintenance-site/szukaj/index.html`
- `maintenance-site/wyszukiwarka/index.html`

## 5. Aktualny asset chain — stan sprawdzony 06.10.2026

Stan został zweryfikowany względem `main` przed niniejszą aktualizacją dokumentacji:

`cb464725c0c6bd04c2e1618aac530aa9289736a5`

```text
SEARCH ENGINE INTERNAL VERSION = R3-SMART-2026-10-03
SEARCH INDEX INTERNAL VERSION = R3-SMART-2026-10-03

search.css = /assets/search.css?v=nav-scale-r5
search-index.js = /assets/search-index.js?v=r5
search.js = /assets/search.js?v=results-resizer-r3
legal-links.js = /assets/legal-links.js?v=r31
```

Uwaga: cache-bust wersji plików nie jest tym samym co wersja logiczna silnika. Silnik i indeks nadal deklarują `R3-SMART-2026-10-03`.

## 6. Najważniejsze commity pierwotnej implementacji R3

```text
9a4a541708781a7b84297aed0422a7f2fa215036  feat(search): upgrade portal search to R3 smart intent engine
23a56c49dcbeaf943bee73251dc9bc8ae99edad7  style(search): add R3 smart interpretation and source card
1704c20160834366c7e390bf42ea1f633c15ba5f  chore(search): promote search index to R3 smart
b2577e86a357871f56c2b5de32d6a19cafb317b8  feat(search): load R3 smart search and eliminate startup click race
c9ea08c039b790bc2b76bae52b7c274dee37a3b6  feat(search): publish dedicated R3 smart search page
```

Późniejsze commity rozwijały głównie UI, responsywność, nawigację, powiększanie, okno wyników i integrację portalu. Dlatego aktualny cache-bust różni się od pierwotnego zapisu z 03.10.2026.

## 7. Deployment evidence

Render service: `srv-da9m8rhsrm7s73co2780`

Pierwotny deploy po aktywacji R3: `dep-db0b767r12us7397ilh0`

R3 pozostaje częścią aktualnej produkcji. Render LIVE potwierdza deployment, ale sam status deploymentu nie zastępuje pełnego browser-runtime/a11y audytu.

## 8. Stan audytu / freeze

Obowiązujący Lead baseline audit: `GRACZ-PL-SEARCH-R3-LEAD-AUDIT-R1.md`

Jego werdykt pozostaje: **HOLD**.

Nie należy interpretować niniejszej synchronizacji dokumentacji jako `FINAL AUDIT PASS`.

Na dzień 06.10.2026 w repo nie ma osobnego, udokumentowanego końcowego werdyktu PASS dla SEARCH R3 FREEZE / R4 BASELINE.

```text
R3 FUNCTIONAL IMPLEMENTATION = LIVE
R3 DOCUMENTATION = SYNCED TO CURRENT MAIN
R3 FINAL FREEZE GATE = NOT YET DOCUMENTED AS PASS
```

## 9. Relacja R3 → R4

```text
R2 = klasyczny fundament
R3 = lokalne smart/intention/context search
R4 = semantic retrieval + RAG + AI Player Assistant
```

R4 ma rozbudowywać R3/R2, nie usuwać działającego fallbacku.

## 10. Dokument referencyjny baseline

Aktualny stan zbiorczy przed R4 opisuje: `GRACZ-PL-SEARCH-R3-FINAL-BASELINE-2026-10-06.md`
