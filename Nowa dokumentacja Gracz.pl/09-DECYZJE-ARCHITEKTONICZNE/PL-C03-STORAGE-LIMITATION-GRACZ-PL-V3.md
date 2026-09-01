# Gracz.pl V3 — PL-C03 Storage Limitation

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — HOLD / VERSIONED CONTROL / FREEZE-SAFE**  
Control ID: `PL-C03`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E13`, `PL-E14`, `PL-E15`  
Powiązane decyzje retencyjne: `PL-R01`–`PL-R09`

> Kontrola PL-C03 ocenia zasadę ograniczenia przechowywania: czy dla każdego istotnego procesu istnieje jawny retention clock, uzasadniony okres albo kryterium, akcja końcowa oraz kontrolowane wyjątki. Kontrola nie uznaje żadnego okresu projektowego za termin ustawowy tylko dlatego, że został zapisany w architekturze.

---

## 1. Kryterium kontroli

PL-C03 może otrzymać `PASS` wyłącznie, gdy dla wszystkich materialnych klas danych:

1. istnieje określony cel retencji;
2. okres lub kryterium jest konieczne i proporcjonalne;
3. wskazano zdarzenie rozpoczynające retention clock;
4. wskazano akcję końcową: purge, anonimizacja, pseudonimizacja, restriction albo kontrolowany expiry;
5. legal hold nie tworzy ukrytej retencji bezterminowej;
6. backup nie przedłuża retencji jako archiwum biznesowe;
7. okresy są spójne z privacy notice, ROPA, prawami osób i providerami;
8. po ustaniu celu możliwy jest wcześniejszy purge, jeśli nie istnieje inna ważna podstawa.

---

## 2. Stan modelu retencji

Model PL-E13 zawiera jawne retention clocks, okresy projektowe, uzasadnienia i akcje końcowe dla głównych domen V3. W szczególności obejmuje konta, credentiale, gry, ranking, messaging, chat/social, newsletter, moderację, audit, logi/telemetry i backup/restore.

Znaczna część okresów posiada status `PASS WITH CONDITIONS`, co oznacza, że projektowo istnieje proporcjonalne uzasadnienie, ale finalny `PASS` zależy od zamknięcia powiązanych podstaw prawnych, LIA, providerów, kontroli dostępu lub dowodów operacyjnych.

---

## 3. Pozycje materialnie zaakceptowane warunkowo

Kontrola uznaje za projektowo proporcjonalne, z warunkami wskazanymi w dokumentacji:

- konto po zweryfikowanym delete — maks. 30 dni w aktywnych systemach;
- publiczna widoczność profilu po delete — maks. 24 h;
- MFA/credentiale — natychmiastowy revoke, techniczny purge docelowo do 24 h;
- metadata sesji — 30 dni;
- metadata tokenów reset/registration — 7 dni;
- anti-abuse/privacy tombstone — 24 miesiące, wyłącznie minimalny zapis;
- game/match events z identyfikatorem — 36 miesięcy;
- snapshoty zakończonych meczów — 90 dni;
- historia turnieju z ID — 36 miesięcy;
- ranking po delete — do 30 dni na kontrolowane wygaszenie projekcji;
- private messaging — 36 miesięcy, z party-state i zasadami pseudonimizacji/usuwania;
- publiczny chat — 12 miesięcy;
- edit/delete events chatu — 24 miesiące;
- usunięte relacje social — 30 dni;
- newsletter pending confirmation — 30 dni;
- newsletter token metadata — 7 dni;
- newsletter analytics — 24 miesiące;
- provider delivery telemetry — 13 miesięcy, po weryfikacji providera;
- moderation cases/evidence/sankcje — 36 miesięcy, z LIA i ograniczeniem zakresu;
- security events — 12 miesięcy;
- completed outbox — 30 dni;
- failed/dead-letter outbox — 90 dni;
- idempotency — 30 dni, do 90 dni dla game/tournament/admin;
- application logs — 30 dni;
- security logs — 90 dni;
- raw traces — 14 dni;
- anonimowe agregaty metryk — 13 miesięcy;
- daily backup — 35 dni;
- weekly backup — 12 tygodni;
- monthly backup — 12 miesięcy;
- restore environment — maks. 7 dni.

Warunkowa akceptacja nie zmienia statusu wdrożenia i nie oznacza, że wszystkie wskazane mechanizmy są już operacyjnie zaimplementowane.

---

## 4. Otwarte okresy blokujące pełny PASS

Poniższe pozycje pozostają materialnie nierozstrzygnięte:

### PL-C03-B01 — privacy request evidence: 6 lat

Status: `HOLD`

Powód:
- sześć lat zostało zapisane jako projektowy okres dla rozliczalności/roszczeń;
- brak wystarczającego, uniwersalnego uzasadnienia dla wszystkich privacy requests;
- konieczne jest rozdzielenie klas dowodów i wskazanie konkretnej podstawy/celu dla każdej klasy.

### PL-C03-B02 — unsubscribed newsletter record: 24 miesiące

Status: `HOLD`

Powód:
- identyfikowalny suppression/proof po unsubscribe może być potrzebny w minimalnym zakresie;
- obecny model nie zamyka jeszcze podstawy prawnej i minimalnego payloadu dla pełnych 24 miesięcy.

### PL-C03-B03 — newsletter consent proof: 6 lat

Status: `HOLD`

Powód:
- okres może służyć rozliczalności lub obronie konkretnego roszczenia;
- nie może być przyjęty automatycznie jako jedna domyślna retencja dla wszystkich zdarzeń zgody.

### PL-C03-B04 — privileged audit / role history: maks. 6 lat

Status: `HOLD`

Powód:
- wymaga uzasadnienia per klasa audit;
- nie wszystkie zdarzenia uprzywilejowane mają tę samą wagę, ryzyko i potrzebę długiej retencji;
- konieczne jest rozdzielenie zakresu hot/archive oraz minimalizacja danych osobowych.

---

## 5. Legal hold

Legal hold nie jest okresem retencji samym w sobie. Może czasowo zatrzymać purge tylko wtedy, gdy istnieją:

- konkretny powód i cel;
- ograniczony zakres;
- owner;
- podstawa;
- `review_at`;
- `expires_at` albo jawny warunek zakończenia.

Po zwolnieniu hold system ma wrócić do normalnej oceny eligibility for purge. Brak aktywnego hold nie może być zastąpiony zachowaniem danych „na wszelki wypadek”.

---

## 6. Backup i restore

Backup nie stanowi archiwum uzasadniającego dalsze zwykłe użycie danych. Kontrola wymaga:

- naturalnego expiry kopii zgodnie z zatwierdzonym harmonogramem;
- izolacji restore;
- deletion/restriction replay;
- anti-resurrection checks;
- purge środowiska restore;
- potwierdzonego lifecycle providera.

Brak dowodów operacyjnych PL-E15 nie unieważnia modelu projektowego, ale blokuje uznanie storage limitation za w pełni działającą kontrolę produkcyjną.

---

## 7. Reguła wcześniejszego purge

Wszystkie okresy są maksymalnymi albo docelowymi limitami projektowymi, a nie obowiązkiem przechowywania do końca okresu. Jeżeli:

- cel przetwarzania ustał wcześniej,
- nie istnieje inna ważna podstawa,
- nie ma aktywnego legal hold ani obowiązku prawnego,

należy dopuścić wcześniejszy purge lub skuteczną anonimizację.

---

## 8. Warunki zamknięcia PL-C03

Pełny `PASS` wymaga co najmniej:

1. zamknięcia PL-R03 w części 6-letniego privacy request evidence;
2. zamknięcia PL-R06 dla unsubscribe record i consent proof;
3. zamknięcia PL-R07 dla maksymalnie 6-letniego privileged audit / role history;
4. spójności finalnych okresów z privacy notice i ROPA;
5. potwierdzenia provider retention/lifecycle tam, gdzie dane są powierzane;
6. potwierdzenia deletion/replay dla backup/restore;
7. braku innych nierozstrzygniętych klas retencji bez celu, clocka i akcji końcowej.

---

## 9. Ocena PL-C03

```text
PL-C03 = HOLD

