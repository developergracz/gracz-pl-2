# ETAP 3 — Plan DDL migracji PostgreSQL V3 — Iteracja 2

Data: 28.08.2026
Status: **PLAN WYKONAWCZY — NIE URUCHAMIAĆ NA PRODUKCJI PRZED PREFLIGHT GO**

## 1. Cel

Dokument definiuje kolejność i zasady przygotowania executable DDL dla migracji Gracz.pl z rzeczywistego modelu 28 tabel AS-IS do PostgreSQL V3.

Nie jest jeszcze skryptem produkcyjnym i nie autoryzuje wykonania `CREATE/ALTER/DROP` na bazie Render. Celem jest przygotowanie migracji tak, aby była:
- rozszerzająca i kompatybilna w pierwszej fazie,
- odwracalna do momentu writer cutover,
- obserwowalna,
- idempotentna tam, gdzie to możliwe,
- możliwa do walidacji przed contract/drop,
- zgodna z ownership/bounded contexts V3.

## 2. Dane wejściowe

Plan opiera się na:
- PostgreSQL V3 FINAL,
- macierzy migracji 28/28 AS-IS -> V3,
- Environment Baseline Render PostgreSQL 18.4,
- exact Data Profile 28/28,
- aktualnym wolumenie ok. 13 865 wierszy / ~8,2 MiB.

Mały wolumen obniża ryzyko czasu backfillu, ale nie usuwa ryzyk integralności, crypto, writerów i cutover.

## 3. Zasada nadrzędna migracji

Obowiązuje sekwencja:

1. **EXPAND** — tworzymy nowe struktury V3 bez niszczenia legacy.
2. **BACKFILL** — kopiujemy/transformujemy dane z pełnym provenance.
3. **VERIFY / RECONCILE** — porównujemy counts, invariants i semantykę.
4. **DUAL-READ / DUAL-WRITE** — tylko tam, gdzie potrzebne i kontrolowane.
5. **WRITER CUTOVER** — jeden jawny owner zapisu dla każdego agregatu.
6. **OBSERVE** — okres stabilizacji i reconciliation.
7. **CONTRACT** — dopiero na końcu wyłączamy/usuwamy legacy.

Nigdy nie wykonujemy `DROP` w tej samej fazie, w której po raz pierwszy przełączamy writer.

## 4. Preflight blockers przed pierwszym produkcyjnym DDL

### BLOCKER-01 — backup/restore
Musi istnieć świeży pełny backup i potwierdzony restore path/test do odrębnego środowiska.

### BLOCKER-02 — data-quality/orphan/collision
Przed docelowymi UNIQUE/FK/NOT NULL należy policzyć i rozwiązać lub sklasyfikować:
- normalized account/email collisions,
- newsletter subscriber mapping/collisions,
- chat logical orphans,
- friendship A↔B duplicates,
- tournament collisions,
- moderation/report logical orphans,
- null/invalid values względem V3.

### BLOCKER-03 — writer inventory
Nie może istnieć niezinwentaryzowany writer, który zapisuje do legacy po cutover.

### BLOCKER-04 — crypto compatibility
Private Messaging/attachments oraz MFA wymagają potwierdzonego odczytu/migracji ciphertext/key formats.

### BLOCKER-05 — active state/cutover
Dla Warcabów/Tysiąca/sesji auth i newsletter workflow trzeba ustalić drain/migrate/allow-finish strategy.

### BLOCKER-06 — credentials
Poświadczenia DB muszą przejść hygiene/rotation gate, a migration runner powinien używać odrębnej roli z kontrolowanymi uprawnieniami.

## 5. Globalne reguły executable DDL

Każdy skrypt migracyjny powinien:
- mieć numer i nazwę,
- posiadać sekcję preconditions,
- ustawiać `lock_timeout` i `statement_timeout` lokalnie,
- nie wykonywać niekontrolowanego table rewrite na dużej/aktywnej tabeli,
- rozdzielać creation od validation dla kosztownych constraints,
- używać `NOT VALID` + `VALIDATE CONSTRAINT` tam, gdzie ma to sens,
- unikać długich `ACCESS EXCLUSIVE` locków,
- używać `CREATE INDEX CONCURRENTLY` dla indeksów na aktywnych tabelach, jeśli wykonywane poza transakcją,
- nie mieszać `CREATE INDEX CONCURRENTLY` z transaction blockiem,
- emitować jawny rezultat/verification query,
- mieć krok rollback dla fazy expand,
- nie kasować legacy danych w expand/backfill.

