# PostgreSQL V3 — Iteracja 5: Newsletter

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / PostgreSQL V3 / iteracja 5**

## 1. Cel i korekta założenia wejściowego

Newsletter V3 usuwa największy schema drift wykryty w ETAPIE 1B: hybrydowy produkcyjny `gracz_newsletter_subscribers`.

Ważne: AS-IS nie jest pojedynczą tabelą przechowującą całą historię. Potwierdzono pięć tabel newslettera: `gracz_newsletter_subscribers`, `newsletter_sources`, `newsletter_subscriber_sources`, `newsletter_consent_history`, `newsletter_events`. Problemem jest hybrydowy subscriber schema oraz brak atomowości pomiędzy głównym lifecycle i zapisami source/consent/events, a także pomiędzy transakcją DB i wysyłką maila.

V3 zachowuje wartościowe rozdzielenie source/consent/events, normalizuje subscriber state i dodaje Transactional Outbox.

## 2. Zasady nadrzędne

1. `newsletter_subscribers` przechowuje wyłącznie bieżący stan subskrypcji.
2. Zgoda marketingowa ma dedykowaną, append-only historię `newsletter_consents`; nie jest redukowana do ogólnego event payload.
3. `newsletter_events` przechowuje lifecycle/operational events.
4. Attribution pozostaje osobnym modelem `newsletter_sources` + `newsletter_subscriber_sources`.
5. Tokeny publicznych operacji są przechowywane wyłącznie jako hash.
6. Zmiana stanu + consent/event + outbox + idempotency jest atomowa w jednej transakcji PostgreSQL.
7. Mail nie jest wysyłany w transakcji HTTP. Worker odbiera zadanie przez outbox i wykonuje dostarczenie z retry/idempotency.
8. `user_id` jest opcjonalnym powiązaniem z Identity V3. Anonimowa subskrypcja jest pełnoprawnym przypadkiem.
9. Usunięcie konta użytkownika nie oznacza automatycznie utraty dowodu zgody newsletterowej.
10. Retencja danych identyfikujących i dowodów zgody musi być jawna i konfigurowalna polityką, a nie przypadkowym CASCADE.

## 3. `newsletter_subscribers` — stan bieżący

```sql
CREATE TABLE newsletter_subscribers (
    subscriber_id          UUID PRIMARY KEY,
    user_id                VARCHAR(32),
    email                  VARCHAR(254) NOT NULL,
    email_normalized       VARCHAR(254) NOT NULL,
    preferred_nick         VARCHAR(24),
    preferred_nick_normalized VARCHAR(24),
    status                 VARCHAR(32) NOT NULL DEFAULT 'pending_confirmation',
    consent_version        VARCHAR(64),
    confirmed_at           TIMESTAMPTZ,
    unsubscribed_at        TIMESTAMPTZ,
    bounced_at             TIMESTAMPTZ,
    blocked_at             TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version                BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT newsletter_subscribers_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT newsletter_subscribers_email_unique UNIQUE (email_normalized),
    CONSTRAINT newsletter_subscribers_status_check
        CHECK (status IN ('pending_confirmation','subscribed','unsubscribed','bounced','blocked')),
    CONSTRAINT newsletter_subscribers_version_check CHECK (version >= 1),
    CONSTRAINT newsletter_subscribers_email_nonempty CHECK (length(trim(email_normalized)) > 0)
);

CREATE INDEX newsletter_subscribers_status_idx
    ON newsletter_subscribers(status, created_at DESC);
CREATE INDEX newsletter_subscribers_user_idx
    ON newsletter_subscribers(user_id)
    WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX newsletter_subscribers_active_nick_unique
    ON newsletter_subscribers(preferred_nick_normalized)
    WHERE preferred_nick_normalized IS NOT NULL
      AND status IN ('pending_confirmation','subscribed');
```

`email_normalized` jest kanonicznym kluczem unikalności. `version` wspiera CAS dla zmian lifecycle.

