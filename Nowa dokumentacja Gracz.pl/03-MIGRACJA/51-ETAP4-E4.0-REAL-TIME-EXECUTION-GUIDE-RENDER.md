# ETAP 4 — E4.0 Real-Time Execution Guide — Render

Data: 29.08.2026
Status początkowy: **E4.0 INCOMPLETE / HOLD**
Zakres: prowadzenie operatora ekran po ekranie przez Render bez migratora, bez zmian DB, bez rotacji sekretów i bez rozpoczęcia E4.1 przed pełnym zamknięciem E4.0.

> Zasada: po każdym ekranie zapisujemy wyłącznie niesekretny wynik kontroli. Jeśli dowolny warunek jest niepotwierdzony, zatrzymujemy procedurę i pozostawiamy `E4.0 = HOLD`.

## Ekran 1 — wybór właściwego Web Service

Render Dashboard → wybierz właściwy Web Service Gracz.pl / usługę używaną w preflight.

Sprawdź i zapisz:
- nazwa usługi,
- region,
- aktualnie wdrożony commit/SHA, jeśli jest pokazany,
- timestamp rozpoczęcia freeze.

Nie otwieraj Shell i nie uruchamiaj żadnego deployu.

Wynik:
- `PASS` jeśli wybrano właściwą usługę,
- `HOLD` jeśli nie ma pewności, która usługa jest właściwa.

## Ekran 2 — Settings → Auto-Deploy

Render Dashboard → Web Service → Settings → Auto-Deploy.

Wymagany stan:

`Auto-Deploy = Off`

Jeśli jest inny stan, przed dalszym przejściem ustaw `Off` jako kontrolę freeze.

Po ustawieniu nie używaj:
- Manual Deploy,
- Deploy latest commit,
- Deploy a specific commit,
- Clear build cache & deploy,
- Restart service,
- rollback.

Wynik:
- `PASS` tylko przy `Auto-Deploy = Off`,
- inaczej `HOLD`.

## Ekran 3 — Events

Render Dashboard → Web Service → Events.

Sprawdź listę najnowszych zdarzeń.

Musi być jednocześnie:
- brak deployu `In progress`,
- brak deployu oczekującego,
- brak restartu w toku,
- brak rollbacku w toku,
- brak config-change deployment w toku.

Uwaga: Render traktuje restart jako specjalny rodzaj manual deploy, więc restart również blokuje freeze.

Wynik:
- `PASS` jeśli nie ma aktywnej operacji deploymentowej,
- `HOLD` jeśli jest aktywny deploy/restart/rollback lub oczekujący deploy.

## Ekran 4 — Settings → Maintenance Mode

Render Dashboard → Web Service → Settings → Maintenance Mode.

Jeśli usługa jest płatnym Web Service i opcja jest dostępna:
1. włącz Maintenance Mode,
2. potwierdź akcję w dialogu,
3. nie zmieniaj URI maintenance page, jeśli nie jest to wymagane do freeze.

Render Maintenance Mode pozostawia usługę uruchomioną, ale odcina publiczny internet. Publiczne requesty otrzymują `503 Service Unavailable`. Usługa może nadal być osiągalna przez private network i SSH, dlatego sam Maintenance Mode nie jest wystarczającym dowodem zatrzymania wszystkich writerów.

Jeśli Maintenance Mode nie jest dostępny:
- nie oznaczaj PASS automatycznie,
- użyj wyłącznie wcześniej zatwierdzonego alternatywnego mechanizmu blokady mutacji,
- inaczej `HOLD`.

Wynik:
- `PASS` jeśli publiczne mutacje są faktycznie zablokowane,
- `HOLD` jeśli publiczny writer nadal może przyjmować mutacje.

## Ekran 5 — publiczna walidacja maintenance

Z osobnej karty przeglądarki lub bezpiecznego read-only checku sprawdź publiczny adres usługi.

Jeśli używasz Render Maintenance Mode, oczekiwane jest:
- `503 Service Unavailable`,
- domyślna albo zatwierdzona strona maintenance.

Nie wykonuj żadnych operacji zapisujących.

Wynik:
- `PASS` jeśli publiczny ruch mutacyjny jest odcięty,
- `HOLD` jeśli aplikacja nadal przyjmuje normalny publiczny ruch.

## Ekran 6 — inventory usług w Render workspace

