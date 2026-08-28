# PostgreSQL V3 FINAL — konsolidacja i zatwierdzenie modelu danych Gracz.pl

Data: 28.08.2026
Status: **ETAP 2 — FINAL / ZATWIERDZONY MODEL ARCHITEKTONICZNY**

## 1. Cel dokumentu

Ten dokument jest formalną konsolidacją i zatwierdzeniem PostgreSQL V3 z Iteracji 1–8. **Nie wprowadza nowych tabel, nowych bounded contexts, nowych kontraktów ani nowych decyzji domenowych.**

Szczegółowe DDL, PK/FK/UNIQUE/CHECK, indeksy i kontrakty pozostają normatywnie zdefiniowane w dokumentach Iteracji 2–7. Macierz Iteracji 8 pozostaje normatywnym źródłem mapowania 28 tabel AS-IS -> V3. Ten dokument scala ich wynik i ustala status końcowy ETAPU 2.

PostgreSQL V3 FINAL jest zatwierdzeniem architektury danych, **nie deklaracją, że tabele V3 istnieją już na produkcji** i nie jest zgodą na wykonanie DROP/ALTER/DML bez planu ETAPU 3.

## 2. Normatywny zestaw dokumentów ETAPU 2

1. `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md` — Backend V3.
2. `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` — Iteracja 1 / mapa modelu.
3. `13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md` — Game Platform + Outbox + Idempotency.
4. `14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md` — Tournament.
5. `15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md` — Identity & Access + Role/Audit.
6. `16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md` — Newsletter.
7. `17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md` — Messaging + Global Chat & Social.
8. `18-POSTGRESQL-V3-ITERACJA-7-MODERATION.md` — Moderation.
9. `19-POSTGRESQL-V3-ITERACJA-8-MACIERZ-MIGRACJI-28-AS-IS-DO-V3.md` — końcowa macierz migracji 28/28.

W razie potrzeby wykonawczego DDL obowiązuje dokładna definicja z właściwej iteracji; niniejsze zestawienie nie zastępuje jej skróconą wersją.

# CZĘŚĆ A — FINALNE BOUNDED CONTEXTS I OWNERSHIP

## 3. Identity & Access

Właściciel:
- tożsamości,
- credential lifecycle,
- sesji,
- MFA,
- bieżących ról i przypisań,
- security events.

Kanoniczne tabele zatwierdzone w Iteracji 4:
- `users`,
- `user_profiles`,
- `auth_sessions`,
- `password_reset_tokens`,
- `registration_codes` — jeżeli funkcja pozostaje wymaganiem produktu zgodnie z usage review,
- `mfa_credentials`,
- `roles`,
- `user_roles`,
- `role_change_events`,
- `security_events`.

Zatwierdzone invarianty:
- `users.user_id` jest kanonicznym ID użytkownika,
- email i username mają normalized UNIQUE,
- credential/token secrets nie trafiają do audytu/outbox w plaintext,
- bieżące role są w `user_roles`, historia jest append-only w `role_change_events`,
- `gracz_role_changes` i `gracz_role_history` są źródłami MERGE do jednego V3 streamu z provenance.

## 4. Audit

Kanoniczna tabela:
- `audit_log`.

Zatwierdzone:
- append-only contract,
- actor/action/target/result/correlation,
- allowlist/redaction payload,
- ograniczenie zwykłego UPDATE/DELETE przez uprawnienia DB,
- kontrolowana retencja/archiwizacja,
- legacy audit nie jest usuwany przed analizą overlap/retention/dependencies i restore-tested backup.

## 5. Game Platform

Kanoniczne tabele Iteracji 2:
- `game_definitions`,
- `game_matches`,
- `game_match_participants`,
- `game_match_events`,
- `game_match_snapshots`,
- `match_actor_leases`.

Zatwierdzone:
- jeden `match_id` = jeden logiczny writer,
- PostgreSQL jest durable source of truth,
- `game_matches.version` jest aktywnym CAS contract,
- ownership jest per-match,
- fencing token chroni przed stale writer/split-brain,
- Warcaby, Tysiąc i Gomoku mają wspólny persistence/runtime contract przy niezależnych silnikach reguł,
- Realtime nie jest źródłem prawdy,
- snapshot nie konkuruje z current aggregate state,
- nie wymagamy pełnego event sourcingu jako warunku V3.

