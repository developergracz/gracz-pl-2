# ETAP 1B — Mapa PostgreSQL — Turnieje AS-IS

Data: 28.08.2026

## Status i źródła

Zweryfikowany fragment audytu AS-IS systemu turniejowego na podstawie:
- `modern/checkers-engine/src/tournaments.js`,
- integracji `TournamentService` w `modern/checkers-engine/src/main.js`.

Dokument obejmuje wyłącznie potwierdzone DDL/DML i zachowanie aktualnego kodu.

## 1. Potwierdzone tabele PostgreSQL

### `gracz_tournaments`

```sql
CREATE TABLE IF NOT EXISTS gracz_tournaments (
  tournament_id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  game TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registration',
  visibility TEXT NOT NULL DEFAULT 'public',
  max_players INTEGER NOT NULL DEFAULT 16,
  rounds INTEGER NOT NULL DEFAULT 5,
  time_control TEXT NOT NULL DEFAULT '5+0',
  rated BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NULL,
  current_round INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL
)
```

Indeks:
```sql
CREATE INDEX IF NOT EXISTS gracz_tournaments_status_idx
ON gracz_tournaments(status, starts_at)
```

Brak potwierdzonego FK `owner_id -> gracz_accounts`.

### `gracz_tournament_players`

```sql
CREATE TABLE IF NOT EXISTS gracz_tournament_players (
  tournament_id UUID NOT NULL REFERENCES gracz_tournaments(tournament_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  seed INTEGER NOT NULL DEFAULT 0,
  points NUMERIC(6,2) NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  buchholz NUMERIC(8,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tournament_id, user_id)
)
```

Potwierdzony FK tylko dla `tournament_id` do `gracz_tournaments` z `ON DELETE CASCADE`.
Brak potwierdzonego FK `user_id -> gracz_accounts`.

### `gracz_tournament_matches`

```sql
CREATE TABLE IF NOT EXISTS gracz_tournament_matches (
  match_id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES gracz_tournaments(tournament_id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  board INTEGER NOT NULL,
  white_id TEXT NULL,
  white_name TEXT NULL,
  black_id TEXT NULL,
  black_name TEXT NULL,
  result TEXT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  reported_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
)
```

Indeks:
```sql
CREATE INDEX IF NOT EXISTS gracz_tournament_matches_idx
ON gracz_tournament_matches(tournament_id, round, board)
```

Potwierdzony FK tylko dla `tournament_id`.
Brak potwierdzonych FK dla `white_id`, `black_id`, `reported_by`.
Brak potwierdzonego FK z meczu turniejowego do sesji konkretnej gry (`gracz_game_sessions` / `gracz_thousand_games`).

## 2. Gry, formaty i wyniki

Kod dopuszcza gry:
- `warcaby`,
- `gomoku`,
- `szachy`.

Formaty:
- `swiss`,
- `knockout`,
- `round_robin`.

Dopuszczone wyniki:
- `1-0`,
- `0-1`,
- `1/2-1/2`.

Walidacja `game`, `format`, limitów graczy, rund i time control odbywa się aplikacyjnie. W potwierdzonym DDL brak CHECK dla tych wartości.

## 3. Tworzenie turnieju

`create()` wykonuje osobno:
1. INSERT do `gracz_tournaments`,
2. INSERT właściciela jako pierwszego uczestnika do `gracz_tournament_players`.

Brak transakcji obejmującej oba zapisy.

Konsekwencja AS-IS: jeśli drugi INSERT zawiedzie po utworzeniu turnieju, może pozostać turniej bez właściciela na liście uczestników.

## 4. Zapisy do turnieju

`join()` najpierw pobiera `detail()`, a następnie aplikacyjnie sprawdza:
- status `registration`,
- czy użytkownik już jest zapisany,
- czy `playerCount < maxPlayers`.

Następnie wykonuje INSERT:
```sql
INSERT INTO gracz_tournament_players(...,seed)
VALUES(...,(SELECT COALESCE(MAX(seed),0)+1 ...))
ON CONFLICT DO NOTHING
```

### Ryzyko concurrency

Sprawdzenie pojemności i INSERT nie są atomowe. Dwa równoległe zapisy mogą zobaczyć ten sam `playerCount` i przekroczyć `max_players`.

