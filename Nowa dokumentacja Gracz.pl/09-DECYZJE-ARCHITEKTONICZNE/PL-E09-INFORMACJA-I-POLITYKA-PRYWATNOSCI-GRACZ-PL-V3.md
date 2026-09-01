# Gracz.pl V3 — PL-E09 Informacja / polityka prywatności

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / DRAFT EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E09`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązana mapa celów/podstaw: `PL-E03-MAPA-CELOW-I-PODSTAW-PRAWNYCH-GRACZ-PL-V3.md`  
Powiązane evidence: `PL-E04`, `PL-E05`, `PL-E06`, `PL-E07`, `PL-E08`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument jest projektem obowiązku informacyjnego / polityki prywatności dla Gracz.pl V3 oraz formalnym evidence dla PL-E09. Nie jest jeszcze wersją publikacyjną. Nie stanowi porady prawnej ani potwierdzenia zgodności produkcyjnej. Wszystkie pola `PENDING`, `PROPOSED`, `TO VERIFY` i `HOLD` muszą zostać rozstrzygnięte przed publikacją i przed oznaczeniem ADR-V3-012 jako `ACCEPTED / FINAL`.

---

## 1. Administrator danych

Administratorem danych osobowych w projekcie Gracz.pl jest:

**Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu.**

Dane kontaktowe administratora do wersji publikacyjnej:

- adres korespondencyjny: `PENDING`;
- e-mail do spraw prywatności i praw osób: `PENDING`;
- inne kanały kontaktu: `PENDING`.

Do czasu uzupełnienia danych kontaktowych dokument nie może zostać uznany za gotową informację publikacyjną.

---

## 2. Zakres polityki

Polityka obejmuje przetwarzanie danych związane z:

1. rejestracją, kontem i profilem;
2. logowaniem, sesjami, recovery i MFA;
3. grami, meczami, rankingiem i turniejami;
4. wiadomościami prywatnymi, załącznikami, chatem i funkcjami społecznościowymi;
5. newsletterem i komunikacją e-mail;
6. moderacją, zgłoszeniami, sankcjami i odwołaniami;
7. audytem, bezpieczeństwem i anti-abuse;
8. realizacją praw osób;
9. logami, metrykami i telemetry;
10. backupami, restore i deletion replay.

---

## 3. Kategorie danych

W zależności od używanej funkcji Gracz.pl może przetwarzać m.in.:

- identyfikator użytkownika, login/nazwę, e-mail, ustawienia i dane profilu;
- hashe haseł, dane sesji, token metadata i dane MFA;
- dane dotyczące gier: match/game IDs, ruchy, eventy, snapshoty, wyniki, ranking i udział w turniejach;
- metadane oraz zaszyfrowaną treść wiadomości prywatnych i załączników;
- treść publicznego chatu, reakcje i relacje social;
- dane newslettera: e-mail, status subskrypcji, dowód zgody, telemetry dostarczenia;
- dane moderacyjne: zgłoszenia, sankcje, odwołania, minimalne evidence;
- dane techniczne i bezpieczeństwa, np. IP/UA tam, gdzie są rzeczywiście niezbędne, correlation IDs, logi i security signals;
- minimalne dane związane z realizacją żądań privacy/RODO.

Gracz.pl nie powinien domyślnie wymagać danych takich jak PESEL, numer dokumentu tożsamości, dokładna lokalizacja, dane zdrowotne ani inne szczególne kategorie danych, chyba że w przyszłości powstanie odrębna, jawnie zatwierdzona potrzeba prawna i projektowa.

---

## 4. Cele i podstawy prawne — status projektowy

Poniższe podstawy są zgodne z bieżącą mapą PL-E03, ale pozostają przedmiotem formalnego review:

| Cel | Podstawa projektowa | Status |
|---|---|---|
| utworzenie i prowadzenie konta | art. 6 ust. 1 lit. b RODO | `PROPOSED` |
| logowanie, sesje, recovery, podstawowe MFA | art. 6 ust. 1 lit. b RODO | `PROPOSED` |
| bezpieczeństwo, anti-abuse, część telemetry | art. 6 ust. 1 lit. f RODO | `PROPOSED / LIA REQUIRED` |
| gry, mecze, ranking i turnieje | art. 6 ust. 1 lit. b RODO; wybrane cele integrity/anti-abuse mogą wymagać lit. f | `PROPOSED` |
| prywatne wiadomości i funkcje komunikacyjne | art. 6 ust. 1 lit. b RODO | `PROPOSED` |
| moderacja i ochrona społeczności | art. 6 ust. 1 lit. f RODO | `PROPOSED / LIA REQUIRED` |
| newsletter / marketing | art. 6 ust. 1 lit. a RODO | `PROPOSED / CONSENT MODEL PENDING` |
| wykonanie praw osób | art. 6 ust. 1 lit. c RODO w zakresie obowiązków RODO | `PROPOSED / SPECIFIC DUTY TO RECORD` |
| audit i bezpieczeństwo działań uprzywilejowanych | art. 6 ust. 1 lit. f RODO lub lit. c wyłącznie przy wskazanym obowiązku | `PROPOSED / LIA OR LEGAL DUTY REQUIRED` |
| backup/restore i ciągłość usługi | art. 6 ust. 1 lit. b i/lub f zależnie od procesu | `PENDING FINAL REVIEW` |

Lawful-basis/LIA, material retention, newsletter consent oraz pełna DPIA/model 16–17 zostały rozstrzygnięte w authoritative records `P1-PL-001`, `002`, `004` i `005`. Pełny `PASS` nadal wymaga ich finalnej publikacyjnej synchronizacji oraz zamknięcia otwartych danych kontaktowych, providerów/transferów i dowodów operacyjnych.

---

## 5. Odbiorcy i procesorzy

Dane mogą być ujawniane wyłącznie odbiorcom lub dostawcom niezbędnym do konkretnego celu.

### 5.1. Dostawcy infrastruktury — status bieżący

- **Render** — hosting/runtime/PostgreSQL; region `Frankfurt` potwierdzony dla wskazanych zasobów, a account-effective DPA, plan, subprocesorzy i pełna ścieżka processing/support nadal wymagają evidence;
- **Cloudflare Turnstile** — `INTEGRATED IN CODE`; account/widget approval, aktywny product scope, account-effective DPA i transfer review: `PENDING`;
- **Resend Email API** — `INTEGRATED IN CODE`; publiczny DPA i publiczny model transferu są udokumentowane, a aktywne konto/domena/plan, account-effective DPA i faktyczna aktywność: `PENDING`;
- object storage załączników: `PENDING PROVIDER SELECTION`;
- observability/logging: `PENDING PROVIDER MODEL`;
- ewentualni inni dostawcy MFA/SMS/anti-abuse: `NOT APPROVED / PENDING`.

Nazwa dostawcy w projekcie nie oznacza automatycznego zatwierdzenia go jako procesora.

### 5.2. Odbiorcy funkcjonalni

- odbiorca prywatnej wiadomości otrzymuje dane konieczne do komunikacji;
- publiczni użytkownicy widzą wyłącznie dane jawnie przeznaczone do publikacji, np. publiczną nazwę, ranking lub publiczny chat;
- administratorzy i moderatorzy uzyskują dostęp tylko w zakresie need-to-know/RBAC;
- organy publiczne mogą otrzymać dane wyłącznie na podstawie konkretnego, prawnie skutecznego obowiązku lub żądania.

---

## 6. Transfery poza Europejski Obszar Gospodarczy

Status: **TO VERIFY PER PROVIDER**.

Gracz.pl nie przyjmuje założenia „brak transferu poza EOG” wyłącznie na podstawie nazwy lub deklarowanego regionu dostawcy. Dla każdego procesora/subprocesora należy zweryfikować:

- miejsce przetwarzania i przechowywania;
- zdalny dostęp support/operations;
- listę subprocesorów;
- właściwy mechanizm transferowy, jeśli wymagany;
- możliwość ograniczenia regionu;
- skuteczne usuwanie danych i backupów.

Wersja publikacyjna polityki musi odzwierciedlać rzeczywiście zatwierdzony stan.

---

## 7. Okresy przechowywania — wartości projektowe ADR-V3-012

Poniższe okresy są docelową polityką projektową i podlegają formalnemu zatwierdzeniu Privacy/Legal:

| Kategoria | Projektowy okres / kryterium |
|---|---|
| aktywne konto i profil | do usunięcia konta |
| konto po zweryfikowanym żądaniu | maks. 30 dni w aktywnych systemach |
| publiczna widoczność profilu po delete | maks. 24 h |
| sesje | 30 dni po expiry/revoke/delete |
| reset/registration token metadata | 7 dni |
| zakończone game/match events z identyfikatorem | 36 miesięcy |
| snapshoty zakończonych meczów | 90 dni |
| tournament history z identyfikatorem | 36 miesięcy |
| ranking | aktywne konto + do 30 dni po usunięciu z projekcji |
| prywatne wiadomości | 36 miesięcy, z party-state rules |
| po usunięciu wiadomości przez obie strony | 30 dni grace |
| publiczny chat | 12 miesięcy |
| chat edit/delete events | 24 miesiące |
| newsletter pending | 30 dni |
| newsletter token metadata | 7 dni |
| unsubscribed record | 24 miesiące |
| consent proof | projektowo 6 lat — `LEGAL REVIEW REQUIRED` |
| moderacja / sankcje / appeals | projektowo 36 miesięcy |
| security events | 12 miesięcy |
| application logs | 30 dni |
| security logs | 90 dni |
| raw traces | 14 dni |
| anonimowe/agregowane metryki | do 13 miesięcy, jeśli faktycznie anonimowe |
| backup dzienny | 35 dni |
| backup tygodniowy | 12 tygodni |
| backup miesięczny | 12 miesięcy |
| izolowane środowisko restore | maks. 7 dni po zakończeniu testu |

Po upływie właściwego okresu dane powinny zostać usunięte, zanonimizowane albo objęte inną zatwierdzoną akcją końcową. Legal hold może wstrzymać purge tylko dla wąskiego, udokumentowanego zakresu.

---

## 8. Prawa osoby

W zakresie przewidzianym przez RODO użytkownik może mieć prawo do:

- dostępu do danych;
- sprostowania;
- usunięcia;
- ograniczenia przetwarzania;
- sprzeciwu;
- przenoszenia danych, jeśli ma zastosowanie;
- wycofania zgody bez wpływu na zgodność wcześniejszego przetwarzania opartego na zgodzie;
- wniesienia skargi do właściwego organu nadzorczego.

Procedury realizacji tych praw są objęte odrębnym evidence PL-E12 i nie są jeszcze uznane za produkcyjnie gotowe.

---

## 9. Małoletni

Bieżący model projektowy PL-E05:

- minimalny wiek samodzielnego konta: **16 lat**;
- poniżej 16 lat: brak dostępu w bazowym modelu V3;
- oddzielny model zgody rodzica/opiekuna nie jest obecnie wdrażany;
- użytkownicy 16–17 lat wymagają zwiększonej ochrony prywatności;
- marketingowe profilowanie małoletnich nie jest dozwolone w obecnym baseline;
- przed finalnym `PASS` wymagane jest potwierdzenie DPIA screening oraz treści regulaminu i privacy notice.

Zmiana tego modelu wymaga nowego formalnego review.

---

## 10. Bezpieczeństwo danych

Projekt V3 przewiduje m.in.:

- kontrolę dostępu i RBAC;
- MFA dla uprzywilejowanych operacji;
- szyfrowanie transmisji;
- szyfrowanie lub inne odpowiednie zabezpieczenie danych wrażliwych projektowo;
- zakaz logowania sekretów i plaintext prywatnych wiadomości;
- audyt działań uprzywilejowanych;
- retencję logów i telemetry;
- deletion ledger oraz anti-resurrection po restore;
- backup/restore z ograniczoną retencją.

Są to wymagania projektowe. Dokument nie twierdzi, że wszystkie zostały już wdrożone lub operacyjnie potwierdzone.

---

## 11. Zautomatyzowane podejmowanie decyzji i profilowanie

Status: `PENDING FINAL INVENTORY`.

Na obecnym etapie dokumentacja nie ustanawia systemu podejmującego wobec użytkownika decyzje wywołujące skutki prawne lub podobnie istotne wyłącznie automatycznie. Ranking, matchmaking, anti-abuse lub moderacja automatyczna wymagają odrębnego sprawdzenia przed użyciem, jeśli ich wpływ wzrośnie do poziomu wymagającego szczególnej informacji lub oceny.

---

## 12. Cookies / local storage / podobne technologie

Status: `PARTIAL / REPOSITORY-SCOPE INVENTORY CONFIRMED / PROVIDER-ACCOUNT SCOPE OPEN`.

Inwentarz potwierdzony bezpośrednio w aktualnym kodzie nowoczesnego frontendu i backendu:

| Mechanizm | Typ / cel | Stan potwierdzony w repo | Otwarte przed publikacją |
|---|---|---|---|
| `__Host-gracz_session` | niezbędny cookie sesyjny auth/guest | `HttpOnly`, `Secure`; `SameSite=Strict` dla auth i `SameSite=Lax` dla guest/lobby; `Max-Age` odpowiednio 3600/1800 s | ujednolicić opis dwóch flow i potwierdzić zachowanie runtime |
| `gracz-session` | `sessionStorage`; stan sesji/UI użytkownika | używany przez lobby, gry, wiadomości i ustawienia | potwierdzić minimalizację zawartości i spójność cookie-only migration |
| `gracz-room-options:*`, `thousand-entered-game` | `sessionStorage`; ustawienia pokoju i nawigacja gry | używane w UI gier/lobby | potwierdzić cleanup/expiry |
| `gracz-registration-terms-pending`, `gracz-password-recovery-pending` | `sessionStorage`; krótkotrwały stan formularzy | używane w flow terms/recovery; recovery może obejmować e-mail | potwierdzić timeout/cleanup i minimalizację |
| `gracz-newsletter-pending` | `localStorage`; stan oczekującego zapisu | używany w flow newslettera | potwierdzić expiry/cleanup i zgodność z retencją |
| `gracz-player-settings-v1`, `gracz-avatar-v1`, `gracz-terms-accepted-at` | `localStorage`; ustawienia UI, avatar, znacznik akceptacji | używane w pierwszostronnym frontendzie | opisać expiry/cleanup oraz odróżnić preference od evidence zgody |
| Cloudflare Turnstile | challenge/security signals; nie jest automatycznie tożsame z cookie | Siteverify, token challenge, remote IP i hostname są potwierdzone w kodzie | account/widget features, provider-side storage/cookies i retencja wymagają account evidence |
| analytics/marketing cookies | brak potwierdzonego użycia w przejrzanym first-party modern frontend scope | `NOT FOUND IN REVIEWED REPO SCOPE` | nie stanowi gwarancji dla providerów ani przyszłych funkcji; wymaga finalnego runtime/account review |

Podstawa prawna, informacja i mechanizm zgody muszą zostać dobrane do finalnego zakresu; samo istnienie storage nie przesądza, czy zgoda jest wymagana.

Nie wolno opublikować deklaracji „nie używamy cookies”, dopóki stan techniczny nie zostanie zweryfikowany.

---

## 13. Zmiany polityki

Każda materialna zmiana celu, podstawy prawnej, retencji, kategorii danych, modelu małoletnich, providera, transferu albo funkcji wymagającej dodatkowej informacji powoduje przegląd i wersjonowanie polityki.

Historia wersji powinna być trwała i możliwa do powiązania z odpowiednią wersją ROPA oraz ADR-V3-012.

---

## 14. Otwarte warunki PL-E09

| ID | Warunek | Severity | Status |
|---|---|---|---|
| PL-E09-O01 | uzupełnić adres kontaktowy administratora | P1 Privacy/Legal | `OPEN` |
| PL-E09-O02 | ustanowić e-mail privacy/contact | P1 Privacy/Legal | `OPEN` |
| PL-E09-O03 | zakończyć LIA dla procesów 6(1)(f) | P1 Privacy/Legal | `CLOSED / P1-PL-001` |
| PL-E09-O04 | zweryfikować i zatwierdzić providerów, DPA i transfery | P1 Privacy/Legal | `OPEN` |
| PL-E09-O05 | zatwierdzić okresy retencji PL-R01–PL-R09 | P1 Privacy/Legal | `CLOSED / P1-PL-002` |
| PL-E09-O06 | wykonać pełną DPIA i model 16–17 | P1 Privacy/Legal | `CLOSED / P1-PL-005` |
| PL-E09-O07 | zatwierdzić model newsletter/consent | P1 Privacy/Legal | `CLOSED / P1-PL-004` |
| PL-E09-O08 | dokończyć cookies/local-storage inventory o runtime/provider-account evidence | P1 Privacy/Legal/Technical | `PARTIAL / OPEN UNDER P1-PL-003` |
| PL-E09-O09 | potwierdzić procedury praw osób PL-E12 | P1 Privacy/Legal | `OPEN` |
| PL-E09-O10 | wykonać finalny legal/content review wersji publikacyjnej | P1 Privacy/Legal | `OPEN` |

---

## 15. Ocena PL-E09

```text
PL-E09 = PASS WITH CONDITIONS

PRIVACY NOTICE DRAFT = VERSIONED
ADMINISTRATOR = IDENTIFIED
CONTACT DATA = INCOMPLETE
PURPOSES / BASES = MAPPED BUT NOT FINAL
RECIPIENTS / PROCESSORS = MAPPED BUT PROVIDER VERIFICATION OPEN
TRANSFERS = TO VERIFY
RETENTION = DOCUMENTED AS PROJECT POLICY / FINAL DECISION PENDING
DATA SUBJECT RIGHTS = INCLUDED / PROCEDURE EVIDENCE PENDING
MINORS MODEL = INCLUDED / DPIA SCREENING PENDING
COOKIES INVENTORY = PENDING
PUBLICATION READY = NO
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `PASS` może zostać nadany dopiero po zamknięciu warunków publikacyjnych i formalnym zatwierdzeniu wersji privacy notice.

---

## 16. Granica autoryzacji

Utworzenie tego dokumentu:

- nie publikuje polityki na gracz.pl;
- nie zmienia regulaminu ani interfejsu;
- nie zmienia konfiguracji providerów;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- jest wyłącznie wersjonowanym artefaktem dokumentacyjnym do formalnego ADR-V3-012 review.
