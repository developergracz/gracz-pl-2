# ETAP 4 — E4.1-H Fresh Crypto Decryptability — Freeze-Safe Execution Plan

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **PLAN READY / DO NOT EXECUTE / FREEZE ACTIVE / E4.1-H PENDING**  
Production V3: **NO-GO**

> Ten dokument jest wyłącznie planem przyszłej kontroli read-only. Nie autoryzuje uruchomienia usługi, deployu, restartu, zmian Render environment, kopiowania kluczy, odczytu wartości sekretów, migratora apply ani jakiejkolwiek produkcyjnej operacji DDL/DCL/DML.

## 1. Punkt wejścia

Obowiązujący stan przed przygotowaniem planu:

```text
F0–F7 PASS / E4.1-H PENDING / FREEZE ACTIVE
```

Kanoniczny dziennik wykonawczy:

- `62-ETAP4-E4.1-F-RESTORE-VALIDATION-EXECUTION-LOG.md`,
- commit dokumentujący HOLD E4.1-H: `b9e84d5a71af7d04bd8730a56094e8bf90152f1e`,
- PR #26: `OPEN / DRAFT / NOT MERGED`,
- zamrożony head PR #26: `cb073bad3050ffc9726e0a1528c2ec4a4808f12e`.

## 2. Potwierdzone dowody wejściowe

### 2.1. Restore i reconciliation

- restore świeżego backupu: `PASS / EXIT 0`,
- tabele restore: `28/28`,
- produkcja: `28` tabel,
- restore: `28` tabel,
- produkcja: `17,711` rekordów,
- restore: `17,711` rekordów,
- różnice tabelaryczne: `0`,
- produkcyjne połączenie kontrolne: `SSL ON / READ ONLY / ROLLBACK`.

### 2.2. Struktura crypto na świeżym restore

- wiadomości ogółem: `5`,
- encrypted message pairs `enc:v1`: `2`,
- legacy/non-prefixed message pairs: `3`,
- mixed encrypted/plain pairs: `0`,
- załączniki ogółem: `2`,
- strukturalnie poprawne załączniki: `2`,
- legacy-AAD attachments: `2`,
- strukturalnie niepoprawne załączniki: `0`,
- MFA: `0 / N/A`.

### 2.3. Historyczna Bramka 11

Historyczny runtime self-check potwierdził:

- wiadomości: `5/5 success / 0 failure`,
- załączniki: `2/2 success / 0 failure`,
- MFA: `0 / N/A`,
- plaintext, AAD i klucze nie zostały wypisane.

Ten wynik pozostaje ważnym historycznym dowodem funkcjonalnym, lecz nie jest przedstawiany jako świeże potwierdzenie E4.1-H.

## 3. Cel E4.1-H

Świeżo potwierdzić, że aktualny materiał kluczowy runtime potrafi odczytać wszystkie oczekiwane dane v1 bez:

- ujawniania kluczy,
- kopiowania sekretów poza zatwierdzony runtime,
- wypisywania plaintextów,
- modyfikowania ciphertextów,
- uruchamiania normalnego writera,
- naruszania freeze.

## 4. Powód bieżącego HOLD

E4.1-H pozostaje `PENDING`, ponieważ:

1. usługa `gracz-checkers-test` jest zawieszona zgodnie z freeze,
2. tymczasowa ścieżka wcześniejszego runtime self-checka została prawidłowo usunięta,
3. wznowienie normalnej aplikacji mogłoby uruchomić writer lub background jobs,
4. kopiowanie produkcyjnych kluczy do lokalnego środowiska narusza przyjętą granicę bezpieczeństwa,
5. nie istnieje jeszcze zatwierdzona, reviewowana ścieżka jednorazowego uruchomienia diagnostycznego z aktualnym key material bez startu aplikacji.

HOLD jest kontrolą bezpieczeństwa, a nie błędem danych ani kryptografii.

## 5. Preferowana przyszła metoda

Preferowana jest **provider-side isolated diagnostic execution** wykorzystująca istniejący materiał kluczowy wewnątrz Render, ale bez uruchamiania normalnego entrypointu aplikacji.

