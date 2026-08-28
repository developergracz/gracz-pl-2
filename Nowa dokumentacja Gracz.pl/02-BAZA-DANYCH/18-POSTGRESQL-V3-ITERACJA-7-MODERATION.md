# PostgreSQL V3 — Iteracja 7: Moderation

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / PostgreSQL V3 / iteracja 7**

## 1. Cel i granica bounded contextu

Moderation V3 jest pełnym bounded contextem odpowiedzialnym za intake zgłoszeń, sprawy, decyzje, sankcje, odwołania, review oraz audytowalne wykonanie skutków moderacyjnych.

Moderation nie jest tabelą pomocniczą Global Chatu i nie staje się właścicielem danych innych kontekstów. Działa wobec obiektów należących do Chat, Messaging, Identity, Game Platform, Tournament i innych modułów przez jawne kontrakty, eventy i autoryzowane application services.

Jest to **ARCHITEKTURA DOCELOWA**. AS-IS potwierdza tylko `gracz_moderation_decisions`, `gracz_moderation_appeals` oraz osobny `gracz_global_chat_reports`. Nie zakładamy istnienia legacy ban/mute/action tables, których audyt nie potwierdził.

## 2. Korekta względem uproszczonego założenia migracyjnego

Nie wolno traktować `gracz_moderation_decisions` + `gracz_moderation_appeals` jako dwóch równorzędnych źródeł, które można mechanicznie „merge” do `moderation_cases`.

AS-IS:
- decision jest rekordem wyniku filtra moderacyjnego dla określonego `context`,
- appeal wskazuje konkretny decision przez rzeczywisty FK,
- chat report jest odrębnym intake użytkownika,
- nie ma potwierdzonego pełnego case workflow,
- nie ma potwierdzonego persistent ban/mute state.

Dlatego migracja V3 zachowuje semantykę i provenance, a `moderation_cases` tworzy tylko tam, gdzie istnieje uzasadniona sprawa/workflow. Nie wymyślamy historycznych moderatorów, sankcji ani stanów case.

## 3. Zasady nadrzędne

1. `moderation_cases` jest jednostką workflow, nie zamiennikiem każdego automatycznego filter decision.
2. `moderation_actions` jest append-only historią decyzji/akcji moderatora/systemu.
3. Current enforcement state jest osobny od historii: `moderation_sanctions`.
4. Appeals są first-class records i nie są kasowane kaskadowo razem z historyczną decyzją.
5. User reports są intake; wiele reportów może zostać połączonych z jednym case bez utraty provenance.
6. Każda krytyczna mutacja jest idempotentna i ma correlation/command ID.
7. Stan Moderation + audit + outbox jest zapisywany atomowo tam, gdzie tabele należą do tej samej transakcji/bazy.
8. Moderation nie wykonuje niekontrolowanych bezpośrednich UPDATE w tabelach obcego bounded contextu.
9. Delete/hide chat message jest wykonywany przez kontrakt Chat z `moderation_action_id`/correlation ID.
10. Global ban/account disable jest wykonywany przez kontrakt Identity; Moderation przechowuje decyzję/sankcję, Identity egzekwuje własny current account state.
11. Outbox jest mechanizmem niezawodnej publikacji skutków, nie audytem.
12. `audit_log` jest operacyjnym/compliance audytem, a nie substytutem historii domenowej Moderation.

# CZĘŚĆ A — MODEL DANYCH

## 4. `moderation_cases`

