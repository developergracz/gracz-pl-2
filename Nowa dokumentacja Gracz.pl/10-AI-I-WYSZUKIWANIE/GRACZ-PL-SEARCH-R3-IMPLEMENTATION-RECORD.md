# GRACZ.PL SEARCH R3 — Implementation Record

Data: 03.10.2026  
Status: **IMPLEMENTED / DEPLOYED / RENDER LIVE**  
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
- zachowanie historii, filtrów, komend, literówek, synonimów, deep-linków i pełnej strony wyników,
- usunięcie race condition przy kliknięciu wyszukiwarki zanim załaduje się silnik,
- fallback do `/szukaj/` jeżeli silnik nie załaduje się w określonym czasie.

## 3. Granica technologiczna

SEARCH R3 nie używa:

- zewnętrznego modelu generatywnego,
- embedding API,
- vector DB,
- płatnego AI,
- klucza API AI,
- Player Context,
- My Trainer.

Te elementy należą do kontrolowanej roadmapy SEARCH R4.

## 4. Kluczowe pliki

- `maintenance-site/assets/search.js`
- `maintenance-site/assets/search.css`
- `maintenance-site/assets/search-index.js`
- `maintenance-site/assets/legal-links.js`
- `maintenance-site/szukaj/index.html`

Integracja została aktywowana na publicznych stronach portalu przez cache-bust `legal-links.js?v=r10`.

## 5. Wersje

```text
SEARCH ENGINE = R3-SMART-2026-10-03
SEARCH INDEX = R3-SMART-2026-10-03
search.js = v=r3
search-index.js = v=r3
search.css = v=r4
legal-links.js = v=r10
```

## 6. Najważniejsze commity

```text
9a4a541708781a7b84297aed0422a7f2fa215036
  feat(search): upgrade portal search to R3 smart intent engine

23a56c49dcbeaf943bee73251dc9bc8ae99edad7
  style(search): add R3 smart interpretation and source card

1704c20160834366c7e390bf42ea1f633c15ba5f
  chore(search): promote search index to R3 smart

b2577e86a357871f56c2b5de32d6a19cafb317b8
  feat(search): load R3 smart search and eliminate startup click race

c9ea08c039b790bc2b76bae52b7c274dee37a3b6
  feat(search): publish dedicated R3 smart search page
```

## 7. Deployment evidence

Render service:

`srv-da9m8rhsrm7s73co2780`

Final deploy observed after activation:

`dep-db0b767r12us7397ilh0`

Status:

```text
RENDER DEPLOY = LIVE
finishedAt = 2026-10-03T07:50:06.893989Z
```

Render LIVE potwierdza zakończenie deploymentu. Nie jest to samo w sobie pełny browser-runtime audit wszystkich interakcji.

## 8. Relacja R3 → R4

```text
R2 = klasyczny fundament
R3 = lokalne smart/intention/context search
R4 = semantic retrieval + RAG + AI Player Assistant
```

R4 ma rozbudowywać R3/R2, nie usuwać działającego fallbacku.
