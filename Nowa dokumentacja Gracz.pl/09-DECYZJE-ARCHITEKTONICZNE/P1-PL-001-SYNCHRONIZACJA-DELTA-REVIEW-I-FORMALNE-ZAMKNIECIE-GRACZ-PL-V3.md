# Gracz.pl V3 — P1-PL-001 Synchronizacja, delta review i formalne zamknięcie lawful-basis

Data zamknięcia dokumentacyjnego: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-001`  
Status: **CLOSED / LAWFUL-BASIS MODEL SYNCHRONIZED BY AUTHORITATIVE DELTA RECORD / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązany dokument decyzyjny: `P1-PL-001-ROZSTRZYGNIECIE-PODSTAW-PRAWNYCH-LIA-I-LEGAL-DUTY-GRACZ-PL-V3.md`  
Powiązane evidence/control: `PL-E03`, `PL-E10`, `PL-C02`, `ROPA-GRACZ-PL-V3.md`, `PL-E09-INFORMACJA-I-POLITYKA-PRYWATNOSCI-GRACZ-PL-V3.md`

> Dokument wykonuje wymagany etap synchronizacji po merytorycznym rozstrzygnięciu P1-PL-001. Jest wersjonowanym authoritative delta record dla pól lawful-basis w pakiecie Privacy/Legal. Nie jest opinią prawną, nie finalizuje innych blockerów i nie autoryzuje implementacji ani deploymentu.

---

## 1. Cel zamknięcia

P1-PL-001 wymagał:

1. finalnej podstawy prawnej dla każdego materialnego celu bazowego V3;
2. zakończonego LIA dla materialnych procesów opartych na art. 6 ust. 1 lit. f;
3. konkretnego obowiązku prawnego przy użyciu art. 6 ust. 1 lit. c;
4. synchronizacji wyniku z ROPA i privacy notice;
5. braku nierozstrzygniętego materialnego `PENDING LEGAL REVIEW / HOLD` należącego rzeczywiście do lawful-basis dla procesów bazowych V3.

Merytoryczne rozstrzygnięcie zostało zapisane w dokumencie `P1-PL-001-ROZSTRZYGNIECIE-PODSTAW-PRAWNYCH-LIA-I-LEGAL-DUTY-GRACZ-PL-V3.md`. Niniejszy dokument wykonuje synchronizację oraz delta review.

---

## 2. Reguła autorytatywności i synchronizacji

Od daty tego dokumentu, dla **pól dotyczących podstaw prawnych i wyniku LIA** w ramach bazowego V3, obowiązuje następująca kolejność autorytatywności:

1. niniejszy dokument — status zamknięcia i crosswalk synchronizacyjny;
2. `P1-PL-001-ROZSTRZYGNIECIE-PODSTAW-PRAWNYCH-LIA-I-LEGAL-DUTY-GRACZ-PL-V3.md` — decyzja merytoryczna;
3. wcześniejsze wpisy `PROPOSED`, `LIA REQUIRED`, `PENDING` w `PL-E03`, ROPA i `PL-E09` — traktowane jako **historyczne/pre-decision markers** wyłącznie w zakresie, który został rozstrzygnięty poniżej.

To nie nadpisuje innych otwartych elementów tych dokumentów, takich jak retention, providerzy, transfery, publication readiness, DPIA, minors, backup/restore ani operational evidence.

---

## 3. Kanoniczny crosswalk lawful-basis po synchronizacji

| Proces / cel | Kanoniczna podstawa po decyzji | Status po synchronizacji |
|---|---|---|
| konto, rejestracja, profil | art. 6(1)(b) dla danych niezbędnych do świadczenia usługi | `ACCEPTED FOR BASELINE` |
| auth, sesje, recovery, MFA | art. 6(1)(b); dodatkowe security/anti-abuse art. 6(1)(f) | `ACCEPTED / ACCEPTED WITH SAFEGUARDS` |
| gry, mecze, replay, ranking, turnieje | art. 6(1)(b); integralność/spory art. 6(1)(f) | `ACCEPTED / ACCEPTED WITH SAFEGUARDS` |
| prywatne wiadomości i załączniki | art. 6(1)(b) dla dostarczenia funkcji komunikacji | `ACCEPTED` |
| publiczny chat/social | art. 6(1)(b); moderacja/anti-spam art. 6(1)(f) | `ACCEPTED / ACCEPTED WITH SAFEGUARDS` |
| newsletter / marketing | art. 6(1)(a) | `ACCEPTED FOR VOLUNTARY MARKETING` |
| moderacja, zgłoszenia, sankcje, odwołania | art. 6(1)(f) | `ACCEPTED WITH MATERIAL SAFEGUARDS` |
| audit, RBAC, działania uprzywilejowane | art. 6(1)(f) | `ACCEPTED WITH SAFEGUARDS` |
| realizacja praw osób | art. 6(1)(c), konkretnie obowiązki administratora z RODO art. 12 oraz art. 15–22 zależnie od żądania | `ACCEPTED FOR DIRECT GDPR OBLIGATIONS` |
| security telemetry, logi, traces, anti-abuse | art. 6(1)(f); elementy ściśle konieczne do usługi mogą mieścić się w 6(1)(b) | `ACCEPTED WITH STRONG MINIMIZATION` |
| backup, restore, anti-resurrection | źródłowe podstawy danych + art. 6(1)(f) dla continuity/recovery | `ACCEPTED WITH SAFEGUARDS` |

---

## 4. Kanoniczny wynik LIA po synchronizacji

```text
LIA-01 SECURITY / ANTI-ABUSE = ACCEPTED WITH SAFEGUARDS
LIA-02 GAME INTEGRITY = ACCEPTED WITH SAFEGUARDS
LIA-03 MODERATION = ACCEPTED WITH MATERIAL SAFEGUARDS
LIA-04 PRIVILEGED AUDIT = ACCEPTED WITH SAFEGUARDS
LIA-05 SECURITY TELEMETRY = ACCEPTED WITH STRONG MINIMIZATION
LIA-06 CLAIMS / GENERIC PROOF = NOT GENERALLY ACCEPTED / CASE-SPECIFIC ONLY
LIA-07 BACKUP / RESTORE CONTINUITY = ACCEPTED WITH SAFEGUARDS
```

`LIA-06` nie pozostaje blockerem P1-PL-001, ponieważ blankietowa podstawa została odrzucona. Konkretne długoterminowe proof/claims/retention zostały przypisane do odrębnych blockerów, które oceniają cel, okres i case-specific podstawę.

---

## 5. Synchronizacja PL-E03

Dla zakresu lawful-basis poniższe starsze statusy w `PL-E03` należy czytać jako zastąpione przez niniejszy delta record:

- `PASS WITH CONDITIONS CANDIDATE / FORMAL OWNER DECISION PENDING` dla bazowych 6(1)(b) → **decyzja właścicielska została zapisana**;
- `HOLD UNTIL LIA` dla LIA-01/02/03/04/05/07 → **LIA zostały zaakceptowane z odpowiednimi safeguards**;
- `6(1)(c) PROPOSED/PENDING SPECIFIC LEGAL DUTY` dla realizacji praw osób → **konkretny obowiązek z RODO art. 12 i art. 15–22 został wskazany**;
- newsletter 6(1)(a) → **zaakceptowany dla dobrowolnego marketingu**, natomiast długoterminowy proof/suppression pozostaje poza P1-PL-001.

`PL-E03` nadal pozostaje dokumentem evidence i mapą procesów; ten delta record aktualizuje wyłącznie stan decyzyjny pól podstaw prawnych bez zmiany innych warunków.

---

## 6. Synchronizacja ROPA

ROPA dla bazowego V3 należy od tej wersji interpretować zgodnie z crosswalkiem z sekcji 3.

W szczególności:

- oznaczenia `PROPOSED` przy 6(1)(b) dla funkcji podstawowych stają się `ACCEPTED FOR BASELINE` w granicach niezbędności;
- oznaczenia `6(1)(f) PROPOSED / LIA REQUIRED` dla procesów objętych LIA-01/02/03/04/05/07 stają się `ACCEPTED WITH SAFEGUARDS`;
- realizacja praw osób ma 6(1)(c) opartą na konkretnych obowiązkach RODO;
- 6(1)(c) nie jest rozszerzane na bezpieczeństwo, audit, marketing, backup, moderację ani generic proof;
- retencje 6 lat / 24 miesiące i inne sporne okresy nie są zatwierdzone tym dokumentem i pozostają w P1-PL-002/P1-PL-004.

ROPA nadal wymaga osobnych aktualizacji dla providerów, transferów, minors, publication package i finalnych retencji.

---

## 7. Synchronizacja privacy notice

`PL-E09` pozostaje **niegotowe do publikacji** z powodów należących do innych blockerów. Jednak dla warstwy lawful-basis obowiązują już następujące wartości kanoniczne:

- konto i niezbędne funkcje usługi — 6(1)(b);
- dobrowolny newsletter — 6(1)(a);
- bezpieczeństwo, integralność, moderacja, audit i telemetry — 6(1)(f) z odpowiednimi safeguards;
- bezpośrednia realizacja praw osób — 6(1)(c) w związku z obowiązkami RODO;
- backup/restore — źródłowe podstawy danych + 6(1)(f) dla continuity/recovery.

Wersja publication-ready z P1-PL-003 musi użyć dokładnie tych podstaw, chyba że późniejszy profesjonalny review prawny wprowadzi wersjonowaną zmianę.

Brak publication-ready tekstu nie pozostawia P1-PL-001 otwartego, ponieważ publication readiness jest kanonicznie przypisane do `P1-PL-003`.

---

## 8. Delta review — separacja pozostałych HOLD

Po synchronizacji sprawdzono, czy istnieją nierozstrzygnięte materialne kwestie rzeczywiście należące do P1-PL-001.

| Kwestia | Wynik delta review | Kanoniczny blocker |
|---|---|---|
| core 6(1)(b) necessity model | rozstrzygnięty z warunkiem minimalizacji | `CLOSED IN P1-PL-001` |
| materialne LIA 01/02/03/04/05/07 | rozstrzygnięte z safeguards | `CLOSED IN P1-PL-001` |
| generic claims/proof jako blanket 6(1)(f) | odrzucone | `CLOSED IN P1-PL-001` |
| 6(1)(c) dla praw osób | konkretny obowiązek wskazany | `CLOSED IN P1-PL-001` |
| 6 lat privacy-request evidence | nierozstrzygnięte | `P1-PL-002` |
| 24m suppression/unsubscribe | nierozstrzygnięte | `P1-PL-002 + P1-PL-004` |
| 6 lat consent proof | nierozstrzygnięte | `P1-PL-002 + P1-PL-004` |
| max 6 lat privileged audit history | nierozstrzygnięte | `P1-PL-002` |
| publication-ready notice | nierozstrzygnięte | `P1-PL-003` |
| full DPIA / minors | nierozstrzygnięte | `P1-PL-005` |

Wniosek: po deduplikacji **nie pozostaje otwarta materialna kwestia lawful-basis należąca do P1-PL-001**.

---

## 9. Aktualizacja kontroli PL-C02

Dla warstwy lawful-basis kontrola PL-C02 zmienia swój wynik decyzyjny na:

```text
PL-C02 LAWFUL-BASIS DECISION LAYER = PASS WITH CONDITIONS
EVERY BASELINE PURPOSE HAS APPROVED BASIS = YES
MATERIAL LIA REQUIRED FOR BASELINE = COMPLETED / ACCEPTED WITH SAFEGUARDS
SPECIFIC 6(1)(c) DUTY FOR GDPR RIGHTS = IDENTIFIED
GENERIC PROOF/CLAIMS BLANKET BASIS = NOT ACCEPTED
RETENTION-SPECIFIC BASIS ISSUES = MOVED TO P1-PL-002 / P1-PL-004
PUBLICATION DISCLOSURE = MOVED TO P1-PL-003
FULL DPIA / MINORS = P1-PL-005
```

Warunki dotyczące innych blockerów nie są ponownie liczone jako lawful-basis P1.

---

## 10. Formalne zamknięcie P1-PL-001

Kryteria kanonicznego P1-PL-001 są spełnione na poziomie governance/documentation:

- każdy materialny cel bazowy ma zatwierdzoną podstawę — **YES**;
- materialne LIA dla używanych 6(1)(f) są zamknięte z safeguards — **YES**;
- użycie 6(1)(c) ma konkretny obowiązek dla praw osób — **YES**;
- wynik jest zsynchronizowany z PL-E03/ROPA/privacy notice przez ten authoritative delta record — **YES**;
- nierozstrzygnięte proof/retention/DPIA/publication issues są jawnie przeniesione do innych kanonicznych blockerów — **YES**.

```text
P1-PL-001 = CLOSED
CLOSURE TYPE = GOVERNANCE / DOCUMENTATION DECISION CLOSURE
CLOSURE DATE = 01.09.2026
CLOSURE EVIDENCE = THIS DOCUMENT + P1-PL-001 SUBSTANTIVE DECISION

OPEN P0 PRIVACY/LEGAL = 0 KNOWN
CANONICAL P1 TOTAL = 9
CANONICAL P1 CLOSED = 1
CANONICAL P1 OPEN = 8

ADR-V3-012 FINAL VERDICT = HOLD
SECOND FORMAL DECISION DOCUMENT = DO NOT FINAL-SIGN YET
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

## 11. Następny blocker

Po zamknięciu P1-PL-001 następny kanoniczny blocker zgodnie z kolejnością zależności:

`P1-PL-002 — Material retention periods i podstawy ich utrzymywania`.

Zakres obejmuje przede wszystkim:

- 6 lat privacy-request evidence;
- 24 miesiące suppression/unsubscribe record;
- 6 lat consent proof;
- do 6 lat privileged audit/role history.

---

## 12. Granica autoryzacji

Utworzenie tego zamknięcia:

- nie zmienia kodu ani konfiguracji;
- nie uruchamia nowych procesów przetwarzania;
- nie zatwierdza spornych okresów retencji;
- nie finalizuje privacy notice;
- nie kończy DPIA;
- nie zatwierdza providerów ani transferów;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.