`consent_version` w current state jest projekcją aktualnie obowiązującej zgody, nie substytutem historii prawnej.

## 4. Tokeny newslettera — oddzielone od subscriber state

V3 nie utrzymuje wielu lifecycle token hashes jako przypadkowych kolumn głównego rekordu.

```sql
CREATE TABLE newsletter_tokens (
    token_id          UUID PRIMARY KEY,
    subscriber_id     UUID NOT NULL,
    purpose           VARCHAR(32) NOT NULL,
    token_hash        BYTEA NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ,
    consumed_at       TIMESTAMPTZ,
    revoked_at        TIMESTAMPTZ,

    CONSTRAINT newsletter_tokens_subscriber_fk
        FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(subscriber_id) ON DELETE CASCADE,
    CONSTRAINT newsletter_tokens_purpose_check
        CHECK (purpose IN ('confirm','unsubscribe','position')),
    CONSTRAINT newsletter_tokens_expiry_check
        CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT newsletter_tokens_consumed_revoked_check
        CHECK (NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL))
);

CREATE INDEX newsletter_tokens_active_idx
    ON newsletter_tokens(subscriber_id, purpose, expires_at)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
```

Confirmation token powinien mieć TTL (AS-IS: 24 h). Polityka unsubscribe/position tokenów może być dłuższa, ale musi być jawna. Przy rotacji poprzednie tokeny są revoked.

## 5. `newsletter_sources`

Wartościowy model AS-IS zostaje zachowany i dostosowany do UUID.

```sql
CREATE TABLE newsletter_sources (
    source_id       UUID PRIMARY KEY,
    code            VARCHAR(64) NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    source_type     VARCHAR(32) NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT newsletter_sources_type_check
        CHECK (source_type IN ('internal','campaign','partner','advertisement','other'))
);
```

## 6. `newsletter_subscriber_sources` — attribution

```sql
CREATE TABLE newsletter_subscriber_sources (
    subscriber_id       UUID NOT NULL,
    source_id           UUID NOT NULL,
    first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    campaign_reference  VARCHAR(128),
    partner_reference   VARCHAR(128),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (subscriber_id, source_id),
    CONSTRAINT newsletter_subscriber_sources_subscriber_fk
        FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(subscriber_id) ON DELETE RESTRICT,
    CONSTRAINT newsletter_subscriber_sources_source_fk
        FOREIGN KEY (source_id) REFERENCES newsletter_sources(source_id) ON DELETE RESTRICT
);

CREATE INDEX newsletter_subscriber_sources_source_idx
    ON newsletter_subscriber_sources(source_id, first_seen_at DESC);
```

## 7. `newsletter_consents` — kanoniczny dowód zgody

```sql
CREATE TABLE newsletter_consents (
    consent_event_id UUID PRIMARY KEY,
    subscriber_id    UUID NOT NULL,
    consent_type     VARCHAR(64) NOT NULL,
    consent_version  VARCHAR(64) NOT NULL,
    action           VARCHAR(24) NOT NULL,
    source_id        UUID,
    actor_user_id    VARCHAR(32),
    command_id       UUID,
    source_system    VARCHAR(64) NOT NULL DEFAULT 'gracz-v3',
    source_record_id VARCHAR(128),
    ip_hash          CHAR(64),
    user_agent_hash  CHAR(64),
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT newsletter_consents_subscriber_fk
        FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(subscriber_id) ON DELETE RESTRICT,
    CONSTRAINT newsletter_consents_source_fk
        FOREIGN KEY (source_id) REFERENCES newsletter_sources(source_id) ON DELETE SET NULL,
    CONSTRAINT newsletter_consents_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT newsletter_consents_action_check
        CHECK (action IN ('granted','confirmed','revoked')),
    CONSTRAINT newsletter_consents_source_dedupe
        UNIQUE (source_system, source_record_id)
);

CREATE INDEX newsletter_consents_subscriber_time_idx
    ON newsletter_consents(subscriber_id, occurred_at DESC);
CREATE INDEX newsletter_consents_type_action_idx
    ON newsletter_consents(consent_type, action, occurred_at DESC);
```

