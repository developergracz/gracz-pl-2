# ETAP 1B — Mapa PostgreSQL — Gry: Tysiąc AS-IS

Data: 28.08.2026

## Status

Zweryfikowany fragment audytu AS-IS gry Tysiąc na podstawie:
- `modern/checkers-engine/src/thousand-repository.js`,
- `modern/checkers-engine/src/thousand-service.js`,
- `modern/checkers-engine/src/thousand-http.js`,
- `modern/checkers-engine/src/thousand-realtime.js`,
- `modern/checkers-engine/src/rankings.js`.

Dokument rozdziela fakty potwierdzone kodem od elementów wymagających dalszej weryfikacji.

## 1. Tabela `gracz_thousand_games`

Potwierdzony DDL:

```sql
CREATE TABLE IF NOT EXISTS gracz_thousand_games(
  game_id VARCHAR(96) PRIMARY KEY,
  players JSONB NOT NULL,
  state JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

### Struktura

| Kolumna | Typ | Ograniczenia |
|---|---|---|
| `game_id` | `VARCHAR(96)` | `PRIMARY KEY` |
| `players` | `JSONB` | `NOT NULL` |
| `state` | `JSONB` | `NOT NULL` |
| `revision` | `BIGINT` | `NOT NULL DEFAULT 1` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |

W pokazanym DDL nie ma jawnych FOREIGN KEY, CHECK ani dodatkowych indeksów poza PK. Należy nadal sprawdzić repozytorium pod kątem ewentualnych późniejszych `ALTER TABLE`/`CREATE INDEX`.

## 2. DML

### Create

```sql
INSERT INTO gracz_thousand_games(game_id,players,state,revision)
VALUES($1,$2::jsonb,$3::jsonb,1)
RETURNING game_id,players,state,revision,created_at,updated_at
```

### Get

```sql
SELECT game_id,players,state,revision,created_at,updated_at
FROM gracz_thousand_games
WHERE game_id=$1
```

### Save z optimistic locking

```sql
UPDATE gracz_thousand_games
SET players=$2::jsonb,
    state=$3::jsonb,
    revision=revision+1,
    updated_at=NOW()
