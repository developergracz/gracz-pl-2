# Gracz.pl V3 — P1-PL-005 Pełna DPIA, safeguards dla użytkowników 16–17 i formalne zamknięcie

Data oceny: 01.09.2026  
Wersja: `1.0`  
Canonical blocker: `P1-PL-005`  
Status: **FULL DPIA COMPLETED AT GOVERNANCE/DESIGN LEVEL / MINORS MODEL RESOLVED / RESIDUAL OPERATIONAL RISKS DELEGATED TO P1-PL-006–009 / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence/control: `PL-E05`, `PL-E06`, `PL-E10`, `PL-E11`, `PL-C12`, `PL-C16`, `P1-PL-001`, `P1-PL-002`, `P1-PL-004`

> Niniejszy dokument jest pełną oceną skutków dla ochrony danych (DPIA) na poziomie governance i projektowym dla bazowego modelu Gracz.pl V3. Nie jest opinią kancelarii prawnej i nie potwierdza operacyjnego wdrożenia safeguards. Zamknięcie P1-PL-005 oznacza zamknięcie obowiązku wykonania DPIA i decyzji dotyczącej modelu 16–17; nie usuwa odrębnych blockerów provider/DPA/transfer, backup/restore ani operational privacy evidence.

---

## 1. Powód wykonania pełnej DPIA

Screening `PL-E11` ustalił jednoznacznie:

```text
DPIA SCREENING = COMPLETED
DPIA DECISION = REQUIRED BEFORE PRODUCTION
DPIA SCOPE = WHOLE V3 PRIVACY MODEL WITH DEEP-DIVE SECTIONS
HIGH-RISK PROCESSING MAY START NOW = NO
```

Materialne czynniki to w szczególności:

- użytkownicy 16–17;
- prywatne wiadomości i załączniki;
- moderacja i sankcje wpływające na dostęp do usługi;
- security telemetry / anti-abuse / potencjalny anti-cheat;
- łączenie danych wielu domen po wspólnym user ID;
- publiczny profil, ranking, chat i social;
- zewnętrzni providerzy i potencjalne transfery;
- backup/restore oraz ryzyko resurrection danych;
- docelowy wzrost skali platformy.

---

## 2. Zakres systemu i operacji przetwarzania

DPIA obejmuje bazowy model V3:

1. Identity: konto, profil, rejestracja, logowanie, sesje, recovery, MFA;
2. Game Platform / Match Runtime: mecze, ruchy, snapshoty, replay, ranking, turnieje;
3. Messaging: prywatne wiadomości i załączniki;
4. Global Chat & Social: publiczny chat, reakcje, relacje social;
5. Moderation: zgłoszenia, evidence, sankcje, odwołania;
6. Security/Audit: IP/UA w niezbędnym zakresie, security events, privileged audit, anti-abuse;
7. Newsletter: consent/withdrawal, suppression, proof, delivery telemetry;
8. Privacy Orchestration: prawa osób, deletion, restriction, legal hold, evidence receipts;
9. Observability: logi, traces, metryki;
10. Backup/Restore: backup lifecycle, restore environment, deletion replay, anti-resurrection;
11. Provider layer: hosting, edge, e-mail/newsletter, storage, observability i przyszłe usługi zatwierdzane osobnym gate.

DPIA nie obejmuje jako zatwierdzonego baseline:

- użytkowników poniżej 16 lat;
- gier za realne pieniądze;
- płatnych zobowiązań użytkowników 16–17;
- KYC, płatności, danych kart/bankowych;
- biometrii, precyzyjnej geolokalizacji;
- celowego przetwarzania danych art. 9/10 RODO;
- behawioralnego marketing profiling;
- trwałego device fingerprinting;
- automatycznych poważnych sankcji bez human review.

Każde takie rozszerzenie wymaga nowego gate i aktualizacji DPIA.

---

## 3. Kategorie osób i danych

### 3.1. Kategorie osób

- użytkownicy dorośli;
- użytkownicy 16–17;
- gracze/ranking/turnieje;
- nadawcy i odbiorcy wiadomości;
- uczestnicy publicznego chatu/social;
- osoby zgłaszające i zgłoszone;
- subskrybenci newslettera;
- osoby realizujące prawa privacy;
- administratorzy, moderatorzy i operatorzy.