## 6. Proponowany podział skryptów

### 00 — precheck-readonly.sql
- wersja serwera,
- schema fingerprint,
- counts krytycznych tabel,
- active connections/locks,
- potwierdzenie braku nieoczekiwanych obiektów,
- GO/NO-GO input.

### 01 — v3-foundation.sql
Tworzy fundament współdzielony:
- ewentualne schematy/namespaces jeśli finalny model je przewiduje,
- typy/check domains tylko tam, gdzie zatwierdzone,
- wspólne funkcje techniczne wyłącznie jeśli jawnie wymagane,
- `outbox_events`,
- `idempotency_keys`,
- opcjonalne `processed_messages` zgodnie z FINAL.

### 02 — identity-audit-v3.sql
Tworzy nowe struktury:
- `users`,
- `user_profiles`,
- `auth_sessions` V3,
- `password_reset_tokens` V3,
- `registration_codes` V3,
- `mfa_credentials`,
- `roles`,
- `user_roles`,
- `role_change_events`,
- canonical `audit_log`,
- `security_events`.

Legacy pozostaje nietknięte.

### 03 — game-platform-v3.sql
Tworzy:
- `game_definitions`,
- `game_matches`,
- `game_match_participants`,
- `game_match_events`,
- `game_match_snapshots`,
- `match_actor_leases`.

Warunki przed finalnym executable DDL:
- rozstrzygnięcie cardinality `game_match_events` vs aggregate version,
- monotonic fencing token design,
- stale actor lease recovery.

### 04 — tournament-v3.sql
Tworzy:
- `tournaments` V3,
- `tournament_registrations`,
- `tournament_rounds`,
- `tournament_matches` V3,
- integrity `(round_id,tournament_id)` zgodnie z FINAL.

### 05 — messaging-chat-v3.sql
Tworzy oddzielnie:
- Private Messaging V3,
- user-side message state,
- attachment model one-to-many,
- Global Chat channels/topics/messages/events/reactions,
- social friendships,
- chat report intake/linkage.

Nie scala private Messaging z Global Chat.

### 06 — moderation-v3.sql
Tworzy:
- moderation cases,
- source/intake linkage,
- append-only actions,
- sanctions,
- appeals/reviews,
- kontrakty integracyjne do Identity/Chat przez command/outbox, nie direct cross-context writes.

### 07 — newsletter-v3.sql
Tworzy canonical newsletter model:
- subscribers,
- tokens,
- sources,
- subscriber_sources,
- consents append-only,
- events,
- opcjonalne campaign/provider telemetry zgodnie z FINAL.

Ze względu na HIGH drift ten kontekst nie przechodzi do backfill bez osobnego mapping report.

### 08 — indexes-and-constraints.sql
- indeksy supporting queries/uniqueness,
- FK/CHECK/UNIQUE w kolejności bezpiecznej dla danych,
- `NOT VALID` tam, gdzie potrzebne,
- późniejsze `VALIDATE CONSTRAINT`.

### 09 — verification.sql
- object existence,
- PK/FK/UNIQUE/index expectations,
- count reconciliation,
- orphan verification,
- max/min IDs/sequence safety,
- sample semantic checks bez ujawniania plaintextu.

## 7. Strategia naming i coexistence

Podczas expand nie wolno nadpisać tabel legacy o tej samej nazwie bez kontroli. Dla obiektów, których nazwa V3 koliduje z AS-IS, stosujemy jedną z dwóch zatwierdzanych strategii:

### Strategia A — schema namespace V3
Np. `v3.users`, `v3.game_matches`.
Zaleta: pełna separacja i prosty rollback namespace.
Wada: późniejszy contract/rename/schema cutover.

### Strategia B — suffix `_v3`
Np. `users_v3`, `tournaments_v3`.
Zaleta: prostsze przy obecnym `public`.
Wada: późniejsze rename/contract i większe ryzyko tymczasowego bałaganu nazw.

