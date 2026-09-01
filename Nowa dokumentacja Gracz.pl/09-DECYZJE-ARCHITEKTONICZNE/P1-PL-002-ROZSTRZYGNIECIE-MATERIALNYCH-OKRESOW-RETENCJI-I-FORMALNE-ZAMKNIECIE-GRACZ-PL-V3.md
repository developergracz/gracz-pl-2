# Gracz.pl V3 — P1-PL-002 Rozstrzygnięcie materialnych okresów retencji i formalne zamknięcie

Data decyzji: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-002`  
Status: **CLOSED AT PRIVACY/LEGAL GOVERNANCE LEVEL / RETENTION VALUES RESOLVED / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence/decyzje: `PL-E13`, `PL-R03`, `PL-R06`, `PL-R07`, `P1-PL-001`

> Dokument rozstrzyga cztery materialne okresy retencji, które wcześniej pozostawały na `HOLD`: privacy-request evidence, unsubscribe/suppression record, consent proof oraz privileged audit/role history. Decyzja ustala politykę projektową Gracz.pl V3 i nie przedstawia żadnego okresu jako uniwersalnego ustawowego terminu. Nie autoryzuje implementacji ani deploymentu.

---

## 1. Podstawa decyzji

Oficjalne źródła referencyjne:

- RODO/GDPR — art. 5 ust. 1 lit. e i art. 5 ust. 2: ograniczenie przechowywania oraz rozliczalność;
- UODO — „Czy trzeba precyzyjnie określać okres przechowywania danych?”: administrator, gdy brak szczegółowego terminu ustawowego, powinien samodzielnie ustalić termin usunięcia albo okresowego przeglądu w oparciu o cel i niezbędność;
- EDPB Guidelines 05/2020 on consent — administrator powinien być w stanie wykazać, jak i kiedy zgoda została uzyskana oraz jakie informacje przedstawiono osobie; RODO nie ustanawia jednego uniwersalnego okresu dla takiego proof.

Zasada przyjęta dla Gracz.pl V3:

```text
NO BLANKET SIX-YEAR RETENTION
NO RETENTION "JUST IN CASE"
MINIMUM EVIDENCE ONLY
FIXED CLOCK + FIXED MAXIMUM + EARLY PURGE
CASE-SPECIFIC LEGAL HOLD MAY TEMPORARILY SUSPEND PURGE
```

---

## 2. Decyzja 1 — privacy request evidence

### Poprzedni stan

`6 lat = HOLD / CASE-SPECIFIC LEGAL REVIEW`.

### Decyzja finalna projektu

```text
PRIVACY REQUEST EVIDENCE = 36 MONTHS MAXIMUM
RETENTION CLOCK = completion of the request
SIX-YEAR DEFAULT = REJECTED
```

### Cel

- wykazanie, że żądanie privacy zostało przyjęte, ocenione i wykonane;
- rozliczalność procesu praw osoby;
- możliwość rekonstrukcji minimalnego przebiegu sprawy przy skardze lub audycie.

### Minimalny zakres

Dozwolone wyłącznie:

- request ID;
- typ żądania;
- pseudonimowy/HMAC subject reference;
- status;
- timestamps;
- decision/result code;
- minimalny receipt/evidence locator;
- minimalny exception/hold reference, jeśli dotyczy.

Niedozwolone jako rutynowe evidence:

- pełne kopie danych użytkownika;
- pełne dokumenty tożsamości;
- plaintext prywatnych wiadomości;
- hasła, tokeny, MFA secrets;
- pełne eksporty konta po zamknięciu sprawy.

### Podstawa governance

Dla samego wykonania żądania obowiązki wynikają bezpośrednio z RODO. Przechowywany po zamknięciu minimalny record służy rozliczalności tego procesu i jest ograniczony do 36 miesięcy; nie jest blankietowym archive ani ogólnym claims store.

### Early purge

Dopuszczalny przed 36 miesiącami, jeśli:

- record nie jest już potrzebny do rozliczalności;
- nie istnieje otwarta skarga/spór;
- nie ma aktywnego, wąskiego legal hold.

### Decyzja

`APPROVED — 36 MONTHS MAX / MINIMAL EVIDENCE ONLY`.

---

## 3. Decyzja 2 — unsubscribe / suppression record

### Poprzedni stan

`24 miesiące = HOLD`.

### Decyzja finalna projektu

```text
UNSUBSCRIBE / SUPPRESSION RECORD = 24 MONTHS MAXIMUM
RETENTION CLOCK = unsubscribed_at / withdrawal effective timestamp
```

### Cel

- zapobieżenie przypadkowemu ponownemu włączeniu marketingu po withdrawal/unsubscribe;
- minimalny dowód skutecznego wypisania;
- obsługa ograniczonej skargi/błędu wysyłki.

### Minimalny zakres

- keyed/HMAC e-mail reference albo inny minimalny subject reference;
- `unsubscribed_at`;
- source/channel;
- policy/consent version reference;
- status `suppressed`;
- expiry timestamp.

Nie przechowuje się jako suppression record:

- historii otwarć i kliknięć;
- historii gier;
- profilu użytkownika;
- danych security;
- pełnej historii kampanii.

### Warunek zależny

Semantyka consent/withdrawal i finalny workflow newslettera pozostają w `P1-PL-004`. Ten warunek nie pozostawia okresu retencji `OPEN`: limit 24 miesięcy jest rozstrzygnięty i może zostać tylko skrócony przez późniejsze review.

### Decyzja

`APPROVED — 24 MONTHS MAX / MINIMAL SUPPRESSION ONLY`.

---

## 4. Decyzja 3 — consent proof newslettera

### Poprzedni stan

`6 lat = HOLD / CASE-SPECIFIC LEGAL REVIEW`.

### Decyzja finalna projektu

```text
CONSENT PROOF = 36 MONTHS MAXIMUM
RETENTION CLOCK = withdrawal / superseding consent event / end of relevant consent lifecycle
SIX-YEAR DEFAULT = REJECTED
```

### Cel

- możliwość wykazania, że zgoda została faktycznie uzyskana;
- wykazanie wersji informacji/tekstu zgody przedstawionego osobie;
- wykazanie czasu, źródła i sposobu uzyskania zgody;
- rozliczalność withdrawal/unsubscribe.

### Minimalny zakres

- pseudonimowy/HMAC subject reference;
- consent timestamp;
- source/channel;
- consent text/policy version ID;
- action: grant / withdraw / supersede;
- minimalny technical receipt/correlation reference bez zbędnego PII.

Nie przechowuje się jako consent proof:

- pełnego profilu użytkownika;
- historii rozgrywek;
- prywatnych wiadomości;
- pełnych requestów HTTP;
- IP/UA, chyba że odrębny konkretny cel i podstawa wykażą konieczność;
- provider telemetry niezwiązanego bezpośrednio z dowodem zgody.

### Relacja z P1-PL-004

`P1-PL-004` nadal odpowiada za finalny model consent/withdrawal, double opt-in, provider flow i anti-resurrection. Nie pozostawia to otwartego pytania o długość consent proof: maksymalny projektowy okres wynosi 36 miesięcy.

### Decyzja

`APPROVED — 36 MONTHS MAX / MINIMAL PROOF ONLY`.

---

## 5. Decyzja 4 — privileged audit / role history

### Poprzedni stan

`24 miesiące hot + do 48 miesięcy archive = maks. 6 lat / HOLD`.

### Decyzja finalna projektu

Blankietowe 6 lat zostaje odrzucone. Audit jest rozbity na klasy:

| Klasa | Maksymalna retencja | Clock | Uzasadnienie |
|---|---:|---|---|
| zwykłe techniczne privileged audit bez trwałego skutku | 12 miesięcy | `occurred_at` | diagnostyka i krótkoterminowa rozliczalność |
| działania administratora na koncie użytkownika | 24 miesiące | `occurred_at` | rozliczalność dostępu/zmian przy ograniczeniu długiej historii |
| działania moderatora niewchodzące do osobnego moderation case | 24 miesiące | `occurred_at` | kontrola działań uprzywilejowanych; case ma własną retencję |
| zmiany ról i uprawnień | 36 miesięcy | `occurred_at` | rekonstrukcja uprawnień i access history |
| security-critical privileged actions | 36 miesięcy | `occurred_at` | analiza incydentów i odpowiedzialność operacyjna |
| privacy/deletion/restriction privileged actions | 36 miesięcy | `occurred_at` | rozliczalność wykonania operacji privacy |
| krytyczne zmiany konfiguracji bezpieczeństwa | 36 miesięcy | `occurred_at` | rekonstrukcja zmian wpływających na ochronę systemu |

Zasady:

- nie istnieje domyślne „6 lat dla całego audit”;
- zwykłe eventy nie są automatycznie awansowane do 36 miesięcy;
- audit nie zawiera sekretów ani plaintext prywatnych wiadomości;
- po okresie następuje purge lub nieodwracalna anonimizacja statystyczna, jeśli istnieje odrębny cel;
- konkretny incydent/spór może mieć wąski legal hold, ale hold nie zmienia bazowej polityki retencji.

### Decyzja

`APPROVED — CLASS-SPECIFIC 12M / 24M / 36M MAX; BLANKET 6Y REJECTED`.

---

## 6. Crosswalk do poprzednich HOLD

| Pozycja | Poprzednio | Decyzja po P1-PL-002 |
|---|---|---|
| PL-E13-R07 / PL-R03 privacy request evidence | 6 lat / HOLD | 36 miesięcy max / APPROVED |
| PL-E13-R23 / PL-R06 unsubscribe record | 24 mies. / HOLD | 24 miesiące max / APPROVED |
| PL-E13-R24 / PL-R06 consent proof | 6 lat / HOLD | 36 miesięcy max / APPROVED |
| PL-E13-R30 / PL-R07 privileged audit | do 6 lat / HOLD | 12/24/36 miesięcy zależnie od klasy / APPROVED |

---

## 7. Warunki przeniesione, a nie dublowane

Zgodnie z kanonicznym rejestrem P1:

- consent/withdrawal workflow, newsletter provider i anti-resurrection pozostają w `P1-PL-004`;
- publication-ready opis okresów pozostaje w `P1-PL-003`;
- pełna DPIA pozostaje w `P1-PL-005`;
- provider/DPA/transfer pozostają w `P1-PL-006` i `P1-PL-007`;
- faktyczna automatyzacja purge, testy i evidence działania pozostają w `P1-PL-009`;
- backup/restore deletion replay pozostaje w `P1-PL-008`.

Te zależności nie oznaczają, że same okresy retencji są nadal nierozstrzygnięte.

---

## 8. Kryteria zamknięcia P1-PL-002

Kryteria kanonicznego blockera są spełnione na poziomie governance:

- każdy materialny okres ma konkretny cel;
- każdy ma retention clock;
- zakres danych jest jawnie zminimalizowany;
- 6-letnie blanket retention zostało odrzucone;
- ustalono akcję końcową i możliwość earlier purge;
- legal hold jest wyjątkiem case-specific, a nie nowym okresem bazowym;
- wartości są gotowe do synchronizacji z ROPA, privacy notice i ADR;
- nie ma już materialnego `PENDING` dotyczącego długości czterech okresów objętych P1-PL-002.

---

## 9. Formalny status

```text
P1-PL-002 = CLOSED

