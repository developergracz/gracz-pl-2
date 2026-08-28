# Architektura docelowa Backend V3 — Gracz.pl

Data: 28.08.2026
Status: **ETAP 2 — dokument projektowy / ARCHITEKTURA DOCELOWA**

## 1. Cel

Celem Backend V3 jest zbudowanie modularnego backendu Gracz.pl, który usuwa kluczowe słabości potwierdzone w AS-IS i jednocześnie tworzy stabilną bazę pod nowe gry, turnieje, komunikację realtime, moderację, newsletter i dalszy rozwój przez wiele lat.

Ten dokument nie opisuje stanu obecnego jako już wdrożonego. Jest definicją **ARCHITEKTURY DOCELOWEJ**.

## 2. Wejście z ETAPU 1B

Projekt V3 uwzględnia jako ograniczenia migracyjne m.in.:

- Warcaby: trwały stan w PostgreSQL, ale historycznie brak potwierdzonego CAS/single-writer; na Renderze istnieje dodatkowe pole `version`, którego sama obecność nie dowodzi poprawnej kontroli współbieżności,
- Tysiąc: istniejący mechanizm revision + optimistic locking,
- Gomoku: stan gry w pamięci procesu, bez trwałego PostgreSQL,
- realtime: SSE i publikacja wykonywana oddzielnie od zapisu stanu,
- turnieje: wieloetapowe operacje bez pełnej atomowości i ryzyka race conditions,
- Global Chat: process-local presence/SSE oraz read-modify-write części stanu,
- newsletter: schema drift i model hybrydowy legacy + nowy lifecycle,
- role/audyt: współistnienie kilku historycznych modeli,
- Render: 28 tabel przy 26-elementowej mapie audytowej.

## 3. Zasady nadrzędne V3

Backend V3 powinien być projektowany według następujących zasad:

1. **jeden właściciel zapisu dla agregatu** — brak równoległych writerów modyfikujących ten sam stan bez kontroli,
2. **transakcja biznesowa + outbox w jednym commitcie**,
3. **eventual consistency tylko tam, gdzie jest świadomie dopuszczona**,
4. **idempotency dla komend mogących zostać ponowionych**,
5. **jawne granice bounded contextów**,
6. **brak bezpośredniego zapisu do cudzych tabel domenowych**,
7. **stan krytyczny nie może istnieć wyłącznie w pamięci pojedynczego procesu**,
8. **realtime nie jest źródłem prawdy — źródłem prawdy jest stan domenowy**, 
9. **każda operacja administracyjna i bezpieczeństwa ma audyt**, 
10. **migracje są odwracalne etapami i posiadają plan rollback**.

## 4. Docelowe bounded contexts

### 4.1 Identity & Access

Odpowiedzialność:
- konta,
- logowanie i sesje,
- role i uprawnienia,
- blokady bezpieczeństwa,
- historia zmian uprawnień.

Docelowo istnieje jeden kanoniczny model historii ról. `gracz_role_changes` i `gracz_role_history` nie powinny pozostawać równoległymi modelami bez jednoznacznego właściciela.

Publikowane eventy przykładowe:
- `identity.user_created`,
- `identity.role_changed`,
- `identity.user_disabled`,
- `identity.session_revoked`.

### 4.2 Audit

Odpowiedzialność:
- append-only zapis zdarzeń audytowych,
- korelacja operacji przez `correlation_id`,
- źródło, actor, subject, action, result,
- polityka retencji i archiwizacji.

Docelowo jedna tabela/rodzina tabel kanonicznego audytu. Legacy audit nie jest usuwany bez osobnego planu retencji.

### 4.3 Game Platform

Wspólna platforma techniczna dla gier, ale **bez mieszania reguł domenowych poszczególnych gier**.

Wspólne elementy:
- identyfikacja meczu,
- lifecycle meczu,
- seat/player assignment,
- komendy,
- wersjonowanie stanu,
- idempotency,
- reconnect,
- historia zdarzeń,
- publikacja realtime,
- integracja z rankingiem i turniejami.