```sql
CREATE TABLE moderation_cases (
    case_id                 UUID PRIMARY KEY,
    target_type             VARCHAR(32) NOT NULL,
    target_id               VARCHAR(128) NOT NULL,
    subject_user_id         VARCHAR(32),
    reason_category         VARCHAR(48) NOT NULL,
    status                  VARCHAR(24) NOT NULL DEFAULT 'open',
    priority                VARCHAR(16) NOT NULL DEFAULT 'normal',
    assigned_moderator_id   VARCHAR(32),
    opened_by_user_id       VARCHAR(32),
    opened_by_type          VARCHAR(16) NOT NULL,
    summary                 TEXT,
    version                 BIGINT NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ,

    CONSTRAINT moderation_cases_subject_fk
        FOREIGN KEY (subject_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_cases_assignee_fk
        FOREIGN KEY (assigned_moderator_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_cases_opener_fk
        FOREIGN KEY (opened_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_cases_target_type_check
        CHECK (target_type IN ('user','chat_message','private_message','match','tournament','profile','other')),
    CONSTRAINT moderation_cases_status_check
        CHECK (status IN ('open','investigating','resolved','escalated','dismissed')),
    CONSTRAINT moderation_cases_priority_check
        CHECK (priority IN ('low','normal','high','critical')),
    CONSTRAINT moderation_cases_opened_by_type_check
        CHECK (opened_by_type IN ('user','moderator','system','migration')),
    CONSTRAINT moderation_cases_version_check CHECK (version >= 1),
    CONSTRAINT moderation_cases_target_nonempty CHECK (length(trim(target_id)) > 0)
);

CREATE INDEX moderation_cases_target_idx
    ON moderation_cases(target_type, target_id, created_at DESC);
CREATE INDEX moderation_cases_status_priority_idx
    ON moderation_cases(status, priority, created_at);
CREATE INDEX moderation_cases_subject_idx
    ON moderation_cases(subject_user_id, created_at DESC)
    WHERE subject_user_id IS NOT NULL;
CREATE INDEX moderation_cases_assignee_idx
    ON moderation_cases(assigned_moderator_id, status, updated_at)
    WHERE assigned_moderator_id IS NOT NULL;
```

### 4.1 Polimorficzny target

`target_type + target_id` jest świadomą referencją cross-context. PostgreSQL nie może bezpiecznie wymusić jednego FK do wielu tabel. Integralność targetu jest walidowana przez application service przy tworzeniu case i zachowywana jako immutable provenance.

Nie tworzymy nullable FK dla każdego możliwego modułu, bo prowadziłoby to do silnego sprzężenia Moderation z całą platformą.

## 5. `moderation_reports` — kanoniczny intake

```sql
CREATE TABLE moderation_reports (
    report_id              UUID PRIMARY KEY,
    case_id                UUID,
    reporter_user_id       VARCHAR(32),
    reporter_id_snapshot   VARCHAR(32),
    target_type            VARCHAR(32) NOT NULL,
    target_id              VARCHAR(128) NOT NULL,
    reason_category        VARCHAR(48) NOT NULL,
    reason_text            VARCHAR(1000),
    status                 VARCHAR(24) NOT NULL DEFAULT 'submitted',
    source_context         VARCHAR(32) NOT NULL,
    source_record_id       VARCHAR(128),
    correlation_id         UUID,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at           TIMESTAMPTZ,

    CONSTRAINT moderation_reports_case_fk
        FOREIGN KEY (case_id) REFERENCES moderation_cases(case_id) ON DELETE SET NULL,
    CONSTRAINT moderation_reports_reporter_fk
        FOREIGN KEY (reporter_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_reports_status_check
        CHECK (status IN ('submitted','triaged','merged_into_case','dismissed','resolved')),
    CONSTRAINT moderation_reports_target_type_check
        CHECK (target_type IN ('user','chat_message','private_message','match','tournament','profile','other')),
    CONSTRAINT moderation_reports_source_dedupe
        UNIQUE (source_context, source_record_id)
);

CREATE INDEX moderation_reports_target_idx
    ON moderation_reports(target_type, target_id, created_at DESC);
CREATE INDEX moderation_reports_queue_idx
    ON moderation_reports(status, created_at);
CREATE INDEX moderation_reports_case_idx
    ON moderation_reports(case_id, created_at)
    WHERE case_id IS NOT NULL;
```

Natywne V3 reports mogą mieć `source_record_id=NULL`; migracja legacy nadaje stabilne provenance. Deduplikacja bieżącego report command dodatkowo używa `idempotency_keys`.

`chat_reports` z Iteracji 6 może pozostać intake-owned-by-Chat podczas przejścia. Docelowo event `chat.report_submitted` tworzy/idempotentnie odwzorowuje `moderation_reports`, a `source_context='chat'` + legacy/new report ID zachowuje pochodzenie. Nie wykonujemy cross-context dual-write bez kontraktu.

## 6. `moderation_actions` — append-only historia działań