Metoda może zostać użyta dopiero po formalnym zatwierdzeniu i musi jednocześnie spełnić wszystkie warunki:

1. oddzielne, kontrolowane okno operacyjne,
2. utrzymany maintenance/mutation lock,
3. `Auto-Deploy = Off`,
4. brak publicznego ruchu do diagnostycznego procesu,
5. brak startu normalnego writera, listenera HTTP, background jobs i webhook consumers,
6. zatwierdzony source SHA oraz zrecenzowany skrypt diagnostyczny,
7. połączenie DB wymuszające read-only,
8. transakcja `REPEATABLE READ READ ONLY`,
9. zakończenie przez `ROLLBACK`,
10. output ograniczony do liczników i statusów,
11. brak wartości sekretów, fingerprintów kluczy, plaintextów, AAD i connection stringów,
12. pełny cleanup procesu diagnostycznego po capture wyniku.

Jeśli Render nie zapewnia bezpiecznej izolowanej ścieżki spełniającej wszystkie warunki, E4.1-H pozostaje `HOLD`.

## 6. Czynności jawnie zabronione

Bez osobnej formalnej autoryzacji nie wolno:

- kopiować `AUTH_SECRET`, `MESSAGE_ENCRYPTION_KEY`, `ATTACHMENT_ENCRYPTION_KEY` ani `MFA_ENCRYPTION_KEY`,
- ujawniać lub fotografować wartości Render Environment,
- zapisywać sekretów w PowerShell history, pliku, GitHubie lub czacie,
- przekazywać sekretów przez argumenty command line,
- wznawiać zawieszonej aplikacji,
- wykonywać deployu lub restartu,
- zmieniać Render Environment,
- zmieniać `DATABASE_URL`,
- modyfikować produkcyjne dane lub ciphertext,
- wykonywać DDL/DCL/DML,
- scalać albo wdrażać PR #26.

## 7. Wymagany kontrakt testu

Test musi sprawdzić wyłącznie:

### Messages

- total,
- encrypted records,
- legacy expected,
- decrypt success,
- decrypt failure,
- status.

### Attachments

- total,
- current-AAD count,
- legacy-AAD count,
- decrypt success,
- decrypt failure,
- status.

### MFA

- total,
- decrypt success,
- decrypt failure,
- status `PASS` albo `N/A`.

Dozwolony wynik końcowy:

```json
{
  "test": "e4.1-h-fresh-crypto-decryptability",
  "readOnly": true,
  "messages": {
    "total": 5,
    "success": 5,
    "failure": 0,
    "status": "PASS"
  },
  "attachments": {
    "total": 2,
    "success": 2,
    "failure": 0,
    "status": "PASS"
  },
  "mfa": {
    "total": 0,
    "success": 0,
    "failure": 0,
    "status": "N/A"
  },
  "e41hCandidate": "PASS"
}
```

Wartości plaintext, ciphertext, kluczy, AAD, haseł i connection strings nie mogą wystąpić w wyniku.

## 8. Kryteria PASS

E4.1-H może otrzymać `PASS` tylko wtedy, gdy:

1. target identity jest jednoznacznie potwierdzone,
2. `readOnly = true`,
3. wszystkie oczekiwane encrypted message records są decryptable,
4. wszystkie oczekiwane attachments są decryptable,
5. `failure = 0`,
6. MFA odpowiada aktualnemu stanowi DB,
7. nie zalogowano plaintextów ani sekretów,
8. nie wykonano mutacji,
9. freeze/mutation lock nie został naruszony,
10. cleanup procesu diagnostycznego został potwierdzony.

## 9. Kryteria ABORT

Natychmiastowy `ABORT / HOLD` powoduje:

- brak gwarancji read-only,
- niezgodna tożsamość targetu,
- choć jeden decrypt failure,
- próba startu normalnej aplikacji,
- aktywny writer lub background job,
- konieczność skopiowania sekretu poza Render,
- sekret lub plaintext w output,
- niezatwierdzony source SHA,
- jakakolwiek mutacja środowiska lub danych poza formalnie zatwierdzonym zakresem.

