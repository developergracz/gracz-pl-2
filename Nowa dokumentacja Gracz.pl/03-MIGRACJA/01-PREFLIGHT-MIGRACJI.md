# ETAP 3 — Preflight migracji Gracz.pl

Data: 28.08.2026
Status: **ETAP 3 — PLAN MIGRACJI / Iteracja 1 — PREFLIGHT**

## 1. Cel dokumentu

Preflight jest pierwszą bramką wykonawczą przed przygotowaniem i uruchomieniem migracji PostgreSQL V3.

Nie wykonuje jeszcze:
- produkcyjnego `CREATE/ALTER/DROP`,
- backfillu danych,
- przełączenia endpointów,
- dual-write,
- cutover writerów,
- migracji workerów,
- zmiany ruchu produkcyjnego.

Jego celem jest udowodnienie, że znamy rzeczywisty stan środowiska, danych, writerów/readers, zależności, sekretów, mechanizmów backup/restore oraz ryzyk potrzebnych do bezpiecznego wejścia w DDL i backfill.

Źródła normatywne:
- `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md`,
- `02-BAZA-DANYCH/19-POSTGRESQL-V3-ITERACJA-8-MACIERZ-MIGRACJI-28-AS-IS-DO-V3.md`,
- szczegółowe Iteracje PostgreSQL V3 2–7,
- rzeczywisty Render PostgreSQL jako źródło stanu środowiskowego.

## 2. Zasada nadrzędna ETAPU 3

**Nie rozpoczynamy destrukcyjnej ani nieodwracalnej migracji, dopóki preflight nie ma statusu GO.**

Wszystkie obserwacje preflight muszą być sklasyfikowane:
- **PASS** — potwierdzone i gotowe,
- **WARNING** — ryzyko znane, ma zaakceptowany plan obsługi,
- **BLOCKER** — migracja nie może przejść do odpowiedniego kolejnego kroku,
- **NOT VERIFIED** — brak dowodu; nie wolno traktować jako PASS.

## 3. Zakres preflight — 15 bramek

1. Freeze źródeł dokumentacyjnych i commitów.
2. Świeży snapshot schematu PostgreSQL.
3. Pełny backup danych.
4. Test odtworzenia backupu.
5. Row counts i rozmiary 28 tabel.
6. Integralność PK/UNIQUE/FK i logical references.
7. Duplicate/collision profiling.
8. Data-quality i zakresy wartości/statusów.
9. Inventory writerów/readers/endpoints.
10. Inventory workerów/eventów/realtime.
11. Crypto compatibility i key/version inventory.
12. Identity/key mapping readiness.
13. Active-state inventory: mecze, turnieje, sesje, newsletter, sankcje.
14. Security/credentials/DB permissions.
15. Rollback, maintenance window i GO/NO-GO.

# CZĘŚĆ A — BASELINE I FREEZE

## 4. Freeze dokumentacji i kodu odniesienia

Przed wygenerowaniem pierwszego executable DDL zapisujemy:
- commit zawierający PostgreSQL V3 FINAL,
- commit macierzy migracji 28/28,
- commit bieżącego `main`, z którego będzie tworzony plan migracji kodu,
- commit/tag/branch reprezentujący stan produkcyjnego kodu podczas preflight,
- identyfikator środowiska Render użytego do pobrania dumpu i danych diagnostycznych.

Wynik preflight powinien zawsze wskazywać konkretny zestaw commitów. Zmiana kodu produkcyjnego w trakcie ETAPU 3 wymaga oceny, czy wpływa na writer/read path lub schemat i czy baseline trzeba odświeżyć.

### PASS
Baseline commitów i środowiska jest zapisany.

### BLOCKER
Nie potrafimy jednoznacznie wskazać, jaki kod i jaka baza są migrowane.

# CZĘŚĆ B — POSTGRESQL ENVIRONMENT SNAPSHOT

## 5. Świeży schema snapshot

Poprzedni dump potwierdził 28 tabel. Preflight wymaga **nowego** snapshotu wykonawanego możliwie blisko rozpoczęcia migracji.

Minimalny artefakt:

```bash
pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > gracz-preflight-schema.sql
```

