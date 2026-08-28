# PostgreSQL — Model Match i rejestr rozbieżności

Data: 28.08.2026

## Decyzja audytowa

**ETAP 1B — MAPA POSTGRESQL: ZAMKNIĘTY.**

Warunki zamknięcia zostały spełnione:
1. inwentaryzacja kodowa 26/26 została wykonana,
2. wykonano rzeczywisty `pg_dump --schema-only` bazy Render,
3. porównano środowisko z mapą kodową,
4. zarejestrowano rozbieżności zamiast traktować środowisko jako automatycznie zgodne z repozytorium.

## Model Match — wynik

| Obszar | Wynik | Uwagi |
|---|---|---|
| Obecność tabel mapy 26 | MATCH | wszystkie oczekiwane obszary/tabele są reprezentowane na Renderze |
| Liczba tabel środowiska | DRIFT | Render: 28; mapa audytowa: 26 |
| Warcaby | PARTIAL MATCH | dodatkowa kolumna `version` w `gracz_game_sessions` |
| Tysiąc | MATCH | model `gracz_thousand_games` zgodny z udokumentowanym rdzeniem |
| Gomoku | MATCH | brak dedykowanej tabeli PostgreSQL zgodny z modelem pamięciowym |
| Wiadomości prywatne | MATCH | kluczowe kolumny, FK i indeksy potwierdzone |
| Moderacja | MATCH | rdzeń dwóch tabel i FK appeals -> decisions potwierdzony |
| Global Chat | MATCH | cztery tabele i wcześniej wskazane braki FK potwierdzone |
| Turnieje | MATCH | trzy tabele i FK do turnieju potwierdzone; brak dodatkowego UNIQUE round/board pozostaje |
| Newsletter — 4 tabele pomocnicze | MATCH | source/subscriber-source/consent/events odpowiadają modelowi kodowemu |
| Newsletter — subscribers | DRIFT HIGH | hybrydowy model legacy + nowy lifecycle |
| Audyt | DRIFT | dodatkowa tabela legacy zachowana na Renderze |
| Role | DRIFT | `gracz_role_changes` współistnieje z `gracz_role_history` |

## Rejestr rozbieżności

### DB-001 — hybrydowy `gracz_newsletter_subscribers`

**Priorytet: HIGH**

Rzeczywista tabela zachowuje równocześnie legacy `subscriber_id` jako PK i nowsze `id`, stare i nowe tokeny, stare i nowe pola zgód oraz legacy default statusu.

**Działanie docelowe:** przed przebudową newslettera przygotować migrację normalizującą, poprzedzoną analizą danych, mapowaniem rekordów i testem rollbacku. Nie wykonywać destrukcyjnego ALTER/DROP bez backupu i kontroli referencji.

### DB-002 — dodatkowa tabela audytowa legacy

**Priorytet: MEDIUM**

`gracz_audit_log_legacy_1787562123031` pozostaje obok aktualnego `gracz_audit_log`.

**Działanie docelowe:** sprawdzić liczbę rekordów, zakres dat, odwołania aplikacyjne i wymagania retencji. Następnie sklasyfikować jako archiwum albo kandydat do kontrolowanego usunięcia.

### DB-003 — dwa modele historii ról

**Priorytet: MEDIUM**

`gracz_role_changes` i `gracz_role_history` współistnieją.

**Działanie docelowe:** zidentyfikować aktywnych writerów/readery i wybrać jeden kanoniczny model przed dalszym rozwojem RBAC.

### DB-004 — `gracz_game_sessions.version`

**Priorytet: MEDIUM**

Render posiada `version INTEGER NOT NULL DEFAULT 1`, mimo że wcześniej udokumentowany DML Warcabów nie potwierdzał użycia tej kolumny jako CAS.

**Działanie docelowe:** w ETAPIE architektury docelowej zdecydować, czy Warcaby przechodzą na jawny optimistic locking, single-writer/match-actor albo inny spójny model. Nie uznawać obecnego pola za rozwiązanie concurrency bez DML.

## Elementy zgodne, które nie wymagają korekty tylko z powodu porównania

- Tysiąc zachowuje `revision BIGINT DEFAULT 1 NOT NULL`.
- Wiadomości i załączniki mają potwierdzone relacje CASCADE.
- Moderation appeals ma potwierdzony FK do decisions.
- Global Chat nadal nie posiada DB-level FK dla relacji, które wcześniej oznaczono jako logiczne.
- Turnieje zachowują FK do turnieju, ale nie zyskują nieudokumentowanych FK do kont/sesji gry.
- Newsletter helper tables mają potwierdzone FK/CHECK/UNIQUE zgodne z wcześniejszym AS-IS.

## Granica interpretacji

Model Match opisuje stan schematu. Nie dowodzi stanu danych, jakości danych, wolumenów, aktywności writerów, poprawności backupów ani zachowania wieloinstancyjnego runtime. Te elementy wymagają osobnych dowodów i nie są dopisywane przez domysł.

## Zamknięcie ETAPU 1B

ETAP 1B dostarczył:
- mapę kodową 26 tabel,
- AS-IS poszczególnych domen,
- rzeczywistą kontrolę schematu Render,
- rejestr schema drift,
- podstawę do projektowania architektury docelowej i migracji.

Następny logiczny etap: **ETAP 2 — ARCHITEKTURA DOCELOWA**, z wykorzystaniem zarejestrowanych rozbieżności jako ograniczeń migracyjnych.