Wyliczenie `MAX(seed)+1` również nie jest chronione lockiem/transakcją; równoległe zapisy mogą uzyskać taki sam seed.

PK `(tournament_id,user_id)` chroni przed podwójnym zapisem tego samego użytkownika, ale nie przed przekroczeniem limitu uczestników.

## 5. Start turnieju

`start()`:
1. pobiera `detail()`,
2. sprawdza właściciela/status/liczbę graczy,
3. aktualizuje turniej do `status='live', current_round=1`,
4. generuje pairingi w aplikacji,
5. zapisuje mecze pojedynczymi INSERT-ami w pętli.

Brak transakcji obejmującej zmianę statusu i utworzenie kompletu meczów.

### Ryzyko

Awaria lub konflikt po zmianie statusu, ale przed zapisaniem wszystkich meczów może pozostawić turniej `live` z niepełną rundą.

Brak CAS/warunku `WHERE status='registration'` w samym UPDATE oznacza, że ochrona przed podwójnym startem opiera się na wcześniejszym odczycie aplikacyjnym.

## 6. Pairingi

`createPairings()` generuje pary w pamięci aplikacji.

Dla formatów innych niż knockout gracze są sortowani po:
1. points,
2. buchholz,
3. seed.

Kod unika wcześniejszych par przez `played` Set, o ile możliwe jest znalezienie innego przeciwnika.

Dla nieparzystej liczby graczy tworzony jest mecz BYE jako od razu zakończony `1-0`.

Brak trwałej tabeli przechowującej osobno historię algorytmu/parowania poza samymi rekordami meczów.

## 7. Zgłoszenie wyniku

`report()` dopuszcza wynik od:
- organizatora,
- białego gracza,
- czarnego gracza.

Po wcześniejszym odczycie stanu aplikacja sprawdza, czy mecz nie jest już `completed`.

DML:
```sql
UPDATE gracz_tournament_matches
SET result=$3,status='completed',reported_by=$4,completed_at=NOW()
WHERE tournament_id=$1
  AND match_id=$2
  AND status<>'completed'
```

Następnie niezależnie uruchamiane są:
- `recomputeStandings(id)`,
- `advanceDatabase(id)`,
- końcowy `detail()`.

### Istotna obserwacja

Kod nie sprawdza `rowCount` po UPDATE wyniku. Przy równoległym zgłoszeniu drugi request może nie zmienić rekordu, ale mimo to przejść dalej do recompute/advance.

## 8. Przeliczanie tabeli wyników

`recomputeStandings()`:
1. pobiera wszystkie zakończone mecze,
2. pobiera uczestników,
3. liczy wyniki w pamięci,
4. wykonuje osobny UPDATE dla każdego uczestnika,
5. ponownie pobiera punkty,
6. liczy Buchholz w pamięci,
7. ponownie wykonuje osobne UPDATE-y.

Brak transakcji, locka, revision i CAS.

W czasie równoległego raportowania wyników możliwe są przejściowe niespójności i wzajemne nadpisywanie przeliczonych standingów.

## 9. Awans rund / zakończenie turnieju

`advanceDatabase()`:
- pobiera `format`, `rounds`, `current_round`,
- liczy niezakończone mecze bieżącej rundy,
- jeśli `open > 0` — kończy bez awansu,
- jeśli runda jest zakończona — może oznaczyć turniej jako `finished` albo zwiększyć `current_round` i utworzyć kolejną rundę.

Dla knockout zwycięzcy są ustalani na podstawie wyników zakończonych meczów.

Brak transakcji i blokady na rekordzie turnieju. Dwa równoległe requesty kończące ostatnie mecze rundy mogą równolegle wejść w logikę awansu i próbować utworzyć kolejną rundę.

W DDL nie ma UNIQUE `(tournament_id, round, board)`, jest tylko zwykły indeks. Oznacza to, że sama baza nie wymusza unikalności planszy/pary w danej rundzie.

## 10. Relacja turniej ↔ realna gra

W potwierdzonym modelu `gracz_tournament_matches` nie zawiera `game_id` odnoszącego się do:
- `gracz_game_sessions`,
- `gracz_thousand_games`,
- ani innego trwałego modelu partii.