Każda gra ma własny silnik domenowy:
- CheckersEngine,
- ThousandEngine,
- GomokuEngine,
- przyszłe gry.

### 4.4 Match Runtime / Match Actor

To krytyczny komponent Backend V3.

Dla każdego aktywnego `match_id` istnieje logicznie **jeden writer** przetwarzający komendy sekwencyjnie.

Model:

`Command -> Match Actor -> Domain Engine -> PostgreSQL transaction -> state/events/outbox -> ACK`

Dopiero po commitcie outbox jest publikowany do warstwy realtime.

Właściwości:
- komendy jednego meczu są serializowane,
- actor nie jest źródłem prawdy sam w sobie,
- po restarcie actor odtwarza stan z trwałego storage,
- ownership aktora musi być rozstrzygalny w środowisku wieloinstancyjnym,
- actor posiada lease/lock/fencing token lub równoważny mechanizm zapobiegający split-brain.

### 4.5 Tournament

Odpowiedzialność:
- definicja turnieju,
- rejestracja uczestników,
- seeding,
- pairingi,
- rundy,
- wyniki,
- standings,
- lifecycle turnieju.

Turniej jest osobnym agregatem z jednym writerem dla krytycznych przejść stanu.

Operacje takie jak `join`, `start`, `report_result`, `advance_round` muszą posiadać kontrolę wersji/lock i wykonywać atomowo odpowiedni zestaw zmian.

Mecz turniejowy powinien mieć jawne powiązanie z kanonicznym `match_id` platformy gier.

### 4.6 Messaging

Odpowiedzialność:
- prywatne wiadomości,
- załączniki,
- foldery/statusy,
- szyfrowanie aplikacyjne,
- polityka retencji.

Nie należy mieszać prywatnych wiadomości z Global Chat tylko dlatego, że oba moduły przesyłają tekst.

### 4.7 Global Chat & Social

Odpowiedzialność:
- wiadomości publiczne,
- tematy,
- reakcje,
- znajomi,
- raporty,
- presence.

Presence i subscriptions powinny przejść z pamięci procesu do współdzielonej warstwy efemerycznej/pub-sub.

Reakcje nie powinny używać niechronionego whole-object read-modify-write. Docelowo należy stosować atomowy model aktualizacji albo osobną relację reakcji.

### 4.8 Moderation

Odpowiedzialność:
- decyzje automatyczne,
- decyzje moderatorów,
- odwołania,
- sanctions/bans,
- review workflow,
- integracja z audytem.

Moderation konsumuje eventy z Chat/Messaging/Identity, ale nie zapisuje bezpośrednio do ich tabel.

### 4.9 Newsletter

Odpowiedzialność:
- subscriber lifecycle,
- double opt-in,
- consent history,
- attribution/source,
- email delivery lifecycle,
- unsubscribe,
- analytics.

Docelowo jeden kanoniczny model subscriber ID i jeden zestaw pól lifecycle. Legacy pola nie są utrzymywane bezterminowo.

Wysłanie maila nie może być logicznie sprzęgnięte z transakcją DB przez bezpośrednie `COMMIT -> send`. Docelowo:

`DB transaction -> outbox -> email worker -> provider -> delivery event`.

## 5. Architektura procesów

Docelowa topologia logiczna:

- **API Gateway / HTTP API** — uwierzytelnienie żądania, routing, rate limiting, request/correlation IDs,
- **Application Services** — komendy i zapytania bounded contextów,
- **Match Runtime** — single-writer dla aktywnych meczów,
- **PostgreSQL** — trwałe źródło prawdy,
- **Outbox Publisher** — odczyt niewysłanych eventów po commitach,
- **Message Broker / Event Bus** — dystrybucja eventów,
- **Realtime Gateway** — SSE/WebSocket, bez własności stanu domenowego,
- **Workers** — email, analytics, cleanup, projection rebuild, cięższe zadania asynchroniczne,
- **Shared ephemeral store** — presence, krótkie lease/locks, pub-sub pomocniczy; nie jako jedyne źródło stanu meczu.

