# Gracz.pl V3 — PL-C06 Data minimization

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C06`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E06`, `PL-E09`, `PL-E10`, `PL-E11`, `PL-E12`, `PL-E13`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — CONTROL EXECUTED / FREEZE-SAFE**

> Celem PL-C06 jest sprawdzenie, czy zakres danych projektowanych do przetwarzania przez Gracz.pl V3 jest adekwatny, stosowny i ograniczony do tego, co niezbędne dla konkretnych celów. Kontrola nie potwierdza implementacji technicznej i nie autoryzuje deploymentu.

---

## 1. Kryterium kontroli

Kryterium review pack:

```text
PL-C06 — data minimization
PASS CRITERION = zakres danych odpowiada celowi
```

Dla potrzeb tej kontroli wymagane jest co najmniej:

1. brak zbierania danych „na zapas”;
2. jawny cel dla każdej kategorii danych;
3. ograniczenie pól obowiązkowych do minimum potrzebnego do funkcji;
4. ograniczenie ekspozycji PUBLIC do danych rzeczywiście potrzebnych do funkcji publicznej;
5. zakaz kopiowania SECRET/SENSITIVE do logów, telemetry, audit i evidence bez konieczności;
6. ograniczenie identity verification do najmniej inwazyjnego skutecznego modelu;
7. ograniczenie IP/UA/security telemetry do zakresu uzasadnionego bezpieczeństwem;
8. minimalny zakres moderation/legal-hold evidence;
9. minimalny deletion/privacy ledger bez pełnych payloadów użytkownika;
10. brak domyślnego pozyskiwania danych szczególnych kategorii.

---

## 2. Ustalenia pozytywne

PL-E06 ustanawia bezpośrednią zasadę, że dane niepotrzebne do celu nie powinny być zbierane „na zapas”, a każda nowa kategoria danych wymaga aktualizacji ROPA, mapy celów/podstaw, retencji i privacy notice przed użyciem produkcyjnym.

Model V3 przewiduje także następujące ograniczenia:

- konto/profil nie wymaga domyślnie imienia i nazwiska, adresu, PESEL, numeru dokumentu, telefonu ani daty urodzenia;
- plaintext hasła nie jest przechowywany;
- IP/UA i security signals mogą być używane tylko w zakresie uzasadnionym bezpieczeństwem i retencją;
- dane gier/rankingu są publiczne tylko w jawnie zatwierdzonym zakresie;
- plaintext prywatnych wiadomości i załączników nie może być kopiowany do audit/logów/outbox/evidence JSON;
- newsletter ogranicza dane do e-maila, statusu subskrypcji, minimalnego proof i koniecznej telemetry;
- moderation evidence ma być ograniczone do sprawy i potrzeby dowodowej;
- audit nie może zawierać sekretów, pełnych tokenów, payloadów prywatnych wiadomości ani zbędnego PII;
- privacy requests nie powinny domyślnie przechowywać kopii dokumentów tożsamości;
- logi/traces/telemetry wymagają redaction/masking;
- backup dziedziczy klasyfikację danych i nie może być traktowany jako bezterminowe archiwum;
- baseline nie zakłada celowego pozyskiwania ani profilowania danych szczególnych kategorii z art. 9 RODO.

---

## 3. Obszary wymagające dalszego dowodu

### PL-C06-O01 — wymagane pola rejestracji

Przed produkcyjnym `PASS` należy potwierdzić w rzeczywistym formularzu/API, że obowiązkowe pola rejestracyjne są ograniczone do minimum potrzebnego do utworzenia konta i świadczenia usługi.

Status: `OPEN / OPERATIONAL EVIDENCE REQUIRED`.

### PL-C06-O02 — age assurance

Model 16+ nie może powodować zbierania nadmiarowych danych identyfikacyjnych. Jeżeli wiek będzie weryfikowany, należy preferować najmniej inwazyjny skuteczny mechanizm i unikać przechowywania skanów dokumentów, pełnej daty urodzenia lub innych nadmiarowych danych, o ile nie zostanie wykazana odrębna konieczność.

Status: `OPEN / MINORS + DPIA ALIGNMENT REQUIRED`.

### PL-C06-O03 — logging / telemetry redaction

Dokumentacja ustanawia zakaz logowania sekretów i plaintext prywatnych wiadomości, ale pełny `PASS` wymaga operacyjnego dowodu field-level redaction/masking dla logów, traces, error reporting i telemetry.

