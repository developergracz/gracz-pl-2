# ETAP 3 — Pełny backup i test restore

Data wykonania: 28.08.2026
Status: **PASS — backup i kontrolowany restore potwierdzone**

## 1. Cel

Celem było zamknięcie bramek preflight dotyczących pełnego backupu oraz praktycznie zweryfikowanej ścieżki odtworzenia przed jakimkolwiek produkcyjnym DDL/backfillem V3.

## 2. Backup źródłowy

Wykonano pełny backup produkcyjnego PostgreSQL Render w formacie custom (`pg_dump -Fc`).

Artefakt lokalny:

`gracz-preflight-full-2026-08-28.dump`

Parametry zarejestrowane podczas wykonania:
- rozmiar: `1 341 128` bajtów,
- SHA-256: `74E942CC9D1FEF4E8443486315A0C85A9443A8C455FE221918362A0E500C60BA`,
- backup obejmuje schemat i dane,
- poświadczenia/connection string nie są zapisywane w repozytorium.

## 3. Środowisko restore

Restore wykonano do odrębnej lokalnej bazy testowej, bez modyfikowania produkcji Render.

Środowisko:
- PostgreSQL lokalny: **18.6**,
- port lokalny: `5433`,
- baza testowa: `gracz_restore_test_20260828`,
- narzędzie: `pg_restore` PostgreSQL 18,
- opcje bezpieczeństwa/portowalności: `--no-owner --no-privileges --exit-on-error`.

## 4. Wynik restore

`pg_restore` zakończył się bez błędu i zwrócił sterowanie do PowerShella.

Po restore wykonano kontrolę liczby tabel:

```sql
SELECT count(*) AS liczba_tabel
FROM pg_tables
WHERE schemaname='public';
```

Wynik: **28 tabel**.

Następnie uruchomiono dokładne `COUNT(*)` dla wszystkich 28 tabel odtworzonej bazy. Zapytania zakończyły się poprawnie i zwróciły dane dla wszystkich tabel.

## 5. Ważne rozróżnienie względem wcześniejszego baseline

Wcześniejszy profil danych ETAPU 3 został wykonany przed utworzeniem tego pełnego backupu. Produkcyjna baza była w międzyczasie używana, dlatego wcześniejsze wartości row-count nie są traktowane jako snapshot atomowo równoczesny z backupem.

Z tego powodu:
- **potwierdzamy poprawność ścieżki backup → restore oraz kompletność struktury 28/28**,
- nie deklarujemy fałszywie, że każdy licznik rekordów musi być równy starszemu profilowi,
- do przyszłej migracji właściwe porównanie source/target row-count musi być wykonane na snapshotach z tego samego okna migracyjnego.

## 6. Ocena bramek preflight

### Bramka 3 — pełny backup danych

**PASS**

Dowód:
- istnieje pełny dump custom-format,
- zapisano rozmiar i checksum,
- backup nie znajduje się w repozytorium,
- istnieje praktycznie sprawdzona ścieżka odtworzenia.

### Bramka 4 — test odtworzenia backupu

**PASS**

Dowód:
- utworzono odrębną bazę testową,
- `pg_restore --exit-on-error` zakończył się bez błędu,
- odtworzono 28/28 tabel,
- wszystkie tabele są odczytywalne i dokładne `COUNT(*)` zostały wykonane.

## 7. Bezpieczeństwo lokalnego PostgreSQL

Na potrzeby odzyskania dostępu administracyjnego do lokalnego PostgreSQL czasowo użyto lokalnego `trust`. Po ustawieniu nowego lokalnego hasła konfigurację natychmiast przywrócono do `scram-sha-256` dla połączeń lokalnych i zweryfikowano skuteczne logowanie PostgreSQL 18.6.

Sekret nie jest zapisywany w tym dokumencie ani w repozytorium.

## 8. Co pozostaje otwarte

Zaliczenie backup/restore **nie oznacza jeszcze globalnego GO dla DDL V3**.

Pozostają inne bramki preflight, w szczególności:
- finalizacja decyzji biznesowych DQ-002,
- pełny writer/reader/endpoint inventory,
- crypto/key compatibility,
- active-state/cutover plan,
- security/credential rotation i least-privilege,
- finalny rollback/maintenance/GO-NO-GO.

Do czasu ich zamknięcia obowiązuje: **DDL V3 — NO-GO**.
