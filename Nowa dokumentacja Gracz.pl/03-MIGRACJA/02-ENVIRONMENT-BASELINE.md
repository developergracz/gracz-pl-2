# ETAP 3 — Environment Baseline Render PostgreSQL

Data pomiaru: 28.08.2026
Status: **POTWIERDZONE — baseline środowiska z rzeczywistego Render PostgreSQL**

## 1. Cel

Dokument zapisuje stan środowiskowy bazy użytej jako źródło preflight migracji PostgreSQL V3. Jest to dowód środowiskowy, odrębny od AS-IS kodowego i od architektury docelowej.

## 2. Tożsamość środowiska

- baza: `gracz_pl_database`
- użytkownik sesji diagnostycznej: `gracz_pl_database_user`
- PostgreSQL: `18.4 (Debian 18.4-1.pgdg12+1)`
- port: 5432
- schemat aplikacyjny: `public`
- liczba tabel aplikacyjnych: **28**

## 3. Potwierdzone elementy baseline

Collector środowiskowy potwierdził:
- 28 tabel produkcyjnych,
- 70 indeksów,
- 241 constraint/not-null entries w raporcie `pg_constraint`/metadata,
- statystyki 28 tabel,
- stan połączeń,
- podsumowanie locków,
- brak replication slots,
- rozszerzenie `plpgsql`,
- selected settings,
- role bez danych haseł,
- tablespaces,
- 248 kolumn w pełnym baseline kolumnowym.

## 4. Połączenia i locki w chwili pomiaru

W chwili collectora widoczne było 1 aktywne połączenie `psql` do `gracz_pl_database`.

Lock summary zawierał wyłącznie locki diagnostycznej sesji:
- `AccessShareLock` na relacji,
- `ExclusiveLock` na `virtualxid`.

Nie jest to dowód braku obciążenia w każdym momencie produkcyjnym; stan aktywności należy odświeżyć bezpośrednio przed cutover.

## 5. Replication i rozszerzenia

- replication slots: **0**,
- extensions: tylko `plpgsql` 1.0.

Plan DDL nie może zakładać rozszerzeń, których nie potwierdzono lub nie dodano jawnie w fazie expand.

## 6. Istotne ustawienia

Potwierdzono m.in.:
- `autovacuum = on`,
- `max_connections = 100`,
- `wal_level = replica`,
- `statement_timeout = 0`,
- `lock_timeout = 0`,
- `idle_in_transaction_session_timeout = 0`,
- `shared_buffers = 8192 * 8kB`,
- `work_mem = 1703 kB`.

### Wniosek dla migracji

Brak globalnego `statement_timeout` i `lock_timeout` nie jest rekomendacją do wykonywania migracji bez limitów. Executable migration runner powinien ustawiać lokalne, kontrolowane timeouty per krok, aby nie czekać bez końca na locki.

## 7. Role i uprawnienia — obserwacja

Collector pokazał, że `gracz_pl_database_user`:
- może logować się,
- ma `CREATEROLE`,
- ma `CREATEDB`,
- nie jest superuserem,
- nie ma replication/bypass RLS.

To są szerokie uprawnienia jak na docelową application runtime role. Preflight Security pozostaje otwarty: docelowo należy rozdzielić migration/DDL role od runtime/worker/read-only i zastosować least privilege.

## 8. Schema-level observations

Baseline potwierdził znane wcześniej rozbieżności środowiskowe:
- `gracz_game_sessions.version` istnieje w produkcji,
- współistnieją `gracz_audit_log` i `gracz_audit_log_legacy_1787562123031`,
- współistnieją `gracz_role_changes` i `gracz_role_history`,
- `gracz_newsletter_subscribers` ma hybrydową strukturę legacy + lifecycle V2/V3-preparatory,
- newsletter helper tables odnoszą się FK do `gracz_newsletter_subscribers(id)`, podczas gdy legacy PK tabeli subscribers pozostaje `subscriber_id`.

## 9. Status bramki Environment Baseline

### PASS
- identyfikacja serwera i bazy,
- liczba tabel 28/28,
- indexes/constraints/columns inventory,
- connections/locks snapshot,
- replication/extensions/settings/roles/tablespaces snapshot.

### NOT VERIFIED / otwarte
- świeży schema dump wykonany bezpośrednio w formalnym punkcie cutover i jego diff,
- pełny backup + restore test,
- exact data-quality/orphan/collision profile,
- aktywny ruch i writer state w chwili cutover,
- least-privilege migration credentials,
- rotacja poświadczeń i secret hygiene completion.

## 10. Wniosek

**Environment Baseline = PASS jako zebrany dowód środowiskowy.**

Nie oznacza to całego Preflight = GO. Dokument ten jest wejściem do kolejnych bramek ETAPU 3.