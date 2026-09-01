# Gracz.pl V3 — PL-E12 Procedury realizacji praw osób

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — VERSIONED PROCEDURE / FREEZE-SAFE**  
Evidence ID: `PL-E12`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązana mapa podstaw: `PL-E03-MAPA-CELOW-I-PODSTAW-PRAWNYCH-GRACZ-PL-V3.md`  
Powiązany DPIA screening: `PL-E11-DPIA-SCREENING-GRACZ-PL-V3.md`

> Dokument ustanawia projektową i governance'ową procedurę realizacji praw osób dla Gracz.pl V3. Nie jest dowodem wdrożenia technicznego. Do czasu implementacji i testów operacyjnych procedura pozostaje wymaganiem projektowym. Nie autoryzuje deploymentu ani zmian produkcyjnych.

---

## 1. Zakres praw

Procedura obejmuje co najmniej:

- prawo dostępu do danych;
- prawo do sprostowania;
- prawo do usunięcia danych;
- prawo do ograniczenia przetwarzania;
- prawo do sprzeciwu;
- prawo do przenoszenia danych, jeśli ma zastosowanie;
- prawo do wycofania zgody, gdy przetwarzanie opiera się na zgodzie;
- prawo do uzyskania informacji o przetwarzaniu;
- prawa związane z decyzjami opartymi wyłącznie na zautomatyzowanym przetwarzaniu, jeśli taki proces zostanie kiedykolwiek wprowadzony.

Projekt nie przyjmuje, że każde żądanie skutkuje automatycznie pełnym usunięciem wszystkich danych. Każde żądanie przechodzi weryfikację zakresu, podstawy, retencji, praw innych osób i ewentualnego legal hold.

---

## 2. Kanał przyjęcia żądania

Docelowo Gracz.pl musi posiadać co najmniej jeden jasny kanał privacy/contact wskazany w polityce prywatności. Przed produkcją należy wskazać konkretny adres e-mail lub formularz.

Wymagania:

1. żądanie nie może być odrzucone wyłącznie z powodu użycia niewłaściwego formularza, jeśli jego treść pozwala zidentyfikować żądane prawo;
2. osoba nie musi używać terminologii prawnej;
3. każdy request otrzymuje unikalny `request_id`;
4. rejestrowana jest data otrzymania i termin odpowiedzi;
5. treść żądania nie może być kopiowana do zwykłych logów aplikacyjnych.

---

## 3. Workflow ogólny

```text
RECEIVED
 -> IDENTITY_VERIFICATION
 -> VERIFIED
 -> SCOPE_DISCOVERY
 -> RIGHTS_ASSESSMENT
 -> RESTRICTED, jeśli wymagane
 -> EXECUTING
 -> VALIDATING
 -> RESPONSE_READY
 -> COMPLETED

Ścieżki wyjątkowe:
 -> CLARIFICATION_REQUIRED
 -> PARTIALLY_FULFILLED
 -> BLOCKED_BY_HOLD
 -> REJECTED_WITH_REASON
 -> FAILED_RETRYABLE
 -> MANUAL_REVIEW
```

Każda zmiana stanu musi być audytowalna bez zapisywania nadmiarowych danych osobowych.

---

## 4. Weryfikacja tożsamości

Weryfikacja musi być proporcjonalna do ryzyka i rodzaju żądania.

Zasady:

- dla zalogowanego użytkownika można wykorzystywać istniejącą bezpieczną sesję oraz dodatkowe potwierdzenie przy operacjach wysokiego ryzyka;
- przy utracie dostępu do konta wymagany jest alternatywny proces weryfikacji;
- nie wolno domyślnie żądać skanu dowodu osobistego, PESEL ani innych nadmiarowych dokumentów;
- jeśli dodatkowy dokument jest wyjątkowo konieczny, zakres musi być minimalny, a dokument nie może być przechowywany dłużej niż wymaga cel weryfikacji;
- odmowa wykonania żądania z powodu niewystarczającej identyfikacji musi wskazywać powód i możliwą drogę uzupełnienia.

