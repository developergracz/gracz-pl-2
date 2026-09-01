# Gracz.pl V3 — PL-E07 Odbiorcy, procesorzy i transfery danych

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E07`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązana mapa celów/podstaw: `PL-E03-MAPA-CELOW-I-PODSTAW-PRAWNYCH-GRACZ-PL-V3.md`  
Powiązana klasyfikacja danych: `PL-E06-KLASYFIKACJA-DANYCH-I-ZAKRES-DANYCH-OSOBOWYCH-GRACZ-PL-V3.md`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Dokument stanowi formalny artefakt evidence dla PL-E07. Inwentaryzuje odbiorców danych, potencjalnych procesorów/subprocesorów oraz obszary wymagające oceny transferów poza EOG. Nie jest opinią prawną, nie potwierdza aktualnej konfiguracji produkcyjnej ani treści umów dostawców. Każda pozycja oznaczona `TO VERIFY`, `PENDING` albo `NOT APPROVED` wymaga weryfikacji przed produkcyjnym uruchomieniem V3.

---

## 1. Administrator

| Pole | Wartość |
|---|---|
| Administrator | **Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu** |
| Projekt | `Gracz.pl` |
| Jurysdykcja review | Polska / UE — RODO/GDPR |
| Privacy/Legal Decision Owner | Czesław Socha |
| Implementacja/deployment | `NOT AUTHORIZED / FREEZE ACTIVE` |

---

## 2. Definicje robocze

Na potrzeby tego rejestru:

- **odbiorca** — podmiot lub osoba, której dane osobowe są ujawniane w ramach konkretnej funkcji;
- **procesor** — dostawca przetwarzający dane w imieniu administratora na podstawie zatwierdzonej relacji i instrukcji;
- **subprocesor** — dalszy dostawca wykorzystywany przez procesora;
- **transfer poza EOG** — udostępnienie lub dostęp do danych w sposób wymagający oceny mechanizmu transferowego zgodnie z RODO;
- **provider approval gate** — zakaz użycia dostawcy do przetwarzania danych osobowych do czasu zweryfikowania roli, DPA/umowy, lokalizacji, subprocesorów, bezpieczeństwa, retencji/usuwania oraz transferów.

Sama nazwa dostawcy w architekturze nie oznacza formalnego zatwierdzenia go jako procesora.

---

## 3. Macierz odbiorców i procesorów

| ID | Podmiot / kategoria | Funkcja | Kategorie danych | Rola wstępna | Transfer poza EOG | DPA / umowa | Subprocesorzy | Status |
|---|---|---|---|---|---|---|---|---|
| PL-E07-P01 | **Render** | hosting runtime / PostgreSQL / infrastruktura V3 zgodnie z obecnym projektem | konta, dane domenowe, logi techniczne, potencjalnie wiadomości i evidence zależnie od konfiguracji | `PROCESSOR CANDIDATE — TO VERIFY` | `TO VERIFY` | `TO VERIFY` | `TO VERIFY` | `CONDITIONAL / NOT YET APPROVED FOR FINAL V3` |
| PL-E07-P02 | **Cloudflare** | DNS, TLS, edge, security/routing | adresy IP i request metadata na edge; ewentualnie inne dane zależnie od konfiguracji | `PROCESSOR / INDEPENDENT ROLE DEPENDS ON SERVICE — TO VERIFY` | `TO VERIFY` | `TO VERIFY` | `TO VERIFY` | `CONDITIONAL / ROLE AND SERVICE SCOPE TO VERIFY` |
| PL-E07-P03 | provider poczty transakcyjnej / newslettera | rejestracja, recovery, newsletter, delivery telemetry | e-mail, token delivery metadata, campaign/lifecycle data | `PENDING PROVIDER SELECTION` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |
| PL-E07-P04 | object storage / attachment storage | załączniki wiadomości i inne pliki użytkowników | pliki, metadata, owner/recipient refs | `PENDING PROVIDER SELECTION` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |
| PL-E07-P05 | observability / logging provider | logi, metryki, traces, alerting | techniczne metadata; PII tylko gdy niezbędne i jawnie dopuszczone | `PENDING PROVIDER SELECTION / MAY BE SELF-HOSTED` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |
| PL-E07-P06 | provider MFA / SMS, jeśli kiedykolwiek użyty | drugi składnik / delivery | numer telefonu lub identyfikator kanału, delivery metadata | `NOT CURRENTLY APPROVED` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |
| PL-E07-P07 | provider anty-abuse / CAPTCHA, jeśli użyty | ochrona formularzy i nadużyć | IP, device/browser metadata, challenge metadata | `PENDING / SERVICE-SPECIFIC ROLE` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |

---

## 4. Odbiorcy funkcjonalni niebędący dostawcami infrastruktury

### PL-E07-R01 — odbiorca prywatnej wiadomości

Dane wiadomości mogą być ujawnione wyłącznie adresatowi oraz technicznie niezbędnym komponentom przetwarzającym je zgodnie z uprawnieniem. Nadawca i odbiorca nie otrzymują dostępu do innych skrzynek ani pełnych danych drugiej strony ponad zakres funkcji komunikacji.

### PL-E07-R02 — publiczni użytkownicy Gracz.pl

Mogą otrzymywać wyłącznie dane jawnie przeznaczone do publikacji, np. publiczną nazwę profilu, ranking, wynik lub treść publicznego chatu. Dane konta, e-mail, sekrety, prywatne wiadomości, adresy IP, dane MFA oraz niejawne evidence nie są odbiorcami publicznymi.

### PL-E07-R03 — administrator/moderator

Dostęp tylko w modelu need-to-know/RBAC do zakresu wymaganego do konkretnej operacji moderacyjnej, bezpieczeństwa lub obsługi privacy request. Uprzywilejowany dostęp musi być audytowalny.

### PL-E07-R04 — organy publiczne / obowiązek prawny

Ujawnienie może nastąpić wyłącznie na podstawie konkretnego, zweryfikowanego obowiązku lub prawnie skutecznego żądania. Ten dokument nie ustanawia automatycznej podstawy do udostępniania danych żadnemu organowi.

---

## 5. Minimalny pakiet weryfikacyjny dostawcy

Przed uznaniem providera za `APPROVED` należy posiadać i zapisać co najmniej:

1. pełną nazwę prawną podmiotu;
2. rolę: procesor / współadministrator / odrębny administrator / inna;
3. opis usług i zakres danych;
4. DPA albo inny wymagany kontrakt przetwarzania;
5. listę lub mechanizm identyfikacji subprocesorów;
6. regiony przetwarzania i storage;
7. informację o zdalnym dostępie spoza EOG;
8. mechanizm transferowy, jeśli wymagany;
9. zasady retencji, zwrotu i usuwania danych po zakończeniu usługi;
10. obsługę backupów po usunięciu danych;
11. środki bezpieczeństwa i proces zgłaszania incydentów;
12. możliwość realizacji praw osób i privacy deletion;
13. ownera decyzji i datę akceptacji;
14. locator do dowodów/umowy bez publikowania sekretów ani danych niejawnych.

Brak któregokolwiek materialnego elementu skutkuje `HOLD` dla danego providera.

---

## 6. Transfery poza EOG — zasada review

Nie przyjmuje się ani `YES`, ani `NO` wyłącznie na podstawie nazwy dostawcy lub wybranego regionu infrastruktury.

Dla każdego providera należy ustalić osobno:

- gdzie fizycznie lub logicznie przetwarzane są dane;
- gdzie znajduje się support/operations access;
- czy subprocesor może uzyskać dostęp spoza EOG;
- czy istnieje mechanizm transferowy wymagany przez RODO;
- czy potrzebna jest dodatkowa ocena ryzyka transferu;
- czy konfiguracja pozwala ograniczyć region lub zakres danych;
- czy administrator może wykonać skuteczne usunięcie i uzyskać odpowiednie potwierdzenie.

Do czasu wykonania tej analizy status transferu pozostaje `TO VERIFY`, a nie `NO TRANSFER`.

---

## 7. Zasady projektowe dotyczące providerów

1. Provider nie może otrzymywać danych „na zapas”.
2. Wysyłany zakres danych musi odpowiadać celowi konkretnej integracji.
3. Sekrety, tokeny i klucze nie mogą trafiać do logów ani zwykłych evidence artifacts.
4. Prywatne wiadomości nie mogą być kopiowane do observability ani providerów, którzy nie są konieczni do realizacji funkcji.
5. Provider newslettera nie otrzymuje danych konta niewymaganych do wysyłki.
6. Object storage musi wspierać kontrolę dostępu i deletion workflow zgodny z party-state oraz legal hold.
7. Zmiana providera lub subprocesora wymaga aktualizacji PL-E07, ROPA i privacy notice, jeśli zmiana wpływa na obowiązek informacyjny.
8. Nowy provider nie może wejść do produkcyjnego przepływu danych tylko dlatego, że został dodany do kodu lub konfiguracji.
9. Provider musi być objęty planem offboardingu i potwierdzenia usunięcia/zwrotu danych.
10. Backup providera nie może być traktowany jako ukryte archiwum bezterminowe.

---

## 8. Otwarte ustalenia

| ID | Ustalenie | Severity | Owner | Status |
|---|---|---|---|---|
| PL-E07-O01 | Render — potwierdzić DPA, legal entity, regiony, subprocessors i mechanizmy transferowe | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-E07-O02 | Cloudflare — potwierdzić dokładne używane usługi, rolę, DPA, subprocessors i transfery | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-E07-O03 | Wybrać i zatwierdzić provider poczty/newslettera przed jego produkcyjnym użyciem | P1 Privacy/Legal | Privacy/Legal + Technical Owner | `OPEN` |
| PL-E07-O04 | Wybrać i zatwierdzić object storage dla załączników przed produkcyjnym użyciem | P1 Privacy/Legal | Privacy/Legal + Messaging Owner | `OPEN` |
| PL-E07-O05 | Ustalić docelowy model observability i zakres PII w telemetry | P1 Privacy/Legal | Privacy/Legal + Security/Operations | `OPEN` |
| PL-E07-O06 | Zbudować trwały rejestr zatwierdzonych providerów i subprocesorów z datami review | P2 Governance | Privacy/Legal Decision Owner | `OPEN` |

---

## 9. Ocena PL-E07

```text
PL-E07 = PASS WITH CONDITIONS

