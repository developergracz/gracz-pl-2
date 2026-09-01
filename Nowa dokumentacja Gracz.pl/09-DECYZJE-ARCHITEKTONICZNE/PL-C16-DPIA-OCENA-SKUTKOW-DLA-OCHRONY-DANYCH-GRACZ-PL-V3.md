# Gracz.pl V3 — PL-C16 DPIA / ocena skutków dla ochrony danych

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C16`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — HOLD / VERSIONED / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E05`, `PL-E10`, `PL-E11`, `PL-E16`  
Powiązane kontrole: `PL-C01–PL-C15`

> Ten dokument jest kontrolą governance dla wymagania DPIA w Gracz.pl V3. Nie jest pełną DPIA. Nie stanowi opinii prawnej, nie zatwierdza ryzyka rezydualnego i nie autoryzuje implementacji ani deploymentu.

---

## 1. Kryterium PASS

`PL-C16 = PASS` jest możliwe dopiero wtedy, gdy:

1. formalny screening DPIA został wykonany i ma jednoznaczny wynik;
2. jeżeli screening wskazuje potrzebę DPIA — pełna DPIA została ukończona przed rozpoczęciem przetwarzania wysokiego ryzyka;
3. DPIA obejmuje wszystkie materialne procesy V3 i faktyczny model providerów;
4. ryzyka dla praw i wolności osób zostały opisane i ocenione przed safeguards oraz po safeguards;
5. istnieją nazwani ownerzy i terminy dla środków redukcji ryzyka;
6. ryzyko rezydualne zostało formalnie zaakceptowane albo wskazano potrzebę dalszego działania;
7. oceniono, czy wymagana jest uprzednia konsultacja z organem nadzorczym;
8. nie istnieje otwarty materialny P0/P1 blokujący DPIA lub jej środki;
9. ROPA, privacy notice, LIA, retencja, provider register i finalny decision record są zsynchronizowane z wynikiem DPIA.

---

## 2. Stan evidence

PL-E11 potwierdza:

```text
DPIA SCREENING = COMPLETED
DPIA DECISION = REQUIRED BEFORE PRODUCTION
DPIA SCOPE = WHOLE V3 PRIVACY MODEL WITH DEEP-DIVE SECTIONS
FULL DPIA COMPLETED = NO
HIGH-RISK PROCESSING MAY START NOW = NO
```

Oznacza to, że wymaganie wykonania screeningu zostało spełnione, ale samo wymaganie pełnej DPIA nadal pozostaje otwarte.

---

## 3. Materialne czynniki ryzyka

Pełna DPIA musi co najmniej objąć:

- użytkowników 16–17 lat i privacy-by-default;
- prywatne wiadomości i załączniki;
- dostęp administracyjny/moderacyjny do treści prywatnych;
- moderację, sankcje, odwołania i automatyzację decyzji;
- security telemetry, IP/UA, anti-abuse oraz ewentualny anti-cheat;
- łączenie danych pomiędzy Identity, Games, Messaging, Social, Moderation, Audit i telemetry;
- ranking, publiczne profile, chat i social exposure;
- providerów, subprocessors, regiony i transfery poza EOG;
- retencję, legal hold, privacy deletion i restriction;
- backup, restore, deletion replay i anti-resurrection;
- bezpieczeństwo danych SENSITIVE/EVIDENCE/SECRET;
- scenariusze szkód dla praw i wolności osób;
- ryzyko rezydualne po zastosowaniu safeguards.

---

## 4. Safeguards już ustanowione na poziomie projektu

Dokumentacja V3 ustanawia jako wymagania projektowe m.in.:

- data minimization;
- purpose limitation;
- klasyfikację danych;
- RBAC/MFA dla operacji uprzywilejowanych;
- szyfrowanie i zakaz plaintext prywatnych wiadomości w logach/audit/outbox;
- zakaz logowania sekretów;
- human review dla poważnych sankcji;
- prawa dostępu, usunięcia, restriction i sprzeciwu;
- retencję ograniczoną zegarem i akcją końcową;
- legal hold jako wąski wyjątek case-specific;
- deletion ledger i replay po restore;
- provider approval gate;
- brak marketingowego profilowania małoletnich w baseline;
- privacy by design/default.

Te środki są obecnie przede wszystkim evidence projektowym. Nie stanowią automatycznie dowodu operacyjnej skuteczności.

---

## 5. Otwarte blokery PL-C16

