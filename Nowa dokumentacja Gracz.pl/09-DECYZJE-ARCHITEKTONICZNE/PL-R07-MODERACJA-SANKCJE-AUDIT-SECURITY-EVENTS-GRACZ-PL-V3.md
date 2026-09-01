# Gracz.pl V3 — PL-R07 Moderacja, sankcje, audit i security events

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL RETENTION REVIEW — PARTIAL APPROVAL / HOLD ON LONG AUDIT RETENTION / FREEZE-SAFE**  
Decision ID: `PL-R07`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E10-LIA-PRAWNIE-UZASADNIONY-INTERES-GRACZ-PL-V3.md`, `PL-E13-UZASADNIENIA-OKRESOW-RETENCJI-GRACZ-PL-V3.md`, `PL-E14-LEGAL-HOLD-I-WYJATKI-OD-USUWANIA-GRACZ-PL-V3.md`

> Dokument rozstrzyga blok retencyjny PL-R07 dla moderacji, sankcji, działań uprzywilejowanych i security events. Nie jest opinią prawną i nie autoryzuje implementacji ani deploymentu. Okresy nie są przedstawiane jako uniwersalne terminy ustawowe; muszą wynikać z konkretnego celu, podstawy prawnej, proporcjonalności i zakresu danych.

---

## 1. Zakres decyzji

PL-R07 obejmuje:

- moderation cases,
- zgłoszenia i evidence moderacyjne,
- działania moderatora,
- sankcje, blokady i odwołania,
- historię ról oraz privileged audit,
- security events wykorzystywane do wykrywania i analizy incydentów.

Nie obejmuje zwykłych application logs, raw traces, outbox i idempotency — te są oceniane w PL-R08.

---

## 2. Cele przetwarzania

Dopuszczalne cele tego bloku to wyłącznie:

1. obsługa zgłoszeń i odwołań;
2. ochrona użytkowników i integralności platformy przed nadużyciami;
3. wykrywanie powtarzalnych naruszeń w proporcjonalnym zakresie;
4. rozliczalność działań moderatorów i administratorów;
5. analiza incydentów bezpieczeństwa;
6. zachowanie minimalnego dowodu konkretnej sprawy, gdy istnieje rzeczywisty spór, roszczenie albo formalny legal hold.

Zabronione jest tworzenie bezterminowego profilu „ryzyka użytkownika” albo zachowywanie pełnej historii aktywności wyłącznie „na wszelki wypadek”.

---

## 3. Decyzje retencyjne

| ID | Zakres | Retention clock | Okres | Akcja końcowa | Decyzja |
|---|---|---|---:|---|---|
| PL-R07-A | moderation case / action / appeal | closure / expiry | 36 miesięcy | purge lub minimalizacja, chyba że aktywny hold | `APPROVE WITH CONDITIONS` |
| PL-R07-B | moderation evidence | closure + `retention_until` | 36 miesięcy domyślnie | purge po terminie lub po release hold | `APPROVE WITH CONDITIONS / MATERIAL REVIEW` |
| PL-R07-C | zakończona sankcja | `ended_at` / `revoked_at` | 36 miesięcy | minimalizacja i purge | `APPROVE WITH CONDITIONS` |
| PL-R07-D | privileged audit / role history | `occurred_at` | 24 mies. hot + do 48 mies. archive, łącznie maks. 6 lat | purge | `HOLD FOR CLASS-SPECIFIC JUSTIFICATION` |
| PL-R07-E | security events | `occurred_at` | 12 miesięcy | purge lub anonimowa agregacja | `APPROVE WITH CONDITIONS` |

---

## 4. Moderation case / action / appeal — 36 miesięcy

### Decyzja

`APPROVE WITH CONDITIONS`

### Uzasadnienie

Okres 36 miesięcy może być proporcjonalny dla:

- obsługi odwołań,
- rekonstrukcji zamkniętej sprawy,
- oceny powtarzalnych nadużyć w ograniczonym horyzoncie,
- ochrony przed manipulacją historią sankcji.

### Warunki

- po zamknięciu sprawy zakres danych musi być zminimalizowany;
- evidence może obejmować tylko dane potrzebne do konkretnej sprawy;
- nie przechowujemy całych prywatnych konwersacji, jeśli dla sprawy wystarcza wąski fragment lub bezpieczny dowód;
- dostęp wyłącznie need-to-know;
- poważne sankcje wymagają human review i ścieżki odwoławczej;
- po 36 miesiącach purge jest domyślny, chyba że istnieje aktywny, jawny legal hold.

---

## 5. Moderation evidence — 36 miesięcy domyślnie

### Decyzja

`APPROVE WITH CONDITIONS / MATERIAL REVIEW`

### Uzasadnienie

Evidence może być potrzebne dłużej niż sama bieżąca widoczność treści, ale jego zakres jest bardziej ingerujący niż zwykłe metadata sprawy. Dlatego:

- pełny materiał nie może być kopiowany „na zapas”;
- należy utrzymywać tylko evidence faktycznie potrzebne do konkretnego naruszenia;
- jeśli możliwe, należy zachować hash, identyfikator, timestamp, category/reason i ograniczony fragment zamiast pełnej treści;
- dane szczególnie prywatne wymagają silniejszego uzasadnienia i ograniczeń dostępu.

---

## 6. Zakończone sankcje — 36 miesięcy

### Decyzja

`APPROVE WITH CONDITIONS`

Po `ended_at` albo `revoked_at` historia sankcji może być utrzymywana przez 36 miesięcy dla odwołań, spójności moderacji i oceny powtarzalności naruszeń.

Po upływie okresu nie może powstać bezterminowy profil sankcyjny. Pozostawienie minimalnego anonimowego agregatu statystycznego jest dopuszczalne tylko wtedy, gdy nie pozwala na reidentyfikację osoby.

---

## 7. Privileged audit / role history — maksymalnie 6 lat

### Decyzja

`HOLD FOR CLASS-SPECIFIC JUSTIFICATION`

Projektowy model `24 miesiące hot + do 48 miesięcy archive` nie zostaje odrzucony technicznie, ale nie może zostać formalnie zatwierdzony jako jeden okres dla całej klasy audit.

Przed pełnym `APPROVE` wymagane jest rozbicie audit evidence co najmniej na:

- zmiany ról i uprawnień,
- działania administratora na koncie użytkownika,
- security-critical actions,
- operacje privacy/deletion/restriction,
- działania moderatora,
- konfigurację systemową,
- zwykłe techniczne audit events bez znaczenia prawnego.

Dla każdej klasy trzeba wskazać osobno:

1. cel,
2. podstawę,
3. zakres danych,
4. konieczność okresu,
5. krótszą możliwą alternatywę,
6. warunki archiwizacji,
7. akcję końcową.

Samo hasło „obrona przed roszczeniami” nie wystarcza do automatycznego utrzymania wszystkich audit events przez 6 lat.

---

## 8. Security events — 12 miesięcy

### Decyzja

`APPROVE WITH CONDITIONS`

12 miesięcy jest projektowo dopuszczalne dla wykrywania wzorców nadużyć i analizy incydentów, pod warunkiem:

- ścisłej minimalizacji,
- braku haseł, tokenów, MFA secrets i plaintext prywatnych wiadomości,
- braku wtórnego wykorzystania marketingowego,
- ograniczonego dostępu,
- zgodności z LIA i privacy notice,
- purge albo nieodwracalnej agregacji po okresie.

Jeżeli konkretna klasa security event nie wymaga 12 miesięcy, musi mieć krótszą retencję.

---

## 9. Legal hold

Legal hold może zatrzymać purge tylko dla konkretnego rekordu lub sprawy i musi zawierać co najmniej:

- reason,
- scope,
- owner,
- legal/business basis,
- `review_at`,
- `expires_at`,
- evidence locator.

Hold nie może automatycznie rozszerzać się na całe konto, wszystkie wiadomości, wszystkie logi albo całą historię użytkownika. Po release hold rekord wraca do zwykłej oceny purge.

---

## 10. Małoletni 16–17

Dla użytkowników 16–17 lat obowiązują dodatkowe safeguards:

- minimalizacja evidence,
- ograniczenie dostępu,
- zakaz marketingowego reuse,
- human review dla poważnych sankcji,
- prosty i zrozumiały mechanizm odwoławczy,
- brak bezterminowego scoringu zachowania,
- objęcie pełną DPIA przed produkcją.

Przyjęcie wieku 16+ w V3 jest polityką projektową, a nie twierdzeniem, że każdy serwis na mocy samego RODO musi mieć minimalny wiek 16 lat.

---

## 11. Warunki otwarte

| ID | Warunek | Severity | Status |
|---|---|---|---|
| PL-R07-O01 | rozbić 6-letni privileged audit na klasy i uzasadnić każdą osobno | P1 Privacy/Legal | `OPEN / BLOCKS FULL APPROVAL` |
| PL-R07-O02 | zamknąć model dostępu do prywatnych wiadomości wykorzystywanych jako moderation evidence | P1 Privacy/Legal | `OPEN` |
| PL-R07-O03 | potwierdzić finalny zakres security events i minimalizację | P1 Privacy/Legal | `OPEN` |
| PL-R07-O04 | odzwierciedlić zaakceptowane okresy w privacy notice i ROPA | P1 Privacy/Legal | `OPEN` |
| PL-R07-O05 | uwzględnić blok w pełnej DPIA | P1 Privacy/Legal | `OPEN` |

---

## 12. Werdykt PL-R07

```text
PL-R07 = HOLD / PARTIAL APPROVAL