To usuwa ryzyko AS-IS, gdzie deduplikacja consent była aplikacyjnym `WHERE NOT EXISTS` bez odpowiadającego constraintu. Migrator nadaje stabilne `source_record_id`; natywne eventy V3 mogą mieć NULL.

## 8. `newsletter_events` — lifecycle i operational history

```sql
CREATE TABLE newsletter_events (
    event_id          UUID PRIMARY KEY,
    subscriber_id     UUID,
    event_type        VARCHAR(96) NOT NULL,
    source_id         UUID,
    actor_user_id     VARCHAR(32),
    command_id        UUID,
    correlation_id    UUID,
    source_system     VARCHAR(64) NOT NULL DEFAULT 'gracz-v3',
    source_record_id  VARCHAR(128),
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT newsletter_events_subscriber_fk
        FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(subscriber_id) ON DELETE SET NULL,
    CONSTRAINT newsletter_events_source_fk
        FOREIGN KEY (source_id) REFERENCES newsletter_sources(source_id) ON DELETE SET NULL,
    CONSTRAINT newsletter_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT newsletter_events_source_dedupe
        UNIQUE (source_system, source_record_id),
    CONSTRAINT newsletter_events_type_nonempty CHECK (length(trim(event_type)) > 0)
);

CREATE INDEX newsletter_events_subscriber_time_idx
    ON newsletter_events(subscriber_id, occurred_at DESC);
CREATE INDEX newsletter_events_type_time_idx
    ON newsletter_events(event_type, occurred_at DESC);
CREATE INDEX newsletter_events_time_idx ON newsletter_events(occurred_at DESC);
```

Consent history i lifecycle events pozostają rozdzielone. Zgoda nie może istnieć wyłącznie jako luźny JSON event.

## 9. Campaign model — zakres opcjonalny

Campaigns nie są wymagane do migracji obecnego newslettera, dlatego nie blokują Iteracji 5. Jeśli Gracz.pl będzie prowadził kampanie wysyłkowe, docelowy moduł może dodać:

```sql
CREATE TABLE newsletter_campaigns (
    campaign_id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(24) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT newsletter_campaigns_status_check
      CHECK (status IN ('draft','scheduled','sending','finished','cancelled'))
);
```

Provider delivery/open/click/bounce events mogą trafić do osobnej `newsletter_delivery_events`; nie należy mieszać provider telemetry z prawną historią consent.

## 10. Double opt-in V3 — atomowy kontrakt `subscribe`

Transakcja:
1. zarezerwuj `idempotency_keys(context='newsletter.subscribe', key=command_id)`,
2. normalizuj i waliduj email,
3. znajdź subscriber po `email_normalized` i zablokuj rekord (`FOR UPDATE`) lub utwórz nowy,
4. respektuj cooldown antyspamowy,
5. ustaw `status='pending_confirmation'`, `version++` przez CAS,
6. zapisz/odśwież attribution source,
7. zapisz `newsletter_consents(action='granted')`,
8. zapisz lifecycle event `subscribe.requested`,
9. utwórz confirmation token hash z TTL,
10. dodaj `outbox_events(event_type='newsletter.confirmation_requested')`, zawierający tylko bezpieczne dane/referencje,
11. zapisz wynik idempotency,
12. COMMIT.

Mail worker po COMMIT pobiera outbox, generuje/odtwarza bezpieczny kontrakt wiadomości i wysyła e-mail. Retry nie tworzy drugiego skutku domenowego.

## 11. `resend_confirmation`

W jednej transakcji:
- idempotency,
- `FOR UPDATE` subscriber,
- status musi być `pending_confirmation`,
- kontrola cooldownu,
- revoke poprzedniego active confirm token,
- nowy token hash + TTL,
- lifecycle `subscribe.resend_requested`,
- outbox `newsletter.confirmation_requested`,
- COMMIT.

