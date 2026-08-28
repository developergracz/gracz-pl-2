# ETAP 3 — Audyt writerów AS-IS i plan naprawy blockerów

Data: 28.08.2026
Bazowy kod AS-IS: `origin/main @ db3c15a`
Status: **ANALIZA WYKONANA / PRODUKCJA NADAL NO-GO DLA DDL**

## 1. Cel

Powiązać wykryte w produkcji anomalie danych z rzeczywistymi writerami AS-IS i przygotować niedestrukcyjny plan naprawy przed V3 EXPAND/BACKFILL.

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
1. normalizuje wyłącznie `targetId` przez `trim().toLowerCase()`,
2. odrzuca pusty target i relację do samego siebie,
3. sprawdza tylko, czy relacja A-B lub B-A już istnieje,
4. następnie wykonuje `INSERT INTO gracz_chat_friends(...)` z `user.userId` oraz `targetId`.

Writer **nie sprawdza w `gracz_accounts` istnienia ani requestera, ani addressee**.

`trustedChatUser()` sprawdza poprawność tokenu/sesji, ale nie wykonuje lookupu konta w `gracz_accounts`. Oznacza to, że ważny principal z tokenu nie jest w tym miejscu ponownie wiązany z kanonicznym rekordem konta.

### Ocena przyczyny DQ-001

**POTWIERDZONE:** kod pozwala zapisać friendship bez referencyjnej weryfikacji konta.

**WYMAGA WERYFIKACJI HISTORYCZNEJ:** sam baseline `db3c15a` nie dowodzi, który historyczny endpoint/deploy utworzył principal typu `guest-*`. Aktualny frontend Global Chat wymaga `/auth/me` i po błędzie wraca na stronę główną. Nie należy więc twierdzić bez logów/historii deployu, że obecny frontend generuje guestów.

Wniosek: istniejący orphan jest zgodny z luką referencyjną writera, ale dokładna geneza konkretnego guest principal wymaga historycznego correlation/deploy evidence.

---

## 3. POTWIERDZONE — writer kont i normalizacja e-mail

Źródło: `modern/checkers-engine/src/postgres-accounts.js` @ `db3c15a`.

### Normalizacja

`cleanEmail(value)` wykonuje:
- `trim()`,
- `toLowerCase()`,
- ograniczenie do 254 znaków.

### Rejestracja

`PostgresAccountService.register()`:
- oblicza `safeEmail = cleanEmail(email)`,
- bierze advisory lock dla `email:${safeEmail}`,
- sprawdza `SELECT 1 FROM gracz_accounts WHERE lower(email)=lower($1)`,
- przy trafieniu zwraca `EMAIL_EXISTS`,
- dopiero potem wykonuje INSERT.

### Aktualizacja profilu

`updateProfile()` stosuje tę samą normalizację oraz kontrolę duplikatu dla innego `user_id`.

### Warstwa SecureAccountService

Źródło: `modern/checkers-engine/src/secure-accounts.js` @ `db3c15a`.

`SecureAccountService.register()` deleguje utworzenie rekordu do `this.base.register(input)`, czyli w konfiguracji PostgreSQL do `PostgresAccountService.register()`.

### Ocena przyczyny DQ-002

**POTWIERDZONE:** writer bazowy `db3c15a` nie powinien dopuścić nowej kolizji wynikającej wyłącznie z case/leading/trailing whitespace w e-mailu podczas standardowej rejestracji lub `updateProfile()`.

Dlatego 2 istniejące grupy / 5 kont **nie są wyjaśnione przez bieżącą ścieżkę standardowej rejestracji w baseline**.

Najbardziej prawdopodobne klasy źródła, wymagające dowodu historycznego:
- wcześniejsza wersja writera przed wdrożeniem tej kontroli,
- inny writer/import/migracja,
- deploy drift pomiędzy repo a działającą wersją,
- ręczna/administracyjna mutacja danych.

Nie wolno arbitralnie przypisać jednej z tych przyczyn bez logów/commit-deploy correlation.

### Dodatkowe ryzyko bezpieczeństwa

`SecureAccountService.requestPasswordReset()` dla e-maila wybiera:
`... WHERE lower(email)=lower($1) ORDER BY created_at DESC LIMIT 1`.