Normatywne PK/FK/CHECK/UNIQUE/indeksy pozostają dokładnie z Iteracji 2, w tym m.in. `UNIQUE(match_id,sequence_no)`, kontrakt wersji, seat uniqueness i indeksy operacyjne.

## 6. Tournament

Kanoniczne tabele Iteracji 3:
- `tournaments`,
- `tournament_registrations`,
- `tournament_rounds`,
- `tournament_matches`.

Zatwierdzone:
- lifecycle turnieju ma version/CAS,
- `join/start/report_result/advance_round/finish/cancel` są kontrolowanymi operacjami transakcyjnymi,
- participant duplicate i seed collision są blokowane DB-level,
- `(tournament_id,round_no)` jest UNIQUE,
- `(round_id,board_no)` jest UNIQUE,
- `tournament_matches.match_id` wskazuje kanoniczny `game_matches.match_id` i jest UNIQUE, gdy nie-NULL,
- rekomendowany złożony FK `round_id + tournament_id` chroni przed cross-tournament mismatch,
- Tournament nie aktualizuje bezpośrednio `game_matches.state`.

## 7. Messaging

Kanoniczne tabele Iteracji 6:
- `private_messages`,
- `private_message_user_state`,
- `private_message_attachments`.

Zatwierdzone:
- subject/body pozostają szyfrowane aplikacyjnie,
- załączniki zachowują authenticated encryption contract,
- klucze szyfrujące pozostają poza tabelami,
- stan read/archive/delete jest niezależny per użytkownik,
- usunięcie konta nie powoduje automatycznego skasowania wiadomości drugiej strony,
- physical purge jest osobnym retencyjnym workerem/policy,
- send + user states + outbox + idempotency tworzą jeden logiczny sukces.

## 8. Global Chat & Social

Kanoniczny model Iteracji 6 obejmuje:
- `chat_channels`,
- `chat_topics`,
- `chat_messages`,
- `chat_reactions`,
- `social_friendships`,
- `chat_reports`,
- `chat_message_events` tam, gdzie został zdefiniowany jako historia operacji.

Zatwierdzone:
- kanał jest kontenerem domenowym, topic opcjonalnym wątkiem,
- reactions są relacyjne/atomowe, nie JSON whole-object RMW,
- friendship ma jeden kanoniczny rekord nieuporządkowanej pary,
- presence/subscriptions są shared ephemeral state, nie obowiązkowym PostgreSQL source of truth,
- DB commit poprzedza publikację realtime przez Outbox,
- report intake jest przekazywany do Moderation idempotentnie, bez niekontrolowanego cross-context dual-write.

## 9. Moderation

Kanoniczne tabele Iteracji 7:
- `moderation_cases`,
- `moderation_reports`,
- `moderation_actions`,
- `moderation_sanctions`,
- `moderation_appeals`,
- `moderation_evidence`.

Zatwierdzone:
- case jest workflow, nie mechanicznym odpowiednikiem każdego AS-IS decision,
- reports są intake z provenance,
- actions są append-only,
- sanctions są current enforcement state,
- appeals są first-class history,
- evidence ma jawne reguły minimalizacji/ochrony danych,
- Moderation nie wykonuje niekontrolowanych UPDATE w tabelach innych bounded contexts,
- hide/delete treści oraz global account ban są realizowane przez kontrakt właściciela kontekstu + outbox/correlation,
- nie tworzymy fikcyjnego historycznego ban/mute backfillu, którego AS-IS nie potwierdza.

## 10. Newsletter

Kanoniczne tabele Iteracji 5:
- `newsletter_subscribers`,
- `newsletter_tokens`,
- `newsletter_sources`,
- `newsletter_subscriber_sources`,
- `newsletter_consents`,
- `newsletter_events`.

Opcjonalne elementy kampanii nie są wymagane do migracji obecnego newslettera i nie są dodawane przez FINAL.

Zatwierdzone:
- jeden canonical `subscriber_id`,
- `email_normalized` jako canonical uniqueness key,
- current subscriber state oddzielony od append-only consent history,
- public tokens wyłącznie jako hash,
- attribution oddzielone od lifecycle,
- subscribe/confirm/unsubscribe są versioned/idempotent transactions,
- email delivery następuje po COMMIT przez outbox/worker,
- usunięcie Identity account nie kasuje automatycznie dowodu zgody,
- HIGH drift `gracz_newsletter_subscribers` wymaga profilowania i kontrolowanego backfill/cutover.