```sql
CREATE TABLE moderation_actions (
    action_id              UUID PRIMARY KEY,
    case_id                UUID,
    actor_user_id          VARCHAR(32),
    actor_type             VARCHAR(16) NOT NULL,
    action_type            VARCHAR(40) NOT NULL,
    target_type            VARCHAR(32) NOT NULL,
    target_id              VARCHAR(128) NOT NULL,
    reason_code            VARCHAR(64),
    reason_text            TEXT,
    payload                JSONB NOT NULL DEFAULT '{}'::jsonb,
    command_id             UUID,
    correlation_id         UUID NOT NULL,
    causation_id           UUID,
    source_system          VARCHAR(64) NOT NULL DEFAULT 'gracz-v3',
    source_record_id       VARCHAR(128),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT moderation_actions_case_fk
        FOREIGN KEY (case_id) REFERENCES moderation_cases(case_id) ON DELETE SET NULL,
    CONSTRAINT moderation_actions_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_actions_actor_type_check
        CHECK (actor_type IN ('moderator','administrator','owner','system','migration')),
    CONSTRAINT moderation_actions_type_check
        CHECK (action_type IN (
            'warn','mute','unmute','ban','unban','hide_content','restore_content',
            'escalate','dismiss','resolve','assign','appeal_upheld','appeal_rejected',
            'automated_allow','automated_block'
        )),
    CONSTRAINT moderation_actions_source_dedupe
        UNIQUE (source_system, source_record_id)
);

CREATE INDEX moderation_actions_case_time_idx
    ON moderation_actions(case_id, created_at);
CREATE INDEX moderation_actions_target_time_idx
    ON moderation_actions(target_type, target_id, created_at DESC);
CREATE INDEX moderation_actions_actor_time_idx
    ON moderation_actions(actor_user_id, created_at DESC)
    WHERE actor_user_id IS NOT NULL;
```

Automatyczny AS-IS filter decision może być migrowany jako `automated_allow`/`automated_block` bez fikcyjnego moderatora.

## 7. `moderation_sanctions` — current enforcement state

Zamiast osobnych tabel ban/mute z powielonym lifecycle V3 używa jednego kanonicznego modelu sankcji.

```sql
CREATE TABLE moderation_sanctions (
    sanction_id            UUID PRIMARY KEY,
    case_id                UUID,
    source_action_id       UUID NOT NULL,
    user_id                VARCHAR(32) NOT NULL,
    sanction_type          VARCHAR(24) NOT NULL,
    scope_type             VARCHAR(24) NOT NULL,
    scope_id               VARCHAR(128),
    status                 VARCHAR(16) NOT NULL DEFAULT 'active',
    starts_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at             TIMESTAMPTZ,
    revoked_at             TIMESTAMPTZ,
    revoked_by_action_id   UUID,
    version                BIGINT NOT NULL DEFAULT 1,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT moderation_sanctions_case_fk
        FOREIGN KEY (case_id) REFERENCES moderation_cases(case_id) ON DELETE SET NULL,
    CONSTRAINT moderation_sanctions_source_action_fk
        FOREIGN KEY (source_action_id) REFERENCES moderation_actions(action_id) ON DELETE RESTRICT,
    CONSTRAINT moderation_sanctions_user_fk
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT moderation_sanctions_revoked_action_fk
        FOREIGN KEY (revoked_by_action_id) REFERENCES moderation_actions(action_id) ON DELETE RESTRICT,
    CONSTRAINT moderation_sanctions_type_check
        CHECK (sanction_type IN ('mute','ban','suspension','restriction')),
    CONSTRAINT moderation_sanctions_scope_check
        CHECK (scope_type IN ('global','chat','channel','game','match','tournament','messaging')),
    CONSTRAINT moderation_sanctions_status_check
        CHECK (status IN ('active','expired','revoked')),
    CONSTRAINT moderation_sanctions_scope_shape_check
        CHECK ((scope_type='global' AND scope_id IS NULL) OR (scope_type<>'global' AND scope_id IS NOT NULL)),
    CONSTRAINT moderation_sanctions_expiry_check
        CHECK (expires_at IS NULL OR expires_at > starts_at),
    CONSTRAINT moderation_sanctions_version_check CHECK (version >= 1)
);

CREATE INDEX moderation_sanctions_user_active_idx
    ON moderation_sanctions(user_id, sanction_type, scope_type, scope_id, expires_at)
    WHERE status='active';
CREATE INDEX moderation_sanctions_expiry_idx
    ON moderation_sanctions(expires_at)
    WHERE status='active' AND expires_at IS NOT NULL;
```