EVIDENCE = VERSIONED
CURRENT PROVIDERS = IDENTIFIED AT ARCHITECTURE LEVEL
RENDER = CONTRACT / REGION / TRANSFER VERIFICATION OPEN
CLOUDFLARE = SERVICE ROLE / CONTRACT / TRANSFER VERIFICATION OPEN
EMAIL PROVIDER = NOT SELECTED / NOT APPROVED
OBJECT STORAGE = NOT SELECTED / NOT APPROVED
OBSERVABILITY PROVIDER = NOT SELECTED / NOT APPROVED
UNVERIFIED PROVIDER MAY ENTER PRODUCTION = NO
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Warunkiem pełnego `PASS` jest zamknięcie weryfikacji faktycznie używanych providerów, ich umów/DPA, subprocesorów, lokalizacji i transferów oraz zapisanie durable evidence locatorów.

---

## 10. Relacja do kolejnych evidence

- `PL-E08` powinien potwierdzić umowy powierzenia / instrukcje dla procesorów tam, gdzie są wymagane;
- `PL-E09` powinien odzwierciedlić zatwierdzonych odbiorców i transfery w privacy notice;
- `PL-E13` i `PL-E15` muszą zachować spójność z provider retention, backup i deletion;
- każda zmiana dostawcy po finalnym review wymaga ponownego przeglądu odpowiednich części ROPA.

---

## 11. Granica autoryzacji

Utworzenie tego artefaktu:

- nie zatwierdza żadnego nowego providera,
- nie zmienia konfiguracji Render ani Cloudflare,
- nie zawiera zgody na nowe transfery danych,
- nie autoryzuje implementacji ani deploymentu,
- nie zdejmuje freeze.
