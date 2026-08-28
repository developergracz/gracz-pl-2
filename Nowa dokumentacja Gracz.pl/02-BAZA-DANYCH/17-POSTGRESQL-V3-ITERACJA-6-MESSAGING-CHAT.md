# PostgreSQL V3 — Iteracja 6: Messaging & Global Chat

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / PostgreSQL V3 / iteracja 6**

## 1. Cel i granica dokumentu

Iteracja 6 definiuje docelowy model dwóch powiązanych infrastrukturalnie, ale odrębnych domenowo obszarów:

- **Messaging V3** — prywatne wiadomości użytkownik ↔ użytkownik, szyfrowanie, załączniki, folder/read/delete semantics i retencja,
- **Global Chat & Social V3** — kanały/tematy publiczne, wiadomości, reakcje, znajomi, zgłoszenia oraz integracja realtime.

Nie łączymy prywatnych wiadomości i publicznego chatu w jedną tabelę tylko dlatego, że oba moduły przechowują tekst. Mają inne wymagania dostępu, szyfrowania, retencji, moderacji i widoczności.

Jest to **ARCHITEKTURA DOCELOWA**. Definicje są DDL-style i rozwijają Backend V3 oraz wcześniejsze Iteracje PostgreSQL V3.

## 2. Wejście AS-IS i problemy do usunięcia

### Messaging AS-IS

Potwierdzone:
- `gracz_messages`,
- `gracz_message_attachments`,
- szyfrowanie subject/body aplikacyjnie,
- AES-256-GCM dla załączników,
- niezależne `sender_deleted` / `recipient_deleted`,
- fizyczny DELETE dopiero po obu soft-delete,
- jeden załącznik na wiadomość,
- HIGH: `ON DELETE CASCADE` z kont może usunąć wiadomość zachowaną przez drugą stronę.

### Global Chat AS-IS

Potwierdzone:
- `gracz_chat_topics`,
- `gracz_global_chat`,
- `gracz_chat_friends`,
- `gracz_global_chat_reports`,
- brak FK w tych czterech tabelach,
- reactions jako whole-object JSONB read-modify-write z lost-update risk,
- kierunkowy UNIQUE friendship i race A→B / B→A,
- process-local SSE subscribers i presence,
- DB commit i broadcast rozdzielone.

V3 musi usunąć te klasy ryzyka, nie tylko zmienić nazwy tabel.

## 3. Zasady nadrzędne

1. Identity V3 (`users.user_id`) jest kanonicznym źródłem tożsamości.
2. Messaging i Chat nie zapisują bezpośrednio sankcji użytkownika; współpracują z Moderation/Identity przez kontrakty i eventy.
3. DB mutation + event outbox są jednym commitem.
4. Retry mutacji klienta jest idempotentne.
5. Realtime Gateway jest transportem; źródłem prawdy jest PostgreSQL.
6. Presence/subscriptions są współdzielonym stanem efemerycznym, nie obowiązkową tabelą PostgreSQL.
7. Reakcje są relacyjne/atomowe, nie whole-object JSON read-modify-write.
8. Friendship ma jeden kanoniczny rekord na nieuporządkowaną parę użytkowników.
9. Usunięcie konta nie może przypadkowo skasować prywatnej wiadomości drugiej strony ani audytowalnego zgłoszenia.
10. Moderation może ukryć treść przez kontrolowany workflow, ale nie nadpisuje historii bez ścieżki audytowej.

# CZĘŚĆ A — MESSAGING V3

## 4. `private_messages`

Treść prywatna pozostaje zaszyfrowana aplikacyjnie.