Nie narzucamy zwykłego UNIQUE dla active sanction, ponieważ partial UNIQUE nie potrafi poprawnie traktować NULL scope bez jawnej normalizacji. Implementacja może użyć `NULLS NOT DISTINCT` w PostgreSQL 18 albo znormalizowanego scope key, jeżeli wymagamy dokładnie jednej aktywnej sankcji danego typu/scope. Komenda jest zawsze idempotentna i blokuje/scala duplikaty transakcyjnie.

## 8. `moderation_appeals`

```sql
CREATE TABLE moderation_appeals (
    appeal_id              UUID PRIMARY KEY,
    case_id                UUID,
    action_id              UUID NOT NULL,
    appellant_user_id      VARCHAR(32),
    appellant_id_snapshot  VARCHAR(32) NOT NULL,
    explanation            TEXT NOT NULL,
    status                 VARCHAR(24) NOT NULL DEFAULT 'open',
    reviewed_by_user_id    VARCHAR(32),
    review_reason          TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at            TIMESTAMPTZ,
    correlation_id         UUID,
    source_system          VARCHAR(64) NOT NULL DEFAULT 'gracz-v3',
    source_record_id       VARCHAR(128),

    CONSTRAINT moderation_appeals_case_fk
        FOREIGN KEY (case_id) REFERENCES moderation_cases(case_id) ON DELETE SET NULL,
    CONSTRAINT moderation_appeals_action_fk
        FOREIGN KEY (action_id) REFERENCES moderation_actions(action_id) ON DELETE RESTRICT,
    CONSTRAINT moderation_appeals_appellant_fk
        FOREIGN KEY (appellant_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_appeals_reviewer_fk
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_appeals_status_check
        CHECK (status IN ('open','under_review','upheld','rejected','withdrawn')),
    CONSTRAINT moderation_appeals_explanation_length
        CHECK (length(explanation) BETWEEN 10 AND 4000),
    CONSTRAINT moderation_appeals_source_dedupe
        UNIQUE (source_system, source_record_id)
);

CREATE INDEX moderation_appeals_queue_idx
    ON moderation_appeals(status, created_at);
CREATE INDEX moderation_appeals_action_idx
    ON moderation_appeals(action_id, created_at);
```

Czy dopuszczamy jedno czy wiele odwołań do tej samej action jest decyzją produktowo-prawną. AS-IS nie ma UNIQUE na decision_id, więc V3 nie wymyśla ograniczenia bez zatwierdzonego wymagania.

## 9. `moderation_evidence` — referencje do dowodów

Moderation może potrzebować zamrożonego dowodu nawet po soft-delete treści w module źródłowym. Nie kopiujemy jednak automatycznie plaintext prywatnych wiadomości.

```sql
CREATE TABLE moderation_evidence (
    evidence_id          UUID PRIMARY KEY,
    case_id              UUID NOT NULL,
    evidence_type        VARCHAR(32) NOT NULL,
    source_context       VARCHAR(32) NOT NULL,
    source_id            VARCHAR(128) NOT NULL,
    content_hash         CHAR(64),
    snapshot_payload     JSONB,
    encryption_ref       VARCHAR(128),
    captured_by_user_id  VARCHAR(32),
    captured_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retention_until      TIMESTAMPTZ,

    CONSTRAINT moderation_evidence_case_fk
        FOREIGN KEY (case_id) REFERENCES moderation_cases(case_id) ON DELETE RESTRICT,
    CONSTRAINT moderation_evidence_captured_by_fk
        FOREIGN KEY (captured_by_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT moderation_evidence_source_unique
        UNIQUE(case_id, source_context, source_id)
);

CREATE INDEX moderation_evidence_case_idx
    ON moderation_evidence(case_id, captured_at);
```

Snapshot payload musi być minimalny, zgodny z polityką prywatności/retencji i klasyfikacją danych. Dla zaszyfrowanych private messages dowód powinien używać kontrolowanego encrypted evidence flow, nie logowania odszyfrowanego body do JSON/audit/outbox.

# CZĘŚĆ B — KONTRAKTY ATOMOWE

## 10. `submit_report`