WHERE game_id=$1 AND revision=$4
RETURNING game_id,players,state,revision,created_at,updated_at
```

Jeżeli `UPDATE` nie zmieni żadnego rekordu, kod wykonuje:

```sql
SELECT 1 FROM gracz_thousand_games WHERE game_id=$1
```

Na tej podstawie rozróżnia:
- brak gry → `THOUSAND_GAME_NOT_FOUND`,
- konflikt wersji → `THOUSAND_CONCURRENCY_CONFLICT`.

## 3. Model współbieżności — POTWIERDZONE

Tysiąc posiada faktyczny optimistic locking na poziomie bazy.

`ThousandGameService.performAction()`:
1. odczytuje rekord,
2. opcjonalnie porównuje `expectedRevision` z bieżącą `record.revision`,
3. wylicza nowy stan,
4. zapisuje przez `repository.save(record.gameId, record.revision, ...)`.

Nawet jeżeli dwa requesty równocześnie odczytają tę samą rewizję, tylko pierwszy `UPDATE ... WHERE revision=$4` może się udać. Drugi nie nadpisze nowszego stanu, tylko otrzyma konflikt.

HTTP mapuje `ThousandConcurrencyError` i `STALE_GAME_REVISION` na HTTP 409.

### Wniosek

W przeciwieństwie do `gracz_game_sessions` Warcabów, `gracz_thousand_games` nie ma semantyki last-write-wins dla konkurencyjnych zmian tej samej rewizji. Ryzyko klasycznego lost update jest kontrolowane przez optimistic locking.

## 4. Warstwa serwisowa

`createGame()`:
- normalizuje 2–4 graczy,
- wymaga różnych `userId`,
- tworzy i tasuje talię,
- tworzy stan początkowy,
- zapisuje rekord gry.

`getView()`:
- odczytuje rekord,
- sprawdza, czy użytkownik jest graczem,
- buduje publiczny widok gry.

`performAction()`:
- odczytuje bieżący rekord,
- opcjonalnie sprawdza wersję widoku przesłaną przez klienta,
- przypisuje `playerIndex` na podstawie zalogowanego użytkownika,
- wykonuje akcję silnika,
- zapisuje wynik z kontrolą rewizji.

`nextRound()` stosuje ten sam model concurrency.

## 5. Autoryzacja i HTTP

API Tysiąca wymaga zalogowanego użytkownika.

Przy tworzeniu gry kod sprawdza, czy twórca stołu jest jednym z graczy. Dla kolejnych operacji serwis sprawdza, czy użytkownik należy do danej partii.

Mutacje posiadają ochronę same-origin/cross-site oraz limiter akcji per użytkownik.

Endpointy:
- `POST /thousand/games`,
- `GET /thousand/games/:gameId`,
- `POST /thousand/games/:gameId/actions`,
- `POST /thousand/games/:gameId/next-round`,
- `GET /thousand/games/:gameId/events`.

## 6. Realtime

Realtime Tysiąca używa SSE (`text/event-stream`).

`ThousandRealtimeHub` przechowuje subskrybentów w pamięci procesu w mapie per `gameId`.

Po skutecznej akcji HTTP:
1. serwis zapisuje stan w repozytorium,
2. następnie `realtime.publish(...)` pobiera świeży widok i wysyła go do subskrybentów.

### Potwierdzona właściwość

Zapis PostgreSQL i publikacja SSE są osobnymi operacjami i nie stanowią jednej transakcji atomowej.

Możliwy jest więc scenariusz: zapis DB się uda, a publikacja realtime nie dotrze do części/całości klientów. Kod `publish()` używa `Promise.allSettled`, a błędy pojedynczych subskrybentów kończą ich odpowiedź.

Nie ma jednak analogicznego do Warcabów ryzyka utraty nowszego stanu przez konkurencyjny zapis, ponieważ warstwa repository stosuje kontrolę `revision`.

## 7. Ranking

`rankings.js` odczytuje zakończone gry Tysiąc z `gracz_thousand_games`:

```sql
SELECT game_id,players,state,updated_at
FROM gracz_thousand_games
WHERE state::jsonb->>'status'='game-ended'
ORDER BY updated_at ASC
```

`state` ma już typ `JSONB`, więc rzutowanie `state::jsonb` jest redundantne, ale funkcjonalnie poprawne.

Ranking wykorzystuje:
- `players`,
- `state.winnerIndex`,
- `updated_at`.

W pokazanym DDL nie ma indeksu na `state->>'status'` ani na pola rankingowe; przy większej skali może to wymagać osobnej oceny wydajności.

## 8. Integralność danych

### POTWIERDZONE
- `players` i `state` mają typ `JSONB`,
- `revision` jest kontrolowana w SQL,
- aktualizacja rewizji i stanu odbywa się w jednym `UPDATE`,
- konkurencyjna modyfikacja tej samej rewizji jest wykrywana,
- aplikacja normalizuje graczy i wymusza unikalność `userId` w ramach tworzonej gry.

### Ograniczenia schematu
- brak relacyjnych FK z `players.userId` do tabeli kont,
- brak CHECK dla struktury JSONB,
- brak osobnych relacyjnych tabel ruchów/zdarzeń w tym modelu,
- brak potwierdzonych indeksów JSONB/funkcyjnych.

## 9. Porównanie Warcaby vs Tysiąc

| Obszar | Warcaby | Tysiąc |
|---|---|---|
| Tabela | `gracz_game_sessions` | `gracz_thousand_games` |
| Stan | `TEXT` z JSON | `JSONB` |
| Gracze | wewnątrz `state` | osobne `players JSONB` |
| Revision | brak | `BIGINT` |
| Optimistic locking | brak | tak |
| Concurrency conflict | last-write-wins | wykryty i zwrócony jako konflikt |
| Realtime | osobno po zapisie | osobno po zapisie |
| Ranking | `state::jsonb` | `state JSONB` |

## 10. Klasyfikacja ryzyk AS-IS

### HIGH
- Zapis danych i publikacja SSE nie są atomowe; klient może chwilowo nie dostać eventu mimo poprawnego zapisu DB.
- Integralność `players`/`state` zależy głównie od kodu aplikacji, ponieważ DDL nie definiuje CHECK strukturalnych ani FK do kont użytkowników.

### MEDIUM
- Brak potwierdzonego indeksu na status zakończenia gry może ograniczać skalowanie rankingu.
- Realtime/subskrypcje istnieją wyłącznie w pamięci procesu; wymaga osobnej oceny przy wielu instancjach aplikacji.

### LOW / obserwacje
- Rzutowanie `state::jsonb` w rankingu jest zbędne, ponieważ `state` jest już `JSONB`.

### Istotne pozytywne ustalenie
- Optimistic locking z `revision` skutecznie chroni przed klasycznym lost update w potwierdzonym DML Tysiąca.

## 11. Status

Podsekcja PostgreSQL gry Tysiąc jest udokumentowana na poziomie AS-IS dla persistence, service, HTTP, concurrency, SSE i rankingu.

Dalszej weryfikacji wymagają przede wszystkim:
- ewentualne dodatkowe `ALTER TABLE`/indeksy w innych plikach,
- zachowanie wieloinstancyjne SSE,
- kompletność historii/zdarzeń wewnątrz `state` silnika,
- ewentualne inne powiązania `game_id` i użytkowników w pozostałej części repozytorium.