RETENTION CLOCKS = DEFINED FOR MATERIAL DATA CLASSES
END-OF-RETENTION ACTIONS = DEFINED
EARLY PURGE PRINCIPLE = ACCEPTED
LEGAL HOLD AS INDEFINITE RETENTION = NOT ALLOWED
BACKUP AS BUSINESS ARCHIVE = NOT ALLOWED
MAJORITY RETENTION ROWS = APPROVE WITH CONDITIONS
PRIVACY REQUEST EVIDENCE 6Y = HOLD
UNSUBSCRIBE RECORD 24M = HOLD
CONSENT PROOF 6Y = HOLD
PRIVILEGED AUDIT / ROLE HISTORY UP TO 6Y = HOLD
FINAL STORAGE LIMITATION PASS = BLOCKED
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
FREEZE = ACTIVE
```

PL-C03 pozostaje `HOLD`, ponieważ kryterium PASS wymaga, aby każdy materialny okres/kryterium retencji był uzasadniony jako konieczny i proporcjonalny. Obecny model jest dobrze zdefiniowany, ale cztery materialne klasy retencji nadal wymagają finalnego rozstrzygnięcia.

---

## 10. Granica autoryzacji

Utworzenie PL-C03:

- nie uruchamia purge ani retention workerów;
- nie modyfikuje danych, backupów, Render, bazy ani providerów;
- nie zatwierdza automatycznie okresów pozostających w HOLD;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NOT READY` ani `REVIEWED DESIGN GATE = HOLD`.