Status: `OPEN / OPERATIONAL EVIDENCE REQUIRED`.

### PL-C06-O04 — moderation evidence scope

Dla realnych workflows moderacyjnych należy wykazać, że system przechowuje tylko evidence potrzebne do konkretnej sprawy i nie kopiuje nadmiarowych treści użytkownika do audit lub długoterminowych rekordów.

Status: `OPEN / MODERATION + DPIA EVIDENCE REQUIRED`.

### PL-C06-O05 — privacy request identity verification

Należy potwierdzić model identyfikacji osoby realizującej prawo tak, aby nie żądać dokumentu tożsamości ani dodatkowych danych, jeśli istnieje mniej inwazyjny sposób wiarygodnego potwierdzenia tożsamości.

Status: `OPEN / PROCEDURAL EVIDENCE REQUIRED`.

### PL-C06-O06 — provider minimization

Faktyczni providerzy muszą zostać zweryfikowani pod kątem zakresu danych przesyłanych do nich, domyślnych logów/telemetry, support access, retention i możliwości ograniczenia zbierania danych.

Status: `OPEN / PL-E07 + PL-E08 DEPENDENCY`.

---

## 4. Niedozwolone wzorce

```text
COLLECT NOW, FIND PURPOSE LATER = PROHIBITED
FULL DATE OF BIRTH WHEN AGE BAND IS ENOUGH = PROHIBITED BY DEFAULT
ID DOCUMENT COPY FOR ROUTINE ACCOUNT USE = PROHIBITED BY DEFAULT
PLAINTEXT PRIVATE MESSAGE IN LOG/AUDIT = PROHIBITED
FULL TOKEN / MFA SECRET IN LOGS = PROHIBITED
WHOLE MAILBOX AS MODERATION EVIDENCE = PROHIBITED
WHOLE ACCOUNT AS LEGAL-HOLD DEFAULT = PROHIBITED
UNBOUNDED IP/UA TELEMETRY = PROHIBITED
NEW DATA CATEGORY WITHOUT ROPA/PURPOSE/RETENTION REVIEW = PROHIBITED
```

---

## 5. Ocena kontroli

```text
PL-C06 = PASS WITH CONDITIONS

DATA CLASSIFICATION = DEFINED
MINIMIZATION PRINCIPLE = DEFINED
NO DEFAULT COLLECTION OF EXCESSIVE IDENTITY DATA = ACCEPTED
NO DEFAULT SPECIAL-CATEGORY PROCESSING = ACCEPTED
PRIVATE MESSAGE / SECRET LOGGING = PROHIBITED
PUBLIC DATA SCOPE = MUST REMAIN PURPOSE-BOUND
AGE ASSURANCE MINIMIZATION = OPEN
LOGGING / TELEMETRY REDACTION EVIDENCE = OPEN
MODERATION EVIDENCE MINIMIZATION = OPEN
PRIVACY-REQUEST IDENTITY-VERIFICATION MINIMIZATION = OPEN
PROVIDER MINIMIZATION VERIFICATION = OPEN
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
FREEZE = ACTIVE
```

### Uzasadnienie werdyktu

Projektowy model minimalizacji jest wystarczająco konkretny i spójny, aby kontrola nie pozostawała `HOLD` wyłącznie z powodu braku modelu. Pełny `PASS` nie jest jednak możliwy bez potwierdzenia rzeczywistych formularzy, schematów API, logów/telemetry, procedur identity verification, moderation evidence oraz zakresu danych przekazywanych providerom.

---

## 6. Warunek pełnego PASS

`PL-C06 = PASS` będzie możliwe dopiero po przedstawieniu dowodu, że w rzeczywistym systemie:

- pola wejściowe są ograniczone do niezbędnych;
- dane opcjonalne są wyraźnie oddzielone od obowiązkowych;
- redaction/masking działa;
- identity verification nie wymusza nadmiarowych danych;
- moderation/legal-hold evidence jest zawężone;
- providerzy nie otrzymują danych szerszych niż niezbędne;
- nie istnieje nieudokumentowane zbieranie nowych kategorii danych.

---

## 7. Granica autoryzacji

Utworzenie PL-C06:

- nie zmienia schematu bazy ani formularzy;
- nie modyfikuje logowania/telemetry;
- nie zatwierdza żadnego providera;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `ADR-V3-012 = HOLD` ani `Production V3 = NO-GO`.
