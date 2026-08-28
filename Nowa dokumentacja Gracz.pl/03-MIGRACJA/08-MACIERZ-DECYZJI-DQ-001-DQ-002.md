# ETAP 3 — Macierz decyzji DQ-001 / DQ-002

Data: 28.08.2026  
Status: **ARTEFAKT DECYZYJNY — BEZ DML / DDL V3 NO-GO**

## 1. Cel

Dokument stanowi pomost pomiędzy:

- rekonstrukcją przyczyny historycznego driftu danych,
- a wykonawczym planem remediation przed V3 `EXPAND -> BACKFILL -> VERIFY/RECONCILE -> CUTOVER`.

Zakres:

- **DQ-001** — orphan friendship,
- **DQ-002** — kolizje normalized-email obejmujące 5 kont.

Dokument **nie autoryzuje i nie wykonuje** żadnego `UPDATE`, `DELETE`, `MERGE`, przepięcia FK/logical refs ani produkcyjnego DDL.

---

## 2. Źródła dowodowe

Podstawa decyzji:

- środowiskowy data-quality/drill-down z Render PostgreSQL,
- `07-AUDYT-WRITEROW-I-PLAN-NAPRAWY-BLOCKEROW.md`,
- kod AS-IS `origin/main @ db3c15a`,
- historia Git writerów.

### POTWIERDZONE

- istnieje 1 orphan friendship,
- requester orphan ma principal typu `guest-*`, addressee jest kontem kanonicznym,
- `gracz_chat_friends` nie ma FK do `gracz_accounts`,
- writer `requestFriend()` nie wykonuje account-existence check,
- funkcja friendship została wprowadzona 23.08.2026 już z tą luką,
- DQ-002 po drill-down obejmuje 2 grupy normalized-email i 5 kont,
- wszystkie 5 kont powstało przed commitem `6e7a55ea8e5d2f4db4dabb2e15d1e1acb459bf1c`, który dodał guard unique-email,
- najpóźniejsze z 5 kont powstało około 11 min 33 s przed commitem guardu,
- obecny writer standardowej rejestracji/profile update blokuje nową kolizję po `trim().toLowerCase()`.

### WYMAGA DALSZEGO DOWODU

- źródło i lifecycle principalu `guest-*`,
- czy guest powinien mieć trwałą tożsamość produktową,
- czy konkretny orphan można jednoznacznie przypiąć do istniejącego konta,
- czy któreś z 5 kont należą do tej samej osoby,
- status biznesowy kont: główne / poboczne / testowe / legacy,
- dokładny deploy/endpoint odpowiadający za każdy historyczny zapis.

---

# CZĘŚĆ A — DQ-001 ORPHAN FRIENDSHIP

## 3. Stan problemu

Rekord friendship zawiera requestera, którego nie ma w `gracz_accounts`.

Przyczyna klasy architektonicznej jest znana: writer oraz schemat pozwalały zapisać relację bez referencyjnej walidacji obu stron.

Nie jest natomiast jeszcze udowodniona geneza samego `guest-*`.

## 4. Warianty decyzji DQ-001

| Wariant | Kiedy dopuszczalny | Działanie przyszłe | Ryzyko | Ocena |
|---|---|---|---|---|
| **MAP-TO-CANONICAL** | Tylko gdy audit/session/deploy evidence jednoznacznie wskaże konto | Przepięcie requestera z zachowaniem provenance i audytu | Błędne przypisanie relacji innej osobie | Warunkowo dopuszczalny |
| **LEGACY-QUARANTINE** | Gdy brak jednoznacznego mapowania | Zachować rekord historycznie, wyłączyć z backfillu V3 | Brak relacji w aktywnym grafie V3 | **Domyślny bezpieczny wariant** |
| **DELETE-AS-INVALID** | Tylko po formalnym potwierdzeniu, że rekord jest błędny i bez wartości historycznej | Kontrolowany DELETE dopiero w remediation/CONTRACT | Utrata śladu historycznego | Nie teraz |
| **PERSISTENT-GUEST-IDENTITY** | Tylko jeśli produkt świadomie zatwierdzi trwałych guestów | Osobny model Identity/Principal Type dla guestów | Znaczne zwiększenie złożoności Identity/Social | Nie rekomendować bez wymagania biznesowego |

## 5. Macierz decyzji DQ-001

| Pole | Stan obecny | Decyzja robocza |
|---|---|---|
| Requester istnieje w accounts | Nie | BLOCKER |
| Addressee istnieje w accounts | Tak | PASS |
| Jednoznaczne mapowanie guest -> konto | Niepotwierdzone | Nie wykonywać UPDATE |
| Wartość historyczna rekordu | Możliwa | Zachować provenance |
| Backfill do canonical Social V3 | Niedozwolony wprost | Wyłączyć do czasu decyzji |
| Fizyczne usunięcie | Brak autoryzacji | Nie wykonywać |
| Docelowy writer | Musi walidować obie strony | Wymagane przed cutover |
| Docelowa integralność | Canonical Identity + constraint/FK | Dopiero po remediation |

