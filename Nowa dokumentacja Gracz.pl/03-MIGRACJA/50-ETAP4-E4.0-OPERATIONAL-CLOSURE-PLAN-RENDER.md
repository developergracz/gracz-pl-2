# ETAP 4 — E4.0 Operational Closure Plan — Render

Data: 29.08.2026  
Status początkowy: **INCOMPLETE / HOLD**  
Zakres: wykonanie operacyjnego freeze projektu Gracz.pl w Render bez migratora, bez zmian DB, bez rotacji sekretów i bez wejścia do E4.1 przed pełnym zamknięciem E4.0.

## Zasada nadrzędna

E4.0 można zamknąć wyłącznie wtedy, gdy wszystkie warunki freeze są jednocześnie udowodnione. Jedno niepotwierdzone źródło mutacji albo aktywna operacja deploymentowa oznacza `HOLD`.

## Kolejność wykonania

### Krok 1 — Otwórz właściwy Web Service

Render Dashboard → właściwy Web Service obsługujący Gracz.pl / środowisko testowe używane w preflight.

Zapisz bez sekretów:
- nazwę usługi,
- timestamp rozpoczęcia freeze,
- operatora wykonującego czynność.

Nie zmieniaj jeszcze env, database credentials ani secretów.

### Krok 2 — Zablokuj automatyczne deploymenty

Render Dashboard → Web Service → Settings → Auto-Deploy.

Wymagany stan:

`Auto-Deploy = Off`

Po zmianie:
- nie uruchamiaj Manual Deploy,
- nie uruchamiaj Deploy latest commit,
- nie uruchamiaj Restart service,
- nie uruchamiaj rollbacku.

PASS tylko gdy Auto-Deploy = Off.

### Krok 3 — Sprawdź Events

Render Dashboard → Web Service → Events.

Potwierdź jednocześnie:
- brak deployu w toku,
- brak buildu/deployu oczekującego,
- brak restartu w toku,
- brak rollbacku w toku,
- brak config-change deployment w toku.

Uwaga: restart usługi w Render jest specjalnym rodzajem manual deploy i dlatego także blokuje zamknięcie E4.0.

Jeśli dowolna operacja jest aktywna: `E4.0 = HOLD` do jej pełnego zakończenia i ponownej kontroli Events.

### Krok 4 — Aktywuj kontrolowany mutation freeze

Preferowany mechanizm dla Web Service, jeśli jest dostępny: Maintenance Mode.

Jeśli Maintenance Mode nie jest dostępny, wymagany jest wcześniej zatwierdzony alternatywny mechanizm, który faktycznie uniemożliwia publiczne mutacje.

#### Zatwierdzony fallback dla aktualnej instancji Free

Fresh evidence operatora z 29.08.2026 15:25 CEST potwierdziło w `gracz-checkers-test → Settings → Maintenance Mode`, że bieżąca usługa działa na planie `Free`, a Render wyświetla komunikat, że Maintenance Mode jest dostępny wyłącznie dla płatnych instancji.

Dla tej konkretnej konfiguracji zatwierdzonym alternatywnym mechanizmem D4 jest:

`Suspend Web Service`

Warunki użycia fallbacku:
- D2 musi mieć `Auto-Deploy = Off`,
- D3 musi mieć brak aktywnego deploy/restart/rollback/queue,
- zawieszana jest wyłącznie usługa `gracz-checkers-test`; **nie zawieszać PostgreSQL `gracz-pl-database`**,
- po suspend należy potwierdzić w Render status usługi jako zawieszony/niedostępny,
- następnie wykonać wyłącznie read-only public validation, że normalna aplikacja nie obsługuje publicznego ruchu,
- nie wykonywać testowych zapisów,
- usługa pozostaje zawieszona podczas dalszego freeze, dopóki późniejszy autoryzowany krok nie wymaga jej uruchomienia,
- D5 nadal musi zinwentaryzować wszystkie inne potencjalne writery; suspend głównego Web Service nie jest dowodem, że nie istnieją inne ścieżki zapisu.

Nie używać `Upgrade` jako części E4.0 tylko po to, aby uzyskać Maintenance Mode; zmiana planu/compute rozszerzałaby zakres freeze i wymagałaby nowego baseline.

Nie uznawaj samego komunikatu maintenance ani samego kliknięcia suspend za pełny dowód. Potwierdź, że publiczna aplikacja nie jest dostępna i że główny publiczny writer nie może przyjąć nowych mutacji.

