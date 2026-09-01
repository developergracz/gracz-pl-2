# Gracz.pl V3 — PL-C08 Objection / marketing / consent withdrawal

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — OPEN / VERSIONED / FREEZE-SAFE**  
Control ID: `PL-C08`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E09`, `PL-E10`, `PL-E12`, `PL-E13`  
Powiązany retention review: `PL-R06-NEWSLETTER-CONSENT-PROOF-UNSUBSCRIBE-ANALYTICS-PROVIDER-TELEMETRY-GRACZ-PL-V3.md`

> Kontrola PL-C08 ocenia, czy model Gracz.pl V3 zapewnia skuteczny sprzeciw wobec przetwarzania opartego na prawnie uzasadnionym interesie oraz skuteczne wycofanie zgody / unsubscribe dla newslettera i marketingu. Dokument nie stanowi opinii prawnej i nie zatwierdza jeszcze produkcyjnego marketingu.

---

## 1. Cel kontroli

PL-C08 ma potwierdzić, że:

1. użytkownik może skutecznie wycofać zgodę tam, gdzie przetwarzanie opiera się na zgodzie;
2. unsubscribe zatrzymuje przyszłą wysyłkę marketingową;
3. użytkownik może wnieść sprzeciw wobec procesów opartych na art. 6 ust. 1 lit. f RODO, a sprzeciw nie jest automatycznie ignorowany;
4. system nie reaktywuje zgody ani subskrypcji przez retry, outbox, provider queue, cache, backup lub restore;
5. ponowna subskrypcja wymaga nowego, jawnego aktu zgody;
6. evidence zgody/wycofania jest minimalne i ma zatwierdzony cel, podstawę oraz okres retencji;
7. marketing nie jest warunkiem dostępu do podstawowej funkcjonalności Gracz.pl;
8. model nie wprowadza cross-service profiling ani marketingowego profilowania małoletnich w bazowym zakresie V3.

---

## 2. Zakres kontroli

Kontrola obejmuje:

- newsletter i komunikację marketingową;
- confirmation/double opt-in, jeśli zostanie przyjęty;
- unsubscribe / withdrawal of consent;
- suppression state, jeśli zostanie formalnie zatwierdzony;
- consent proof / withdrawal proof;
- provider delivery telemetry;
- newsletter analytics;
- procesy 6(1)(f), wobec których może zostać wniesiony sprzeciw;
- propagację decyzji do bounded contexts, outbox, cache, providerów i restore;
- obowiązek informacyjny dotyczący zgody, sprzeciwu i wycofania.

PL-C08 nie zatwierdza reklam behawioralnych, profilowania marketingowego, partner marketingu ani zewnętrznego cross-site tracking.

---

## 3. Kontrola wycofania zgody

Dla procesu newslettera opartego na zgodzie obowiązuje model:

```text
CONSENT = REVOCABLE
WITHDRAWAL = EFFECTIVE FOR FUTURE PROCESSING
UNSUBSCRIBE = STOP MARKETING
OLD CONSENT MAY NOT BE REACTIVATED
NEW SUBSCRIPTION = NEW CONSENT EVENT
```

Wymagania:

1. wycofanie zgody musi być co najmniej tak łatwe jak jej udzielenie;
2. po skutecznym unsubscribe przyszła wysyłka marketingowa musi zostać zatrzymana bez zbędnej zwłoki;
3. wycofanie nie może powodować utraty podstawowych funkcji Gracz.pl niezależnych od marketingu;
4. link/token unsubscribe musi być bezpieczny i nie może wymagać ponownego logowania, jeśli nie jest to konieczne;
5. system powinien zapisać minimalny event wycofania wystarczający do rozliczalności i propagacji stanu;
6. wycofanie musi zostać przekazane do kolejki/outbox, providera i innych miejsc mogących nadal wysyłać wiadomości;
7. retry nie może ponownie wysłać marketingu po effective withdrawal;
8. backup/restore nie może przywrócić statusu `subscribed`.

Status projektu: `DEFINED / OPERATIONAL EVIDENCE REQUIRED`.

---

## 4. Sprzeciw wobec przetwarzania 6(1)(f)

Dla procesów opartych na prawnie uzasadnionym interesie Gracz.pl musi mieć case-specific objection workflow.

Minimalny model:

1. przyjąć sprzeciw i nadać `request_id`;
2. ustalić dokładny proces i podstawę prawną;
3. zidentyfikować zakres danych i bounded contexts;
4. wstrzymać lub ograniczyć przetwarzanie tam, gdzie wymagają tego zasady prawne i przyjęty model;
5. przeprowadzić review istnienia nadrzędnych podstaw do dalszego przetwarzania, jeśli ma zastosowanie;
6. zapisać decyzję i uzasadnienie;
7. poinformować użytkownika o wyniku;
8. wdrożyć wynik we wszystkich systemach zależnych;
9. zachować minimalny evidence record bez zbędnego PII.

Sprzeciw nie może zostać odrzucony wyłącznie dlatego, że system techniczny nie ma jeszcze automatycznej funkcji jego obsługi. Brak automatyzacji oznacza potrzebę procedury manualnej, a nie brak prawa/procesu.

Status projektu: `DEFINED / LAWFUL-BASIS AND LIA CONDITIONS OPEN`.

---

## 5. Marketing bez zgody / wymuszona zgoda

W baseline V3 niedopuszczalne są następujące wzorce:

```text
NEWSLETTER REQUIRED TO CREATE ACCOUNT = NOT ALLOWED
PRE-CHECKED MARKETING CONSENT = NOT ALLOWED
WITHDRAWAL HARDER THAN CONSENT = NOT ALLOWED
UNSUBSCRIBE THAT ONLY HIDES UI BUT CONTINUES SEND = NOT ALLOWED
RESTORE THAT REACTIVATES SUBSCRIPTION = NOT ALLOWED
OLD CONSENT REUSED FOR NEW PURPOSE = NOT ALLOWED
GAME HISTORY + MESSAGE DATA USED FOR MARKETING PROFILE = NOT APPROVED
MINOR MARKETING PROFILING = NOT APPROVED
```

Każde przyszłe rozszerzenie marketingu wymaga osobnego purpose/lawful-basis/privacy/DPIA review przed produkcją.

---

## 6. Consent proof i suppression record

Bieżący retention review PL-R06 pozostawia dwa materialne punkty w `HOLD`:

- identyfikowalny unsubscribe/suppression record przez 24 miesiące;
- consent proof przez 6 lat.

PL-C08 nie rozstrzyga tych okresów automatycznie.

Dla obu klas musi zostać wykazane:

- konkretny cel zachowania po wycofaniu zgody;
- podstawa dalszego przetwarzania minimalnego proof;
- minimalny zakres pól;
- dlaczego krótszy okres nie wystarcza;
- final action;
- możliwość wcześniejszego purge;
- wyjątki/legal hold;
- zgodność z privacy notice i ROPA.

Do czasu formalnego zamknięcia PL-R06-O01/O02 nie wolno przedstawiać tych okresów użytkownikom ani dokumentacji finalnej jako w pełni zatwierdzonych.

---

## 7. Provider i propagacja unsubscribe

Przed produkcją należy potwierdzić dla faktycznego providera newslettera/email:

1. możliwość natychmiastowego suppression/unsubscribe;
2. brak ponownej aktywacji przez retry/import;
3. sposób synchronizacji consent state;
4. retencję suppression/proof po stronie providera;
5. DPA, role, subprocessors, regiony i transfery;
6. delete/return przy offboardingu;
7. audit/evidence propagacji withdrawal;
8. zachowanie po bounce/complaint;
9. zachowanie po backup/restore po stronie Gracz.pl oraz — jeśli dotyczy — providera.

Brak potwierdzonego providera oznacza brak produkcyjnego `PASS` dla PL-C08.

---

## 8. Backup / restore / anti-resurrection

Po restore należy wykonać co najmniej replay:

- withdrawal events;
- unsubscribe state;
- deletion state;
- zatwierdzonego suppression state;
- expiry/revoke tokenów;
- aktualnej wersji polityki consent.

Minimalny test przed produkcją:

```text
1. użytkownik zapisany do newslettera
2. skuteczny unsubscribe
3. potwierdzenie braku dalszej wysyłki
4. restore starszej kopii, w której user był subscribed
5. replay privacy/consent state
6. potwierdzenie, że user nadal jest unsubscribed
7. test outbox/provider queue
8. brak marketingowej wysyłki
```

Nieprzejście tego testu = `P1 PRIVACY/OPERATIONAL` przed produkcją.

---

## 9. Obowiązek informacyjny

Finalna privacy notice / formularz newslettera musi jasno opisywać:

- cel newslettera/marketingu;
- podstawę prawną;
- dobrowolność zgody;
- możliwość wycofania zgody;
- sposób unsubscribe;
- kategorie danych;
- okres lub kryterium retencji;
- minimalny proof, jeśli jest zachowywany po withdrawal;
- providerów/kategorie odbiorców;
- transfery poza EOG, jeśli występują;
- prawo sprzeciwu tam, gdzie przetwarzanie opiera się na 6(1)(f).

Treść produkcyjna nie może używać okresów `HOLD` jako finalnie zatwierdzonych.

---

## 10. Testy wymagane przed produkcją

| ID | Test | Wymagany wynik | Status |
|---|---|---|---|
| PL-C08-T01 | subscribe -> withdraw/unsubscribe | dalszy marketing zatrzymany | `OPEN` |
| PL-C08-T02 | unsubscribe z pending outbox | żaden retry nie wysyła marketingu | `OPEN` |
| PL-C08-T03 | unsubscribe przy aktywnym provider queue | provider respektuje suppression | `OPEN` |
| PL-C08-T04 | restore sprzed unsubscribe | brak resurrection zgody | `OPEN` |
| PL-C08-T05 | ponowna subskrypcja | nowy jawny consent event | `OPEN` |
| PL-C08-T06 | sprzeciw wobec procesu 6(1)(f) | case-specific review + evidence | `OPEN` |
| PL-C08-T07 | export/privacy request | consent/withdrawal state poprawnie ujawniony | `OPEN` |
| PL-C08-T08 | małoletni 16–17 | brak marketing profiling baseline | `OPEN` |
| PL-C08-T09 | log/audit review | brak plaintext tokenów i nadmiarowego PII | `OPEN` |

---

## 11. Otwarte warunki

| ID | Warunek | Severity | Owner | Deadline/Gate | Status |
|---|---|---|---|---|---|
| PL-C08-O01 | zatwierdzić finalny lawful basis i tekst consent dla newslettera | P1 Privacy/Legal | Privacy/Legal Decision Owner | przed finalnym ADR signature | `OPEN` |
| PL-C08-O02 | rozstrzygnąć PL-R06: 24m unsubscribe/suppression record | P1 Privacy/Legal | Privacy/Legal Decision Owner | przed finalnym ADR signature | `OPEN` |
| PL-C08-O03 | rozstrzygnąć PL-R06: 6y consent proof | P1 Legal | Privacy/Legal Decision Owner | przed finalnym ADR signature | `OPEN` |
| PL-C08-O04 | wybrać i zweryfikować provider newslettera/email, DPA, transfery i retention | P1 Privacy/Legal | Privacy/Legal Decision Owner / provider owner TBD | przed produkcją | `OPEN` |
| PL-C08-O05 | wdrożyć i przetestować unsubscribe propagation do outbox/provider/cache | P1 Engineering/Privacy | Engineering Owner TBD | przed produkcją | `OPEN` |
| PL-C08-O06 | wykonać restore anti-resurrection test dla consent state | P1 Operations/Privacy | Operations Owner TBD | przed produkcją | `OPEN` |
| PL-C08-O07 | zamknąć LIA dla procesów 6(1)(f), których może dotyczyć sprzeciw | P1 Privacy/Legal | Privacy/Legal Decision Owner | przed finalnym ADR signature | `OPEN` |
| PL-C08-O08 | zsynchronizować finalny model z privacy notice, ROPA i formularzem newslettera | P1 Privacy/Legal | Privacy/Legal Decision Owner | przed publikacją/produkcją | `OPEN` |

---

## 12. Formalna ocena PL-C08

```text
PL-C08 = HOLD