### 3.2. Klasy danych

Obowiązuje klasyfikacja `PL-E06`:

```text
PUBLIC
INTERNAL
PERSONAL
SENSITIVE
EVIDENCE
SECRET
ANONYMIZED
```

Szczególnie istotne dla DPIA są:

- `PERSONAL`: e-mail, login, user ID, profil, historia aktywności;
- `SENSITIVE` jako klasa projektowa: prywatne wiadomości, security signals, część moderation evidence;
- `EVIDENCE`: consent proof, privacy request proof, audit/moderation evidence;
- `SECRET`: tokeny, MFA secrets, credential material, klucze;
- `ANONYMIZED`: wyłącznie dane bez realistycznej możliwości reidentyfikacji i bez mapy zwrotnej.

Baseline nie wymaga PESEL, skanów dokumentów, pełnego adresu, danych zdrowotnych, biometrii ani dokładnej lokalizacji.

---

## 4. Cele i podstawy prawne

DPIA przyjmuje kanoniczny model zamknięty w `P1-PL-001`:

| Proces | Podstawa bazowa |
|---|---|
| konto/profil i funkcje niezbędne do usługi | art. 6(1)(b) |
| auth/session/recovery | art. 6(1)(b) |
| dodatkowe security/anti-abuse | art. 6(1)(f) + LIA safeguards |
| gry/ranking/turnieje | art. 6(1)(b); integrity/anti-abuse art. 6(1)(f) |
| prywatne wiadomości | art. 6(1)(b) |
| publiczny chat/social | art. 6(1)(b); moderacja/anti-spam art. 6(1)(f) |
| moderacja/sankcje/odwołania | art. 6(1)(f) z human review i odwołaniem |
| privileged audit / security telemetry | art. 6(1)(f) z minimalizacją |
| newsletter/marketing | art. 6(1)(a), dobrowolna zgoda |
| realizacja praw osób | art. 6(1)(c) dla bezpośrednich obowiązków RODO |
| backup/restore continuity | podstawy danych źródłowych + art. 6(1)(f) dla continuity/recovery |

Generic claims/proof nie posiada blankietowej podstawy `6(1)(f)`.

---

## 5. Niezbędność i proporcjonalność

### 5.1. Zasada minimum

Dla każdego procesu obowiązuje:

- zbieranie tylko danych niezbędnych do określonego celu;
- brak danych „na zapas”;
- krótsza retencja, gdy ten sam cel można osiągnąć krócej;
- pseudonimizacja, gdy nie jest potrzebna jawna identyfikacja;
- anonimizacja tylko po rzeczywistym zerwaniu możliwości powiązania;
- brak wtórnego wykorzystania danych security, messaging lub minors do marketingu.

### 5.2. Prywatne wiadomości

Dostarczenie wiadomości wymaga przetwarzania sender/recipient IDs, metadanych i payloadu. Nie jest proporcjonalne:

- rutynowe czytanie plaintext przez administratora;
- kopiowanie message body do logów, audit, outbox lub telemetry;
- marketingowe skanowanie treści.

Dopuszczalny dostęp moderacyjny jest wyłącznie case-bound, need-to-know i audytowalny, np. w związku ze zgłoszeniem konkretnej treści.

### 5.3. Security telemetry

IP/UA i security signals mogą być używane tylko w zakresie niezbędnym do bezpieczeństwa. Persistent fingerprinting, szerokie behawioralne profilowanie urządzenia i cross-service tracking nie są zatwierdzone w baseline.

---

## 6. Finalny model użytkowników 16–17

### 6.1. Próg wieku

```text
BASELINE MINIMUM ACCOUNT AGE = 16
UNDER 16 ACCOUNT = NOT ALLOWED
PARENT/GUARDIAN CONSENT FLOW = NOT IN BASELINE
```

Próg 16+ jest polityką produktu. Nie jest używany jako twierdzenie, że art. 8 RODO samodzielnie ustanawia uniwersalny minimalny wiek dla wszystkich usług.

### 6.2. Minimalny age assurance

Baseline:

