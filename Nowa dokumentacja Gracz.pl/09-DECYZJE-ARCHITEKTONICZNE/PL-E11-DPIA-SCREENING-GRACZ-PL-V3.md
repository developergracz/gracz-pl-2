# Gracz.pl V3 — PL-E11 DPIA screening / ocena potrzeby DPIA

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **SCREENING COMPLETED / DPIA REQUIRED BEFORE PRODUCTION / FREEZE-SAFE**  
Evidence ID: `PL-E11`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązany LIA: `PL-E10-LIA-PRAWNIE-UZASADNIONY-INTERES-GRACZ-PL-V3.md`  
Powiązany model małoletnich: `PL-E05-MALOLETNI-WIEK-ZGODY-GRACZ-PL-V3.md`

> Dokument stanowi formalny screening DPIA dla Gracz.pl V3. Jego celem jest ustalenie, czy planowane operacje przetwarzania mogą z dużym prawdopodobieństwem powodować wysokie ryzyko naruszenia praw lub wolności osób fizycznych. Screening nie jest pełną DPIA i nie zastępuje oceny skutków wymaganej przed rozpoczęciem przetwarzania wysokiego ryzyka.

---

## 1. Reguła decyzyjna

Dla Gracz.pl V3 przyjmuje się zasadę ostrożności zgodną z art. 35 RODO:

- screening jest wykonywany przed finalną akceptacją modelu Privacy/Legal;
- jeżeli charakter, zakres, kontekst i cele planowanego przetwarzania tworzą wysokie ryzyko, pełna DPIA jest obowiązkowa przed uruchomieniem takiego przetwarzania;
- przy kumulacji kilku kryteriów ryzyka nie przyjmuje się automatycznie `DPIA NOT REQUIRED`;
- jeżeli pozostają istotne wątpliwości, projekt wykonuje pełną DPIA zamiast uzasadniać jej pominięcie.

---

## 2. Zakres screeningu

Screening obejmuje projektowane procesy V3:

1. konta, profile, logowanie, sesje, recovery i MFA;
2. security telemetry, anti-abuse i wykrywanie incydentów;
3. gry, historia meczów, ranking, turnieje i potencjalne anti-cheat signals;
4. prywatne wiadomości i załączniki;
5. publiczny chat i funkcje społecznościowe;
6. moderację, zgłoszenia, sankcje i odwołania;
7. newsletter i evidence zgód;
8. audit działań uprzywilejowanych;
9. realizację praw osób;
10. backup, restore i deletion replay;
11. planowane korzystanie z zewnętrznych providerów infrastruktury i usług.

---

## 3. Kryteria ryzyka

| ID | Kryterium | Ocena dla Gracz.pl V3 | Wniosek |
|---|---|---|---|
| DPIA-K01 | systematyczna ocena / scoring / profilowanie | ranking gry sam w sobie ma charakter domenowy; security/anti-abuse i przyszły anti-cheat mogą prowadzić do oceny zachowania | `MATERIAL / DESIGN LIMITS REQUIRED` |
| DPIA-K02 | automatyczne decyzje o istotnym skutku | pełne automatyczne sankcje nie są zatwierdzone; projekt wymaga human review dla poważnych sankcji | `CONTROLLED BUT MATERIAL` |
| DPIA-K03 | systematyczne monitorowanie | logi, security events, moderation i anti-abuse mogą tworzyć szeroki obraz aktywności użytkownika | `YES / MATERIAL` |
| DPIA-K04 | dane wrażliwe / wysoce prywatne | prywatne wiadomości, MFA, security signals i moderation evidence mają podwyższoną poufność; użytkownik może sam umieścić dane szczególnej kategorii w treści | `YES / MATERIAL` |
| DPIA-K05 | duża skala | produkcyjna skala docelowa nie jest jeszcze ustalona; architektura jest projektowana do wzrostu | `PENDING / MAY BECOME MATERIAL` |
| DPIA-K06 | łączenie zbiorów danych | Identity, gry, wiadomości, chat, moderation, audit i telemetry mogą być powiązane wspólnym user ID | `YES / MATERIAL` |
| DPIA-K07 | osoby wymagające szczególnej ochrony | model dopuszcza użytkowników 16–17 lat | `YES / MATERIAL` |
| DPIA-K08 | nowe technologie / nowy model systemowy | V3 wprowadza nowy model privacy orchestration, deletion ledger, restore replay, nowe bounded contexts i przyszłe mechanizmy anti-abuse/anti-cheat | `YES / MATERIAL` |
| DPIA-K09 | ograniczenie możliwości skorzystania z prawa/usługi | moderacja/sankcje, anti-abuse i blokada konta mogą wpływać na dostęp do usługi | `YES / MATERIAL` |