WITHDRAWAL / UNSUBSCRIBE MODEL = DEFINED
UNSUBSCRIBE STOPS FUTURE MARKETING = REQUIRED
NEW SUBSCRIPTION REQUIRES NEW CONSENT EVENT = REQUIRED
OBJECTION WORKFLOW FOR 6(1)(f) = DEFINED
MARKETING AS CONDITION OF CORE SERVICE = NOT ALLOWED
MINOR MARKETING PROFILING BASELINE = NOT APPROVED
CROSS-SERVICE MARKETING PROFILING = NOT APPROVED

BLOCKERS:
- FINAL CONSENT MODEL / LAWFUL BASIS = OPEN
- 24M UNSUBSCRIBE/SUPPRESSION RECORD = HOLD
- 6Y CONSENT PROOF = HOLD
- NEWSLETTER PROVIDER / DPA / TRANSFERS = OPEN
- OPERATIONAL UNSUBSCRIBE + RESTORE EVIDENCE = OPEN

REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

Werdykt `HOLD` nie oznacza, że projektowy model sprzeciwu i unsubscribe jest wadliwy. Oznacza, że materialne elementy prawne i operacyjne nie są jeszcze wystarczająco zamknięte do pełnego `PASS`.

---

## 13. Granica autoryzacji

Utworzenie PL-C08:

- nie zatwierdza produkcyjnego newslettera ani marketingu;
- nie wybiera providera;
- nie finalizuje 24-miesięcznego suppression record ani 6-letniego consent proof;
- nie zatwierdza profilowania;
- nie oznacza wykonania testów unsubscribe/restore;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.