---

## 5. Prawo dostępu

Po zweryfikowaniu osoby system/procedura przygotowuje zakres danych przypisanych do osoby w odpowiednich bounded contexts.

Zakres może obejmować zależnie od osoby:

- konto i profil;
- historię logowania i security events w zakresie ujawnialnym;
- historię gier, meczów, rankingów i turniejów;
- własne wiadomości i ich metadane w zakresie nienaruszającym praw innych osób;
- publiczny chat i social;
- newsletter/consent evidence;
- moderation data dotyczące osoby, z wyjątkami wymaganymi dla ochrony praw innych osób, bezpieczeństwa lub prawnie uzasadnionych ograniczeń;
- privacy request history;
- informacje o odbiorcach, retencji, transferach i podstawach przetwarzania.

Eksport nie może ujawniać sekretów systemowych, credentiali, danych innych osób ani informacji pozwalających obejść zabezpieczenia.

---

## 6. Sprostowanie

Procedura sprostowania:

1. identyfikuje dane, których dotyczy żądanie;
2. rozróżnia dane faktyczne od danych domenowych/historycznych, których nie można zmienić bez zniekształcenia historii;
3. aktualizuje dane bieżące w systemie źródłowym;
4. propaguje zmianę do read models i indeksów, jeśli mają zastosowanie;
5. zachowuje minimalny audit zmiany tam, gdzie wymagany;
6. nie nadpisuje historycznych eventów w sposób niszczący integralność rozgrywki lub audytu — w takim przypadku stosuje korektę, adnotację albo właściwy model domenowy.

---

## 7. Usunięcie danych

Żądanie usunięcia uruchamia privacy workflow zgodny z ADR-V3-012.

Minimalne działania po zweryfikowaniu żądania:

- zablokowanie nowych logowań i nowych operacji konta w odpowiednim momencie procesu;
- revoke sesji/tokenów/MFA zgodnie z polityką;
- ukrycie publicznego profilu i rankingu;
- discovery danych w każdej domenie;
- przypisanie każdej klasy do: `PURGE`, `ANONYMIZE`, `RESTRICT`, `RETAIN UNDER VALID EXCEPTION`;
- weryfikację praw innych osób, np. drugiej strony wiadomości;
- sprawdzenie aktywnego legal hold;
- wykonanie deletion receipts;
- zapis minimalnego deletion ledger;
- uwzględnienie backupów i replay po restore;
- walidację negatywną po wykonaniu procesu.

Brak podstawy do zachowania danych oznacza purge/anonimizację zgodnie z zatwierdzoną polityką, a nie retencję bezterminową.

---

## 8. Ograniczenie przetwarzania

Restriction oznacza techniczne i organizacyjne zablokowanie zwykłego użycia danych przy zachowaniu wyłącznie dozwolonego zakresu.

System powinien wspierać co najmniej:

- flagę/strefę ograniczenia per request/scope;
- blokadę nieuprawnionych workerów i projekcji;
- brak wykorzystania danych do nowych celów;
- zachowanie danych tylko w zakresie uzasadnionym podstawą ograniczenia;
- audyt wejścia i wyjścia z restriction;
- ponowną ocenę przed zdjęciem ograniczenia.

---

## 9. Sprzeciw

Dla procesów opartych na art. 6 ust. 1 lit. f każdy sprzeciw wymaga case-specific review.

Procedura:

1. identyfikuje proces i podstawę prawną;
2. wstrzymuje proces, jeśli wymagają tego przepisy lub przyjęty model;
3. ocenia, czy istnieją nadrzędne prawnie uzasadnione podstawy do kontynuacji;
4. zapisuje wynik i uzasadnienie;
5. przekazuje użytkownikowi czytelną odpowiedź;
6. marketing direct powinien zostać zatrzymany zgodnie z właściwą podstawą i modelem zgody/sprzeciwu.

