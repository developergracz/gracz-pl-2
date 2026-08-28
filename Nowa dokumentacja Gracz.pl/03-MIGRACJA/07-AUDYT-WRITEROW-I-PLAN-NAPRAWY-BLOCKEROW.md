# ETAP 3 — Audyt writerów AS-IS i plan naprawy blockerów

Data: 28.08.2026
Bazowy kod AS-IS: `origin/main @ db3c15a`
Status: **ANALIZA WYKONANA / PRODUKCJA NADAL NO-GO DLA DDL**

## 1. Cel

Powiązać wykryte w produkcji anomalie danych z rzeczywistymi writerami AS-IS i historią ich zmian oraz przygotować niedestrukcyjny plan naprawy przed V3 EXPAND/BACKFILL.

Dowód środowiskowy z drill-down:
- 1 orphan friendship,
- 2 grupy kolizji normalized-email obejmujące 5 kont,
- 3 rozbieżności `consent_at` vs `consented_at`.

Dokument nie wykonuje żadnego UPDATE/DELETE/MERGE na produkcji.

---

## 2. POTWIERDZONE — writer friendship / Global Chat

Źródło: `modern/checkers-engine/src/global-chat.js` @ `db3c15a`.

### DDL AS-IS

`gracz_chat_friends` posiada:
- `relation_id UUID PRIMARY KEY`,
- `requester_id TEXT NOT NULL`,
- `addressee_id TEXT NOT NULL`,
- CHECK tylko `requester_id <> addressee_id`,
- UNIQUE tylko kierunkowe `(requester_id, addressee_id)`.

Nie ma FK z `requester_id` ani `addressee_id` do `gracz_accounts`.

### Writer

`GlobalChatService.requestFriend(user, input)`:
1. normalizuje `targetId` przez `trim().toLowerCase()`,
2. odrzuca pusty target i relację do samego siebie,
3. sprawdza tylko, czy relacja A-B lub B-A już istnieje,
4. wykonuje `INSERT INTO gracz_chat_friends(...)` z `user.userId` oraz `targetId`.

Writer **nie sprawdza w `gracz_accounts` istnienia ani requestera, ani addressee**.

`trustedChatUser()` sprawdza token/sesję, ale nie wykonuje lookupu principalu w `gracz_accounts` przed zapisem relacji.

### Historia źródłowa

Funkcja znajomych została dodana w commicie:
- `10a0e625067c007a42de507c50fa3cd820ed7185`,
- 23.08.2026 02:15:31 UTC,
- `Rozbuduj chat o tematy znajomych i zaawansowane wyszukiwanie`.

Patch tego commita wprowadził jednocześnie `gracz_chat_friends` oraz `requestFriend()`. Już w momencie wprowadzenia funkcji tabela nie miała FK do accounts, a writer nie wykonywał account-existence check.

Produkcyjny orphan został utworzony później, 26.08.2026. Chronologia jest więc zgodna z tym, że działał writer podatny na zapis niekanonicznego principalu.

### Ocena przyczyny DQ-001

**POTWIERDZONE:** od początku funkcji friendship w przeanalizowanej historii kodowej istniała luka referencyjna pozwalająca zapisać relację bez potwierdzenia obu kont.

**WYMAGA WERYFIKACJI HISTORYCZNEJ:** nie ustalono jeszcze kodowego źródła samego principalu `guest-*`. Baseline frontend Global Chat korzysta z `/auth/me` i po braku autoryzacji wraca na stronę główną. Nie wolno więc twierdzić bez dodatkowego dowodu, że aktualny frontend generuje guestów.

---

## 3. POTWIERDZONE — writer kont i normalizacja e-mail

Źródło: `modern/checkers-engine/src/postgres-accounts.js` @ `db3c15a`.

### Aktualna normalizacja

`cleanEmail(value)` wykonuje:
- `trim()`,
- `toLowerCase()`,
- ograniczenie do 254 znaków.

### Aktualny guard

`PostgresAccountService.register()`:
- oblicza `safeEmail = cleanEmail(email)`,
- bierze advisory lock dla `email:${safeEmail}`,
- sprawdza `SELECT 1 FROM gracz_accounts WHERE lower(email)=lower($1)`,
- przy trafieniu zwraca `EMAIL_EXISTS`,
- dopiero potem wykonuje INSERT.

`updateProfile()` stosuje analogiczną kontrolę dla innego `user_id`.

`SecureAccountService.register()` deleguje utworzenie konta do `this.base.register(input)`, czyli przy PostgreSQL do powyższego writera.

### Historyczne potwierdzenie momentu wprowadzenia ochrony