Wróć do Render Dashboard i przejrzyj wszystkie usługi powiązane z projektem.

Sprawdź co najmniej:
- główny Web Service,
- Background Workers,
- Cron Jobs,
- Private Services,
- Workflows / one-off jobs, jeśli istnieją,
- inne usługi mogące korzystać z tej samej PostgreSQL.

Dla każdej potencjalnej ścieżki zapisu zapisz tylko:
- logiczna nazwa,
- typ usługi,
- status: `STOPPED` albo `MUTATIONS BLOCKED`.

Nie zapisuj connection stringów ani wartości env.

Wynik:
- `PASS` tylko jeśli każdy potencjalny writer jest potwierdzony jako zablokowany,
- jeden aktywny lub niepotwierdzony writer = `HOLD`.

## Ekran 7 — Logs / Events dla writerów

Dla każdego potencjalnego writera sprawdź Logs i Events.

Potwierdź:
- brak aktywności zapisującej po rozpoczęciu freeze,
- brak uruchomionego joba mutacyjnego,
- brak restartu/redeployu writera,
- brak ręcznej sesji operatora wykonującej DML.

Nie otwieraj nowego Shell tylko w celu tej kontroli, jeśli nie jest to niezbędne i wcześniej zatwierdzone.

Wynik:
- `PASS` jeśli nie ma aktywnego writera,
- `HOLD` przy każdej niepewności.

## Ekran 8 — Environment

Render Dashboard → Web Service → Environment.

Sprawdzenie ma charakter obecność/niezmienność. Nie kopiuj i nie zapisuj wartości sekretów.

Do zakończenia E4.1 nie zmieniaj:
- `DATABASE_URL`,
- `AUTH_SECRET`,
- crypto secrets,
- `NODE_ENV`,
- Turnstile,
- Resend,
- Twilio,
- proxy trust flags.

Nie dodawaj `MIGRATOR_DATABASE_URL` do normalnego runtime.

Do execution log wpisz tylko:

`ENVIRONMENT FROZEN — NO CHANGES`

Wynik:
- `PASS` jeśli environment pozostaje niezmieniony,
- nieautoryzowana zmiana = `HOLD` i ponowny baseline.

## Ekran 9 — GitHub freeze

Poza Render potwierdź:
- PR #26 = `OPEN`,
- PR #26 = `DRAFT`,
- PR #26 = `NOT MERGED`,
- branch = `audit/gate14a2-runtime-ddl-separation`,
- exact source SHA.

Znany baseline:

`cb073bad3050ffc9726e0a1528c2ec4a4808f12e`

Niezrecenzowana zmiana SHA = `HOLD`.

## Ekran 10 — finalna kontrola Render

Wróć do Web Service i wykonaj drugą, read-only kontrolę:
- Auto-Deploy nadal `Off`,
- Maintenance Mode / mutation lock nadal aktywny,
- Events bez aktywnego deployu/restartu/rollbacku,
- wszyscy writerzy nadal `STOPPED` albo `MUTATIONS BLOCKED`,
- Environment bez zmian.

Jeżeli którykolwiek stan zmienił się podczas procedury, nie zamykaj E4.0.

## Ekran 11 — uzupełnienie execution log E4.0

Do `46-ETAP4-E4.0-FREEZE-MAINTENANCE-EXECUTION-LOG.md` należy wpisać wyłącznie niesekretne evidence:
- freeze start timestamp,
- service name,
- Auto-Deploy = Off,
- Maintenance Mode / mutation lock status,
- Events = no active deploy/restart/rollback,
- lista writerów + status,
- Environment frozen = true,
- PR #26 state,
- exact source SHA,
- final verification timestamp.

Nie wpisuj sekretów, tokenów, URL-i z credentialami ani connection stringów.

# Decyzja końcowa

## `E4.0 = COMPLETE`

Tylko jeśli wszystkie ekrany 1–11 zostały potwierdzone i finalna kontrola nie wykazała odchylenia.

Wtedy dopiero:

`E4.1 — Fresh Pre-Mutation Evidence = READY`

## `E4.0 = HOLD`

Jeśli choć jeden ekran jest niepotwierdzony, writer może nadal mutować albo trwa deploy/restart/rollback.

W HOLD nie rozpoczynamy E4.1, migratora, DDL/DCL/DML, provisioning ról, keyringu, rekey, rotacji sekretów ani produkcyjnego deploymentu V3.