**Decyzja naming musi być zamknięta przed wygenerowaniem finalnego executable DDL.**

## 8. Backfill order — zależności

Rekomendowana kolejność danych:

1. Identity base users/profile.
2. Roles/current-role/audit mapping.
3. Auth/reset/registration/MFA.
4. Game definitions.
5. Game matches + participants (Warcaby/Tysiąc; Gomoku bez historycznej tabeli DB).
6. Tournament entities zależne od Identity/Game.
7. Messaging base messages + per-user state + attachments.
8. Global Chat/Social.
9. Moderation.
10. Newsletter subscriber canonical mapping.
11. Newsletter sources/consents/events/link tables.

Outbox/idempotency structures mogą istnieć od początku, ale historyczny backfill nie powinien automatycznie publikować zdarzeń produkcyjnych jak nowe live events.

## 9. Backfill auditability

Każdy backfill musi zapisywać/emitować co najmniej:
- source table,
- source primary identifier,
- target identifier,
- transform version,
- result `MIGRATED/TRANSFORMED/QUARANTINED/SKIPPED`,
- reason code,
- timestamp/correlation run ID.

Nie wolno „naprawiać” niejednoznacznych danych bez śladu.

## 10. Identity migration notes

`gracz_accounts.user_id` jest osią większości mapowań. Przed FK V3:
- potwierdzić canonical user ID strategy,
- normalized uniqueness dla email/username,
- mapping deleted/legacy users,
- role consolidation.

Puste obecnie `gracz_roles`, `gracz_role_changes`, `gracz_role_history` redukują wolumen, ale nie zwalniają z writer inventory i semantic mapping.

## 11. Game Platform migration notes

### Warcaby
`gracz_game_sessions` ma 2 rekordy i produkcyjny `version`.
Backfill musi:
- zachować current state,
- przypisać game definition/rules version,
- wyciągnąć participant mapping wyłącznie z danych, jeśli wiarygodne,
- nie wymyślać historycznych events.

### Tysiąc
`gracz_thousand_games` ma 29 rekordów i `revision` CAS semantics.
Backfill state -> canonical match state jest możliwy dopiero po state-schema profiling.

### Gomoku
Brak durable AS-IS tabeli — nie ma historycznego DB backfillu. V3 zaczyna durability od cutover/runtime migration.

## 12. Tournament migration notes

Wszystkie trzy tabele turniejowe są obecnie puste. To upraszcza backfill, ale executable DDL nadal musi mieć właściwe constraints i concurrency semantics dla przyszłych danych.

## 13. Messaging migration notes

5 wiadomości i 2 załączniki to mały wolumen, ale jest to **crypto-critical migration**.

Nie wolno:
- logować plaintextu,
- przenosić ciphertext bez testu kompatybilności,
- założyć, że jeden format AAD obejmuje wszystkie załączniki.

Możliwe strategie:
1. zachować legacy ciphertext format i dodać format/version marker,
2. kontrolowany decrypt+reencrypt w izolowanym migration runnerze.

Wybór wymaga testu kompatybilności i key material readiness.

## 14. Newsletter migration notes — HIGH drift

5 subscribers to mało rekordów, ale tabela ma najtrudniejszy mapping semantyczny:
- legacy UUID `subscriber_id` PK,
- równoległe BIGINT `id`,
- helper FK wskazują na `id`,
- równoległe token/consent lifecycle fields,
- status drift.

Przed backfill trzeba stworzyć canonical mapping table/report 5/5 subscriberów. Nie wolno użyć prostego `INSERT ... SELECT *`.

## 15. Audit migration notes

`gracz_audit_log` ma 13 743 rekordy i jest największym obiektem (~6,14 MiB), ale wolumen pozostaje mały.

Migracja powinna być append-preserving:
- zachować event IDs/timestamps, jeśli mapowanie pozwala,
- nie przepisywać historycznego znaczenia eventów,
- legacy audit table jest pusta, ale usunięcie dopiero po dependency/retention check.

## 16. Index creation

Dla obecnego wolumenu zwykłe `CREATE INDEX` będzie szybkie, ale na aktywnej produkcji nadal analizujemy lock behavior.

