# PostgreSQL V3 — Iteracja 8: końcowa macierz migracji 28 AS-IS -> V3

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / PostgreSQL V3 / iteracja 8**

## 1. Cel i źródła decyzji

Dokument zamyka projektowe odwzorowanie **28 rzeczywistych tabel PostgreSQL Render** do modelu V3. Nie jest skryptem migracyjnym i nie wykonuje DDL/DML na produkcji.

Źródła prawdy:
- ETAP 1B: AS-IS dla Identity/Audit, gier, Messaging, Moderation, Global Chat, Tournament, Newsletter,
- rzeczywisty dump Render: 28 tabel, dwa dodatkowe obiekty względem mapy kodowej, drift newslettera i dodatkowe `version` w Warcabach,
- Iteracje V3 1–7.

Kategorie:
- **MIGRATE-AND-TRANSFORM** — dane pozostają potrzebne, struktura/semantyka zmienia się,
- **MERGE** — wiele legacy modeli składa się do jednego kanonicznego modelu,
- **DEPRECATE** — legacy wyłączane dopiero po retencji/archiwizacji i braku zależności,
- **REPLACE** — funkcja legacy zastępowana nowym modelem, a historyczny stan nie jest kopiowany 1:1.

`dual-write` poniżej nigdy nie oznacza niekontrolowanego zapisu dwóch niezależnych modeli. Preferujemy shadow/backfill + cutover; jeśli okres kompatybilności wymaga dwóch zapisów, musi istnieć jeden writer/orchestrator, idempotency i reconciliation.

## 2. Macierz wykonawcza 28/28

