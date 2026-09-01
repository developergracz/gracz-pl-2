# ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold

Data: 31.08.2026  
Ścieżka docelowa: `Nowa dokumentacja Gracz.pl/09-DECYZJE-ARCHITEKTONICZNE/ADR-V3-012-DATA-RETENTION-PRIVACY-DELETION-LEGAL-HOLD.md`  
Priorytet: `P0`  
Status: **PROPOSED / REVIEW PENDING / NOT IMPLEMENTED / FREEZE-SAFE**

Review provenance: [`REV-ADR-V3-012-20260831-01`](00-ARCHITECTURE-REVIEW-PROVENANCE-REGISTER.md#6-review-record--adr-v3-012)  
Privacy/Legal review pack: [`REV-ADR-V3-012-20260901-PL-01`](REV-ADR-V3-012-PRIVACY-LEGAL-REVIEW-PACK.md)  
Provenance class: **EXTERNAL_RECORDED / REVIEWER IDENTITY NOT RECORDED IN GIT**

> Ten ADR jest decyzją architektoniczną i polityką projektową Gracz.pl V3. Nie stanowi opinii prawnej, nie potwierdza wdrożenia i nie udziela zgody operacyjnej. Ostateczna podstawa prawna, obowiązki informacyjne i okresy wymagają formalnego review właściciela Privacy/Legal przed oznaczeniem ADR jako `ACCEPTED`.

## 0. Obowiązujący stan

```text
ADR-V3-004 = ACCEPTED / FINAL
ADR-V3-012 = DESIGN COMPLETE / ARCHITECTURE PASS / PRIVACY-LEGAL REVIEW PENDING
ADR-V3-013 = ACCEPTED / FINAL / NOT IMPLEMENTED / FREEZE-SAFE
PRIVACY/LEGAL REVIEW PACK = READY
PRIVACY/LEGAL OWNER = UNASSIGNED
FORMAL REVIEW = NOT EXECUTED
REVIEWED DESIGN GATE = HOLD — ADR-V3-012 PRIVACY/LEGAL GOVERNANCE PENDING
IMPLEMENTATION = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

## 1. Decyzja w jednym zdaniu

Gracz.pl V3 stosuje centralny kontrakt retencji i privacy orchestration, lecz wykonuje usunięcie w bounded contextach: dane są kasowane, anonimizowane albo ograniczane według jawnej klasy i celu, legal hold jest wąski, terminowy i audytowalny, a backupy wygasają naturalnie z obowiązkowym replayem deletion ledger po restore.

## 2. Kontekst problemu

V3 przechowuje różne klasy danych o odmiennych wymaganiach:

- konto, profil, sesje i MFA,
- mecze, ruchy, snapshoty, rankingi i turnieje,
- prywatne wiadomości i załączniki,
- publiczny chat, reakcje, znajomości i zgłoszenia,
- newsletter i dowody zgód,
- audyt, security events, moderację, sankcje i dowody,
- logi, metryki, trace, outbox i idempotency,
- backupy oraz artefakty restore.

Jedna globalna instrukcja `DELETE FROM users` byłaby niepoprawna, ponieważ:

- naruszałaby ownership bounded contexts,
- mogłaby usunąć wiadomość nadal należącą do drugiej strony,
- mogłaby zniszczyć dowód zgody, audytu lub sprawy moderacyjnej,
- mogłaby przerwać spójność meczu, rankingu lub turnieju,
- nie usuwałaby kopii z read models, cache, indeksów i backupów,
- nie dawałaby dowodu kompletnego wykonania żądania,
- nie rozróżniałaby kasowania od nieodwracalnej anonimizacji.

## 3. Źródła projektowe

ADR jest zgodny co najmniej z:

- `01-ARCHITEKTURA/03-SKONSOLIDOWANA-ARCHITEKTURA-SYSTEMOWA-GRACZ-PL-V3.md`,
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md`,
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md`,
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md`,
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md`,
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md`,
- `02-BAZA-DANYCH/18-POSTGRESQL-V3-ITERACJA-7-MODERATION.md`,
- `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md`,
- `03-MIGRACJA/53-ENTERPRISE-GRADE-DEFINITION-V3.md`,
- `03-MIGRACJA/54-ENTERPRISE-GRADE-READINESS-CHECKLIST-V3.md`,
- `03-MIGRACJA/55-ENTERPRISE-GRADE-OPERATIONAL-PROOF-PLAN-V3.md`.

Źródła regulacyjne wykorzystane jako ograniczenia projektu:

- RODO art. 5 ust. 1 lit. c i e — minimalizacja oraz ograniczenie przechowywania,
- RODO art. 12 — wykonywanie praw osoby i terminy odpowiedzi,
- RODO art. 17 — prawo do usunięcia oraz wyjątki,
- RODO art. 18 — ograniczenie przetwarzania,
- RODO art. 20 — przenoszenie danych bez naruszania praw innych osób,
- RODO art. 25 i 32 — privacy by design/default oraz bezpieczeństwo,
- aktualne materiały UODO dotyczące ustalania okresów retencji według celu.

Wskazane przepisy nie ustanawiają jednego uniwersalnego okresu dla wszystkich danych Gracz.pl. Okresy w tym ADR są docelową polityką systemową podlegającą formalnemu review, a nie twierdzeniem o jednym ustawowym terminie.

## 4. Zakres

ADR rozstrzyga:

- klasy retencji,
- docelowe okresy i moment rozpoczęcia ich liczenia,
- kontrakt usunięcia konta i danych,
- kasowanie, anonimizację, pseudonimizację i ograniczenie przetwarzania,
- model legal hold,
- zachowanie Game Platform, w tym przyszłego Pokera,
- zachowanie Messaging, Chat, Newsletter, Moderation i Audit,
- read models, wyszukiwarki, cache, logi i telemetry,
- backup/restore oraz replay usunięć,
- dowód wykonania, błędy, retry i testy.

## 5. Poza zakresem

ADR nie rozstrzyga:

- ostatecznej podstawy prawnej każdego celu przetwarzania,
- treści polityki prywatności i regulaminu,
- identity proofing dla każdego rodzaju żądania,
- wyboru konkretnego object storage lub observability providera,
- implementacji read-model checkpointów — `ADR-V3-013`,
- uprawnień do lawful access do plaintext prywatnych wiadomości,
- szczególnych obowiązków gry o realne pieniądze; taka funkcja wymaga odrębnego programu prawnego i architektonicznego.

## 6. Słownik normatywny

| Termin | Znaczenie w V3 |
|---|---|
| Logical delete | usunięcie widoczności i normalnego dostępu przy zachowaniu kontrolowanego rekordu |
| Physical purge | nieodwracalne usunięcie danych z aktywnych systemów i storage |
| Anonymization | nieodwracalne zerwanie możliwości przypisania danych do osoby przy użyciu racjonalnie dostępnych środków |
| Pseudonymization | zastąpienie identyfikatora wartością pośrednią; nadal są to dane osobowe, jeśli istnieje możliwość powiązania |
| Restriction | zamrożenie zwykłego użycia danych; dopuszczalne pozostaje wyłącznie przetwarzanie objęte podstawą ograniczenia |
| Legal hold | jawne wstrzymanie purge wyłącznie dla oznaczonego zakresu i celu |
| Tombstone | minimalny rekord potwierdzający usunięcie lub blokujący ponowne wprowadzenie danych |
| Deletion ledger | trwały, minimalny i audytowalny rejestr wykonania kroków privacy |
| Retention clock | zdarzenie, od którego liczony jest okres retencji |
| Eligible for purge | rekord, którego okres minął i którego nie blokuje zależność ani aktywny hold |

Soft-delete, pseudonimizacja i szyfrowanie nie są automatycznie równoważne usunięciu.

## 7. Nienaruszalne zasady

1. Brak polityki nie oznacza retencji bezterminowej; oznacza `HOLD` dla automatycznego purge i obowiązek decyzji.
2. Każda klasa ma ownera, cel, clock, okres, akcję końcową i wyjątki.
3. Legal hold nie może obejmować całej platformy bez jawnego, proporcjonalnego zakresu.
4. Hold blokuje purge, ale nie przywraca publicznej widoczności ani zwykłego dostępu.
5. Usunięcie konta natychmiast blokuje uwierzytelnienie i nowe skutki biznesowe.
6. Dane drugiej strony nie są niszczone przypadkowym account cascade.
7. Dane historyczne gier mogą przetrwać wyłącznie jako potrzebne dane domenowe albo dane nieodwracalnie anonimowe.
8. Privacy workflow jest idempotentny, restartowalny i mierzalny.
9. Każdy restore przed użyciem wykonuje replay deletion ledger i aktywnych holds.
10. Backup nie jest archiwum legal hold.
11. Logi, outbox, cache, wyszukiwarka i read models podlegają privacy tak samo jak tabele główne.
12. Nie zapisujemy plaintext prywatnych wiadomości w audit, outbox, logach ani evidence JSON.

## 8. Klasy danych

| Klasa | Przykłady | Wymaganie minimalne |
|---|---|---|
| `PUBLIC` | publiczny profil, ranking, publiczny chat | kontrola publikacji, moderacja, retencja |
| `INTERNAL` | identyfikatory techniczne, statusy workerów | need-to-know, ograniczona ekspozycja |
| `PERSONAL` | e-mail, profil, historia aktywności | cel, retencja, prawa osoby, kontrola dostępu |
| `SENSITIVE` | MFA, security signals, private messaging | szyfrowanie, ścisły dostęp, audyt, minimalizacja |
| `EVIDENCE` | audit, consent, moderation evidence | integralność, ograniczony dostęp, hold-aware purge |
| `SECRET` | klucze, tokeny, credentiale | tylko secret store, zakaz logowania |
| `ANONYMIZED` | statystyki bez odwracalnego identyfikatora | brak mapy reidentyfikacyjnej |

## 9. Docelowa macierz retencji V3

Okresy są wartościami projektowymi P0. Zmiana okresu wymaga wersjonowanej polityki, ownera i analizy wpływu.

| Domena / klasa | Retention clock | Okres docelowy | Akcja końcowa |
|---|---|---:|---|
| aktywne konto i profil | lifecycle konta | do usunięcia konta | privacy workflow |
| konto po zweryfikowanym żądaniu | `verified_at` | maks. 30 dni w aktywnych systemach | purge lub anonimizacja według domeny |
| publiczny profil po blokadzie usunięcia | `verified_at` | maks. 24 godziny widoczności | ukrycie i pseudonimizacja prezentacji |
| MFA secrets i aktywne credentiale | `verified_at` | natychmiast, cel operacyjny 24 h | revoke + cryptographic erase/purge |
| sesje auth | expiry/revoke/delete | 30 dni | purge; wcześniej brak autoryzacji |
| reset/registration/public tokens | expiry/consume/revoke | 7 dni | purge hasha i metadata niepotrzebnych do audytu |
| privacy request evidence | completion | 6 lat | minimalny zanonimizowany/pseudonimowy proof, potem purge |
| privacy tombstone anty-abuse | completion | 24 miesiące | purge; wyłącznie keyed HMAC i reason class |
| zakończone game/match events z identyfikatorem | `finished_at` | 36 miesięcy | nieodwracalna anonimizacja identyfikatorów |
| snapshoty zakończonych meczów | `finished_at` | 90 dni | purge, chyba że dispute/hold |
| anonimowa historia meczu/replay | anonymization | bezterminowo przy potwierdzonej anonimowości | przegląd reidentification risk co 12 miesięcy |
| tournament history z identyfikatorami | `finished_at` | 36 miesięcy | anonimizacja uczestników; struktura turnieju może pozostać |
| bieżący ranking | aktualizacja/aktywność | aktywne konto + 30 dni | usunięcie z publicznej projekcji; agregat anonimowy może pozostać |
| private message | `sent_at` | 36 miesięcy | purge po spełnieniu party-state/hold rules |
| private message po delete obu stron | późniejsze `deleted_at` | 30 dni grace | physical purge wiadomości i załączników |
| private message po delete konta jednej strony | account deletion | do retencji wiadomości drugiej strony | odłączenie FK i pseudonimizacja usuniętej strony |
| publiczny chat body | `created_at` | 12 miesięcy | purge/anonimizacja body, chyba że aktywny case/hold |
| chat edit/delete events | `occurred_at` | 24 miesiące | purge lub minimalizacja |
| reakcje i usunięte relacje social | removal/account deletion | 30 dni | purge |
| otwarta relacja social | lifecycle relacji | do zakończenia relacji/konta | purge po 30 dniach |
| newsletter pending confirmation | `created_at` | 30 dni | purge current record, jeśli brak innej podstawy |
| newsletter public token metadata | expiry/consume/revoke | 7 dni | purge |
| unsubscribed newsletter current record | `unsubscribed_at` | 24 miesiące | minimalizacja/purge danych identyfikujących |
| newsletter consent proof | ostatni consent event | 6 lat | purge lub trwała anonimizacja, jeśli dopuszczalna |
| newsletter lifecycle analytics | `occurred_at` | 24 miesiące | agregacja anonimowa lub purge |
| provider delivery telemetry | `occurred_at` | 13 miesięcy | purge |
| moderation case/action/appeal | zamknięcie/wygaśnięcie | 36 miesięcy | purge/minimalizacja, jeśli brak hold |
| moderation evidence | closure + `retention_until` | 36 miesięcy domyślnie | purge szyfrowanego evidence; hold może wstrzymać |
| zakończona sankcja | `ended_at`/`revoked_at` | 36 miesięcy | minimalizacja/purge |
| privileged audit / role history | `occurred_at` | 24 miesiące hot + 48 miesięcy archive | purge po łącznie 6 latach |
| security events | `occurred_at` | 12 miesięcy | purge lub anonimowa agregacja |
| completed outbox | `published_at` | 30 dni | purge |
| failed/dead-letter outbox | terminal state | 90 dni | purge po resolution evidence |
| idempotency records | completion | 30 dni; 90 dni dla komend game/tournament/admin | purge według context policy |
| application logs | ingestion | 30 dni | purge |
| security logs | ingestion | 90 dni | purge |
| raw traces | ingestion | 14 dni | purge |
| zagregowane metryki bez ID | aggregation period | 13 miesięcy | purge lub dalsza anonimowa agregacja |
| backup dzienny | creation | 35 dni | cryptographic/physical expiry |
| backup tygodniowy | creation | 12 tygodni | expiry |
| backup miesięczny | creation | 12 miesięcy | expiry |
| izolowane środowisko restore | zakończenie testu | maks. 7 dni | pełny cleanup z evidence |

### 9.1. Interpretacja okresów

- `maks.` oznacza deadline dla aktywnych systemów, nie gwarancję przechowania do ostatniego dnia.
- Purge może nastąpić wcześniej, jeśli cel ustał i nie istnieje inna podstawa.
- Aktywny, prawidłowy hold zatrzymuje tylko objęty nim rekord/zakres.
- Po anonimizacji nie pozostaje tabela mapująca osobę na anonimowy rekord.
- Wartości muszą zostać zatwierdzone przez Privacy/Legal owner przed `ACCEPTED`.

## 10. Model polityki retencji

Polityka nie może istnieć wyłącznie w kodzie workera. Docelowy katalog zawiera wersjonowane rekordy:

```sql
CREATE TABLE retention_policies (
    policy_code          VARCHAR(96) NOT NULL,
    policy_version       INTEGER NOT NULL,
    bounded_context      VARCHAR(64) NOT NULL,
    data_class           VARCHAR(32) NOT NULL,
    clock_event          VARCHAR(96) NOT NULL,
    retention_interval   INTERVAL NOT NULL,
    terminal_action      VARCHAR(32) NOT NULL,
    legal_basis_ref      VARCHAR(128),
    owner_role           VARCHAR(96) NOT NULL,
    effective_from       TIMESTAMPTZ NOT NULL,
    effective_to         TIMESTAMPTZ,
    approved_at          TIMESTAMPTZ,
    PRIMARY KEY (policy_code, policy_version),
    CHECK (terminal_action IN ('purge','anonymize','archive_then_purge','review'))
);
```

Zmiana polityki nie przedłuża automatycznie istniejących rekordów bez jawnej reguły applicability.

## 11. Privacy Request Orchestrator

### 11.1. Odpowiedzialność

Orchestrator:

- rejestruje żądanie,
- oddziela identity verification od zwykłej sesji,
- wyznacza subject scope,
- publikuje idempotentne komendy domenowe,
- zbiera receipts,
- kontroluje deadline,
- wykonuje walidację negatywną,
- zamyka żądanie albo rejestruje jawny wyjątek.

Nie otrzymuje prawa do dowolnego bezpośredniego kasowania tabel innych kontekstów.

### 11.2. Stan żądania

```text
RECEIVED
  -> IDENTITY_VERIFICATION
  -> VERIFIED
  -> DISCOVERY
  -> RESTRICTED
  -> EXECUTING
  -> VALIDATING
  -> COMPLETED

Alternatywy:
  -> REJECTED
  -> PARTIALLY_RESTRICTED
  -> BLOCKED_BY_HOLD
  -> FAILED_RETRYABLE
  -> FAILED_MANUAL_REVIEW
```

Każde przejście ma `expected_version`, `command_id`, timestamp, aktora i reason code.

### 11.3. Minimalny rekord

```sql
CREATE TABLE privacy_requests (
    request_id            UUID PRIMARY KEY,
    request_type          VARCHAR(24) NOT NULL,
    subject_user_id       VARCHAR(32),
    subject_ref_hmac      CHAR(64) NOT NULL,
    status                VARCHAR(32) NOT NULL,
    received_at           TIMESTAMPTZ NOT NULL,
    verified_at           TIMESTAMPTZ,
    due_at                TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    policy_version        INTEGER NOT NULL,
    legal_exception_code  VARCHAR(96),
    version               BIGINT NOT NULL DEFAULT 1,
    CHECK (request_type IN ('access','export','delete','restrict','rectify'))
);
```

`subject_ref_hmac` używa dedykowanego, rotowalnego privacy salt poza bazą. Rekord nie przechowuje kopii dokumentu tożsamości ani pełnego eksportu.

## 12. Workflow usunięcia konta

### Faza D0 — rejestracja

- wygeneruj `request_id`,
- zapisz policy version i deadline,
- nie loguj treści żądania ani danych dokumentu w telemetry.

### Faza D1 — weryfikacja

- zweryfikuj uprawnienie osoby,
- odrzuć przejęcie konta i niejednoznaczną tożsamość,
- oznacz request jako `VERIFIED`.

### Faza D2 — natychmiastowe ograniczenie

- `users.status='deleted_pending'` albo równoważny stan migracyjny,
- revoke wszystkich sesji, reset tokens i MFA,
- zablokuj login, nowe wiadomości, gry i subskrypcje,
- ukryj profil publiczny oraz ranking w celu operacyjnym do 24 h,
- zachowaj audit bez plaintext PII.

### Faza D3 — discovery

Każdy bounded context zwraca manifest:

```text
context
record_count_by_class
eligible_for_purge
eligible_for_anonymization
restricted_by_dependency
restricted_by_hold
policy_version
receipt_hash
```

### Faza D4 — wykonanie domenowe

- Identity usuwa credentiale i minimalizuje konto,
- Game/Tournament anonimizuje partycypację według clock,
- Messaging zachowuje prawa drugiej strony i ocenia party-state,
- Chat usuwa/pseudonimizuje treści według retencji i hold,
- Newsletter odłącza Identity, ale chroni consent proof,
- Moderation/Audit stosuje minimalizację i hold,
- projections/search/cache konsumują privacy events.

### Faza D5 — walidacja

Wymagane są:

- pozytywny receipt z każdego kontekstu,
- negatywne wyszukiwanie po `user_id`, e-mail hash i known aliases,
- kontrola object storage,
- kontrola search index/read models/cache,
- kontrola braku aktywnych sesji i credentiali,
- zapis wyjątków objętych hold bez ujawniania treści.

### Faza D6 — zamknięcie

- status `COMPLETED`, `PARTIALLY_RESTRICTED` albo `BLOCKED_BY_HOLD`,
- retention deadline dla minimalnego proof,
- informacja dla osoby zgodna z formalną procedurą,
- event `privacy.request_completed` bez PII.

## 13. Deletion ledger

Ledger przechowuje dowód, że operacja została wykonana, ale nie może odtwarzać usuniętych danych.

```sql
CREATE TABLE privacy_deletion_ledger (
    request_id          UUID NOT NULL,
    bounded_context     VARCHAR(64) NOT NULL,
    action_code         VARCHAR(64) NOT NULL,
    subject_ref_hmac    CHAR(64) NOT NULL,
    policy_code         VARCHAR(96) NOT NULL,
    policy_version      INTEGER NOT NULL,
    affected_count      BIGINT NOT NULL,
    hold_count          BIGINT NOT NULL DEFAULT 0,
    receipt_hash        CHAR(64) NOT NULL,
    completed_at        TIMESTAMPTZ NOT NULL,
    purge_after         TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (request_id, bounded_context, action_code)
);
```

Zakazane w ledger:

- e-mail, login, display name i IP,
- plaintext wiadomości,
- nazwy plików i payloady załączników,
- szczegóły sprawy prawnej,
- sekrety i tokeny.

## 14. Legal hold

### 14.1. Zasada

Hold jest wyjątkiem, nie domyślną retencją. Musi mieć:

- jednoznaczny owner role,
- podstawę/reason code,
- scope,
- datę rozpoczęcia,
- obowiązkowy `review_at`,
- obowiązkowy `expires_at`,
- dwie niezależne akceptacje dla zakresu obejmującego private content,
- audyt utworzenia, przedłużenia, zawężenia i zwolnienia.

### 14.2. Model

```sql
CREATE TABLE legal_holds (
    hold_id             UUID PRIMARY KEY,
    hold_type           VARCHAR(32) NOT NULL,
    reason_code         VARCHAR(96) NOT NULL,
    authority_ref       VARCHAR(128) NOT NULL,
    status              VARCHAR(24) NOT NULL,
    starts_at           TIMESTAMPTZ NOT NULL,
    review_at           TIMESTAMPTZ NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_by_role     VARCHAR(96) NOT NULL,
    approved_by_role    VARCHAR(96) NOT NULL,
    released_at         TIMESTAMPTZ,
    version             BIGINT NOT NULL DEFAULT 1,
    CHECK (status IN ('draft','active','expired','released','revoked')),
    CHECK (review_at <= expires_at)
);

CREATE TABLE legal_hold_scopes (
    hold_id             UUID NOT NULL REFERENCES legal_holds(hold_id) ON DELETE RESTRICT,
    bounded_context     VARCHAR(64) NOT NULL,
    object_type         VARCHAR(64) NOT NULL,
    object_ref_hmac     CHAR(64) NOT NULL,
    from_time           TIMESTAMPTZ,
    to_time             TIMESTAMPTZ,
    PRIMARY KEY (hold_id, bounded_context, object_type, object_ref_hmac)
);
```

### 14.3. Limity polityki

- review hold: co najwyżej co 90 dni,
- początkowy `expires_at`: maksymalnie 12 miesięcy,
- przedłużenie: nowa jawna decyzja z nową datą i audytem,
- brak ownera lub expiry powoduje `INVALID HOLD`, nie retencję bez końca,
- release uruchamia ponowną ocenę purge w ciągu 24 h,
- details prawne pozostają w ograniczonym systemie spraw; `authority_ref` jest referencją, nie opisem sprawy.

## 15. Identity & Access

Po zweryfikowanym delete:

- sesje i tokeny są natychmiast unieważniane,
- MFA secret jest niszczony,
- password hash i e-mail są usuwane po zakończeniu niezbędnego workflow,
- `users.status` przechodzi przez jawny stan deletion, a następnie rekord jest purgowany albo minimalizowany,
- profil publiczny znika do 24 h,
- append-only audit używa `actor_type='deleted_user'` lub pseudonimowego subject ref bez odwracalnego lookupu dla zwykłego runtime,
- role current są usuwane, historia roli pozostaje zgodnie z audit policy.

Nie wolno pozostawić aktywnego loginu tylko dlatego, że część danych jest objęta hold.

## 16. Game Platform, ranking, turnieje i przyszły Poker

### 16.1. Historia gier

- kanoniczny wynik meczu nie jest kasowany w sposób niszczący wynik innych uczestników,
- identyfikatory usuniętego użytkownika są zastępowane nieodwracalnym participant aliasem po spełnieniu retencji,
- display name i profil nie są kopiowane do trwałych eventów, jeśli nie są potrzebne,
- snapshoty są krótsze niż historyczne eventy i są purgowane po 90 dniach,
- ranking usuwa publiczną pozycję użytkownika i odbudowuje projekcję,
- zbiorcze statystyki mogą pozostać bezterminowo tylko po potwierdzonej anonimizacji.

### 16.2. Poker compatibility

Przyszły Poker korzysta z tego samego kontraktu:

- hand/match history z identyfikatorami: 36 miesięcy,
- publiczny hand replay nie ujawnia usuniętej tożsamości,
- po 36 miesiącach historia może pozostać jako anonimowy replay/statystyka,
- anti-cheat evidence jest kopiowane wyłącznie do Moderation Evidence z własnym clock/hold,
- wolno zachować integralność rozdania, kolejność akcji, wynik i parametry silnika,
- nie wolno uzasadniać pełną historią gry bezterminowego przechowywania e-maila, IP, profilu lub prywatnej komunikacji,
- gry o realne pieniądze pozostają poza tym ADR i wymagają odrębnych wymogów regulacyjnych.

### 16.3. Aktywny mecz

Żądanie delete nie może zostawić osieroconego writera:

- blokujemy nowe komendy użytkownika,
- Match Runtime finalizuje `forfeit`, `aborted` albo inny jawny wynik według reguł gry,
- stan i event są zapisywane atomowo z outbox,
- lease/fencing pozostaje zgodny z `ADR-V3-004`,
- dopiero potem wykonywana jest anonimizacja danych uczestnika.

## 17. Private Messaging i załączniki

1. Delete użytkownika oznacza delete jego widoku i odłączenie tożsamości, nie automatyczny purge wiadomości drugiej strony.
2. Physical purge następuje po obu party deletes i 30-dniowym grace albo po 36 miesiącach od wysłania, jeśli nie istnieje hold.
3. Załącznik dziedziczy clock oraz hold wiadomości.
4. Object storage delete i DB delete tworzą jeden workflow z receipt, nie jedną fikcyjną transakcję ACID.
5. Brak obiektu po retry jest idempotentnym sukcesem, jeśli metadata potwierdza właściwy target.
6. Cryptographic erase jest dopuszczalne, gdy dedykowany DEK nie jest współdzielony z innym obiektem i zniszczenie klucza jest udowodnione.
7. Nie zapisujemy decrypted body w privacy ledger, audit ani logach.
8. Hold może zachować ciphertext i kontrolowany key reference; nie udziela automatycznie prawa do odszyfrowania.

## 18. Global Chat i Social

- soft-delete kontroluje widoczność, nie kończy retencji,
- body publicznego chatu ma 12 miesięcy,
- edit/delete history ma 24 miesiące,
- aktywny moderation case może objąć dokładnie wskazany message/evidence,
- po account deletion `author_user_id` jest odłączany, a display snapshot podlega pseudonimizacji,
- reactions i social relations są usuwane w 30 dni,
- reports nie są usuwane razem z message; podlegają Moderation policy,
- wyszukiwarka i realtime nie mogą serwować purgowanego body.

## 19. Newsletter

- unsubscribe nie jest physical delete,
- pending confirmation bez potwierdzenia wygasa po 30 dniach,
- token metadata jest usuwane 7 dni po stanie terminalnym,
- current subscriber record po unsubscribe jest minimalizowany po 24 miesiącach,
- append-only consent proof ma 6-letnią politykę projektową,
- usunięcie Identity używa `ON DELETE SET NULL`, nie kasuje consent proof,
- po zakończeniu retencji consent proof e-mail/ID jest purgowany lub anonimizowany zgodnie z zatwierdzoną podstawą,
- direct marketing objection/unsubscribe zatrzymuje wysyłkę natychmiast niezależnie od retencji dowodu.

## 20. Moderation, Audit i Security

- zamknięty case, actions, appeals, sanctions i evidence mają domyślnie 36 miesięcy,
- content snapshot jest minimalny i szyfrowany, jeśli zawiera private content,
- active hold może zatrzymać wyłącznie określony evidence scope,
- audit i role history mają 6 lat łącznie: 24 miesiące hot + 48 miesięcy archive,
- security events mają 12 miesięcy,
- zwykły runtime nie ma prawa UPDATE/DELETE audit,
- purge wykonuje dedykowany principal i każdy batch ma audit bez PII payload,
- zakończenie sprawy nie usuwa automatycznie historii przed upływem policy clock.

## 21. Read models, search, cache i realtime

Privacy events:

```text
privacy.subject_restricted
privacy.subject_deleted
privacy.subject_anonymized
privacy.hold_activated
privacy.hold_released
privacy.retention_expired
```

Każdy konsument:

- jest idempotentny,
- zapisuje checkpoint zgodny z `ADR-V3-013`,
- usuwa wszystkie pola pochodne, nie tylko główny dokument,
- nie przechowuje własnej, dłuższej retencji,
- potwierdza receipt do orchestratora,
- podczas rebuild stosuje deletion ledger przed publikacją read modelu.

Cache invalidation jest obowiązkowym krokiem delete. TTL cache nie jest jedynym mechanizmem, ale stanowi dodatkowy limit ekspozycji.

## 22. Export i przenoszenie danych

Eksport:

- jest generowany na żądanie po mocnej weryfikacji,
- obejmuje dane dotyczące osoby zgodnie z zakresem i podstawą,
- nie ujawnia danych drugiej strony, prywatnych powodów moderacji, sekretów ani wewnętrznych security signals,
- używa wersjonowanego manifestu i formatu maszynowego, np. JSON + pliki,
- jest szyfrowany w storage i dostępny przez krótko żyjący token,
- wygasa po 7 dniach,
- jest purgowany niezależnie od pobrania,
- ma audit pobrania bez zapisu zawartości eksportu.

Eksport nie opóźnia delete, chyba że użytkownik jawnie zażądał kolejności export-then-delete i mieści się ona w deadline.

## 23. Backup i restore

### 23.1. Zasada

Nie mutujemy pojedynczych rekordów w immutable backupie. Backup wygasa zgodnie z harmonogramem 35 dni / 12 tygodni / 12 miesięcy.

### 23.2. Restore gate

Każdy restore przed użyciem przechodzi:

```text
RESTORE
  -> NETWORK ISOLATION
  -> RESTORE COMPLETED
  -> APPLY CURRENT MIGRATIONS
  -> REPLAY DELETION LEDGER
  -> APPLY ACTIVE HOLDS
  -> PRIVACY RECONCILIATION
  -> USAGE AUTHORIZATION OR DESTROY
```

Bez replay i reconciliation środowisko pozostaje `NO-GO`.

### 23.3. Restore test

- środowisko jest izolowane,
- operator nie wykonuje zwykłych wysyłek e-mail/SMS/realtime,
- dostęp jest czasowy i audytowany,
- cleanup następuje maksymalnie w 7 dni,
- evidence potwierdza zniszczenie środowiska,
- legacy crypto material jest używane wyłącznie zgodnie z kontrolowanym runbookiem.

## 24. Worker retencji

Worker działa batchowo i fail-closed:

1. wybiera rekordy `eligible_at <= db_now`,
2. sprawdza aktualną policy version,
3. sprawdza dependencies i active holds,
4. claimuje batch `FOR UPDATE SKIP LOCKED`,
5. wykonuje domain action,
6. zapisuje minimalny receipt,
7. publikuje outbox event po commit,
8. aktualizuje metryki bez PII.

Wymagania:

- bounded batch size,
- timeout i backpressure,
- idempotency per object/policy/action,
- dry-run/report mode,
- rate limiting dla object storage,
- osobny DB principal,
- kill switch,
- brak bypassu hold przy błędzie usługi hold.

Jeżeli hold lookup nie działa, purge zatrzymuje się. Availability nie ma pierwszeństwa przed nieodwracalnym usunięciem.

## 25. Kolejność blokad i race protection

Minimalna kolejność dla pojedynczego rekordu:

1. retention candidate/claim,
2. legal hold scope,
3. canonical domain row,
4. dependent metadata,
5. deletion receipt/outbox.

Przed commit worker ponownie sprawdza:

- policy version,
- terminal state,
- `retention_until`,
- hold version,
- expected aggregate version.

Nowy hold wygrywa z purge, jeśli został zatwierdzony przed commit. Po commit nie można „odtworzyć” purgowanych danych z logów lub backupu tylko w celu utworzenia spóźnionego hold.

## 26. Uprawnienia

Role logiczne:

| Rola | Uprawnienie |
|---|---|
| Privacy Intake | rejestracja żądania bez prawa purge |
| Privacy Verifier | weryfikacja podmiotu bez dostępu do treści domenowych |
| Privacy Orchestrator | publikacja komend i odczyt receipts |
| Domain Privacy Worker | purge wyłącznie własnego kontekstu |
| Legal Hold Approver | utworzenie/zmiana hold według SoD |
| Privacy Reviewer | walidacja kompletności i wyjątku |
| Restore Operator | izolowany restore bez prawa zwolnienia hold |
| Auditor | read-only dostęp do minimalnych evidence |

Jedna osoba nie powinna jednocześnie tworzyć hold, zatwierdzać go i wykonywać nadzwyczajnego eksportu private content.

## 27. Obserwowalność bez wycieku PII

Dozwolone metryki:

- liczba żądań według typu/statusu,
- latency faz,
- liczba retry/failures,
- liczba records purged/anonymized/held per context,
- oldest eligible record age,
- backup replay lag,
- invalid/expired holds.

Zakazane label/log fields:

- user ID, e-mail, nick i IP,
- message ID, jeśli umożliwia publiczną korelację,
- fragment body/subject,
- nazwa pliku,
- reason/evidence plaintext,
- subject HMAC.

Correlation używa `request_id` o ograniczonym dostępie i retencji.

## 28. Tryby awarii

| Awaria | Zachowanie |
|---|---|
| niedostępny bounded context | request `FAILED_RETRYABLE`, brak fałszywego COMPLETE |
| niedostępny legal hold registry | purge zatrzymany fail-closed |
| object storage delete timeout | retry; DB metadata nie udaje pełnego sukcesu |
| duplicate event | idempotent receipt, brak podwójnego skutku |
| stale policy version | abort batch i ponowne planowanie |
| restore bez deletion ledger | środowisko `NO-GO` |
| read model nie potwierdził delete | request nie może być `COMPLETED` |
| hold wygasł | automatycznie `expired`, rekord wraca do oceny purge |
| częściowy delete | jawny `PARTIALLY_RESTRICTED`, manual review |
| utrata privacy salt | incident; brak cichego tworzenia nowej mapy |

## 29. Testy obowiązkowe

### 29.1. Unit

- clock calculation dla każdej policy,
- terminal action,
- hold scope matching,
- policy version applicability,
- anonymization removes all direct/quasi identifiers,
- export redaction.

### 29.2. Integration

- delete aktywnego konta,
- delete konta z aktywnym meczem,
- delete jednej strony private message,
- delete obu stron i attachment purge,
- chat message z moderation hold,
- newsletter consent po account delete,
- ranking rebuild po anonimizacji,
- object storage retry,
- outbox duplicate delivery.

### 29.3. Concurrency

- hold vs purge,
- account delete vs login/session refresh,
- delete vs message send,
- delete vs match command,
- policy update vs claimed batch,
- hold release vs worker retry.

### 29.4. Restore

- restore zawiera wcześniej usunięte dane,
- deletion ledger replay usuwa je przed dostępem,
- active hold jest zachowany,
- read models są odbudowane po replay,
- izolowane środowisko jest niszczone w deadline.

### 29.5. Negative proof

- wyszukiwanie po ID/e-mail/nick po complete,
- brak obiektu w storage,
- brak hitu w search index/cache,
- brak PII w logach i audit payload,
- eksport nie zawiera danych innych osób.

## 30. Migracja AS-IS

Przed włączeniem purge:

1. zinwentaryzuj wszystkie tabele i storage paths,
2. przypisz każdemu rekordowi policy code/version,
3. ustal wiarygodny retention clock,
4. rekordy bez clock kieruj do quarantine/review, nie wymyślaj dat,
5. wykryj CASCADE sprzeczne z ownership,
6. zbuduj deletion dependency graph,
7. zinwentaryzuj read models, cache, search i export artifacts,
8. uruchom dry-run z countami,
9. wykonaj backup + restore test,
10. włącz workery kontekstami i małymi batchami,
11. porównaj counts oraz oldest eligible age,
12. dopiero potem rozważ usuwanie legacy.

Legacy audit, crypto, wiadomości i moderation evidence nie mogą zostać purgowane wyłącznie dlatego, że nie pasują do nowego modelu.

## 31. Wpływ na ADR-V3-013

`ADR-V3-013` musi przyjąć następujące wymagania:

- deletion ledger i privacy events są wejściem rebuild,
- checkpoint nie może wyprzedzić durable delete receipt,
- rebuild nie może przywrócić danych usuniętych,
- projekcja ma własny owner i retention nie dłuższy niż source,
- ranking/search/cache potwierdzają delete,
- snapshot read modelu nie jest privacy source of truth.

## 32. Alternatywy odrzucone

### A. Jedno `ON DELETE CASCADE` od `users`

Odrzucone: niszczy dane drugiej strony, historię i granice kontekstów.

### B. Soft-delete wszystkiego bez purge

Odrzucone: nie realizuje ograniczenia retencji ani skutecznego usunięcia.

### C. Bezterminowa retencja „na wszelki wypadek”

Odrzucone: brak celu i clock, rosnące ryzyko i koszt.

### D. Natychmiastowa mutacja wszystkich backupów

Odrzucone: ryzyko utraty integralności backupu; stosujemy expiry + replay ledger.

### E. Jeden centralny superuser kasujący wszystkie tabele

Odrzucone: łamie least privilege i ownership.

### F. Hold bez expiry

Odrzucone: tworzy niekontrolowaną retencję bez review.

## 33. Konsekwencje

### Korzyści

- wykonalne prawa użytkownika,
- ochrona historii i praw innych osób,
- możliwość zachowania anonimowej historii gier/Pokera,
- audytowalne wyjątki,
- bezpieczny restore,
- zgodność read models i cache,
- mierzalny program retencji.

### Koszty

- orchestrator i workery per context,
- deletion ledger oraz hold registry,
- testy restore/replay,
- object storage receipts,
- przegląd prawny i cykliczna rewizja polityki,
- większa złożoność niż globalny cascade.

Koszty są akceptowane, ponieważ purge jest operacją nieodwracalną, a retencja bez kontroli jest ryzykiem bezpieczeństwa i zgodności.

## 34. Kryteria formalnej akceptacji ADR

ADR może otrzymać `ACCEPTED / FINAL`, gdy reviewer potwierdzi:

- ownera Privacy/Legal i ownerów domen,
- zgodność okresów z celami i podstawami,
- poprawność reguł Identity, Game, Poker, Messaging, Chat, Newsletter, Moderation i Audit,
- rozdział delete/pseudonymize/anonymize/restrict,
- wąski i terminowy legal hold,
- backup expiry + deletion replay,
- wykonalność read-model rebuild bez resurrection,
- brak destrukcyjnego account cascade,
- kompletność failure model i testów,
- brak sekretów oraz PII w evidence,
- brak autoryzacji wdrożenia.

## 35. Rekord architecture review i provenance

Review record: [`REV-ADR-V3-012-20260831-01`](00-ARCHITECTURE-REVIEW-PROVENANCE-REGISTER.md#6-review-record--adr-v3-012)  
Privacy/Legal review pack: [`REV-ADR-V3-012-20260901-PL-01`](REV-ADR-V3-012-PRIVACY-LEGAL-REVIEW-PACK.md)  
Review pack baseline SHA: `28ff688e57814fc0bca1ce88192d94d021985e5d`  
Review pack commit SHA: `a2d04f25ef0faffb248ca789753a0a5f76000b46`  
Review baseline SHA: `c96b893854717d5b75947a0c76fc01bd8cf3ee65`  
Review type: `EXTERNAL ARCHITECTURE REVIEW / PRIVACY-LEGAL EXCLUDED`  
Git author: `developergracz`  
Reviewer role: `External Lead Architect reviewer — architecture scope only`  
Reviewer identity in Git: `NOT RECORDED`  
Architecture verdict: `PASS WITH CONDITIONS`  
Privacy/Legal authority: `PENDING / UNASSIGNED`  
Provenance class: `EXTERNAL_RECORDED / IDENTITY NOT GIT-VERIFIABLE`

Git nie potwierdza tożsamości ani niezależności reviewera. Werdykt architektoniczny nie jest opinią prawną i nie zastępuje formalnej akceptacji Privacy/Legal.

## 36. Wynik projektowy

```text
ADR-V3-012 DESIGN = COMPLETE
P0 DECISION CONTENT = COMPLETE
ARCHITECTURE REVIEW = PASS WITH CONDITIONS / EXTERNAL EVIDENCE RECORDED
REVIEW PROVENANCE = PARTIAL / REVIEWER IDENTITY NOT RECORDED IN GIT
PRIVACY-LEGAL REVIEW PACK = READY / NOT APPROVED
PRIVACY-LEGAL OWNER = UNASSIGNED
FORMAL PRIVACY-LEGAL REVIEW = NOT EXECUTED
PRIVACY-LEGAL ACCEPTANCE = PENDING / UNASSIGNED
FORMAL ACCEPTANCE = PENDING REVIEW
IMPLEMENTATION = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

## 37. Referencje regulacyjne

- RODO — tekst oficjalny EUR-Lex: `https://eur-lex.europa.eu/eli/reg/2016/679/oj`
- UODO — określanie okresu przechowywania: `https://uodo.gov.pl/pl/676/4260`
- UODO — zasada ograniczenia przechowywania i obowiązek ustalenia działań po okresie: `https://uodo.gov.pl/pl/676/4262`

Referencje regulacyjne są ograniczeniami projektu. Formalna interpretacja dla Gracz.pl należy do wyznaczonego właściciela Privacy/Legal.