---

## 4. Czynniki zwiększające ryzyko

### 4.1. Małoletni 16–17

Użytkownicy 16–17 lat są traktowani jako grupa wymagająca dodatkowych safeguards. Szczególne znaczenie mają:

- publiczny profil i ranking,
- chat i wiadomości prywatne,
- moderacja i sankcje,
- security telemetry,
- wszelkie mechanizmy profilowania lub anti-abuse.

Brak marketingowego profilowania małoletnich pozostaje zasadą projektową.

### 4.2. Prywatna komunikacja

Prywatne wiadomości i załączniki mogą zawierać bardzo prywatne informacje, także dane, których administrator nie żąda i nie powinien wykorzystywać do innych celów. Dostęp administracyjny do plaintext nie jest uprawnieniem domyślnym i wymaga osobnego, wąskiego modelu.

### 4.3. Moderacja i anti-abuse

Moderacja może prowadzić do blokady, ograniczenia funkcji lub sankcji. Mechanizmy automatyczne nie mogą stać się niejawnie jedyną podstawą poważnej decyzji bez odpowiedniego review, odwołania i wyjaśnialności.

### 4.4. Telemetry i łączenie danych

Zestawienie IP/UA, logów, historii gier, wiadomości, zachowań społecznościowych i moderation evidence może stworzyć szeroki profil aktywności. Dlatego system musi utrzymywać ścisłe purpose limitation i separation-of-use.

### 4.5. Backup i restore

Backup obejmuje potencjalnie szeroki zakres danych. Ryzykiem jest ponowne pojawienie się danych po wcześniejszym skutecznym usunięciu. Projekt deletion ledger + replay po restore jest ważnym środkiem ograniczającym ryzyko, ale wymaga późniejszego dowodu operacyjnego.

---

## 5. Czynniki ograniczające ryzyko w projekcie

Projekt przewiduje następujące safeguards:

- minimalizację danych;
- jawne klasy danych `PUBLIC / INTERNAL / PERSONAL / SENSITIVE / EVIDENCE / SECRET / ANONYMIZED`;
- osobne bounded contexts;
- RBAC i MFA dla dostępu uprzywilejowanego;
- szyfrowanie prywatnych wiadomości i zakaz plaintext w logach/audit/outbox;
- zakaz logowania haseł, tokenów, MFA secrets i innych sekretów;
- human review dla poważnych sankcji;
- procedurę odwołania;
- ograniczone okresy retencji;
- legal hold ograniczony zakresem i czasem;
- deletion ledger i anti-resurrection po restore;
- provider approval gate;
- zakaz marketingowego profilowania małoletnich;
- privacy by design/default;
- pełne prawa dostępu, sprostowania, usunięcia, restriction, sprzeciwu i eksportu zgodnie z odpowiednią podstawą.

Są to środki projektowe, nie dowód produkcyjnego wdrożenia.

---

## 6. Decyzja screeningu

Na podstawie kumulacji kryteriów, a zwłaszcza:

- użytkowników małoletnich 16–17 lat,
- prywatnej komunikacji i załączników,
- moderacji i sankcji wpływających na dostęp do usługi,
- security telemetry i anti-abuse,
- możliwości łączenia danych z wielu domen,
- projektowania systemu do wzrostu skali,
- nowego modelu V3 i zewnętrznych providerów,

przyjmuje się:

```text
DPIA SCREENING = COMPLETED
DPIA DECISION = REQUIRED BEFORE PRODUCTION
DPIA SCOPE = WHOLE V3 PRIVACY MODEL WITH DEEP-DIVE SECTIONS
DPIA NOT REQUIRED = NOT ACCEPTED
PRODUCTION PROCESSING COVERED BY V3 = MUST NOT START BEFORE REQUIRED DPIA IS COMPLETED
```

