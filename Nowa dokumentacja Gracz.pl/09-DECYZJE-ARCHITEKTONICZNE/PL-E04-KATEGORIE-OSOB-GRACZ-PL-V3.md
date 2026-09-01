# Gracz.pl V3 — PL-E04 Kategorie osób, których dane dotyczą

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E04`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązany dokument PL-E03: `PL-E03-MAPA-CELOW-I-PODSTAW-PRAWNYCH-GRACZ-PL-V3.md`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument jest formalnym artefaktem evidence dla PL-E04. Ustala kategorie osób, których dane mogą być przetwarzane w Gracz.pl V3. Nie jest poradą prawną, nie stanowi zgody na implementację ani deployment i nie zmienia aktywnego freeze. Obszary oznaczone `PENDING OWNER DECISION`, `TO VERIFY` lub `HOLD` wymagają odrębnego rozstrzygnięcia przed końcowym `PASS` ADR-V3-012.

---

## 1. Administrator i zakres

| Pole | Wartość |
|---|---|
| Administrator | **Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu** |
| Projekt / usługa | `Gracz.pl` |
| Jurysdykcja review | Polska / Unia Europejska — RODO/GDPR |
| Decision Owner | Czesław Socha — Project Owner / Documentation Owner / Privacy-Legal Decision Owner |
| Zakres | użytkownicy kont, gracze, uczestnicy komunikacji, newslettera, moderacji, privacy requests oraz osoby występujące w logach/audycie |
| Status implementacji | `NOT AUTHORIZED / FREEZE ACTIVE` |

---

## 2. Zasady klasyfikacji osób

1. Kategoria osoby opisuje relację osoby do celu przetwarzania, a nie jedynie techniczną tabelę lub rekord.
2. Jedna osoba może należeć jednocześnie do kilku kategorii, np. być użytkownikiem, graczem, subskrybentem newslettera i osobą składającą żądanie RODO.
3. Kategoria nie może być rozszerzana wyłącznie dlatego, że system technicznie potrafi zebrać dodatkowe dane.
4. Zakres danych dla każdej kategorii musi wynikać z konkretnego celu i podstawy prawnej opisanej w PL-E03 i ROPA.
5. Szczególną ostrożność stosuje się do małoletnich, osób objętych moderacją, prywatnej komunikacji oraz danych bezpieczeństwa.
6. Osoby przypadkowo pojawiające się w załącznikach lub treściach użytkownika nie są automatycznie aktywnie profilowaną kategorią — wymagają minimalizacji i odrębnego podejścia do zgłoszeń/nadużyć.

---

# 3. Kategorie osób

## PL-E04-01 — Użytkownicy rejestrujący się

| Element | Wartość |
|---|---|
| Opis | osoby rozpoczynające rejestrację, przed pełną aktywacją konta |
| Typowe procesy | rejestracja, potwierdzenie e-mail, walidacja danych, anti-abuse rejestracji |
| Typowe dane | login/nazwa, e-mail, token/metadata potwierdzenia, timestamps, ograniczone security signals |
| Powiązanie ROPA | `ROPA-01`, częściowo `ROPA-02` |
| Ryzyko | niepotrzebne utrzymywanie niedokończonych rejestracji, nadmierna telemetry |
| Status | `IN SCOPE` |

## PL-E04-02 — Zarejestrowani użytkownicy aktywni

| Element | Wartość |
|---|---|
| Opis | osoby posiadające aktywne konto i korzystające z funkcji Gracz.pl |
| Typowe procesy | konto/profil, uwierzytelnianie, gry, ranking, komunikacja, social, privacy settings |
| Typowe dane | identyfikator, login/publiczna nazwa, e-mail, profil, historia aktywności, dane gier i komunikacji |
| Powiązanie ROPA | `ROPA-01`–`ROPA-04`, zależnie od używanych funkcji |
| Ryzyko | łączenie danych między domenami bez potrzeby, nadmierna retencja, publiczna ekspozycja |
| Status | `IN SCOPE` |

## PL-E04-03 — Użytkownicy nieaktywni / konta oczekujące na usunięcie / byli użytkownicy

| Element | Wartość |
|---|---|
| Opis | osoby z kontem nieaktywnym, usuniętym logicznie, w toku privacy workflow lub po zakończeniu relacji z serwisem |
| Typowe procesy | deletion, restriction, retention, audit, legal hold, anonimizacja |
| Typowe dane | minimalne dane potrzebne do wykonania workflow, dowody żądania, pseudonimowe/anonimowe dane domenowe |
| Powiązanie ROPA | `ROPA-01`, `ROPA-08`, `ROPA-09` |
| Ryzyko | „wieczna” retencja po usunięciu, niepełny purge, resurrection po restore |
| Status | `IN SCOPE / RETENTION-SENSITIVE` |

## PL-E04-04 — Gracze i uczestnicy meczów

| Element | Wartość |
|---|---|
| Opis | użytkownicy uczestniczący w rozgrywkach Warcaby, Gomoku, Tysiąc i przyszłych grach objętych V3 |
| Typowe procesy | matchmaking, przebieg meczu, reconnect, wynik, replay, anti-cheat/spór |
| Typowe dane | user ID, game/match ID, ruchy/eventy, wynik, timestamps, ranking impact |
| Powiązanie ROPA | `ROPA-03` |
| Ryzyko | zbyt długa identyfikowalna historia, wykorzystywanie danych gry do nowych celów |
| Status | `IN SCOPE` |

## PL-E04-05 — Uczestnicy rankingów i turniejów

| Element | Wartość |
|---|---|
| Opis | gracze, których wyniki są przetwarzane i częściowo publikowane w rankingach lub strukturze turniejowej |
| Typowe procesy | rating, ranking, drabinka, wyniki, publikacja historii turnieju |
| Typowe dane | publiczna nazwa, user ID, rating, wyniki, pozycja, tournament IDs, timestamps |
| Powiązanie ROPA | `ROPA-03` |
| Ryzyko | nadmierna publiczność profilu, utrzymywanie identyfikowalnych wyników po delete konta |
| Status | `IN SCOPE / PUBLIC-PROJECTION SENSITIVE` |

## PL-E04-06 — Nadawcy i odbiorcy prywatnych wiadomości

| Element | Wartość |
|---|---|
| Opis | użytkownicy korzystający z prywatnej komunikacji i załączników |
| Typowe procesy | wysyłka, odbiór, przechowanie, odczyt, usunięcie, abuse reporting |
| Typowe dane | sender/recipient IDs, message metadata, zaszyfrowana treść, załączniki, timestamps |
| Powiązanie ROPA | `ROPA-04` |
| Ryzyko | ujawnienie treści, błędna autoryzacja, retention conflict po usunięciu jednej strony |
| Status | `IN SCOPE / HIGH CONFIDENTIALITY` |

## PL-E04-07 — Użytkownicy publicznego chatu i funkcji społecznościowych

| Element | Wartość |
|---|---|
| Opis | osoby publikujące treści, reakcje i tworzące relacje social w częściach publicznych lub półpublicznych |
| Typowe procesy | chat, reakcje, znajomości, obecność, zgłoszenia, moderacja |
| Typowe dane | publiczna nazwa, treść chatu, reakcje, relacje, timestamps, moderation links |
| Powiązanie ROPA | `ROPA-04`, częściowo `ROPA-06` |
| Ryzyko | trwała publiczna ekspozycja, małoletni, nadużycia, profilowanie zachowań |
| Status | `IN SCOPE / MINORS DECISION DEPENDENCY` |

## PL-E04-08 — Subskrybenci newslettera i osoby w pending confirmation

| Element | Wartość |
|---|---|
| Opis | osoby zapisane lub zapisujące się na newsletter/komunikację marketingową |
| Typowe procesy | double opt-in, wysyłka, unsubscribe, proof zgody, delivery telemetry |
| Typowe dane | e-mail, status subskrypcji, consent proof, token metadata, timestamps |
| Powiązanie ROPA | `ROPA-05` |
| Ryzyko | marketing bez ważnej zgody, zbyt długi proof, brak skutecznego unsubscribe |
| Status | `IN SCOPE / CONSENT MODEL PENDING` |

## PL-E04-09 — Osoby zgłaszające naruszenia

| Element | Wartość |
|---|---|
| Opis | użytkownicy składający zgłoszenia dotyczące treści, zachowania, nadużyć lub bezpieczeństwa |
| Typowe procesy | report intake, triage, moderation case, appeal/support evidence |
| Typowe dane | reporter ID, treść zgłoszenia, powiązane obiekty, timestamps, minimalne evidence |
| Powiązanie ROPA | `ROPA-06` |
| Ryzyko | ujawnienie tożsamości zgłaszającego, nadmierna retencja evidence |
| Status | `IN SCOPE` |

## PL-E04-10 — Osoby zgłaszane / objęte moderacją, sankcją lub odwołaniem

| Element | Wartość |
|---|---|
| Opis | użytkownicy, wobec których prowadzone są działania moderacyjne lub security-related |
| Typowe procesy | investigation, sanction, appeal, legal hold, audit |
| Typowe dane | user ID, case/action metadata, evidence, timestamps, sanction history |
| Powiązanie ROPA | `ROPA-06`, częściowo `ROPA-07` |
| Ryzyko | błędna decyzja, zbyt szeroki evidence scope, długotrwała stygmatyzacja/profilowanie |
| Status | `IN SCOPE / LIA REQUIRED FOR FINAL PASS` |

## PL-E04-11 — Osoby składające żądania dotyczące swoich danych

| Element | Wartość |
|---|---|
| Opis | osoby korzystające z praw dostępu, sprostowania, usunięcia, restriction, sprzeciwu lub eksportu |
| Typowe procesy | privacy request intake, identity verification, discovery, execution, proof |
| Typowe dane | subject reference, request type/status, timestamps, minimalny proof i exception/hold reference |
| Powiązanie ROPA | `ROPA-08` |
| Ryzyko | nadmierne identity proofing, tworzenie kopii dokumentów tożsamości bez potrzeby |
| Status | `IN SCOPE / IDENTITY-PROOFING MODEL PENDING` |

## PL-E04-12 — Administratorzy, moderatorzy i operatorzy systemu

| Element | Wartość |
|---|---|
| Opis | osoby wykonujące uprzywilejowane działania administracyjne, moderatorskie lub operacyjne |
| Typowe procesy | RBAC/MFA, audit, moderation, support, operations, incident handling |
| Typowe dane | actor ID, role, action, target reference, timestamps, security/audit metadata |
| Powiązanie ROPA | `ROPA-02`, `ROPA-06`, `ROPA-07` |
| Ryzyko | nadmierny monitoring pracownika/operatora, nieproporcjonalna retencja historii działań |
| Status | `IN SCOPE` |

## PL-E04-13 — Użytkownicy występujący w logach, telemetry i security events

| Element | Wartość |
|---|---|
| Opis | osoby, których identyfikatory techniczne lub sieciowe pojawiają się w logach i telemetry podczas korzystania z usługi |
| Typowe procesy | diagnostyka, security monitoring, anti-abuse, incident response |
| Typowe dane | IP/UA tam gdzie niezbędne, correlation ID, user/session reference, error/security metadata, timestamps |
| Powiązanie ROPA | `ROPA-09` |
| Ryzyko | zbędne PII w logach, nadmierna identyfikowalność, łączenie telemetry z profilem użytkownika |
| Status | `IN SCOPE / LIA + MINIMISATION REQUIRED` |

## PL-E04-14 — Osoby, których dane mogą znaleźć się w backupie lub środowisku restore

| Element | Wartość |
|---|---|
| Opis | wszystkie osoby, których aktywne rekordy objęte backupem mogą przejściowo istnieć w kopiach lub izolowanych środowiskach restore |
| Typowe procesy | backup, restore test, deletion replay, cleanup |
| Typowe dane | zakres wynika z snapshotu systemów źródłowych; nie powinien być rozszerzany |
| Powiązanie ROPA | `ROPA-10` lub sekcja backup/restore ROPA, zgodnie z wersją dokumentu |
| Ryzyko | resurrection usuniętych danych, użycie backupu jako archiwum, brak cleanup po restore |
| Status | `IN SCOPE / ARCHITECTURE PASS / OPERATIONAL EVIDENCE PENDING` |

## PL-E04-15 — Osoby trzecie występujące w treściach lub załącznikach użytkowników

| Element | Wartość |
|---|---|
| Opis | osoby niebędące aktywnymi użytkownikami, których dane mogą zostać umieszczone przez użytkownika w wiadomości, załączniku, czacie lub zgłoszeniu |
| Typowe procesy | user-generated content, messaging, reports/moderation |
| Typowe dane | zależne od treści wprowadzonej przez użytkownika; zakres nie jest kontrolowany wyłącznie przez formularz systemowy |
| Powiązanie ROPA | `ROPA-04`, `ROPA-06` |
| Ryzyko | przypadkowe lub bezprawne ujawnienie danych osób trzecich, szczególne kategorie danych w treści użytkownika |
| Zasada | system nie powinien aktywnie zachęcać do podawania danych osób trzecich; potrzebne mechanizmy zgłoszeń, moderacji i minimalizacji |
| Status | `IN SCOPE AS INCIDENTAL DATA SUBJECTS / POLICY REQUIRED` |

---

# 4. Małoletni — nierozstrzygnięta kategoria blokująca finalny PASS

## PL-E04-MINORS

Na dzień 01.09.2026 Gracz.pl **nie ma jeszcze formalnie zatwierdzonego modelu małoletnich**.

Należy jawnie zdecydować co najmniej:

1. minimalny wiek użytkownika;
2. czy usługa będzie oferowana bezpośrednio dzieciom;
3. czy i kiedy wymagana jest zgoda/autoryzacja opiekuna;
4. jak realizowane będzie age assurance bez nadmiernego zbierania danych;
5. czy profile, chat, prywatne wiadomości, social i matchmaking będą miały dodatkowe ograniczenia;
6. czy potrzebny jest odrębny DPIA lub rozszerzony screening;
7. jak będą sformułowane obowiązki informacyjne w języku odpowiednim dla wieku.

Status: **`HOLD / OWNER DECISION REQUIRED`**.

Brak tej decyzji nie uniemożliwia istnienia niniejszej mapy kategorii osób, ale uniemożliwia końcowy `PASS` PL-E04 oraz finalną akceptację ADR-V3-012.

---

# 5. Kategorie wyłączone lub niewprowadzone bez osobnej decyzji

Na obecnym etapie dokumentacja nie ustanawia jako normalnego zakresu Gracz.pl:

- danych biometrycznych do identyfikacji;
- danych zdrowotnych;
- danych dotyczących orientacji seksualnej, religii, poglądów politycznych lub pochodzenia rasowego/etnicznego;
- danych o wyrokach skazujących jako planowanej kategorii biznesowej;
- profilowania reklamowego na podstawie wrażliwych cech;
- danych płatniczych związanych z grą o realne pieniądze.

Jeśli funkcja użytkownika pozwoli wprowadzić takie dane w treści swobodnej, ich przypadkowe pojawienie się nie oznacza, że projekt może je wykorzystywać do dodatkowych celów. Wymaga to minimalizacji, ograniczenia dostępu i — gdzie potrzebne — odrębnej oceny prawnej.

---

# 6. Macierz powiązania z procesami

| Kategoria osoby | Konto/Auth | Gry/Ranking | Messaging/Chat | Newsletter | Moderacja/Audit | Privacy Requests | Logs/Backup |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rejestrujący się | ✓ |  |  | opcj. | anti-abuse |  | ✓ |
| Aktywny użytkownik | ✓ | ✓ | ✓ | opcj. | ✓ | ✓ | ✓ |
| Były/usuwany użytkownik | ✓ | ✓ historycznie | ✓ historycznie | opcj. | ✓ | ✓ | ✓ |
| Gracz | ✓ | ✓ | opcj. |  | spory | ✓ | ✓ |
| Uczestnik rankingu/turnieju | ✓ | ✓ | opcj. |  | spory | ✓ | ✓ |
| Nadawca/odbiorca wiadomości | ✓ | opcj. | ✓ |  | abuse | ✓ | ✓ |
| Użytkownik chat/social | ✓ | opcj. | ✓ |  | ✓ | ✓ | ✓ |
| Subskrybent newslettera | opcj. |  |  | ✓ | consent audit | ✓ | ✓ |
| Zgłaszający | ✓ | opcj. | opcj. |  | ✓ | ✓ | ✓ |
| Zgłaszany/moderowany | ✓ | opcj. | opcj. |  | ✓ | ✓ | ✓ |
| Osoba składająca DSAR/privacy request | może | może | może | może | może | ✓ | ✓ |
| Administrator/moderator/operator | ✓ | admin role | admin role | admin role | ✓ | własne prawa | ✓ |
| Małoletni | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | ✓ | ✓ |

---

# 7. Warunki zamknięcia PL-E04

PL-E04 może otrzymać `PASS`, gdy:

1. powyższe kategorie są zatwierdzone przez Privacy/Legal Decision Ownera;
2. model małoletnich ma formalną decyzję;
3. zakres kategorii jest spójny z ROPA i PL-E03;
4. privacy notice opisuje właściwe grupy użytkowników w sposób adekwatny do rzeczywistych procesów;
5. providery i role procesorów nie wprowadzają nowych niezinwentaryzowanych kategorii osób;
6. DPIA screening oceni wpływ na grupy potencjalnie podatne na większe ryzyko;
7. projekt nie rozszerzy kategorii danych/osób bez aktualizacji ROPA i tego evidence record.

---

# 8. Werdykt roboczy PL-E04

```text
PL-E04 = PASS WITH CONDITIONS

EVIDENCE = VERSIONED / CREATED
DATA SUBJECT CATEGORIES = MAPPED
MINORS MODEL = HOLD / OWNER DECISION REQUIRED
DPIA SCREENING = PENDING
PRIVACY NOTICE ALIGNMENT = PENDING
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
FREEZE = ACTIVE
```

Uzasadnienie: kategorie osób są jawnie zinwentaryzowane i powiązane z procesami Gracz.pl, ale finalny `PASS` jest blokowany przez nierozstrzygnięty model małoletnich oraz zależności do DPIA/privacy notice.