- użytkownik składa oświadczenie wieku / przekazuje minimum potrzebne do kwalifikacji;
- system przechowuje preferencyjnie age-band/flagę, a nie pełną datę urodzenia;
- `UNDER_16` blokuje aktywację konta;
- brak skanów dowodu, PESEL, biometrii lub dokumentów w zwykłym flow;
- silniejszy age assurance może zostać użyty tylko po nowej ocenie proporcjonalności i DPIA update.

Ryzyko obejścia self-declaration pozostaje, ale nie uzasadnia automatycznie budowy inwazyjnego systemu identyfikacyjnego.

### 6.3. Privacy by default dla 16–17

Obowiązują następujące wartości domyślne:

- publiczny profil ograniczony do pseudonimu/nazwy gracza i minimum funkcjonalnego;
- dokładny wiek, data urodzenia, e-mail, lokalizacja i dane kontaktowe — `NOT PUBLIC`;
- ranking publikuje tylko dane konieczne do funkcji gry;
- łatwy `BLOCK` i `REPORT`;
- treści social/chat objęte moderacją i raportowaniem;
- wiadomości od nieznajomych powinny być domyślnie ograniczone/wyłączone dla 16–17 albo poprzedzone bezpiecznym kontrolowanym flow;
- brak publicznej ekspozycji age-band;
- brak marketing profiling i behavioral targeting;
- brak płatnych zobowiązań, gier za pieniądze, KYC i funkcji finansowych w baseline 16–17;
- komunikaty privacy/regulamin muszą być proste i zrozumiałe.

### 6.4. Newsletter dla 16–17

W baseline DPIA:

```text
BEHAVIORAL MARKETING FOR 16–17 = NOT APPROVED
MARKETING PROFILING FOR 16–17 = NOT APPROVED
NEWSLETTER MARKETING FOR 16–17 = NOT ENABLED BY DEFAULT / REQUIRES SEPARATE AGE-APPROPRIATE REVIEW BEFORE PRODUCTION
```

Tym samym P1-PL-004 zamyka ogólny model newslettera, ale nie daje automatycznej zgody na marketing kierowany do małoletnich.

---

## 7. Scenariusze szkód i ocena ryzyka

Skala:

- `L` — niskie;
- `M` — średnie;
- `H` — wysokie;
- `C` — krytyczne.

| ID | Scenariusz szkody | Ryzyko przed safeguards | Główne safeguards | Ryzyko rezydualne na poziomie design |
|---|---|---|---|---|
| DPIA-R01 | nadmierna publiczna ekspozycja użytkownika 16–17 | H | minimalny profil, brak danych kontaktowych/wieku, block/report, minors defaults | M |
| DPIA-R02 | niepożądany kontakt / grooming / nadużycie social lub messaging | H | ograniczone DM, report/block, moderacja, case-bound evidence, privacy defaults | M |
| DPIA-R03 | ujawnienie prywatnej wiadomości lub załącznika | C | szyfrowanie, least privilege, brak plaintext w logach/audit/outbox, case-bound access | M/H do czasu P1-PL-009 evidence |
| DPIA-R04 | niesprawiedliwa sankcja na podstawie automatyki | H | human review, odwołanie, brak poważnych automatic-only sanctions | M |
| DPIA-R05 | nadmierne security profiling / fingerprinting | H | minimalizacja IP/UA, brak persistent fingerprint baseline, purpose separation | M |
| DPIA-R06 | połączenie wielu domen tworzy szeroki profil użytkownika | H | bounded contexts, purpose limitation, least privilege, brak marketing reuse | M |
| DPIA-R07 | marketing profiling małoletnich | H | niezatwierdzone / wyłączone w baseline | L/M |
| DPIA-R08 | nieautoryzowany provider/subprocessor/transfer | H | provider approval gate | H do zamknięcia P1-PL-006/007 |
| DPIA-R09 | resurrection danych po restore | H | deletion ledger, replay, isolated restore, expiry | H do zamknięcia P1-PL-008 |
| DPIA-R10 | sekret/PII/message body w logach lub evidence | C | field policy, redaction, zakaz plaintext secret/private payload | H do zamknięcia P1-PL-009 |
| DPIA-R11 | nadmierna retencja evidence/audit | H | P1-PL-002: max 36m/24m/12–36m, early purge, narrow legal hold | M |
| DPIA-R12 | wykorzystanie danych UGC szczególnej kategorii do profilowania | H | brak celu pozyskiwania, brak profilowania, ograniczony dostęp/moderacja | M |