```sql
CREATE TABLE private_messages (
    message_id              UUID PRIMARY KEY,
    sender_user_id          VARCHAR(32),
    recipient_user_id       VARCHAR(32),
    sender_id_snapshot      VARCHAR(32) NOT NULL,
    recipient_id_snapshot   VARCHAR(32) NOT NULL,
    subject_ciphertext      BYTEA NOT NULL,
    body_ciphertext         BYTEA NOT NULL,
    encryption_key_version  VARCHAR(32) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version                 BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT private_messages_sender_fk
        FOREIGN KEY (sender_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT private_messages_recipient_fk
        FOREIGN KEY (recipient_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT private_messages_distinct_users
        CHECK (sender_id_snapshot <> recipient_id_snapshot),
    CONSTRAINT private_messages_version_positive
        CHECK (version >= 1)
);

CREATE INDEX private_messages_sender_idx
    ON private_messages(sender_user_id, created_at DESC)
    WHERE sender_user_id IS NOT NULL;
CREATE INDEX private_messages_recipient_idx
    ON private_messages(recipient_user_id, created_at DESC)
    WHERE recipient_user_id IS NOT NULL;
CREATE INDEX private_messages_created_idx
    ON private_messages(created_at DESC);
```

### 4.1 Dlaczego snapshot IDs obok nullable FK

Historyczna wiadomość nie może zniknąć wyłącznie dlatego, że konto zostało usunięte/zanonimizowane. `sender_user_id` / `recipient_user_id` mogą zostać odłączone przez `ON DELETE SET NULL`, a snapshot ID zachowuje techniczne provenance migracyjne/historyczne.

Polityka prywatności może wymagać późniejszej pseudonimizacji snapshotów; nie stosujemy automatycznego CASCADE.

### 4.2 Szyfrowanie

- plaintext subject/body nie trafia do PostgreSQL,
- `encryption_key_version` pozwala na kontrolowaną rotację,
- klucz szyfrujący pozostaje poza tabelą,
- format ciphertext/AAD zostanie zamknięty w ADR kryptograficznym przed implementacją,
- nie kopiujemy starego ciphertext do nowego formatu bez testu kompatybilności/decryption.

## 5. `private_message_user_state`

Zamiast utrzymywać role nadawcy/odbiorcy jako kilka booleanów w rekordzie wiadomości, V3 przechowuje stan per użytkownik.

```sql
CREATE TABLE private_message_user_state (
    message_id        UUID NOT NULL,
    user_id_snapshot  VARCHAR(32) NOT NULL,
    user_id           VARCHAR(32),
    party_role        VARCHAR(16) NOT NULL,
    read_at           TIMESTAMPTZ,
    archived_at       TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (message_id, user_id_snapshot),
    CONSTRAINT private_message_state_message_fk
        FOREIGN KEY (message_id) REFERENCES private_messages(message_id) ON DELETE CASCADE,
    CONSTRAINT private_message_state_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT private_message_state_role_check
        CHECK (party_role IN ('sender','recipient')),
    CONSTRAINT private_message_state_one_sender
        UNIQUE (message_id, party_role)
);

CREATE INDEX private_message_state_user_folder_idx
    ON private_message_user_state(user_id, deleted_at, archived_at, read_at)
    WHERE user_id IS NOT NULL;
```

Uwaga: `UNIQUE(message_id, party_role)` wymusza maksymalnie jeden stan sender i jeden recipient dla obecnego modelu 1:1. Jeżeli produkt kiedyś wprowadzi wiadomości grupowe, powstanie osobny model conversation/recipients zamiast rozszerzania tej tabeli przez wyjątki.

## 6. `private_message_attachments`

V3 usuwa techniczne ograniczenie jednego załącznika na wiadomość, ale polityka produktu może nadal ustalać limit liczby/rozmiaru.

```sql
CREATE TABLE private_message_attachments (
    attachment_id          UUID PRIMARY KEY,
    message_id             UUID NOT NULL,
    file_name_ciphertext   BYTEA NOT NULL,
    storage_name           VARCHAR(160),
    mime_type              VARCHAR(64) NOT NULL,
    file_size              INTEGER NOT NULL,
    iv                     BYTEA NOT NULL,
    auth_tag               BYTEA NOT NULL,
    ciphertext             BYTEA NOT NULL,
    encryption_key_version VARCHAR(32) NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT private_message_attachments_message_fk
        FOREIGN KEY (message_id) REFERENCES private_messages(message_id) ON DELETE CASCADE,
    CONSTRAINT private_message_attachments_size_check
        CHECK (file_size > 0)
);

CREATE INDEX private_message_attachments_message_idx
    ON private_message_attachments(message_id, created_at);
```