| # | AS-IS | V3 | Status | Backfill | Dual-write | Shadow | Archive/retention | Transform | Event/worker/API migration |
|---:|---|---|---|---|---|---|---|---|---|
|1|`gracz_accounts`|`users`,`user_profiles`|MIGRATE-AND-TRANSFORM|TAK|czasowo możliwe|TAK|retencja kont|TAK|auth/profile endpoints + identity events|
|2|`gracz_audit_log`|`audit_log`|MIGRATE-AND-TRANSFORM|TAK|NIE; przełączyć writer|TAK|TAK, compliance|TAK|audit producers|
|3|`gracz_audit_log_legacy_1787562123031`|archive / wybrane `audit_log`|DEPRECATE|warunkowo|NIE|NIE|**TAK**|warunkowo|brak nowych writerów; readers/archive|
|4|`gracz_auth_sessions`|`auth_sessions`|MIGRATE-AND-TRANSFORM|tylko aktywne, jeśli wymagane|NIE preferowane|TAK|krótka retencja|TAK|login/session endpoints|
|5|`gracz_chat_friends`|`social_friendships`|MIGRATE-AND-TRANSFORM|TAK|czasowo możliwe|TAK|wg social policy|**TAK**|social endpoints/events|
|6|`gracz_chat_topics`|`chat_channels`,`chat_topics`|MIGRATE-AND-TRANSFORM|TAK|czasowo możliwe|TAK|TAK|TAK|chat endpoints/realtime|
|7|`gracz_game_sessions`|`game_matches`,`game_match_players`,`game_match_events`,`game_match_snapshots`|MIGRATE-AND-TRANSFORM|TAK|NIE dla command path; cutover match writer|TAK|game-history policy|**TAK**|Checkers match-runtime/outbox/realtime|
|8|`gracz_global_chat`|`chat_messages`,`chat_reactions`,`chat_message_events`|MIGRATE-AND-TRANSFORM|TAK|czasowo kontrolowane|TAK|TAK|**TAK**|chat API + realtime + moderation hooks|
|9|`gracz_global_chat_reports`|`chat_reports` -> `moderation_reports` intake|MIGRATE-AND-TRANSFORM|TAK|NIE cross-context; event bridge|TAK|TAK|TAK|chat report endpoint + moderation consumer|
|10|`gracz_message_attachments`|`private_message_attachments`|MIGRATE-AND-TRANSFORM|TAK|NIE preferowane|TAK|TAK|TAK, encryption compatibility|upload/download workers/endpoints|
|11|`gracz_messages`|`private_messages`,`private_message_user_state`|MIGRATE-AND-TRANSFORM|TAK|czasowo możliwe tylko controlled|TAK|TAK|**TAK**|messaging endpoints/outbox/realtime|
|12|`gracz_mfa`|`mfa_credentials`|MIGRATE-AND-TRANSFORM|TAK, po crypto validation|NIE preferowane|TAK|security retention|**TAK**|MFA endpoints/security events|
|13|`gracz_moderation_appeals`|`moderation_appeals` + mapping do `moderation_actions`|MIGRATE-AND-TRANSFORM|TAK|NIE|TAK|TAK|TAK|appeal/review endpoints/events|
|14|`gracz_moderation_decisions`|`moderation_actions` (`automated_*`), cases tylko wg reguł|MIGRATE-AND-TRANSFORM|TAK|NIE|TAK|TAK|**TAK**|moderation service/outbox|
|15|`gracz_newsletter_subscribers`|`newsletter_subscribers`,`newsletter_tokens` + current-state projections|MIGRATE-AND-TRANSFORM|**TAK**|kontrolowane w cutover|**TAK**|TAK|**HIGH**|newsletter API + mail worker/outbox|
|16|`gracz_password_reset_tokens`|`password_reset_tokens`|MIGRATE-AND-TRANSFORM|tylko ważne albo invalidate|NIE|opcjonalnie|krótka/security|TAK|reset-password endpoints|
|17|`gracz_registration_codes`|`registration_codes` albo funkcja wycofana|MIGRATE-AND-TRANSFORM / REPLACE po usage review|warunkowo|NIE|opcjonalnie|TAK wg TTL|TAK|registration flow|
|18|`gracz_role_changes`|`role_change_events`|MERGE|TAK|NIE; nowy canonical writer|TAK|TAK|**TAK**|RBAC admin endpoints/outbox/audit|
|19|`gracz_role_history`|`role_change_events`|MERGE|TAK|NIE; nowy canonical writer|TAK|TAK|**TAK**|RBAC admin endpoints/outbox/audit|
|20|`gracz_roles`|`roles`,`user_roles`|MIGRATE-AND-TRANSFORM|TAK|krótki controlled cutover|TAK|historia przez events|TAK|authorization/RBAC|
|21|`gracz_thousand_games`|`game_matches`,`game_match_players`,`game_match_events`,`game_match_snapshots`|MIGRATE-AND-TRANSFORM|TAK|NIE dla command path|TAK|game-history policy|TAK|Thousand match-runtime/outbox/realtime|
|22|`gracz_tournament_matches`|`tournament_matches` + `game_matches.match_id`|MIGRATE-AND-TRANSFORM|TAK|NIE preferowane|TAK|TAK|**TAK**|tournament orchestration/events|
|23|`gracz_tournament_players`|`tournament_registrations`|MIGRATE-AND-TRANSFORM|TAK|NIE preferowane|TAK|TAK|TAK|join/withdraw endpoints|
|24|`gracz_tournaments`|`tournaments`,`tournament_rounds`|MIGRATE-AND-TRANSFORM|TAK|NIE dla state transitions|TAK|TAK|**TAK**|start/report/advance workers/API|
|25|`newsletter_consent_history`|`newsletter_consents`|MIGRATE-AND-TRANSFORM|TAK|NIE; canonical writer|TAK|**TAK, prawna**|TAK|consent lifecycle/outbox|
|26|`newsletter_events`|`newsletter_events` V3|MIGRATE-AND-TRANSFORM|TAK|czasowo możliwe|TAK|TAK|TAK|event producers/analytics consumers|
|27|`newsletter_sources`|`newsletter_sources` V3|MIGRATE-AND-TRANSFORM|TAK|krótki controlled|TAK|TAK|TAK/re-key|newsletter attribution API|
|28|`newsletter_subscriber_sources`|`newsletter_subscriber_sources` V3|MIGRATE-AND-TRANSFORM|TAK|krótki controlled|TAK|TAK|**TAK/re-key**|attribution writers|

Wynik klasyfikacji bazowej pozostaje zgodny z Iteracją 1: 25 MIGRATE-AND-TRANSFORM, 2 MERGE, 1 DEPRECATE. `REPLACE` przy `gracz_registration_codes` jest wyłącznie wariantem końcowym, jeżeli usage review potwierdzi wycofanie funkcji; do tego czasu tabela pozostaje MIGRATE-AND-TRANSFORM.

