# ADR-V3-013 — Read Model Ownership, Checkpoint i Privacy-Safe Rebuild

Data: 31.08.2026  
Ścieżka docelowa: `Nowa dokumentacja Gracz.pl/09-DECYZJE-ARCHITEKTONICZNE/ADR-V3-013-READ-MODEL-OWNERSHIP-CHECKPOINT-REBUILD.md`  
Priorytet: `P0`  
Status: **PROPOSED / REVIEW PENDING / NOT IMPLEMENTED / FREEZE-SAFE**

> Ten ADR jest decyzją architektoniczną Gracz.pl V3. Nie potwierdza implementacji, nie autoryzuje deploymentu, nie uruchamia rebuildów i nie zmienia produkcji. Wszystkie elementy DDL, kontraktów i procedur są projektem wymagającym osobnej autoryzacji wykonawczej.

## 0. Obowiązujący stan

```text
SOURCE HEAD = c327dad4740f2fcbee385948f9e87f638405ff65
ADR-V3-004 = ACCEPTED / FINAL / NOT IMPLEMENTED
ADR-V3-012 = DESIGN COMPLETE / ARCHITECTURE PASS / PRIVACY-LEGAL REVIEW PENDING
ADR-V3-013 = PROPOSED / REVIEW PENDING / NOT IMPLEMENTED
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

## 1. Decyzja w jednym zdaniu

Gracz.pl V3 stosuje jawnie rejestrowane, należące do bounded contextów i wymienialne generacje read models, których projectory przetwarzają zatwierdzone źródła idempotentnie, zapisują zmianę projekcji, receipt i checkpoint atomowo, a każdy rebuild rozpoczyna się od privacy barrier obejmującej deletion ledger oraz privacy events, dzięki czemu nie może przywrócić danych wcześniej usuniętych lub ograniczonych.

## 2. Kontekst problemu

Platforma potrzebuje modeli odczytowych zoptymalizowanych dla:

- rankingów globalnych i per gra,
- standings turniejowych,
- list stołów, lobby i reconnect,
- wyszukiwania profili oraz graczy,
- inboxów, liczników i powiadomień,
- moderacyjnych kolejek roboczych,
- newsletter analytics,
- publicznych i administracyjnych dashboardów,
- przyszłego Pokera, historii rozdań oraz agregatów statystycznych.

Kanoniczny model domenowy nie powinien być deformowany pod każde zapytanie, ale read model nie może stać się drugim źródłem prawdy. Bez wspólnego kontraktu projekcje łatwo uzyskują:

- nieokreślonego właściciela,
- niedeterministyczny rebuild,
- checkpoint w pamięci procesu,
- pomijanie albo podwójne przetwarzanie eventów,
- publikację częściowo odbudowanej projekcji,
- niespójne cache i indeksy wyszukiwania,
- możliwość „wskrzeszenia” danych po privacy deletion,
- brak dowodu, że delete dotarł do wszystkich projekcji,
- zależność decyzji domenowej od nieaktualnego widoku eventual-consistent.

## 3. Źródła prawdy i dowody wejściowe

ADR opiera się na aktualnym `main` oraz pełnej treści:

- `01-ARCHITEKTURA/03-SKONSOLIDOWANA-ARCHITEKTURA-SYSTEMOWA-GRACZ-PL-V3.md`,
- `09-DECYZJE-ARCHITEKTONICZNE/ADR-V3-012-DATA-RETENTION-PRIVACY-DELETION-LEGAL-HOLD.md`,
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md`,
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md`,
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md`,
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md`,
- `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md`,
- `03-MIGRACJA/13-WRITER-READER-INVENTORY.md`,
- `03-MIGRACJA/14-WORKER-EVENT-REALTIME-INVENTORY.md`,
- `modern/checkers-engine/src/rankings.js`,
- `modern/checkers-engine/src/tournaments.js`,
- `modern/checkers-engine/src/realtime.js`.

Kod pozostaje źródłem prawdy dla AS-IS. Dokumenty V3 są źródłem projektu TARGET. Samo istnienie projektu nie dowodzi wdrożenia.

## 4. Stan AS-IS

### 4.1. Ranking

Aktualny `RankingService`:

- przy każdym odczycie skanuje zakończone `gracz_game_sessions` oraz `gracz_thousand_games`,
- sortuje zdarzenia według `updated_at`,
- oblicza rating i statystyki w pamięci procesu,
- dociąga nazwy z `gracz_accounts`,
- nie posiada trwałej tabeli projekcji,
- nie posiada checkpointu ani generacji rebuild,
- nie posiada receipt potwierdzającego privacy delete.

Jest to potwierdzony model AS-IS, a nie docelowy model V3.

### 4.2. Turnieje

Aktualny `TournamentService` przechowuje punkty, wins/draws/losses i Buchholz w tabeli uczestników oraz odczytuje je bez wspólnego frameworka projekcji. TARGET V3 przewiduje `tournament_standings` jako deterministycznie odbudowywalny read model z eventu `tournament.match_finished`.

### 4.3. Realtime

Aktualny `RealtimeHub` utrzymuje subskrypcje w pamięci jednej instancji i wysyła snapshoty SSE. Nie jest trwałym read modelem ani źródłem checkpointu.

### 4.4. Workery i eventy

Inwentarz AS-IS nie potwierdza wspólnego transactional outboxu, brokera ani frameworka projection workers. TARGET V3 definiuje outbox i idempotentnych konsumentów, lecz nie są one dowodem wdrożenia.

## 5. Zakres ADR

ADR rozstrzyga:

- kto posiada definicję, kod, dane i API read modelu,
- jakie źródła mogą zasilać projekcję,
- jak identyfikowane są pozycje/cursory,
- jak zapisywane są checkpointy i receipts,
- jak izolowane są generacje projekcji,
- jak wykonywany jest rebuild bez zatrzymywania zapisów domenowych,
- jak publikowana jest nowa generacja,
- jak obsługiwane są duplicate, gap, out-of-order i poison events,
- jak deletion ledger i privacy events chronią przed resurrection,
- jak ranking, search, cache i każdy read model potwierdzają delete,
- jak mierzone są lag, freshness, kompletność i zgodność,
- jakie testy oraz dowody są wymagane przed cutover.

## 6. Poza zakresem

ADR nie wybiera:

- konkretnego brokera zdarzeń,
- konkretnego silnika wyszukiwania,
- konkretnego distributed cache,
- konkretnego dashboard/observability providera,
- fizycznego podziału usług,
- szczegółowych okresów retencji — należą do ADR-V3-012,
- reguł domenowych ratingu, pairingu lub Pokera,
- harmonogramu implementacji,
- migracji produkcyjnej i jej autoryzacji.

## 7. Terminologia

| Termin | Znaczenie |
|---|---|
| Canonical source | autorytatywny stan lub zatwierdzony event domenowy |
| Read model | odbudowywalny widok zoptymalizowany dla odczytu |
| Projector | idempotentny konsument budujący read model |
| Projection manifest | wersjonowany kontrakt właściciela, źródeł, schematu, retencji i rebuild |
| Cursor | pozycja w uporządkowanym źródle |
| Checkpoint | trwałe potwierdzenie najwyższej bezpiecznie zastosowanej pozycji |
| Receipt | dowód zastosowania konkretnego eventu lub żądania privacy |
| Generation | izolowana instancja danych jednej wersji projekcji |
| Active generation | jedyna generacja udostępniana standardowym odczytom |
| Rebuild | pełne odtworzenie nowej generacji ze źródła autorytatywnego |
| Privacy barrier | minimalny watermark deletion ledger/holds/events, który rebuild musi uwzględnić |
| Resurrection | ponowne pojawienie się danych usuniętych, zanonimizowanych lub ograniczonych |
| Gap | brak oczekiwanej pozycji lub wersji w źródle |
| Poison event | event poprawnie dostarczony, ale niemożliwy do zastosowania przez projector |

## 8. Inwarianty nadrzędne

1. Read model nigdy nie jest autorytatywnym writerem stanu domenowego.
2. Każda projekcja ma dokładnie jednego accountable ownera.
3. Każdy manifest wskazuje jawne, wersjonowane źródło rebuild.
4. Outbox transportowy nie jest automatycznie bezterminowym event store.
5. Projector jest idempotentny względem `event_id` i pozycji źródła.
6. Zmiana projekcji, processed receipt i checkpoint są jednym logicznym commitem.
7. Checkpoint nie może wyprzedzić trwałej zmiany read modelu.
8. Checkpoint nie może wyprzedzić durable privacy receipt.
9. Rebuild odbywa się do nowej generacji, nie przez destrukcyjny truncate aktywnej.
10. Aktywna generacja zmienia się jednym kontrolowanym przełączeniem.
11. Rebuild nie może przywrócić danych objętych wykonanym delete/restrict/anonymize.
12. Projekcja nie przechowuje danych dłużej niż źródło, chyba że wynik jest nieodwracalnie anonimowy i jawnie zatwierdzony.
13. Cache i search są sinkami projekcji, a nie źródłami prawdy.
14. Krytyczna decyzja domenowa nie może zależeć od projekcji o niepotwierdzonej świeżości.
15. Brak registry/ledger/hold wymaganych do privacy powoduje `HOLD`, nie best-effort.

## 9. Model ownership

### 9.1. Role odpowiedzialności

| Rola | Odpowiedzialność | Nie może |
|---|---|---|
| Domain Source Owner | semantyka eventów, canonical state, kompatybilność źródła | zmieniać projekcji poza kontraktem |
| Projection Owner | manifest, projector, schema, API i SLO projekcji | zmieniać prawdy domenowej |
| Platform Event Owner | transport, pozycje, retry, quarantine | interpretować reguł biznesowych |
| Data/DB Owner | schema registry, backup, dostęp i wydajność | zatwierdzać privacy wyjątku samodzielnie |
| Privacy Owner | deletion contract, receipts, negative proof | implementować ukryte wyjątki retencji |
| Security Owner | least privilege, secrets, tamper evidence | omijać ownera domenowego |
| Rebuild Operator | uruchomienie zatwierdzonego runbooka | aktywować generacji bez gate |
| Independent Reviewer | walidacja counts/checksum/privacy | wykonywać nieudokumentowanego hotfixu |

### 9.2. Zasady

- Każda projekcja ma nazwę w formacie `<context>.<purpose>.<version>`.
- Accountable owner jest nazwany funkcjonalnie i przed implementacją osobowo.
- Zmiana event contract wymaga oceny wpływu na wszystkie manifesty.
- Projection Owner utrzymuje testy kompatybilności i rebuild runbook.
- Brak aktywnego ownera oznacza `NO-GO` dla nowej projekcji lub nowej wersji.

## 10. Projection manifest

Każdy read model posiada wersjonowany manifest zawierający co najmniej:

```yaml
projection_name: game.ranking.v1
owner_context: GamePlatform
accountable_owner: PENDING_ASSIGNMENT
source_contracts:
  - game.match.finished.v1