---

## 8. Środki techniczne i organizacyjne

Wymagane TOMs obejmują:

### 8.1. Access control

- RBAC / least privilege;
- MFA dla operacji uprzywilejowanych;
- audyt dostępu administracyjnego;
- case-bound dostęp do moderation evidence;
- brak domyślnego uprawnienia do plaintext prywatnych wiadomości.

### 8.2. Data protection

- TLS dla transmisji;
- szyfrowanie lub równoważna ochrona danych o podwyższonym ryzyku;
- oddzielne zarządzanie sekretami;
- brak haseł/tokenów/MFA secrets w logach;
- brak message body w zwykłych logach/audit/outbox/telemetry;
- masking/redaction.

### 8.3. Lifecycle

- retencja z retention clock i final action;
- deletion/restriction workflow;
- narrow legal hold;
- deletion ledger;
- restore replay i anti-resurrection;
- expiry restore environment.

### 8.4. Governance

- ROPA;
- privacy notice;
- LIA;
- provider approval gate;
- DPA/transfer review;
- privacy review przy nowych celach/danych/providerach;
- wersjonowane evidence i decision record.

---

## 9. Deep-dive: prywatne wiadomości i moderacja

Finalny model DPIA:

```text
ROUTINE ADMIN PLAINTEXT ACCESS = NOT APPROVED
BULK MESSAGE SCANNING FOR MARKETING = NOT APPROVED
CASE-BOUND MODERATION ACCESS = PERMITTED ONLY WITH PURPOSE + NEED-TO-KNOW + AUDIT
FULL CONVERSATION COPY AS ROUTINE EVIDENCE = NOT APPROVED
MINIMUM RELEVANT EVIDENCE = REQUIRED
```

Jeżeli przyszły anti-abuse wymaga automatycznej analizy treści, musi otrzymać osobną ocenę purpose, podstawy, skuteczności, false positives, minors impact i aktualizację DPIA.

---

## 10. Deep-dive: telemetry / anti-abuse / anti-cheat

Baseline dopuszcza:

- krótkotrwałe IP/UA i security metadata w zakresie bezpieczeństwa;
- rate limiting i heurystyki nieoparte na trwałym profilu;
- analizę match/game eventów dla integralności gry;
- human review dla poważnej sankcji.

Baseline nie dopuszcza bez nowego review:

- persistent device fingerprint;
- cross-site/cross-service tracking;
- szerokiego behavioral scoring poza bezpieczeństwem;
- automatycznej permanentnej blokady wyłącznie na podstawie niejawnego modelu;
- użycia security telemetry do marketingu.

---

## 11. Deep-dive: providerzy i transfery

DPIA identyfikuje provider risk jako **niezamknięte ryzyko wysokie**, ale nie dubluje go jako nowy blocker P1-PL-005.

Kanonicznie:

- `P1-PL-006` odpowiada za provider/processors/DPA;
- `P1-PL-007` odpowiada za transfery poza EOG.

Reguła DPIA:

```text
UNVERIFIED PROVIDER MAY RECEIVE PRODUCTION PII = NO
EU REGION ALONE = NOT SUFFICIENT TRANSFER EVIDENCE
PROVIDER CHANGE = DPIA REVIEW TRIGGER
```

---

## 12. Deep-dive: backup / restore

Ryzyko resurrection pozostaje wysokie do czasu wykonania testów operacyjnych.

Kanonicznie zamyka je `P1-PL-008`.

Wymagane przed Production V3 GO:

- faktyczny schedule/expiry;
- isolated restore;
- deletion/restriction replay;
- brak reaktywacji konta, tokenów, publicznego profilu i withdrawn consent;
- legal-hold reconciliation;
- cleanup restore environment;
- cykliczne evidence DR/restore.

---

## 13. Ocena ryzyka rezydualnego

### 13.1. Ryzyka zamknięte projektowo do poziomu akceptowalnego warunkowo