# CZĘŚĆ A — IDENTITY & AUDIT

## 3. `gracz_accounts` -> `users` + `user_profiles`

### Klucze
- legacy `user_id` -> `users.user_id`; preferowane zachowanie stabilnego ID, jeśli data profiling potwierdzi zgodność,
- wszystkie FK/logiczne referencje innych kontekstów muszą zostać zweryfikowane przed cutover,
- jeśli re-key okaże się konieczny, powstaje trwała tabela/artefakt migracyjny `legacy_user_id -> user_id`; nie wykonujemy rozproszonego re-key bez mapy.

### Kolumny/semantyka
- credential/auth fields -> `users`,
- dane profilowe/display -> `user_profiles`,
- email/username -> jawne normalized values + UNIQUE na kanonicznej wartości,
- status legacy -> V3 status przez zatwierdzoną tabelę mappingu, nie przez zgadywanie,
- password hash migruje 1:1 tylko jeśli algorytm/parametry są wspierane; w przeciwnym razie rehash-on-login/forced reset,
- historyczne timestamps zachować, brakujących nie syntetyzować.

### Constraints
V3 dodaje FK/UNIQUE/CHECK/version zgodnie z Iteracją 4. Constraints uruchamiać po raporcie orphan/duplicate/normalization collisions.

## 4. `gracz_auth_sessions`

Aktywne sesje można:
- zmigrować tylko po potwierdzeniu formatu token hash/lifecycle,
- albo jawnie unieważnić przy cutover i wymagać ponownego logowania.

Nie migrujemy wygasłych sesji jako aktywnych. Nowy model wymaga token hash, expiry/revocation i indeksów active/expiry.

## 5. `gracz_mfa`

- user relation -> `mfa_credentials.user_id`,
- sekret migruje wyłącznie po potwierdzeniu formatu i możliwości bezpiecznej decrypt/re-encrypt,
- nie kopiować plaintext do logów, audit, outbox ani plików migracyjnych,
- jeśli credential nie jest bezpiecznie kompatybilny, oznaczyć do re-enrollment zamiast tworzyć fikcyjną poprawną konfigurację.

## 6. `gracz_password_reset_tokens` i `gracz_registration_codes`

Ephemeral credentials nie wymagają pełnego historycznego backfillu. Preferencja:
- wygasłe -> nie migrować do aktywnego V3,
- ważne reset tokens -> migrować tylko przy kompatybilnym hash/TTL albo invalidate,
- registration codes -> najpierw usage review; jeśli funkcja pozostaje, migracja do V3; jeśli nie, REPLACE/expire + archive metadata zgodnie z polityką.

## 7. `gracz_roles` -> `roles` + `user_roles`

Legacy current-role representation jest transformowana do:
- słownika `roles`,
- bieżących przypisań `user_roles`.

Role codes muszą mieć jawny mapping. Nie tworzymy kilku równoległych RBAC models.

## 8. MERGE `gracz_role_changes` + `gracz_role_history`

Oba źródła -> `role_change_events`.

Reguły:
1. zachować `source_system` i stabilny `source_record_id`,
2. zachować target user, actor, reason, timestamp i role snapshots,
3. z `previous_role -> new_role` wyprowadzać granularne revoke/assign eventy tylko gdy semantyka jest jednoznaczna,
4. nie deduplikować wyłącznie po timestamp/user; potrzebny fingerprint/provenance i data profiling,
5. brak mapowalnego role FK -> `role_id=NULL`, zachować `role_code_snapshot`,
6. current `user_roles` jest budowany z wiarygodnego current state, a nie ślepo z ostatniego eventu, dopóki chronology obu źródeł nie zostanie zweryfikowana.

## 9. `gracz_audit_log`

Mapowanie semantyczne do `audit_log`:
- legacy event/audit ID -> provenance; V3 `audit_id` może zachować UUID, jeśli typ zgodny,
- actor -> `actor_user_id` tylko przy wiarygodnym mappingu,
- action/event type -> `action`,
- subject/target -> `target_type`,`target_id`,
- request/correlation jeśli istnieje -> odpowiednie pola,
- legacy payload/details -> allowlisted `payload`, po redakcji sekretów,
- timestamp -> `occurred_at`.