## 6. Transactional Outbox

Każdy bounded context, który publikuje zdarzenia po zmianie stanu, zapisuje w tej samej transakcji:

- zmianę agregatu,
- rekord outbox.

Minimalny rekord outbox powinien zawierać:
- `event_id`,
- `event_type`,
- `aggregate_type`,
- `aggregate_id`,
- `aggregate_version`,
- `occurred_at`,
- `payload`,
- `correlation_id`,
- stan publikacji/attempts.

Publisher działa at-least-once. Konsumenci muszą być idempotentni.

Outbox rozwiązuje klasę problemów potwierdzoną w AS-IS: poprawny commit DB przy utracie publikacji realtime/email/eventu.

## 7. Komendy, wersjonowanie i idempotency

Każda mutująca komenda gry posiada co najmniej:
- `command_id` / `request_id`,
- `match_id`,
- `actor_user_id`,
- oczekiwaną wersję albo fencing token zależnie od modelu,
- payload,
- timestamp/correlation ID.

Powtórzona komenda z tym samym `command_id` nie może wykonać efektu biznesowego drugi raz.

Docelowy model nie powinien mieć kilku różnych strategii concurrency dla każdej gry bez powodu. Warcaby, Tysiąc i Gomoku powinny korzystać ze wspólnego kontraktu runtime, choć ich silniki reguł pozostają niezależne.

## 8. Single-writer dla gier

### 8.1 Wymaganie

Dla jednego `match_id` w danym momencie może istnieć tylko jeden uprawniony writer.

### 8.2 Ochrona przed split-brain

Samo mapowanie `match_id -> proces` nie wystarcza. Potrzebny jest mechanizm ownership z fencingiem, np.:
- lease z rosnącym fencing token,
- advisory lock + wersja,
- dedykowany scheduler/partition ownership,
- równoważny mechanizm zapewniający, że stary właściciel nie może zatwierdzić późniejszego zapisu.

### 8.3 Restart

Actor po restarcie:
1. uzyskuje ownership,
2. ładuje ostatni trwały snapshot/state,
3. odtwarza wymagane eventy po snapshotcie, jeśli zastosowano event log,
4. przyjmuje kolejne komendy.

## 9. Realtime V3

Realtime Gateway odpowiada wyłącznie za transport:
- subskrypcję kanału meczu/użytkownika/turnieju/chatu,
- autoryzację subskrypcji,
- delivery eventów,
- reconnect cursor / sequence.

Źródłem eventów jest broker/outbox, nie bezpośrednie wywołanie `publish()` przed/po przypadkowym miejscu w kodzie domenowym.

Klient powinien otrzymywać monotoniczną sekwencję/revision dla strumieni, gdzie kolejność ma znaczenie.

## 10. PostgreSQL — zasada własności danych

Każda tabela ma jednego właściciela domenowego.

Inny bounded context:
- nie wykonuje bezpośredniego `UPDATE` cudzej tabeli,
- używa API/application command albo eventu,
- może utrzymywać własną projekcję read-model, jeśli potrzebuje szybkich odczytów.

FK między bounded contextami stosujemy świadomie. Nie każda logiczna relacja musi być twardym FK, ale każda decyzja musi być udokumentowana.

## 11. Ranking i projekcje

Ranking, statystyki i dashboardy nie powinny wymuszać skanowania pełnych JSON state meczów.

Docelowo wyniki zakończonych gier generują eventy, z których budowane są projekcje:
- ranking gracza,
- historia gier,
- statystyki,
- standings turniejowe.

Projection worker musi być idempotentny i posiadać możliwość rebuild.

## 12. Bezpieczeństwo

Backend V3 zakłada:
- centralne authn/authz middleware,
- policy-based authorization zamiast rozproszonych ręcznych wyjątków,
- rate limiting per IP/user/action,
- CSRF/origin controls tam, gdzie mają zastosowanie,
- bezpieczne zarządzanie sekretami,
- rotację credentials,
- szyfrowanie wrażliwych payloadów aplikacyjnie tam, gdzie jest wymagane,
- pełny audit trail operacji administracyjnych,
- least privilege dla workerów i połączeń DB.