# CZĘŚĆ B — WSPÓLNY FUNDAMENT TRANSAKCYJNY

## 11. Transactional Outbox

Kanoniczna tabela:
- `outbox_events`.

Obowiązuje DDL Iteracji 2 wraz z PK, CHECK status/attempt, indeksami dispatch/aggregate/published i polami correlation/causation.

Finalna zasada:
**zmiana stanu agregatu + wymagany event outbox są jednym commitem PostgreSQL.**

Publisher działa at-least-once. Konsumenci są idempotentni. Realtime/email/side effects nie są wykonywane jako nieodwracalna część transakcji HTTP przed COMMIT.

## 12. Idempotency

Kanoniczny mechanizm:
- `idempotency_keys`,
- dla wysokowolumenowych konsumentów dopuszczony w Iteracji 2 wyspecjalizowany `processed_messages` o równoważnej semantyce.

Obowiązuje UNIQUE/PK `(context,idempotency_key)` oraz request-hash semantics: ten sam klucz z innym request payload jest konfliktem, a retry poprawnej komendy nie wykonuje skutku biznesowego ponownie.

## 13. CAS/versioning

Version jest aktywnym elementem kontraktu tam, gdzie iteracje go definiują, w szczególności:
- `users`,
- `game_matches`,
- `tournaments`,
- `tournament_rounds`,
- `tournament_matches`,
- `private_messages` / mutable chat aggregates zgodnie z Iteracją 6,
- `moderation_cases`,
- `moderation_sanctions`,
- `newsletter_subscribers`.

`UPDATE ... WHERE version = expected_version` zwracający zero wierszy oznacza konflikt, nie sukces.

## 14. Fencing i split-brain

Obowiązuje model `match_actor_leases` z rosnącym fencing tokenem. Stary writer nie może zatwierdzić zapisu po przejęciu ownership przez nowego ownera.

Iteracja 2 pozostawiła wariant technicznego egzekwowania tokenu (np. token także w `game_matches` albo transakcyjne porównanie z lease row) do zamknięcia przed implementacją. FINAL **nie zmienia tej decyzji ani nie wybiera nowego wariantu**; zachowuje bezwzględny invariant architektoniczny. Konkretna implementacja jest zadaniem planu/ADR ETAPU 3 przed uruchomieniem writerów V3.

# CZĘŚĆ C — PK/FK/UNIQUE/CHECK I INDEKSY

## 15. Zasada finalna

Wszystkie PK/FK/UNIQUE/CHECK i indeksy zapisane w Iteracjach 2–7 są zatwierdzonym projektem PostgreSQL V3. FINAL ich nie redefiniuje ani nie modyfikuje.

W szczególności zatwierdzone są klasy ochrony:
- normalized identity uniqueness,
- canonical current-role uniqueness,
- match participant/seat uniqueness,
- match event ordering/version constraints z Iteracji 2,
- tournament registration/seed/round/board/match uniqueness,
- messaging party-state constraints,
- chat relation/reaction constraints,
- moderation status/type/scope/provenance constraints,
- newsletter email/source/provenance/token constraints,
- append-only provenance dedupe przez `source_system/source_record_id` tam, gdzie zdefiniowano.

Indeksy są częścią projektu i obejmują query paths status/time, user/time, target/time, expiry, active-state partial indexes, outbox dispatch i idempotency expiry zgodnie z dokumentami źródłowymi.

Przed wykonaniem CREATE UNIQUE/FK w ETAPIE 3 wymagane są preflight duplicate/orphan/collision reports z Iteracji 8. Zatwierdzenie constraintu jako V3 target nie oznacza, że wolno go nałożyć na nieoczyszczone legacy dane bez walidacji.

# CZĘŚĆ D — GRANICE CROSS-CONTEXT

## 16. Ownership

Finalne zasady:
- jedna tabela ma jednego bounded-context ownera,
- obcy kontekst nie wykonuje bezpośredniego write do jej stanu domenowego,
- hard FK jest używany tam, gdzie iteracje jawnie go zatwierdziły i wspólna baza daje właściwą granicę integralności,
- polimorficzne moderation targety pozostają logicznymi cross-context references walidowanymi przez application service,
- side effects między kontekstami przechodzą przez command/application contract lub outbox event,
- read projections mogą być odbudowywalne i idempotentne.

