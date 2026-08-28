# ETAP 3 — Data Profile 28 tabel PostgreSQL

Data pomiaru: 28.08.2026 11:44:44 UTC
Środowisko: `gracz_pl_database`
PostgreSQL: `18.4 (Debian 18.4-1.pgdg12+1)`
Status: **POTWIERDZONE — dokładny profil 28/28 tabel z produkcyjnego Render PostgreSQL**

## 1. Cel i źródło dowodu

Dokument zapisuje wynik read-only collectora `03-DATA-PROFILE-COLLECTOR.sql`. Collector wykonał dokładne `COUNT(*)` oraz odczyty metadanych i rozmiarów PostgreSQL. Nie jest to estymacja `n_live_tup`.

Nie zapisujemy w dokumentacji connection stringów, haseł ani plaintextu danych prywatnych.

## 2. Wynik bramki

**PASS: 28-table row-count + physical-size profile.**

Potwierdzono dokładnie 28 tabel AS-IS. Łączna liczba rekordów we wszystkich tabelach wynosi **13 865**. Z tego `gracz_audit_log` zawiera **13 743** rekordy, czyli ok. **99,1% wszystkich wierszy**. Pozostałe 27 tabel mają łącznie **122 rekordy**.

Łączny fizyczny rozmiar 28 tabel wraz z indeksami/TOAST/pozostałym storage wynosi około **8,2 MiB**. Największe obiekty to:
- `gracz_audit_log` — 6 438 912 B (~6,14 MiB),
- `gracz_message_attachments` — 638 976 B (~624 KiB), z czego ~600 KiB to TOAST,
- `gracz_newsletter_subscribers` — 196 608 B (~192 KiB),
- `gracz_auth_sessions` — 106 496 B (~104 KiB),
- `gracz_thousand_games` — 106 496 B (~104 KiB).

Wniosek wykonawczy: wolumen danych jest obecnie mały. Ryzyko migracji wynika przede wszystkim z semantyki, integralności, kryptografii, writerów i cutover, a nie z przepustowości backfillu.

## 3. Dokładny profil 28/28

| # | tabela AS-IS | dokładne wiersze | total size | status migracyjny / uwaga |
|---:|---|---:|---:|---|
| 1 | `gracz_accounts` | 10 | 32 KiB | aktywne Identity; wymaga collision/key mapping profile |
| 2 | `gracz_audit_log` | 13 743 | 6288 KiB | dominujący wolumen; append-only audit |
| 3 | `gracz_audit_log_legacy_1787562123031` | 0 | 40 KiB | legacy pusta; kandydat do deprecate po dependency check |
| 4 | `gracz_auth_sessions` | 15 | 104 KiB | aktywne dane sesyjne; cutover/expiry do sprawdzenia |
| 5 | `gracz_chat_friends` | 2 | 64 KiB | sprawdzić pary A↔B/status |
| 6 | `gracz_chat_topics` | 0 | 24 KiB | pusta |
| 7 | `gracz_game_sessions` | 2 | 48 KiB | aktywny stan gry możliwy; drain/cutover gate |
| 8 | `gracz_global_chat` | 3 | 80 KiB | reactions/logical refs do profilowania |
| 9 | `gracz_global_chat_reports` | 0 | 24 KiB | pusta |
| 10 | `gracz_message_attachments` | 2 | 624 KiB | crypto/AAD + orphan check; TOAST ~600 KiB |
| 11 | `gracz_messages` | 5 | 64 KiB | crypto compatibility gate |
| 12 | `gracz_mfa` | 0 | 16 KiB | pusta |
| 13 | `gracz_moderation_appeals` | 0 | 16 KiB | pusta |
| 14 | `gracz_moderation_decisions` | 6 | 24 KiB | outcome/context/content_hash profile |
| 15 | `gracz_newsletter_subscribers` | 5 | 192 KiB | **HIGH drift gate** |
| 16 | `gracz_password_reset_tokens` | 1 | 48 KiB | token już użyty wg timestamp profile; potwierdzić semantykę |
| 17 | `gracz_registration_codes` | 2 | 32 KiB | expiry/usage profile |
| 18 | `gracz_role_changes` | 0 | 16 KiB | pusta; MERGE target |
| 19 | `gracz_role_history` | 0 | 8 KiB | pusta; MERGE target |
| 20 | `gracz_roles` | 0 | 8 KiB | pusta |
| 21 | `gracz_thousand_games` | 29 | 104 KiB | największy gameplay set; state/revision/cutover profile |
| 22 | `gracz_tournament_matches` | 0 | 24 KiB | pusta |
| 23 | `gracz_tournament_players` | 0 | 16 KiB | pusta |
| 24 | `gracz_tournaments` | 0 | 24 KiB | pusta |
| 25 | `newsletter_consent_history` | 5 | 80 KiB | zachować provenance/history |
| 26 | `newsletter_events` | 10 | 96 KiB | lifecycle history |
| 27 | `newsletter_sources` | 1 | 48 KiB | source mapping |
| 28 | `newsletter_subscriber_sources` | 4 | 48 KiB | subscriber/source integrity |