Historia Git pokazuje, że ochrona przed duplikatem e-mail została dodana dopiero w commicie:
- `6e7a55ea8e5d2f4db4dabb2e15d1e1acb459bf1c`,
- 27.08.2026 07:31:58 UTC,
- `Require unique email for account recovery`.

Patch dodał dokładnie guardy e-mail w `register()` oraz `updateProfile()`.

Privacy-safe chronologia pięciu kont z kolizji:

| Konto w grupie | `created_at` UTC | Względem commita guard |
|---|---|---|
| A1 | 26.08.2026 04:54:06 | przed guardem |
| A2 | 26.08.2026 22:36:57 | przed guardem |
| B1 | 22.08.2026 00:19:00 | przed guardem |
| B2 | 26.08.2026 04:42:01 | przed guardem |
| B3 | 27.08.2026 07:20:25 | przed guardem |

Najpóźniejsze z kolizyjnych kont powstało około **11 min 33 s przed commitem**, który dodał kontrolę unikalności e-mail.

### Ocena przyczyny DQ-002

**POTWIERDZONE KODOWO I CHRONOLOGICZNIE:** wszystkie 5 kont z kolizji istniało przed wprowadzeniem do repozytorium guardu unique-email. To usuwa wcześniejszą sprzeczność: obecny baseline nie powinien tworzyć takich duplikatów, ale historyczna wersja kodu przed 27.08.2026 nie posiadała tej ochrony.

**WYMAGA WERYFIKACJI ŚRODOWISKA:** czas commita nie jest automatycznie czasem deployu Render. Nadal nie wolno twierdzić bez deploy/audit correlation, że każdy z pięciu rekordów powstał dokładnie przez standardowy endpoint rejestracji, choć chronologia bardzo silnie wspiera scenariusz pre-guard.

### Dodatkowe ryzyko bezpieczeństwa

`SecureAccountService.requestPasswordReset()` dla e-maila wybiera:
`... WHERE lower(email)=lower($1) ORDER BY created_at DESC LIMIT 1`.

Przy istniejących duplikatach normalized-email odzyskiwanie jest semantycznie niejednoznaczne: system może wybrać najnowsze pasujące konto. DQ-002 pozostaje **BLOCKER Identity** do czasu uporządkowania tożsamości i recovery.

---

## 4. POTWIERDZONE — writer newslettera i dwa pola consent

Źródła:
- `modern/checkers-engine/src/newsletter.js` @ `db3c15a`,
- `modern/checkers-engine/src/newsletter-lifecycle-recorder.js` @ `db3c15a`.

Aktualny `NewsletterService` definiuje i używa `consented_at`. Przy ponownym subscribe ustawia `consented_at=NOW()`, a dla nowego INSERT pole korzysta z DEFAULT `NOW()`.

W aktualnym writerze `newsletter.js` legacy `consent_at` nie jest używane do nowego lifecycle.

`NewsletterLifecycleRecorder.captureSubscribe()` pobiera `subscriber.consented_at` i zapisuje ten timestamp jako zdarzenie zgody `granted` w `newsletter_consent_history`. Potwierdzenie double opt-in używa osobnego `confirmed_at`.

### Ocena DQ-003

**POTWIERDZONE:** aktualny lifecycle traktuje `consented_at` jako źródło czasu udzielenia zgody/request, a `confirmed_at` jako moment potwierdzenia.

**POTWIERDZONE ze schematu produkcyjnego:** `consent_at` i `consented_at` współistnieją w hybrydowej tabeli legacy/new.

Trzech rozbieżności nie należy automatycznie „naprawiać” przez zrównanie pól. Legacy timestamp należy zachować jako provenance do czasu pełnego backfillu i interpretacji historycznej.

---

## 5. Plan naprawy DQ-001 — orphan friendship

Nie wykonywać automatycznego `UPDATE requester_id`, ponieważ nie istnieje dowód mapujący guest principal do konkretnego pełnego konta.

Kolejność remediation:
1. zachować identyfikator relacji i minimalne provenance,
2. sprawdzić dostępne audit/session/deploy evidence dla guest principal,
3. tylko przy jednoznacznym dowodzie wykonać mapowanie do kanonicznej Identity,
4. bez dowodu — oznaczyć rekord jako legacy orphan/quarantine i wyłączyć go z backfillu V3,
5. fizyczne usunięcie dopiero w CONTRACT po okresie obserwacji i zatwierdzeniu.

Przed writer cutover V3:
- requester i addressee muszą być rozwiązywani do kanonicznej Identity,
- FK/constraint dopiero po wyzerowaniu nieobsłużonych orphanów,
- relacja A-B musi mieć kanoniczny mechanizm zapobiegający równoległemu A-B/B-A.