W kontekście źródłowym (np. Chat):
1. idempotency `(reporter, target, client_report_id)`,
2. walidacja targetu i reason,
3. zapis `chat_reports` lub source-owned report,
4. outbox `chat.report_submitted`,
5. COMMIT.

W Moderation consumer:
1. idempotency po `event_id`,
2. `INSERT moderation_reports(source_context, source_record_id, ...)`,
3. triage może utworzyć `moderation_cases`,
4. przypisać `case_id`, status `merged_into_case`,
5. outbox `moderation.report_ingested` / `moderation.case_opened`, jeśli potrzebne,
6. COMMIT.

At-least-once delivery nie tworzy duplikatu report/case.

## 11. `mute_user`

Jedna transakcja Moderation:
1. authz `moderation.warn/ban` lub dedykowane `moderation.mute` zgodnie z finalną macierzą permissions,
2. reserve idempotency command,
3. lock case/current relevant sanctions,
4. `INSERT moderation_actions(action_type='mute')`,
5. `INSERT/UPDATE moderation_sanctions(sanction_type='mute', scope...)`,
6. `INSERT audit_log` z tym samym correlation ID,
7. `INSERT outbox_events(event_type='moderation.user_muted')`,
8. idempotency result,
9. COMMIT.

Chat/Realtime konsumuje event i egzekwuje sankcję także przez authoritative policy lookup/cache. Event sam nie jest źródłem prawdy sankcji.

## 12. `ban_user`

Jedna transakcja Moderation:
- idempotency,
- `moderation_actions('ban')`,
- current `moderation_sanctions('ban')`,
- audit,
- outbox `moderation.user_banned`,
- COMMIT.

Jeżeli global ban ma zmienić `users.status`, Moderation nie wykonuje bezpośredniego UPDATE `users`. Publikuje komendę/event do Identity albo orkiestruje application service. Identity wykonuje własny CAS i audit/outbox. Proces jest saga/workflow z retry i stanem widocznym; nie udajemy jednej transakcji ACID ponad granicami bounded contexts.

## 13. `unmute` / `unban`

- lock current sanction,
- jeśli już revoked/expired -> idempotent success,
- `INSERT moderation_actions('unmute'/'unban')`,
- CAS `moderation_sanctions.status='revoked'`, `revoked_at`, `revoked_by_action_id`, version++,
- audit + outbox,
- COMMIT.

Nie kasujemy historycznej sankcji.

## 14. `hide_chat_message`

To jest cross-context workflow, nie bezpośredni UPDATE Moderation -> `chat_messages`.

1. Moderation zapisuje `moderation_actions('hide_content')`, audit i outbox/command `moderation.content_hide_requested`.
2. Chat consumer idempotentnie wykonuje własną transakcję:
   - CAS `chat_messages.deleted_at`/moderation visibility state,
   - `chat_message_events(event_type='moderation_hidden')`,
   - Chat audit/outbox `chat.message_hidden_by_moderation`,
   - COMMIT.
3. Moderation konsumuje confirmation i aktualizuje workflow/case, jeśli wymagane.

Dzięki temu ownership tabel z Backend V3 nie jest łamany. Nie nazywamy cross-context procesu „jedną transakcją”, jeśli nią nie jest.

## 15. `resolve_case`

Jedna transakcja:
- idempotency,
- CAS `moderation_cases WHERE version=expected_version`,
- status -> `resolved` albo `dismissed`, version++, timestamps,
- `moderation_actions('resolve'/'dismiss')`,
- audit,
- outbox `moderation.case_resolved` / `moderation.case_dismissed`,
- COMMIT.

Case resolution nie może automatycznie usuwać historii reportów/actions/evidence.

## 16. `appeal_action`

- sprawdź, czy action/sanction dotyczy appellant i czy jest appealable,
- idempotency,
- `INSERT moderation_appeals`,
- audit `moderation.appeal_created`,
- outbox,
- COMMIT.

Review appeal:
- lock appeal,
- authz reviewer,
- status CAS,
- `moderation_actions('appeal_upheld'/'appeal_rejected')`,
- jeśli upheld wymaga cofnięcia sankcji — w tej samej transakcji Moderation revoke current sanction,
- audit + outbox,
- COMMIT.

Cross-context skutki (np. restore Chat/Identity) idą niezawodnie przez outbox/workflow.

# CZĘŚĆ C — INTEGRACJE

