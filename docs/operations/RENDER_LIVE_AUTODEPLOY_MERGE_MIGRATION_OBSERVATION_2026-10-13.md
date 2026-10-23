# gracz.pl — Render LIVE auto-deploy, merge coupling i migrator: zapis operacyjny 2026-10-13

**Typ:** powdrożeniowy rejestr faktów i bramki operacyjne (docs-only; read-only evidence).  
**Status:** OBSERVED / PROPOSED SAFETY GATE / NOT AN AUTHORIZATION.  
**Repo:** `developergracz/gracz-pl-2`; **obserwowany main:** `bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e`.  
**Data obserwacji:** 2026-10-13, około 10:04–10:07 UTC (12:04–12:07 CEST).  
**Przestrzeń Render:** `My Workspace` (`tea-da40ia67bikc73cvi9n0`).

> **KRYTYCZNA LEKCJA OPERACYJNA:** Samo scalenie do `main` wyzwalało w rzeczywistej konfiguracji Render **dwa** automatyczne wdrożenia: strony statycznej i `gracz-contact-api`. Build API **uruchamia produkcyjny migrator PostgreSQL**. Nie można zatem traktować nawet CSS/docs-only merge jako „bezprodukcyjnego”. Przed następnym merge weryfikuj ustawienia *live* i nieautoryzowane skutki — nie polegaj wyłącznie na `render.yaml`.

## 1. Fakty potwierdzone przez GitHub i Render

