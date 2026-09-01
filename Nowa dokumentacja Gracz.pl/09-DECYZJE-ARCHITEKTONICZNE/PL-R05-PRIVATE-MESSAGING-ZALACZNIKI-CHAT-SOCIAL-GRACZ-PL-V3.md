# Gracz.pl V3 — PL-R05 Private messaging, załączniki, publiczny chat i social

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED DECISION / FREEZE-SAFE**  
Decision ID: `PL-R05`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E06`, `PL-E09`, `PL-E10`, `PL-E11`, `PL-E12`, `PL-E13`, `PL-E14`, `PL-E15`

> Dokument rozstrzyga blok retencyjny PL-R05: prywatne wiadomości, załączniki, publiczny chat i relacje social. Nie stanowi opinii prawnej, nie zatwierdza dostępu administracyjnego do plaintext prywatnych wiadomości i nie autoryzuje implementacji ani deploymentu.

---

## 1. Zakres decyzji

PL-R05 obejmuje:

- prywatne wiadomości użytkownik–użytkownik,
- załączniki do prywatnych wiadomości,
- usunięcie wiadomości przez jedną albo obie strony,
- skutki usunięcia konta jednej ze stron,
- publiczny chat,
- zdarzenia edycji/usunięcia chatu,
- reakcje i relacje społecznościowe,
- legal hold oraz moderation evidence związane z tymi danymi,
- backup/restore i deletion replay.

Poza zakresem pozostają ostateczne zasady lawful access do plaintext prywatnych wiadomości przez administratora/moderację. Ten temat pozostaje osobnym P1 Privacy/Legal.

---

## 2. Prywatne wiadomości — decyzja podstawowa

### 2.1. Aktywna wiadomość

| Pole | Decyzja |
|---|---|
| Retention clock | `sent_at` |
| Okres projektowy | `36 miesięcy` |
| Cel | świadczenie funkcji prywatnej komunikacji, dostęp obu stron do historii rozmowy, obsługa sporów i integralność usługi |
| Akcja końcowa | purge zgodnie z party-state i brakiem aktywnego hold |
| Status | `APPROVE WITH CONDITIONS` |

36 miesięcy nie jest traktowane jako uniwersalny termin ustawowy. Jest to okres projektowy, który musi być zgodny z ostateczną podstawą prawną, privacy notice i wynikiem DPIA.

### 2.2. Delete po obu stronach

Jeżeli obie strony skutecznie oznaczyły wiadomość do usunięcia:

```text
RETENTION CLOCK = later_deleted_at
GRACE PERIOD = 30 DAYS MAX
FINAL ACTION = PHYSICAL PURGE MESSAGE + ATTACHMENTS
EXCEPTION = ACTIVE, VALID, NARROW LEGAL HOLD ONLY
```

30-dniowy grace period służy wyłącznie technicznemu, idempotentnemu wykonaniu purge i nie może być używany jako nowy okres użytkowej dostępności wiadomości.

### 2.3. Delete po jednej stronie

Jeżeli tylko jedna strona usuwa wiadomość:

- wiadomość może pozostać dostępna drugiej stronie do końca właściwej retencji,
- identyfikator strony usuniętej powinien zostać odłączony/pseudonimizowany w zakresie zgodnym z prawami drugiej strony,
- nie wolno zachowywać pełnego profilu usuniętego użytkownika tylko dlatego, że druga strona posiada historię rozmowy,
- dalsze wykorzystanie wiadomości do nowych celów jest niedozwolone.

Status: `APPROVE WITH CONDITIONS / MATERIAL ACCESS REVIEW REQUIRED`.

---

## 3. Załączniki do prywatnych wiadomości

Załącznik dziedziczy retention clock i party-state wiadomości, chyba że istnieje osobny, ważny legal hold dla konkretnego pliku.

Wymagania:

1. brak bezterminowego orphan storage;
2. usunięcie wiadomości musi objąć także blob/object storage;
3. miniatury, kopie robocze, cache i CDN nie mogą żyć dłużej niż ich źródło poza krótkim technicznym TTL;
4. załączniki nie mogą trafiać do logów, audit payloadów ani outbox w plaintext/binarnym payloadzie;
5. provider object storage musi przejść PL-E07/PL-E08 przed produkcją;
6. backupy wygasają naturalnie i podlegają deletion replay po restore.

Decyzja: `APPROVE WITH CONDITIONS`.

---

## 4. Publiczny chat

### 4.1. Treść publicznego chatu

| Pole | Decyzja |
|---|---|
| Retention clock | `created_at` |
| Okres | `12 miesięcy` |
| Cel | funkcja społecznościowa, kontekst rozmowy, moderacja i obsługa zgłoszeń |
| Akcja końcowa | purge lub nieodwracalna anonimizacja treści/metadanych, jeżeli nadal istnieje uzasadniony cel statystyczny |
| Wyjątek | aktywny moderation case / legal hold |
| Status | `APPROVE WITH CONDITIONS` |

Publiczny charakter wiadomości nie oznacza zgody na bezterminową identyfikowalną archiwizację.

### 4.2. Edit/delete events

```text
RETENTION CLOCK = occurred_at
RETENTION = 24 MONTHS
FINAL ACTION = PURGE / MINIMIZATION
STATUS = APPROVE WITH CONDITIONS / LIA ALIGNMENT
```

Zdarzenia te mogą być potrzebne dłużej niż sama treść dla audytu zmian i moderacji, ale nie mogą zawierać nadmiarowego snapshotu pełnej treści, jeżeli do celu wystarcza metadata.

---

## 5. Reakcje i relacje social

### 5.1. Usunięte reakcje / zakończone relacje

```text
CLOCK = removal / account deletion
RETENTION = 30 DAYS MAX
ACTION = PURGE
STATUS = APPROVE WITH CONDITIONS
```

### 5.2. Aktywna relacja social

Relacja może istnieć tak długo, jak trwa funkcja relacji albo aktywne konto. Po zakończeniu relacji lub usunięciu konta obowiązuje maksymalnie 30-dniowy techniczny okres domknięcia, po którym następuje purge, chyba że istnieje odrębny, ważny powód prawny.

---

## 6. Moderacja i dostęp do prywatnych wiadomości

Niniejszy PL-R05 nie ustanawia ogólnego prawa administratora do rutynowego odczytu prywatnych wiadomości.

Przed produkcją wymagane jest osobne rozstrzygnięcie co najmniej:

- kiedy moderator może uzyskać dostęp do zgłoszonej treści,
- czy dostęp wymaga zgłoszenia przez jedną ze stron,
- jaki jest zakres minimalny evidence,
- czy dostęp jest audytowany,
- jak długo evidence pozostaje w moderation case,
- kiedy i jak treść jest usuwana po zamknięciu sprawy,
- jak traktowane są dane szczególnej kategorii przypadkowo umieszczone przez użytkownika.

Do czasu zamknięcia tego modelu:

```text
ROUTINE ADMIN PLAINTEXT ACCESS = NOT APPROVED
MODERATION ACCESS MODEL = P1 OPEN
```

---

## 7. Legal hold

Legal hold może zatrzymać purge tylko wtedy, gdy posiada:

- konkretny reason,
- konkretny zakres wiadomości/załączników/chatu,
- ownera,
- podstawę,
- `review_at`,
- `expires_at`,
- jawny warunek release.

Niedopuszczalne jest objęcie całej skrzynki, całej historii chatu albo wszystkich danych użytkownika „na wszelki wypadek”.

Po release hold należy natychmiast ponownie ocenić eligibility for purge.

---

## 8. Usunięcie konta a prawa drugiej strony

Usunięcie konta nie może przypadkowo niszczyć danych, do których druga strona ma nadal uzasadniony dostęp w ramach własnej historii komunikacji.

Dlatego kontrakt account deletion dla Messaging musi:

1. zablokować dalsze użycie danych profilu usuniętej osoby;
2. odłączyć albo pseudonimizować sender/recipient reference tam, gdzie możliwe;
3. nie usuwać treści należącej funkcjonalnie także do drugiego uczestnika, dopóki party-state nie pozwala na purge;
4. wykonać purge po spełnieniu warunków obu stron albo po końcu retencji;
5. respektować legal hold tylko w wąskim zakresie.

---

## 9. Backup, restore i anti-resurrection

Po restore:

- deletion ledger musi zostać odtworzony i odtworzony logicznie przed udostępnieniem danych,
- usunięte wiadomości nie mogą ponownie pojawić się w UI,
- usunięte załączniki nie mogą odzyskać publicznego/private-access URL,
- zakończone relacje social nie mogą zostać reaktywowane,
- aktywne holds muszą zostać ponownie nałożone,
- restore environment musi zostać usunięte po zakończeniu testu zgodnie z PL-E15.

---

## 10. Obowiązki informacyjne

Privacy notice przed produkcją musi czytelnie informować co najmniej o:

- okresie/kryterium retencji prywatnych wiadomości,
- różnicy między usunięciem po jednej i obu stronach,
- retencji publicznego chatu,
- możliwości dłuższego zachowania konkretnej treści w moderation case/legal hold,
- zasadach usuwania załączników,
- prawach użytkownika i ograniczeniach wynikających z praw innych osób.

---

## 11. Otwarte warunki

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-R05-O01 | zatwierdzić finalną podstawę prawną i wording privacy notice dla private messaging | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-R05-O02 | zamknąć model moderation/admin access do plaintext private messages | P1 Privacy/Legal | Privacy/Legal + Messaging/Moderation | `OPEN` |
| PL-R05-O03 | potwierdzić provider/object-storage deletion semantics i DPA | P1 Privacy/Legal | Privacy/Legal + Infrastructure | `OPEN` |
| PL-R05-O04 | objąć scenariusze messaging/chat pełną DPIA | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-R05-O05 | wykonać test delete obu stron + attachment purge + restore replay | P1 Operational | Messaging + Operations | `OPEN` |

---

## 12. Decyzja PL-R05

```text
PL-R05 = APPROVE WITH CONDITIONS