MIME/signature/size limits są walidowane aplikacyjnie i powinny mieć również limity DB tam, gdzie mają stabilną wartość biznesową. Nie utrwalamy sztywno obecnego 1 MiB jako wiecznego limitu architektury.

## 7. Wysłanie prywatnej wiadomości — kontrakt atomowy

1. zarezerwuj `idempotency_keys(context='messaging.send', key=client_message_id)`,
2. zweryfikuj sender/recipient i policy `allowMessages`,
3. zweryfikuj ograniczenia Moderation/Identity (np. blokada konta),
4. zaszyfruj subject/body,
5. `INSERT private_messages`,
6. utwórz dwa rekordy `private_message_user_state`,
7. opcjonalnie zapisz zaszyfrowane attachments w tej samej transakcji lub kontrolowanym staged upload flow,
8. `INSERT outbox_events(event_type='messaging.message_created')`,
9. zapisz idempotency result,
10. COMMIT.

Realtime dla odbiorcy jest skutkiem outbox po commitcie.

## 8. Read/archive/delete prywatnej wiadomości

`mark_read` i `archive` zmieniają tylko rekord `private_message_user_state` właściwej strony.

`delete`:
- ustawia `deleted_at` wyłącznie dla bieżącego użytkownika,
- nie usuwa natychmiast wiadomości drugiej stronie,
- physical purge może nastąpić dopiero zgodnie z polityką retencji, gdy obie strony nie mają już prawa/oczekiwania dostępu i nie istnieje hold/audit/legal requirement.

Nie używamy `ON DELETE CASCADE users -> private_messages`.

Purge jest osobnym workerem/polityką i musi być audytowalny dla operacji administracyjnych.

# CZĘŚĆ B — GLOBAL CHAT & SOCIAL V3

## 9. Decyzja: kanały i tematy

AS-IS ma `gracz_chat_topics`, a przyszły produkt wymaga również kanałów global/game/tournament/match/system.

V3 rozdziela:
- `chat_channels` — techniczno-domenowy kontener strumienia,
- `chat_topics` — opcjonalne wątki/tematy wewnątrz kanału.

Nie zamieniamy każdego obecnego tematu automatycznie w kanał; migracja zachowuje semantykę topic.

## 10. `chat_channels`

```sql
CREATE TABLE chat_channels (
    channel_id          UUID PRIMARY KEY,
    channel_type        VARCHAR(24) NOT NULL,
    name                VARCHAR(120) NOT NULL,
    game_id             VARCHAR(32),
    tournament_id       UUID,
    match_id            UUID,
    created_by_user_id  VARCHAR(32),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chat_channels_type_check
        CHECK (channel_type IN ('global','game','tournament','match','system')),
    CONSTRAINT chat_channels_game_fk
        FOREIGN KEY (game_id) REFERENCES game_definitions(game_id),
    CONSTRAINT chat_channels_tournament_fk
        FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
    CONSTRAINT chat_channels_match_fk
        FOREIGN KEY (match_id) REFERENCES game_matches(match_id),
    CONSTRAINT chat_channels_creator_fk
        FOREIGN KEY (created_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chat_channels_context_check CHECK (
        (channel_type='global' AND game_id IS NULL AND tournament_id IS NULL AND match_id IS NULL)
        OR (channel_type='game' AND game_id IS NOT NULL AND tournament_id IS NULL AND match_id IS NULL)
        OR (channel_type='tournament' AND tournament_id IS NOT NULL AND match_id IS NULL)
        OR (channel_type='match' AND match_id IS NOT NULL)
        OR (channel_type='system')
    )
);

CREATE INDEX chat_channels_context_idx
    ON chat_channels(channel_type, game_id, tournament_id, match_id);
```

Dalszy constraint może wymusić jeden kanoniczny kanał dla danego kontekstu przez partial UNIQUE, jeśli wymaganie produktu to potwierdzi. Nie narzucamy tego teraz, bo mogą istnieć np. kanały językowe/tematyczne per turniej.

