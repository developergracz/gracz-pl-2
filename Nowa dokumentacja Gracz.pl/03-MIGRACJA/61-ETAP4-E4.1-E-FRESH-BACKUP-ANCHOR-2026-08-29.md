# ETAP 4 — E4.1-E Fresh Backup / pre-mutation anchor

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Target DB: `gracz_pl_database`  
Production mode: **READ-ONLY / NO-MUTATION**  
Production V3: **NO-GO**

## 1. Provider capability

Render Free tier nie udostępnia zarządzanych backupów/exportów ani Point-in-Time Recovery dla tej instancji. E4.1-E został więc wykonany jako pełny logiczny backup PostgreSQL przy użyciu lokalnego `pg_dump`.

Nie wykonano żadnego restore na produkcji, żadnego DDL/DCL/DML ani zmiany konfiguracji bazy.

## 2. Backup execution

Narzędzie:

`pg_dump (PostgreSQL) 18.6`

Format:

`custom`

Nazwa lokalnego artefaktu:

`E4.1-E-gracz-pl-database-pre-mutation-2026-08-29.dump`

Fresh execution evidence:

- `PG_DUMP_EXIT=0`,
- rozmiar pliku: `1,440,765` bajtów,
- timestamp pliku: `29.08.2026 23:09:52` (lokalny czas operatora),
- backup powstał po E4.0 freeze i przed pierwszą dozwoloną mutacją E4.2+.

## 3. Archive readability check

Wykonano lokalnie:

`pg_restore --list`

Wynik:

`PG_RESTORE_LIST_EXIT=0`

Ten wynik potwierdza, że archiwum jest rozpoznawane i czytelne przez `pg_restore`. **Nie jest to jeszcze restore validation** — pełne odtworzenie do izolowanego non-production targetu należy do E4.1-F.

## 4. Integrity / checksum

SHA-256 backupu:

`87BC0380C8F7EF39E21600E87B80045E4A9C52481C9D4EAE7FB937E98CDC8D8B`

Checksum został potwierdzony dla:

1. kopii roboczej w lokalnym katalogu Downloads,
2. drugiej lokalnej kopii w `Documents\Gracz.pl-E4.1-Backup`.

Obie kopie mają identyczny SHA-256 i są bajt-w-bajt zgodne.

Folder OneDrive **nie jest podstawą PASS** i nie jest wymagany przez checklistę. Synchronizacja OneDrive nie została wykorzystana jako dowód retencji.

## 5. Retention contract

Obie zweryfikowane kopie lokalne muszą pozostać niezmienione i dostępne przez cały maintenance/cutover oraz rollback window. Nie wolno ich usuwać, nadpisywać ani zastępować do czasu formalnego zamknięcia wymaganej retencji.

Jeżeli którakolwiek kopia zostanie utracona lub zmieniona przed zakończeniem rollback window, E4.1-E należy ponownie ocenić i w razie potrzeby wykonać nowy fresh backup przed mutacją.

Surowy `.dump` **nie jest zapisywany w repozytorium GitHub**, ponieważ zawiera dane produkcyjne. Repozytorium przechowuje wyłącznie bezpieczne metadane, checksum i wynik weryfikacji.

## 6. Decision

**E4.1-E = PASS — fresh pre-mutation backup anchor created, integrity-checked and retained under explicit retention contract.**

Powody:

- fresh backup powstał po freeze,
- `pg_dump` zakończył się sukcesem (`EXIT=0`),
- artefakt ma niezerowy, udokumentowany rozmiar,
- `pg_restore --list` zakończył się sukcesem (`EXIT=0`),
- SHA-256 został zapisany i potwierdzony na dwóch lokalnych kopiach,
- backup nie został zapisany do repozytorium ani ujawniony w logach,
- production pozostała bez mutacji.

**E4.1-F restore validation = NOT RUN.**

Następny krok: odtworzyć backup wyłącznie do izolowanego non-production restore targetu i wykonać checklistę E4.1-F. Restore może mutować wyłącznie ten izolowany target, nigdy produkcję.
