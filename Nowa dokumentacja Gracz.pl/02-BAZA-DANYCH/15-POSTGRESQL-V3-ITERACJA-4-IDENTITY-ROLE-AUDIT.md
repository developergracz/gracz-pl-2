# PostgreSQL V3 — Iteracja 4: Identity & Access + Role/Audit

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / PostgreSQL V3 / iteracja 4**

## 1. Cel i granica dokumentu

Dokument definiuje kanoniczny model Identity & Access oraz Role/Audit V3. Jest to **ARCHITEKTURA DOCELOWA**, nie opis tabel już wdrożonych.

Identity & Access jest właścicielem tożsamości, uwierzytelnienia, sesji, MFA i bieżących przypisań ról. Audit jest append-only zapisem działań wymagających ścieżki audytowej. Security Events opisują zdarzenia bezpieczeństwa i nie są utożsamiane z ogólnym audytem.

Iteracja rozwiązuje również potwierdzony drift ETAPU 1B: współistnienie `gracz_role_changes` i `gracz_role_history` oraz dodatkowy `gracz_audit_log_legacy_1787562123031`.

## 2. Zasady nadrzędne

1. Identity & Access nie zależy domenowo od Game Platform, Tournament, Newsletter, Chat ani Moderation.
2. Inne bounded contexts referują kanoniczny `users.user_id`, ale nie zapisują bezpośrednio danych uwierzytelnienia.
3. Bieżące role są w `user_roles`; historia zmian jest append-only w `role_change_events`.
4. Zmiana uprawnień, historia roli, audit i outbox są jednym logicznym skutkiem i muszą być atomowe w granicy wspólnej bazy.
5. Retry komend administracyjnych jest chronione `idempotency_keys`.
6. `audit_log`, `role_change_events` i `security_events` są append-only na poziomie kontraktu aplikacyjnego; korekta odbywa się nowym zdarzeniem, nie nadpisaniem historii.
7. Legacy audit nie jest usuwany przed analizą retencji, jakości i zależności.
8. Dane wrażliwe, sekrety MFA i tokeny nie mogą trafiać w plaintext do audit payload/outbox.

## 3. `users`

```sql
CREATE TABLE users (
    user_id             VARCHAR(32) PRIMARY KEY,
    email               VARCHAR(254) NOT NULL,
    email_normalized    VARCHAR(254) NOT NULL,
    username            VARCHAR(64) NOT NULL,
    username_normalized VARCHAR(64) NOT NULL,
    password_hash       TEXT NOT NULL,
    status              VARCHAR(24) NOT NULL DEFAULT 'pending',
    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    version             BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT users_email_normalized_unique UNIQUE (email_normalized),
    CONSTRAINT users_username_normalized_unique UNIQUE (username_normalized),
    CONSTRAINT users_status_check CHECK (status IN ('pending','active','suspended','banned','deleted')),
    CONSTRAINT users_version_positive CHECK (version >= 1),
    CONSTRAINT users_email_nonempty CHECK (length(trim(email_normalized)) > 0),
    CONSTRAINT users_username_nonempty CHECK (length(trim(username_normalized)) > 0),
    CONSTRAINT users_deleted_consistency CHECK ((status = 'deleted' AND deleted_at IS NOT NULL) OR status <> 'deleted')
);

CREATE INDEX users_status_idx ON users(status);
CREATE INDEX users_created_idx ON users(created_at DESC);
```

Normalizacja email/username jest jawna. UNIQUE powinien działać na wartości kanonicznej, nie na przypadkowej pisowni. Format email pozostaje walidowany przez warstwę aplikacyjną; DB wymusza podstawowe invarianty i unikalność.

`version` chroni krytyczne przejścia statusu użytkownika przez CAS.

## 4. `user_profiles`

```sql
CREATE TABLE user_profiles (
    user_id          VARCHAR(32) PRIMARY KEY,
    display_name     VARCHAR(80),
    bio              TEXT,
    avatar_ref       TEXT,
    locale           VARCHAR(16),
    timezone         VARCHAR(64),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_profiles_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
```

