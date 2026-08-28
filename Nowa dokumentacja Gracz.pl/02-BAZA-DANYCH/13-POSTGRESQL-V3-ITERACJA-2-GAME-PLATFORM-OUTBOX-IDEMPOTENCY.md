# PostgreSQL V3 — Iteracja 2: Game Platform, Match Actor, Outbox i Idempotency

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / PostgreSQL V3 / iteracja 2**

## 1. Cel i granica dokumentu

Ten dokument doprecyzowuje pierwszy wykonawczy blok modelu PostgreSQL V3 dla Gracz.pl:

- kanoniczny model gier i meczów,
- trwały model stanu meczu,
- event stream i snapshots,
- single-writer / match-actor,
- ownership z lease i fencing token,
- Transactional Outbox,
- idempotency komend i konsumentów.

Jest to **ARCHITEKTURA DOCELOWA**. Definicje są DDL-style i mają być podstawą późniejszych migracji oraz implementacji; nie oznaczają, że te tabele istnieją już na produkcji.

Dokument rozwija `12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` i pozostaje zgodny z `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`.

## 2. Zasady nadrzędne Game Platform V3

1. Jeden `match_id` ma w danym momencie jednego uprawnionego writera.
2. PostgreSQL pozostaje trwałym źródłem prawdy; actor/runtime nie jest źródłem prawdy sam w sobie.
3. Każda mutacja meczu jest wersjonowana.
4. Komenda nie może wykonać efektu biznesowego drugi raz po retry.
5. Zmiana stanu agregatu i event outbox są zapisywane w tej samej transakcji.
6. Realtime otrzymuje event dopiero po commitcie przez outbox/broker.
7. Split-brain jest blokowany przez fencing token, a nie przez samo przypisanie procesu w pamięci.
8. Warcaby, Tysiąc, Gomoku i przyszłe gry korzystają ze wspólnego kontraktu persistence/runtime, ale zachowują niezależne silniki reguł.

## 3. Decyzja dotycząca `game_sessions`

W AS-IS nazwa `gracz_game_sessions` oznaczała faktycznie trwały stan partii Warcabów. W V3 nie przenosimy tej niejednoznaczności.

Kanonicznym agregatem rozgrywki jest **`game_matches`**.

Jeżeli produkt będzie wymagał odrębnej sesji lobby/użytkownika przed rozpoczęciem meczu, może powstać osobny model `game_lobby_sessions` lub `player_game_sessions`, ale nie będzie on źródłem stanu meczu i nie jest wymagany do pierwszego fundamentu V3.

Dlatego w tej iteracji nie tworzymy tabeli `game_sessions` tylko po to, aby zachować historyczną nazwę.

## 4. `game_definitions`

Cel: kanoniczny rejestr typów gier dostępnych na platformie.

```sql
CREATE TABLE game_definitions (
    game_id              VARCHAR(32) PRIMARY KEY,
    code                 VARCHAR(32) NOT NULL UNIQUE,
    display_name         VARCHAR(80) NOT NULL,
    engine_key           VARCHAR(64) NOT NULL,
    rules_version        VARCHAR(32) NOT NULL,
    default_config       JSONB NOT NULL DEFAULT '{}'::jsonb,
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_definitions_code_nonempty
        CHECK (length(trim(code)) > 0),
    CONSTRAINT game_definitions_engine_key_nonempty
        CHECK (length(trim(engine_key)) > 0)
);
```

Przykładowe `code`: `checkers`, `thousand`, `gomoku`.

`default_config` przechowuje konfigurację gry, a nie bieżący stan partii. Reguły krytyczne nadal są egzekwowane przez silnik domenowy.

## 5. `game_matches`

Cel: jeden kanoniczny rekord agregatu meczu niezależnie od konkretnej gry.