## 11. `chat_topics`

```sql
CREATE TABLE chat_topics (
    topic_id            UUID PRIMARY KEY,
    channel_id          UUID NOT NULL,
    owner_user_id       VARCHAR(32),
    owner_name_snapshot VARCHAR(80),
    title               VARCHAR(80) NOT NULL,
    description         VARCHAR(280) NOT NULL DEFAULT '',
    category            VARCHAR(32) NOT NULL DEFAULT 'ogólne',
    status              VARCHAR(16) NOT NULL DEFAULT 'open',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,

    CONSTRAINT chat_topics_channel_fk
        FOREIGN KEY (channel_id) REFERENCES chat_channels(channel_id) ON DELETE CASCADE,
    CONSTRAINT chat_topics_owner_fk
        FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chat_topics_status_check
        CHECK (status IN ('open','closed','hidden')),
    CONSTRAINT chat_topics_title_length
        CHECK (length(title) BETWEEN 3 AND 80),
    CONSTRAINT chat_topics_description_length
        CHECK (length(description) <= 280)
);

CREATE INDEX chat_topics_channel_created_idx
    ON chat_topics(channel_id, status, created_at DESC);
```

Lista kategorii może pozostać kontrolowana aplikacyjnie albo zostać przeniesiona do tabeli słownikowej; nie utrwalamy polskich kategorii AS-IS jako niezmiennego enum architektury.

## 12. `chat_messages`

```sql
CREATE TABLE chat_messages (
    message_id            UUID PRIMARY KEY,
    channel_id            UUID NOT NULL,
    topic_id              UUID,
    author_user_id        VARCHAR(32),
    author_name_snapshot  VARCHAR(80) NOT NULL,
    reply_to_message_id   UUID,
    body                  TEXT NOT NULL,
    metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
    version               BIGINT NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at             TIMESTAMPTZ,
    deleted_at            TIMESTAMPTZ,
    deleted_by_user_id    VARCHAR(32),
    deletion_reason_code  VARCHAR(64),

    CONSTRAINT chat_messages_channel_fk
        FOREIGN KEY (channel_id) REFERENCES chat_channels(channel_id) ON DELETE RESTRICT,
    CONSTRAINT chat_messages_topic_fk
        FOREIGN KEY (topic_id) REFERENCES chat_topics(topic_id) ON DELETE SET NULL,
    CONSTRAINT chat_messages_author_fk
        FOREIGN KEY (author_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chat_messages_reply_fk
        FOREIGN KEY (reply_to_message_id) REFERENCES chat_messages(message_id) ON DELETE SET NULL,
    CONSTRAINT chat_messages_deleted_by_fk
        FOREIGN KEY (deleted_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chat_messages_version_positive CHECK (version >= 1),
    CONSTRAINT chat_messages_body_length CHECK (length(body) BETWEEN 1 AND 600)
);

CREATE INDEX chat_messages_channel_time_idx
    ON chat_messages(channel_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX chat_messages_topic_time_idx
    ON chat_messages(topic_id, created_at DESC)
    WHERE topic_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX chat_messages_author_time_idx
    ON chat_messages(author_user_id, created_at DESC)
    WHERE author_user_id IS NOT NULL;
```

### 12.1 Integralność topic ↔ channel

Same FK nie gwarantują, że topic należy do tego samego channel co message. Rekomendujemy złożony klucz:

```sql
ALTER TABLE chat_topics
    ADD CONSTRAINT chat_topics_id_channel_unique UNIQUE(topic_id, channel_id);

ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_topic_channel_fk
    FOREIGN KEY(topic_id, channel_id)
    REFERENCES chat_topics(topic_id, channel_id);
```

Przy nullable `topic_id` PostgreSQL pozwala na wiadomości bez tematu.

### 12.2 Edycja i delete

Edycja autora może nadal zachować produktowe okno 15 minut, ale warunek jest egzekwowany przez application command + CAS (`version`).

Soft-delete nie zeruje bezwarunkowo `body` w tej samej chwili. Widoczność jest kontrolowana przez `deleted_at`; retencja/anonimizacja treści jest osobną polityką. Dzięki temu Moderation/legal hold może zachować dowód bez pokazywania treści użytkownikom.