# CZĘŚĆ E — RETENCJA, ARCHIWIZACJA I BEZPIECZEŃSTWO

## 17. Retencja

Finalnie zatwierdzone zasady, bez dodawania nowych okresów czasowych:
- audit/history/consent podlegają jawnej polityce retencji i kontrolowanej archiwizacji,
- legacy audit nie jest kasowany automatycznie,
- expired auth/reset/idempotency/outbox data podlega dedykowanym cleanup policies,
- private-message physical purge respektuje stan obu stron oraz hold/audit/legal requirements,
- Moderation evidence/sanctions/cases podlegają policy/legal hold,
- Newsletter consent evidence nie jest kasowane przypadkowym account CASCADE,
- game/tournament history ma osobną politykę historyczną.

Dokładne okresy, których wcześniejsze iteracje nie zatwierdziły, nie są wymyślane w FINAL i muszą zostać skonfigurowane przed produkcyjnym wdrożeniem.

## 18. Dane wrażliwe

- hasła pozostają hashami,
- session/reset/public tokens jako hash zgodnie z kontraktem,
- odzyskiwalne MFA secrets jako ciphertext,
- private message content pozostaje ciphertext,
- encryption keys poza tabelami,
- audit/outbox/logi nie zawierają sekretów ani prywatnego plaintext bez jawnej podstawy,
- migracja crypto wymaga compatibility/integrity testu bez ujawniania plaintext w logach.

# CZĘŚĆ F — FINALNA MIGRACJA 28 AS-IS -> V3

## 19. Status macierzy

Macierz `19-POSTGRESQL-V3-ITERACJA-8-MACIERZ-MIGRACJI-28-AS-IS-DO-V3.md` jest integralną częścią PostgreSQL V3 FINAL.

Pokrycie: **28/28 rzeczywistych tabel Render**.

Klasyfikacja bazowa:
- 25 × MIGRATE-AND-TRANSFORM,
- 2 × MERGE (`gracz_role_changes`, `gracz_role_history`),
- 1 × DEPRECATE (`gracz_audit_log_legacy_1787562123031`),
- `gracz_registration_codes` może przejść do REPLACE wyłącznie po usage review potwierdzającym wycofanie funkcji.

## 20. Zatwierdzona kolejność migracyjna

Bez zmian względem Iteracji 8:
1. preflight,
2. V3 foundation,
3. Identity/RBAC/Audit,
4. Game Platform + Tournament,
5. Messaging + Chat + Moderation,
6. Newsletter,
7. observation/reconciliation,
8. contract/deprecate legacy.

Każdy etap ma rollback window. Legacy source nie jest niszczony przed stabilizacją, weryfikacją i formalnym approval.

## 21. Zasady backfill

- zachować stabilne ID, jeśli typ/jakość pozwala; w przeciwnym razie jawna mapa re-key,
- provenance musi pozwalać wskazać source record,
- nie syntetyzować fikcyjnej historii game events z current JSON,
- nie syntetyzować historycznych Moderation sanctions,
- nie wymyślać timestampów, których legacy nie posiada,
- newsletter current state nie zastępuje dedykowanej historii consent,
- encrypted payload migruje tylko po crypto compatibility test,
- konflikty/orphans/collisions trafiają do raportu/quarantine, nie są „naprawiane” przez zgadywanie.

## 22. Dual-write / shadow / cutover

Preferowany wzorzec:
`expand -> shadow/backfill -> verify -> controlled compatibility (tylko gdy konieczne) -> writer cutover -> observe -> contract`.

Dual-write nie jest architekturą docelową. Jeśli wymagany przejściowo:
- jeden command ID,
- jeden orchestrator,
- idempotency,
- reconciliation,
- mismatch=0 jako warunek cutover,
- jawna data usunięcia ścieżki legacy.

# CZĘŚĆ G — TRANSAKCYJNE KONTRAKTY FINALNE

## 23. Wspólny wzorzec mutacji

Dla krytycznej komendy, zależnie od bounded contextu:
1. authorize/policy,
2. reserve/check idempotency,
3. lock/CAS/fencing właściwego agregatu,
4. validate invarianty,
5. zmień current state,
6. dopisz wymagany domain/history record,
7. dopisz audit, jeśli kontrakt tego wymaga,
8. dopisz `outbox_events`, jeśli istnieje skutek/event,
9. zapisz idempotency result,
10. COMMIT.

