# Gracz.pl V3 — PL-R08 Outbox, idempotency, logi, traces i metryki

Data decyzji: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — APPROVE WITH CONDITIONS / VERSIONED / FREEZE-SAFE**  
Decision ID: `PL-R08`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E06`, `PL-E10`, `PL-E12`, `PL-E13`, `PL-E15`  
Decision Owner: `Czesław Socha — Privacy/Legal Decision Owner Gracz.pl`

> Decyzja PL-R08 obejmuje wyłącznie retencję i zasady privacy dla outbox, rekordów idempotency, logów aplikacyjnych i bezpieczeństwa, raw traces oraz zagregowanych metryk. Nie stanowi autoryzacji implementacji, deploymentu ani rozszerzenia telemetry.

---

## 1. Zakres decyzji

PL-R08 obejmuje następujące klasy danych technicznych:

- completed outbox,
- failed/dead-letter outbox,
- idempotency records,
- application logs,
- security logs,
- raw traces,
- zagregowane metryki bez identyfikatorów osoby.

Celem decyzji jest potwierdzenie, czy projektowe okresy są proporcjonalne do celów diagnostycznych, bezpieczeństwa, niezawodności i ochrony przed ponownym wykonaniem operacji.

---

## 2. Zasady nadrzędne

1. Logi, traces i outbox nie są archiwum historii użytkownika.
2. Dane techniczne nie mogą zawierać plaintext haseł, tokenów, MFA secrets, kluczy, prywatnych wiadomości ani zbędnego PII.
3. Payload outbox musi być minimalizowany do danych niezbędnych do poprawnego przetworzenia zdarzenia.
4. Idempotency records służą wyłącznie ochronie przed ponownym wykonaniem operacji i race/retry.
5. Security logs mogą mieć dłuższą retencję niż zwykłe logi wyłącznie przy konkretnym celu bezpieczeństwa.
6. Raw traces wymagają najkrótszej retencji z uwagi na wysoką szczegółowość.
7. Zagregowane metryki mogą być utrzymywane dłużej tylko wtedy, gdy nie zawierają realnie identyfikujących danych.
8. Provider observability, jeżeli zostanie użyty, podlega PL-E07/PL-E08 oraz ocenie transferów i DPA.
9. Legal hold nie może przekształcić logów ani traces w bezterminowe archiwum.
10. Backup nie przedłuża retencji danych ponad naturalny cykl backupu i wymaga deletion replay po restore.

---

## 3. Macierz decyzji PL-R08

| ID | Klasa | Retention clock | Okres | Cel | Akcja końcowa | Decyzja |
|---|---|---|---:|---|---|---|
| PL-R08-01 | completed outbox | `published_at` | 30 dni | troubleshooting, krótkoterminowa diagnostyka i potwierdzenie publikacji | purge | `APPROVE WITH CONDITIONS` |
| PL-R08-02 | failed/dead-letter outbox | terminal state | 90 dni | resolution błędu i kontrolowane evidence awarii | purge po resolution | `APPROVE WITH CONDITIONS` |
| PL-R08-03 | idempotency records — standard | completion | 30 dni | ochrona przed powtórnym wykonaniem komendy | purge | `APPROVE WITH CONDITIONS` |
| PL-R08-04 | idempotency — game/tournament/admin | completion | maks. 90 dni | dłuższe okno retry/race dla operacji o wyższym ryzyku spójności | purge | `APPROVE WITH CONDITIONS` |
| PL-R08-05 | application logs | ingestion | 30 dni | diagnostyka działania aplikacji | purge | `APPROVE WITH CONDITIONS` |
| PL-R08-06 | security logs | ingestion | 90 dni | wykrywanie i analiza incydentów bezpieczeństwa | purge | `APPROVE WITH CONDITIONS / LIA ALIGNMENT` |
| PL-R08-07 | raw traces | ingestion | 14 dni | szczegółowa diagnostyka błędów i wydajności | purge | `APPROVE WITH CONDITIONS` |
| PL-R08-08 | zagregowane metryki bez ID | aggregation period | 13 miesięcy | analiza trendów, sezonowości i pojemności | dalsza anonimowa agregacja lub purge | `APPROVE WITH CONDITIONS` |

---

## 4. Uzasadnienie proporcjonalności

### 4.1. Completed outbox — 30 dni

Po skutecznej publikacji zdarzenia jego wartość operacyjna szybko spada. 30 dni zapewnia rozsądne okno do diagnozy retransmisji, opóźnień, błędów downstream i korelacji incydentów, bez tworzenia długoterminowego archiwum payloadów.

Warunek: payload musi być minimalny i nie może zawierać treści prywatnych wiadomości, sekretów ani danych, których odbiorca zdarzenia nie potrzebuje.

### 4.2. Failed/dead-letter outbox — 90 dni

Dłuższy okres jest uzasadniony potrzebą zidentyfikowania, naprawy i potwierdzenia zamknięcia awarii. Po resolution rekord nie może pozostać bezterminowo tylko dlatego, że kiedyś zakończył się błędem.

Warunek: po zamknięciu sprawy obowiązuje purge zgodnie z clockiem albo wcześniejszy purge, jeśli evidence nie jest już potrzebne.

### 4.3. Idempotency — 30/90 dni

Rekord idempotency ma jeden cel: zapobiec wielokrotnemu wykonaniu tej samej operacji. Standardowo 30 dni jest wystarczającym projektowym oknem. Do 90 dni dopuszcza się dla game/tournament/admin wyłącznie tam, gdzie retry lub opóźnione przetwarzanie może realnie stworzyć istotny problem spójności lub podwójnego skutku.

Warunek: idempotency key nie może być wykorzystywany jako ukryty identyfikator behawioralny użytkownika.

### 4.4. Application logs — 30 dni

Zwykłe logi aplikacyjne służą bieżącej diagnostyce. Nie ma uzasadnienia dla budowania z nich historii aktywności użytkownika. Dłuższa retencja wymagałaby osobnej decyzji i konkretnego celu.

### 4.5. Security logs — 90 dni

Dłuższy niż dla zwykłych logów okres wynika z potrzeby wykrywania incydentów, korelacji zdarzeń i analizy wzorców ataku. Okres jest powiązany z LIA i wymaga minimalizacji oraz ścisłego access control.

Warunek: zakres IP/UA/security metadata musi pozostać ograniczony do potrzeb bezpieczeństwa i nie może być wykorzystywany do marketingowego profilowania.

### 4.6. Raw traces — 14 dni

Raw traces mają najwyższą szczegółowość i największe ryzyko niezamierzonego przechwycenia danych request/response. Ich wartość operacyjna szybko maleje, dlatego przyjmuje się krótki okres 14 dni.

Warunek: obowiązkowe redaction/filtering i zakaz zapisu sekretów oraz message body.

### 4.7. Zagregowane metryki — 13 miesięcy

13 miesięcy pozwala porównać pełny cykl roczny oraz okresy sezonowe. Taki okres jest akceptowalny wyłącznie dla danych rzeczywiście zagregowanych i nieidentyfikujących osoby.

Jeżeli metryka zawiera user ID, IP, device ID, persistent pseudonymous ID albo pozwala realistycznie odtworzyć zachowanie konkretnej osoby, nie jest traktowana jako anonimowa metryka i wymaga osobnej polityki retencji.

---

## 5. Minimalizacja i zakazy

W outbox, logach, traces i metrykach obowiązuje bezwzględny zakaz utrwalania:

- haseł,
- pełnych tokenów sesji, resetu i rejestracji,
- MFA secrets i recovery codes,
- kluczy szyfrujących,
- pełnej treści prywatnych wiadomości,
- treści załączników,
- pełnych danych kart/płatności, jeśli kiedykolwiek pojawią się w przyszłym scope,
- danych szczególnych kategorii bez jawnej potrzeby i osobnej decyzji,
- pełnych dokumentów tożsamości,
- nadmiarowych request/response bodies.

Jeżeli takie dane pojawią się przypadkowo, incydent wymaga redaction/purge oraz oceny wpływu na bezpieczeństwo i privacy.

---

## 6. Provider observability

Jeżeli Gracz.pl użyje zewnętrznego providera logów, traces lub metryk, przed produkcją wymagane są:

- klasyfikacja roli providera,
- DPA/warunki powierzenia, jeśli właściwe,
- lista subprocessors,
- regiony przetwarzania i transfery,
- polityka retencji providera zgodna lub bardziej restrykcyjna niż PL-R08,
- możliwość purge/export,
- security controls,
- evidence locator w dokumentacji.

Brak takiej weryfikacji oznacza `HOLD` dla użycia konkretnego providera, ale nie zmienia samej decyzji PL-R08 dla modelu retencji.

---

## 7. Legal hold

Legal hold może dotyczyć technicznych logów wyłącznie wtedy, gdy istnieje konkretna sprawa, incydent, roszczenie lub obowiązek wymagający zachowania oznaczonego zakresu.

Każdy hold musi mieć:

- reason,
- scope,
- owner,
- created_at,
- review_at,
- expires_at lub jawny warunek zakończenia.

Hold nie daje zgody na zatrzymanie całych logów platformy „na wszelki wypadek”.

---

## 8. Warunki przed pełnym PASS

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-R08-O01 | potwierdzić schema-level redaction dla logów/traces | P1 Privacy/Security | Security/Observability | `OPEN` |
| PL-R08-O02 | potwierdzić, że outbox payload nie zawiera plaintext private-message content/secrets | P1 Privacy/Security | Architecture/Messaging | `OPEN` |
| PL-R08-O03 | zweryfikować przyszłego observability providera przez PL-E07/PL-E08 | P1 Privacy/Legal | Privacy/Legal | `OPEN IF EXTERNAL PROVIDER USED` |
| PL-R08-O04 | potwierdzić purge jobs / lifecycle policy dla 14/30/90 dni i 13 miesięcy | P1 Operational | Operations | `OPEN BEFORE PRODUCTION` |
| PL-R08-O05 | udokumentować test, że metric aggregates są rzeczywiście nieidentyfikujące | P2 Privacy | Privacy/Analytics | `OPEN BEFORE FULL PASS` |

---

## 9. Formalna decyzja

```text
PL-R08 = APPROVE WITH CONDITIONS