## 13. `chat_message_events`

Historia edycji/usuwania jest przydatna dla audytu moderacyjnego i sporów.

```sql
CREATE TABLE chat_message_events (
    event_id          UUID PRIMARY KEY,
    message_id        UUID NOT NULL,
    event_type        VARCHAR(24) NOT NULL,
    actor_user_id     VARCHAR(32),
    message_version   BIGINT NOT NULL,
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    correlation_id    UUID,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chat_message_events_message_fk
        FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE RESTRICT,
    CONSTRAINT chat_message_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chat_message_events_type_check
        CHECK (event_type IN ('created','edited','deleted','restored','moderation_hidden')),
    CONSTRAINT chat_message_events_version_positive CHECK (message_version >= 1),
    CONSTRAINT chat_message_events_message_version_unique UNIQUE(message_id, message_version)
);

CREATE INDEX chat_message_events_time_idx
    ON chat_message_events(message_id, occurred_at);
```

Nie jest to pełny event sourcing chatu; `chat_messages` pozostaje current state.

## 14. `chat_reactions` — concurrency-safe

```sql
CREATE TABLE chat_reactions (
    message_id      UUID NOT NULL,
    user_id         VARCHAR(32) NOT NULL,
    reaction_code   VARCHAR(32) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (message_id, user_id, reaction_code),
    CONSTRAINT chat_reactions_message_fk
        FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE CASCADE,
    CONSTRAINT chat_reactions_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chat_reactions_code_nonempty CHECK (length(trim(reaction_code)) > 0)
);

CREATE INDEX chat_reactions_message_idx
    ON chat_reactions(message_id, reaction_code);
```

Toggle reaction realizujemy przez `INSERT ... ON CONFLICT` / `DELETE` konkretnego wiersza w kontrolowanej transakcji. Równoległe reakcje różnych użytkowników nie nadpisują całego obiektu JSON.

## 15. `social_friendships` — jedna para niezależnie od kierunku

Nie utrzymujemy dwóch orientacji `(A,B)` i `(B,A)` jako różnych kluczy.

```sql
CREATE TABLE social_friendships (
    friendship_id       UUID PRIMARY KEY,
    user_low_id         VARCHAR(32) NOT NULL,
    user_high_id        VARCHAR(32) NOT NULL,
    requested_by_user_id VARCHAR(32) NOT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,

    CONSTRAINT social_friendships_low_fk FOREIGN KEY (user_low_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT social_friendships_high_fk FOREIGN KEY (user_high_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT social_friendships_requester_fk FOREIGN KEY (requested_by_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT social_friendships_order_check CHECK (user_low_id < user_high_id),
    CONSTRAINT social_friendships_status_check CHECK (status IN ('pending','accepted','blocked','removed')),
    CONSTRAINT social_friendships_pair_unique UNIQUE(user_low_id, user_high_id),
    CONSTRAINT social_friendships_requester_member CHECK (requested_by_user_id IN (user_low_id, user_high_id))
);

CREATE INDEX social_friendships_low_status_idx ON social_friendships(user_low_id, status);
CREATE INDEX social_friendships_high_status_idx ON social_friendships(user_high_id, status);
```

Application zawsze kanonizuje parę `min(userA,userB)` / `max(...)`. UNIQUE blokuje race A→B kontra B→A na poziomie DB.

`blocked` może docelowo zostać wydzielone do osobnego modelu user blocks, jeśli wymagania Moderation/Social rozróżnią friendship od blokady; nie jest to warunek migracji AS-IS.

## 16. `chat_reports` — intake dla Moderation

Iteracja 6 nie tworzy jeszcze pełnego `moderation_cases`. Zachowuje punkt wejścia zgłoszeń będący własnością Chat, który Iteracja 7 przekształci/połączy z Moderation workflow.

