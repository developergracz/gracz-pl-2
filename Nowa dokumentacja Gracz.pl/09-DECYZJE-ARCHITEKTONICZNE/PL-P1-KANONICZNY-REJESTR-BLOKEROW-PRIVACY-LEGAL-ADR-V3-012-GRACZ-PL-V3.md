# Gracz.pl V3 — Kanoniczny rejestr blokujących P1 Privacy/Legal dla ADR-V3-012

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **OPEN / 9 CANONICAL P1 BLOCKERS / FINAL SIGNATURE BLOCKED / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Źródło konsolidacyjne: `PL-C01-C20-KONSOLIDACJA-KONTROLI-I-WEJSCIE-DO-FORMALNEJ-DECYZJI-ADR-V3-012.md`

> Ten dokument deduplikuje otwarte warunki Privacy/Legal do kanonicznego rejestru P1. Jeden kanoniczny blocker może agregować kilka wpisów z PL-E, PL-R i PL-C, jeżeli dotyczą tego samego materialnego ryzyka lub tej samej decyzji. Rejestr nie autoryzuje implementacji ani deploymentu i nie jest finalnym approval artifact.

---

## 1. Reguła deduplikacji

Do rejestru trafia jeden P1 na jeden materialny problem decyzyjny, nawet jeśli ten sam problem pojawia się równolegle w kilku dokumentach.

Zasady:

1. duplikaty dokumentacyjne nie zwiększają liczby kanonicznych P1;
2. blocker pozostaje `OPEN`, dopóki wszystkie materialne kryteria zamknięcia w jego zakresie nie są spełnione;
3. evidence locator musi wskazywać trwały artefakt, nie ustną deklarację;
4. jeśli blocker wymaga profesjonalnej interpretacji prawnej, dokumentacja projektu nie może sama zamienić go w `PASS`;
5. zamknięcie P1 nie autoryzuje implementacji ani deploymentu;
6. drugi formalny formularz ADR-V3-012 nie może otrzymać finalnego `PASS / ACCEPTED`, dopóki którykolwiek kanoniczny P1 pozostaje otwarty.

---

## 2. Stan zbiorczy