Profil jest oddzielony od danych uwierzytelnienia, aby pozostałe moduły nie musiały otrzymywać dostępu do credential data.

## 5. `auth_sessions`

```sql
CREATE TABLE auth_sessions (
    session_id         UUID PRIMARY KEY,
    user_id            VARCHAR(32) NOT NULL,
    token_hash         BYTEA NOT NULL UNIQUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at       TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ NOT NULL,
    revoked_at         TIMESTAMPTZ,
    revoke_reason      VARCHAR(96),
    ip_hash            CHAR(64),
    user_agent_hash    CHAR(64),

    CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT auth_sessions_revoke_consistency CHECK (revoked_at IS NOT NULL OR revoke_reason IS NULL)
);

CREATE INDEX auth_sessions_user_active_idx
    ON auth_sessions(user_id, expires_at)
    WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
```

Przechowujemy hash tokenu sesji, nie token jawny.

## 6. Tokeny resetu i rejestracji

```sql
CREATE TABLE password_reset_tokens (
    token_id          UUID PRIMARY KEY,
    user_id           VARCHAR(32) NOT NULL,
    token_hash        BYTEA NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ NOT NULL,
    consumed_at       TIMESTAMPTZ,
    requested_ip_hash CHAR(64),
    CONSTRAINT password_reset_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT password_reset_expiry CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_active_idx
    ON password_reset_tokens(user_id, expires_at)
    WHERE consumed_at IS NULL;

CREATE TABLE registration_codes (
    code_id           UUID PRIMARY KEY,
    code_hash         BYTEA NOT NULL UNIQUE,
    intended_email_normalized VARCHAR(254),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ NOT NULL,
    consumed_at       TIMESTAMPTZ,
    consumed_by_user_id VARCHAR(32),
    CONSTRAINT registration_codes_user_fk FOREIGN KEY (consumed_by_user_id) REFERENCES users(user_id),
    CONSTRAINT registration_codes_expiry CHECK (expires_at > created_at)
);
```

Przed implementacją należy potwierdzić, czy `registration_codes` pozostaje wymaganiem produktu; model nie wymusza zachowania funkcji tylko dlatego, że tabela istnieje AS-IS.

## 7. `mfa_credentials`

```sql
CREATE TABLE mfa_credentials (
    mfa_id            UUID PRIMARY KEY,
    user_id           VARCHAR(32) NOT NULL,
    method            VARCHAR(24) NOT NULL,
    secret_ciphertext BYTEA,
    key_version       VARCHAR(32),
    enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disabled_at       TIMESTAMPTZ,

    CONSTRAINT mfa_credentials_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT mfa_credentials_method_check CHECK (method IN ('totp','webauthn','recovery')),
    CONSTRAINT mfa_credentials_enabled_consistency CHECK (enabled = FALSE OR verified_at IS NOT NULL)
);

CREATE INDEX mfa_credentials_user_idx ON mfa_credentials(user_id, enabled);
```

Sekrety wymagające odzyskania są szyfrowane, nie hashowane; klucze szyfrujące nie są przechowywane w tej tabeli. WebAuthn może wymagać wyspecjalizowanych kolumn/tabel w późniejszym ADR — powyższy model jest wspólnym kontraktem lifecycle, nie próbą wciśnięcia wszystkich credential formats do jednego plaintext payloadu.

## 8. `roles`

```sql
CREATE TABLE roles (
    role_id          UUID PRIMARY KEY,
    code             VARCHAR(64) NOT NULL UNIQUE,
    name             VARCHAR(96) NOT NULL,
    description      TEXT,
    system_role      BOOLEAN NOT NULL DEFAULT FALSE,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_code_nonempty CHECK (length(trim(code)) > 0)
);
```

Stabilnym identyfikatorem semantycznym jest `code`; nazwa prezentacyjna może się zmieniać.

## 9. `user_roles`