```sql
CREATE TABLE chat_reports (
    report_id          UUID PRIMARY KEY,
    message_id         UUID NOT NULL,
    reporter_user_id   VARCHAR(32),
    reporter_id_snapshot VARCHAR(32) NOT NULL,
    reason_code        VARCHAR(64) NOT NULL,
    reason_text        VARCHAR(240),
    status             VARCHAR(24) NOT NULL DEFAULT 'submitted',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlation_id     UUID,

    CONSTRAINT chat_reports_message_fk
        FOREIGN KEY (message_id) REFERENCES chat_messages(message_id) ON DELETE RESTRICT,
    CONSTRAINT chat_reports_reporter_fk
        FOREIGN KEY (reporter_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chat_reports_status_check
        CHECK (status IN ('submitted','forwarded','resolved','dismissed')),
    CONSTRAINT chat_reports_message_reporter_unique
        UNIQUE(message_id, reporter_id_snapshot)
);

CREATE INDEX chat_reports_status_time_idx
    ON chat_reports(status, created_at);
```

Report nie usuwa wiadomości automatycznie. Moderation V3 konsumuje zgłoszenie/event i podejmuje audytowalną decyzję.

## 17. Wysłanie wiadomości chat — transakcja

1. zarezerwuj idempotency dla `(author, channel, client_message_id)` w logicznym context key,
2. authz channel + status użytkownika + rate limits/moderation pre-check,
3. `INSERT chat_messages(version=1)`,
4. `INSERT chat_message_events(created)`,
5. `INSERT outbox_events(event_type='chat.message_created')`,
6. zapisz wynik idempotency,
7. COMMIT.

Realtime Gateway dostarcza event po commitcie. Brak klienta w chwili publikacji nie zmienia prawdy domenowej; reconnect pobiera dane/cursor według kontraktu gateway.

## 18. Edit/delete message — CAS

Mutacja:

```sql
UPDATE chat_messages
SET body=$new_body,
    edited_at=NOW(),
    version=version+1
WHERE message_id=$id
  AND author_user_id=$actor
  AND version=$expected_version
  AND deleted_at IS NULL;
```

W tej samej transakcji:
- `chat_message_events`,
- `outbox_events`,
- idempotency result.

Delete moderacyjny jest osobną komendą z uprawnieniem Moderation, `audit_log` i correlation do case/action.

## 19. Realtime i presence V3

Nie tworzymy trwałej tabeli `realtime_subscriptions` jako źródła prawdy.

Docelowo:
- PostgreSQL + outbox są źródłem domain events,
- broker/event bus dystrybuuje eventy,
- Realtime Gateway utrzymuje połączenia,
- shared ephemeral store utrzymuje presence/subscription routing/lease,
- restart jednej instancji nie usuwa globalnego stanu presence całej platformy,
- klient może używać cursor/sequence do reconnect.

Trwałe preferences powiadomień, jeśli potrzebne, dostaną osobny model; active socket/SSE connection nie jest rekordem biznesowym PostgreSQL.

## 20. Idempotency i event naming

Przykładowe eventy:
- `messaging.message_created`,
- `messaging.message_read`,
- `messaging.message_deleted_for_user`,
- `chat.message_created`,
- `chat.message_edited`,
- `chat.message_deleted`,
- `chat.reaction_added`,
- `chat.reaction_removed`,
- `social.friendship_requested`,
- `social.friendship_accepted`,
- `chat.report_submitted`.

Event IDs są stabilne, publisher at-least-once, konsumenci idempotentni.

## 21. Migracja Messaging AS-IS → V3

### `gracz_messages` -> `private_messages` + `private_message_user_state`

MIGRATE-AND-TRANSFORM:
- zachować `message_id`, jeśli zgodny UUID,
- sender/recipient mapować do `users`,
- zachować encrypted subject/body po potwierdzeniu formatu; w przeciwnym razie kontrolowana decrypt+reencrypt migracja,
- `read_at` -> recipient state,
- `recipient_archived` -> recipient `archived_at` (wymaga decyzji mapping timestamp: boolean AS-IS nie zawiera czasu, więc nie wolno wymyślać historycznego timestamp; można oznaczyć migrated-state z provenance),
- `sender_deleted`/`recipient_deleted` -> per-user deleted state; analogicznie brak timestampu nie daje prawa do fikcyjnej daty,
- usunąć CASCADE od kont do wiadomości w nowym modelu.