MODERATION CASES / ACTIONS / APPEALS 36M = APPROVE WITH CONDITIONS
MODERATION EVIDENCE 36M = APPROVE WITH CONDITIONS / MATERIAL REVIEW
ENDED SANCTIONS 36M = APPROVE WITH CONDITIONS
PRIVILEGED AUDIT / ROLE HISTORY MAX 6Y = HOLD FOR CLASS-SPECIFIC JUSTIFICATION
SECURITY EVENTS 12M = APPROVE WITH CONDITIONS
LEGAL HOLD = NARROW / AUDITABLE / TIME-BOUND ONLY
FULL DPIA = STILL REQUIRED BEFORE PRODUCTION
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = NO AUTOMATIC CHANGE
FREEZE = ACTIVE
```

Pełny `APPROVE` dla PL-R07 jest możliwy dopiero po zamknięciu class-specific justification dla privileged audit i pozostałych materialnych warunków P1.

---

## 13. Granica autoryzacji

Utworzenie PL-R07:

- nie uruchamia żadnego purge,
- nie zmienia runtime ani konfiguracji produkcyjnej,
- nie autoryzuje monitorowania prywatnych wiadomości,
- nie autoryzuje profilowania użytkowników,
- nie zatwierdza automatycznych sankcji bez human review,
- nie autoryzuje implementacji ani deploymentu,
- nie zdejmuje freeze,
- nie zmienia `Production V3 = NO-GO`.