Nie zapisujemy `DATABASE_URL` ani hasła w repozytorium/logach.

Należy porównać nowy dump z wcześniej zatwierdzonym AS-IS i oznaczyć:
- nowe/usunięte tabele,
- nowe/usunięte kolumny,
- type/default/nullability drift,
- PK/FK/UNIQUE/CHECK drift,
- index drift,
- sequence/identity drift,
- trigger/function drift, jeśli występują.

### PASS
Różnice są zerowe albo każda różnica ma opis i wpływ migracyjny.

### BLOCKER
Nieznany drift dotyczący tabel objętych migracją.

## 6. Wersja PostgreSQL i rozszerzenia

Zapisujemy:
- `SELECT version();`
- `SHOW server_version;`
- listę rozszerzeń z `pg_extension`,
- timezone i istotne ustawienia wymagane przez migration scripts,
- encoding/collation tam, gdzie wpływa na normalized uniqueness/sortowanie.

Jest to szczególnie ważne przed użyciem PostgreSQL-specific funkcji/constraintów.

# CZĘŚĆ C — BACKUP I RESTORE

## 7. Pełny backup danych

Przed pierwszym DDL/backfillem wymagany jest świeży backup danych i schematu.

Minimalny standard:
- backup wykonany poza repozytorium,
- zaszyfrowany lub chroniony zgodnie z polityką dostępu,
- oznaczony timestampem i środowiskiem,
- checksum/size zapisany w artefakcie operacyjnym,
- znany owner odpowiedzialny za restore.

Samo istnienie automatycznego backupu dostawcy nie jest wystarczającym dowodem, jeśli nie potwierdzono sposobu odtworzenia.

## 8. Restore test

Wymagany kontrolowany test restore do odrębnego środowiska/test DB.

Po restore sprawdzamy co najmniej:
- liczba tabel,
- row counts wybranych krytycznych tabel,
- podstawowe FK/PK,
- możliwość odczytu zaszyfrowanych danych przez testowy kod z właściwymi kluczami,
- możliwość uruchomienia read-only smoke tests.

### BLOCKER krytyczny
Backup istnieje, ale nie ma potwierdzonego restore path.

# CZĘŚĆ D — INVENTORY 28 TABEL

## 9. Row counts i rozmiary

Dla każdej z 28 tabel zapisujemy:
- `COUNT(*)`,
- rozmiar danych,
- rozmiar indeksów,
- najstarszy/najnowszy timestamp, jeśli istnieje sensowna kolumna czasowa,
- szacowany czas backfillu,
- batch-key nadający się do migracji porcjami.

Artefakt wynikowy: tabela `28/28` z kolumnami:

| AS-IS | row_count | table_size | index_size | time_range | batch_key | risk |
|---|---:|---:|---:|---|---|---|

Nie wolno planować batch sizes wyłącznie na podstawie nazw tabel.

## 10. PK/UNIQUE/FK/orphan report

Przed utworzeniem V3 constraints wykonujemy raport:
- duplikaty przyszłych PK/UNIQUE,
- orphan FK istniejących relacji,
- orphan logical references tam, gdzie AS-IS nie ma FK,
- NULL w polach mających stać się NOT NULL,
- invalid enum/status values względem V3 CHECK,
- rekordy naruszające cross-table invariants.

Szczególnie sprawdzamy:
- normalized email/username collisions,
- role history mappings,
- chat topic/message/reply relations,
- friendship A↔B duplicates,
- reactions z nieistniejącymi user/message,
- tournament round/board collisions,
- tournament -> game match linkage,
- newsletter normalized-email collisions,
- subscriber/source mappings,
- moderation decision/appeal orphan relations.

## 11. Quarantine policy

Preflight musi ustalić jeden standard dla danych, których nie można automatycznie zmigrować:
- `MIGRATE`,
- `TRANSFORM`,
- `QUARANTINE`,
- `ARCHIVE`,
- `SKIP-WITH-APPROVAL`.

Każdy skipped/quarantined rekord musi mieć reason code i provenance. Nie kasujemy ani nie „naprawiamy” danych bez raportu.

# CZĘŚĆ E — PROFILING KRYTYCZNYCH KONTEKSTÓW