COMPLETED OUTBOX = 30 DAYS
FAILED / DEAD-LETTER OUTBOX = 90 DAYS
IDEMPOTENCY STANDARD = 30 DAYS
IDEMPOTENCY GAME / TOURNAMENT / ADMIN = MAX 90 DAYS
APPLICATION LOGS = 30 DAYS
SECURITY LOGS = 90 DAYS
RAW TRACES = 14 DAYS
ANONYMOUS AGGREGATED METRICS = 13 MONTHS
SECRETS / PRIVATE MESSAGE BODY IN LOGS = PROHIBITED
EXTERNAL OBSERVABILITY PROVIDER = REQUIRES PL-E07 / PL-E08
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
PRODUCTION V3 = NO-GO
```

Pełny `APPROVE / PASS` wymaga dowodu operacyjnego egzekwowania retention policy, redaction i provider controls. Na obecnym etapie decyzja projektowa jest zaakceptowana warunkowo, ale nie potwierdza wdrożenia.

---

## 10. Granica autoryzacji

Utworzenie PL-R08:

- nie uruchamia purge jobs,
- nie zmienia konfiguracji loggera ani observability,
- nie wdraża zmian w outbox/idempotency,
- nie autoryzuje providera,
- nie zmienia Render, produkcji ani sekretów,
- nie zdejmuje freeze,
- nie zmienia `ADR-V3-012 = HOLD` dopóki wszystkie wymagane decyzje i kontrole nie zostaną domknięte.