```sql
CREATE TABLE game_matches (
    match_id              UUID PRIMARY KEY,
    game_id               VARCHAR(32) NOT NULL,
    status                VARCHAR(24) NOT NULL,
    version               BIGINT NOT NULL DEFAULT 1,
    state                 JSONB NOT NULL,
    rules_version         VARCHAR(32) NOT NULL,
    created_by_user_id    VARCHAR(32),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at            TIMESTAMPTZ,
    finished_at           TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_matches_game_fk
        FOREIGN KEY (game_id) REFERENCES game_definitions(game_id),

    CONSTRAINT game_matches_version_positive
        CHECK (version >= 1),

    CONSTRAINT game_matches_status_check
        CHECK (status IN (
            'created',
            'waiting',
            'active',
            'paused',
            'completed',
            'cancelled',
            'aborted'
        )),

    CONSTRAINT game_matches_finished_consistency
        CHECK (
            (status IN ('completed','cancelled','aborted') AND finished_at IS NOT NULL)
            OR
            (status NOT IN ('completed','cancelled','aborted'))
        )
);
```

Indeksy projektowe:

```sql
CREATE INDEX game_matches_game_status_idx
    ON game_matches(game_id, status);

CREATE INDEX game_matches_updated_idx
    ON game_matches(updated_at DESC);

CREATE INDEX game_matches_created_by_idx
    ON game_matches(created_by_user_id, created_at DESC)
    WHERE created_by_user_id IS NOT NULL;
```

### 5.1 Versioning

`version` jest częścią kontraktu, a nie martwą kolumną.

Każdy zapis mutujący agregat powinien używać warunku w rodzaju:

```sql
UPDATE game_matches
SET state = $new_state,
    version = version + 1,
    updated_at = NOW()
WHERE match_id = $match_id
  AND version = $expected_version
  AND <fencing condition>;
```

Brak zaktualizowanego wiersza oznacza konflikt wersji/ownership i nie może zostać potraktowany jako sukces.

## 6. `game_match_participants`

Cel: jawna relacja użytkownika z meczem.

```sql
CREATE TABLE game_match_participants (
    match_id          UUID NOT NULL,
    user_id           VARCHAR(32) NOT NULL,
    participant_role  VARCHAR(24) NOT NULL,
    seat_no           SMALLINT,
    joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at           TIMESTAMPTZ,
    result_code       VARCHAR(24),
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (match_id, user_id),

    CONSTRAINT game_match_participants_match_fk
        FOREIGN KEY (match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT game_match_participants_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id),

    CONSTRAINT game_match_participants_role_check
        CHECK (participant_role IN ('player','spectator','arbiter','system')),

    CONSTRAINT game_match_participants_seat_positive
        CHECK (seat_no IS NULL OR seat_no > 0),

    CONSTRAINT game_match_participants_left_after_join
        CHECK (left_at IS NULL OR left_at >= joined_at)
);
```

Dodatkowo:

```sql
CREATE UNIQUE INDEX game_match_participants_seat_unique
    ON game_match_participants(match_id, seat_no)
    WHERE seat_no IS NOT NULL AND left_at IS NULL;
```

To uniemożliwia dwóm aktywnym uczestnikom zajęcie tego samego miejsca.

## 7. `game_match_events`

Cel: trwały, uporządkowany strumień zdarzeń domenowych meczu.

```sql
CREATE TABLE game_match_events (
    event_id           UUID PRIMARY KEY,
    match_id           UUID NOT NULL,
    sequence_no        BIGINT NOT NULL,
    aggregate_version  BIGINT NOT NULL,
    event_type         VARCHAR(96) NOT NULL,
    actor_user_id      VARCHAR(32),
    payload            JSONB NOT NULL,
    correlation_id     UUID,
    causation_id       UUID,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_match_events_match_fk
        FOREIGN KEY (match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT game_match_events_sequence_positive
        CHECK (sequence_no >= 1),

    CONSTRAINT game_match_events_version_positive
        CHECK (aggregate_version >= 1),

    CONSTRAINT game_match_events_match_sequence_unique
        UNIQUE (match_id, sequence_no),

    CONSTRAINT game_match_events_match_version_unique
        UNIQUE (match_id, aggregate_version)
);
```

Indeks:

```sql
CREATE INDEX game_match_events_match_time_idx
    ON game_match_events(match_id, occurred_at);
```

