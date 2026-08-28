# PostgreSQL V3 — Iteracja 3: Tournament

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / PostgreSQL V3 / iteracja 3**

## 1. Cel i granica dokumentu

Ten dokument definiuje docelowy model Tournament V3 spięty z kanonicznym Game Platform V3 z dokumentu `13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md`.

Turniej jest meta-warstwą nad meczami. Reguły konkretnej gry, ruchy, stan planszy, snapshots, match-actor, lease/fencing oraz zdarzenia meczu pozostają własnością Game Platform. Tournament przechowuje lifecycle turnieju, rejestracje, rundy, pairing i wynik turniejowy oraz wskazuje kanoniczny `game_matches.match_id`.

Jest to **ARCHITEKTURA DOCELOWA**, nie opis schematu już wdrożonego.

## 2. Zasady nadrzędne Tournament V3

1. `tournaments` jest agregatem kontrolującym krytyczne przejścia lifecycle.
2. Każda mutacja lifecycle używa `version` i CAS albo równoważnego kontrolowanego locka.
3. `join`, `start`, `report_result`, `advance_round`, `finish` i `cancel` są operacjami transakcyjnymi.
4. Zmiana stanu i event `outbox_events` są zapisywane w tym samym commitcie.
5. Retry komendy jest chronione przez wspólny `idempotency_keys`.
6. `tournament_matches.match_id` jest kanonicznym powiązaniem do Game Platform.
7. Tournament nie modyfikuje bezpośrednio `game_matches.state` ani lease aktora.
8. Nie polegamy na samym pre-checku aplikacyjnym tam, gdzie integralność może zostać wymuszona constraintem DB.

## 3. `tournaments`

```sql
CREATE TABLE tournaments (
    tournament_id       UUID PRIMARY KEY,
    game_id             VARCHAR(32) NOT NULL,
    name                VARCHAR(160) NOT NULL,
    format              VARCHAR(32) NOT NULL,
    status              VARCHAR(24) NOT NULL DEFAULT 'draft',
    created_by_user_id  VARCHAR(32),
    max_participants    INTEGER,
    min_participants    INTEGER NOT NULL DEFAULT 2,
    config              JSONB NOT NULL DEFAULT '{}'::jsonb,
    version             BIGINT NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    registration_opens_at TIMESTAMPTZ,
    registration_closes_at TIMESTAMPTZ,
    starts_at           TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tournaments_game_fk
        FOREIGN KEY (game_id) REFERENCES game_definitions(game_id),
    CONSTRAINT tournaments_creator_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
    CONSTRAINT tournaments_name_nonempty
        CHECK (length(trim(name)) > 0),
    CONSTRAINT tournaments_format_check
        CHECK (format IN ('single_elimination','double_elimination','swiss','league')),
    CONSTRAINT tournaments_status_check
        CHECK (status IN ('draft','open','running','finished','cancelled')),
    CONSTRAINT tournaments_version_positive
        CHECK (version >= 1),
    CONSTRAINT tournaments_min_participants_check
        CHECK (min_participants >= 2),
    CONSTRAINT tournaments_max_participants_check
        CHECK (max_participants IS NULL OR max_participants >= min_participants),
    CONSTRAINT tournaments_registration_window_check
        CHECK (registration_closes_at IS NULL OR registration_opens_at IS NULL OR registration_closes_at >= registration_opens_at),
    CONSTRAINT tournaments_finished_consistency
        CHECK ((status = 'finished' AND finished_at IS NOT NULL) OR status <> 'finished'),
    CONSTRAINT tournaments_cancelled_consistency
        CHECK ((status = 'cancelled' AND cancelled_at IS NOT NULL) OR status <> 'cancelled')
);

CREATE INDEX tournaments_status_starts_idx
    ON tournaments(status, starts_at);

CREATE INDEX tournaments_game_status_idx
    ON tournaments(game_id, status);
```

`version` jest aktywnym elementem kontraktu. Przejście lifecycle wykonuje CAS:

```sql
UPDATE tournaments
SET status = $new_status,
    version = version + 1,
    updated_at = NOW()
WHERE tournament_id = $tournament_id
  AND version = $expected_version
  AND status = $expected_status;
```

`rowCount = 0` oznacza konflikt stanu/wersji, nie sukces.

## 4. `tournament_registrations`