## 12. Identity

Preflight Identity obejmuje:
- format i uniqueness `user_id`,
- email/username normalization collisions,
- status values,
- password-hash algorithms/parameters,
- profile field compatibility,
- active session count,
- reset-token validity windows,
- registration-code usage,
- MFA format/algorithm/key compatibility,
- role current-state mappings,
- chronology i overlap `gracz_role_changes` + `gracz_role_history`.

### BLOCKER
Nieznany sposób bezpiecznego mapowania `user_id`, ponieważ większość V3 FK zależy od Identity.

## 13. Game Platform

Dla `gracz_game_sessions` i `gracz_thousand_games`:
- active/completed counts,
- valid JSON state rate,
- state schema variants,
- legacy ID format,
- participant extraction feasibility,
- `version`/`revision` distributions,
- active matches wymagające specjalnego cutover,
- reconnect behavior podczas migration window.

Nie generujemy fikcyjnego event streamu z current state.

Preflight musi ustalić, czy aktywne mecze:
- zostaną dokończone na legacy przed cutover,
- zostaną przeniesione do V3,
- albo zostanie zastosowany maintenance/drain strategy.

### BLOCKER krytyczny
Brak gwarancji jednego writera dla aktywnego meczu w momencie cutover.

## 14. Tournament

Sprawdzamy:
- active/open/running tournaments,
- participant duplicates,
- seed duplicates,
- round/board collisions,
- status variants,
- możliwość odtworzenia `tournament_matches.match_id -> game_matches.match_id`,
- rekordy historyczne bez wiarygodnego game match link.

Brak linku historycznego nie jest automatycznie blockerem, jeśli V3 expand phase pozwala zachować jawnie `legacy_unlinked`; musi jednak być policzony i opisany.

## 15. Messaging

Sprawdzamy:
- liczbę wiadomości i załączników,
- orphan attachments,
- format ciphertext subject/body,
- format AES-GCM iv/auth_tag/ciphertext,
- legacy AAD variants,
- dostępność key material/key version mapping,
- decryptability sample test w kontrolowanym środowisku,
- sender/recipient accounts, w tym deleted/orphan users,
- read/archive/delete boolean distribution.

### Zakaz
Plaintext prywatnych wiadomości nie trafia do raportów preflight, logów ani GitHuba.

### BLOCKER krytyczny
Nie potrafimy bezpiecznie odczytać i przenieść istniejącego ciphertext ani świadomie zdecydować o zachowaniu legacy encrypted format.

## 16. Global Chat & Social

Sprawdzamy:
- topics/messages counts,
- orphan topic/reply/user relations,
- deleted-message distribution,
- JSON reactions shape i invalid values,
- A↔B friendship duplicates,
- status variants,
- report -> message/reporter integrity,
- realtime subscriber/presence implementation w aktualnym deployu.

Preflight ustala plan przejścia z process-local SSE/presence do V3 realtime infrastructure, ale nie wdraża go jeszcze.

## 17. Moderation

Sprawdzamy:
- decision counts/outcomes/contexts/reasons,
- `content_hash` NULL ratio,
- appeals per decision,
- appeal statuses/reviewer mappings,
- chat report counts,
- czy istnieją poza dokumentowanym kodem realne sankcje/ban state wymagające migracji.

Jeżeli środowisko ujawni dodatkowy persistent ban/mute model, jest to **schema/runtime drift** i wraca do oceny przed dalszym planem Moderation.

## 18. Newsletter — HIGH drift gate

Newsletter ma osobną obowiązkową bramkę:
- collision report `email_normalized`,
- mapowanie legacy `subscriber_id UUID` vs `id BIGINT`,
- status distribution (`active`, lifecycle values itd.),
- `consent_at` vs `consented_at` consistency,
- nick length >24 count,
- consent_version values/length,
- plaintext legacy `unsubscribe_token` count,
- hashed token lifecycle counts,
- source/subscriber-source FK integrity,
- consent duplicate candidates,
- event/source orphan counts,
- pending-confirmation age distribution.

### BLOCKER krytyczny
Nieustalony canonical subscriber mapping lub normalized-email collisions bez planu resolution.