```sql
CREATE TABLE user_roles (
    user_id            VARCHAR(32) NOT NULL,
    role_id            UUID NOT NULL,
    assigned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by_user_id VARCHAR(32),
    assignment_reason  TEXT,

    PRIMARY KEY (user_id, role_id),
    CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT user_roles_role_fk FOREIGN KEY (role_id) REFERENCES roles(role_id),
    CONSTRAINT user_roles_actor_fk FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX user_roles_role_idx ON user_roles(role_id, user_id);
```

`user_roles` jest bieżącym stanem. Historia nie jest rekonstruowana przez analizę tego wiersza.

## 10. `role_change_events` — kanoniczny MERGE dwóch historii

Zamiast opierać audyt na JSON `old_roles/new_roles` jako jedynym dowodzie, V3 zapisuje operację granularnie: jaka rola została dodana/usunięta. Snapshoty ról mogą być w metadata, ale kanoniczna zmiana pozostaje jednoznaczna.

```sql
CREATE TABLE role_change_events (
    event_id           UUID PRIMARY KEY,
    user_id            VARCHAR(32) NOT NULL,
    role_id            UUID,
    role_code_snapshot VARCHAR(64) NOT NULL,
    change_type        VARCHAR(16) NOT NULL,
    actor_user_id      VARCHAR(32),
    reason             TEXT,
    command_id         UUID,
    correlation_id     UUID,
    source_system      VARCHAR(64) NOT NULL DEFAULT 'gracz-v3',
    source_record_id   VARCHAR(128),
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT role_change_events_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT role_change_events_role_fk FOREIGN KEY (role_id) REFERENCES roles(role_id),
    CONSTRAINT role_change_events_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(user_id),
    CONSTRAINT role_change_events_type_check CHECK (change_type IN ('assigned','revoked')),
    CONSTRAINT role_change_events_source_dedupe UNIQUE (source_system, source_record_id)
);

CREATE INDEX role_change_events_user_time_idx ON role_change_events(user_id, occurred_at DESC);
CREATE INDEX role_change_events_actor_time_idx ON role_change_events(actor_user_id, occurred_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX role_change_events_command_idx ON role_change_events(command_id) WHERE command_id IS NOT NULL;
```

`role_id` jest nullable celowo dla historycznej migracji: jeśli legacy zapis wskazuje rolę, której nie można bezpiecznie zmapować do aktualnego rekordu `roles`, zachowujemy `role_code_snapshot` i provenance zamiast wymyślać FK.

`UNIQUE(source_system, source_record_id)` wymaga, aby migrator nadawał stabilny identyfikator źródłowy; dla natywnych V3 eventów `source_record_id` może być NULL. PostgreSQL dopuszcza wiele NULL.

## 11. Atomowa zmiana roli

Przykład `assign_role`:

1. zarezerwuj `idempotency_keys(context='identity.assign_role', key=command_id)`,
2. zweryfikuj uprawnienie aktora,
3. lock/CAS użytkownika lub właściwego agregatu autoryzacji,
4. `INSERT user_roles` (PK chroni przed duplikatem),
5. `INSERT role_change_events(change_type='assigned')`,
6. `INSERT audit_log(action='identity.role.assigned')`,
7. `INSERT outbox_events(event_type='identity.role_changed')`,
8. zapisz wynik idempotency,
9. `COMMIT`.

`revoke_role` analogicznie usuwa bieżące przypisanie, ale historia pozostaje append-only.

Zmiana roli bez odpowiadającego `role_change_events` i audytu nie jest poprawnym sukcesem biznesowym V3.

## 12. `audit_log` — kanoniczny append-only audit