Nie migrujemy sekretów tylko dlatego, że istnieją w legacy JSON/text.

## 10. `gracz_audit_log_legacy_1787562123031`

**DEPRECATE** z bramkami:
1. policzyć rekordy i zakres dat,
2. ustalić overlap z `gracz_audit_log`,
3. ustalić aktywnych readers/writers,
4. sklasyfikować dane pod retencję/compliance,
5. wybrane rekordy migrować tylko jeśli mapping jest wiarygodny i nie tworzy duplikatu,
6. pozostałe -> immutable/read-only archive,
7. DROP dopiero po expiry retention + backup restore test + formal approval.

# CZĘŚĆ B — GAME PLATFORM

## 11. `gracz_game_sessions` — Warcaby

### Stan -> current match
- `game_id` -> `game_matches.match_id` przez deterministic mapping/preserved ID, jeśli typ pozwala; V3 UUID może wymagać mapy legacy ID,
- `state TEXT` -> walidowany JSON -> `game_matches.state`/`game_match_snapshots.state`,
- `created_at`,`updated_at` -> timestamps,
- produkcyjne `version INTEGER` jest wejściem migracyjnym, **nie dowodem historycznego CAS**.

### Historia/events
Nie wolno syntetyzować pełnego `game_match_events` z samego current JSON, jeśli ruchy nie są dostępne jako wiarygodne źródło. Backfill tworzy:
- current match,
- snapshot migracyjny,
- ewentualnie `migration.imported` event,
nie fikcyjny strumień ruchów.

### Cutover
Warcaby wymagają jednego punktu przełączenia writerów. Nie dopuszczamy równoległego legacy last-write-wins i V3 match-actor na tym samym meczu.

## 12. `gracz_thousand_games` — Tysiąc

- legacy `game_id` -> V3 match mapping,
- `players JSONB` -> `game_match_players` po walidacji,
- `state JSONB` -> current state/snapshot,
- `revision BIGINT` -> wejściowa `version`, po walidacji invariantów,
- timestamps zachować,
- istniejący optimistic CAS jest wartościową semantyką, ale writer przechodzi na wspólny match-runtime.

Jak w Warcabach: brak pełnego historycznego event logu nie daje prawa do generowania fikcyjnych move events.

## 13. Gomoku

Gomoku nie jest jedną z 28 tabel — AS-IS jest memory-only. Nie ma backfillu PostgreSQL. ETAP 3 wdraża trwałość bezpośrednio w kanonicznym Game Platform V3.

# CZĘŚĆ C — TOURNAMENT

## 14. `gracz_tournaments`

- zachować tournament ID, jeśli kompatybilny; inaczej jawna mapa ID,
- core fields/status/owner/game -> V3 po mappingu,
- V3 `version` rozpoczyna się od kontrolowanej wartości migracyjnej; nie przypisujemy legacy concurrency semantics, których nie było,
- historyczne round state rozdzielić do `tournament_rounds` tylko z dowodliwych danych.

## 15. `gracz_tournament_players`

-> `tournament_registrations`:
- tournament/user IDs -> mapy kanoniczne,
- registration/seed/status -> mapować po data profiling,
- wykryć duplikaty przed PK `(tournament_id,user_id)`,
- participant cap jest invariantem nowych komend; historycznych rekordów nie kasujemy automatycznie, jeśli legacy race przekroczył limit — raportujemy konflikt.

## 16. `gracz_tournament_matches`

-> `tournament_matches`:
- tournament/round/board/status/result -> V3,
- najważniejsze: `match_id -> game_matches.match_id` tylko jeśli powiązanie da się wiarygodnie odtworzyć,
- brak dowodu -> `legacy_unlinked` w raporcie migracyjnym / kontrolowana nullable faza expand; nie tworzyć fikcyjnego meczu,
- po backfill i naprawie danych constraint docelowy zostaje zaostrzony.

# CZĘŚĆ D — MESSAGING

## 17. `gracz_messages`

-> `private_messages` + dwa `private_message_user_state`.

- `message_id` zachować, jeśli UUID,
- sender/recipient -> nullable FK do `users` + snapshot IDs,
- encrypted subject/body -> ciphertext V3 wyłącznie po crypto compatibility test; inaczej staged decrypt+reencrypt,
- read state -> recipient state,
- archived/deleted booleans -> stan per-user; **nie wymyślać historycznego timestampu**, jeśli legacy ma tylko boolean,
- legacy account `ON DELETE CASCADE` nie przechodzi do V3.