# CZĘŚĆ F — WRITERS, READERS, ENDPOINTS, WORKERS

## 19. Writer inventory

Dla każdej z 28 tabel identyfikujemy wszystkie ścieżki zapisu w repozytorium:
- INSERT,
- UPDATE,
- DELETE,
- UPSERT,
- migrations/boot-time schema creation,
- cron/job/worker writes.

Artefakt:

| tabela AS-IS | writer file/function | endpoint/job | transaction boundary | cutover owner |
|---|---|---|---|---|

### BLOCKER
Istnieje niezinwentaryzowany writer mogący nadal zapisywać po cutover.

## 20. Reader inventory

Analogicznie identyfikujemy:
- API reads,
- admin reads,
- ranking/statistics queries,
- realtime reads,
- background jobs,
- health/analytics queries.

Reader cutover może nastąpić później niż writer cutover, ale musi być jawny.

## 21. Endpoint inventory

Każdy mutating endpoint dostaje:
- bounded context,
- AS-IS table/write path,
- docelową command/service V3,
- idempotency requirement,
- authz/RBAC requirement,
- feature flag/cutover strategy,
- rollback behavior.

## 22. Worker/event inventory

Sprawdzamy:
- istniejące mail workers/jobs,
- realtime broadcast path,
- ranking/statistics jobs,
- moderation jobs,
- cleanup/retention jobs,
- tournament advancement jobs,
- jakiekolwiek async retry mechanisms.

ETAP 3 później przypisze im docelowe outbox event contracts i cutover kolejność.

# CZĘŚĆ G — SECURITY I UPRAWNIENIA

## 23. Credentials i secret hygiene

Przed migracją:
- zweryfikować i w razie potrzeby zrotować poświadczenia PostgreSQL,
- zweryfikować klucze szyfrowania Messaging/MFA,
- upewnić się, że sekrety nie znajdują się w repozytorium, dokumentacji, logach ani migration artifacts,
- przygotować oddzielne credentials dla migration runnera,
- zastosować least privilege.

Żaden dokument GitHub nie zawiera connection stringów ani sekretów.

## 24. DB permissions

Docelowo rozdzielamy co najmniej role logiczne:
- migration/DDL role,
- application runtime role,
- outbox worker role,
- read-only diagnostics/audit role tam, gdzie potrzebna.

Preflight dokumentuje aktualne możliwości bez rozszerzania ich „na wszelki wypadek”.

### BLOCKER
Migrację można wykonać tylko kontem o niekontrolowanych, współdzielonych credentials bez możliwości audytu/rotacji.

# CZĘŚĆ H — WYDAJNOŚĆ I LOCKING

## 25. Lock-risk assessment

Dla każdego przyszłego DDL oceniamy:
- czy wymaga table rewrite,
- czy blokuje writes/reads,
- przewidywany czas na bieżącym rozmiarze,
- czy constraint można dodać etapowo (`NOT VALID` + validate) tam, gdzie to zgodne z PostgreSQL i planem,
- czy index tworzymy normalnie czy `CONCURRENTLY`, jeśli plan ETAPU 3 to dopuści,
- wpływ na free-tier/zasoby Render.

Preflight nie wybiera jeszcze konkretnych commands DDL, ale klasyfikuje tabele wg ryzyka lock/time.

## 26. Capacity

Zapisujemy:
- bieżący rozmiar DB,
- wolny limit/storage plan,
- przewidywany koszt shadow tables,
- dodatkowy koszt indeksów,
- temporary double-storage podczas backfillu,
- connection/CPU constraints środowiska.

### BLOCKER
Brak miejsca/zasobów na shadow + indeksy + bezpieczny rollback window.

# CZĘŚĆ I — CUTOVER I ROLLBACK READINESS

## 27. Maintenance/drain strategy

Preflight musi wybrać dla każdego kontekstu jedną klasę:
- online expand/backfill/cutover,
- short write pause,
- drain active sessions/matches,
- maintenance window.

Nie musi być jedna strategia dla całego systemu.

Game Platform może wymagać innego okna niż Newsletter czy Audit.

## 28. Feature flags