---

## 6. Plan naprawy DQ-002 — normalized-email collisions

Nie wykonywać automatycznego MERGE ani DELETE pięciu kont.

Dla każdej z dwóch grup potrzebna jest decyzja per konto oparta na:
- lineage/created_at,
- verification state,
- zależnościach sesji/wiadomości/resetów/kodów,
- audit events rejestracji/zmian profilu, jeśli dostępne,
- dowodzie kontroli nad kanałem kontaktowym.

Dozwolone polityki:
- **KEEP-CANONICAL**,
- **REQUIRE-EMAIL-CHANGE**,
- **LEGACY-IDENTITY**,
- **MERGE** tylko przy silnym i audytowalnym dowodzie tej samej tożsamości oraz pełnej mapie przepięcia zależności.

Domyślna polityka przy braku dowodu: **nie scalać**.

V3 powinno przechowywać jawne `email_normalized` i egzekwować UNIQUE dokładnie na tej samej funkcji normalizacji, której używa aplikacja. Password recovery nie może rozstrzygać konfliktu przez `ORDER BY created_at DESC LIMIT 1`.

---

## 7. Plan naprawy DQ-003 — newsletter consent timestamps

`consented_at` traktować jako kandydat canonical timestamp aktualnego lifecycle, zgodnie z aktualnym writerem i lifecycle recorderem.

Legacy `consent_at`:
- zachować jako provenance,
- nie nadpisywać automatycznie,
- skorelować z `newsletter_consent_history` i `newsletter_events`,
- dla `pending_confirmation` nie utożsamiać request/granted z pełnym double-opt-in `confirmed`.

Docelowy model ma jawnie rozdzielać request/granted, confirmation, revocation, consent version i source.

---

## 8. Klasyfikacja dowodów

### POTWIERDZONE

- friendship writer nie weryfikuje referencji do accounts,
- friendship funkcja została wprowadzona 23.08.2026 już bez FK/account-existence check,
- orphan powstał po wprowadzeniu tego podatnego writera,
- aktualny account writer normalizuje e-mail trim+lower i blokuje duplikaty,
- guard unique-email został dodany dopiero 27.08.2026 07:31:58 UTC,
- wszystkie 5 kolizyjnych kont ma `created_at` sprzed tego commita,
- aktualny newsletter używa `consented_at`,
- lifecycle recorder propaguje `consented_at` do consent history,
- produkcja zawiera anomalie wskazane przez drill-down.

### WYMAGA WERYFIKACJI ŚRODOWISKA / HISTORII

- źródło principalu `guest-*`,
- dokładny deploy Render, w którym powstał orphan,
- dokładny endpoint/deploy odpowiadający za każde z pięciu kont,
- czy którakolwiek para kont reprezentuje tę samą osobę,
- pełna historyczna semantyka `consent_at`,
- correlation audit-log -> account creation/profile change.

---

## 9. Kryteria zamknięcia Data Quality

DQ-001 zamknięty, gdy orphan jest jednoznacznie zmapowany albo formalnie objęty quarantine/legacy exclusion, nowy writer nie może tworzyć nowych orphanów i rerun nie wykazuje nieobsłużonego blockera.

DQ-002 zamknięty, gdy każda z 2 grup ma decyzję per account, istnieje tylko jedna aktywna canonical identity per normalized-email, recovery jest jednoznaczne i przyszły V3 UNIQUE przechodzi VERIFY bez konfliktu.

DQ-003 REVIEW zamknięty, gdy zatwierdzona jest semantyka canonical consent timestamp, legacy provenance jest zachowane i consent history/events są spójnie backfillowane.

---

## 10. Status ETAPU 3

Audyt writerów i historyczna korelacja źródłowa zostały znacząco zawężone. DQ-002 ma potwierdzoną chronologię **pre-guard**, a DQ-001 ma potwierdzoną lukę istniejącą od momentu wprowadzenia friendship.

**Produkcja nadal pozostaje NO-GO dla executable DDL.**

Nadal otwarte:
- guest principal / deploy correlation DQ-001,
- per-account remediation decision DQ-002,
- pełny writer/reader/endpoint/worker inventory,
- backup + restore test,
- crypto decryptability/key/AAD compatibility,
- active-state/cutover assessment,
- credential rotation/least privilege,
- fresh schema diff,
- rollback/maintenance/final GO-NO-GO.

Plan DDL może być rozwijany dokumentacyjnie, ale żadne destructive remediation ani produkcyjny EXPAND/BACKFILL nie powinny wystartować przed zamknięciem właściwych bramek.