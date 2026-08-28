# ETAP 1B — Mapa PostgreSQL — Gry: Warcaby AS-IS

Data: 28.08.2026

## Status

Zweryfikowany fragment audytu AS-IS Warcabów. Źródła: legacy `MoveHandler.java` i `CheckersExtension.java` oraz modern `postgres-session-store.js`, `session.js`, `rankings.js`.

## 1. Legacy SmartFox/MySQL

Potwierdzone przez DML tabele legacy: `prefix_gameplays`, `prefix_moves`, `prefix_scores`.

Start partii:
```sql
INSERT INTO prefix_gameplays(zone_name) VALUES (?)
```

Ruch:
```sql
INSERT LOW_PRIORITY INTO prefix_moves(id_gameplay, id_user, move) VALUES (?, ?, ?)
```
`LOW_PRIORITY` wskazuje na MySQL/MariaDB. `id_user` pochodzi z `php_user_id`.

Koniec partii:
```sql
INSERT INTO prefix_scores(id_gameplay, id_user, score) VALUES (?, ?, ?), (?, ?, ?)
UPDATE prefix_gameplays SET date_gameplay_ended = CURRENT_TIMESTAMP() WHERE id = ?
```

Logiczne powiązania wynikające z DML:
```text
prefix_gameplays.id
  ├── prefix_moves.id_gameplay
  └── prefix_scores.id_gameplay
```
Nie jest to potwierdzenie fizycznych FK. DDL legacy pozostaje do odnalezienia/weryfikacji.

## 2. Modern Checkers — PostgreSQL

### `gracz_game_sessions`

Potwierdzony DDL:
```sql
CREATE TABLE IF NOT EXISTS gracz_game_sessions (
  game_id VARCHAR(128) PRIMARY KEY,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Indeks:
```sql
CREATE INDEX IF NOT EXISTS gracz_game_sessions_updated_idx
ON gracz_game_sessions(updated_at DESC)
```

| Kolumna | Typ | Ograniczenia |
|---|---|---|
| `game_id` | `VARCHAR(128)` | `PRIMARY KEY` |
| `state` | `TEXT` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` |

W pokazanym DDL nie ma FK, CHECK ani dodatkowego UNIQUE poza PK. Należy nadal sprawdzić repozytorium pod kątem późniejszych `ALTER TABLE`.

## 3. DML

Tworzenie:
```sql
INSERT INTO gracz_game_sessions (game_id, state) VALUES ($1, $2)
```

Odczyt:
```sql
SELECT state FROM gracz_game_sessions WHERE game_id = $1
```

Upsert:
```sql
INSERT INTO gracz_game_sessions (game_id, state)
VALUES ($1, $2)
ON CONFLICT (game_id)
DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
```

W tym DML nie ma `revision` ani warunku wersji/optimistic lockingu.

## 4. Model `state`

`serializeSession()` zapisuje sesję przez `JSON.stringify`, a `deserializeSession()` wykonuje `JSON.parse`, walidację i rekonstrukcję domeny.

Sesja zawiera m.in. `gameId`, graczy white/black i ich connected, `game`, `messages`, `pendingOffer`, `blockedPlayers`, `events`, `processedRequests`.

Historia zdarzeń obejmuje m.in. `session.created`, `move.accepted`, rezygnację, ofertę/akceptację remisu i cofnięcia, blokadę, disconnect/reconnect oraz chat.

`submitMove()` posiada aplikacyjną deduplikację/idempotency opartą o `${playerId}:${requestId}` w `processedRequests`.

Reconnect jest częścią modelu sesji i zwraca snapshot aktualnego stanu.

## 5. Rekonstrukcja partii

Modern zapisuje aktualny `game` i historię `events`; `move.accepted` zawiera ruch oraz `beforeGame` i stan po ruchu. Model daje zasadniczo możliwość odtworzenia przebiegu partii, pod warunkiem kompletności i poprawności JSON/eventów oraz deterministycznej rekonstrukcji stanu.

## 6. Ranking

Potwierdzone zapytanie:
```sql
SELECT game_id,state,updated_at
FROM gracz_game_sessions
WHERE (state::jsonb->'game'->>'status') IN ('won','draw')
ORDER BY updated_at ASC
```

Ranking korzysta z identyfikatorów graczy, statusu i zwycięzcy zapisanych w JSON.

Potwierdzone: `state` jest `TEXT`, lecz ranking rzutuje je na `jsonb`; pokazany DDL nie ma CHECK poprawności JSON ani indeksu na status/winner. Istnieje indeks po `updated_at DESC`.

## 7. Concurrency i integralność

### POTWIERDZONE
- `save()` nie ma revision/optimistic lockingu w SQL.
- zapis tego samego `game_id` ma semantykę last-write-wins na poziomie store.
- sesja ma aplikacyjną deduplikację `requestId`.
- integralność struktury sesji jest głównie egzekwowana przez warstwę aplikacji.
- pojedynczy upsert jest pojedynczą operacją SQL.

### WYMAGA WERYFIKACJI
- czy wyższa warstwa serializuje wszystkie zapisy jednej sesji (single-writer/match actor lub odpowiednik),
- czy możliwy jest równoległy read-modify-write i lost update,
- czy istnieją dodatkowe `ALTER TABLE`,
- czy istnieje migracja danych z `prefix_*` do `gracz_game_sessions`,
- czy istnieją inne zależności po `game_id`.

## 8. Legacy vs Modern

Legacy: trzy tabele `prefix_*`, ruch tekstowy i część stanu w pamięci SmartFox.

Modern: `gracz_game_sessions`, skonsolidowany snapshot JSON, historia eventów, reconnect oraz idempotency requestów.

Legacy MySQL nie jest automatycznie częścią mapy 26 tabel PostgreSQL; służy jako materiał porównawczy/migracyjny.

## 9. Wnioski audytowe — klasyfikacja ostrożna

### CRITICAL — potencjalne / do potwierdzenia wyższą warstwą
- Możliwy lost update przy równoległym read-modify-write, ponieważ store nie posiada revision/optimistic lockingu. Nie klasyfikować jako potwierdzony incydent bez analizy callerów `save()`.

### HIGH
- Integralność domeny gry jest głównie aplikacyjna; schemat SQL nie waliduje struktury `state`.
- Ranking zależy od rzutowania `TEXT` do `jsonb`.

### MEDIUM
- Brak indeksu na status gry używany przez ranking może stać się problemem wraz ze wzrostem danych.
- Brak CHECK poprawności JSON na poziomie DDL.
- Brak osobnych relacyjnych struktur ruchów utrudnia bezpośrednią analitykę SQL.

### LOW / obserwacja
- Model `TEXT` + `state::jsonb` działa funkcjonalnie, lecz wymaga dalszej oceny pod kątem docelowej skali i utrzymania.

## 10. Następny krok

Przed zamknięciem Warcabów należy przeanalizować wyższą warstwę wywołującą `PostgresSessionStore.save()` i ustalić model współbieżności/single-writer. Następnie można zamknąć podsekcję Warcabów i przejść do kolejnej gry, w tym `gracz_thousand_games`.