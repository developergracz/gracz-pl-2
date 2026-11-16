# CHESS-FULL-AUDIT-P0 — dowody i harness audytowy

Materiały dowodowe do raportu [`CHESS-FULL-AUDIT-P0-REPORT.md`](../../audits/CHESS-FULL-AUDIT-P0-REPORT.md).
Audyt wykonano na `main` @ `36f9c7c3ebbf5ead11d5836bd66d5ecd47582765`.

**To nie jest kod produkcyjny ani część CI.** Skrypty w `harness/` służyły wyłącznie do audytu
(tryb READ-ONLY wobec produkcji) i nie są importowane przez aplikację ani uruchamiane przez workflowy.

| Katalog | Zawartość |
|---|---|
| `results/` | Wyniki JSON każdego przebiegu (PASS/FAIL/NOT TESTED/NOT IMPLEMENTED + wartości rzeczywiste). Pliki `*-run1.json` to wcześniejsze przebiegi tych samych testów (powtarzalność). `summary-table.json` — agregat do tabeli zbiorczej. |
| `screenshots/` | Zrzuty Chromium (JPEG, ≤1600 px szer.) przywoływane w raporcie numerem. |
| `logs/` | Logi bazowych testów projektu (jednostkowe, przeglądarkowe, `test:scaling`) i harnessu API. |
| `harness/` | Skrypty audytowe (Node 22+, Playwright, `chess.js@1.4.0` i `axe-core@4.10.2` instalowane wyłącznie poza repozytorium). |

## Odtworzenie (izolowane środowisko)

Wymagane: PostgreSQL 16 i Redis/Valkey **na loopback**, baza o nazwie dopuszczonej przez
`contact-api/integration/test-database-guard.mjs` (domyślnie `gracz_test`), zależności `contact-api` z lockfile.

```bash
DATABASE_URL=postgresql://gracz@127.0.0.1:55432/gracz_test GAME_REDIS_URL=redis://127.0.0.1:56379 node harness/online-api.mjs
```

Ścieżki bezwzględne w skryptach (`/tmp/claude-0/.../scratchpad/audit`, `/home/user/gracz-pl-2`) wskazują
lokalizacje z sesji audytu — przed ponownym uruchomieniem należy je dostosować. Harness tworzy
jednorazowe konta `Aud*@example.invalid` i usuwa je po przebiegu; nigdy nie łączy się z produkcją.