Minimalnie dotyczy to:
- rejestracji,
- logowania tworzącego nowe sesje,
- wiadomości i załączników,
- newslettera,
- zaproszeń i pokojów,
- ruchów/operacji gier zapisujących do PostgreSQL,
- moderacji/admin endpoints zapisujących dane.

PASS tylko jeśli publiczny writer nie może przyjąć nowych mutacji.

### Krok 5 — Inventory wszystkich writerów

Sprawdź wszystkie usługi/procesy mogące zapisywać do tej samej produkcyjnej PostgreSQL:
- główny Web Service,
- Background Workers,
- Cron Jobs,
- webhook consumers,
- one-off jobs,
- ręczne Shell sessions,
- inne Render services wykorzystujące tę samą bazę.

Dla każdego zapisz wyłącznie:
- logiczną nazwę,
- typ procesu,
- status: `STOPPED` albo `MUTATIONS BLOCKED`.

Nie zapisuj connection stringów ani credentiali.

Choć jeden aktywny albo niepotwierdzony writer = `HOLD`.

### Krok 6 — Environment freeze

Render Dashboard → Web Service → Environment.

Od tego momentu do zakończenia E4.1 nie wykonuj nieautoryzowanych zmian konfiguracji.

W szczególności nie zmieniaj:
- `DATABASE_URL`,
- `AUTH_SECRET`,
- crypto secrets,
- `NODE_ENV`,
- Turnstile,
- Resend,
- Twilio,
- proxy trust flags.

Nie dodawaj `MIGRATOR_DATABASE_URL` do normalnego runtime.

Do logu zapisz tylko:

`ENVIRONMENT FROZEN — NO CHANGES`

### Krok 7 — GitHub/source freeze

Potwierdź:
- PR #26 = `OPEN`,
- PR #26 = `DRAFT`,
- PR #26 = `NOT MERGED`,
- branch = `audit/gate14a2-runtime-ddl-separation`,
- exact source SHA zapisany.

Znany baseline:

`cb073bad3050ffc9726e0a1528c2ec4a4808f12e`

Jeśli SHA uległ zmianie bez formalnego review: `HOLD` i nowy baseline review przed E4.1.

### Krok 8 — Finalna read-only kontrola E4.0

Bez zmian konfiguracyjnych ponownie sprawdź:
- Auto-Deploy nadal Off,
- mutation lock nadal aktywny,
- Events nadal bez deploy/restart/rollback,
- każdy writer nadal STOPPED albo MUTATIONS BLOCKED,
- environment nadal bez zmian,
- PR #26 nadal OPEN/DRAFT/NOT MERGED,
- exact source SHA nadal zgodny z baseline.

Dopiero po tej drugiej kontroli wolno zamknąć E4.0.

## Evidence do execution log

Zapisz wyłącznie niesekretne dane:
- freeze start timestamp,
- nazwa usługi Render,
- Auto-Deploy = Off,
- rodzaj aktywnego mutation lock / Maintenance Mode,
- Events = no active deploy/restart/rollback,
- lista writerów i status każdego,
- environment frozen = true,
- PR #26 state,
- exact source SHA,
- operator confirmation,
- final verification timestamp.

## Decyzja końcowa

### `E4.0 = COMPLETE`

Wyłącznie gdy wszystkie poniższe są prawdziwe jednocześnie:
1. publiczne mutacje są zablokowane,
2. Auto-Deploy = Off,
3. Events nie pokazuje aktywnego deployu/restartu/rollbacku,
4. każdy mutation writer jest STOPPED albo MUTATIONS BLOCKED,
5. environment jest zamrożony,
6. GitHub/source jest zamrożony,
7. exact source SHA jest zapisany,
8. finalna read-only recheck potwierdza, że freeze nadal obowiązuje.

Wtedy można zmienić status na:

`E4.0 = COMPLETE`

oraz rozpocząć:

`E4.1 — Fresh Pre-Mutation Evidence`

### `E4.0 = HOLD`

Jeśli choć jeden warunek nie jest potwierdzony.

W stanie HOLD nie wolno rozpoczynać E4.1 ani wykonywać migratora, provisioning ról, DDL/DCL/DML, rekey, rotacji secretów ani produkcyjnego deploymentu V3.