Przed ETAPEM 3 DDL/cutover należy potwierdzić możliwość kontrolowania co najmniej:
- V3 read path,
- V3 write path,
- V3 match runtime,
- V3 newsletter writer/mail worker,
- V3 chat/realtime,
- V3 moderation workflow.

Jeśli aktualny kod nie ma odpowiednich flag, plan kodu ETAPU 3 musi je dodać **przed** produkcyjnym przełączeniem.

## 29. Rollback readiness

Każdy kontekst musi mieć:
- ostatni bezpieczny punkt rollback,
- dane potrzebne do delta/reconciliation,
- ownera decyzji rollback,
- maksymalny dopuszczalny observation window przed contract/drop,
- metryki wykrywające konieczność rollbacku.

Nie wolno traktować backup restore jako jedynego codziennego rollbacku dla każdego problemu aplikacyjnego.

# CZĘŚĆ J — GO / NO-GO

## 30. Preflight GO criteria

ETAP 3 może przejść do **Planu DDL migracji** dopiero gdy:

- [ ] baseline commitów i środowiska jest zapisany,
- [ ] świeży schema dump jest porównany,
- [ ] backup istnieje,
- [ ] restore test przeszedł,
- [ ] 28/28 tabel ma aktualny row_count/size,
- [ ] duplicate/orphan/collision reports są wykonane,
- [ ] Identity ID mapping jest rozstrzygnięty,
- [ ] crypto compatibility Messaging/MFA jest potwierdzone albo istnieje bezpieczny re-enrollment/re-encryption plan,
- [ ] Game Platform active-match cutover strategy jest wybrana,
- [ ] Newsletter HIGH-drift profiling jest zamknięty,
- [ ] wszystkie writery/readers są zinwentaryzowane,
- [ ] endpoint/worker inventory jest kompletne,
- [ ] credentials/permissions są bezpieczne,
- [ ] capacity wystarcza na shadow/backfill/indexes,
- [ ] rollback/maintenance/feature-flag strategy jest wykonalna,
- [ ] brak otwartych BLOCKERÓW.

## 31. NO-GO conditions

Automatyczny NO-GO występuje m.in. gdy:
- backup nie jest odtwarzalny,
- nie znamy wszystkich produkcyjnych writerów,
- istnieje niewyjaśniony schema drift,
- Identity mappings mają kolizje bez planu,
- encrypted data nie mają bezpiecznej ścieżki migracji,
- active match może mieć dwóch writerów,
- newsletter subscriber identity jest niejednoznaczne,
- brakuje storage/capacity na bezpieczną migrację,
- rollback nie jest wykonalny,
- konieczne sekrety lub permissions nie mogą być bezpiecznie zarządzane.

# CZĘŚĆ K — ARTEFAKTY WYJŚCIOWE PREFLIGHT

## 32. Obowiązkowe artefakty

Preflight powinien zakończyć się utworzeniem następujących artefaktów wykonawczych:

1. `02-PREFLIGHT-ENVIRONMENT-BASELINE.md`
2. `03-PREFLIGHT-28-TABLE-DATA-PROFILE.md`
3. `04-PREFLIGHT-WRITERS-READERS-ENDPOINTS-WORKERS.md`
4. `05-PREFLIGHT-INTEGRITY-CONFLICTS-QUARANTINE.md`
5. `06-PREFLIGHT-SECURITY-CRYPTO-BACKUP-RESTORE.md`
6. `07-PREFLIGHT-GO-NO-GO.md`

Nie wszystkie wymagają ręcznego tworzenia oddzielnie, jeśli wyniki zostaną automatycznie wygenerowane później; nazwy definiują jednak zakres dowodów.

## 33. Następny krok

Preflight **został rozpoczęty**, ale nie może być oznaczony jako GO wyłącznie na podstawie dokumentacji repozytorium.

Następny wykonawczy krok to zebranie rzeczywistych danych środowiskowych:

**ETAP 3 / Preflight — Environment Baseline + 28-table Data Profile.**

Dopiero po uzyskaniu rzeczywistych counts, integrity/collision reports, backup/restore evidence i writer inventory przygotowujemy executable **Plan DDL migracji**.