### `gracz_message_attachments` -> `private_message_attachments`

MIGRATE-AND-TRANSFORM:
- istniejący 1:1 attachment staje się jednym rekordem z nowym `attachment_id`,
- zachować ciphertext/iv/auth_tag tylko jeśli format i key version da się jednoznacznie określić,
- fallback legacy AAD wymaga testu migracyjnego,
- nie dopisywać nowych attachmentów historycznych.

## 22. Migracja Global Chat AS-IS → V3

### `gracz_chat_topics` -> `chat_topics`

MIGRATE-AND-TRANSFORM:
- utworzyć kanoniczny global channel,
- historyczne topics przypisać do niego lub właściwego kanału tylko tam, gdzie kontekst jest dowodliwy,
- `closed` -> status `closed/open`,
- owner FK mapować jeśli możliwe, snapshot nazwy zachować.

### `gracz_global_chat` -> `chat_messages` + `chat_reactions`

MIGRATE-AND-TRANSFORM:
- zachować `message_id`, body, timestamps, reply/topic relationships po walidacji,
- `deleted=TRUE` -> `deleted_at` bez wymyślania czasu; migracja może użyć technicznego marker/provenance zamiast fałszywego historycznego timestamp,
- JSONB reactions rozbić na pojedyncze `(message,user,reaction)` po walidacji; duplikaty deduplikować deterministycznie,
- display_name zachować jako snapshot.

### `gracz_chat_friends` -> `social_friendships`

MIGRATE-AND-TRANSFORM:
- kanonizować parę user_low/user_high,
- wykryć i rozstrzygnąć ewentualne przeciwne duplikaty A→B/B→A według danych, nie arbitralnie,
- mapować statusy po data profiling,
- zachować requester provenance.

### `gracz_global_chat_reports` -> `chat_reports`

MIGRATE-AND-TRANSFORM:
- zachować report/message/reporter/reason/time,
- FK do message/user dodać tylko dla mapowalnych rekordów; osierocone rekordy wymagają raportu jakości i decyzji archiwalnej,
- istniejący UNIQUE(message,reporter) zachować semantycznie.

## 23. Migracja online i walidacja

1. utworzyć V3 shadow tables,
2. data profiling orphan FK/reactions/friendship duplicates/encryption formats,
3. zbudować ID mapping tam, gdzie Identity wymaga remap,
4. backfill batches,
5. porównać counts i próbki semantyczne,
6. uruchomić nowy write path za feature flagą,
7. zatrzymać legacy writers przed finalnym delta copy,
8. przełączyć read path,
9. legacy pozostawić read-only przez okres rollback,
10. DROP dopiero po retencji/akceptacji.

## 24. Kryteria akceptacji Iteracji 6

Iteracja jest projektowo kompletna, gdy:
- private messaging i public chat pozostają odrębnymi domenami,
- wiadomości prywatne zachowują szyfrowanie i per-user state,
- account delete nie kasuje automatycznie wiadomości drugiej strony,
- attachments nie są ograniczone technicznie do 1:1 bez potrzeby,
- chat posiada kanały + opcjonalne topics,
- topic↔channel integralność jest wymuszona,
- reactions są concurrency-safe relacją,
- friendship ma jeden kanoniczny rekord pary i DB-level race protection,
- reports mają realne FK i nie powodują automatycznej sankcji,
- DB mutation + outbox są atomowe,
- realtime/presence jest multi-instance przez broker/shared ephemeral store,
- migracja obejmuje wszystkie 6 tabel AS-IS Messaging + Global Chat,
- migracja nie wymyśla timestampów/relacji, których źródło nie przechowuje.

## 25. Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 7: Moderation V3.**

Zakres powinien objąć `moderation_cases`, źródła/flags/reports, `moderation_actions`, sanctions/bans/mutes, appeals, review workflow, integrację z Identity/Chat/Messaging/Audit/Outbox oraz migrację `gracz_moderation_decisions` i `gracz_moderation_appeals`.