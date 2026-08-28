# ETAP 3 — Backup + real restore test

Data: 28.08.2026  
Status: **PREFLIGHT GATE 3–4 — DO WYKONANIA / DDL V3 NO-GO**

## Cel

Udowodnić, że przed jakąkolwiek mutacją istnieje świeży pełny backup produkcyjnego PostgreSQL oraz że backup da się rzeczywiście odtworzyć do odrębnej bazy testowej i zweryfikować.

## Zasady bezpieczeństwa

- Nie zapisujemy connection stringów, haseł ani kluczy w GitHubie, logach lub dokumentacji.
- Backup przechowujemy poza repozytorium.
- Restore wykonujemy wyłącznie do osobnej testowej bazy, nigdy nad produkcją.
- Nie wykonujemy DDL/DML V3 podczas tej bramki.

## A. Backup produkcji

Na Windows PowerShell użyć PostgreSQL 18 `pg_dump.exe` i połączyć się z produkcyjną bazą bez wklejania sekretu do czatu.

Rekomendowany format: custom (`-Fc`), ponieważ obsługuje kontrolowany restore przez `pg_restore`.

Przykład struktury polecenia (parametry host/user/db należy pobrać z bezpiecznego źródła lokalnego/Render):

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -Fc --no-owner --no-privileges -h <HOST> -U <USER> -d gracz_pl_database -f "$env:USERPROFILE\Downloads\gracz-preflight-full-2026-08-28.dump"
```

Hasło podać interaktywnie albo przez bezpiecznie skonfigurowane lokalne mechanizmy klienta PostgreSQL. Nie umieszczać go w poleceniu ani pliku dokumentacji.

## B. Weryfikacja pliku backup

```powershell
Get-Item "$env:USERPROFILE\Downloads\gracz-preflight-full-2026-08-28.dump" | Select-Object Name,Length,LastWriteTime
Get-FileHash "$env:USERPROFILE\Downloads\gracz-preflight-full-2026-08-28.dump" -Algorithm SHA256
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' --list "$env:USERPROFILE\Downloads\gracz-preflight-full-2026-08-28.dump" | Select-Object -First 30
```

Do GitHubowej dokumentacji wyniku zapisujemy tylko timestamp, rozmiar, SHA-256, wersję pg_dump oraz PASS/FAIL — bez danych i sekretów.

## C. Odrębne środowisko restore

Utworzyć osobną, tymczasową bazę PostgreSQL przeznaczoną wyłącznie do testu restore. Nazwa rekomendowana: `gracz_restore_test_20260828`.

**STOP:** nie wykonywać restore, dopóki host/database target nie zostaną jednoznacznie potwierdzone jako NIEPRODUKCYJNE.

Restore:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' --no-owner --no-privileges --exit-on-error -h <RESTORE_HOST> -U <RESTORE_USER> -d gracz_restore_test_20260828 "$env:USERPROFILE\Downloads\gracz-preflight-full-2026-08-28.dump"
```

## D. Verify po restore

Minimalne PASS:

1. Restore kończy się kodem 0 / bez błędów.
2. PostgreSQL restore target odpowiada oczekiwanej wersji/kompatybilności.
3. W `public` istnieje 28 oczekiwanych tabel AS-IS.
4. Row counts krytycznych tabel odpowiadają snapshotowi backupu.
5. PK/UNIQUE/FK zostały odtworzone.
6. Sekwencje/identity są obecne.
7. Read-only smoke queries przechodzą.
8. Crypto smoke test zostanie wykonany osobno z właściwymi kluczami aplikacyjnymi; sam backup/restore nie dowodzi decryptability.

Przykładowe read-only verify:

```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';

SELECT 'gracz_accounts',count(*) FROM public.gracz_accounts
UNION ALL SELECT 'gracz_audit_log',count(*) FROM public.gracz_audit_log
UNION ALL SELECT 'gracz_messages',count(*) FROM public.gracz_messages
UNION ALL SELECT 'gracz_game_sessions',count(*) FROM public.gracz_game_sessions
UNION ALL SELECT 'gracz_thousand_games',count(*) FROM public.gracz_thousand_games
UNION ALL SELECT 'gracz_newsletter_subscribers',count(*) FROM public.gracz_newsletter_subscribers;
```

## E. Evidence record

Po wykonaniu utworzyć/uzupełnić `12-BACKUP-I-RESTORE-TEST-RESULT.md`:

- backup timestamp UTC,
- pg_dump version,
- backup filename (bez ścieżek zawierających sekrety),
- size bytes,
- SHA-256,
- source DB identifier bez credentials,
- restore target identifier bez credentials,
- restore start/end,
- restore exit status,
- table count,
- row-count reconciliation,
- constraints/sequences result,
- smoke-test result,
- anomalies,
- final Gate 3 PASS/FAIL,
- final Gate 4 PASS/FAIL.

## GO/PASS

Gate 3 = PASS dopiero po utworzeniu świeżego backupu i zapisaniu jego metadanych/checksum.  
Gate 4 = PASS dopiero po rzeczywistym restore do osobnej bazy i pozytywnej weryfikacji.

Do tego momentu **DDL V3 = NO-GO**.