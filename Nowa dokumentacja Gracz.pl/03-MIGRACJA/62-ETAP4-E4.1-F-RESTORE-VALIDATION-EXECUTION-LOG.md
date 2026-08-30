# ETAP 4 — E4.1-F Restore Validation — Execution Log

Data przygotowania: 30.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **IN PROGRESS / RESTORE PASS / STRUCTURAL, ROW-COUNT AND CRYPTO-STRUCTURE VALIDATION PASS**  
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
- trzy lokalne kopie objęte retention contract; wszystkie mają identyczny rozmiar i SHA-256.

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

## 6. Domknięcie incydentu poświadczeń lokalnych

Po wcześniejszym `SECURITY HOLD` wykonano pełną remediację lokalną bez ponownego ujawniania sekretu:

- wygenerowano nowe losowe poświadczenie lokalnej roli `postgres`,
- zapisano je wyłącznie w standardowym lokalnym `pgpass.conf`,
- ACL pliku ograniczono do bieżącego użytkownika Windows oraz `SYSTEM`,
- usunięto tymczasową regułę `trust` i przeładowano konfigurację,
- potwierdzono `TRUST_RULE_COUNT=0`,
- test logowania bez promptu, z `-w` i lokalnym `pgpass.conf`, zakończył się `AUTH_TEST_PASS`,
- schowek oraz utrwalona historia PowerShell zostały wyczyszczone,
- wcześniejsze lokalne poświadczenia uznano za wycofane.

Żadnej wartości hasła nie zapisano w repozytorium ani w tym dzienniku. Produkcyjne poświadczenia, Render i PR #26 pozostały bez zmian.

Status remediacji:

**PASS — LOCAL CREDENTIAL ROTATED / SCRAM ACTIVE / TRUST ABSENT / AUTOMATED LOCAL AUTH VERIFIED.**

## 7. F1 — utworzenie i weryfikacja izolowanej disposable restore database

Data wykonania: 30.08.2026  
Cel: wyłącznie lokalny PostgreSQL `127.0.0.1:5433`.

Wykonano:

- utworzono nową bazę `gracz_restore_e41_20260830` przez lokalne `createdb.exe`,
- właściciel: `postgres`,
- kodowanie: `UTF8`,
- źródło: `template0`,
- `datistemplate = false`,
- `datallowconn = true`,
- przed restore potwierdzono w transakcji `READ ONLY`: `user_tables = 0`,
- kontrolę zakończono `ROLLBACK`.

Status F1:

**PASS — DISPOSABLE DB CREATED / METADATA CONFIRMED / EMPTY STATE CONFIRMED.**

## 8. F2 — kontrolowany restore świeżego backupu E4.1-E

Źródło restore:

- plik: `E4.1-E-gracz-pl-database-pre-mutation-2026-08-29.dump`,
- format: PostgreSQL custom archive,
- rozmiar: `1,440,765` bajtów,
- SHA-256: `87BC0380C8F7EF39E21600E87B80045E4A9C52481C9D4EAE7FB937E98CDC8D8B`,
- `pg_restore --list`: `ARCHIVE_LIST_OK`,
- liczba pozycji TOC: `199`,
- narzędzie: `pg_restore (PostgreSQL) 18.6`.

Restore wykonano wyłącznie do `gracz_restore_e41_20260830` z opcjami:

- `--host=127.0.0.1`,
- `--port=5433`,
- `--username=postgres`,
- `--no-password`,
- `--no-owner`,
- `--no-privileges`,
- `--exit-on-error`,
- `--single-transaction`.

Wynik:

- `RESTORE_PASS`,
- `EXIT_CODE=0`,
- czas: `0.87 s`,
- produkcja i Render: bez zmian.

Status F2:

**PASS — CUSTOM ARCHIVE RESTORED TO ISOLATED LOCAL DATABASE / EXIT 0.**

## 9. F3 — read-only structural validation po restore

Walidację wykonano w transakcji `READ ONLY` i zakończono `ROLLBACK`.

| Kontrola | Wynik |
|---|---:|
| tabele użytkownika | 28 |
| sekwencje | 8 |
| widoki | 2 |
| widoki materializowane | 0 |
| indeksy | 70 |
| constraints | 241 |
| niepoprawne indeksy | 0 |
| niezwalidowane constraints | 0 |

Tożsamość celu:

- baza: `gracz_restore_e41_20260830`,
- użytkownik: `postgres`,
- adres: `127.0.0.1`,
- port: `5433`,
- PostgreSQL: `18.6`,
- `transaction_read_only = on`.

Status F3:

**PASS — 28/28 TABLES PRESENT / STRUCTURAL OBJECTS PRESENT / NO INVALID INDEXES / NO UNVALIDATED CONSTRAINTS.**

## 10. F4 — dokładne row counts wszystkich tabel restore

W trybie read-only wykonano dokładne `COUNT(*)` dla wszystkich tabel użytkownika.

Wynik zbiorczy:

- `TABLES_CHECKED=28`,
- `NONEMPTY_TABLES=17`,
- `TOTAL_ROWS=17711`,
- błędy zapytań: brak,
- evidence CSV: `E4.1-F-restore-row-counts-20260830.csv`,
- lokalizacja operatora: `C:\Users\user\Documents\Gracz.pl-E4.1-Backup\E4.1-F-restore-row-counts-20260830.csv`.

Status F4:

**PASS — EXACT ROW COUNTS COLLECTED FOR 28/28 TABLES / LOCAL EVIDENCE SAVED.**

## 11. F5 — privacy-safe kontrola struktury danych kryptograficznych restore

Data wykonania: 31.08.2026  
Cel: wyłącznie lokalna baza `gracz_restore_e41_20260830` na `127.0.0.1:5433`.

Kontrolę wykonano w transakcji `REPEATABLE READ READ ONLY`, zakończonej `ROLLBACK`. Polecenie nie odczytywało ani nie wypisywało plaintextów, kluczy, wartości AAD, ciphertextów, haseł ani danych osobowych.

| Kontrola | Wynik |
|---|---:|
| wiadomości ogółem | 5 |
| pary subject/body z envelope `enc:v1` | 2 |
| rekordy z mieszanym formatem subject/body | 0 |
| pary legacy/non-prefixed | 3 |
| załączniki ogółem | 2 |
| załączniki strukturalnie poprawne (IV/tag/ciphertext) | 2 |
| załączniki używające legacy AAD | 2 |
| niepoprawne strukturalnie załączniki | 0 |
| rekordy MFA | 0 |

Wynik końcowy polecenia:

`CRYPTO_STRUCTURE_CHECK_PASS`

Interpretacja:

- restore zachowuje oczekiwane formaty kryptograficzne i warianty legacy,
- brak rekordów z mieszanym envelope wiadomości,
- brak strukturalnie niepoprawnych załączników,
- trzy rekordy legacy wymagają zachowania zgodności ścieżki odczytu podczas migracji,
- `MFA = 0` oznacza `N/A` dla danych MFA,
- kontrola struktury **nie jest testem odszyfrowania** i nie zastępuje świeżego Gate 11 decryptability smoke testu.

Status F5:

**PASS — CRYPTO STRUCTURE INVENTORY CONFIRMED / NO PLAINTEXT OR SECRET OUTPUT / DECRYPTABILITY STILL PENDING.**

## 12. F6 — bezpieczny production read-only connection probe przed reconciliation

Data wykonania: 31.08.2026  
Cel: potwierdzić możliwość wykonania fresh row-count reconciliation bez ujawniania poświadczeń i bez mutacji produkcji.

Przed połączeniem:

- zapisano External Database URL wyłącznie lokalnie w standardowym `pgpass.conf`,
- poświadczenie nie zostało wklejone do czatu, polecenia ani historii PowerShell,
- schowek został zastąpiony bezpiecznym markerem po lokalnym przetworzeniu URL,
- połączenie wymusiło `sslmode=require`,
- session guard wymusił `default_transaction_read_only=on`,
- czas oczekiwania na połączenie ograniczono do 15 sekund.

Probe zweryfikował bez wypisywania hosta ani credential values:

- `current_database = gracz_pl_database`,
- `current_user = gracz_pl_database_user`,
- `transaction_read_only = on`,
- SSL aktywne,
- transakcja zakończona `ROLLBACK`.

Wynik końcowy:

`PRODUCTION_READONLY_CONNECTION_PASS`

Status F6:

**PASS — PRODUCTION TARGET IDENTITY / READ-ONLY / SSL CONFIRMED / NO MUTATION.**

## 13. Kryteria pełnego E4.1-F PASS

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

## 14. Current decision

- `E4.1-F = IN PROGRESS / F0–F6 PASS`,
- lokalny cel loopback i uwierzytelnianie SCRAM = `PASS`,
- lokalne poświadczenie = `ROTATED / AUTOMATED / NOT DISCLOSED`,
- tymczasowa reguła `trust` = `REMOVED / COUNT 0`,
- disposable database = `gracz_restore_e41_20260830`,
- restore = `PASS / EXIT 0`,
- struktura = `28/28 TABLES / 8 SEQUENCES / 70 INDEXES / 241 CONSTRAINTS`,
- exact restore row counts = `28 TABLES / 17 NONEMPTY / 17,711 TOTAL ROWS`,
- production read-only connection probe = `PASS / IDENTITY OK / SSL ON / READ ONLY`,
- production row-count reconciliation = `PENDING`,
- crypto structure inventory = `PASS / 2 ENCRYPTED MESSAGE PAIRS / 3 LEGACY PAIRS / 2 VALID LEGACY-AAD ATTACHMENTS / MFA 0`,
- legacy crypto decryptability smoke test = `PENDING`,
- disposable DB cleanup = `DEFERRED UNTIL EVIDENCE COMPLETE`,
- `E4.1 = IN PROGRESS`,
- `Production V3 = NO-GO`,
- PR #26 pozostaje `OPEN / DRAFT / NOT MERGED`,
- produkcja i Render pozostają nienaruszone.

Następny krok: wykonać wyłącznie kolejne wymagane kontrole read-only — reconciliation ze źródłem oraz crypto decryptability — bez usuwania bazy testowej i bez zmian produkcyjnych.