W pierwszej implementacji V3 nie wymagamy pełnego event sourcingu. `game_matches.state` może pozostać bieżącym snapshotem agregatu, a `game_match_events` pełnić funkcję trwałej historii domenowej/audytowalnej. Późniejsza decyzja o pełnym event sourcingu wymaga osobnego ADR.

## 8. `game_match_snapshots`

Cel: szybkie odtwarzanie długich meczów i możliwość zachowania kontrolowanych punktów stanu.

```sql
CREATE TABLE game_match_snapshots (
    snapshot_id       UUID PRIMARY KEY,
    match_id          UUID NOT NULL,
    version           BIGINT NOT NULL,
    state             JSONB NOT NULL,
    rules_version     VARCHAR(32) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_match_snapshots_match_fk
        FOREIGN KEY (match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT game_match_snapshots_version_positive
        CHECK (version >= 1),

    CONSTRAINT game_match_snapshots_match_version_unique
        UNIQUE (match_id, version)
);
```

Snapshoty są optymalizacją, nie źródłem niezależnej prawdy konkurującym z `game_matches`.

## 9. Single-writer i ochrona przed split-brain

### 9.1 Odrzucona koncepcja `UNIQUE(owner_actor_id)`

Nie stosujemy `UNIQUE(owner_actor_id)` dla aktywnych meczów.

Powód: jeden proces/runtime powinien móc legalnie obsługiwać wiele meczów. Unikalność ownera ograniczyłaby skalowanie, a nie zapewniłaby, że dla jednego `match_id` nie istnieją dwa konkurencyjne writery.

### 9.2 `match_actor_leases`

Ownership jest modelowany per mecz.

```sql
CREATE TABLE match_actor_leases (
    match_id           UUID PRIMARY KEY,
    owner_instance_id  VARCHAR(128) NOT NULL,
    fencing_token      BIGINT NOT NULL,
    lease_expires_at   TIMESTAMPTZ NOT NULL,
    acquired_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    renewed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT match_actor_leases_match_fk
        FOREIGN KEY (match_id) REFERENCES game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT match_actor_leases_fencing_positive
        CHECK (fencing_token >= 1),

    CONSTRAINT match_actor_leases_expiry_after_renew
        CHECK (lease_expires_at > renewed_at)
);
```

Indeks operacyjny:

```sql
CREATE INDEX match_actor_leases_expiry_idx
    ON match_actor_leases(lease_expires_at);
```

### 9.3 Fencing

Każde przejęcie ownership musi przydzielać rosnący `fencing_token`.

Writer z tokenem starszym niż aktualny nie może zatwierdzić kolejnego zapisu, nawet jeśli proces nadal działa po utracie lease.

Implementacja może utrzymywać token również w `game_matches` jako `last_fencing_token` albo egzekwować go transakcyjnie przez kontrolowany lock/porównanie z `match_actor_leases`. Finalny wariant zostanie zamknięty przed implementacją migracji, ale wymaganie jest bezwzględne: **stary writer nie może wykonać późniejszego commit po przejęciu meczu przez nowego ownera**.

## 10. Transactional Outbox — `outbox_events`

```sql
CREATE TABLE outbox_events (
    event_id            UUID PRIMARY KEY,
    aggregate_type      VARCHAR(64) NOT NULL,
    aggregate_id        VARCHAR(128) NOT NULL,
    aggregate_version   BIGINT,
    event_type          VARCHAR(128) NOT NULL,
    payload             JSONB NOT NULL,
    correlation_id      UUID,
    causation_id        UUID,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    claimed_by          VARCHAR(128),
    claimed_at          TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    last_error          TEXT,

    CONSTRAINT outbox_events_status_check
        CHECK (status IN ('pending','processing','published','error')),

    CONSTRAINT outbox_events_attempt_nonnegative
        CHECK (attempt_count >= 0),

    CONSTRAINT outbox_events_aggregate_version_positive
        CHECK (aggregate_version IS NULL OR aggregate_version >= 1)
);
```

Indeksy:

```sql
CREATE INDEX outbox_events_dispatch_idx
    ON outbox_events(status, available_at, occurred_at)
    WHERE status IN ('pending','error');

CREATE INDEX outbox_events_aggregate_idx
    ON outbox_events(aggregate_type, aggregate_id, aggregate_version);

CREATE INDEX outbox_events_published_idx
    ON outbox_events(published_at)
    WHERE published_at IS NOT NULL;
```

### 10.1 Zasada transakcyjna

Przykład jednej komendy meczu:

1. zweryfikuj idempotency,
2. zweryfikuj ownership/fencing,
3. zaktualizuj `game_matches` z oczekiwaną `version`,
4. dodaj `game_match_events`,
5. dodaj `outbox_events`,
6. zapisz wynik idempotency,
7. `COMMIT`.

Nie wykonujemy bezpośredniego `realtime.publish()` jako części sukcesu biznesowego.

Publisher odczytuje outbox po commitcie i może publikować co najmniej raz. Odbiorcy muszą być idempotentni.

## 11. Idempotency — `idempotency_keys`

```sql
CREATE TABLE idempotency_keys (
    context             VARCHAR(96) NOT NULL,
    idempotency_key     VARCHAR(128) NOT NULL,
    actor_user_id       VARCHAR(32),
    aggregate_type      VARCHAR(64),
    aggregate_id        VARCHAR(128),
    request_hash        CHAR(64),
    status              VARCHAR(20) NOT NULL,
    response_code       INTEGER,
    response_payload    JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,

    PRIMARY KEY (context, idempotency_key),

    CONSTRAINT idempotency_keys_status_check
        CHECK (status IN ('processing','completed','failed')),

    CONSTRAINT idempotency_keys_completion_consistency
        CHECK (
            (status = 'completed' AND completed_at IS NOT NULL)
            OR status <> 'completed'
        )
);
```

Indeksy:

```sql
CREATE INDEX idempotency_keys_expiry_idx
    ON idempotency_keys(expires_at)
    WHERE expires_at IS NOT NULL;

CREATE INDEX idempotency_keys_aggregate_idx
    ON idempotency_keys(aggregate_type, aggregate_id)
    WHERE aggregate_id IS NOT NULL;
```

### 11.1 Semantyka

- `context` rozdziela przestrzenie kluczy, np. `game.command`, `tournament.report_result`, `newsletter.confirm`, `worker.realtime_projection`.
- Ten sam `(context, idempotency_key)` z tym samym `request_hash` zwraca poprzedni wynik zamiast ponownie wykonywać efekt.
- Ten sam klucz z innym `request_hash` jest konfliktem i nie może zostać po cichu zaakceptowany.
- TTL zależy od kontekstu; dla krytycznych operacji finansowych/audytowych nie wolno arbitralnie usuwać wpisów bez polityki retencji.

## 12. Idempotency konsumentów

Dla event-driven workerów dopuszczamy dwa warianty:

1. wspólne `idempotency_keys` z kontekstem konsumenta,
2. wyspecjalizowane `processed_messages` z PK `(consumer_name,event_id)`.

Jeżeli wolumen eventów będzie duży, rekomendowany jest drugi wariant:

```sql
CREATE TABLE processed_messages (
    consumer_name   VARCHAR(96) NOT NULL,
    event_id        UUID NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer_name, event_id)
);
```

Wybór fizyczny będzie zależał od wolumenu i retencji; semantyka idempotentnego konsumenta jest obowiązkowa.

## 13. Powiązanie z turniejami

W tej iteracji nie definiujemy jeszcze pełnego DDL Tournament V3, ale kontrakt Game Platform jest zamknięty w zakresie integracji:

- `tournaments.game_id` wskazuje `game_definitions.game_id`,
- `tournament_matches.match_id` wskazuje kanoniczne `game_matches.match_id`,
- turniej nie zapisuje bezpośrednio do `game_matches.state`,
- utworzenie/uruchomienie meczu turniejowego odbywa się przez command kontrakt Game Platform,
- wynik meczu jest publikowany jako event i konsumowany przez Tournament,
- krytyczne przejścia Tournament także zapisują własny outbox w tej samej transakcji co swój agregat.