```sql
CREATE TABLE tournament_registrations (
    tournament_id      UUID NOT NULL,
    user_id            VARCHAR(32) NOT NULL,
    status             VARCHAR(24) NOT NULL DEFAULT 'confirmed',
    seed_no            INTEGER,
    registered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at       TIMESTAMPTZ,
    withdrawn_at       TIMESTAMPTZ,
    disqualified_at    TIMESTAMPTZ,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (tournament_id, user_id),

    CONSTRAINT tournament_registrations_tournament_fk
        FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    CONSTRAINT tournament_registrations_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT tournament_registrations_status_check
        CHECK (status IN ('pending','confirmed','withdrawn','disqualified')),
    CONSTRAINT tournament_registrations_seed_positive
        CHECK (seed_no IS NULL OR seed_no >= 1)
);

CREATE INDEX tournament_registrations_status_idx
    ON tournament_registrations(tournament_id, status);

CREATE UNIQUE INDEX tournament_registrations_seed_unique
    ON tournament_registrations(tournament_id, seed_no)
    WHERE seed_no IS NOT NULL AND status = 'confirmed';
```

PK eliminuje podwójną rejestrację tego samego użytkownika. Unikalny seed eliminuje potwierdzony problem możliwej kolizji seedów z AS-IS.

Limit uczestników nie może być zabezpieczony wyłącznie przez `COUNT` wykonany poza kontrolowaną transakcją. `join` musi serializować decyzję na agregacie turnieju przez lock/CAS.

## 5. `tournament_rounds`

```sql
CREATE TABLE tournament_rounds (
    round_id           UUID PRIMARY KEY,
    tournament_id      UUID NOT NULL,
    round_no           INTEGER NOT NULL,
    status             VARCHAR(24) NOT NULL DEFAULT 'pending',
    version            BIGINT NOT NULL DEFAULT 1,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at         TIMESTAMPTZ,
    finished_at        TIMESTAMPTZ,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tournament_rounds_tournament_fk
        FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    CONSTRAINT tournament_rounds_number_positive
        CHECK (round_no >= 1),
    CONSTRAINT tournament_rounds_status_check
        CHECK (status IN ('pending','running','finished','cancelled')),
    CONSTRAINT tournament_rounds_version_positive
        CHECK (version >= 1),
    CONSTRAINT tournament_rounds_unique_no
        UNIQUE (tournament_id, round_no),
    CONSTRAINT tournament_rounds_finished_consistency
        CHECK ((status = 'finished' AND finished_at IS NOT NULL) OR status <> 'finished')
);

CREATE INDEX tournament_rounds_status_idx
    ON tournament_rounds(tournament_id, status, round_no);
```

`version` pozwala zabezpieczyć równoległe próby zamknięcia/awansu rundy.

## 6. `tournament_matches`

```sql
CREATE TABLE tournament_matches (
    tournament_match_id UUID PRIMARY KEY,
    tournament_id       UUID NOT NULL,
    round_id            UUID NOT NULL,
    board_no            INTEGER NOT NULL,
    match_id            UUID,
    player1_user_id     VARCHAR(32),
    player2_user_id     VARCHAR(32),
    winner_user_id      VARCHAR(32),
    result_code         VARCHAR(32),
    status              VARCHAR(24) NOT NULL DEFAULT 'scheduled',
    version             BIGINT NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_at        TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT tournament_matches_tournament_fk
        FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    CONSTRAINT tournament_matches_round_fk
        FOREIGN KEY (round_id) REFERENCES tournament_rounds(round_id) ON DELETE CASCADE,
    CONSTRAINT tournament_matches_game_match_fk
        FOREIGN KEY (match_id) REFERENCES game_matches(match_id),
    CONSTRAINT tournament_matches_player1_fk
        FOREIGN KEY (player1_user_id) REFERENCES users(user_id),
    CONSTRAINT tournament_matches_player2_fk
        FOREIGN KEY (player2_user_id) REFERENCES users(user_id),
    CONSTRAINT tournament_matches_winner_fk
        FOREIGN KEY (winner_user_id) REFERENCES users(user_id),
    CONSTRAINT tournament_matches_status_check
        CHECK (status IN ('scheduled','running','finished','walkover','cancelled')),
    CONSTRAINT tournament_matches_board_positive
        CHECK (board_no >= 1),
    CONSTRAINT tournament_matches_version_positive
        CHECK (version >= 1),
    CONSTRAINT tournament_matches_distinct_players
        CHECK (player1_user_id IS NULL OR player2_user_id IS NULL OR player1_user_id <> player2_user_id),
    CONSTRAINT tournament_matches_winner_participant
        CHECK (winner_user_id IS NULL OR winner_user_id = player1_user_id OR winner_user_id = player2_user_id),
    CONSTRAINT tournament_matches_finished_consistency
        CHECK ((status IN ('finished','walkover') AND finished_at IS NOT NULL) OR status NOT IN ('finished','walkover')),
    CONSTRAINT tournament_matches_round_board_unique
        UNIQUE (round_id, board_no),
    CONSTRAINT tournament_matches_match_unique
        UNIQUE (match_id)
);

CREATE INDEX tournament_matches_round_status_idx
    ON tournament_matches(tournament_id, round_id, status);

CREATE INDEX tournament_matches_players_idx
    ON tournament_matches(tournament_id, player1_user_id, player2_user_id);
```