## 13. Obserwowalność

Każde żądanie/komenda/event powinny być możliwe do prześledzenia przez:
- `request_id`,
- `correlation_id`,
- `causation_id`,
- `event_id`,
- `aggregate_id`.

Wymagane metryki:
- command latency,
- actor queue depth,
- lock/lease conflicts,
- optimistic concurrency conflicts,
- outbox lag,
- broker delivery failures,
- realtime disconnect/reconnect rate,
- failed projections,
- DB transaction latency.

## 14. Deployment V3

Minimalny podział wdrożeniowy na początku nie musi oznaczać kilkunastu mikroserwisów.

Rekomendowany model przejściowy: **modular monolith + wydzielone procesy runtime/workers**, z twardymi granicami modułów w kodzie.

Pierwsza topologia może wyglądać tak:
- `api-v3`,
- `match-runtime-v3`,
- `worker-v3`,
- `realtime-v3`,
- PostgreSQL,
- broker/shared ephemeral store.

To ogranicza koszt operacyjny, a jednocześnie umożliwia późniejsze fizyczne wydzielanie bounded contextów bez przepisywania ich kontraktów.

## 15. Kolejność implementacyjna wynikająca z architektury

1. fundament platformy V3: module boundaries, IDs, command envelope, transaction helpers,
2. outbox + publisher + idempotent consumer framework,
3. kanoniczny match model i match-runtime,
4. migracja Warcabów jako pierwszego pełnego match-actor reference implementation,
5. migracja Tysiąca do wspólnego runtime,
6. dodanie persistence Gomoku i migracja do wspólnego runtime,
7. kanoniczne powiązanie Tournament Match -> Game Match,
8. turniejowy single-writer i transakcyjne przejścia rund,
9. realtime gateway oparty o event bus,
10. normalizacja newslettera + email worker/outbox,
11. konsolidacja ról i audytu,
12. cleanup legacy dopiero po potwierdzonej migracji danych i okresie obserwacji.

## 16. Decyzje, których nie podejmujemy jeszcze w tym dokumencie

Do dalszego projektowania pozostają:
- wybór konkretnego brokera,
- wybór konkretnego shared ephemeral store,
- dokładny model tabel V3,
- snapshot vs event log dla każdej klasy agregatu,
- konkretna strategia distributed ownership match actorów,
- szczegółowa polityka retencji,
- fizyczny podział deploymentów po osiągnięciu określonego ruchu.

Te decyzje powinny zostać podjęte dowodowo w kolejnych dokumentach ETAPU 2, bez przedwczesnego wiązania architektury z jednym produktem.

## 17. Kryteria akceptacji Backend V3

Architektura docelowa jest poprawnie wdrożona dopiero, gdy:
- dla pojedynczego meczu nie istnieje możliwość dwóch skutecznych writerów,
- restart procesu nie powoduje utraty kanonicznego stanu gry,
- każdy event biznesowy wymagający publikacji jest powiązany atomowo z transakcją przez outbox,
- ponowienie komendy nie powoduje podwójnego efektu,
- realtime może zostać utracony/przerwany bez utraty prawdy domenowej,
- turniej nie może przekroczyć limitu uczestników przez race,
- wynik meczu nie może zostać zatwierdzony podwójnie przez równoległość,
- newsletter DB i delivery lifecycle są rozdzielone niezawodną kolejką/outboxem,
- istnieje jeden kanoniczny model historii ról,
- legacy audit/newsletter schema są usuwane wyłącznie po kontrolowanej migracji.

## 18. Następny dokument ETAPU 2

Po zatwierdzeniu tej architektury należy przygotować:

**Model danych docelowy PostgreSQL V3**

Dokument powinien przełożyć granice bounded contextów, match-actor, outbox, idempotency i projekcje na konkretne tabele, klucze, constrainty i strategię migracji z obecnych 28 tabel.