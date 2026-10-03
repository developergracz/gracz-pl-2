# ADR-V3-014 — GRACZ.PL SEARCH R4: HYBRID AI SEARCH, RAG I PLAYER ASSISTANT

Data: 03.10.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **PROPOSED / DESIGN BASELINE / IMPLEMENTATION NOT STARTED / NOT DEPLOYED**  
Owner decyzji: **Czesław Socha**  
Zakres: wyszukiwarka gracz.pl, RAG, AI, Academy, personalizacja edukacyjna

> Ten ADR ustanawia projekt docelowy SEARCH R4. Nie autoryzuje implementacji, zakupu dostawcy AI, utworzenia kluczy API, wdrożenia, migracji danych ani zmiany produkcji.

## 1. Kontekst

Publiczny serwis gracz.pl posiada lokalną wyszukiwarkę SEARCH R2 MAX działającą bez zewnętrznego modelu AI. R4 ma rozszerzyć ten fundament o:

- rozumienie pytań w języku naturalnym,
- wyszukiwanie semantyczne,
- RAG oparte wyłącznie na zatwierdzonych treściach gracz.pl,
- odpowiedzi z jawnie wskazanymi źródłami,
- specjalistyczne moduły dla gier,
- kontekst postępu Academy,
- tryb „Mój trener” po zalogowaniu,
- kontrolę kosztu i możliwość działania bez AI.

## 2. Decyzja

SEARCH R4 przyjmuje architekturę **hybrydową i warstwową**:

```text
R2 KEYWORD/FUZZY SEARCH
        ↓
INTENT ROUTER
        ↓
SEMANTIC RETRIEVAL
        ↓
HYBRID RANKING / RERANK
        ↓
CANONICAL SOURCE GATE
        ↓
GROUNDED ANSWER ENGINE
        ↓
CONFIDENCE GATE
        ↓
SOURCES + ACTIONS
        ↓
OPTIONAL PLAYER CONTEXT / MY TRAINER
```

Warstwa AI jest dodatkiem, a nie single point of failure. SEARCH R2 pozostaje zawsze dostępnym fallbackiem.

## 3. Nadrzędne zasady

1. **R2-first** — proste zapytania nie powinny uruchamiać kosztownego modelu.
2. **Grounded-only** — AI nie może tworzyć odpowiedzi o zasadach gry bez źródła w zatwierdzonym korpusie gracz.pl.
3. **Canonical-first** — oficjalne zasady mają wyższy priorytet niż Academy, poradniki i treści pomocnicze.
4. **No-answer is valid** — brak wystarczająco pewnej odpowiedzi jest poprawnym wynikiem.
5. **Sources visible** — odpowiedź AI pokazuje źródła i deep-link do konkretnej sekcji.
6. **Provider abstraction** — logika domenowa nie zależy od jednego dostawcy modeli.
7. **Cost-aware routing** — modele są wywoływane tylko wtedy, gdy dodają wartość.
8. **Privacy by design** — do AI trafia minimalny kontekst potrzebny do wykonania zadania.
9. **Player memory is explicit product data** — postęp gracza nie jest niekontrolowaną pamięcią rozmowy.
10. **Fail-safe fallback** — limit, timeout lub awaria modelu nie wyłącza wyszukiwarki.

## 4. Tryby produktu

SEARCH R4 przewiduje trzy jawne tryby:

- **Szukaj** — R2 MAX + semantic retrieval bez generowania odpowiedzi, gdy wystarcza.
- **Zapytaj AI** — odpowiedź oparta o RAG i źródła gracz.pl.
- **Mój trener** — odpowiedź z kontrolowanym kontekstem postępu użytkownika i Learning Graph.

Tryb „Mój trener” wymaga zalogowanego użytkownika i osobnego kontraktu danych.

## 5. Hierarchia źródeł

Domyślna hierarchia:

1. `CANONICAL_RULES` — zatwierdzone zasady gry,
2. `ACADEMY_CORE` — zatwierdzone materiały Academy,
3. `GUIDE_APPROVED` — zatwierdzone poradniki,
4. `PORTAL_INFO` — regulamin, polityka prywatności, informacje serwisowe,
5. `SUPPORTING_CONTENT` — treści pomocnicze.