Turniej przechowuje własny rekord meczu i wynik, ale w analizowanym module nie ma potwierdzonego DB-level powiązania z faktycznie rozegraną sesją gry.

To oznacza, że wynik turniejowy może być zgłoszony przez uczestnika/organizatora niezależnie od dowodu z silnika gry.

## 11. Powiązanie z rankingiem

W `tournaments.js` nie ma bezpośredniego DML do tabel rankingowych. Pole `rated BOOLEAN` jest przechowywane w turnieju, ale sam analizowany moduł nie pokazuje wykonawczego mechanizmu naliczania rankingu po wyniku turniejowym.

Wymaga osobnej korelacji z `rankings.js`.

## 12. Realtime

W `TournamentService` i `createTournamentHandler()` nie ma dedykowanego SSE/WebSocket/realtime huba dla turniejów.

API jest klasycznym HTTP request/response.

Brak potwierdzonego mechanizmu push po:
- zapisie gracza,
- starcie turnieju,
- zgłoszeniu wyniku,
- zmianie rundy,
- zakończeniu turnieju.

## 13. Retencja

W potwierdzonym DDL nie ma:
- `expires_at`,
- TTL,
- automatycznego cleanup,
- kodowej polityki kasowania zakończonych turniejów.

Usunięcie rekordu `gracz_tournaments` skasowałoby kaskadowo uczestników i mecze dzięki FK `ON DELETE CASCADE`, ale w analizowanym module nie potwierdzono endpointu DELETE turnieju.

## 14. Bezpieczeństwo i autoryzacja

Endpointy wymagają uwierzytelnionej sesji.

Potwierdzone reguły aplikacyjne:
- tylko owner może rozpocząć turniej,
- owner nie może opuścić swojego turnieju,
- opuszczenie możliwe tylko podczas registration,
- wynik może zgłosić owner lub uczestnik konkretnego meczu.

Nie ma w analizowanym handlerze osobnej kontroli RBAC typu moderator/administrator dla operacji turniejowych.

## 15. Ryzyka AS-IS

### HIGH
- brak transakcji przy `start()` może pozostawić turniej live z niepełną rundą,
- brak transakcji/CAS w `report()` + `recomputeStandings()` + `advanceDatabase()` tworzy ryzyko wyścigów i wielokrotnego awansu rundy,
- brak DB-level powiązania meczu turniejowego z realną sesją gry oznacza, że wynik turniejowy nie jest w tym module kryptograficznie ani relacyjnie potwierdzony przez silnik gry.

### MEDIUM
- race przy `join()` może przekroczyć `max_players`,
- `MAX(seed)+1` może wygenerować ten sam seed dla równoległych zapisów,
- brak UNIQUE `(tournament_id, round, board)`,
- brak FK uczestników i graczy w meczach do `gracz_accounts`,
- brak CHECK dla status/game/format/result/visibility mimo ograniczeń aplikacyjnych,
- create turnieju i insert ownera nie są atomowe.

### LOW / obserwacja
- standings i Buchholz są denormalizowane w `gracz_tournament_players` i okresowo przeliczane z meczów,
- pole `rated` nie pokazuje w tym module bezpośredniej integracji z rankingiem,
- brak dedykowanego realtime dla turniejów.

## 16. WYMAGA DALSZEJ WERYFIKACJI

- realna integracja z `rankings.js`,
- produkcyjny schemat PostgreSQL/Render i ewentualne dodatkowe constrainty/migracje,
- czy poza `tournaments.js` istnieje proces wiążący turniejowy `match_id` z faktycznym `game_id`,
- retencja/archiwizacja zakończonych turniejów,
- operacje administratorskie/moderatorskie poza analizowanym handlerem.

## 17. Status obszaru

Potwierdzone tabele PostgreSQL turniejów:
1. `gracz_tournaments`,
2. `gracz_tournament_players`,
3. `gracz_tournament_matches`.

Rdzeń DDL/DML, tworzenie, zapisy, start, pairingi, wyniki, standings, awans rund, autoryzacja oraz główne ryzyka concurrency i integralności zostały zmapowane AS-IS na poziomie kodu.