## 17. Identity & Access / RBAC

Moderation korzysta z kanonicznego Identity V3.

Minimalne permissions powinny być jawne, np.:
- `moderation.review`,
- `moderation.warn`,
- `moderation.mute`,
- `moderation.ban`,
- `moderation.content.hide`,
- `moderation.appeal.review`,
- `moderation.escalate`.

AS-IS potwierdza `moderation.review`, `moderation.warn`, `moderation.ban`; pozostałe są **ARCHITEKTURĄ DOCELOWĄ**, nie stanem obecnym.

Moderator nie dostaje automatycznie dostępu do plaintext prywatnej korespondencji. Dostęp do evidence wymaga osobnej policy i audytu.

## 18. Audit vs Security vs Moderation

- `moderation_actions`: historia domenowa decyzji Moderation,
- `audit_log`: kto/co/kiedy wykonał administracyjnie/systemowo,
- `security_events`: zdarzenia bezpieczeństwa Identity/security,
- `outbox_events`: niezawodne zdarzenia integracyjne.

Nie kopiujemy całych payloadów pomiędzy tymi tabelami. Każda ma własny cel, minimalizację danych i retencję.

## 19. Messaging & Chat

Chat jest właścicielem `chat_messages`, `chat_reports`; Moderation jest właścicielem cases/actions/sanctions/appeals.

Private Messaging pozostaje szyfrowane. Automatyczny moderation pre-check przed zaszyfrowaniem może blokować treść zgodnie z polityką, ale persistent evidence plaintext nie może powstać przypadkiem. Ewentualny lawful/moderation access do już zaszyfrowanych wiadomości wymaga osobnego ADR bezpieczeństwa.

## 20. Game Platform i Tournament

Przykładowe targety:
- `match` + `game_matches.match_id`,
- `tournament` + `tournaments.tournament_id`,
- `user` + `users.user_id`.

Cheating report może otworzyć case i zapisać evidence references do match events/snapshots. Moderation nie zmienia wyniku meczu ani drabinki bez komendy do właściciela Game/Tournament.

## 21. Realtime

Realtime Gateway może otrzymywać:
- `moderation.user_muted`,
- `moderation.user_unmuted`,
- `moderation.user_banned`,
- `moderation.content_hidden`,
- `moderation.case_updated` tylko dla uprawnionych moderatorów.

Nie publikujemy prywatnych reason/evidence do publicznego kanału realtime. Event contract ma klasyfikację odbiorcy i minimalny payload.

# CZĘŚĆ D — MIGRACJA AS-IS

## 22. `gracz_moderation_decisions`

**MIGRATE-AND-TRANSFORM**, nie automatyczne case-per-row.

Dla każdego legacy decision:
- zachować `decision_id` jako source provenance,
- `user_id` mapować do `users` jeśli możliwe,
- `context`, `outcome`, `reason`, `content_hash`, `created_at` zachować,
- utworzyć `moderation_actions` typu `automated_allow`/`automated_block` albo dedykowany import history store zgodnie z data profiling,
- `actor_type='migration'` lub system semantics, bez fikcyjnego moderatora,
- `source_system='legacy.gracz_moderation_decisions'`, `source_record_id=decision_id`,
- case utworzyć tylko, jeśli decyzja ma appeal/report/workflow wymagający case.

AS-IS `content_hash` może być NULL, ponieważ bieżący `record()` go nie wypełnia; migracja nie generuje brakującego hash z nieistniejącego plaintext.

## 23. `gracz_moderation_appeals`

**MIGRATE-AND-TRANSFORM**.

- zachować `appeal_id`, explanation/status/timestamps/reviewer, jeśli mapowalne,
- zachować relację do legacy decision przez mapping decision -> V3 action,
- `user_id` i `reviewed_by` mapować do `users` tylko gdy istnieje wiarygodny mapping,
- nie wymyślać review outcome, jeśli AS-IS status/timestamps tego nie potwierdzają,
- source provenance gwarantuje idempotentny re-run migracji,
- legacy `ON DELETE CASCADE` nie jest kopiowany; V3 appeal/action history używa RESTRICT/SET NULL zgodnie z retencją.

## 24. `gracz_global_chat_reports`

W Iteracji 6 jest mapowane do `chat_reports`. Moderation V3 następnie ingestuje je jako `moderation_reports` przez source provenance/event.