```text
OPEN P0 PRIVACY/LEGAL = 0 KNOWN
CANONICAL P1 TOTAL = 9
CANONICAL P1 OPEN = 9
CANONICAL P1 CLOSED = 0
FINAL ADR-V3-012 SIGNATURE = BLOCKED
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

# 3. Kanoniczne blokery P1

## P1-PL-001 — Lawful basis / LIA / legal-duty decisions

**Zakres:** finalne podstawy prawne per proces, LIA dla art. 6 ust. 1 lit. f oraz wskazanie konkretnego obowiązku tam, gdzie projekt chce użyć art. 6 ust. 1 lit. c.

**Źródłowe kontrole:** `PL-C02`, częściowo `PL-C08`, `PL-E03`, `PL-E10`.

**Kryteria zamknięcia:**

- każdy materialny cel ma finalnie zatwierdzoną podstawę;
- wszystkie używane procesy 6(1)(f) mają zamknięte LIA;
- każde użycie 6(1)(c) wskazuje konkretny obowiązek prawny i jego locator;
- wynik jest zsynchronizowany z ROPA i privacy notice;
- brak otwartego materialnego wyjątku `PENDING LEGAL REVIEW / HOLD` dla procesów uruchamianych w V3.

**Owner:** Privacy/Legal Decision Owner; profesjonalny reviewer prawny tam, gdzie wymagana jest interpretacja prawa.  
**Milestone:** przed finalnym podpisem ADR-V3-012.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-002 — Material retention periods i podstawy ich utrzymywania

**Zakres:** materialne okresy pozostające na HOLD, w szczególności 6 lat privacy-request evidence, 24 miesiące suppression/unsubscribe record, 6 lat consent proof oraz do 6 lat privileged audit/role history.

**Źródłowe kontrole/decyzje:** `PL-C03`, `PL-R03`, `PL-R06`, `PL-R07`, `PL-E13`.

**Kryteria zamknięcia:**

- dla każdej materialnej retencji istnieje jawny cel, podstawa, clock, zakres danych i proporcjonalne uzasadnienie;
- wartości są zaakceptowane albo skrócone/przeprojektowane;
- określono wcześniejszy purge, wyjątki i legal hold;
- wartości są spójne z privacy notice i ROPA;
- tam, gdzie wymagana jest case-specific legal review, istnieje durable evidence decyzji.

**Owner:** Privacy/Legal Decision Owner.  
**Milestone:** przed finalnym podpisem ADR-V3-012.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-003 — Publication-ready privacy notice i transparency package

**Zakres:** doprowadzenie `PL-E09` do wersji publikacyjnej i zsynchronizowanie informacji dla użytkownika.

**Źródłowe kontrole:** `PL-C04`, częściowo `PL-C15`, `PL-E09`.

**Kryteria zamknięcia:**

- pełne dane kontaktowe administratora i skuteczny kanał privacy;
- finalne cele i podstawy;
- finalni odbiorcy/providerzy oraz transfery;
- finalne okresy/kryteria retencji;
- model małoletnich 16–17 i próg wieku opisany zgodnie z zatwierdzonym modelem;
- cookies/local-storage inventory zakończone albo jawnie wyłączone poza zakres z poprawną informacją;
- treść zsynchronizowana z pełną DPIA i ROPA;
- status dokumentu zmieniony z draft/non-publication-ready na zatwierdzony do publikacji.

**Owner:** Privacy/Legal Decision Owner.  
**Milestone:** przed finalnym podpisem ADR-V3-012 i przed produkcyjnym uruchomieniem V3.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-004 — Newsletter consent / suppression / consent proof

**Zakres:** finalny model zgody newsletterowej, unsubscribe, suppression i dowodu zgody.

**Źródłowe kontrole/decyzje:** `PL-C08`, `PL-R06`, częściowo `PL-C02`, `PL-C03`.

**Kryteria zamknięcia:**

- finalny model consent/withdrawal jest zaakceptowany;
- newsletter nie jest warunkiem podstawowej usługi;
- 24-miesięczny suppression record ma zaakceptowaną podstawę, zakres i minimalizację albo zostaje zmieniony;
- 6-letni consent proof ma zaakceptowaną case-specific podstawę i zakres albo zostaje zmieniony;
- ponowny zapis tworzy nowy consent event;
- wycofana zgoda nie może zostać reaktywowana przez restore;
- finalny model jest spójny z notice/ROPA.

**Owner:** Privacy/Legal Decision Owner + Newsletter owner.  
**Milestone:** przed finalnym podpisem ADR-V3-012.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-005 — Minors safeguards + pełna DPIA

**Zakres:** formalne zamknięcie modelu użytkowników 16–17 oraz wykonanie pełnej DPIA wymaganej przez screening.

**Źródłowe kontrole/evidence:** `PL-C12`, `PL-C16`, `PL-E05`, `PL-E11`.

**Kryteria zamknięcia:**

- pełna DPIA V3 jest wykonana, wersjonowana i zatwierdzona;
- oceniono ryzyka dla 16–17, prywatnych wiadomości, social/chat, moderacji, telemetry, anti-abuse/anti-cheat, providerów i łączenia danych;
- istnieje finalny privacy-by-default model dla 16–17;
- `<16` pozostaje zablokowane w baseline, chyba że osobny gate zatwierdzi inny model;
- age-assurance jest proporcjonalny i nie wymaga nadmiarowych danych;
- ustalono ryzyko rezydualne i potrzebę ewentualnych konsultacji art. 36;
- regulamin/notice/ROPA są zsynchronizowane z wynikiem DPIA.

**Owner:** Privacy/Legal Decision Owner.  
**Milestone:** przed finalnym podpisem ADR-V3-012 i bezwzględnie przed produkcyjnym przetwarzaniem wysokiego ryzyka.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-006 — Providers / processors / DPA

**Zakres:** formalne zatwierdzenie rzeczywiście używanych dostawców przetwarzających dane osobowe.

**Źródłowe kontrole/evidence:** `PL-C13`, `PL-E07`, `PL-E08`.

**Kryteria zamknięcia:**

- dla każdego używanego providera ustalono legal entity i rolę;
- DPA/kontrakt jest zweryfikowany tam, gdzie wymagany;
- znani są subprocesorzy;
- potwierdzono security/incident terms;
- potwierdzono prawa osób, deletion/return, retencję i backup lifecycle;
- istnieją durable evidence locatory;
- providerzy planowani, ale niewybrani, pozostają poza produkcyjnym przepływem danych do czasu osobnego approval gate.

**Owner:** Privacy/Legal Decision Owner + Technical/Service Owner.  
**Milestone:** przed finalnym podpisem dla providerów już wchodzących do zakresu V3 oraz przed każdym produkcyjnym użyciem danego providera.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-007 — Transfers outside EEA

**Zakres:** kompletna ocena transferów i dostępu spoza EOG dla rzeczywiście używanych providerów i subprocesorów.

**Źródłowe kontrole/evidence:** `PL-C14`, `PL-E07`, `PL-E08`.

**Kryteria zamknięcia:**

- ustalono miejsca storage i przetwarzania;
- ustalono remote/support/operations access;
- zweryfikowano subprocesorów;
- dla każdego transferu określono właściwy mechanizm;
- wykonano dodatkową ocenę/TIA i safeguards tam, gdzie wymagane;
- wynik jest odzwierciedlony w DPA, ROPA i privacy notice;
- brak niezweryfikowanego `TO VERIFY` dla providerów używanych w V3.

**Owner:** Privacy/Legal Decision Owner.  
**Milestone:** przed finalnym podpisem ADR-V3-012 i przed produkcyjnym transferem/dostępem.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-008 — Operational backup / restore / deletion replay

**Zakres:** operacyjny dowód privacy-safe backup/restore zgodny z PL-E15 i PL-R09.

**Źródłowe kontrole/decyzje:** `PL-C18`, `PL-E15`, `PL-R09`.

**Kryteria zamknięcia:**

- faktyczny schedule/expiry odpowiada zatwierdzonym limitom 35d / 12w / 12m;
- provider lifecycle/DPA/region/subprocessors są potwierdzone;
- wykonano izolowany restore test;
- wykonano deletion/restriction replay;
- wykazano anti-resurrection dla deleted account, profilu, sesji/tokenów i wycofanej zgody;
- aktywne i wygasłe legal holds są rekoncyliowane prawidłowo;
- restore environment jest usuwany w limicie maks. 7 dni;
- istnieje cykliczny DR/restore runbook i durable evidence cadence.

**Owner:** Operations + Security + Privacy/Legal.  
**Milestone:** przed finalnym podpisem ADR-V3-012 według obecnego gate oraz bezwzględnie przed Production V3 GO.  
**Status:** `OPEN / BLOCKING`.

---

## P1-PL-009 — Operational privacy-control evidence + PII/secret redaction

**Zakres:** pozostałe przekrojowe dowody, że projektowe kontrole privacy działają operacyjnie poza specyficznym zakresem backup/restore z P1-PL-008.

**Źródłowe kontrole:** `PL-C06`, `PL-C07`, `PL-C09`, `PL-C10`, `PL-C11`, `PL-C17`, `PL-C19` oraz odpowiednie PL-E/PL-R.

**Kryteria zamknięcia:**

- test end-to-end account deletion / purge / anonymize / restriction;
- test legal-hold create/review/release i powrotu do purge;
- test skutecznej anonimizacji oraz reidentification test dla danych przechowywanych bezterminowo jako anonimowe;
- potwierdzenie separacji danych pseudonimizowanych i materiału umożliwiającego powiązanie;
- field-level logging policy oraz automatyczne masking/redaction;
- negatywne testy braku plaintext prywatnych wiadomości, tokenów, credentiali, MFA secrets i zbędnego PII w audit/outbox/logs/telemetry/evidence;
- testy privacy receipts/evidence bez nadmiarowych danych;
- testy rejestracji/minimalizacji i innych materialnych privacy-by-default flows niepokrytych przez P1-PL-008.

**Owner:** Privacy/Legal + Security + QA + właściwi domain owners.  
**Milestone:** przed finalnym podpisem ADR-V3-012 według obecnego gate oraz przed Production V3 GO.  
**Status:** `OPEN / BLOCKING`.

---

# 4. Crosswalk HOLD → kanoniczny P1

| HOLD control | Kanoniczny blocker |
|---|---|
| `PL-C02` | `P1-PL-001`, częściowo `P1-PL-004` |
| `PL-C03` | `P1-PL-002`, częściowo `P1-PL-004` |
| `PL-C04` | `P1-PL-003` |
| `PL-C08` | `P1-PL-004`, zależność od `P1-PL-001` |
| `PL-C12` | `P1-PL-005` |
| `PL-C13` | `P1-PL-006` |
| `PL-C14` | `P1-PL-007` |
| `PL-C16` | `P1-PL-005` |
| `PL-C18` | `P1-PL-008` |

Kontrole `PASS WITH CONDITIONS` dostarczają warunków do `P1-PL-009` tylko wtedy, gdy są to materialne dowody operacyjne wymagane przez obecny gate. Nie są liczone jako osobne P1, jeżeli należą do jednego z powyższych dziewięciu problemów.

---

# 5. Kolejność zamykania zależności

Rekomendowana kolejność review, aby nie powielać pracy:

```text
1. P1-PL-001 LAWFUL BASES
2. P1-PL-002 MATERIAL RETENTION
3. P1-PL-004 NEWSLETTER CONSENT / SUPPRESSION / PROOF
4. P1-PL-006 PROVIDERS / PROCESSORS / DPA
5. P1-PL-007 TRANSFERS
6. P1-PL-005 FULL DPIA + MINORS
7. P1-PL-003 PUBLICATION-READY PRIVACY NOTICE
8. P1-PL-009 OPERATIONAL PRIVACY-CONTROL EVIDENCE
9. P1-PL-008 BACKUP / RESTORE / DELETION REPLAY EVIDENCE
```

Uzasadnienie: notice i pełna DPIA powinny bazować na już ustalonych podstawach, retencji, providerach i transferach. Dowody operacyjne powinny potwierdzać zatwierdzony model, a nie model jeszcze zmieniany.

---

# 6. Warunek wpisania `OPEN P1 = 0`

`OPEN P1 = 0` można wpisać do drugiego formalnego formularza tylko wtedy, gdy każdy `P1-PL-001`–`P1-PL-009` ma jednocześnie:

- status `CLOSED` albo formalnie dopuszczalne rozstrzygnięcie, które nie jest blokujące;
- ownera;
- datę decyzji/closure;
- durable evidence locator;
- zaktualizowane dokumenty zależne;
- brak nowego materialnego P1 ujawnionego w final delta review.

Do tego czasu:

```text
OPEN P1 = 9 CANONICAL / BLOCKING
FINAL VERDICT = HOLD
SECOND FORMAL DECISION DOCUMENT = DO NOT FINAL-SIGN
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

# 7. Granica autoryzacji

Utworzenie rejestru:

- nie zamyka żadnego P1;
- nie stanowi opinii prawnej;
- nie zatwierdza providerów, transferów ani retencji;
- nie wykonuje DPIA;
- nie uruchamia testów produkcyjnych, backupów, restore, purge ani migration;
- nie modyfikuje kodu, Render, bazy, DNS, sekretów ani providerów;
- nie autoryzuje implementacji ani deploymentu;
- nie jest finalnym podpisem drugiego formularza;
- nie zdejmuje freeze ani `Production V3 = NO-GO`.