## 14. Mapowanie istniejących gier do fundamentu V3

### Warcaby

`gracz_game_sessions` -> `game_matches` + `game_match_participants` + `game_match_events` + opcjonalne `game_match_snapshots`.

Istniejące produkcyjne `version` jest traktowane jako dane wejściowe migracji, ale nie jako dowód poprawnego CAS w AS-IS. W V3 `version` staje się obowiązkowym elementem kontraktu zapisu.

### Tysiąc

`gracz_thousand_games.revision` -> `game_matches.version`.

Istniejąca semantyka optimistic locking jest zachowywana, ale przechodzi pod wspólny command/match-runtime i wspólny outbox.

### Gomoku

Stan RAM -> pierwszy trwały model PostgreSQL w `game_matches` + events/snapshots.

Po migracji restart procesu nie może powodować utraty aktywnej partii tylko dlatego, że stan był przechowywany w `Map()`.

## 15. Transakcja referencyjna komendy meczu

Docelowy przebieg:

```text
BEGIN
  -> INSERT/claim idempotency key
  -> verify actor lease + fencing token
  -> SELECT/UPDATE game_matches with expected version
  -> execute domain engine result
  -> UPDATE game_matches state/version
  -> INSERT game_match_events
  -> INSERT outbox_events
  -> mark idempotency completed + store response
COMMIT
```

Jeżeli wystąpi konflikt `version`, fencing token, duplicate command lub naruszenie constraintu, transakcja jest wycofywana i klient otrzymuje deterministyczny wynik konfliktu zamiast last-write-wins.

## 16. Wymagania migracyjne wynikające z tej iteracji

1. Nie usuwać starych tabel gier podczas pierwszego wdrożenia V3.
2. Najpierw utworzyć nowe tabele V3 jako struktury shadow/canonical.
3. Przygotować backfill istniejących Warcabów i Tysiąca.
4. Gomoku wymaga nowego persistence od momentu cutover; dla historycznego RAM nie istnieją dane do odtworzenia po restarcie, jeśli nie zostały wcześniej zapisane.
5. W okresie przejściowym decyzja dual-write musi być jawna; preferowany jest kontrolowany adapter migracyjny zamiast długotrwałego bezwarunkowego dual-write.
6. Cutover jednej gry musi być możliwy niezależnie od pozostałych gier.
7. Outbox i idempotency powinny zostać wdrożone przed pierwszym pełnym cutover gry do match-runtime V3.
8. Każda migracja ma posiadać rollback do poprzedniego read/write path do momentu formalnego zakończenia okresu stabilizacji.

## 17. Kryteria akceptacji fundamentu Game Platform V3

Blok można uznać za projektowo zamknięty, gdy:

- wszystkie mecze posiadają kanoniczny `match_id`,
- wszystkie aktywne mecze są trwałe w PostgreSQL,
- `version` jest faktycznie sprawdzane w DML,
- jeden mecz ma jednego uprawnionego writera,
- ownership ma fencing odporny na split-brain,
- retry komendy jest idempotentny,
- state + domain event + outbox są atomowe,
- realtime nie jest częścią transakcji domenowej,
- event consumer może otrzymać event ponownie bez podwójnego efektu,
- turniej może wskazać jednoznaczny `game_matches.match_id`,
- restart runtime nie powoduje utraty meczu.

## 18. Następna iteracja PostgreSQL V3

Następny blok powinien objąć:

1. **Tournament V3** — pełne DDL `tournaments`, `tournament_registrations`, `tournament_rounds`, `tournament_matches`, versioning i atomowość,
2. następnie **Identity & Access + Role/Audit**,
3. następnie **Newsletter V3** i szczegółowe odwzorowanie hybrydowego modelu produkcyjnego,
4. następnie Messaging / Global Chat / Moderation,
5. na końcu kompletna macierz migracji kolumna-po-kolumnie z 28 tabel AS-IS do struktur V3.