Nie wysyłamy maila bezpośrednio z transakcji HTTP.

## 12. `confirm`

W jednej transakcji:
1. hash tokenu wejściowego,
2. `SELECT ... FOR UPDATE` aktywnego tokenu i subskrybenta,
3. sprawdzenie TTL/purpose/consumed/revoked,
4. `status='subscribed'`, `confirmed_at=NOW()`, `version++`,
5. token confirm -> `consumed_at`,
6. `newsletter_consents(action='confirmed')`,
7. lifecycle `subscribe.confirmed`,
8. utworzenie/rotacja unsubscribe/position token hashes jeśli funkcje pozostają w produkcie,
9. outbox `newsletter.subscribed` oraz opcjonalnie `newsletter.welcome_requested`,
10. COMMIT.

Welcome mail jest skutkiem outbox, więc awaria providera nie cofa potwierdzonej zgody, ale pozostaje widoczna/retryable.

## 13. `unsubscribe`

W jednej transakcji:
- token/identity authorization,
- lock/CAS subscriber,
- jeśli już unsubscribed — idempotent success,
- status -> `unsubscribed`, `unsubscribed_at=NOW()`, version++,
- revoke public tokens wymagających unieważnienia,
- `newsletter_consents(action='revoked')`,
- lifecycle `subscribe.unsubscribed`,
- outbox `newsletter.unsubscribed`,
- COMMIT.

Nie wykonujemy fizycznego DELETE jako części zwykłego wypisania.

## 14. Bounce / block

Provider webhook jest przetwarzany idempotentnie (`provider + provider_event_id`). Hard bounce lub administracyjny block może zmienić current status oraz dopisać `newsletter_events`, a jeśli jest to zdarzenie domenowe wymagające dalszych skutków — także outbox.

`bounced` nie jest automatycznie równoznaczne z `consent revoked`; stan dostarczalności i stan zgody mają odrębną semantykę. Implementacja nie może tworzyć fałszywej historii prawnej.

## 15. Identity integration

`newsletter_subscribers.user_id` jest opcjonalne.

- anonimowy zapis: `user_id IS NULL`,
- powiązanie z kontem następuje tylko po wiarygodnej weryfikacji tożsamości/email ownership,
- zmiana email konta nie może po cichu przepisać newsletter subscriber i zgody; wymaga jawnej polityki/flow oraz eventu,
- usunięcie konta: FK `ON DELETE SET NULL`; subscriber/consent może pozostać zgodnie z podstawą prawną i retencją,
- Newsletter nie odczytuje credential data z Identity.

## 16. Audit i security

Zmiany administracyjne (block/unblock/import/manual correction) zapisują `audit_log` z correlation ID. Publiczne anty-abuse zdarzenia mogą trafiać do odpowiedniego security stream, ale nie należy duplikować każdego newsletter lifecycle eventu w globalnym audycie.

IP/user-agent, jeśli potrzebne jako dowód/anty-abuse, są hashowane/pseudonimizowane zgodnie z polityką. Payload nie zawiera tokenów jawnych.

## 17. Migracja z pięciu tabel AS-IS

### 17.1 `gracz_newsletter_subscribers` -> `newsletter_subscribers` + `newsletter_tokens`

Przed migracją wymagany data profiling hybrydowych kolumn i dwóch identyfikatorów (`subscriber_id` legacy oraz `id` nowszy). Należy zbudować jawny mapping old-id -> new UUID.

Stan current jest mapowany na nowy status wyłącznie na podstawie rzeczywistych wartości i semantyki. Legacy/new token hashes są przenoszone tylko jeśli nadal ważne i jednoznacznie przypisane do purpose; w przeciwnym razie są bezpiecznie unieważniane i generowany jest nowy flow.

Nie generujemy historii eventów z samego faktu, że obecnie istnieje timestamp, jeśli nie pozwala on wiarygodnie ustalić semantyki zdarzenia.

### 17.2 `newsletter_sources` -> `newsletter_sources`

