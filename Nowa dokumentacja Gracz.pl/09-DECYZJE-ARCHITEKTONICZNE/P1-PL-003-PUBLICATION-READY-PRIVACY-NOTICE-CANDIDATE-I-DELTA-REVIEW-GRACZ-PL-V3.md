# Gracz.pl V3 — P1-PL-003 Publication-ready privacy notice candidate i delta review

Data przygotowania: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-003`  
Status: **SUBSTANTIVE NOTICE CONTENT SYNCHRONIZED / PUBLICATION CANDIDATE PREPARED / FINAL PUBLICATION BLOCKED BY EXTERNAL DEPENDENCIES / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązane evidence/decyzje: `PL-E09`, `P1-PL-001`, `P1-PL-002`, `ROPA-GRACZ-PL-V3.md`, `PL-C14`, `PL-E11`

> Dokument przygotowuje kanoniczną treść privacy notice po zamknięciu lawful-basis, material retention, newsletter consent oraz pełnej DPIA/modelu 16–17. Nie jest jeszcze wersją do publikacji, ponieważ część informacji zależy od otwartych blockerów provider/DPA, transferów, uzupełnienia danych kontaktowych administratora oraz finalnego runtime/provider-account inventory cookies/local storage. Nie autoryzuje implementacji ani deploymentu.

---

## 1. Cel i reguła autorytatywności

Dla treści obowiązku informacyjnego po decyzjach `P1-PL-001` i `P1-PL-002` niniejszy dokument jest authoritative delta record wobec starszych markerów `PROPOSED`, `PENDING`, `LIA REQUIRED` oraz starych wartości 6-letniej retencji w `PL-E09`.

Nie nadpisuje otwartych informacji wymagających rzeczywistego evidence, w szczególności:

- danych kontaktowych administratora;
- finalnego provider/processors register;
- DPA i transferów;
- finalnego runtime/provider-account cookies/local-storage inventory.

---

# 2. Kanoniczna treść privacy notice — część gotowa merytorycznie

## 2.1. Administrator

Administratorem danych osobowych w Gracz.pl jest:

**Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu.**

Do wersji publikacyjnej wymagane jest jeszcze wpisanie:

- adresu korespondencyjnego administratora;
- działającego adresu e-mail do spraw prywatności i realizacji praw osób.

Brak tych danych blokuje publikację finalnej wersji.

## 2.2. Zakres przetwarzania

Polityka obejmuje przetwarzanie związane z:

1. kontem, rejestracją i profilem;
2. logowaniem, sesjami, recovery i MFA;
3. grami, meczami, replay, rankingiem i turniejami;
4. prywatnymi wiadomościami, załącznikami, publicznym chatem i social;
5. newsletterem i komunikacją marketingową;
6. moderacją, zgłoszeniami, sankcjami i odwołaniami;
7. audit, RBAC i działaniami uprzywilejowanymi;
8. realizacją praw osób;
9. security telemetry, logami, traces i anti-abuse;
10. backup, restore i anti-resurrection.

## 2.3. Kategorie danych

W zależności od używanej funkcji Gracz.pl może przetwarzać m.in.:

- user ID, login/nazwę, e-mail, status konta, ustawienia i dane profilu;
- hashe haseł, identyfikatory sesji i token metadata, dane MFA i recovery;
- dane meczów i gier: match/game IDs, ruchy, eventy, snapshoty, wyniki, ranking, udział w turniejach;
- nadawcę/odbiorcę, metadane i zaszyfrowaną treść wiadomości prywatnych oraz dane załączników;
- publiczny chat, reakcje i relacje social;
- e-mail i evidence zgody newsletterowej;
- dane moderacyjne: reporter/reported IDs, powód, sankcję, odwołanie i minimalne evidence;
- IP/UA i inne security signals wyłącznie tam, gdzie są rzeczywiście niezbędne;
- minimalne privacy-request evidence;
- audit i techniczne metadata działań uprzywilejowanych.

Baseline nie zakłada domyślnego zbierania PESEL, numerów dokumentów tożsamości, biometrii, dokładnej lokalizacji GPS, danych zdrowotnych, danych płatniczych ani innych danych szczególnych kategorii jako wymaganych pól usługi.

---

# 3. Finalna mapa celów i podstaw prawnych do privacy notice

Po zamknięciu `P1-PL-001` obowiązuje następujący crosswalk:

| Cel | Podstawa kanoniczna | Status |
|---|---|---|
| utworzenie i prowadzenie konta/profilu | art. 6 ust. 1 lit. b RODO | `ACCEPTED FOR BASELINE` |
| auth, sesje, recovery, podstawowe MFA | art. 6 ust. 1 lit. b RODO | `ACCEPTED` |
| dodatkowe security / anti-abuse | art. 6 ust. 1 lit. f RODO | `ACCEPTED WITH SAFEGUARDS` |
| gry, mecze, replay, ranking, turnieje | art. 6 ust. 1 lit. b RODO | `ACCEPTED` |
| integralność gry, anti-abuse i rozstrzyganie sporów | art. 6 ust. 1 lit. f RODO | `ACCEPTED WITH SAFEGUARDS` |
| prywatne wiadomości i załączniki | art. 6 ust. 1 lit. b RODO | `ACCEPTED` |
| publiczny chat/social jako funkcja usługi | art. 6 ust. 1 lit. b RODO | `ACCEPTED` |
| moderacja, anti-spam i ochrona społeczności | art. 6 ust. 1 lit. f RODO | `ACCEPTED WITH MATERIAL SAFEGUARDS` |
| dobrowolny newsletter/marketing | art. 6 ust. 1 lit. a RODO | `ACCEPTED` |
| audit/RBAC/działania uprzywilejowane | art. 6 ust. 1 lit. f RODO | `ACCEPTED WITH SAFEGUARDS` |
| realizacja bezpośrednich praw osób | art. 6 ust. 1 lit. c RODO w związku z obowiązkami administratora, w szczególności art. 12 i art. 15–22 zależnie od żądania | `ACCEPTED` |
| security telemetry/logi/traces | art. 6 ust. 1 lit. f RODO; elementy ściśle konieczne do usługi tylko w niezbędnym zakresie mogą mieścić się w lit. b | `ACCEPTED WITH STRONG MINIMIZATION` |
| continuity/backup/restore/anti-resurrection | podstawy danych źródłowych + art. 6 ust. 1 lit. f dla continuity/recovery | `ACCEPTED WITH SAFEGUARDS` |

Nie ustanawia się `art. 6(1)(f)` jako blankietowej podstawy przechowywania danych „na wszelki wypadek”.

---

# 4. Kanoniczne okresy przechowywania do wersji publikacyjnej

Po zamknięciu `P1-PL-002` starsze wpisy 6-letnie w `PL-E09` są historyczne. Obowiązuje następująca warstwa informacyjna:

| Kategoria | Maksymalny okres / kryterium |
|---|---|
| aktywne konto i profil | przez czas aktywności konta, do rozpoczęcia skutecznego usunięcia |
| konto po zweryfikowanym żądaniu usunięcia | do 30 dni w aktywnych systemach |
| publiczna widoczność profilu po rozpoczęciu delete | do 24 h |
| sesje po expiry/revoke/delete | do 30 dni metadata; aktywna autoryzacja kończy się wcześniej |
| reset/registration/public token metadata | 7 dni |
| privacy-request evidence | **36 miesięcy maks. od completion**, minimalne evidence only |
| privacy/anti-abuse tombstone | do 24 miesięcy, minimalny keyed/pseudonymous record |
| zakończone game/match events z identyfikatorem | 36 miesięcy |
| snapshoty zakończonych meczów | 90 dni |
| historia turnieju z identyfikatorem | 36 miesięcy |
| ranking | aktywne konto + do 30 dni po usunięciu z projekcji |
| prywatne wiadomości | 36 miesięcy z party-state rules |
| po delete przez obie strony | 30 dni grace |
| publiczny chat | 12 miesięcy |
| chat edit/delete events | 24 miesiące |
| pending newsletter | 30 dni |
| newsletter token metadata | 7 dni |
| unsubscribe/suppression | **24 miesiące maks.** |
| consent proof | **36 miesięcy maks.** od withdrawal/superseding consent/end lifecycle |
| newsletter lifecycle analytics | 24 miesiące |
| provider delivery telemetry | do 13 miesięcy, jeśli finalny provider i konfiguracja tego wymagają |
| moderation case/action/appeal | 36 miesięcy |
| zakończona sankcja | 36 miesięcy |
| security events | 12 miesięcy |
| zwykłe privileged audit bez trwałego skutku | 12 miesięcy |
| admin actions na koncie / non-case moderator actions | 24 miesiące |
| role/permission changes, security-critical, privacy/deletion/restriction oraz krytyczne security-config actions | 36 miesięcy |
| application logs | 30 dni |
| security logs | 90 dni |
| raw traces | 14 dni |
| anonimowe/agregowane metryki | do 13 miesięcy, jeśli faktycznie anonimowe |
| backup daily | 35 dni |
| backup weekly | 12 tygodni |
| backup monthly | 12 miesięcy |
| izolowane restore environment | maks. 7 dni |

Okresy są limitami maksymalnymi. Jeśli cel ustaje wcześniej i nie istnieje inna ważna podstawa ani wąski legal hold, dane powinny zostać usunięte wcześniej.

---

# 5. Prawa osoby

W zakresie przewidzianym przez RODO osoba może mieć prawo do:

- dostępu;
- sprostowania;
- usunięcia;
- ograniczenia przetwarzania;
- sprzeciwu;
- przenoszenia danych, jeśli ma zastosowanie;
- wycofania zgody bez wpływu na zgodność wcześniejszego przetwarzania opartego na zgodzie;
- wniesienia skargi do właściwego organu nadzorczego.

Kanał kontaktu do wykonania praw musi zostać wpisany przed publikacją finalnej wersji.

---

# 6. Małoletni

Baseline Gracz.pl V3 pozostaje:

```text
MINIMUM INDEPENDENT ACCOUNT AGE = 16
UNDER 16 BASELINE ACCESS = NOT APPROVED
PARENTAL CONSENT WORKFLOW = NOT IMPLEMENTED / NOT APPROVED
USERS 16–17 = ENHANCED SAFEGUARDS REQUIRED
MINOR MARKETING PROFILING = NOT APPROVED
```

Treść została sprawdzona względem pełnej DPIA i modelu 16–17 zamkniętych w `P1-PL-005`. Jeżeli późniejszy residual-risk review providerów lub testy operacyjne zmienią safeguards, notice musi zostać odpowiednio zaktualizowane.

---

# 7. Newsletter i marketing

Finalna warstwa informacyjna po P1-PL-001 i P1-PL-002:

- newsletter jest dobrowolny i oparty na zgodzie;
- nie jest warunkiem podstawowej usługi;
- użytkownik może wycofać zgodę / wypisać się;
- po withdrawal dalsza wysyłka marketingowa musi zostać zatrzymana;
- minimalny suppression record może być przechowywany do 24 miesięcy;
- minimalny consent proof może być przechowywany do 36 miesięcy;
- ponowna subskrypcja wymaga nowego consent event;
- backup/restore nie może reaktywować wycofanej zgody.

Workflow, provider i operacyjne testy pozostają w `P1-PL-004`, `P1-PL-006`, `P1-PL-007`, `P1-PL-008` i `P1-PL-009`.

---

# 8. Odbiorcy i procesorzy — tekst nie może być jeszcze finalny

Privacy notice może już opisywać kategorie odbiorców:

- dostawcy hostingu/runtime/bazy danych;
- dostawcy edge/DNS/TLS/security;
- Resend Email API — zintegrowany w kodzie; account approval / account-specific DPA i transfer evidence pozostają otwarte;
- przyszły object storage dla załączników, jeśli zostanie zatwierdzony;
- przyszły observability/logging provider, jeśli zostanie zatwierdzony;
- odbiorcy wiadomości prywatnych;
- inni użytkownicy w zakresie jawnie publicznych funkcji;
- administratorzy/moderatorzy wyłącznie need-to-know;
- organy publiczne wyłącznie przy prawnie skutecznym obowiązku/żądaniu.

Jednak finalny provider list / role / DPA pozostają `HOLD` w `P1-PL-006`.

Obecnie Render, Cloudflare Turnstile i Resend nie są finalnie zatwierdzone jako complete privacy/legal provider record. Turnstile i Resend są potwierdzonymi integracjami w kodzie, ale account approval, account-effective DPA, faktyczny product scope, subprocesorzy/transfer applicability i brakujące account evidence wymagają weryfikacji.

---

# 9. Transfery poza EOG — publication blocker

Nie wolno w finalnej polityce napisać ani:

- „nie przekazujemy danych poza EOG”, ani
- „transfery poza EOG są zatwierdzone”,

jeśli provider-specific evidence nie zostało zakończone.

`P1-PL-007` musi ustalić dla rzeczywiście używanych providerów:

- miejsca storage/processing;
- remote/support/operations access;
- subprocessors;
- właściwy mechanizm transferowy, jeśli wymagany;
- safeguards/TIA, jeśli wymagane;
- deletion/return i backup lifecycle.

Finalna sekcja transferowa privacy notice zostanie uzupełniona dopiero po zamknięciu `P1-PL-007`.

---

# 10. Cookies / local storage / podobne technologie — publication blocker

`PL-E09` prawidłowo zabrania publikowania deklaracji „nie używamy cookies” bez faktycznego sprawdzenia stanu technicznego.

Repozytorium potwierdza częściowy inwentarz w `PL-E09`: niezbędny cookie `__Host-gracz_session`, first-party `sessionStorage`/`localStorage` dla sesji/UI/ustawień/formularzy oraz integrację Turnstile. Do finalnego release należy domknąć co najmniej:

- cookies niezbędnych;
- sesji/auth cookies;
- local/session storage;
- Cloudflare/edge challenge/security cookies lub równoważnych mechanizmów;
- analytics/marketing cookies, jeśli kiedykolwiek zostaną użyte;
- retention/expiry i podstawy/mechanizmu zgody tam, gdzie właściwe.

Na obecnym etapie:

```text
COOKIES / LOCAL STORAGE INVENTORY = PARTIAL / REPO-SCOPE CONFIRMED / RUNTIME + PROVIDER-ACCOUNT SCOPE OPEN
PUBLICATION CLAIM "NO COOKIES" = NOT ALLOWED
```

---

# 11. Zautomatyzowane decyzje i profilowanie

Baseline dokumentacyjny nie zatwierdza wyłącznie automatycznych decyzji wywołujących wobec użytkownika skutki prawne lub podobnie istotne bez odpowiedniego review.

Ranking i mechanizmy domenowe gry nie są automatycznie traktowane jako taki system. Przyszłe istotne automated sanctions, szeroki anti-cheat/device fingerprinting lub marketing profiling wymagają odrębnego review i aktualizacji DPIA/notice.

---

# 12. Bezpieczeństwo danych

Notice może opisać projektowe środki jako wymagania systemu, bez nadmiernych gwarancji wdrożeniowych:

- kontrola dostępu i least privilege;
- RBAC i MFA dla dostępu uprzywilejowanego;
- szyfrowanie transmisji;
- ochrona prywatnych wiadomości i danych projektowo wrażliwych;
- zakaz logowania haseł, aktywnych tokenów, MFA secrets i plaintext prywatnych wiadomości;
- audit działań uprzywilejowanych;
- minimalizacja logów i telemetry;
- deletion ledger, deletion/restriction replay i anti-resurrection po restore;
- ograniczony lifecycle backupów.

Finalna publikacja nie może twierdzić, że wszystkie środki zostały operacyjnie zweryfikowane, dopóki `P1-PL-008` i `P1-PL-009` pozostają otwarte.

---

# 13. Delta review P1-PL-003

## 13.1. Elementy rozwiązane

| Kryterium | Stan |
|---|---|
| cele i podstawy prawne | `RESOLVED BY P1-PL-001` |
| LIA disclosure | `RESOLVED BY P1-PL-001` |
| materialne sporne okresy retencji | `RESOLVED BY P1-PL-002` |
| kategorie danych | `DEFINED` |
| prawa osób | `DEFINED` |
| baseline małoletnich 16+ | `DEFINED / P1-PL-005 CLOSED / RESIDUAL PROVIDER-OPERATIONAL RECHECK REMAINS` |
| security description | `DEFINED WITHOUT FALSE OPERATIONAL CLAIMS` |
| newsletter basis + retention layer | `DEFINED, WORKFLOW/PROVIDER OPEN ELSEWHERE` |

## 13.2. Elementy blokujące finalną publication-ready wersję

| ID | Element | Zależność | Status |
|---|---|---|---|
| P1-PL-003-O01 | adres korespondencyjny administratora | owner input | `OPEN / BLOCKING` |
| P1-PL-003-O02 | e-mail privacy / rights contact | owner input | `OPEN / BLOCKING` |
| P1-PL-003-O03 | finalni providerzy/odbiorcy/role/DPA | `P1-PL-006` | `OPEN / BLOCKING` |
| P1-PL-003-O04 | finalny transfer model poza EOG | `P1-PL-007` | `OPEN / BLOCKING` |
| P1-PL-003-O05 | pełna DPIA + model małoletnich | `P1-PL-005` | `CLOSED`; residual provider/transfer sync pozostaje w `P1-PL-006/007` |
| P1-PL-003-O06 | cookies/local-storage inventory | technical/privacy evidence | `OPEN / BLOCKING` |

---

# 14. Status kanoniczny

```text
P1-PL-003 SUBSTANTIVE NOTICE CONTENT = PREPARED
P1-PL-003 LAWFUL-BASIS SYNC = COMPLETE
P1-PL-003 MATERIAL RETENTION SYNC = COMPLETE
P1-PL-003 PUBLICATION CANDIDATE = YES
P1-PL-003 FINAL PUBLICATION READY = NO
P1-PL-003 = PARTIALLY RESOLVED / OPEN