## 10. Cleanup po przyszłym teście

Po zakończeniu zatwierdzonego testu należy potwierdzić:

- proces diagnostyczny zakończony,
- brak aktywnego procesu pomocniczego,
- brak tymczasowego kodu w aktywnym obrazie,
- brak zmiany Render Environment,
- brak zmiany sekretów,
- brak zmiany produkcyjnej bazy,
- freeze nadal aktywny albo formalnie przywrócony,
- wynik zapisany wyłącznie jako privacy-safe evidence.

## 11. Decyzja bieżąca

```text
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Plan jest gotowy, lecz nie jest autoryzacją wykonania.

Następny krok operacyjny może nastąpić wyłącznie po zatwierdzeniu metody spełniającej wszystkie warunki z sekcji 5. Do tego czasu nie wykonywać żadnych kliknięć, deployów, restartów ani operacji na sekretach.


## 12. Pakiet dokumentacyjny E4.1-H

Plan jest częścią spójnego pakietu:

1. `63-ETAP4-E4.1-H-FRESH-CRYPTO-DECRYPTABILITY-EXECUTION-PLAN.md` — cel, granice i kryteria,
2. `64-ETAP4-E4.1-H-CRYPTO-DIAGNOSTIC-ARCHITECTURE-DECISION.md` — wybór wzorca provider-side isolated diagnostic,
3. `65-ETAP4-E4.1-H-OPERATOR-RUNBOOK.md` — sekwencja operatorska, STOP/ABORT i cleanup,
4. `66-ETAP4-E4.1-H-EVIDENCE-CONTRACT-AND-REVIEW-CHECKLIST.md` — schema wyniku i niezależny review,
5. `67-ETAP4-E4.1-H-RENDER-PROVIDER-CAPABILITY-ASSESSMENT.md` — weryfikacja ograniczeń planu Free i wariantów wykonania,
6. `68-ETAP4-E4.1-H-DIAGNOSTIC-COLLECTOR-DESIGN-SPECIFICATION.md` — szczegółowy kontrakt przyszłego kolektora,
7. `69-ETAP4-E4.1-H-CHANGE-AUTHORIZATION-EXECUTION-WINDOW-ROLLBACK-CLEANUP-CONTRACT.md` — formalne zgody A1–A3, okno, rollback i cleanup,
8. `70-ETAP4-E4.1-H-RISK-REGISTER-AND-IMPLEMENTATION-READINESS-MATRIX.md` — 45 ryzyk, ownership i macierze gotowości A1–A3,\n9. `71-ETAP4-E4.1-H-RENDER-POSTGRES-CONTINUITY-AND-RETENTION-PLAN.md` — plan ochrony bazy przed expiry i treatment `RSK-E41H-009`.

Status pakietu:

```text
DOCUMENTATION PACKAGE = READY
PROVIDER CAPABILITY = BLOCKED BY CURRENT FREE PLAN
COLLECTOR DESIGN = READY
COLLECTOR IMPLEMENTATION = NOT AUTHORIZED
AUTHORIZATION CONTRACT = READY / A1-A3 NOT AUTHORIZED
RISK REGISTER = READY / CRITICAL RISKS OPEN
EXECUTION = NOT AUTHORIZED
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
```

Utworzenie pakietu nie zmienia statusu operacyjnego i nie stanowi zgody na wykonanie testu.


## 13. Zależność ciągłości bazy — dokument 71

E4.1-H zależy od zachowania dostępnego i odtwarzalnego datasetu. Plan:

- `71-ETAP4-E4.1-H-RENDER-POSTGRES-CONTINUITY-AND-RETENTION-PLAN.md`

ustanawia ścieżkę decyzji przed wskazanym expiry 21.09.2026, lecz nie autoryzuje backupu, upgrade, restore ani cutover.

Dopóki `RSK-E41H-009` jest otwarte:

```text
A2 READINESS = BLOCKED
A3 READINESS = BLOCKED
E4.1-H = PENDING / SAFE HOLD
```