## 18. `gracz_message_attachments`

- legacy message relation -> V3 message,
- istniejący jeden attachment -> nowy `attachment_id`,
- ciphertext/iv/auth_tag/file metadata -> zachować tylko po walidacji formatu/AAD/key version,
- brak kompatybilności -> kontrolowana re-encryption migration,
- nie rozszerzać historycznych danych o fikcyjne attachments.

# CZĘŚĆ E — GLOBAL CHAT & SOCIAL

## 19. `gracz_chat_topics`

- utworzyć kanoniczny global channel,
- legacy topic -> `chat_topics`,
- owner -> user FK jeśli mapowalny + snapshot,
- title/description/category/status/timestamps zachować semantycznie,
- topic/channel relation otrzymuje V3 FK/constraint.

## 20. `gracz_global_chat`

-> `chat_messages` + `chat_reactions`.

- message ID/body/time/reply/topic -> zachować po validation,
- author -> nullable user FK + display snapshot,
- reactions JSONB -> relacyjne `(message,user,reaction_code)`; invalid/orphan entries do raportu, nie do FK na siłę,
- deleted boolean bez czasu -> nie tworzyć fałszywego `deleted_at`; użyć migration provenance/controlled marker lub osobnej decyzji mappingowej,
- current message dostaje version; nie przypisujemy historycznej CAS semantics.

## 21. `gracz_chat_friends`

-> `social_friendships`:
- para zostaje kanonizowana `low/high`,
- A->B i B->A mogą kolidować po nowym UNIQUE; rozstrzygnięcie na podstawie status/timestamps/provenance,
- requester musi należeć do pary,
- nie arbitralnie scalać sprzecznych block/pending/accepted states.

## 22. `gracz_global_chat_reports`

Faza 1: -> `chat_reports`, zachowując legacy report/message/reporter/reason/time i UNIQUE semantics.

Faza 2: `chat.report_submitted` -> idempotentny `moderation_reports` z `source_context/source_record_id`.

Nie wykonujemy bezpośredniego dual-write Chat + Moderation jako dwóch niezależnych transakcji.

# CZĘŚĆ F — MODERATION

## 23. `gracz_moderation_decisions`

-> przede wszystkim `moderation_actions`:
- decision ID -> source provenance,
- user/context/outcome/reason/content_hash/time zachować,
- outcome -> `automated_allow` / `automated_block` po jawnej mapie,
- brak aktora -> system/migration semantics, nie fikcyjny moderator,
- case tworzyć tylko dla rekordów wymagających workflow, np. powiązane appeal/report według zatwierdzonych reguł,
- `content_hash=NULL` pozostaje NULL, jeśli legacy go nie zapisał.

## 24. `gracz_moderation_appeals`

-> `moderation_appeals`:
- appeal ID i timestamps zachować,
- legacy `decision_id` -> mapping do V3 action,
- appellant/reviewer -> users tylko gdy mapowalne,
- status -> jawna mapa,
- nie wymyślać review outcome,
- legacy CASCADE decision->appeal nie przechodzi do V3.

Persistent `moderation_sanctions`, cases/evidence/manual actions są nowym V3. Nie backfillujemy historycznych banów/mute bez źródła.

# CZĘŚĆ G — NEWSLETTER

## 25. `gracz_newsletter_subscribers` — HIGH drift

To najbardziej wymagający backfill.

### Canonical identity
- legacy PK `subscriber_id UUID` jest preferowanym V3 `subscriber_id`, jeśli data quality pozwala,
- nowsze `id BIGINT UNIQUE` pozostaje legacy provenance, nie drugim canonical ID,
- `email_normalized` jest kanonicznym kluczem unikalności; przed constraintem wykonać collision report.

### Current state
- `email`, normalized email, nick, status, timestamps -> `newsletter_subscribers`,
- status `'active'` i nowsze lifecycle values wymagają jawnej tabeli mappingu,
- `consent_at` vs `consented_at`: nie wybierać arbitralnie; profilować oba pola i regułę provenance,
- `preferred_nick` 32 vs V3 24: przed migracją raport overflow; nie obcinać po cichu,
- `consent_version` 32 vs V3 64 jest bezpieczne typowo jako rozszerzenie, ale wartości nadal walidować.