Przy istniejących duplikatach normalized-email oznacza to niejednoznaczność semantyczną: żądanie resetu może być przypisane do najnowszego pasującego rekordu zamiast do jednoznacznej tożsamości. Jest to powód, aby DQ-002 traktować jako **BLOCKER Identity**, a nie kosmetyczną duplikację.

---

## 4. POTWIERDZONE — writer newslettera i dwa pola consent

Źródła:
- `modern/checkers-engine/src/newsletter.js` @ `db3c15a`,
- `modern/checkers-engine/src/newsletter-lifecycle-recorder.js` @ `db3c15a`.

### Aktualny lifecycle

`NewsletterService` definiuje i używa pola `consented_at`.

Przy ponownym subscribe istniejącego rekordu writer ustawia m.in.:
- `consent_version=...`,
- `consented_at=NOW()`,
- status `pending_confirmation`,
- nowe tokeny lifecycle.

Przy nowym INSERT pole `consented_at` korzysta z DEFAULT `NOW()`.

W przeanalizowanym aktualnym writerze `newsletter.js` pole legacy `consent_at` nie jest używane do tego lifecycle.

`NewsletterLifecycleRecorder.captureSubscribe()` pobiera `subscriber.consented_at` i zapisuje właśnie ten timestamp jako zdarzenie zgody `granted` w `newsletter_consent_history`.

### Ocena przyczyny DQ-003

**POTWIERDZONE:** aktualny lifecycle traktuje `consented_at` jako źródło czasu udzielenia zgody.

**POTWIERDZONE ze schematu produkcyjnego:** `consent_at` i `consented_at` współistnieją w hybrydowej tabeli legacy/new.

Dlatego 3 rozbieżności należy interpretować jako drift semantyki legacy/new, a nie automatycznie jako korupcję danych.

Nie należy nadpisywać `consent_at = consented_at` bez zachowania provenance i bez ustalenia znaczenia starego pola.

---

## 5. Plan naprawy DQ-001 — orphan friendship

### Zakaz

Nie wykonywać automatycznego `UPDATE requester_id`, ponieważ nie istnieje dowód mapujący guest principal do konkretnego pełnego konta.

### Zalecana decyzja V3

Persistent social relation ma wskazywać wyłącznie kanoniczne Identity V3.
Guest/anonymous principal nie powinien być trwałym członkiem grafu znajomości, chyba że produkt świadomie wprowadzi osobny typ encji guest.

### Remediation dla istniejącego rekordu

Kolejność:
1. zachować identyfikator relacji i minimalne provenance w raporcie/quarantine,
2. sprawdzić audit/deploy/session evidence, czy da się jednoznacznie wskazać kanoniczne konto requestera,
3. tylko przy jednoznacznym dowodzie wykonać kontrolowane mapowanie,
4. bez takiego dowodu — sklasyfikować rekord jako legacy orphan i wyłączyć go z backfillu V3; fizyczne usunięcie dopiero w CONTRACT po okresie obserwacji.

### Naprawa writera przed cutover

Przed V3 writer cutover:
- requester musi pochodzić z kanonicznej Identity,
- addressee musi istnieć,
- constraint/FK dodawać dopiero po wyzerowaniu orphanów,
- relacja A-B powinna mieć kanoniczny klucz niezależny od kierunku lub równoważny mechanizm zapobiegający race A-B/B-A.

---

## 6. Plan naprawy DQ-002 — normalized-email collisions

### Zakaz

Nie wykonywać automatycznego MERGE ani DELETE pięciu kont.

### Dlaczego

Drill-down potwierdził, że część kont posiada różne zależności biznesowe (m.in. sesje, prywatne wiadomości, reset/registration state). Sam wspólny normalized-email nie dowodzi, że konta należą do tej samej kanonicznej tożsamości.

### Remediation

Dla każdej z 2 grup utworzyć prywatną mapę decyzyjną poza publiczną dokumentacją PII:
- account lineage / created_at,
- verification state,
- ostatnie bezpieczne logowanie,
- zależności FK/logical refs,
- ewentualny audit event rejestracji/zmiany profilu,
- dowód kontroli nad adresem kontaktowym.

Następnie wybrać per konto jedną z polityk:
- **KEEP-CANONICAL** — konto zachowane jako właściciel normalized-email,
- **REQUIRE-EMAIL-CHANGE** — konto zachowane, ale bez prawa do konfliktującego canonical email do czasu ponownej weryfikacji,
- **LEGACY-IDENTITY** — konto migrowane z zachowaniem historii, lecz bez aktywnego canonical email,
- **MERGE** — tylko jeśli istnieje silny, audytowalny dowód tej samej osoby oraz przygotowana jest pełna mapa przepięcia zależności.