Zasada:
- indeksy wymagane do backfill/validation mogą powstać w expand,
- indeksy niekrytyczne można odroczyć,
- `CREATE INDEX CONCURRENTLY` rozważyć na aktywnych legacy/target tables, gdy brak maintenance lock window,
- finalne UNIQUE dopiero po collision profile.

## 17. FK i constraints

Nie dodajemy od razu constraintów, które mogą zablokować backfill.

Pattern:
1. utworzyć strukturę,
2. backfill,
3. orphan/invalid check,
4. dodać FK `NOT VALID` jeśli odpowiednie,
5. `VALIDATE CONSTRAINT`,
6. dopiero później zaostrzyć NOT NULL/UNIQUE, gdy dane i writer są gotowe.

## 18. Lock strategy

Przed każdym DDL:
- snapshot aktywnych połączeń i locków,
- lokalny `lock_timeout`,
- lokalny `statement_timeout`,
- brak oczekiwania w nieskończoność,
- przerwanie kroku zamiast forsowania locka.

W krótkim maintenance window można dopuścić bardziej bezpośrednie DDL, ale tylko po drain writerów.

## 19. Dual-write

Dual-write nie jest domyślnym rozwiązaniem dla każdego kontekstu.

Stosujemy go wyłącznie, gdy:
- nie można zatrzymać legacy writera na czas backfill+cutover,
- mamy idempotency i reconciliation,
- write ordering jest jawny,
- failure semantics obu zapisów są zdefiniowane.

Preferowana architektura docelowa: jeden writer do canonical V3 + outbox, a legacy compatibility przez read/projection/controlled bridge, nie trwałe dwa niezależne writery.

## 20. Cutover

Writer cutover per context, nie jeden globalny switch dla całej aplikacji.

Minimalna procedura:
1. freeze/drain danego writera,
2. delta backfill,
3. reconcile,
4. enable V3 writer,
5. smoke test,
6. obserwacja metrics/errors,
7. legacy writer disabled/fenced,
8. reader cutover etapami.

## 21. Rollback

### Przed writer cutover
Rollback jest prosty: wyłączyć V3 path, pozostawić legacy jako source of truth, usunąć/pozostawić nieaktywne expand objects.

### Po writer cutover
Rollback wymaga jawnej reverse/delta reconciliation. Nie wolno po prostu wrócić do legacy, jeśli V3 przyjęło nowe writes, których legacy nie posiada.

Dlatego każdy context cutover musi mieć określony:
- rollback horizon,
- reverse mapping feasibility,
- write freeze point,
- reconciliation query.

## 22. Contract/drop

Legacy tables/columns/indexes/sequences mogą być usuwane dopiero po:
- stabilizacji V3,
- potwierdzeniu braku readerów/writerów,
- retention/legal check,
- backup point,
- final reconciliation,
- zaakceptowanym rollback horizon closure.

Legacy audit/role/newsletter obiekty wymagają osobnej zgody contract.

## 23. Następne artefakty Iteracji 2

Przed executable SQL tworzymy kolejno:
1. `05-DATA-QUALITY-ORPHAN-COLLISION-COLLECTOR.sql`,
2. `06-DATA-QUALITY-WYNIKI.md`,
3. `07-WRITER-READER-ENDPOINT-INVENTORY.md`,
4. `08-CRYPTO-COMPATIBILITY-PLAN.md`,
5. `09-BACKUP-RESTORE-RUNBOOK.md`,
6. `10-DDL-EXECUTION-MANIFEST.md`.

Dopiero po ich krytycznym PASS generujemy finalne numbered executable migrations.

## 24. Status Iteracji 2

**PLAN DDL: ROZPOCZĘTY.**

Potwierdzone:
- migration pattern,
- kolejność kontekstów,
- zasady lock/constraint/index,
- backfill dependency order,
- rollback/cutover framework.

Niepotwierdzone / blokujące produkcyjne wykonanie:
- backup/restore,
- collision/orphan/data-quality,
- writer inventory,
- crypto compatibility,
- active-state cutover,
- credential/least privilege gate,
- final naming/coexistence strategy.

**NO-GO dla produkcyjnego DDL na tym etapie.**