### Tokeny
- plaintext/UUID `unsubscribe_token` nie jest kopiowany do V3 jako plaintext,
- hash fields (`confirmation_token_hash`,`position_token_hash`,`unsubscribe_token_hash`) -> `newsletter_tokens` tylko z poprawnym purpose/lifecycle,
- legacy public token można unieważnić i wydać nowy zamiast utrwalać słabszy model.

### History
Nie generujemy historii zgód wyłącznie z current-state pól, jeśli istnieją dedykowane `newsletter_consent_history` i `newsletter_events`. Current timestamps mogą dać migration provenance, ale nie zastępują prawnej historii.

## 26. `newsletter_sources`

- source ID wymaga re-key BIGINT/legacy -> UUID V3, jeśli Iteracja 5 UUID zostaje finalna,
- `code` jest stabilnym semantycznym kluczem,
- name/description/type/active/timestamps zachować,
- zbudować `legacy_source_id -> source_id` przed migracją attribution/events/consents.

## 27. `newsletter_subscriber_sources`

- subscriber ID -> canonical UUID mapping,
- source ID -> source mapping,
- attribution timestamps/metadata zachować,
- UNIQUE/PK `(subscriber_id,source_id)` może ujawnić duplikaty po re-key; dedupe tylko deterministycznie z raportem,
- FK RESTRICT zachować jako właściwą ochronę historii attribution.

## 28. `newsletter_consent_history`

-> `newsletter_consents`:
- każdy legacy rekord staje się append-only consent record,
- legacy ID -> source provenance,
- subscriber/source -> mapy V3,
- action/version/time/metadata -> zachować,
- dedupe zabezpiecza DB-level `UNIQUE(source_system,source_record_id)`,
- nie łączyć consent z operational event tylko dla uproszczenia.

## 29. `newsletter_events`

-> `newsletter_events` V3:
- event ID zachować, jeśli UUID/kompatybilny, inaczej provenance + new UUID,
- subscriber/source nullable relations mapować,
- event type/time/metadata zachować po allowlist/redaction,
- correlation/command mogą pozostać NULL dla legacy, jeśli nie istniały,
- provider telemetry nie jest automatycznie dowodem consent.

# CZĘŚĆ H — NOWE V3 BEZ LEGACY TABLE

## 30. Tabele tworzone jako fundament, nie backfill 1:1

Nie mają jednego odpowiednika w 28 tabelach:
- `outbox_events`,
- `idempotency_keys` / processed-message semantics,
- `game_definitions`,
- `game_match_events` jako natywny przyszły event stream,
- `game_match_snapshots` jako jawny model,
- `tournament_rounds`,
- `chat_channels`,
- `chat_message_events`,
- `moderation_cases`,
- `moderation_sanctions`,
- `moderation_evidence`,
- `newsletter_tokens`,
- `security_events` i inne V3 append-only streams, jeśli brak odpowiadającego legacy źródła.

Zasada: **brak legacy danych nie jest powodem do tworzenia fikcyjnego backfillu**.

# CZĘŚĆ I — KOLEJNOŚĆ MIGRACJI

## 31. Faza 0 — preflight

Przed pierwszym DDL migracyjnym:
1. świeży schema-only dump i data backup,
2. inventory writerów/readers/endpoints/workers,
3. counts wszystkich 28 tabel,
4. PK uniqueness i orphan FK/logical-reference report,
5. duplicate/collision reports,
6. zakresy dat/retencja,
7. crypto compatibility tests,
8. ustalenie maintenance/cutover strategy,
9. rollback owner i kryteria stop/go.

## 32. Faza 1 — V3 foundation

Tworzymy:
- Identity canonical IDs/tables potrzebne jako referencje,
- `outbox_events`, idempotency,
- podstawowe V3 dictionaries/definitions,
- migration mapping/provenance artefacts.

Nie przełączamy jeszcze produkcyjnych writerów.

## 33. Faza 2 — Identity/RBAC/Audit

Kolejność:
1. users/profiles,
2. roles/user_roles,
3. role history MERGE,
4. sessions/MFA/tokens według cutover policy,
5. canonical audit + archive policy.