Po COMMIT publisher/workers/realtime wykonują skutki zewnętrzne idempotentnie.

## 24. Kontrakty domenowe zatwierdzone

- Game: command -> match actor -> engine -> version/fencing -> state/event/outbox.
- Tournament: join/start/report_result/advance_round z lock/CAS + outbox/idempotency.
- Identity/RBAC: role mutation + role event + audit + outbox atomowo.
- Newsletter: lifecycle + consent/event/token + outbox atomowo; email po COMMIT.
- Messaging: message + per-user state + outbox atomowo.
- Chat: message/reaction/social mutation + outbox; realtime po COMMIT.
- Moderation: case/action/sanction/appeal state + audit/outbox według kontraktu; cross-context enforcement przez event/application contract.

# CZĘŚĆ H — WALIDACJA I GO/NO-GO

## 25. Kryteria przed produkcyjną migracją

Obowiązują Iteracja 8 i wcześniejsze acceptance criteria:
- pełne counts wszystkich 28 źródeł,
- duplicate/orphan/collision report,
- invariant checks,
- source->target provenance,
- bezpieczne checksum/projection validation,
- crypto compatibility,
- backup restore test,
- rollback test,
- endpoint/worker/event readiness,
- outbox/consumer health,
- brak dwóch skutecznych writerów tego samego match,
- newsletter HIGH-drift reconciliation,
- security/permissions review.

## 26. Co jest finalne, a co nie jest jeszcze wykonane

### FINALNE w ETAPIE 2
- bounded contexts,
- ownership,
- docelowe tabele V3,
- DDL-style PK/FK/UNIQUE/CHECK i indeksy z Iteracji 2–7,
- CAS/versioning,
- single-writer/fencing invariant,
- Outbox/Idempotency,
- kontrakty transakcyjne,
- zasady bezpieczeństwa/retencji,
- macierz 28/28,
- kolejność i zasady migracji.

### NIE WYKONANO JESZ
- produkcyjnych migracji DDL/DML,
- backfillu danych,
- przełączenia endpointów/writerów,
- wdrożenia workerów V3,
- cutover,
- usunięcia legacy tabel.

To rozdzielenie jest celowe: ETAP 2 zatwierdza projekt; ETAP 3 zamienia go w bezpieczny plan wykonawczy i artefakty migracyjne.

## 27. Decyzje implementacyjne zachowane z iteracji

FINAL nie dodaje decyzji i nie ukrywa tych, które wcześniejsze dokumenty świadomie odłożyły do implementacji/ADR, np. dokładnego wariantu egzekwowania fencing tokenu, szczegółowych okresów retencji tam, gdzie nie zostały ustalone, czy opcjonalnych rozszerzeń produktu.

Nie są to braki w definicji celu V3: invarianty i granice są zatwierdzone. Konkretne mechanizmy implementacyjne muszą zostać wybrane **przed odpowiadającym im wdrożeniem w ETAPIE 3**, bez zmiany zatwierdzonej semantyki V3.

# CZĘŚĆ I — FORMALNE ZAMKNIĘCIE ETAPU 2

## 28. Wynik

**PostgreSQL V3 FINAL: ZATWIERDZONY.**

**Backend V3: ZATWIERDZONY.**

**Macierz migracji 28 AS-IS -> V3: ZATWIERDZONA.**

Na poziomie architektonicznym i projektowym model V3 jest spójny z udokumentowanym AS-IS i gotowy do przejścia do planowania wykonawczego.

## 29. ETAP 2

**STATUS: ZAMKNIĘTY 28.08.2026.**

Zamknięcie oznacza zatwierdzenie architektury docelowej i planu transformacji na poziomie modelu. Nie oznacza, że migracja produkcyjna została już wykonana.

## 30. Następny etap

**ETAP 3 — PLAN MIGRACJI I PRZYGOTOWANIE WYKONANIA.**

Pierwszy blok ETAPU 3 powinien przełożyć zatwierdzoną macierz na wykonawczą sekwencję:
- migracje DDL,
- backfill DML,
- migracje kodu/endpointów,
- eventy/outbox,
- workerzy,
- testy/reconciliation,
- cutover,
- rollback.

PostgreSQL V3 FINAL nie rozszerza tego planu — formalnie przekazuje zatwierdzony model do ETAPU 3.
