# Gracz.pl V3 — PL-R06 Newsletter, consent proof, unsubscribe, analytics i provider telemetry

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL RETENTION REVIEW — OPEN / VERSIONED / FREEZE-SAFE**  
Decision ID: `PL-R06`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E09`, `PL-E13`, `PL-E14`  
Zakres formalnego review: newsletter, zgoda, unsubscribe, suppression/proof, analytics i telemetry dostawcy

> Ten dokument nie stanowi opinii prawnej. Ustala projektowy model retencji dla newslettera i powiązanych dowodów. Okresy oznaczone jako `HOLD` nie mogą zostać uznane za finalnie zatwierdzone bez odrębnego uzasadnienia prawnego i decyzji Privacy/Legal Decision Ownera.

---

## 1. Decyzja w skrócie

Przyjmuje się następujący model projektowy:

- niepotwierdzona subskrypcja: `30 dni`,
- metadata tokenu confirmation/unsubscribe: `7 dni` od expiry/consume/revoke,
- minimalny rekord po unsubscribe: `24 miesiące` — `HOLD`, wymaga finalnego uzasadnienia zakresu i podstawy,
- dowód zgody: `6 lat` — `HOLD`, nie może być przyjęty automatycznie dla każdego przypadku,
- newsletter lifecycle analytics: `24 miesiące`, potem agregacja/anonymization/purge,
- provider delivery telemetry: `13 miesięcy`, pod warunkiem potwierdzenia providera, DPA, regionów i realnej konfiguracji,
- zgoda wycofana lub unsubscribe zatrzymuje dalsze wysyłanie marketingowe bez zbędnej zwłoki,
- żaden provider ani backup nie może reaktywować statusu subskrypcji po unsubscribe.

---

## 2. Zakres danych

PL-R06 obejmuje wyłącznie dane związane z newsletterem, w tym:

- adres e-mail,
- status subskrypcji,
- timestamps utworzenia, potwierdzenia i wypisania,
- źródło i wersję zgody,
- minimalne confirmation/unsubscribe token metadata,
- consent/withdrawal event metadata,
- lifecycle analytics,
- delivery/bounce/complaint telemetry providera,
- minimalny suppression/proof record, jeśli zostanie formalnie zatwierdzony.

PL-R06 nie uprawnia do tworzenia marketingowego profilu behawioralnego ani łączenia newslettera z historią gier, wiadomościami prywatnymi, rankingiem lub telemetry bezpieczeństwa.

---

## 3. Macierz decyzji

| ID | Zakres | Retention clock | Okres | Akcja końcowa | Decyzja |
|---|---|---|---:|---|---|
| PL-R06-01 | pending newsletter subscription | `created_at` | 30 dni | purge rekordu, jeśli brak potwierdzenia i brak innej podstawy | `APPROVE WITH CONDITIONS` |
| PL-R06-02 | confirmation / unsubscribe token metadata | expiry / consume / revoke | 7 dni | purge hash/metadata zbędnych operacyjnie | `APPROVE WITH CONDITIONS` |
| PL-R06-03 | unsubscribed current/suppression record | `unsubscribed_at` | 24 miesiące | minimalizacja i potem purge | `HOLD` |
| PL-R06-04 | consent proof | ostatni consent event / withdrawal context | 6 lat | purge lub trwała anonimizacja, jeśli prawidłowa | `HOLD` |
| PL-R06-05 | newsletter lifecycle analytics | `occurred_at` | 24 miesiące | anonimizacja/agregacja/purge | `APPROVE WITH CONDITIONS` |
| PL-R06-06 | provider delivery telemetry | `occurred_at` | 13 miesięcy | purge | `APPROVE WITH CONDITIONS / PROVIDER REVIEW` |

---

## 4. Pending confirmation — 30 dni

Niepotwierdzony rekord newslettera nie może istnieć bezterminowo.

Warunki:

1. clock rozpoczyna `created_at`;
2. po 30 dniach brak potwierdzenia oznacza purge rekordu aktywnego;
3. adres e-mail nie może być traktowany jako aktywna subskrypcja;
4. brak potwierdzenia nie może prowadzić do marketingowej wysyłki;
5. token confirmation powinien wygasać wcześniej zgodnie z PL-R06-02.

Decyzja: `APPROVE WITH CONDITIONS`.

---

## 5. Tokeny newslettera — 7 dni

Po `expiry`, `consume` albo `revoke` metadata tokenu może pozostać maksymalnie przez 7 dni wyłącznie na potrzeby krótkiej diagnostyki i anti-abuse.

Niedozwolone:

- przechowywanie plaintext tokenu,
- użycie token metadata do marketingowego profilowania,
- przedłużanie retencji przez provider telemetry,
- przywracanie tokenu po restore.

Decyzja: `APPROVE WITH CONDITIONS`.

---

## 6. Unsubscribe / suppression record — 24 miesiące

Projekt ADR zakłada 24 miesiące dla minimalnego rekordu po unsubscribe. Ten okres nie jest automatycznie zatwierdzony.

Dopuszczalny rekord powinien być ograniczony do minimum potrzebnego do:

- wykazania faktu wypisania, jeśli istnieje formalnie zaakceptowany cel i podstawa,
- technicznego zapobieżenia przypadkowemu ponownemu włączeniu subskrypcji,
- rozpatrzenia skargi lub błędu wysyłki w ograniczonym czasie.

Nie wolno zachowywać pełnej historii aktywności newsletterowej wyłącznie dlatego, że użytkownik się wypisał.

Status:

```text
24 MONTH UNSUBSCRIBED RECORD = HOLD
MINIMUM SUPPRESSION / PROOF MODEL = DESIGN CANDIDATE
FINAL LAWFUL BASIS / NECESSITY = PENDING
```

Pełny `APPROVE` wymaga decyzji, czy taki rekord jest rzeczywiście potrzebny i jaki minimalny zakres danych wystarcza.

---

## 7. Consent proof — 6 lat

Projektowe 6 lat dla dowodu zgody pozostaje `HOLD`.

Nie przyjmujemy zasady, że każda zgoda musi być przechowywana przez 6 lat. Dla konkretnej klasy proof trzeba wykazać:

1. dokładny cel przechowywania po wycofaniu zgody;
2. podstawę dalszego przetwarzania minimalnego dowodu;
3. zakres konieczny — np. subject reference, timestamp, version, source, action;
4. dlaczego krótszy okres nie jest wystarczający;
5. relację z terminami potencjalnych roszczeń albo obowiązkiem rozliczalności, jeśli faktycznie ma zastosowanie;
6. datę następnego review.

Zabronione jest przechowywanie pod etykietą `consent proof` całego profilu użytkownika, historii newslettera, pełnych requestów HTTP, IP/UA bez osobnej potrzeby lub kopii treści niezwiązanych z samą zgodą.

Status:

```text
CONSENT PROOF 6 YEARS = HOLD / CASE-SPECIFIC LEGAL REVIEW
```

---

## 8. Newsletter lifecycle analytics — 24 miesiące

Analytics newslettera może obejmować wyłącznie dane potrzebne do obsługi i oceny działania tej funkcji.

Warunki:

- brak cross-service profiling;
- minimalizacja identyfikatorów;
- po 24 miesiącach: anonymization, aggregate lub purge;
- przy analytics opartych na zgodzie wycofanie zgody musi być respektowane dla przyszłych operacji;
- privacy notice musi opisywać odpowiedni zakres i okres/kryterium.

Decyzja: `APPROVE WITH CONDITIONS`.

---

## 9. Provider delivery telemetry — 13 miesięcy

13 miesięcy jest dopuszczalne projektowo wyłącznie jako limit maksymalny dla danych takich jak delivery status, bounce, complaint i techniczne eventy wysyłki, jeśli provider i konfiguracja rzeczywiście ich wymagają.

Pełny `APPROVE` wymaga:

- wyboru konkretnego providera,
- weryfikacji jego roli i DPA,
- potwierdzenia subprocessorów i transferów,
- potwierdzenia faktycznej retencji po stronie providera,
- procedury delete/return,
- zgodności z privacy notice i ROPA.

Jeśli provider umożliwia krótszą retencję bez utraty celu operacyjnego, należy zastosować krótszy okres.

---

## 10. Wycofanie zgody i unsubscribe

Po skutecznym unsubscribe/withdrawal:

- dalsze wysyłki marketingowe muszą zostać zatrzymane;
- rekord nie może samoczynnie wrócić do `subscribed`;
- retry, outbox, cache i provider queues muszą respektować nowy stan;
- użytkownik może ponownie zapisać się dopiero przez nowy, jawny proces zgodny z aktualnym modelem;
- poprzednia zgoda nie może być ponownie aktywowana po restore.

Nowa subskrypcja tworzy nowy event consent, a nie „odmraża” stary status.

---

## 11. Backup / restore / deletion replay

Backup nie może być użyty jako źródło do ponownego włączenia newslettera.

Po restore system musi odtworzyć co najmniej:

- unsubscribe events,
- withdrawal state,
- deletion state,
- suppression state, jeśli formalnie zatwierdzony,
- expiry tokenów.

Przed ponownym dopuszczeniem restore do użycia wymagany jest deletion/consent-state replay zgodny z PL-E15.

---

## 12. Legal hold

Legal hold nie daje prawa do dalszej wysyłki marketingowej.

Jeśli konkretny dowód zgody lub skargi jest objęty prawidłowym hold:

- zakres musi być minimalny,
- hold dotyczy evidence, nie aktywnego statusu subskrypcji,
- unsubscribe pozostaje skuteczny,
- po zwolnieniu hold rekord wraca do normalnego retention/purge review.

---

## 13. Obowiązek informacyjny

Finalna privacy notice musi umożliwiać użytkownikowi ustalenie co najmniej:

- dlaczego newsletter jest wysyłany,
- na jakiej podstawie,
- jak wycofać zgodę / wypisać się,
- jakie dowody mogą pozostać po wycofaniu i dlaczego,
- przez jaki okres lub według jakiego kryterium,
- jakie kategorie providerów otrzymują dane,
- czy występują transfery poza EOG.

Nie wolno publikować okresu 6 lat lub 24 miesięcy jako zatwierdzonego, dopóki pozycje `HOLD` nie zostaną formalnie rozstrzygnięte.

---

## 14. Warunki otwarte

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-R06-O01 | zatwierdzić albo skrócić 24-miesięczny unsubscribe/suppression record i jego minimalny zakres | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-R06-O02 | uzasadnić albo zmienić 6-letni consent proof per konkretny cel/podstawa | P1 Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-R06-O03 | wybrać i zweryfikować newsletter/email providera, DPA, subprocessors, regiony i retention | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-R06-O04 | zsynchronizować finalne okresy z privacy notice i ROPA | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-R06-O05 | przed produkcją wykonać test unsubscribe + outbox/provider + restore anti-resurrection | P1 Operational/Privacy | Engineering + Privacy/Legal | `OPEN` |

---

## 15. Formalna decyzja PL-R06

```text
PL-R06 = HOLD / PARTIAL APPROVAL