BLOCKERS:
- CONTROLLER CONTACT DETAILS
- P1-PL-005 FULL DPIA SYNC — CLOSED
- P1-PL-006 PROVIDERS / DPA
- P1-PL-007 TRANSFERS
- COOKIES / LOCAL STORAGE INVENTORY

CANONICAL P1 TOTAL = 9
CANONICAL P1 CLOSED = 2
CANONICAL P1 OPEN = 7

OPEN P0 PRIVACY/LEGAL = 0 KNOWN
ADR-V3-012 FINAL VERDICT = HOLD
SECOND FORMAL DOCUMENT FINAL SIGNATURE = NOT YET
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

P1-PL-003 nie może zostać uczciwie oznaczone jako `CLOSED`, dopóki finalna polityka nie zawiera rzeczywistych danych kontaktowych, finalnego provider/transfer modelu oraz domkniętego runtime/provider-account cookies/local-storage inventory. Pełna DPIA i model 16–17 są zamknięte w `P1-PL-005` i nie są ponownie otwierane.

---

# 15. Granica autoryzacji

Utworzenie tego dokumentu:

- nie publikuje polityki prywatności;
- nie zmienia strony Gracz.pl;
- nie wybiera ani nie zatwierdza providera;
- nie potwierdza transferów;
- nie wykonuje DPIA;
- nie zmienia cookies/local storage;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze ani Production V3 NO-GO.

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**