source_mode: EVENT_LOG
ordering_model: GLOBAL_POSITION
schema_version: 1
projector_version: 1
consistency: EVENTUAL
freshness_slo_seconds: PENDING_FORMAL_SLO
rebuild_source: CANONICAL_EVENT_JOURNAL
privacy_policy: RET-GAME-IDENTIFIED-036M
privacy_events:
  - privacy.subject_restricted.v1
  - privacy.subject_deleted.v1
  - privacy.subject_anonymized.v1
retention_not_longer_than_source: true
external_sinks:
  - cache
  - search_optional
```

Manifest jest reviewable artefaktem w repozytorium. Runtime registry może materializować jego bezpieczny podzbiór, ale nie może mieć odmiennej semantyki.

## 11. Klasy źródeł rebuild

Dozwolone są trzy klasy:

| Klasa | Zastosowanie | Wymaganie |
|---|---|---|
| `EVENT_LOG` | domena ma trwały, uporządkowany journal | pełny zakres retencji potrzebny do rebuild |
| `SNAPSHOT_PLUS_TAIL` | duży agregat z trwałym snapshotem i event tail | snapshot ma source watermark i checksum |
| `CANONICAL_SCAN` | domena nie jest event-sourced | powtarzalny snapshot/transaction cut i jawne sortowanie |

Niedozwolone jako jedyne źródło rebuild:

- aktywny read model,
- cache,
- search index,
- pamięć procesu,
- SSE/WebSocket history,
- wygasający outbox bez gwarantowanego zakresu,
- ręcznie wyeksportowany plik bez provenance i source watermark.

## 12. Event envelope i ordering

Minimalny envelope projekcyjny:

```text
event_id
event_type
event_schema_version
source_context
aggregate_type
aggregate_id
aggregate_version
source_partition
source_position
occurred_at
committed_at
correlation_id
causation_id
payload
privacy_classification
```

### 12.1. Pozycja

- `source_position` jest monotoniczny w granicy `source_partition`.
- Manifest wskazuje liczbę partycji i regułę przypisania agregatu.
- Wszystkie eventy jednego agregatu trafiają do tej samej partycji.
- `aggregate_version` wykrywa gap i out-of-order w agregacie.
- `event_id` zapewnia globalną deduplikację logiczną.

### 12.2. Projekcje order-sensitive

Ranking ELO i podobne algorytmy zależne od kolejności muszą wskazać deterministyczny porządek. Dopuszczalne są:

- pojedyncza partycja dla strumienia ratingowego,
- osobny kanoniczny `rating_sequence`,
- deterministyczny batch order zatwierdzony w manifeście.

`occurred_at` ani `updated_at` bez stabilnego tie-breakera nie są wystarczającym porządkiem.

### 12.3. Outbox a rebuild

Outbox służy niezawodnej publikacji i zgodnie z ADR-V3-012 może zostać usunięty po retencji. Dlatego:

- continuous projection może konsumować outbox/broker,
- pełny rebuild musi mieć osobny autorytatywny journal, snapshot+tail albo canonical scan,
- status `published` outboxa nie jest checkpointem projekcji,
- purge outboxa nie może usunąć jedynego źródła wymaganego do zatwierdzonego rebuild.

## 13. Registry projekcji

Docelowy logiczny model rejestru:

```sql
CREATE TABLE projection_definitions (
    projection_name       VARCHAR(160) PRIMARY KEY,
    owner_context         VARCHAR(96) NOT NULL,
    schema_version        INTEGER NOT NULL,
    projector_version     INTEGER NOT NULL,
    source_mode           VARCHAR(32) NOT NULL,
    ordering_model        VARCHAR(32) NOT NULL,
    privacy_policy_code   VARCHAR(96) NOT NULL,
    manifest_hash         VARCHAR(128) NOT NULL,
    status                VARCHAR(24) NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL
);
```

Statusy: `proposed`, `ready`, `active`, `deprecated`, `blocked`.

Ten DDL jest kontraktem projektowym, nie migracją zatwierdzoną do wykonania.

## 14. Generacje projekcji

Każdy rebuild tworzy nową generację:

```sql
CREATE TABLE projection_generations (
    generation_id         UUID PRIMARY KEY,
    projection_name       VARCHAR(160) NOT NULL,
    schema_version        INTEGER NOT NULL,
    projector_version     INTEGER NOT NULL,
    source_cut_position   BIGINT,
    privacy_barrier_id    UUID,
    status                VARCHAR(24) NOT NULL,
    started_at            TIMESTAMPTZ NOT NULL,
    validated_at          TIMESTAMPTZ,
    activated_at          TIMESTAMPTZ,
    retired_at            TIMESTAMPTZ,
    failure_code          VARCHAR(96),
    manifest_hash         VARCHAR(128) NOT NULL
);
```

Dozwolone przejścia:

```text
REQUESTED -> BUILDING -> CATCHING_UP -> VALIDATING -> READY
READY -> ACTIVE
ACTIVE -> RETIRED
BUILDING/CATCHING_UP/VALIDATING -> FAILED
READY -> ABORTED
```

Nie wolno oznaczyć generacji `ACTIVE` bez `READY` i formalnego activation gate.

## 15. Checkpoint

### 15.1. Model

```sql
CREATE TABLE projection_checkpoints (
    projection_name       VARCHAR(160) NOT NULL,
    generation_id         UUID NOT NULL,
    source_partition      VARCHAR(96) NOT NULL,
    last_position         BIGINT NOT NULL,
    last_event_id         UUID,
    last_aggregate_id     UUID,
    last_aggregate_version BIGINT,
    privacy_barrier_id    UUID,
    checkpointed_at       TIMESTAMPTZ NOT NULL,
    projector_version     INTEGER NOT NULL,
    PRIMARY KEY (projection_name, generation_id, source_partition)
);
```

### 15.2. Atomowość

Dla projekcji w PostgreSQL jedna transakcja obejmuje:

1. blokadę checkpointu partycji,
2. sprawdzenie pozycji i projector version,
3. deduplikację eventu,
4. zmianę w tabelach generacji read modelu,
5. zapis processed receipt,
6. zapis privacy receipt, jeśli event jest privacy,
7. przesunięcie checkpointu,
8. `COMMIT`.

Awaria przed `COMMIT` nie może przesunąć checkpointu. Retry po awarii ma być bezpieczny.

### 15.3. Zewnętrzny sink

Dla search/cache checkpoint jest per sink. Projector nie może ogłosić pełnego sukcesu, dopóki:

- durable task opisuje żądaną mutację,
- adapter potwierdzi wersję/generację,
- receipt zostanie zapisany,
- privacy receipt obejmuje ten sink.

Cache invalidation typu fire-and-forget nie spełnia kontraktu privacy completion.

## 16. Processed receipts i deduplikacja

```sql
CREATE TABLE projection_processed_events (
    projection_name       VARCHAR(160) NOT NULL,
    generation_id         UUID NOT NULL,
    event_id              UUID NOT NULL,
    source_partition      VARCHAR(96) NOT NULL,
    source_position       BIGINT NOT NULL,
    processed_at          TIMESTAMPTZ NOT NULL,
    result_code           VARCHAR(32) NOT NULL,
    PRIMARY KEY (projection_name, generation_id, event_id)
);
```

Reguły:

- duplicate tego samego `event_id` jest no-op z poprzednim wynikiem,
- ten sam position z innym `event_id` jest incidentem integralności,
- ten sam event z niezgodnym payload hash jest incidentem bezpieczeństwa,
- receipts są utrzymywane co najmniej do czasu, gdy checkpoint, snapshot i polityka replay gwarantują brak ponownego efektu,
- retencja receipts jest jawna w manifeście i spójna z ADR-V3-012.

## 17. Privacy barrier

### 17.1. Zasada

Każda generacja musi posiadać privacy barrier, która potwierdza:

- wersję polityki ADR-V3-012,
- cut deletion ledger,
- aktywne legal holds istotne dla projekcji,
- najwyższą trwałą pozycję privacy events,
- listę wymaganych projection/sink receipts bez PII.

### 17.2. Kolejność

Privacy event ma pierwszeństwo przed publikacją odpowiadających danych w generacji. W ramach jednej partycji:

```text
apply delete/restrict/anonymize
-> remove or transform projection rows
-> invalidate search/cache generation
-> persist per-sink receipt
-> persist projection privacy receipt
-> advance checkpoint
-> COMMIT
```

Checkpoint nie może zostać przesunięty, jeżeli receipt któregokolwiek obowiązkowego sinka pozostaje niepotwierdzony.

### 17.3. Rebuild

Rebuild otrzymuje deletion ledger oraz privacy events jako wejście, a nie jako późniejszy cleanup. Procedura:

1. pobierz zatwierdzony privacy barrier,
2. uruchom generację jako niewidoczną,
3. załaduj źródło do source cut,
4. zastosuj restriction/delete/anonymize najpóźniej w ich pozycji źródłowej,
5. przed walidacją ponownie pobierz privacy delta,
6. dograj event tail oraz privacy tail,
7. wykonaj negative proof,
8. dopiero potem zezwól na `READY`.

### 17.4. Anti-resurrection

- Snapshot read modelu nie jest privacy source of truth.
- Stary snapshot nie może ominąć deletion ledger.
- Jeżeli źródło nadal zawiera identyfikator pod prawidłową retencją, privacy filter usuwa lub pseudonimizuje go zgodnie z eventem/ledger.
- Jeżeli mapowanie identity zostało usunięte, rebuild używa zatwierdzonego opaque subject reference lub tombstone contractu; nie tworzy nowego odwracalnego lookupu.
- Po wygaśnięciu tombstone źródło identyfikowalne musi być już usunięte lub nieodwracalnie zanonimizowane zgodnie z ADR-V3-012.
- Niedostępny ledger albo hold registry powoduje `REBUILD HOLD`.

## 18. Projection privacy receipts

```sql
CREATE TABLE projection_privacy_receipts (
    request_id            UUID NOT NULL,
    projection_name       VARCHAR(160) NOT NULL,
    generation_id         UUID NOT NULL,
    sink_name             VARCHAR(96) NOT NULL,
    action_code           VARCHAR(32) NOT NULL,
    result_code           VARCHAR(32) NOT NULL,
    source_position       BIGINT,
    completed_at          TIMESTAMPTZ NOT NULL,
    receipt_hash          VARCHAR(128) NOT NULL,
    PRIMARY KEY (request_id, projection_name, generation_id, sink_name)
);
```

Tabela nie zawiera e-maila, loginu, display name, IP ani treści. Privacy Orchestrator zapisuje w `privacy_deletion_ledger` wynik bounded contextu dopiero po otrzymaniu wymaganych receipts.

## 19. Rebuild — pełna procedura

### R0 — autoryzacja

- zatwierdzony change record,
- named Projection Owner i Operator,
- manifest hash,
- source contract version,
- privacy barrier dostępny,
- capacity/disk budget,
- abort i cleanup plan.

### R1 — source cut

- ustal source high watermark,
- zapisz wszystkie partycje i pozycje,
- zapisz policy/hold/ledger watermarks,
- potwierdź retencję źródła dla pełnego rebuild.

### R2 — utworzenie generacji

- wygeneruj `generation_id`,
- utwórz izolowane tabele/index namespace,
- ustaw `BUILDING`,
- brak ruchu użytkownika do generacji.

### R3 — base load

- replay event log, snapshot+tail albo canonical scan,
- stosuj jeden wersjonowany projector,
- zapisuj checkpoints i receipts atomowo,
- poison event kieruj do quarantine bez fałszywego postępu.

### R4 — catch-up

- przejdź do source high watermark,
- konsumuj tail powstały podczas base load,
- utrzymuj rozdzielone checkpointy aktywnej i budowanej generacji,
- zmniejsz lag do progu manifestu.

### R5 — privacy synchronization

- pobierz delta deletion ledger i active holds,
- przetwórz privacy events,
- potwierdź wszystkie sink receipts,
- zablokuj `READY`, jeśli pozostaje niepotwierdzony delete.

### R6 — walidacja

- counts i rozkłady per source partition,
- checksum deterministycznych pól,
- invariants domenowe,
- duplicate/gap scan,
- shadow query comparison,
- privacy negative proof,
- freshness/lag,
- performance budget.

### R7 — activation gate

- wynik review `PASS`,
- jawna decyzja aktywacyjna,
- atomowa zmiana wskaźnika active generation,
- zapis audit event bez PII,
- możliwość natychmiastowego powrotu do poprzedniej generacji, jeżeli nie narusza to privacy.

### R8 — obserwacja

- error/lag/checksum metrics,
- porównanie wyników kluczowych queries,
- potwierdzenie cache/search,
- brak privacy regression.

### R9 — retirement

- poprzednia generacja przechodzi `RETIRED`,
- pozostaje niedostępna dla zwykłych readów,
- otrzymuje również privacy events w okresie rollback,
- cleanup następuje według manifestu i ADR-V3-012.

## 20. Aktywacja i routing

Logiczny wskaźnik:

```sql
CREATE TABLE active_projection_generations (
    projection_name       VARCHAR(160) PRIMARY KEY,
    generation_id         UUID NOT NULL,
    activated_at          TIMESTAMPTZ NOT NULL,
    activated_by_ref      VARCHAR(128) NOT NULL,
    decision_ref          VARCHAR(160) NOT NULL,
    version               BIGINT NOT NULL
);
```

Odczyt:

- rozwiązuje wyłącznie `ACTIVE` generation,
- nie przyjmuje identyfikatora generacji od niezaufanego klienta,
- może raportować bezpieczne metadata: schema version, generated/checkpoint time i freshness,
- nie przełącza automatycznie na `BUILDING` albo `FAILED`.

## 21. Publikacja i consistency contract

Każdy read endpoint deklaruje:

| Pole | Przykład |
|---|---|
| consistency | `EVENTUAL` / `BOUNDED_STALENESS` / `STRONG_FROM_CANONICAL` |
| max staleness | wartość zatwierdzona w SLO |
| source watermark | bezpieczna pozycja lub timestamp |
| projection version | manifest/schema version |
| unavailable behavior | fail, fallback canonical albo stale-with-warning |

Reguły:

- Swiss pairing nie może użyć niepotwierdzonego standings; używa canonical results albo zatwierdzonego spójnego snapshotu.
- Match winner nie pochodzi z rankingu.
- Sankcja i autoryzacja nie pochodzą z publicznej projekcji profilu.
- Privacy completion nie opiera się na braku wyniku w cache; wymaga receipt.
- Fallback do canonical source jest jawny, limitowany i obserwowalny.

## 22. Ranking

### 22.1. Ownership

- Source owner: Game Platform/Match Runtime.
- Projection owner: Game Platform Ranking.
- Wynik meczu pochodzi wyłącznie z zatwierdzonego `game.match.finished` lub równoważnego kanonicznego eventu.
- Ranking nie aktualizuje historii meczu.

### 22.2. Determinizm

- algorytm i parametry ratingu mają wersję,
- kolejność rating events ma stabilny `rating_sequence`,
- correction/reversal jest nowym eventem,
- ten sam source cut + manifest hash daje ten sam checksum,
- zmiana algorytmu tworzy nową generację, nie cichy rewrite.

### 22.3. Privacy

- `privacy.subject_restricted` natychmiast ukrywa publiczną pozycję,
- `privacy.subject_deleted` usuwa identyfikowalny wiersz i receipts dla cache/search,
- anonimowe statystyki mogą pozostać tylko według ADR-V3-012,
- rebuild nie może ponownie umieścić usuniętej osoby na liście,
- player endpoint po complete zwraca neutralne `not found`, chyba że inny jawny kontrakt wymaga ograniczonej informacji.

## 23. Tournament standings

- Source owner: Tournament.
- Źródłem są zatwierdzone wyniki połączone z kanonicznym match result.
- Projector jest idempotentny względem result event/correction event.
- Pairing kolejnej rundy wymaga spójnego watermarku obejmującego wszystkie mecze poprzedniej rundy.
- Privacy deletion anonimizuje uczestnika w historii według ADR-V3-012, ale nie zmienia wyniku sportowego innych osób.
- Rebuild ma testować points, wins/draws/losses, tie-break oraz liczbę rund.

## 24. Search, cache i listy publiczne

### Search

- indeks posiada nazwę generacji,
- bulk rebuild tworzy nowy indeks,
- alias jest przełączany po validation gate,
- delete receipt zawiera index generation i provider result hash,
- stary indeks jest blokowany dla query przed cleanup.

### Cache

- klucze zawierają projection/schema generation,
- invalidacja privacy jest durable taskiem z receipt,
- TTL jest zabezpieczeniem dodatkowym, nie jedynym delete mechanism,
- retired generation nie może pozostawać osiągalna przez stary namespace.

### Publiczne listy

- profil, ranking i player search respektują restriction w wymaganym czasie,
- count/agregat nie może umożliwiać odtworzenia usuniętej osoby,
- edge/CDN cache podlega temu samemu kontraktowi invalidacji.

## 25. Messaging, Chat, Newsletter, Moderation i Audit

| Projekcja | Owner | Privacy/rebuild requirement |
|---|---|---|
| Messaging inbox counters | Messaging | per-user state; brak plaintext w eventach projekcyjnych |
| Chat timeline/search | Chat | delete/edit/hold ordering, moderation restriction |
| Newsletter analytics | Newsletter | consent history nie jest kasowana jak current subscription |
| Moderation work queue | Moderation | evidence scope i legal hold mają pierwszeństwo |
| Audit dashboard | Audit | minimalizacja i pseudonimowy actor ref |

Read model nie może rozszerzyć zakresu danych źródłowych ani omijać ich polityki dostępu.

## 26. Przyszły Poker

ADR obowiązuje również przyszły Poker:

- hand result, pot settlement i tournament result są kanonicznymi eventami, nie wynikiem projekcji,
- table lobby, player stats i public leaderboard są read models,
- order-sensitive rating posiada stabilną sekwencję,
- anonimowa historia rozdań nie może umożliwiać reidentyfikacji,
- anti-cheat/collusion evidence jest osobnym zakresem Moderation z jawą retencją i hold,
- rebuild statystyk respektuje deletion ledger i nie przywraca publicznego profilu,
- ewentualna gra o realne pieniądze pozostaje poza zakresem i wymaga odrębnego programu prawnego oraz finansowego.

## 27. Poison event, gap i quarantine

### Poison event

- nie jest pomijany cicho,
- trafia do quarantine z event ref, schema version i bezpiecznym error code,
- checkpoint zatrzymuje się dla partycji, jeżeli kolejność ma znaczenie,
- możliwy jest zatwierdzony skip tylko przez jawny compensation/repair event,
- ręczna mutacja read modelu bez eventu jest zabroniona.

### Gap

- brak `source_position` lub `aggregate_version` zatrzymuje odpowiedni zakres,
- worker wykonuje bounded retry i source reconciliation,
- nie zgaduje brakującego payloadu,
- incydent jest mierzalny i audytowalny.

### Out-of-order

- event wcześniejszy niż checkpoint jest duplicate/no-op tylko po zgodnym receipt,
- przyszła pozycja z gap nie jest aplikowana, jeśli manifest wymaga ścisłej kolejności,
- niezależne partycje mogą postępować osobno, jeżeli semantyka projekcji na to pozwala.

## 28. Tryby awarii

| Awaria | Zachowanie wymagane |
|---|---|
| crash po update przed checkpoint | rollback jednej transakcji albo retry bez podwójnego efektu |
| checkpoint zapisany bez danych | niedopuszczalne; test/invariant alarmuje |
| duplicate delivery | receipt powoduje no-op |
| position collision | incident integralności, partycja zatrzymana |
| poison event | quarantine i brak fałszywego checkpointu |
| source retention krótsza od rebuild | `NO-GO`, niepełny rebuild zakazany |
| ledger/hold registry unavailable | privacy-sensitive processing `HOLD` |
| external search timeout | retry, brak końcowego privacy receipt |
| cache invalidation failed | request nie może być privacy `COMPLETED` |
| schema mismatch | generacja `FAILED`, aktywna bez zmian |
| checksum mismatch | brak activation |
| rebuild lag rośnie | throttle/abort według runbooka |
| aktywna generacja uszkodzona | jawny fallback lub rollback do privacy-current generation |
| stara generacja nie dostała delete | nie może być rollback targetem |
| restore bez ledger replay | środowisko `NO-GO` |

## 29. Restore

Po restore:

1. środowisko pozostaje izolowane,
2. przywróć registry i manifests,
3. odtwórz deletion ledger oraz active holds,
4. oznacz wszystkie projekcje jako niegotowe,
5. wykonaj ledger/hold replay do privacy barrier,
6. odbuduj albo zwaliduj każdą generację,
7. potwierdź search/cache receipts,
8. wykonaj negative proof,
9. dopiero po review zezwól na read traffic.

Backup read modelu może skrócić rebuild tylko wtedy, gdy ma source watermark, manifest hash, privacy barrier i checksum. Nie zastępuje źródła prawdy.

## 30. Uprawnienia i bezpieczeństwo

Role logiczne:

| Rola | Minimalny dostęp |
|---|---|
| Projector Runtime | read source stream, write wyłącznie własna generacja/checkpoint/receipt |
| Projection Reader | read wyłącznie active generation przez zatwierdzony contract |
| Rebuild Operator | create/build generation bez prawa samodzielnej aktywacji |
| Projection Activator | activation pointer po formalnym gate |
| Privacy Projector | apply opaque privacy event i zapisać receipt |
| Projection Auditor | read metadata/checksum/evidence bez PII |

Zasady:

- brak shared superusera dla wszystkich projection workers,
- query API nie eksponuje checkpoint internals niepotrzebnych klientowi,
- payload quarantine jest szyfrowany/minimalizowany i ma retencję,
- manifest i projector artifact mają provenance,
- aktywacja wymaga separation of duties dla krytycznych projekcji.

## 31. Obserwowalność

Minimalne metryki:

- `projection_lag_positions`,
- `projection_lag_seconds`,
- `projection_checkpoint_age_seconds`,
- `projection_events_processed_total`,
- `projection_duplicate_total`,
- `projection_gap_total`,
- `projection_quarantine_total`,
- `projection_rebuild_duration_seconds`,
- `projection_rebuild_progress_ratio`,
- `projection_validation_failure_total`,
- `projection_privacy_receipt_pending`,
- `projection_sink_error_total`,
- `projection_active_generation_info`.

Zakazane label fields:

- user ID, e-mail, nick, IP,
- message/attachment body,
- search query zawierające PII,
- subject HMAC,
- raw event payload.

Alerty muszą odróżniać lag zwykły, privacy lag, gap, quarantine i aktywację niezgodnej generacji.

## 32. SLI/SLO i readiness

Konkretne wartości SLO wymagają odrębnej formalnej decyzji. ADR ustala obowiązkowe kategorie:

| SLI | Gate |
|---|---|
| freshness | endpoint nie deklaruje zdrowia powyżej max staleness |
| completeness | source vs projection counts/checksum w dozwolonej tolerancji |
| privacy completion | zero wymaganych receipts pending dla zakończonego requestu |
| rebuild determinism | ten sam input/manifest daje ten sam wynik |
| availability | jawny fallback/degradation, bez fałszywych danych |
| recovery | rebuild/rollback mieści się w zatwierdzonym RTO |

Brak zatwierdzonego SLO nie może być zamaskowany arbitralnym progiem w kodzie.

## 33. Testy obowiązkowe

### 33.1. Unit

- deduplikacja `event_id`,
- walidacja aggregate version i source position,
- manifest/schema compatibility,
- deterministic ordering,
- privacy transformation,
- checkpoint state transitions,
- generation state machine.

### 33.2. Transactional integration

- projection update + receipt + checkpoint commit,
- rollback wszystkich trzech elementów,
- duplicate po crash/retry,
- poison event bez przesunięcia pozycji,
- wiele partycji bez cross-partition corruption.

### 33.3. Rebuild

- empty-to-current pełny replay,
- snapshot+tail,
- canonical scan z powtarzalnym source cut,
- catch-up przy trwających zapisach,
- schema/projector upgrade do nowej generacji,
- checksum i query shadow comparison,
- abort bez wpływu na aktywną generację.

### 33.4. Privacy

- deletion event przed base source event,
- deletion event po base load podczas catch-up,
- ledger entry obecny tylko w restore,
- aktywny hold blokujący purge,
- delete z niedostępnym search/cache,
- retired generation otrzymuje privacy event,
- rollback nie może wybrać privacy-stale generation,
- ranking/search/cache negative proof.

### 33.5. Concurrency

- rebuild vs new domain event,
- activation vs privacy delete,
- two projectors same partition,
- checkpoint lease/fencing conflict,
- projector version change podczas batcha,
- generation retirement vs rollback request.

### 33.6. Failure injection

- DB crash przed i po commit,
- broker redelivery,
- source gap,
- external sink timeout,
- disk full podczas index build,
- corrupted snapshot,
- ledger unavailable,
- manifest hash mismatch.

### 33.7. AS-IS regression

- ranking wynikowy porównany dla zamkniętego zakresu gier,
- tournament standings i pairings,
- player search/profile visibility,
- realtime reconnect snapshot,
- brak regresji praw drugiej strony wiadomości.

## 34. Evidence pack przed aktywacją

Pakiet zawiera co najmniej:

- manifest i jego hash,
- source HEAD/artifact provenance,
- projector version i schema version,
- source cut oraz checkpointy partycji,
- privacy barrier reference,
- counts/checksums,
- listę quarantine/gaps,
- test report,
- shadow comparison report,
- privacy negative proof,
- performance result,
- rollback target potwierdzony jako privacy-current,
- decyzję reviewerów i activation record.

Evidence nie zawiera PII, sekretów ani plaintext private content.

## 35. Migracja AS-IS → TARGET

1. zinwentaryzuj wszystkie read paths, cache, search i computed-on-read views,
2. przypisz ownera oraz manifest,
3. nazwij canonical source i rebuild mode,
4. dodaj stabilne event positions albo powtarzalny canonical scan,
5. utwórz registry/generation/checkpoint/receipt schema w zatwierdzonej migracji,
6. zbuduj wspólny projector framework,
7. wdroż privacy events, ledger input i per-sink receipts,
8. uruchom pierwszą projekcję shadow bez przełączania klientów,
9. wykonaj full rebuild i porównanie z AS-IS,
10. przełącz jeden read slice za feature flagą,
11. obserwuj i wykonaj rollback drill,
12. dopiero potem migruj kolejne projekcje.

Pierwszym kandydatem może być ranking, ponieważ AS-IS jest policzalny na zamkniętym zbiorze danych i nadaje się do deterministycznego porównania. Nie jest to autoryzacja wyboru ani wdrożenia.

## 36. Wymagane manifesty przed implementacją

Minimalny katalog:

| Manifest | Priorytet |
|---|---|
| `game.ranking.v1` | przed ranking cutover |
| `tournament.standings.v1` | przed V3 tournament pairing |
| `identity.public-player-search.v1` | przed nowym player search |
| `lobby.available-tables.v1` | przed multi-instance lobby |
| `messaging.inbox-summary.v1` | przed async counters |
| `chat.timeline-search.v1` | przed external search |
| `moderation.review-queue.v1` | przed worker separation |
| `newsletter.analytics.v1` | przed nowym dashboardem |

Każdy kolejny manifest stosuje te same bramki, bez wyjątku dla „tymczasowej” projekcji.

## 37. Alternatywy odrzucone

### A. Liczenie wszystkich rankingów przy każdym żądaniu bezterminowo

Odrzucone jako TARGET: koszt rośnie z historią, brak checkpoint/rebuild contract i trudniejszy privacy proof.

### B. Checkpoint wyłącznie w pamięci workera

Odrzucone: restart traci pozycję i uniemożliwia wiarygodny audit.

### C. Zapis checkpointu przed zmianą projekcji

Odrzucone: tworzy trwałą utratę eventu.

### D. Destrukcyjny truncate aktywnej projekcji podczas rebuild

Odrzucone: powoduje niedostępność, częściowe wyniki i brak bezpiecznego rollbacku.

### E. Outbox jako bezterminowy event store

Odrzucone: ma inną odpowiedzialność i podlega retencji ADR-V3-012.

### F. Jeden centralny Projection Service posiadający reguły wszystkich domen

Odrzucone: tworzy distributed monolith i rozmywa ownership.

### G. Dual-write z domeny bezpośrednio do read modelu i canonical state

Odrzucone: brak atomowości oraz trudny recovery; stosujemy state/event/outbox i projector.

### H. Usunięcie wyłącznie z cache/search

Odrzucone: nie usuwa innych generacji ani źródeł i nie daje kompletnego privacy proof.

### I. Rebuild najpierw, deletion ledger jako późniejszy cleanup

Odrzucone: tworzy okno resurrection i może opublikować dane zakazane.

## 38. Konsekwencje

### Korzyści

- jednoznaczny ownership,
- deterministyczne i testowalne rebuildy,
- brak fałszywych checkpointów,
- blue/green generations bez niszczenia aktywnego widoku,
- spójność z outbox/idempotency,
- privacy delete obejmujący ranking/search/cache,
- bezpieczny restore,
- mierzalne lag, completeness i readiness,
- fundament dla gier, turniejów i przyszłego Pokera.

### Koszty

- registry, generations, checkpoints i receipts,
- trwałe źródło replay lub powtarzalny canonical scan,
- dodatkowa przestrzeń podczas rebuild,
- projekt i testy per manifest,
- obsługa quarantine oraz source gaps,
- integracja Privacy Orchestrator,
- formalne activation/retirement gates.

Koszty są akceptowane, ponieważ read models obsługują dane publiczne, personalne i krytyczne biznesowo, a ich ciche rozjechanie albo privacy resurrection jest ryzykiem P0.

## 39. Kryteria formalnej akceptacji ADR

ADR może otrzymać `ACCEPTED / FINAL`, gdy reviewer potwierdzi:

- jednoznaczny owner model,
- dopuszczalne source modes i zakaz używania cache jako źródła,
- stabilne ordering/cursor contract,
- atomowość data + receipt + checkpoint,
- generacyjny, niedestrukcyjny rebuild,
- activation i retirement gate,
- deletion ledger oraz privacy events jako input rebuild,
- brak checkpointu przed durable privacy receipt,
- protection przed resurrection,
- per-sink delete receipts dla ranking/search/cache,
- restore z ledger replay,
- testy duplicate/gap/poison/concurrency/failure,
- spójność z ADR-V3-004, ADR-V3-012 i PostgreSQL V3,
- brak autoryzacji implementacji lub produkcji.

## 40. Wynik projektowy

```text
ADR-V3-013 DESIGN = COMPLETE
P0 TECHNICAL DECISION CONTENT = COMPLETE
FORMAL ARCHITECTURE REVIEW = PENDING
IMPLEMENTATION = NOT AUTHORIZED
REVIEWED DESIGN GATE = HOLD
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

## 41. Następny krok

1. niezależny Lead Architect review pełnej treści ADR-V3-013,
2. klasyfikacja uwag `P0/P1/P2`,
3. ewentualna korekta dokumentu,
4. formalna decyzja `ACCEPTED / HOLD / REJECTED`,
5. równoległe domknięcie Privacy/Legal review ADR-V3-012,
6. synchronizacja V3, statusu i indeksu,
7. dopiero po zamknięciu obu bramek — finalny `REVIEWED DESIGN GATE`.

