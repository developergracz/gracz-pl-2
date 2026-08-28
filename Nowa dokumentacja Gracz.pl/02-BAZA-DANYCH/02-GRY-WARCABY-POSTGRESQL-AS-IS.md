# ETAP 1B — Mapa PostgreSQL — Gry: Warcaby AS-IS

Data: 28.08.2026

## Status

Zweryfikowany audyt AS-IS Warcabów. Źródła: legacy `MoveHandler.java` i `CheckersExtension.java` oraz modern `postgres-session-store.js`, `session.js`, `rankings.js`, `server.js`.

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

## 7. Concurrency i model zapisu — potwierdzone przez `server.js`

Wyższa warstwa została sprawdzona. Dla operacji na grze serwer wykonuje najpierw:

```js
let session = await store.get(gameId);
```

Następnie niezależne ścieżki HTTP wykonują read-modify-write:

```js
// ruch
const result = submitMove(session, ...);
await store.save(result.session);

// chat
session = sendChatMessage(session, ...);
await store.save(session);

// akcja gry: resign/draw/undo/block
session = submitGameAction(session, ...);
await store.save(session);

// disconnect
session = disconnectPlayer(session, playerId);
await store.save(session);

// reconnect
const result = reconnectPlayer(session, playerId);
await store.save(result.session);
```

Po zapisie wykonywany jest osobno `realtime.publish(...)`.

### POTWIERDZONE

- Nie ma match-actora ani single-writer per `gameId` w analizowanej ścieżce.
- Nie ma kolejki per gra, mutexa ani blokady serializującej modyfikacje jednej sesji.
- Każde żądanie HTTP pobiera snapshot przez `store.get(gameId)` i następnie zapisuje nowy pełny snapshot.
- `PostgresSessionStore.save()` nie sprawdza `revision` ani poprzedniej wersji.
- Deduplikacja `requestId` chroni przed ponownym przetworzeniem tego samego requestu ruchu, ale nie chroni przed dwoma różnymi równoległymi requestami bazującymi na tej samej wersji sesji.
- `realtime.publish(...)` jest wykonywany po zapisie DB i nie jest częścią transakcji z PostgreSQL.

### POTWIERDZONE RYZYKO LOST UPDATE

Możliwy jest scenariusz:

```text
Request A -> GET state S0
Request B -> GET state S0
Request A -> modyfikacja -> S1 -> SAVE
Request B -> modyfikacja -> S2 -> SAVE
```

Drugi zapis może nadpisać pełny `state` zapisany przez pierwszy request, ponieważ upsert ma semantykę last-write-wins i nie sprawdza wersji.

Dotyczy to nie tylko dwóch ruchów, ale potencjalnie także konfliktów pomiędzy:
- ruch ↔ chat,
- ruch ↔ disconnect/reconnect,
- ruch ↔ resign/draw/undo/block,
- dwoma różnymi akcjami gry.

Nie oznacza to, że konflikt wystąpi w każdym żądaniu; oznacza, że aktualny kod nie ma mechanizmu, który gwarantowałby jego wykluczenie.

## 8. Integralność i atomiczność realtime

Pojedynczy upsert sesji jest atomowy w PostgreSQL, ale zapis stanu i publikacja realtime są dwiema osobnymi operacjami:

```text
store.save(session)
-> realtime.publish(session, event)
```

Kod nie pokazuje Transactional Outbox ani innego atomowego połączenia trwałego zapisu z publikacją zdarzenia. W przypadku awarii pomiędzy tymi krokami DB może zawierać nowy stan, którego klienci nie otrzymają przez bieżącą publikację realtime.

## 9. Legacy vs Modern

Legacy: trzy tabele `prefix_*`, ruch tekstowy i część stanu w pamięci SmartFox.

Modern: `gracz_game_sessions`, skonsolidowany snapshot JSON, historia eventów, reconnect oraz idempotency requestów.

Legacy MySQL nie jest automatycznie częścią mapy 26 tabel PostgreSQL; służy jako materiał porównawczy/migracyjny.

## 10. Wnioski audytowe

### CRITICAL
- **Potwierdzone ryzyko lost update**: model `GET -> modyfikacja -> save pełnego snapshotu` nie ma single-writer, mutexa ani optimistic lockingu.
- Równoległe różne requesty mogą bazować na tym samym stanie i ostatni zapis może nadpisać wcześniejszą zmianę.

### HIGH
- Zapis PostgreSQL i `realtime.publish()` nie są jedną operacją atomową; brak potwierdzonego Outbox.
- Integralność domeny gry jest głównie aplikacyjna; schemat SQL nie waliduje struktury `state`.
- Ranking zależy od rzutowania `TEXT` do `jsonb`.

### MEDIUM
- Brak indeksu na status gry używany przez ranking może stać się problemem wraz ze wzrostem danych.
- Brak CHECK poprawności JSON na poziomie DDL.
- Brak osobnych relacyjnych struktur ruchów utrudnia bezpośrednią analitykę SQL.

### LOW / obserwacja
- Model `TEXT` + `state::jsonb` działa funkcjonalnie, lecz wymaga oceny docelowej skali i utrzymania.

## 11. Elementy nadal wymagające weryfikacji

- ewentualne późniejsze `ALTER TABLE` dotyczące `gracz_game_sessions`,
- migracja danych z legacy `prefix_*`,
- inne zależności po `game_id`, jeśli występują poza przeanalizowanymi plikami,
- rzeczywiste zachowanie środowiska produkcyjnego/Render przy wielu instancjach.

## 12. Status podsekcji Warcabów

Analiza modelu PostgreSQL Warcabów oraz jego podstawowego modelu concurrency została zamknięta na poziomie kodu AS-IS. Kluczowa hipoteza o lost update została rozstrzygnięta: brak single-writer/optimistic lockingu w analizowanej ścieżce jest potwierdzony.

Następny logiczny krok ETAPU 1B — GRY: analiza kolejnego modelu PostgreSQL, w szczególności `gracz_thousand_games` (Tysiąc), a następnie dalsze tabele/moduły gier.