| ID | Bloker | Severity | Status |
|---|---|---:|---|
| PL-C16-B01 | pełna DPIA dla całego modelu V3 nie została wykonana | P1 Privacy/Legal | `OPEN` |
| PL-C16-B02 | finalny model safeguards dla użytkowników 16–17 nie został zamknięty w pełnej DPIA | P1 Privacy/Legal | `OPEN` |
| PL-C16-B03 | model dostępu/moderacji plaintext prywatnych wiadomości wymaga finalnego rozstrzygnięcia | P1 Privacy/Legal | `OPEN` |
| PL-C16-B04 | zakres security telemetry / anti-abuse / anti-cheat wymaga finalnej oceny proporcjonalności | P1 Privacy/Legal | `OPEN` |
| PL-C16-B05 | providerzy, DPA, subprocessors, regiony i transfery nie są jeszcze finalnie zweryfikowane | P1 Privacy/Legal | `OPEN` |
| PL-C16-B06 | nie oceniono jeszcze formalnie ryzyka rezydualnego po safeguards | P1 Privacy/Risk | `OPEN` |
| PL-C16-B07 | nie wykonano jeszcze decyzji, czy zachodzą przesłanki do uprzedniej konsultacji | P1 Privacy/Legal | `OPEN AFTER DPIA` |
| PL-C16-B08 | część safeguards wymaga operacyjnych testów i evidence przed produkcją | P1 Privacy/Operations | `OPEN` |

---

## 6. Minimalna struktura wymaganej pełnej DPIA

Pełna DPIA powinna posiadać wersjonowany artefakt zawierający co najmniej:

1. zakres i ownera;
2. opis systemu i przepływów danych;
3. kategorie osób i danych;
4. cele i zatwierdzone podstawy prawne;
5. ocenę niezbędności i proporcjonalności;
6. scenariusze zagrożeń i szkód;
7. ocenę prawdopodobieństwa i wpływu przed safeguards;
8. istniejące i planowane środki techniczne/organizacyjne;
9. ocenę ryzyka rezydualnego;
10. listę działań wymaganych do redukcji ryzyka;
11. ownerów, terminy i evidence locator;
12. decyzję Privacy/Legal Decision Ownera;
13. ocenę potrzeby konsultacji z organem;
14. harmonogram ponownego review;
15. historię zmian.

---

## 7. Triggery do aktualizacji DPIA

DPIA wymaga przeglądu co najmniej przy:

- dopuszczeniu użytkowników poniżej 16 lat;
- zmianie modelu zgody rodzica/opiekuna;
- profilowaniu marketingowym lub behawioralnym;
- automatycznych sankcjach bez human review;
- device fingerprinting lub istotnym rozszerzeniu anti-cheat;
- dodaniu danych lokalizacyjnych, biometrii lub celowego przetwarzania danych szczególnej kategorii;
- zmianie providerów, subprocesorów lub transferów;
- materialnej zmianie skali;
- rozszerzeniu telemetry;
- incydencie ujawniającym nowe ryzyko;
- zmianie retencji lub legal hold;
- wprowadzeniu funkcji regulowanej, np. gry o realne pieniądze.

---

## 8. Formalna decyzja PL-C16

```text
PL-C16 = HOLD

DPIA SCREENING = PASS / COMPLETED
DPIA REQUIRED = YES
FULL DPIA COMPLETED = NO
RESIDUAL RISK ASSESSMENT = NOT COMPLETED
ARTICLE 36 / PRIOR CONSULTATION DECISION = NOT COMPLETED
HIGH-RISK PROCESSING MAY START = NO
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

Werdykt `HOLD` wynika bezpośrednio z faktu, że formalny screening nakazał wykonanie pełnej DPIA przed produkcją, a pełna DPIA nie została jeszcze ukończona.

---

## 9. Warunki przejścia do PASS

Pełny `PASS` wymaga łącznie:

- ukończenia i wersjonowania pełnej DPIA;
- zatwierdzenia modelu małoletnich 16–17;
- zamknięcia modelu prywatnych wiadomości i dostępu moderacyjnego;
- zatwierdzenia telemetry / anti-abuse / anti-cheat;
- zamknięcia provider/DPA/transfer review;
- oceny skuteczności safeguards;
- oceny i formalnej akceptacji ryzyka rezydualnego;
- decyzji w sprawie ewentualnej uprzedniej konsultacji;
- synchronizacji ROPA, LIA, privacy notice, retencji i finalnego decision record;
- braku blokujących P0/P1 Privacy/Legal.

---

## 10. Granica autoryzacji

Utworzenie PL-C16:

- nie jest wykonaniem pełnej DPIA;
- nie akceptuje ryzyka rezydualnego;
- nie zatwierdza przetwarzania wysokiego ryzyka;
- nie zatwierdza providerów ani transferów;
- nie zmienia produkcji, kodu, Rendera, Cloudflare, sekretów ani DNS;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.