MIGRATE. Zachować `code`, typ i semantykę. Wymagany mapping BIGINT -> UUID dla referencji.

### 17.3 `newsletter_subscriber_sources` -> `newsletter_subscriber_sources`

MIGRATE-AND-REKEY. Zachować attribution i metadata; przemapować subscriber/source IDs.

### 17.4 `newsletter_consent_history` -> `newsletter_consents`

MIGRATE-AND-TRANSFORM. Zachować chronologię, consent type/version/action/source/metadata. Nadać provenance `source_system='legacy.newsletter_consent_history'` i stabilny `source_record_id` z legacy PK. Nie deduplikować podobnych rekordów bez dowodu.

### 17.5 `newsletter_events` -> `newsletter_events`

MIGRATE-AND-REKEY. Zachować lifecycle event_type/timestamps/metadata i mapować subscriber/source. Dodać provenance. Jeśli subscriber/source nie może być zmapowany, zachować zdarzenie zgodnie z nullable FK zamiast wymyślać relację.

## 18. Migracja online / cutover

1. utworzyć V3 shadow tables,
2. data profiling + raport jakości,
3. backfill w kontrolowanych batchach,
4. walidacja counts/checksums/zakresów dat i mapping IDs,
5. uruchomić V3 write path za feature flagą; preferowany jeden kanoniczny writer zamiast długotrwałego niekontrolowanego dual-write,
6. przez okres przejściowy porównywać projekcje/read results,
7. przełączyć read path,
8. zamrozić legacy write path,
9. zachować stare tabele read-only przez okres rollback/retencji,
10. dopiero po akceptacji rozważyć archiwizację/usunięcie.

Każdy krok ma checkpoint i możliwość rollbacku przed destrukcyjnym etapem.

## 19. Retencja

Polityka musi osobno definiować:
- wygasłe pending confirmations,
- consumed/revoked tokens,
- unsubscribed subscriber current records,
- consent proof/history,
- lifecycle analytics events,
- source attribution,
- provider delivery telemetry,
- audit/security records.

Automatyczny cleanup nie może usunąć danych wymaganych do wykazania historii zgody. Z drugiej strony bezterminowe przechowywanie wszystkich operational metadata nie jest domyślnym założeniem V3.

## 20. Campaign/delivery worker i Outbox

Wysyłka maila jest side effectem:

`HTTP/API transaction -> PostgreSQL state + consent/event + outbox -> COMMIT -> outbox worker -> mail provider -> delivery event`

Worker używa stabilnego event/message ID. Retry tego samego outbox eventu nie może generować niekontrolowanych wielokrotnych wysyłek; provider idempotency key jest używany, jeśli provider go wspiera, a lokalny dispatch ma własny rejestr przetworzenia.

Status outbox nie jest dowodem dostarczenia maila. Delivery/provider status ma własną telemetrię.

## 21. Kryteria akceptacji Iteracji 5

Iteracja jest projektowo kompletna, gdy:
- current subscriber state jest oddzielony od historii,
- consent ma dedykowany append-only model i DB-level dedupe provenance,
- attribution jest zachowane,
- tokeny są hashowane i mają lifecycle,
- double opt-in jest atomowy po stronie DB,
- DB state nie jest już best-effort rozdzielony od consent/events,
- wysyłka e-mail jest realizowana przez Transactional Outbox,
- retry jest idempotentne,
- Identity link jest opcjonalny i bezpieczny przy usunięciu konta,
- migracja uwzględnia wszystkie pięć tabel AS-IS oraz hybrydowe IDs/kolumny,
- legacy jest zamrażane dopiero po walidacji i okresie rollback,
- retencja consent, operational events i tokenów jest rozdzielona.

## 22. Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 6: Messaging & Global Chat V3.**

Priorytety: prywatne wiadomości i załączniki, ownership/deletion semantics, Global Chat topics/messages/reactions/friends/reports, concurrency-safe reactions/friendship, trwały multi-instance realtime/pub-sub, outbox i integracja z Moderation.