## 4. Sekwencje

Collector wykazał 8 sekwencji, z czego 7 jest przypisanych do kolumn tabel. Istnieje dodatkowa `gracz_newsletter_subscriber_id_seq`, której mapowanie do kolumny nie pojawiło się w zestawieniu `pg_get_serial_sequence`; wymaga ona dependency check przed cleanupem.

Istotne wartości `last_value`:
- `gracz_newsletter_subscribers_id_seq` = 8,
- `newsletter_consent_history_id_seq` = 5,
- `newsletter_events_id_seq` = 10,
- `newsletter_sources_id_seq` = 185,
- `newsletter_subscriber_sources_id_seq` = 8.

Wartości sekwencji nie muszą odpowiadać `COUNT(*)`; nie wolno ich resetować na podstawie liczby rekordów bez osobnej walidacji `MAX(id)` i zależności.

## 5. Zakresy czasowe — obserwacje

- `gracz_accounts`: 10 rekordów, `created_at` od 22.08 do 28.08.2026.
- `gracz_audit_log`: 13 743 rekordy, `occurred_at` od 24.08 do 28.08.2026.
- `gracz_auth_sessions`: 15 rekordów; 9 ma `revoked_at`.
- `gracz_game_sessions`: 2 rekordy utworzone 28.08.2026.
- `gracz_messages`: 5 rekordów; w profilu `read_at` ma 0 wartości non-null.
- `gracz_newsletter_subscribers`: 5 rekordów; 1 ma `confirmed_at`, 0 ma `unsubscribed_at`; występują równolegle `consent_at` i `consented_at`.
- `gracz_thousand_games`: 29 rekordów od 24.08 do 27.08.2026.
- wszystkie trzy tabele turniejowe są puste.

Powyższe są obserwacjami strukturalnymi/czasowymi, nie interpretacją pełnego stanu biznesowego. Statusy i JSON state wymagają kolejnego profilowania.

## 6. Constraints i indeksy

Wszystkie 28 tabel mają po jednym PK. Collector potwierdził m.in.:
- FK w `gracz_auth_sessions`, `gracz_message_attachments`, `gracz_mfa`, `gracz_moderation_appeals`, reset/registration/role/tournament/newsletter helper tables,
- 2 FK w `gracz_messages`, `newsletter_events` i `newsletter_subscriber_sources`,
- brak DB FK w kilku znanych logical-reference obszarach (m.in. Global Chat), co pozostaje osobną bramką orphan profiling,
- 11 indeksów na `gracz_newsletter_subscribers` — najwięcej spośród 28 tabel.

Samo istnienie FK/UNIQUE nie dowodzi poprawności przyszłych constraintów V3. Duplicate/orphan/collision profiling pozostaje wymagany.

## 7. Statystyki operacyjne — sygnały

Porównanie dokładnych `COUNT(*)` ze statystykami potwierdza, że `n_live_tup` jest estymacją i nie może zastępować profilu dokładnego. Widać także churn/dead tuples m.in. w:
- `gracz_auth_sessions`: 15 exact rows, 30 dead tuples w statystykach,
- `gracz_newsletter_subscribers`: 5 exact rows, 35 dead tuples,
- `gracz_password_reset_tokens`: 1 exact row, 24 dead tuples,
- `gracz_accounts`: 10 exact rows, 6 dead tuples.

Nie jest to samo w sobie blocker migracji; jest to sygnał aktywnych ścieżek zapisu i argument za poprawnym writer inventory oraz świeżym snapshotem bezpośrednio przed cutover.

## 8. Ocena bramek po tym collectorze

### PASS
- rzeczywista liczba tabel: 28/28,
- dokładne `COUNT(*)`: 28/28,
- fizyczne rozmiary: 28/28,
- TOAST/storage profile: 28/28,
- lista sekwencji i mapowanie serial/sequence,
- lista kolumn czasowych i min/max,
- liczby PK/UNIQUE/FK/CHECK,
- liczby indeksów.

### WARNING / DO DALSZEJ WERYFIKACJI
- orphan/collision/data-quality profile nie został wykonany przez ten collector,
- status/JSON-state distributions nie zostały wykonane,
- crypto decryptability nie została zweryfikowana,
- writer/reader/endpoint/worker inventory pozostaje otwarte,
- backup + restore test pozostaje otwarty,
- aktywne sesje/mecze wymagają oceny bliżej cutover,
- credential/permissions gate pozostaje otwarty.

## 9. Wniosek

Bramka **Row counts i rozmiary 28 tabel** otrzymuje status **PASS**.

Nie oznacza to jeszcze GO dla całego preflight. Następna praca powinna objąć preflight data-quality/orphan/collision oraz pozostałe bramki bezpieczeństwa i operacyjne. Plan wykonawczego DDL nie powinien być uruchamiany na produkcji przed zamknięciem krytycznych blockerów.