Decyzja o wykonaniu pełnej DPIA jest działaniem ostrożnym i rozliczalnym. Nie oznacza stwierdzenia, że projekt jest niedopuszczalny; oznacza, że ryzyka muszą zostać formalnie opisane, ocenione i zredukowane przed produkcyjnym użyciem.

---

## 7. Minimalny zakres pełnej DPIA

Pełna DPIA powinna co najmniej zawierać:

1. szczegółowy opis operacji i przepływów danych;
2. cele i zatwierdzone podstawy prawne;
3. ocenę niezbędności i proporcjonalności;
4. mapę osób i danych, ze szczególnym uwzględnieniem 16–17 lat;
5. prywatne wiadomości, załączniki i model dostępu administracyjnego;
6. moderację, sankcje i automatyzację decyzji;
7. security telemetry, IP/UA, anti-abuse i anti-cheat;
8. publiczny profil, ranking, chat i social exposure;
9. providerów, subprocessors i transfery poza EOG;
10. retencję, legal hold, deletion i backup/restore;
11. scenariusze szkód dla praw i wolności osób;
12. prawdopodobieństwo i wagę ryzyk przed safeguards;
13. środki techniczne i organizacyjne;
14. ryzyko rezydualne po safeguards;
15. decyzję, czy potrzebne są uprzednie konsultacje z organem nadzorczym;
16. ownerów, terminy, wersję i harmonogram ponownego review.

---

## 8. Warunki przed produkcją

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-E11-O01 | wykonać pełną DPIA dla V3 | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-E11-O02 | zatwierdzić ostateczny model małoletnich 16–17 i safeguards | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-E11-O03 | zamknąć model dostępu/moderacji prywatnych wiadomości | P1 Privacy/Legal | Privacy/Legal + Messaging/Moderation | `OPEN` |
| PL-E11-O04 | zatwierdzić zakres security telemetry / anti-abuse / anti-cheat | P1 Privacy/Legal | Privacy/Legal + Security/Game | `OPEN` |
| PL-E11-O05 | zweryfikować providerów, DPA i transfery | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-E11-O06 | ocenić ryzyko rezydualne i potrzebę art. 36 / uprzednich konsultacji | P1 Privacy/Legal | Privacy/Legal | `OPEN AFTER DPIA` |

---

## 9. Status PL-E11

```text
PL-E11 = PASS

SCREENING ARTIFACT = VERSIONED
SCREENING COMPLETED = YES
DPIA REQUIRED = YES
FULL DPIA COMPLETED = NO
FULL DPIA = P1 OPEN CONDITION BEFORE PRODUCTION
HIGH-RISK PROCESSING MAY START NOW = NO
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = NO AUTOMATIC CHANGE
FREEZE = ACTIVE
```

`PL-E11 = PASS` oznacza wyłącznie, że wymagany screening został faktycznie wykonany i ma jednoznaczny wynik. Nie oznacza, że pełna DPIA jest już zakończona ani że projekt otrzymał zgodę produkcyjną.

---

## 10. Trigger do ponownego screeningu / aktualizacji DPIA

Screening i późniejsza DPIA wymagają aktualizacji co najmniej przy:

- wprowadzeniu użytkowników poniżej 16 lat;
- zmianie modelu zgody rodzica/opiekuna;
- profilowaniu reklamowym lub behawioralnym;
- wdrożeniu automatycznych sankcji bez human review;
- istotnym rozszerzeniu anti-cheat/device fingerprinting;
- dodaniu danych lokalizacyjnych, biometrii lub danych szczególnych kategorii;
- zmianie providerów albo transferów poza EOG;
- materialnej zmianie skali użytkowników lub zakresu telemetry;
- incydencie ujawniającym nowe ryzyko;
- zmianie okresów retencji lub legal hold;
- nowej funkcji gry o realne pieniądze lub innej funkcji regulowanej.

---

## 11. Granica autoryzacji

Utworzenie PL-E11:

- nie jest pełną DPIA;
- nie zatwierdza wysokiego ryzyka jako akceptowalnego;
- nie zatwierdza automatycznych decyzji ani profilowania;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia Production V3 NO-GO.