### 6.1 Dlaczego `match_id` jest nullable

Pairing może powstać przed fizycznym utworzeniem kanonicznego meczu albo reprezentować walkover/bye, dla którego uruchomienie silnika gry nie ma sensu. Gdy rzeczywista partia zostaje utworzona, `match_id` wskazuje dokładnie jeden `game_matches`.

`UNIQUE(match_id)` zapewnia, że jeden kanoniczny mecz nie zostanie przypisany do dwóch pozycji drabinki. PostgreSQL pozwala na wiele NULL w tym UNIQUE.

### 6.2 Integralność `round_id` ↔ `tournament_id`

Same dwa niezależne FK nie gwarantują, że `round_id` należy do tego samego `tournament_id`. Przed implementacją należy zastosować jeden z wariantów DB-level:

```sql
ALTER TABLE tournament_rounds
    ADD CONSTRAINT tournament_rounds_id_tournament_unique
    UNIQUE (round_id, tournament_id);

ALTER TABLE tournament_matches
    ADD CONSTRAINT tournament_matches_round_tournament_fk
    FOREIGN KEY (round_id, tournament_id)
    REFERENCES tournament_rounds(round_id, tournament_id);
```

Ten złożony FK jest wariantem rekomendowanym i eliminuje cross-tournament mismatch na poziomie DB.

## 7. Relacja Tournament ↔ Game Platform

`tournament_matches.match_id` jest jedynym kanonicznym powiązaniem pozycji turniejowej z agregatem rozgrywki.

Game Platform odpowiada za:
- reguły gry,
- uczestników aktywnej rozgrywki,
- `game_matches.state`,
- `game_matches.version`,
- `game_match_events`,
- snapshots,
- match actor,
- lease/fencing,
- wynik domenowy meczu,
- outbox zdarzeń gry.

Tournament odpowiada za:
- rejestracje,
- seeding,
- pairing,
- rundy,
- interpretację wyniku dla drabinki/standings,
- lifecycle turnieju.

Tournament **nie wykonuje UPDATE `game_matches.state`**.

## 8. Atomowa operacja `join`

Wymagany przebieg jednej transakcji:

1. zarezerwuj idempotency `(context='tournament.join', key=command_id)`,
2. pobierz/lockuj `tournaments` i sprawdź `status='open'`, `version` oraz okno rejestracji,
3. policz aktywne/potwierdzone rejestracje pod tym samym lockiem,
4. zweryfikuj `max_participants`,
5. `INSERT tournament_registrations`; PK chroni przed duplikatem,
6. jeżeli polityka wymaga — zwiększ `tournaments.version`,
7. `INSERT outbox_events` typu `tournament.registration_confirmed`,
8. zapisz wynik idempotency,
9. `COMMIT`.

Dzięki serializacji na rekordzie turnieju dwie równoległe rejestracje przy ostatnim wolnym miejscu nie mogą obie przejść na podstawie starego `COUNT`.

## 9. Atomowa operacja `start`

1. zarezerwuj idempotency `tournament.start`,
2. lock/CAS `tournaments` z oczekiwanym `version` i `status='open'`,
3. pobierz potwierdzone rejestracje w deterministycznej kolejności seedów,
4. zweryfikuj `min_participants`,
5. zamknij możliwość nowych rejestracji,
6. utwórz `tournament_rounds` round 1,
7. wygeneruj pairingi i `tournament_matches`,
8. dla pairingów wymagających realnej partii utwórz odpowiednie `game_matches` przez uzgodniony kontrakt Game Platform w tej samej granicy transakcyjnej, jeśli oba moduły współdzielą PostgreSQL; jeśli później zostaną fizycznie rozdzielone, zastosuj event/saga i jawny stan `provisioning`,
9. ustaw `tournaments.status='running'`, `started_at`, `version=version+1`,
10. `INSERT outbox_events` `tournament.started`,
11. zapisz idempotency,
12. `COMMIT`.

Nie wolno oznaczyć turnieju jako uruchomionego, jeśli wymagane pairingi nie mają trwałego i jednoznacznego stanu utworzenia.

## 10. Atomowa operacja `report_result`

Docelowo wynik Game Platform jest źródłem prawdy dla zakończenia samej partii. Tournament konsumuje zweryfikowany wynik, nie przyjmuje dowolnego klientowego payloadu jako prawdy.

1. idempotency `tournament.report_result`,
2. lock `tournament_matches`,
3. sprawdź, że `match_id` wskazuje zakończony `game_matches`,
4. zweryfikuj wynik/uczestników z Game Platform,
5. CAS `tournament_matches.version`,
6. zapisz `winner_user_id`, `result_code`, `status='finished'`, `finished_at`, `version++`,
7. `INSERT outbox_events` `tournament.match_finished`,
8. zapisz idempotency,
9. `COMMIT`.

