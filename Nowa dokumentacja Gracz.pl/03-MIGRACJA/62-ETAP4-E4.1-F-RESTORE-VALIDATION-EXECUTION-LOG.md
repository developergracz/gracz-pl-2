# ETAP 4 — E4.1-F Restore Validation — Execution Log

Data przygotowania: 30.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **IN PROGRESS / F0 TARGET IDENTITY PASS / RESTORE NOT RUN**  
Production V3: **NO-GO**

> Ten dziennik przygotowuje wyłącznie kontrolowane odtworzenie backupu E4.1-E na izolowanym celu non-production. Nie autoryzuje restore do produkcji, połączenia z produkcyjną bazą, migratora apply, DDL/DCL/DML na produkcji, zmian ról/ACL, zmian sekretów, merge PR #26 ani deployu `gracz-checkers-test`.

## 1. Wejściowy backup anchor

Kanoniczny artefakt metadanych:

- `61-ETAP4-E4.1-E-FRESH-BACKUP-ANCHOR-2026-08-29.md`,
- Git blob: `4c4db200e619856b46663ba1c8c77ab77d110831`,
- backup filename: `E4.1-E-gracz-pl-database-pre-mutation-2026-08-29.dump`,
- format: PostgreSQL custom archive,
- size: `1,440,765` bytes,
- SHA-256: `87BC0380C8F7EF39E21600E87B80045E4A9C52481C9D4EAE7FB937E98CDC8D8B`,
- `pg_restore --list`: exit `0`,
- dwie lokalne kopie objęte retention contract.

Sam `pg_restore --list = 0` nie stanowi jeszcze restore validation.

## 2. Kanoniczne wymagania i wcześniejszy Gate 4

Zweryfikowane repo-only źródła:

| Dokument / skrypt | Git blob | Rola |
|---|---|---|
| `48-ETAP4-E4.1-FRESH-PRE-MUTATION-EVIDENCE-CHECKLIST.md` | `e63da99eaaad171e6907a4b567d8f76ffca99ead` | wymagania E4.1-F |
| `12-BACKUP-I-RESTORE-TEST-RUNBOOK.md` | `5d69263352188e8b9279780b4b4716e1228ce729` | wcześniejsza procedura Gate 3–4 |
| `12-BACKUP-I-RESTORE-TEST.md` | `437038123dcb2889e4a9d012dbdb089a220a1811` | historyczny udany restore |
| `modern/checkers-engine/ops/test-restore-postgres.sh` | `b2db1d3ba0c0d11d1cc65547a901a7122e9347a5` | ścieżka dla szyfrowanego `.dump.enc` |

Historyczny Gate 4 potwierdził działającą ścieżkę restore na lokalnym PostgreSQL 18.6 / port 5433 / osobnej bazie testowej. Nie zastępuje on świeżego restore backupu E4.1-E.

Bieżący backup E4.1-E jest custom archive `.dump`, a nie szyfrowanym `.dump.enc`. Dlatego skrypt `test-restore-postgres.sh`, który wymaga `BACKUP_ENCRYPTION_KEY` i odszyfrowania przez OpenSSL, **nie jest właściwą ścieżką dla tego artefaktu**. Dla E4.1-F należy użyć kontrolowanej procedury `pg_restore.exe` z runbooka Windows.

## 3. Granice bezpieczeństwa

Restore wolno wykonać dopiero po spełnieniu wszystkich warunków:

1. target odpowiada wyłącznie na `127.0.0.1` / loopback,
2. port i wersja lokalnego PostgreSQL są jawnie potwierdzone,
3. target nie jest hostem Render ani inną bazą produkcyjną,
4. używana jest nowa, jednoznacznie nazwana baza testowa, rekomendowana: `gracz_restore_e41_20260830`,
5. nie nadpisuje się historycznej bazy ani żadnego istniejącego środowiska bez osobnej autoryzacji,
6. nie używa się `DATABASE_URL` ani `MIGRATOR_DATABASE_URL` z Rendera,
7. hasło lokalnego PostgreSQL nie trafia do czatu, GitHuba, logu ani polecenia,
8. produkcja pozostaje `READ-ONLY / NO-MUTATION`.

Niespełnienie dowolnego warunku oznacza **ABORT / HOLD**.

## 4. F0 — Repo-only preflight

Wykonano:

- odczyt kanonicznej checklisty E4.1-F,
- odczyt wcześniejszego runbooka Gate 4,
- odczyt historycznego wyniku restore,
- identyfikację właściwego formatu świeżego backupu,
- identyfikację niezgodności między bieżącym `.dump` a skryptem dla `.dump.enc`,
- przygotowanie kryteriów STOP/ABORT.

Nie wykonano:

- połączenia z produkcją,
- połączenia z lokalnym PostgreSQL,
- utworzenia bazy testowej,
- `pg_restore`,
- DDL/DCL/DML,
- odczytu sekretów,
- zmiany Rendera lub Git source.

Status F0:

**PASS — REPO-ONLY PREFLIGHT COMPLETE / RESTORE NOT RUN.**

## 5. F0 — lokalny read-only identity probe

Data wykonania: 30.08.2026  
Cel: lokalny PostgreSQL operatora, bez użycia produkcyjnego `DATABASE_URL` ani `MIGRATOR_DATABASE_URL`.

### 5.1. Obsługa incydentu poświadczeń lokalnych

Pierwsza próba identyfikacji została przerwana po błędnym wprowadzeniu lokalnego poświadczenia. Poświadczenie stało się widoczne w kontekście terminala, dlatego zostało potraktowane jako skompromitowane. Jego literalnej wartości nie zapisano w tym dzienniku ani w repozytorium.

Wykonane działania naprawcze:

- wyłączono zapisywanie bieżącej historii PSReadLine,
- usunięto utrwalony plik historii PowerShell; końcowy `Test-Path = False`,
- potwierdzono działające lokalne usługi PostgreSQL 16 i PostgreSQL 18,
- zidentyfikowano właściwy katalog PostgreSQL 18: `C:\Program Files\PostgreSQL\18\data`,
- potwierdzono bazowe reguły `pg_hba.conf` z uwierzytelnianiem `scram-sha-256`,
- przed zmianą utworzono kopię `C:\Program Files\PostgreSQL\18\data\pg_hba.conf.e41-reset-20260830105010.bak` o rozmiarze `5,649` bajtów,
- zastosowano wyłącznie lokalną, wąską i tymczasową regułę `trust` dla bazy `postgres`, roli `postgres` i adresu `127.0.0.1/32`,
- ustawiono `password_encryption = 'scram-sha-256'` i obrócono lokalne hasło roli `postgres`,
- usunięto dokładnie jedną tymczasową regułę `trust`,
- przeładowano konfigurację PostgreSQL 18; serwer został poprawnie zasygnalizowany,
- ponowne logowanie z wymuszonym promptem hasła zakończyło się sukcesem.

Reguła `trust` nie pozostaje aktywna. Zmiany dotyczyły wyłącznie lokalnej instalacji non-production. Render, produkcyjna baza, sekrety produkcyjne i PR #26 nie zostały zmienione.

### 5.2. Wynik identity probe

Zapytanie wykonano w transakcji `READ ONLY`, zakończonej `ROLLBACK`.

| Pole | Wynik |
|---|---|
| `database_name` | `postgres` |
| `server_address` | `127.0.0.1` |
| `server_port` | `5433` |
| `server_version` | `18.6` |
| `in_recovery` | `false` |
| `transaction_read_only` | `on` |
| zakończenie transakcji | `ROLLBACK` |

Status F0:

**PASS — LOCAL LOOPBACK TARGET CONFIRMED / SCRAM AUTHENTICATION CONFIRMED / RESTORE NOT RUN.**

Na tym kroku nie utworzono bazy testowej, nie uruchomiono `pg_restore` i nie wykonano restore. Utworzenie nowej disposable database `gracz_restore_e41_20260830` pozostaje osobnym, jawnym krokiem.

## 6. Kryteria pełnego E4.1-F PASS

E4.1-F może otrzymać PASS dopiero po udokumentowaniu:

1. jednoznacznie izolowanego celu non-production,
2. zgodności SHA-256 backupu przed restore,
3. utworzenia nowej disposable restore DB,
4. `pg_restore --no-owner --no-privileges --exit-on-error` z exit `0`,
5. połączenia read-only z restored DB,
6. obecności 28/28 tabel AS-IS,
7. obecności PK/UNIQUE/FK oraz sekwencji/identity,
8. wykonania read-only row-count/integrity checks,
9. crypto decryptability smoke test bez ujawnienia plaintextów,
10. braku wpływu na produkcję i zachowania freeze.

## 7. Current decision

- `E4.1-F = IN PROGRESS / F0 TARGET IDENTITY PASS / RESTORE NOT RUN`,
- lokalne uwierzytelnianie SCRAM po rotacji hasła = `PASS`,
- tymczasowa reguła `trust` = `REMOVED / CONFIG RELOADED`,
- `E4.1 = IN PROGRESS / HOLD BEFORE DISPOSABLE DB CREATION`,
- `Production V3 = NO-GO`,
- PR #26 pozostaje `OPEN / DRAFT / NOT MERGED`,
- produkcja pozostaje `READ-ONLY / NO-MUTATION`.

Kolejny krok wymaga osobnej, jawnej decyzji dotyczącej utworzenia nowej lokalnej disposable database `gracz_restore_e41_20260830`.