Po walidacji Identity IDs można bezpiecznie backfillować FK pozostałych kontekstów.

## 34. Faza 3 — Game Platform + Tournament

1. game definitions,
2. Warcaby/Tysiąc current-state + snapshots/players,
3. trwały Gomoku dla nowych sesji,
4. tournament core/registrations/rounds,
5. tournament-match -> canonical match links,
6. match-actor writer cutover per game.

Najważniejsza bramka: nie wolno mieć dwóch skutecznych writerów tego samego aktywnego match.

## 35. Faza 4 — Messaging/Chat/Moderation

1. private messaging shadow/backfill + crypto verification,
2. chat channels/topics/messages/reactions/social,
3. chat reports,
4. moderation actions/appeals history,
5. Moderation V3 cases/sanctions workflow dla nowych operacji,
6. endpoint/realtime cutover.

## 36. Faza 5 — Newsletter

Newsletter ma osobną bramkę ze względu na HIGH drift:
1. source/subscriber profiling,
2. canonical subscriber mapping,
3. source re-key,
4. attribution,
5. consents/events,
6. token normalization,
7. V3 subscribe/confirm/unsubscribe writer,
8. mail worker via outbox,
9. observation/reconciliation,
10. legacy freeze.

## 37. Faza 6 — contract/deprecate

Dopiero po observation window:
- zatrzymać legacy readers,
- odebrać legacy write permissions,
- pozostawić read-only rollback window,
- archiwizować zgodnie z retencją,
- DROP tylko po formalnym approval i restore-tested backup.

# CZĘŚĆ J — WALIDACJA I ROLLBACK

## 38. Minimalny zestaw walidacji per tabela

Dla każdego backfillu zapisać artefakt z:
- source count,
- migrated count,
- skipped count + reason,
- conflict/quarantine count,
- PK/source provenance uniqueness,
- orphan count przed/po,
- checksum/hash dla bezpiecznych pól lub deterministycznych projekcji,
- min/max timestamps,
- invariant checks,
- próbki semantyczne.

Dla encrypted payload nie porównujemy plaintext w logach; używamy kontrolowanego decryptability/integrity testu.

## 39. Reconciliation w okresie przejściowym

Jeśli temporary compatibility write jest konieczny:
- jeden canonical command ID,
- jeden orchestrator/writer,
- oba skutki mierzone,
- reconciliation job wykrywa rozjazd,
- metryka mismatch = 0 jest warunkiem cutover,
- dual-write ma datę usunięcia i nie staje się architekturą stałą.

## 40. Rollback

Rollback jest fazowy:
- przed writer cutover: usunąć/odtworzyć shadow bez wpływu na legacy,
- po writer cutover, przed legacy freeze expiry: feature flag może wrócić tylko po sprawdzeniu kompatybilności delta,
- po zmianach nieodwracalnych: wymagany forward-fix lub restore według runbooka.

Nigdy nie wykonujemy DROP source przed zakończeniem rollback window.

## 41. Warunki GO/NO-GO przed produkcyjnym cutover

GO wymaga jednocześnie:
- 28/28 tabel sklasyfikowanych i objętych planem,
- zero niewyjaśnionych critical orphan/collision,
- zgodne counts/invariants,
- test backup restore,
- test rollback,
- nowe endpointy/workery gotowe,
- outbox lag i consumer health w normie,
- brak podwójnego match writera,
- newsletter reconciliation bez HIGH drift mismatch,
- crypto compatibility potwierdzone,
- security review sekretów i permissions.

## 42. Status Iteracji 8

**MACIERZ 28/28 — ZAKOŃCZONA PROJEKTOWO.**

Każda rzeczywista tabela Render ma:
- bounded context V3,
- decyzję migracyjną,
- docelowy model,
- zasady kluczy/transformacji,
- backfill/cutover strategy,
- archiwizację/retencję tam, gdzie wymagane,
- wpływ na endpointy/workery/eventy.

Następny krok nie jest jeszcze wykonaniem migracji produkcyjnej. Najpierw powstaje **PostgreSQL V3 FINAL** — dokument konsolidujący zatwierdzony model z Iteracji 1–8 oraz formalne kryteria zamknięcia części modelu danych ETAPU 2.