```sql
CREATE TABLE audit_log (
    audit_id           UUID PRIMARY KEY,
    actor_user_id      VARCHAR(32),
    actor_type         VARCHAR(24) NOT NULL DEFAULT 'user',
    action             VARCHAR(128) NOT NULL,
    target_type        VARCHAR(64),
    target_id          VARCHAR(128),
    result             VARCHAR(24) NOT NULL DEFAULT 'success',
    request_id         UUID,
    correlation_id     UUID,
    causation_id       UUID,
    source_service     VARCHAR(64) NOT NULL,
    payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_log_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(user_id),
    CONSTRAINT audit_log_actor_type_check CHECK (actor_type IN ('user','system','service','anonymous')),
    CONSTRAINT audit_log_result_check CHECK (result IN ('success','denied','failed')),
    CONSTRAINT audit_log_action_nonempty CHECK (length(trim(action)) > 0)
);

CREATE INDEX audit_log_target_idx ON audit_log(target_type, target_id, occurred_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log(actor_user_id, occurred_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX audit_log_correlation_idx ON audit_log(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX audit_log_time_idx ON audit_log(occurred_at DESC);
```

Audit payload podlega allowliście/redakcji. Zakazane są m.in. hasła, tokeny sesji/resetu, MFA secrets, klucze szyfrujące i pełne credential payloads.

Append-only musi być egzekwowany również przez uprawnienia DB: konto aplikacyjne zapisujące audit powinno otrzymać INSERT/SELECT według potrzeb, bez zwykłego UPDATE/DELETE. Retention/archiwizacja działa przez kontrolowany proces administracyjny, nie endpoint aplikacji.

## 13. `security_events`

Security Events nie zastępują audytu. Są przeznaczone do detekcji, analityki i reakcji na zdarzenia uwierzytelnienia/ochrony konta.

```sql
CREATE TABLE security_events (
    security_event_id UUID PRIMARY KEY,
    user_id           VARCHAR(32),
    event_type        VARCHAR(96) NOT NULL,
    outcome           VARCHAR(24) NOT NULL,
    ip_hash           CHAR(64),
    user_agent_hash   CHAR(64),
    request_id        UUID,
    correlation_id    UUID,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT security_events_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT security_events_outcome_check CHECK (outcome IN ('success','failure','blocked','challenged'))
);

CREATE INDEX security_events_user_time_idx ON security_events(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX security_events_type_time_idx ON security_events(event_type, occurred_at DESC);
CREATE INDEX security_events_time_idx ON security_events(occurred_at DESC);
```

Przykładowe eventy: `auth.login_succeeded`, `auth.login_failed`, `auth.session_revoked`, `auth.password_reset_requested`, `auth.password_changed`, `auth.mfa_challenged`, `auth.account_locked`.

## 14. Status użytkownika: ban a moderacja

`users.status='banned'` jest egzekwowalnym stanem dostępu, ale źródło decyzji o sankcji może należeć do Moderation. Moderation nie powinno wykonywać przypadkowego UPDATE `users`; wywołuje kontrakt Identity/Access, który atomowo aktualizuje status/version, zapisuje audit/outbox i zachowuje korelację z decyzją moderacyjną.

Docelowy event może mieć `identity.user_banned`/`identity.user_unbanned`. Szczegółowa sankcja i workflow odwoławczy pozostają w Moderation V3.

## 15. Migracja `gracz_accounts` i tabel Identity AS-IS

Mapowanie projektowe:
- `gracz_accounts` -> `users` + `user_profiles`,
- `gracz_auth_sessions` -> `auth_sessions`,
- `gracz_password_reset_tokens` -> `password_reset_tokens`,
- `gracz_mfa` -> `mfa_credentials`,
- `gracz_registration_codes` -> `registration_codes` tylko jeśli funkcja pozostaje wymagana,
- `gracz_roles` -> `roles` + `user_roles` według rzeczywistej semantyki danych,
- pozostałe identity dane wymagają mapowania kolumna-po-kolumnie w końcowej macierzy migracji.

Nie zakładamy 1:1 typów ani statusów bez data profiling. Identyfikatory użytkowników powinny zostać zachowane, jeśli to możliwe, aby ograniczyć koszt backfillu FK w pozostałych bounded contexts; jeśli nie, wymagane jest jawne ID mapping table na czas migracji.

## 16. MERGE: `gracz_role_changes` + `gracz_role_history`

Obie tabele są źródłami historycznymi, nie dwiema równorzędnymi tabelami V3.