Powtórzenie wyniku z tym samym command/event ID zwraca poprzedni rezultat. Sprzeczny drugi wynik nie może nadpisać pierwszego bez osobnego, audytowanego workflow korekty.

## 11. Atomowa operacja `advance_round`

1. idempotency `tournament.advance_round`,
2. lock/CAS turnieju oraz bieżącej rundy,
3. sprawdź DB-query, że nie istnieje żaden wymagany mecz rundy w stanie innym niż zakończony/walkover,
4. sprawdź, czy następna runda już istnieje — `UNIQUE(tournament_id, round_no)` chroni retry/race,
5. wylicz awansujących deterministycznie z utrwalonych wyników,
6. zamknij bieżącą rundę,
7. jeśli istnieje kolejna runda: utwórz ją i pairingi,
8. jeśli nie istnieje: zakończ turniej i ustaw `finished_at`,
9. zwiększ `tournaments.version`,
10. `INSERT outbox_events` `tournament.round_advanced` albo `tournament.finished`,
11. zapisz idempotency,
12. `COMMIT`.

`UNIQUE(tournament_id, round_no)` i lock/CAS eliminują potwierdzone w AS-IS ryzyko równoległego podwójnego advance.

## 12. `cancel` i korekty

`cancel` wymaga CAS na `tournaments.version`, jawnego powodu w payloadzie/audycie i eventu outbox. Anulowanie turnieju nie może automatycznie fizycznie usuwać historycznych rund/meczów.

Korekta zakończonego wyniku musi być osobną komendą administracyjną/moderacyjną z audytem. Nie dopuszczamy zwykłego ponownego `report_result` jako mechanizmu nadpisywania historii.

## 13. Standings i projekcje

Dla formatów league/swiss potrzebny będzie read-model standings. Nie dokładamy do krytycznej transakcji wielu ręcznych UPDATE sum punktów, jeśli można je deterministycznie odbudować z wyników.

Rekomendowany model:
- event `tournament.match_finished`,
- idempotentny projection worker,
- `tournament_standings` jako odbudowywalna projekcja,
- checkpoint konsumenta.

Jeśli standings wpływa bezpośrednio na pairing kolejnej rundy Swiss, przed generowaniem pairingu należy użyć spójnego, zatwierdzonego snapshotu/projekcji lub policzyć standings transakcyjnie z kanonicznych wyników. Eventual consistency nie może powodować złych pairingów.

## 14. Migracja AS-IS → Tournament V3

Źródła AS-IS:
- `gracz_tournaments` → `tournaments`,
- `gracz_tournament_players` → `tournament_registrations`,
- `gracz_tournament_matches` → `tournament_matches` + nowe `tournament_rounds`.

Wymagane przed cutover:
1. profilowanie istniejących statusów i formatów,
2. deduplikacja uczestników/seedów,
3. backfill `tournament_rounds` z historycznego `round`,
4. ustalenie, czy historyczne rekordy da się wiarygodnie powiązać z konkretnym `game_matches.match_id`,
5. jeśli nie — historyczny `match_id` pozostaje NULL z provenance migracyjnym; nie wolno tworzyć fikcyjnego powiązania,
6. walidacja liczby uczestników/meczów przed i po migracji,
7. shadow tables/dual-read lub kontrolowany cutover zgodnie z późniejszym planem migracji,
8. brak DROP starych tabel przed zakończeniem okresu rollback.

## 15. Kryteria akceptacji Iteracji 3

Iteracja Tournament V3 jest projektowo kompletna, gdy:
- lifecycle turnieju ma jawny `version`,
- rejestracje mają PK i bezpieczną kontrolę limitu,
- rundy mają `UNIQUE(tournament_id, round_no)`,
- mecze mają `UNIQUE(round_id, board_no)`,
- `tournament_matches.match_id` wskazuje kanoniczny Game Platform,
- integralność round↔tournament jest wymuszana złożonym FK,
- `join/start/report_result/advance_round` mają transakcyjne kontrakty,
- każda mutacja emituje outbox w tym samym commitcie,
- retry jest chronione idempotency,
- wynik meczu nie jest arbitralnie przyjmowany od klienta,
- migracja nie wymyśla brakujących historycznych powiązań.

## 16. Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 4: Identity & Access + Role/Audit.**

Powinna zdefiniować kanoniczne `users`, profile/sesje, `roles`, `user_roles`, merge `gracz_role_changes` + `gracz_role_history` do `role_change_events`, kanoniczny append-only `audit_log` oraz warunki archiwizacji legacy audytu.