## 6. Kryterium decyzji DQ-001

Preferowana kolejność:

1. znaleźć źródło `guest-*`,
2. ustalić, czy istnieje wiarygodne mapowanie do konta,
3. przy dowodzie — `MAP-TO-CANONICAL`,
4. bez dowodu — `LEGACY-QUARANTINE`,
5. DELETE dopiero jako późniejsza, osobno zatwierdzona operacja.

---

# CZĘŚĆ B — DQ-002 NORMALIZED-EMAIL COLLISIONS

## 7. Zasada nadrzędna

Wspólny normalized-email **nie jest dowodem wspólnej tożsamości osoby**.

Dlatego:

- brak automatycznego MERGE,
- brak automatycznego DELETE,
- brak wyboru konta tylko na podstawie `created_at`,
- brak wyboru konta tylko dlatego, że ma najwięcej danych,
- brak V3 UNIQUE, dopóki konflikt nie zostanie rozwiązany.

Dodatkowo password recovery pozostaje ryzykowne, ponieważ historyczny konflikt e-mail może powodować niejednoznaczność wyboru konta.

## 8. Grupy DQ-002 po drill-down

### Grupa A

- `gamerpl`
- `gamerde`

### Grupa B

- `gracz.pl`
- `gamerpolska`
- `gamer`

Adresów e-mail nie zapisujemy w tym dokumencie. Pracujemy na identyfikatorach kont i grupach kolizji.

---

## 9. Macierz per konto

Legenda statusów decyzji:

- **TBD-BUSINESS** — wymaga decyzji biznesowej użytkownika/właściciela systemu,
- **TBD-EVIDENCE** — wymaga dowodu technicznego/audytowego,
- **SAFE-DEFAULT** — bezpieczna decyzja domyślna przy braku dodatkowych dowodów.

| Konto | Grupa | Status biznesowy | Powiązane dane potwierdzone w drill-down | Kandydat remediation | Ryzyko dla użytkownika | UX / komunikacja | Status decyzji |
|---|---|---|---|---|---|---|---|
| `gamerpl` | A | TBD | konto ma realną historię aktywności | KEEP-CANONICAL **lub** REQUIRE-EMAIL-CHANGE | utrata dostępu do recovery / pomyłka tożsamości | przy zmianie e-mail: ponowna weryfikacja i jasny komunikat | TBD-BUSINESS + TBD-EVIDENCE |
| `gamerde` | A | TBD | konto ma realną historię aktywności | KEEP-CANONICAL **lub** REQUIRE-EMAIL-CHANGE | jak wyżej | jak wyżej | TBD-BUSINESS + TBD-EVIDENCE |
| `gracz.pl` | B | TBD | konto ma realną historię aktywności | KEEP-CANONICAL **lub** REQUIRE-EMAIL-CHANGE | jak wyżej | jak wyżej | TBD-BUSINESS + TBD-EVIDENCE |
| `gamerpolska` | B | TBD | konto ma realną historię aktywności | KEEP-CANONICAL **lub** REQUIRE-EMAIL-CHANGE / LEGACY-IDENTITY | jak wyżej | jak wyżej | TBD-BUSINESS + TBD-EVIDENCE |
| `gamer` | B | TBD | konto ma realną historię aktywności | KEEP-CANONICAL **lub** REQUIRE-EMAIL-CHANGE / LEGACY-IDENTITY | jak wyżej | jak wyżej | TBD-BUSINESS + TBD-EVIDENCE |

### Uwaga

Drill-down wykazał zależności obejmujące klasy danych takie jak:

- sesje auth,
- prywatne wiadomości,
- reset tokeny,
- registration codes.

Nie należy na tej podstawie przypisywać identycznego zestawu zależności każdemu z pięciu kont, jeśli nie ma osobnego dowodu per konto. Macierz ma zostać uzupełniona per-account evidence przed wykonawczym DML.

---

## 10. Dozwolone polityki remediation DQ-002

### A. KEEP-CANONICAL

Jedno konto w danej grupie zachowuje dany canonical normalized-email.

Warunki:

- istnieje uzasadnienie biznesowe i techniczne,
- konto ma potwierdzone prawo do kanału kontaktowego,
- pozostałe konta nie są automatycznie usuwane.

### B. REQUIRE-EMAIL-CHANGE

Konto pozostaje pełnoprawnym kontem z całą historią, ale konfliktujący e-mail nie może pozostać canonical.

Możliwe wykonanie przyszłe:

- oznaczenie stanu `email_reverification_required`,
- przy następnym bezpiecznym logowaniu wymuszenie podania innego e-maila,
- nowy e-mail musi przejść weryfikację,
- do czasu rozwiązania konfliktu recovery po konflikującym e-mailu nie może być użyte do wyboru konta.

To jest preferowany wariant, gdy konta są niezależne i wszystkie mają zachować historię.

### C. LEGACY-IDENTITY