PRIVATE MESSAGE RETENTION = 36 MONTHS PROJECT TARGET
DELETE BOTH SIDES = 30 DAYS GRACE MAX -> PHYSICAL PURGE
DELETE ONE SIDE = RETAIN FOR OTHER PARTY WITH PSEUDONYMIZATION / PARTY-STATE RULES
ATTACHMENTS = FOLLOW MESSAGE RETENTION / NO ORPHAN STORAGE
PUBLIC CHAT BODY = 12 MONTHS
CHAT EDIT/DELETE EVENTS = 24 MONTHS
REMOVED SOCIAL DATA = 30 DAYS
ROUTINE ADMIN PLAINTEXT ACCESS = NOT APPROVED
MODERATION ACCESS MODEL = P1 OPEN
DPIA = REQUIRED BEFORE PRODUCTION
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `APPROVE` wymaga zamknięcia warunków P1, spójności z privacy notice, DPA/providerami, pełną DPIA oraz dowodu operacyjnego delete/restore.

---

## 13. Granica autoryzacji

Utworzenie PL-R05:

- nie autoryzuje odczytu prywatnych wiadomości przez administratora,
- nie zatwierdza produkcyjnych providerów storage,
- nie uruchamia purge,
- nie zmienia statusu freeze,
- nie autoryzuje implementacji ani deploymentu,
- nie zmienia `Production V3 = NO-GO`.
