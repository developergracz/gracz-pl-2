# Gracz.pl V3 — PL-E13 Uzasadnienia okresów retencji

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E13`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązane evidence: `PL-E03`, `PL-E10`, `PL-E12`

> Dokument uzasadnia projektowane okresy retencji Gracz.pl V3. Okresy nie są przedstawiane jako uniwersalne terminy ustawowe. Każdy okres musi wynikać z konkretnego celu, podstawy prawnej, ryzyka i zdarzenia rozpoczynającego retention clock. Wartości oznaczone jako warunkowe wymagają końcowego zatwierdzenia Privacy/Legal Decision Ownera i — tam gdzie potrzeba — profesjonalnej konsultacji prawnej.

---

## 1. Reguły nadrzędne retencji

1. Dane nie mogą być przechowywane bezterminowo wyłącznie dlatego, że technicznie jest to możliwe.
2. Każdy okres retencji musi wskazywać: cel, kategorię danych, retention clock, okres, akcję końcową i wyjątki.
3. Brak decyzji oznacza `HOLD`, a nie domyślną retencję bezterminową.
4. Purge może nastąpić wcześniej, jeśli cel ustał i nie istnieje inna podstawa.
5. Legal hold może czasowo zatrzymać purge tylko dla jawnie określonego zakresu i celu.
6. Backup nie jest archiwum i podlega własnemu okresowi naturalnego wygaśnięcia.
7. Anonimizacja musi być rzeczywiście nieodwracalna; pseudonimizacja nadal oznacza dane osobowe.
8. Okresy muszą być spójne z privacy notice, ROPA, procedurami praw osób i providerami.

---

## 2. Macierz uzasadnień retencji

| ID | Zakres | Retention clock | Okres projektowy | Uzasadnienie | Akcja końcowa | Status |
|---|---|---|---|---|---|---|
| PL-E13-R01 | aktywne konto i profil | lifecycle konta | do usunięcia konta | dane są potrzebne do świadczenia aktywnej usługi i utrzymania profilu | privacy workflow | `PASS WITH CONDITIONS` |
| PL-E13-R02 | konto po zweryfikowanym żądaniu usunięcia | `verified_at` | maks. 30 dni w aktywnych systemach | bufor na bezpieczne, idempotentne wykonanie usunięcia w wielu bounded contextach; nie jest okresem „obowiązkowego” przechowania | purge/anonimizacja | `PASS WITH CONDITIONS` |
| PL-E13-R03 | publiczna widoczność profilu po delete | `verified_at` | maks. 24 h | minimalizacja czasu publicznej ekspozycji po skutecznym rozpoczęciu procesu usuwania | ukrycie/pseudonimizacja prezentacji | `PASS WITH CONDITIONS` |
| PL-E13-R04 | MFA secrets i aktywne credentiale | `verified_at` | natychmiast; cel operacyjny do 24 h | po delete nie istnieje cel dalszego uwierzytelniania; krótki cel operacyjny dotyczy technicznego domknięcia revoke/purge | revoke + cryptographic erase/purge | `PASS WITH CONDITIONS` |
| PL-E13-R05 | sesje auth | expiry/revoke/delete | 30 dni | krótka retencja metadata może wspierać bezpieczeństwo i diagnostykę po revoke; aktywna autoryzacja musi ustać wcześniej | purge | `PASS WITH CONDITIONS / LIA ALIGNMENT` |
| PL-E13-R06 | reset/registration/public token metadata | expiry/consume/revoke | 7 dni | krótki okres na diagnostykę i anty-abuse; brak potrzeby długiej retencji danych tokenowych | purge | `PASS WITH CONDITIONS` |
| PL-E13-R07 | privacy request evidence | completion | 6 lat | projektowo ma służyć rozliczalności i ewentualnej obronie roszczeń, lecz zakres i długość nie są jeszcze wystarczająco uzasadnione dla wszystkich przypadków | minimalizacja, pseudonimizacja, potem purge | `HOLD / CASE-SPECIFIC LEGAL REVIEW` |
| PL-E13-R08 | privacy tombstone anty-abuse | completion | 24 miesiące | ograniczony rekord może zapobiegać odtworzeniu stanu i nadużyciom po delete; musi być minimalny i proporcjonalny | purge | `PASS WITH CONDITIONS / LIA` |
| PL-E13-R09 | zakończone game/match events z identyfikatorem | `finished_at` | 36 miesięcy | historia rozgrywki, integralność rankingu i spory; dłuższa identyfikowalność wymaga proporcjonalności | nieodwracalna anonimizacja | `PASS WITH CONDITIONS` |
| PL-E13-R10 | snapshoty zakończonych meczów | `finished_at` | 90 dni | snapshot jest potrzebny głównie dla reconnect, diagnostyki i sporów krótkoterminowych; po zakończeniu meczu jego wartość operacyjna szybko maleje | purge, chyba że aktywny dispute/hold | `PASS WITH CONDITIONS` |
| PL-E13-R11 | anonimowa historia/replay | anonymization | bezterminowo tylko przy potwierdzonej anonimowości | brak danych osobowych po skutecznej anonimizacji; pozostaje obowiązek okresowej oceny reidentyfikacji | zachowanie jako anonimizowane / review co 12 mies. | `PASS WITH CONDITIONS` |
| PL-E13-R12 | historia turnieju z ID | `finished_at` | 36 miesięcy | integralność wyników i historia udziału; po okresie uczestnicy mogą zostać zanonimizowani | anonimizacja uczestników | `PASS WITH CONDITIONS` |
| PL-E13-R13 | bieżący ranking | aktywność / aktualizacja | aktywne konto + 30 dni | ranking jest funkcją bieżącej usługi; po usunięciu konta nie ma podstawy do długiej publicznej ekspozycji | usunięcie z projekcji / anonimowy agregat | `PASS WITH CONDITIONS` |
| PL-E13-R14 | prywatna wiadomość | `sent_at` | 36 miesięcy | komunikacja jest usługą dla obu stron; retencja musi uwzględniać party-state i prawa drugiej strony | purge według party-state/hold | `PASS WITH CONDITIONS / MATERIAL REVIEW` |
| PL-E13-R15 | prywatna wiadomość po delete obu stron | późniejsze `deleted_at` | 30 dni grace | krótki bufor techniczny na bezpieczny purge załączników i replik | physical purge | `PASS WITH CONDITIONS` |
| PL-E13-R16 | prywatna wiadomość po delete jednej strony | account deletion | do końca retencji drugiej strony | ochrona praw drugiego uczestnika konwersacji; dane usuniętej strony muszą zostać odłączone/pseudonimizowane | pseudonimizacja + późniejszy purge | `PASS WITH CONDITIONS / ACCESS MODEL REQUIRED` |
| PL-E13-R17 | publiczny chat body | `created_at` | 12 miesięcy | moderacja, kontekst społeczności i rozstrzyganie zgłoszeń; dłuższa retencja treści publicznej zwiększa ryzyko bez proporcjonalnej korzyści | purge/anonimizacja, chyba że case/hold | `PASS WITH CONDITIONS` |
| PL-E13-R18 | chat edit/delete events | `occurred_at` | 24 miesiące | evidence zmian i moderacji może wymagać dłuższego śladu niż sama treść | purge/minimalizacja | `PASS WITH CONDITIONS / LIA` |
| PL-E13-R19 | reakcje i usunięte relacje social | removal/account deletion | 30 dni | po zakończeniu relacji cel biznesowy jest bardzo ograniczony | purge | `PASS WITH CONDITIONS` |
| PL-E13-R20 | otwarta relacja social | lifecycle relacji | do zakończenia relacji/konta + 30 dni | dane są potrzebne tylko do utrzymywania funkcji społecznościowej | purge | `PASS WITH CONDITIONS` |
| PL-E13-R21 | newsletter pending confirmation | `created_at` | 30 dni | jeśli subskrypcja nie została potwierdzona, nie ma uzasadnienia do dłuższego przechowywania rekordu aktywnego | purge | `PASS WITH CONDITIONS` |
| PL-E13-R22 | newsletter token metadata | expiry/consume/revoke | 7 dni | krótka diagnostyka i anty-abuse | purge | `PASS WITH CONDITIONS` |
| PL-E13-R23 | unsubscribed newsletter current record | `unsubscribed_at` | 24 miesiące | może być potrzebny minimalny suppression/proof, ale zakres musi pozostać minimalny | minimalizacja/purge | `HOLD / LEGAL BASIS REVIEW` |
| PL-E13-R24 | consent proof newslettera | ostatni consent event | 6 lat | projektowo dla rozliczalności/roszczeń; nie może być przyjęte automatycznie dla każdego przypadku | purge lub trwała anonimizacja | `HOLD / CASE-SPECIFIC LEGAL REVIEW` |
| PL-E13-R25 | newsletter lifecycle analytics | `occurred_at` | 24 miesiące | ocena skuteczności i diagnostyka usługi; po okresie wystarczają anonimowe agregaty | anonimizacja/agregacja/purge | `PASS WITH CONDITIONS` |
| PL-E13-R26 | provider delivery telemetry | `occurred_at` | 13 miesięcy | troubleshooting i trendy dostarczalności; okres wymaga zgodności z providerem i privacy notice | purge | `PASS WITH CONDITIONS / PROVIDER REVIEW` |
| PL-E13-R27 | moderation case/action/appeal | closure/expiry | 36 miesięcy | obsługa odwołań, powtarzalnych nadużyć i sporów; wpływ na prawa użytkownika wymaga proporcjonalności | purge/minimalizacja, chyba że hold | `PASS WITH CONDITIONS / LIA` |
| PL-E13-R28 | moderation evidence | closure + `retention_until` | 36 miesięcy domyślnie | evidence może być potrzebne dla odwołań i bezpieczeństwa, ale musi być ograniczone do istotnego zakresu | purge po terminie/hold release | `PASS WITH CONDITIONS / MATERIAL REVIEW` |
| PL-E13-R29 | zakończona sankcja | `ended_at` / `revoked_at` | 36 miesięcy | umożliwia review historii moderacyjnej i sporu; brak uzasadnienia do bezterminowego profilu sankcji | minimalizacja/purge | `PASS WITH CONDITIONS / LIA` |
| PL-E13-R30 | privileged audit / role history | `occurred_at` | 24 mies. hot + 48 mies. archive, łącznie maks. 6 lat | rozliczalność działań uprzywilejowanych; maksymalny okres wymaga uzasadnienia per klasa audit | purge | `HOLD FOR CLASS-SPECIFIC JUSTIFICATION` |
| PL-E13-R31 | security events | `occurred_at` | 12 miesięcy | wykrywanie wzorców nadużyć i analiza incydentów; konieczna minimalizacja | purge/anonimowa agregacja | `PASS WITH CONDITIONS / LIA` |
| PL-E13-R32 | completed outbox | `published_at` | 30 dni | troubleshooting i idempotencja po publikacji; brak celu do dłuższego trzymania payloadów | purge | `PASS WITH CONDITIONS` |
| PL-E13-R33 | failed/dead-letter outbox | terminal state | 90 dni | czas na resolution i evidence błędu; po zamknięciu nie powinien być stałym archiwum | purge po resolution | `PASS WITH CONDITIONS` |
| PL-E13-R34 | idempotency records | completion | 30 dni; 90 dni game/tournament/admin | ochrona przed powtórnym wykonaniem komendy i race/retry; dłużej tylko w kontekstach wyższego ryzyka | purge | `PASS WITH CONDITIONS` |
| PL-E13-R35 | application logs | ingestion | 30 dni | diagnostyka bieżąca; logi nie są historią użytkownika | purge | `PASS WITH CONDITIONS` |
| PL-E13-R36 | security logs | ingestion | 90 dni | wykrywanie i analiza incydentów; wyższa retencja niż zwykłych logów ze względu na cykl wykrycia | purge | `PASS WITH CONDITIONS / LIA` |
| PL-E13-R37 | raw traces | ingestion | 14 dni | wysoka szczegółowość i niska wartość długoterminowa | purge | `PASS WITH CONDITIONS` |
| PL-E13-R38 | zagregowane metryki bez ID | aggregation period | 13 miesięcy | analiza sezonowości i pojemności; wyłącznie bez danych identyfikujących | purge lub dalsza anonimowa agregacja | `PASS WITH CONDITIONS` |
| PL-E13-R39 | backup dzienny | creation | 35 dni | operacyjne recovery z ograniczonym oknem; backup nie jest archiwum | expiry | `PASS WITH CONDITIONS` |
| PL-E13-R40 | backup tygodniowy | creation | 12 tygodni | średnioterminowy recovery / DR przy kontrolowanym koszcie privacy | expiry | `PASS WITH CONDITIONS` |
| PL-E13-R41 | backup miesięczny | creation | 12 miesięcy | dłuższy punkt recovery; wymaga deletion replay po restore i nie może omijać praw osób | expiry | `PASS WITH CONDITIONS / MATERIAL REVIEW` |
| PL-E13-R42 | izolowane środowisko restore | zakończenie testu | maks. 7 dni | środowisko restore ma istnieć tylko tak długo, jak wymaga test; nie może stać się równoległą kopią produkcji | pełny cleanup z evidence | `PASS WITH CONDITIONS` |

---

## 3. Okresy wymagające dodatkowego review prawnego

Nie uznajemy za ostatecznie zatwierdzone bez dodatkowej podstawy/uzasadnienia:

- 6 lat dla privacy request evidence;
- 6 lat dla consent proof;
- 24 miesiące po unsubscribe, jeśli rekord ma pozostać identyfikowalny;
- maksymalnie 6 lat dla audit/role history;
- każde zachowanie danych wyłącznie „na wypadek roszczeń”, bez określenia konkretnego celu, podstawy i minimalnego zakresu.

Dla tych pozycji obecny status pozostaje `HOLD` albo `PASS WITH CONDITIONS`, a nie pełny `PASS`.

---

## 4. Zasada retencji dla legal hold

Legal hold nie tworzy nowego stałego okresu retencji. Może jedynie czasowo zatrzymać purge konkretnego rekordu/zbioru, gdy istnieje jawna przyczyna, owner, zakres, `review_at` i `expires_at`. Po zwolnieniu hold należy ponownie policzyć eligibility for purge i wykonać właściwą akcję końcową.

---

## 5. Zasada backup/restore

Backup podlega naturalnemu expiry. Po restore środowisko nie może zostać użyte operacyjnie przed wykonaniem deletion replay i zastosowaniem aktywnych holds. Dane wcześniej skutecznie usunięte nie mogą „wrócić do życia” tylko dlatego, że istnieją w starszej kopii.

---

## 6. Status PL-E13

```text
PL-E13 = PASS WITH CONDITIONS

RETENTION RATIONALE ARTIFACT = VERSIONED
RETENTION CLOCKS = DEFINED
TERMINAL ACTIONS = DEFINED
UNIVERSAL INDEFINITE RETENTION = NOT ACCEPTED
6-YEAR PRIVACY REQUEST PROOF = HOLD FOR LEGAL REVIEW
6-YEAR CONSENT PROOF = HOLD FOR LEGAL REVIEW
6-YEAR AUDIT MAXIMUM = HOLD FOR CLASS-SPECIFIC JUSTIFICATION
BACKUP RETENTION = CONDITIONALLY JUSTIFIED
LEGAL HOLD = DOES NOT CREATE INDEFINITE RETENTION
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `PASS` wymaga zatwierdzenia materialnych okresów prawnych, zgodności z finalnym PL-E03/LIA, privacy notice, providerami i pełną DPIA.

---

## 7. Granica autoryzacji

Utworzenie PL-E13:

- nie uruchamia żadnego purge;
- nie zmienia produkcyjnych okresów retencji;
- nie autoryzuje workerów deletion;
- nie autoryzuje zmian backupów;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze.