Konto i historia są zachowane, ale konto nie posiada aktywnego canonical e-mail do czasu ponownej weryfikacji lub decyzji właściciela.

Przydatne dla kont nieaktywnych/testowych, ale wymaga potwierdzenia statusu biznesowego.

### D. MERGE

Najwyższe ryzyko.

Dopuszczalne tylko, gdy:

- istnieje silny dowód, że konta należą do tej samej osoby,
- właściciel systemu zatwierdzi scalenie,
- istnieje pełna mapa przepięcia wszystkich zależności,
- zachowany zostanie immutable audit/provenance,
- przygotowany jest rollback/reconciliation plan.

**MERGE nie jest decyzją domyślną.**

---

## 11. Jak wybrać canonical account w grupie

Nie stosować pojedynczego heurystycznego kryterium.

Macierz dowodowa dla każdej grupy powinna zawierać:

1. `created_at` i lineage,
2. `contact_verified` / kanał weryfikacji,
3. ostatnie bezpieczne logowanie / aktywność,
4. aktywne i historyczne sesje,
5. prywatne wiadomości i inne zależności,
6. reset tokeny i registration codes,
7. audit events rejestracji i zmian profilu,
8. status biznesowy konta,
9. dowód kontroli nad adresem kontaktowym,
10. ewentualne zależności spoza Identity.

Decyzja canonical musi być audytowalna.

---

## 12. Ryzyko UX i bezpieczeństwa

### Najważniejsze ryzyka

- użytkownik może stracić recovery do prawidłowego konta,
- system może wysłać kod resetu w kontekście niewłaściwego konta,
- automatyczny merge może zmieszać historię dwóch niezależnych profili,
- automatyczny delete może usunąć wiadomości/sesje/historię,
- cichy reset e-maila może być odebrany jako przejęcie konta.

### Zasada UX remediation

Jeśli remediation będzie widoczna dla użytkownika:

- nie ujawniać istnienia innych kont ani ich nazw w komunikacie,
- komunikat powinien mówić o konieczności ponownej weryfikacji danych kontaktowych,
- nie blokować dostępu do historii bez wyraźnej przyczyny bezpieczeństwa,
- zmiana e-maila powinna wymagać zalogowanej sesji lub równoważnej silnej weryfikacji,
- wszystkie administracyjne wyjątki audytować.

---

## 13. Proponowana decyzja robocza przed zebraniem pełnego evidence

### DQ-001

**SAFE-DEFAULT: `LEGACY-QUARANTINE`**, chyba że odnajdziemy jednoznaczne mapowanie guest -> canonical account.

### DQ-002

**SAFE-DEFAULT: NIE SCALAĆ.**

Dla każdej grupy:

- wybrać maksymalnie jedno `KEEP-CANONICAL` dopiero po evidence,
- pozostałe aktywne, niezależne konta kierować do `REQUIRE-EMAIL-CHANGE`,
- `LEGACY-IDENTITY` tylko po potwierdzeniu statusu legacy/test/inactive,
- `MERGE` wyłącznie jako jawny wyjątek z pełnym planem.

---

## 14. Warunki przed wykonawczym PLAN DML

Nie tworzyć produkcyjnego remediation scriptu, dopóki nie ma:

- decyzji DQ-001,
- decyzji per-account dla wszystkich 5 kont,
- snapshotu zależności per konto,
- backup + restore test,
- planu rollback,
- zasady recovery podczas remediation,
- planu audytu zmian,
- fresh data-quality rerun tuż przed wykonaniem.

---

## 15. Warunki dopuszczenia V3 UNIQUE/FK

### DQ-001 / Social

Przed FK/canonical reference:

- brak nieobsłużonych orphanów,
- wszystkie aktywne relations wskazują istniejące canonical identities,
- writer nie pozwala tworzyć nowych orphanów,
- VERIFY daje 0 naruszeń.

### DQ-002 / Identity

Przed `UNIQUE(email_normalized)`:

- każda grupa kolizji ma wykonane remediation,
- istnieje najwyżej jedno aktywne canonical normalized-email,
- password recovery jest jednoznaczne,
- backfill `email_normalized` jest deterministyczny,
- duplicate query zwraca 0 konfliktów,
- constraint może zostać dodany bez utraty danych.

---

## 16. Formalny status

**DDL V3: NO-GO.**

Powód:

- DQ-001 — decyzja dotycząca orphan friendship / guest principal niezamknięta,
- DQ-002 — decyzja per-account dla 5 kont niezamknięta.

DQ-003 pozostaje REVIEW/provenance i nie jest w tej chwili głównym blockerem Identity/Social DDL, ale musi zostać zachowane poprawne mapowanie consent lifecycle.

Następny krok po tym dokumencie:

1. domknięcie źródła `guest-*`,
2. zebranie privacy-safe per-account evidence dla pięciu kont,
3. zatwierdzenie polityki dla każdego rekordu,
4. dopiero potem przygotowanie osobnego **PLANU DML REMEDIATION** — nadal bez automatycznego wykonania na produkcji.