Migracja wymaga:
1. data profiling obu tabel,
2. identyfikacji aktywnych writerów/readers,
3. mapowania aktora, użytkownika, roli, operacji, powodu i timestampu,
4. zachowania `source_system`/`source_record_id`,
5. deduplikacji tylko na podstawie dowodu, nie podobnego timestampu/tekstu,
6. deterministycznego sortowania historii,
7. walidacji liczby rekordów i zakresów dat,
8. backfill `role_change_events`,
9. przełączenia writerów na V3,
10. dopiero później wyłączenia starych tabel.

Jeśli legacy rekord nie pozwala odtworzyć `old_roles/new_roles`, nie generujemy fikcyjnego snapshotu. Zachowujemy to, co źródło rzeczywiście potwierdza, wraz z provenance.

## 17. DEPRECATE: legacy audit

`gracz_audit_log_legacy_1787562123031` pozostaje **DEPRECATE**, nie `DROP NOW`.

Przed decyzją:
- policzyć rekordy,
- ustalić min/max timestamp,
- ustalić writerów/readers,
- porównać overlap z `gracz_audit_log`,
- sprawdzić wymagania retencji i ewentualne obowiązki prawne,
- sklasyfikować rekordy na: bezpiecznie mapowalne do V3 / tylko archiwalne / duplikaty potwierdzone dowodem.

Opcje:
A. migracja wiarygodnych rekordów do `audit_log` z provenance,
B. zamrożone archiwum read-only,
C. kombinacja A+B.

Usunięcie jest dopuszczalne dopiero po zatwierdzonej retencji, backupie, okresie rollback i potwierdzeniu braku aktywnych zależności.

## 18. Outbox i idempotency

Ważne eventy Identity V3:
- `identity.user_created`,
- `identity.user_activated`,
- `identity.user_suspended`,
- `identity.user_banned`,
- `identity.user_unbanned`,
- `identity.user_deleted`,
- `identity.user_restored`,
- `identity.role_changed`,
- `identity.password_changed`,
- `identity.mfa_enabled`,
- `identity.mfa_disabled`.

Event outbox nie może zawierać credential secrets. Zmiana domenowa i event outbox są atomowe. Konsumenci używają `processed_messages`/idempotency zgodnie z Iteracją 2.

## 19. Retencja i prywatność

Retencja nie jest jednym globalnym TTL:
- aktywne sesje/tokeny — cleanup po wygaśnięciu zgodnie z polityką,
- security events — retencja bezpieczeństwa ustalona osobno,
- audit — retencja audytowa/prawna,
- role history — historia zmian uprawnień zgodnie z polityką audytu,
- konto usunięte — polityka anonimizacji/usunięcia musi uwzględnić legalne podstawy zachowania danych audytowych.

FK do `users` nie może prowadzić do przypadkowego CASCADE usuwającego audit/history. Dlatego historyczne tabele nie używają `ON DELETE CASCADE` dla aktorów/subjectów.

## 20. Kryteria akceptacji Iteracji 4

Iteracja jest projektowo kompletna, gdy:
- istnieje jeden kanoniczny `users`,
- credential/profile data są rozdzielone,
- tokeny są przechowywane jako hash, MFA secrets jako ciphertext z key version,
- bieżące role są w `user_roles`,
- `gracz_role_changes` i `gracz_role_history` mają jeden docelowy `role_change_events`,
- role changes są atomowe z audytem/outbox/idempotency,
- `audit_log` ma actor/target/action/result/correlation i append-only kontrakt,
- security events są oddzielone od audytu,
- legacy audit ma jawny proces DEPRECATE bez przedwczesnego DROP,
- brak sekretów w audycie/outbox,
- migracja nie wymyśla brakujących historycznych danych.

## 21. Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 5: Newsletter V3.**

Priorytetem będzie normalizacja potwierdzonego HIGH schema drift `gracz_newsletter_subscribers`, zachowanie historii zgód, sources/attribution, double opt-in, retencja oraz atomowy przepływ `DB transaction -> outbox -> mail worker -> provider/delivery event`.