| Element | Zweryfikowany fakt | Dowód / tożsamość |
|---|---|---|
| Poprawka stopki | [PR #251](https://github.com/developergracz/gracz-pl-2/pull/251) **MERGED**; niezależny audyt Claude: PASS przekazany przez Owner w rozmowie, nie utożsamiać z formalnym GitHub review | PR HEAD `a2998851793dfe1fb290f4f86dcb4c8ee27b5978`; merge/main SHA `bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e` |
| CI po scaleniu | GitHub `codeql`, `node-security`, `secrets`, PostgreSQL persistence gate, SEO i sidebars: **success** na merge SHA | [GitHub checks na merge SHA](https://github.com/developergracz/gracz-pl-2/commit/bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e/checks) |
| Statyczna strona | Render `gracz-pl-maintenance`, ID `srv-da9m8rhsrm7s73co2780`, typ `static_site`, repo `developergracz/gracz-pl-2`, branch `main`, rootDir `maintenance-site`, publishPath `.`, autoDeploy **yes/commit** | [Panel usługi](https://dashboard.render.com/static/srv-da9m8rhsrm7s73co2780), deploy `dep-db7045mq1p3s73eq7k0g` |
| Statyczny deploy | Dla merge SHA `bfbd5da5…`, trigger `new_commit`, stan **live/succeeded**, 2026-10-13 10:04:22 UTC | Render deploy `dep-db7045mq1p3s73eq7k0g` / event `evt-db7049i6192c73dhv3s0` |
| Contact API | Render `gracz-contact-api`, ID `srv-db00m2u7bikc73fnsje0`, typ `web_service`, branch `main`, autoDeploy **yes/commit**, rootDir `.` | [Panel usługi](https://dashboard.render.com/web/srv-db00m2u7bikc73fnsje0), deploy `dep-db7045mq1p3s73eq7jp0` |
| Contact API deploy | Ten sam merge SHA automatycznie wywołał build i restart API; status **live/succeeded**, 2026-10-13 10:04:52 UTC | Render deploy `dep-db7045mq1p3s73eq7jp0` / event `evt-db704h2bt3mc73dttstg` |
| API build command | Faktycznie skonfigurowano uruchomienie `npm --prefix contact-api install` oraz `npm --prefix contact-api run migrate`, jeśli istnieje `contact-api/persistence/migrator.mjs` | Render live `serviceDetails.envSpecificDetails.buildCommand`; build logs deploy `dep-db7045mq1p3s73eq7jp0` |
| Migrator w tym deploy | Migrator **uruchomił się**; wynik `applied: []`, `skipped: ['001_persistent_state.sql', '002_durable_premium_reply.sql', '003_newsletter_state_version.sql', '004_contact_data_encryption.sql']`. **Nie zastosował nowej migracji w tym przebiegu** | Render API build logs około 2026-10-13 10:04:22 UTC |
| Start API | `node contact-api/server.mjs`, log `gracz.pl contact API listening` i `Your service is live` | Render API app logs około 2026-10-13 10:04:44–10:04:52 UTC |

**Uwaga o poziomie dowodów:** Status `live` potwierdza aktywny deploy na Render, ale nie zastępuje przeglądarkowego testu domeny `https://gracz.pl` ani niezależnego odczytu `/health` czy rzeczywistego restore. Rzeczywistej kontroli wizualnej domeny w tej sesji **nie wykonano**. Dla nowej wersji stopki lokalny audyt Claude potwierdza geometrię, nie produkcyjną przeglądarkę.

## 2. Rozbieżność konfiguracji: kod w repo ≠ Render LIVE

Plik [`maintenance-site/render.yaml`](../../maintenance-site/render.yaml) na wskazanym `main` zawiera:

~~~yaml
branch: main
autoDeployTrigger: off
~~~

**Tymczasem faktyczna istniejąca usługa** `gracz-pl-maintenance` w Render API zwróciła `autoDeploy: yes` i `autoDeployTrigger: commit`, co potwierdził automatyczny deploy po PR #251. Analogicznie `gracz-contact-api` ma live `autoDeploy: yes` i `autoDeployTrigger: commit` oraz migrator w komendzie budowania.

Nie wnioskuj, dlaczego konfiguracje się różnią, bez osobnego audytu zasobów/Blueprint. Ten dokument **nie zmienia** konfiguracji Render, pliku YAML ani cyklu migracji.

## 3. Bramka obowiązkowa PRZED NASTĘPNYM MERGE do `main`

**MERGE-TO-PRODUCTION PRECHECK — STOP przy UNKNOWN lub HOLD:**

1. Pobierz na nowo GitHub `main` i exact PR HEAD, pełny diff i listę nowych plików migracji; oceń skutki także PR docs-only i CSS-only.
2. Z Render *live read-only* potwierdź workspace, ID wszystkich usług śledzących `main`, ich `autoDeploy` / `autoDeployTrigger`, gałęzie, rootDir, rzeczywiste build/pre-deploy/start commands i czy każdy build wykonuje SQL/migrator.
3. Ustal rzeczywistą listę migracji oczekujących na produkcyjnym migratorze, numerację, zgodność starych i nowych writerów, stan DR/backup/restore i możliwość wycofania. **Nie uruchamiaj produkcyjnego migratora do samego sprawdzenia.**
4. **MIGRATION 005: HOLD / BLOCKS MERGE** dla implementacji dodającej konfliktujący slot (np. draft [PR #248](https://github.com/developergracz/gracz-pl-2/pull/248) proponujący `005_newsletter_opt_in_requests.sql`; runbook contact-data rezerwuje 005 dla późniejszego CONTRACT). Nie rozstrzyga tego samo przemianowanie pliku. Obowiązuje osobny audyt migracji i realna bramka DR.
5. W razie konfiguracji uruchamiającej nieautoryzowany deploy/migrację lub niepewności co do skutku merge: **STOP — MERGE HOLD**, zgłoś Ownerowi i uzgodnij bezpieczną izolację usług / harmonogram oraz wymagane aprobaty. **Samo OWNER MERGE GO nie jest zgodą na nieujawnione, wtórne migracje**, jeśli zakres takiego skutku nie został jawnie przedstawiony.
6. Dopiero po pełnym rozpoznaniu skutków udokumentuj exact SHA, wynik niezależnego review, checks, świadomą osobną decyzję Owner o merge i — jeśli właściwe — o produkcyjnym wdrożeniu / kosztach. Przestrzegaj kanonicznych runbooków.
7. Po każdym zatwierdzonym merge potwierdź **obie** usługi: realne deploy SHA, stan build, migrator `applied/skipped`, health, błędy w logach, a dla UI kontrolę rzeczywistej domeny/urządzeń. Nie ogłaszaj END-TO-END PROD PASS, jeśli którykolwiek element nie jest sprawdzony.

**ZAKAZ:** brak automatycznej zgody na wyłączenie auto-deploy, zmianę buildCommand, migrację 005, zmianę schematu, backfill, aktualizację sekretów lub płatny upgrade; każda wymaga osobnego mandatu i jawnego Owner GO. Samo utworzenie tego dokumentu lub PR też nie daje prawa do scalenia.

## 4. Powiązane runbooki / zaległe ryzyka

- [Backup & Disaster Recovery R1](./BACKUP_DISASTER_RECOVERY_R1_2026-10-09.md): odzyskanie z niezależnej kopii/restore i secret escrow nadal HOLD, dopóki nie ma odpowiednich dowodów.
- [Render PostgreSQL upgrade and recovery](../../contact-api/RENDER_POSTGRES_UPGRADE_RUNBOOK.md): przed upgrade potwierdzić brak migracji 005; nie pozwala ona na DDL przez zwykły merge.
- [Production contact-data backfill](../../contact-api/PRODUCTION_BACKFILL_RUNBOOK.md): CONTRACT 005 odrębny przyszły krok, nieautoryzowany.
- [Contact API README](../../contact-api/README.md): migracje w build i expand/contract; skutki mieszanych wersji.
- [PR #249 — proponowane standardy governance](https://github.com/developergracz/gracz-pl-2/pull/249): dokumentacja G4 pre-merge deploy coupling jest DRAFT, nie przyjętą polityką dopóki nie przejdzie audytu i decyzji Owner.
- [PR #250](https://github.com/developergracz/gracz-pl-2/pull/250): alternatywna, duplikująca poprawka stopki, nadal do odrębnego rozstrzygnięcia; nie scalać bez kontroli.
- Claude audyt #251 wskazał dwa **wcześniejsze** problemy responsywności (P2, niezwiązane z tą poprawką): overflow kolumny stopki przy ok. 1632–1726 px oraz overflow nagłówka przy ok. 1181–1299 px. Traktować jako osobne zadania, nie deklarować naprawione przez PR #251.

## 5. Stan końcowy incydentu i źródła

- **PR #251:** merged; static Render deploy LIVE; contact API LIVE. Wdrożenia zaszły automatycznie wskutek merge, a nie ręcznego `trigger_deploy`.
- **Migracje 001–004:** w tym konkretnym przebiegu skipped; **applied: []**. Nie oznacza to ogólnego dowodu braku zmian DB poza tym deployem.
- **005:** nie uruchomiona w opisanym deployu; przyszła implementacja **HOLD**.
- **Wizualny test `gracz.pl` i samodzielny test `/health`:** NOT VERIFIED / follow-up.
- **Naprawa konfiguracji auto-deploy / izolacja backendu od CSS/docs merge:** NOT IMPLEMENTED; wymaga osobnej decyzji.
- **Bezpieczny trwały zapis:** dokument operacyjny repo (bez wartości sekretów, URL baz danych, PII i dumpów); dane konfiguracyjne ze stanu Render to **snapshot**, należy odczytać je ponownie przed każdą operacją.

**Powiązanie operacyjne:** merge SHA `bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e` — Render deploy IDs `dep-db7045mq1p3s73eq7k0g` oraz `dep-db7045mq1p3s73eq7jp0`.