Nie tworzymy dwóch niezależnych kopii bez powiązania: `moderation_reports.source_context/source_record_id` wskazuje kanoniczny source report.

## 25. Nowe elementy bez AS-IS odpowiednika

Następujące modele są **ARCHITEKTURĄ DOCELOWĄ**, nie migracją istniejących tabel:
- `moderation_cases`,
- `moderation_sanctions`,
- pełny `moderation_actions` workflow dla manual actions,
- `moderation_evidence`,
- persistent ban/mute enforcement state,
- review/resolve/escalation workflow.

Nie backfillujemy fikcyjnych historycznych banów/mute tylko dlatego, że AS-IS RBAC posiada permissions `moderation.ban`.

# CZĘŚĆ E — CONCURRENCY, RETENCJA, OPERACJE

## 26. Concurrency i idempotency

- case transitions: CAS na `moderation_cases.version`,
- sanction revoke/modify: CAS na `moderation_sanctions.version`,
- reports: source provenance + idempotency,
- commands: `idempotency_keys`,
- consumers: processed event/message id,
- action history: append-only,
- duplicate provider/realtime delivery nie powtarza skutku domenowego.

Nie stosujemy last-write-wins dla case/sanction state.

## 27. Retencja i legal hold

Polityka musi rozdzielać:
- reports,
- cases,
- actions,
- sanctions,
- appeals,
- evidence,
- audit records,
- security events.

`legal_hold`/investigation hold może blokować purge dowodu/treści w source context przez jawny kontrakt. Moderation nie utrzymuje danych bezterminowo domyślnie.

Dane szczególne/sensitive evidence są minimalizowane, szyfrowane tam, gdzie wymagane, i dostępne tylko rolom z osobną permission.

## 28. Monitoring

Minimalne metryki:
- open/investigating cases,
- oldest untriaged report,
- appeal backlog/age,
- active sanctions per type/scope,
- sanction expiry worker lag,
- idempotency conflicts,
- failed cross-context enforcement commands,
- outbox lag,
- case CAS conflicts,
- unauthorized moderation attempts.

Alerty obejmują szczególnie stuck global ban/unban workflows i failed content-hide commands.

## 29. Migracja online

1. utworzyć V3 moderation tables,
2. data profiling decisions/appeals/chat reports i user mappings,
3. zbudować decision -> action mapping,
4. backfill append-only history z provenance,
5. utworzyć cases tylko według jawnych reguł migracyjnych,
6. zweryfikować counts, chronology, appeal links i orphan records,
7. uruchomić V3 intake/action path za feature flagą,
8. zatrzymać legacy writers i wykonać final delta,
9. legacy tables read-only przez okres rollback/retencji,
10. DROP dopiero po formalnej akceptacji i backupie.

## 30. Kryteria akceptacji Iteracji 7

Iteracja jest projektowo kompletna, gdy:
- reports, cases, actions, sanctions, appeals i evidence mają rozdzielone role,
- current enforcement state nie jest mieszany z historią,
- ban/mute ma persistent authoritative state,
- case/sanction transitions używają CAS,
- wszystkie mutating commands są idempotentne,
- action + audit + outbox są atomowe w granicy Moderation,
- cross-context mutations nie łamią ownership tabel,
- Chat report intake jest spięty z Moderation bez niekontrolowanego dual-write,
- legacy decisions/appeals są migrowane bez fikcyjnych danych,
- brak AS-IS ban/mute tables jest jawnie zachowany jako fakt,
- appeals nie znikają przez legacy-style CASCADE,
- evidence nie powoduje przypadkowego wycieku plaintext private messages,
- retencja/legal hold są jawne,
- rollback/cutover mają kontrolowany plan.

## 31. Następny krok ETAPU 2

Po Iteracji 7 wszystkie główne bounded contexts Backend/PostgreSQL V3 mają projekt docelowy.

Następny krok:

**Iteracja 8 — końcowa macierz migracji 28 tabel PostgreSQL AS-IS -> V3, kolumna-po-kolumnie / reguła-po-regule.**

Dopiero po jej weryfikacji powstaje formalny dokument PostgreSQL V3 FINAL i można formalnie zamknąć ETAP 2. Nie zamykamy ETAPU 2 samym ukończeniem Moderation V3.