Na poziomie design/governance do `MEDIUM` lub niżej sprowadzono:

- public exposure 16–17;
- minors marketing risk przez wyłączenie profilingu;
- automated sanctions przez human review/appeal;
- cross-domain use przez purpose limitation;
- generic over-retention przez P1-PL-002;
- broad admin access do messaging przez model case-bound.

### 13.2. Ryzyka nadal wysokie z powodu braku evidence operacyjnego

```text
PROVIDER / DPA / TRANSFER = HIGH / BLOCKED BY P1-PL-006 + P1-PL-007
BACKUP / RESTORE / RESURRECTION = HIGH / BLOCKED BY P1-PL-008
OPERATIONAL REDACTION / LEAKAGE / PRIVACY FLOW EVIDENCE = HIGH / BLOCKED BY P1-PL-009
```

Te ryzyka nie są zaakceptowane do produkcji. Są jawnie blokowane przez odrębne kanoniczne P1.

---

## 14. Decyzja dotycząca art. 36 / uprzedniej konsultacji

Na obecnym etapie:

```text
ARTICLE 36 PRIOR CONSULTATION = NOT INITIATED AT DESIGN/FREEZE STAGE
REASON = HIGH-RISK PROCESSING IS NOT AUTHORIZED TO START; OUTSTANDING HIGH RISKS HAVE MANDATORY MITIGATION GATES
FINAL ARTICLE 36 RECHECK = REQUIRED AFTER P1-PL-006–009 EVIDENCE
```

Reguła bezwzględna:

> Jeżeli po wdrożeniu i weryfikacji planowanych safeguards którekolwiek przetwarzanie nadal będzie powodowało wysokie ryzyko, którego administrator nie potrafi wystarczająco ograniczyć, Production V3 pozostaje `NO-GO`, a potrzeba uprzedniej konsultacji musi zostać rozstrzygnięta przed rozpoczęciem tego przetwarzania.

Brak konsultacji teraz nie oznacza stwierdzenia, że art. 36 nigdy nie będzie miał zastosowania.

---

## 15. Finalny model prawa/produktu dla 16–17

Dla zakresu tej DPIA decyzja governance jest następująca:

```text
16–17 ACCOUNT = ALLOWED IN BASELINE SUBJECT TO SAFEGUARDS
UNDER 16 = BLOCKED
PAID / REAL-MONEY / FINANCIAL COMMITMENTS FOR 16–17 = OUT OF BASELINE / SEPARATE LEGAL GATE
AGE DOCUMENT COLLECTION = NOT APPROVED IN BASELINE
MINOR MARKETING PROFILING = NOT APPROVED
PUBLIC AGE / CONTACT DETAILS = NOT APPROVED
SERIOUS AUTOMATED SANCTIONS WITHOUT HUMAN REVIEW = NOT APPROVED
```

Finalny regulamin i privacy notice muszą odzwierciedlać ten model prostym, age-appropriate językiem. P1-PL-003 pozostaje otwarty z powodu zależności provider/transfer/contact-data/publication package, a nie z powodu braku decyzji minors w tej DPIA.

---

## 16. Action register po DPIA

| ID | Działanie | Kanoniczny owner/blocker | Status |
|---|---|---|---|
| DPIA-A01 | zweryfikować rzeczywistych providerów, role, DPA i subprocessors | `P1-PL-006` | OPEN |
| DPIA-A02 | zweryfikować regiony, remote access i transfer mechanisms | `P1-PL-007` | OPEN |
| DPIA-A03 | wykonać restore/deletion replay/anti-resurrection evidence | `P1-PL-008` | OPEN |
| DPIA-A04 | wykonać E2E deletion/restriction/legal-hold/privacy-by-default tests | `P1-PL-009` | OPEN |
| DPIA-A05 | wykonać negative leakage/redaction tests | `P1-PL-009` | OPEN |
| DPIA-A06 | przetestować `<16` registration block i age-band minimalization | `P1-PL-009` | OPEN |
| DPIA-A07 | przetestować 16–17 profile/chat/DM defaults, report/block i sanctions appeal | `P1-PL-009` | OPEN |
| DPIA-A08 | po P1-PL-006–009 wykonać final residual-risk delta + art. 36 recheck | final delta review | OPEN |