Domyślna bezpieczna polityka przy braku dowodu: **nie scalać**.

### Guard przed V3

Docelowa baza musi egzekwować unikalność dokładnie tej samej funkcji normalizacji, której używa aplikacja. Najbezpieczniej przechowywać jawne `email_normalized` i nałożyć UNIQUE na tę wartość, zamiast polegać na rozproszonych `lower(email)` w query.

Reset hasła po e-mailu nie może używać „najpierw/najnowszy pasujący rekord” jako rozstrzygnięcia tożsamości.

---

## 7. Plan naprawy DQ-003 — newsletter consent timestamps

`consented_at` przyjąć w projekcie V3 jako timestamp aktualnego `granted` lifecycle, ponieważ właśnie jego używa aktualny writer i lifecycle recorder.

Legacy `consent_at`:
- zachować jako provenance podczas migracji,
- nie traktować automatycznie jako canonical,
- dla trzech rozbieżnych rekordów zbudować mapping historyczny z consent history/events,
- dla `pending_confirmation` nie interpretować `granted` jako pełnego double-opt-in `confirmed`.

Docelowy model powinien rozdzielać co najmniej:
- moment złożenia zgody/request (`granted/requested` zgodnie z zatwierdzoną semantyką),
- moment potwierdzenia double opt-in,
- moment wycofania,
- wersję zgody i źródło.

---

## 8. Co jest udowodnione, a czego jeszcze nie wolno twierdzić

### POTWIERDZONE

- friendship writer nie weryfikuje referencji do kont,
- tabela friendship nie ma FK do accounts,
- standardowy Postgres account writer normalizuje e-mail trim+lower i blokuje duplikat,
- profile update także sprawdza duplikat,
- secure wrapper deleguje rejestrację do base writer,
- aktualny newsletter używa `consented_at`,
- lifecycle recorder propaguje `consented_at` do consent history,
- produkcja zawiera anomalie wskazane przez drill-down.

### WYMAGA WERYFIKACJI ŚRODOWISKA / HISTORII

- który konkretny deploy utworzył guest principal,
- czy konkretny orphan powstał przez obecny writer czy wcześniejszą wersję,
- który historyczny writer utworzył 5 kont z 2 normalized-email,
- czy którakolwiek para kont reprezentuje tę samą osobę,
- dokładna semantyka starego `consent_at`,
- correlation audit-log -> account creation/profile change dla kolizyjnych kont.

---

## 9. Kryteria zamknięcia bramki Data Quality

DQ-001 można zamknąć, gdy:
- orphan jest jednoznacznie zmapowany albo formalnie zakwalifikowany do quarantine/legacy exclusion,
- nowy writer nie może tworzyć nowych orphanów,
- rerun collector nie wykazuje nieobsłużonego orphan blockera.

DQ-002 można zamknąć, gdy:
- każda z 2 grup ma zatwierdzoną decyzję per account,
- nie ma niejednoznacznego aktywnego canonical normalized-email,
- reset/recovery ma jednoznaczną tożsamość,
- V3 UNIQUE może zostać założony po verify bez konfliktu.

DQ-003 REVIEW można zamknąć, gdy:
- zatwierdzona jest semantyka canonical consent timestamp,
- legacy timestamp jest zachowany jako provenance lub udokumentowanie odrzucony,
- consent history i lifecycle są spójnie backfillowane.

---

## 10. Status ETAPU 3 po tym audycie

Audyt writerów dla trzech wykrytych obszarów blocker/review jest wykonany na baseline `db3c15a`.

**Produkcja pozostaje NO-GO dla executable DDL.**

Nadal otwarte są co najmniej:
- historyczne/correlation evidence potrzebne do decyzji DQ-001/DQ-002,
- pełny writer/reader/endpoint/worker inventory poza tym wycinkiem,
- backup + restore test,
- crypto decryptability/key/AAD compatibility,
- active-state/cutover assessment,
- credential rotation/least privilege,
- fresh schema diff,
- rollback/maintenance/final GO-NO-GO.

Plan DDL może być rozwijany dokumentacyjnie, ale żadne destructive remediation ani produkcyjny EXPAND/BACKFILL nie powinny wystartować przed zamknięciem właściwych bramek.