Treść o niższym priorytecie nie może nadpisać sprzecznej treści kanonicznej.

## 6. Granice personalizacji

R4 może wykorzystywać jedynie kontrolowane dane produktowe, np.:

- ukończone moduły,
- wyniki quizów,
- liczba prób,
- tematy błędów,
- zapisane materiały,
- preferowana gra,
- ostatni aktywny moduł,
- poziom ścieżki edukacyjnej.

R4 nie może automatycznie traktować całej historii rozmów jako trwałej pamięci profilu.

## 7. Granice AI

AI nie jest źródłem prawdy dla:

- zasad gry,
- regulaminu,
- polityki prywatności,
- danych konta,
- stanu rozgrywki,
- rankingu,
- płatności,
- uprawnień,
- decyzji moderacyjnych.

Model generatywny może wyłącznie interpretować i syntetyzować dane dostarczone przez kontrolowane warstwy systemu.

## 8. Model kosztowy

Architektura musi wspierać:

- cache odpowiedzi i retrieval,
- limity per użytkownik / IP / plan,
- routing do tańszego modelu dla prostych zadań,
- droższy model tylko dla zadań wymagających reasoning/rerank,
- budżet dzienny i miesięczny,
- hard stop po przekroczeniu limitu,
- fallback do R2 bez generowania AI.

Brak wyboru dostawcy i brak ustalonego cennika w tym ADR.

## 9. Bezpieczeństwo

Wymagane minimum:

- klucze API wyłącznie po stronie backendu,
- brak sekretów w przeglądarce i repozytorium,
- timeouty, retry z limitem i circuit breaker,
- rate limiting,
- walidacja rozmiaru i formatu promptu,
- redakcja danych osobowych przed wysłaniem do dostawcy, gdy nie są potrzebne,
- prompt-injection defense dla indeksowanych treści,
- rozdzielenie instrukcji systemowych od treści retrieved,
- audyt źródeł użytych do odpowiedzi,
- brak wykonywania dowolnych narzędzi na podstawie tekstu użytkownika.

## 10. Status implementacyjny

```text
SEARCH R2 MAX = IMPLEMENTED
SEARCH R4 ADR = PROPOSED / DESIGN BASELINE
R4 BACKEND = NOT IMPLEMENTED
R4 VECTOR / SEMANTIC INDEX = NOT IMPLEMENTED
R4 MODEL PROVIDER = NOT SELECTED
R4 API KEY = NOT CONFIGURED
R4 PLAYER CONTEXT = NOT IMPLEMENTED
R4 LEARNING GRAPH = NOT IMPLEMENTED
R4 DEPLOYMENT = NOT AUTHORIZED
PRODUCTION CHANGE = NONE BY THIS ADR
```

## 11. Warunki przejścia do implementacji

Implementacja R4 może rozpocząć się dopiero po:

- zatwierdzeniu pakietu dokumentacyjnego SEARCH R4,
- wyborze strategii semantic index,
- wyborze model provider abstraction,
- ustaleniu polityki retencji zapytań i telemetrii,
- przeglądzie Privacy/Security,
- zdefiniowaniu budżetu i limitów kosztowych,
- akceptacji kryteriów testowych i SLO,
- osobnej autoryzacji implementacji.

## 12. Konsekwencje

### Pozytywne

- wysoka jakość wyszukiwania przy zachowaniu szybkości R2,
- możliwość rozwoju do 20+ gier,
- kontrolowane koszty,
- odporność na awarię providera AI,
- źródłowe odpowiedzi zamiast swobodnego chatbota,
- podstawa pod spersonalizowany trening.

### Koszty i ryzyka

- potrzeba utrzymywania indeksu semantycznego,
- koszty inference,
- ryzyko prompt injection i halucynacji,
- większy zakres Privacy/Legal,
- potrzeba wersjonowania korpusu i źródeł,
- dodatkowy monitoring i testy jakości.

## 13. Dokumenty wykonawcze

Szczegółowy pakiet znajduje się w:

`10-AI-I-WYSZUKIWANIE/GRACZ-PL-SEARCH-R4/`

Pakiet obejmuje architekturę, kontrakty RAG, indeksowanie, Player Context, Learning Graph, API, bezpieczeństwo, SLO, koszty, UI/UX oraz plan implementacji i bramki odbioru.