PENDING CONFIRMATION 30 DAYS = APPROVE WITH CONDITIONS
TOKEN METADATA 7 DAYS = APPROVE WITH CONDITIONS
UNSUBSCRIBED RECORD 24 MONTHS = HOLD
CONSENT PROOF 6 YEARS = HOLD
LIFECYCLE ANALYTICS 24 MONTHS = APPROVE WITH CONDITIONS
PROVIDER TELEMETRY 13 MONTHS = APPROVE WITH CONDITIONS / PROVIDER REVIEW
UNSUBSCRIBE STOPS MARKETING = REQUIRED
RESTORE MAY REACTIVATE SUBSCRIPTION = NO
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Werdykt `HOLD / PARTIAL APPROVAL` wynika z dwóch materialnych okresów, których nie należy finalizować bez dodatkowego uzasadnienia: 24 miesiące po unsubscribe oraz 6 lat dla consent proof.

---

## 16. Granica autoryzacji

Utworzenie PL-R06:

- nie zatwierdza marketingu produkcyjnego,
- nie wybiera providera newslettera,
- nie autoryzuje profilowania,
- nie finalizuje okresów oznaczonych `HOLD`,
- nie autoryzuje implementacji ani deploymentu,
- nie zmienia freeze ani Production V3 NO-GO.