Działania są świadomie deduplikowane do istniejących kanonicznych blockerów.

---

## 17. Triggery ponownej oceny DPIA

DPIA musi zostać zaktualizowana przy co najmniej jednym z poniższych zdarzeń:

- dopuszczenie `<16`;
- parental consent flow;
- paid/real-money funkcje lub płatności;
- behavioral advertising / marketing profiling;
- persistent device fingerprinting;
- automatyczne poważne sankcje bez human review;
- nowe dane art. 9/10, biometria lub precyzyjna lokalizacja;
- materialne rozszerzenie anti-cheat/telemetry;
- nowy provider/subprocessor lub transfer model;
- istotny wzrost skali;
- incydent ujawniający nowe ryzyko;
- materialna zmiana retencji/legal hold;
- znacząca zmiana messaging/social exposure.

Regularny review: co najmniej raz w roku oraz po każdym materialnym triggerze.

---

## 18. Delta review względem PL-E11 / PL-C12 / PL-C16

Po wykonaniu tej pełnej DPIA:

```text
PL-E11-O01 FULL DPIA = RESOLVED
PL-E11-O02 MINORS SAFEGUARDS = RESOLVED AT DESIGN/GOVERNANCE LEVEL
PL-E11-O03 PRIVATE MESSAGE ACCESS MODEL = RESOLVED AT DESIGN LEVEL
PL-E11-O04 TELEMETRY / ANTI-ABUSE BASELINE = RESOLVED AT DESIGN LEVEL
PL-E11-O05 PROVIDERS / DPA / TRANSFERS = DELEGATED / STILL OPEN IN P1-PL-006/007
PL-E11-O06 RESIDUAL RISK + ART.36 = ASSESSED / FINAL RECHECK AFTER P1-PL-006–009

PL-C12 MINORS DESIGN LAYER = PASS WITH CONDITIONS
PL-C16 DPIA COMPLETION LAYER = PASS WITH CONDITIONS
```

Warunki operacyjne nie są dublowane jako P1-PL-005.

---

## 19. Formalne zamknięcie P1-PL-005

Kryteria kanoniczne zostały spełnione na poziomie governance/design:

- pełna DPIA V3 wykonana i wersjonowana — **YES**;
- oceniono ryzyka 16–17, messaging, social, moderation, telemetry, anti-abuse, providers, retention i backup — **YES**;
- finalny privacy-by-default model 16–17 — **YES**;
- `<16` pozostaje zablokowane — **YES**;
- age assurance jest minimalny i proporcjonalny jako baseline — **YES**;
- ryzyko rezydualne zostało ocenione — **YES**;
- art. 36 został oceniony i ma obowiązkowy finalny recheck po mitigations — **YES**;
- otwarte ryzyka operacyjne/providerowe są deduplikowane do P1-PL-006–009 — **YES**.

```text
P1-PL-005 = CLOSED
CLOSURE TYPE = FULL DPIA + MINORS GOVERNANCE/DESIGN CLOSURE
FULL DPIA COMPLETED = YES
MINORS 16–17 MODEL = RESOLVED
UNDER 16 = NOT ALLOWED
HIGH-RISK PROCESSING MAY START NOW = NO
ARTICLE 36 FINAL RECHECK = REQUIRED AFTER REMAINING MITIGATION EVIDENCE

CANONICAL P1 CLOSED = 4 OF 9
CANONICAL P1 OPEN = 5 OF 9
OPEN P0 PRIVACY/LEGAL = 0 KNOWN

ADR-V3-012 FINAL VERDICT = HOLD
SECOND FORMAL DOCUMENT FINAL SIGNATURE = NOT YET
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

## 20. Granica autoryzacji

Utworzenie tej DPIA i zamknięcie P1-PL-005:

- nie uruchamia przetwarzania wysokiego ryzyka;
- nie zatwierdza providera ani transferu;
- nie potwierdza skuteczności safeguards w runtime;
- nie uruchamia age assurance ani rejestracji;
- nie dopuszcza `<16`;
- nie zatwierdza marketingu małoletnich;
- nie zmienia Render, bazy, DNS, sekretów ani kodu;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**