Sprzeciw nie może być ignorowany automatycznie przez system.

---

## 10. Przenoszenie danych

Jeżeli prawo do przenoszenia ma zastosowanie do danego procesu, eksport powinien być przygotowany w powszechnie używanym, ustrukturyzowanym i maszynowo czytelnym formacie.

Minimalny zakres nie obejmuje:

- danych innych osób, jeśli naruszałoby to ich prawa;
- tajemnic/sekretów systemowych;
- wewnętrznych ocen bezpieczeństwa, których ujawnienie tworzyłoby istotne ryzyko;
- danych, do których prawo przenoszenia nie ma zastosowania.

Docelowy format eksportu i zakres per bounded context muszą zostać zdefiniowane i przetestowane przed produkcją.

---

## 11. Wycofanie zgody

Dla procesów opartych na zgodzie, w szczególności newslettera:

- wycofanie musi być co najmniej tak łatwe jak udzielenie zgody;
- przyszłe przetwarzanie oparte na zgodzie zostaje zatrzymane;
- wycofanie nie wpływa na zgodność z prawem wcześniejszego przetwarzania;
- minimalny dowód wcześniejszej zgody/wycofania może być zachowany wyłącznie na zatwierdzonej podstawie i przez uzasadniony okres;
- suppression/unsubscribe nie może prowadzić do dalszych wysyłek marketingowych.

---

## 12. Terminy i monitorowanie deadline

Każdy request otrzymuje `received_at`, `due_at`, `status` i ownera sprawy.

System/procedura powinna wspierać:

- alert przed upływem terminu;
- eskalację przy opóźnieniu;
- dokumentację przyczyny przedłużenia, jeśli jest dopuszczalne;
- spójny deadline we wszystkich bounded contexts;
- status `BLOCKED_BY_HOLD` lub `MANUAL_REVIEW` bez utraty kontroli terminu komunikacji do osoby.

Termin odpowiedzi prawnej musi zostać potwierdzony w finalnym legal review i odzwierciedlony w runbooku operacyjnym.

---

## 13. Prawa innych osób i wyjątki

Wykonanie prawa jednej osoby nie może automatycznie niszczyć praw i danych drugiej osoby.

Przykłady:

- wiadomość między dwiema osobami wymaga party-state model;
- historia turnieju może pozostać jako struktura domenowa po anonimizacji uczestnika;
- moderation evidence może być czasowo ograniczone zamiast usunięte przy ważnym legal hold;
- część danych może wymagać zachowania dla ustalenia, dochodzenia lub obrony roszczeń po case-specific review;
- pełna treść logów bezpieczeństwa nie musi być ujawniana, jeśli ujawnienie narusza prawa innych lub bezpieczeństwo, ale decyzja musi mieć podstawę i uzasadnienie.

Każdy wyjątek musi mieć konkretny `reason_code`, podstawę, ownera, zakres i termin ponownego review.

---

## 14. Minimalny rekord privacy request

Docelowy rekord może mieć strukturę podobną do:

```text
request_id
request_type
subject_ref_hmac
received_at
verified_at
due_at
completed_at
status
policy_version
scope
exception_code
hold_reference
receipts_count
response_locator
version
```

Zakazane jest przechowywanie w tym rekordzie:

- haseł;
- tokenów uwierzytelniających;
- pełnych kopii dokumentów tożsamości bez wyjątkowej i zatwierdzonej potrzeby;
- plaintext prywatnych wiadomości jako evidence requestu;
- zbędnego PII.

---

## 15. Evidence i potwierdzenie wykonania

Każdy zakończony request powinien mieć minimalny, trwały proof obejmujący:

- identyfikator requestu;
- typ prawa;
- daty kluczowych etapów;
- wynik;
- listę bounded contexts objętych wykonaniem;
- receipts wykonania;
- wyjątki/hold, jeśli wystąpiły;
- wersję polityki użytej do decyzji;
- potwierdzenie wysłania odpowiedzi.

Evidence nie może zawierać pełnego eksportu danych ani sekretów tylko po to, aby udowodnić wykonanie procesu.

---

## 16. Obsługa błędów i retry

Privacy workflow musi być:

- idempotentny;
- restartowalny;
- odporny na częściowe wykonanie;
- widoczny operacyjnie;
- kontrolowany wersją/policy version;
- wyposażony w retry z dead-letter/manual review dla trwałych błędów.

Żądanie nie może zostać oznaczone jako `COMPLETED`, jeśli jakikolwiek obowiązkowy bounded context nie zwrócił pozytywnego receipt albo jawnego, ważnego wyjątku.

---

## 17. Testy wymagane przed produkcją

Przed finalnym production readiness wymagane są co najmniej testy:

1. access request dla aktywnego konta;
2. delete request z danymi w kilku bounded contexts;
3. delete jednej strony prywatnej wiadomości;
4. sprostowanie danych profilu i propagacja do read models;
5. restriction i późniejsze zdjęcie restriction;
6. sprzeciw wobec procesu 6(1)(f);
7. unsubscribe/withdrawal of consent;
8. request z aktywnym legal hold;
9. request z częściowym błędem providera;
10. restore backupu po wcześniejszym delete i replay deletion ledger;
11. eksport nieujawniający danych drugiej osoby;
12. walidacja braku sekretów/PII leakage w audit i telemetry.

Same dokumenty projektowe nie są dowodem przejścia tych testów.

---

## 18. Otwarte warunki

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-E12-O01 | wskazać publiczny kanał privacy/contact | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-E12-O02 | zdefiniować i wdrożyć Privacy Request Orchestrator lub równoważny workflow | P1 Technical/Privacy | Architecture + Privacy/Legal | `OPEN / NOT IMPLEMENTED` |
| PL-E12-O03 | ustalić format i zakres eksportu per bounded context | P1 Privacy/Technical | Privacy/Legal + Domain Owners | `OPEN` |
| PL-E12-O04 | wdrożyć deletion receipts i walidację negatywną | P1 Technical/Privacy | Architecture | `OPEN / NOT IMPLEMENTED` |
| PL-E12-O05 | potwierdzić finalne terminy i treść komunikacji dla praw osób | P1 Legal | Privacy/Legal | `OPEN` |
| PL-E12-O06 | przeprowadzić testy end-to-end wszystkich głównych praw | P1 Operational | QA + Privacy/Legal | `OPEN / PRE-PRODUCTION` |

---

## 19. Ocena PL-E12

```text
PL-E12 = PASS WITH CONDITIONS

PROCEDURE MODEL = ESTABLISHED
RIGHTS SCOPE = DEFINED
IDENTITY VERIFICATION PRINCIPLES = DEFINED
ACCESS / RECTIFICATION / ERASURE / RESTRICTION / OBJECTION / PORTABILITY = COVERED
CONSENT WITHDRAWAL = COVERED
LEGAL HOLD / THIRD-PARTY RIGHTS = COVERED
REQUEST EVIDENCE MODEL = DEFINED
TECHNICAL IMPLEMENTATION = NOT VERIFIED
END-TO-END TESTS = NOT EXECUTED
PUBLIC PRIVACY CONTACT = OPEN
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `PASS` wymaga wdrożenia i operacyjnego potwierdzenia procedur, a nie tylko ich dokumentacyjnego zaprojektowania.

---

## 20. Granica autoryzacji

Utworzenie PL-E12:

- nie uruchamia privacy workflow;
- nie wykonuje żadnego usunięcia ani eksportu danych;
- nie modyfikuje produkcji;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia statusu `Production V3 = NO-GO`.
