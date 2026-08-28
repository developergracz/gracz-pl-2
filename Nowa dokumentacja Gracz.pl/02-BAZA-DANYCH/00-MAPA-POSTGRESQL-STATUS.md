# Mapa PostgreSQL — status

Data aktualizacji: 28.08.2026

## Status końcowy

**ETAP 1B — MAPA POSTGRESQL: ZAMKNIĘTY.**

## Zakres i dowody

Mapa kodowa obejmuje **26 tabel**. Wszystkie 26 zostały zidentyfikowane i udokumentowane w ramach AS-IS. Następnie wykonano niezależną weryfikację rzeczywistego schematu bazy `gracz-pl-database` na Renderze przez `pg_dump --schema-only`.

Rzeczywisty dump środowiska wykazał **28 tabel**. Oznacza to, że mapa aplikacyjna została zweryfikowana, ale środowisko zawiera dodatkowe obiekty i schema drift, które zostały jawnie zarejestrowane.

## Postęp

| Obszar | Status |
|---|---|
| Tożsamość — 7 tabel | zmapowane |
| Audyt — 1 tabela | zmapowane |
| Warcaby — `gracz_game_sessions` | AS-IS + Render zweryfikowane; Render ma dodatkowe `version` |
| Tysiąc — `gracz_thousand_games` | AS-IS + Render zweryfikowane |
| Gomoku | AS-IS zweryfikowane; brak własnej tabeli PostgreSQL |
| Wiadomości prywatne — 2 tabele | AS-IS + Render zweryfikowane |
| Moderacja — 2 tabele | AS-IS + Render zweryfikowane |
| Global Chat — 4 tabele | AS-IS + Render zweryfikowane |
| Turnieje — 3 tabele | AS-IS + Render zweryfikowane |
| Newsletter — 5 tabel | AS-IS + Render zweryfikowane; HIGH drift w subscribers |
| Inwentaryzacja kodowa | **26/26** |
| Rzeczywisty schemat Render | **28 tabel** |
| Model Match | **wykonany** |
| Formalne zamknięcie ETAPU 1B | **ZAMKNIĘTY** |

## Najważniejsze rozbieżności Render

1. **HIGH — `gracz_newsletter_subscribers`**: hybrydowy model legacy + nowy lifecycle; `subscriber_id` pozostaje PK, równolegle istnieje nowsze `id` i podwójne zestawy części pól/tokenów.
2. **MEDIUM — `gracz_audit_log_legacy_1787562123031`**: dodatkowa zachowana tabela legacy audytu.
3. **MEDIUM — `gracz_role_changes`**: dodatkowy model historii zmian ról współistniejący z `gracz_role_history`.
4. **MEDIUM — `gracz_game_sessions.version`**: kolumna obecna w Renderze, lecz wcześniejszy DML Warcabów nie potwierdzał użycia jej jako CAS/optimistic locking.

## Dokumenty szczegółowe

- `01-TOZSAMOSC-I-AUDYT.md`
- `02-GRY-WARCABY-POSTGRESQL-AS-IS.md`
- `03-GRY-TYSIAC-POSTGRESQL-AS-IS.md`
- `04-GRY-GOMOKU-AS-IS.md`
- `05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md`
- `06-MODERACJA-POSTGRESQL-AS-IS.md`
- `07-GLOBAL-CHAT-POSTGRESQL-AS-IS.md`
- `08-TURNIEJE-POSTGRESQL-AS-IS.md`
- `09-NEWSLETTER-POSTGRESQL-AS-IS.md`
- `10-POROWNANIE-POSTGRESQL-REPO-PRODUKCJA.md`
- `11-MODEL-MATCH-I-ROZBIEZNOSCI.md`

## Granica audytu

Zamknięcie ETAPU 1B oznacza zamknięcie mapy i porównania schematu, a nie potwierdzenie jakości danych, wolumenów, backupów ani runtime. Te elementy wymagają osobnych dowodów.

## Następny etap

**ETAP 2 — ARCHITEKTURA DOCELOWA I PLAN MIGRACJI**, z uwzględnieniem schema drift wykrytego na Renderze.