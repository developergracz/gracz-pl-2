# Gracz.pl V3 — P1-PL-004 Finalny model newsletter consent / withdrawal / suppression / proof i formalne zamknięcie

Data decyzji: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-004`  
Status: **CLOSED AT PRIVACY/LEGAL GOVERNANCE LEVEL / CONSENT MODEL RESOLVED / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence/control: `PL-C08`, `PL-R06`, `P1-PL-001`, `P1-PL-002`, `PL-E09`

> Dokument finalizuje model newslettera i marketingu opartego na zgodzie dla bazowego Gracz.pl V3. Rozstrzyga semantykę consent, confirmation, withdrawal, unsubscribe, suppression i consent proof. Nie wybiera providera, nie potwierdza wdrożenia technicznego i nie autoryzuje implementacji ani deploymentu.

---

## 1. Zakres blockera

P1-PL-004 obejmuje:

- podstawę zgody dla newslettera/marketingu;
- sposób udzielenia zgody;
- confirmation / double opt-in;
- withdrawal i unsubscribe;
- suppression state;
- minimalny consent proof;
- ponowną subskrypcję;
- relację z restore/anti-resurrection;
- zakaz wymuszonego marketingu, cross-service marketing profiling i profilowania małoletnich.

Provider, DPA i transfery pozostają odpowiednio w `P1-PL-006` i `P1-PL-007`, a operacyjne testy propagation/restore w `P1-PL-008` i `P1-PL-009`.

---

## 2. Finalna podstawa i dobrowolność

Dla newslettera i dobrowolnej komunikacji marketingowej przyjmuje się:

```text
LAWFUL BASIS = ART. 6(1)(a) GDPR / CONSENT
MARKETING CONSENT = OPTIONAL
ACCOUNT / CORE SERVICE = NOT CONDITIONAL ON MARKETING CONSENT
PRE-CHECKED CONSENT = NOT ALLOWED
BUNDLED CONSENT WITH TERMS = NOT ALLOWED
```

Zgoda musi być odrębna od akceptacji regulaminu i od innych celów, które nie wymagają marketingu.

---

## 3. Model udzielenia zgody

Bazowy model V3 przyjmuje **double opt-in** jako projektowy standard newslettera:

1. użytkownik jawnie zaznacza niezaznaczony domyślnie checkbox lub wykonuje równoważną jednoznaczną akcję;
2. formularz wskazuje cel newslettera i linkuje odpowiednią informację privacy;
3. system tworzy stan `PENDING_CONFIRMATION`;
4. wysyłany jest confirmation link/token;
5. dopiero skuteczne potwierdzenie tworzy aktywny stan `SUBSCRIBED` i finalny consent event;
6. brak potwierdzenia nie uruchamia marketingu;
7. niepotwierdzony rekord wygasa zgodnie z retencją z PL-R06/P1-PL-002.

Double opt-in jest polityką projektową Gracz.pl służącą jakości dowodu i ograniczeniu przypadkowych zapisów; dokument nie twierdzi, że jest uniwersalnym wymogiem ustawowym dla każdej formy marketingu.

---

## 4. Minimalny consent event

Aktywny consent record powinien zawierać wyłącznie dane potrzebne do wykazania zgody i sterowania stanem:

- pseudonimowy lub minimalny subject/e-mail reference;
- consent event ID;
- timestamp;
- source/channel;
- purpose ID;
- wersję tekstu zgody / privacy notice / consent policy;
- status: pending / granted / withdrawn / superseded;
- confirmation timestamp, jeśli dotyczy;
- minimalny technical receipt/correlation reference bez zbędnego PII.

Nie przechowuje się jako consent proof pełnego profilu użytkownika, historii gier, wiadomości, zbędnego IP/UA, pełnych requestów HTTP ani danych niezwiązanych z consent lifecycle.

---

## 5. Withdrawal / unsubscribe

Finalna reguła:

```text
WITHDRAWAL = EFFECTIVE FOR FUTURE MARKETING WITHOUT UNDUE DELAY
UNSUBSCRIBE = STOP FUTURE MARKETING
WITHDRAWAL MAY NOT REMOVE CORE SERVICE ACCESS
OLD CONSENT MAY NOT BE REACTIVATED
```

Wymagania governance:

- withdrawal musi być co najmniej tak łatwe jak udzielenie zgody;
- link unsubscribe nie może wymagać zbędnego logowania;
- po skutecznym unsubscribe stan aktywnej subskrypcji staje się `WITHDRAWN / SUPPRESSED`;
- retry, outbox, cache i provider queue nie mogą legalnie traktować poprzedniej zgody jako aktywnej;
- withdrawal nie może zostać zignorowany z powodu braku automatyzacji — przed pełnym wdrożeniem wymagany jest co najmniej skuteczny proces manualny;
- użytkownik otrzymuje jasne potwierdzenie skutecznego wypisania, jeśli kanał na to pozwala.

---

## 6. Suppression record

P1-PL-002 rozstrzygnął retencję suppression record:

```text
SUPPRESSION RECORD MAX = 24 MONTHS
CLOCK = unsubscribed_at / withdrawal effective timestamp
```

Finalny model P1-PL-004 ustala funkcję tego rekordu:

- techniczne zapobieżenie przypadkowej ponownej wysyłce po withdrawal;
- minimalny dowód skutecznego wypisania;
- ograniczona obsługa skargi/błędu wysyłki.

Dozwolony minimalny zakres:

- keyed/HMAC e-mail reference albo inny minimalny subject reference;
- `unsubscribed_at`;
- source/channel;
- consent/policy version reference;
- status `suppressed`;
- expiry timestamp.

Suppression record nie może służyć do profilowania, remarketingu, odtworzenia aktywnej subskrypcji ani przedłużania historii marketingowej.

---

## 7. Consent proof po withdrawal

P1-PL-002 rozstrzygnął retencję:

```text
CONSENT PROOF MAX = 36 MONTHS
CLOCK = withdrawal / superseding consent event / end of relevant consent lifecycle
```

Consent proof jest wyłącznie minimalnym dowodem:

- że zgoda została udzielona;
- kiedy i jak została udzielona;
- jaką wersję tekstu zgody przedstawiono;
- że później została wycofana lub zastąpiona.

Blankietowe `6 YEARS` zostało odrzucone przez P1-PL-002.

---

## 8. Ponowna subskrypcja

Ponowna subskrypcja po withdrawal:

```text
NEW SUBSCRIPTION = NEW CONSENT EVENT
OLD WITHDRAWN CONSENT = NEVER REACTIVATED
```

Użytkownik musi przejść nowy jawny proces consent zgodny z aktualną wersją tekstu zgody i polityki. Historyczny suppression/withdrawal record może zostać powiązany wyłącznie w zakresie koniecznym do spójności i rozliczalności, ale nie staje się aktywną zgodą.

---

## 9. Restore / anti-resurrection

Reguła governance jest finalna:

- restore starszego backupu nie może reaktywować zgody;
- aktualny withdrawal/suppression state ma pierwszeństwo przed starszym stanem backupu;
- przed dopuszczeniem restore do normalnego użycia wymagany jest replay consent/privacy state;
- wycofana zgoda ma pozostać wycofana po restore;
- pending outbox/provider queues muszą respektować aktualny suppression state.

Wymagane dowody techniczne pozostają kanonicznie w `P1-PL-008` i `P1-PL-009`, więc brak jeszcze testu operacyjnego nie pozostawia P1-PL-004 otwartego jako problemu decyzyjnego.

---

## 10. Małoletni i profilowanie

W bazowym V3:

```text
MINOR MARKETING PROFILING = NOT APPROVED
BEHAVIORAL TARGETING OF 16–17 = NOT APPROVED
CROSS-SERVICE MARKETING PROFILE = NOT APPROVED
GAME HISTORY / PRIVATE MESSAGES / SECURITY TELEMETRY AS MARKETING INPUT = NOT APPROVED
```

Newsletter może być oferowany użytkownikom tylko zgodnie z finalnym modelem wieku, pełną DPIA i obowiązkiem informacyjnym. Ten dokument nie rozszerza modelu małoletnich i nie zmienia `P1-PL-005`.

---

## 11. Sprzeciw dla procesów 6(1)(f)

P1-PL-004 nie zmienia rozstrzygnięcia lawful-basis z P1-PL-001. Dla procesów opartych na art. 6(1)(f) obowiązuje case-specific objection workflow opisany w PL-C08.

Marketing newsletterowy w baseline opiera się na zgodzie, więc jego podstawowym mechanizmem zatrzymania jest withdrawal/unsubscribe, a nie przenoszenie newslettera na 6(1)(f).

---

## 12. Provider — zależność przeniesiona do P1-PL-006/007

P1-PL-004 nie wybiera dostawcy e-mail/newslettera.

Przed produkcyjnym użyciem konkretny provider musi przejść osobny gate obejmujący:

- rolę prawną;
- DPA/contract;
- subprocessors;
- regiony i remote access;
- transfery poza EOG;
- retention i deletion/return;
- suppression/unsubscribe API/behavior;
- offboarding;
- durable evidence locators.

Brak providera nie jest już niejasnością modelu consent; pozostaje blockerem `P1-PL-006` / `P1-PL-007`.

---

## 13. Testy — zależność przeniesiona do P1-PL-008/009

Przed Production V3 GO nadal obowiązkowo należy wykazać:

- subscribe -> confirmation -> active consent;
- withdrawal/unsubscribe zatrzymujący marketing;
- pending outbox nie wysyła po withdrawal;
- provider queue respektuje suppression;
- restore sprzed unsubscribe nie reaktywuje zgody;
- ponowny zapis tworzy nowy consent event;
- brak plaintext tokenów/sekretów i zbędnego PII w logach/evidence.

Te testy są operacyjnym evidence, a nie brakującą decyzją governance P1-PL-004.

---

## 14. Delta review PL-C08 / PL-R06

Po P1-PL-001 i P1-PL-002 następujące dawne blokery PL-C08/PL-R06 są rozstrzygnięte:

| Dawny blocker | Wynik |
|---|---|
| finalna podstawa newslettera | `6(1)(a) / CLOSED` |
| finalny consent model | `DOUBLE OPT-IN BASELINE / CLOSED` |
| 24m suppression | `APPROVED MAX 24M / CLOSED AS RETENTION DECISION` |
| 6y consent proof | `REJECTED; 36M MAX / CLOSED AS RETENTION DECISION` |
| ponowna subskrypcja | `NEW CONSENT EVENT REQUIRED / CLOSED` |
| marketing jako warunek konta | `NOT ALLOWED / CLOSED` |
| cross-service/minor profiling | `NOT APPROVED / CLOSED` |
| provider/DPA/transfers | `MOVED TO P1-PL-006 / P1-PL-007` |
| unsubscribe propagation tests | `MOVED TO P1-PL-009` |
| restore anti-resurrection tests | `MOVED TO P1-PL-008 / P1-PL-009` |

Dzięki deduplikacji nie pozostaje materialna decyzja consent/withdrawal należąca wyłącznie do P1-PL-004.

---

## 15. Aktualizacja kontroli PL-C08

Na poziomie governance/design wynik PL-C08 zmienia warstwę decyzyjną na:

```text
PL-C08 GOVERNANCE / CONSENT MODEL = PASS WITH CONDITIONS
NEWSLETTER LAWFUL BASIS = ART. 6(1)(a) / ACCEPTED
DOUBLE OPT-IN BASELINE = ACCEPTED
UNSUBSCRIBE STOPS FUTURE MARKETING = REQUIRED
SUPPRESSION MAX = 24 MONTHS
CONSENT PROOF MAX = 36 MONTHS
NEW SUBSCRIPTION = NEW CONSENT EVENT
MARKETING REQUIRED FOR CORE SERVICE = NO
MINOR MARKETING PROFILING = NOT APPROVED
CROSS-SERVICE MARKETING PROFILING = NOT APPROVED
PROVIDER / DPA / TRANSFER = OTHER P1 BLOCKERS
OPERATIONAL TESTS = OTHER P1 BLOCKERS
```

`PASS WITH CONDITIONS` nie oznacza gotowości produkcyjnej newslettera.

---

## 16. Formalne zamknięcie P1-PL-004

Kryteria kanonicznego P1-PL-004 są spełnione na poziomie Privacy/Legal governance:

- finalny consent/withdrawal model — **YES**;
- newsletter nie jest warunkiem core service — **YES**;
- suppression period i minimalny zakres — **YES**;
- consent proof period i minimalny zakres — **YES**;
- ponowny zapis tworzy nowy consent event — **YES**;
- restore nie może reaktywować zgody — **YES jako reguła governance; operational proof pozostaje P1-PL-008/009**;
- model jest gotowy do synchronizacji z notice/ROPA — **YES**;
- provider/DPA/transfers oraz testy są jawnie przeniesione do właściwych kanonicznych blockerów — **YES**.

```text
P1-PL-004 = CLOSED
CLOSURE TYPE = PRIVACY/LEGAL GOVERNANCE DECISION CLOSURE
CLOSURE DATE = 01.09.2026

CANONICAL P1 TOTAL = 9
CANONICAL P1 CLOSED = 3
CANONICAL P1 OPEN = 6
OPEN P0 PRIVACY/LEGAL = 0 KNOWN

P1-PL-003 = STILL OPEN / DEPENDENCY-BOUND
ADR-V3-012 FINAL VERDICT = HOLD
SECOND FORMAL DECISION DOCUMENT = DO NOT FINAL-SIGN YET
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

## 17. Następny niezależny blocker

Po zamknięciu P1-PL-004 kolejnym materialnym blockerem, który może zostać rozpoczęty dokumentacyjnie, jest:

`P1-PL-005 — Minors safeguards + pełna DPIA`.

To będzie wymagało wykonania pełnej DPIA, nie tylko screening.

---

## 18. Granica autoryzacji

Utworzenie tego dokumentu:

- nie uruchamia newslettera;
- nie wysyła żadnych wiadomości;
- nie wybiera ani nie zatwierdza providera;
- nie zmienia bazy, Render, DNS, sekretów ani konfiguracji;
- nie autoryzuje implementacji ani deploymentu;
- nie stanowi dowodu testów subscribe/unsubscribe/restore;
- nie zdejmuje freeze ani `Production V3 = NO-GO`.

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**