PRIVACY REQUEST EVIDENCE = 36 MONTHS MAX
UNSUBSCRIBE / SUPPRESSION = 24 MONTHS MAX
CONSENT PROOF = 36 MONTHS MAX
PRIVILEGED AUDIT = CLASS-SPECIFIC 12M / 24M / 36M MAX
BLANKET SIX-YEAR RETENTION = REJECTED
EARLY PURGE = ALLOWED / REQUIRED WHEN PURPOSE ENDS
LEGAL HOLD = CASE-SPECIFIC / NARROW / TIME-BOUNDED

CANONICAL P1 CLOSED = 2 OF 9
CANONICAL P1 OPEN = 7 OF 9
OPEN P0 PRIVACY/LEGAL = 0 KNOWN
FINAL ADR-V3-012 VERDICT = HOLD
SECOND FORMAL DOCUMENT FINAL SIGNATURE = NOT YET
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

## 10. Granica autoryzacji

Utworzenie tego dokumentu:

- nie uruchamia purge jobów;
- nie modyfikuje danych produkcyjnych;
- nie zmienia Render, bazy, providerów, DNS ani sekretów;
- nie autoryzuje implementacji ani deploymentu;
- nie zatwierdza newsletter providera;
- nie stanowi profesjonalnej opinii prawnej;
- nie zdejmuje freeze ani Production V3 NO-GO.

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**