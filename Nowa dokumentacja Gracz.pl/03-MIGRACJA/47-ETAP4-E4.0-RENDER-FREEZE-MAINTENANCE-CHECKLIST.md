# ETAP 4 — E4.0 Render Freeze / Maintenance Checklist

Data: 29.08.2026  
Status początkowy: **INCOMPLETE / HOLD**  
Zakres: tylko potwierdzenie warunków freeze; bez migratora, bez zmian DB, bez rotacji sekretów.

> Uwaga terminologiczna: Render `Maintenance Mode` dla Web Service nie jest tym samym co platformowe okno konserwacyjne Render. W E4.0 chodzi o kontrolowany freeze projektu Gracz.pl.

## Warunek 1 — Public traffic / mutation freeze

Guided Link: Render Dashboard → `gracz-checkers-test` / właściwy Web Service → Settings / Maintenance Mode.

1. Jeśli usługa jest płatnym Web Service i opcja jest dostępna: włącz `Maintenance Mode`.
2. Jeśli Maintenance Mode nie jest dostępny: nie uznawaj warunku za PASS automatycznie. Wymagany jest alternatywny, udowodniony mechanizm blokujący publiczne mutacje (np. zatwierdzony application-level maintenance lock lub kontrolowane zatrzymanie usługi).
3. Sprawdź, że publiczni użytkownicy nie mogą wykonywać mutacji.
4. Nie zmieniaj konfiguracji DB ani sekretów.

PASS tylko jeśli nowe mutacje użytkowników są faktycznie zablokowane.
ABORT jeśli publiczny writer nadal przyjmuje mutacje.

## Warunek 2 — Auto-deploy i deploy freeze

Guided Link: Render Dashboard → Web Service → Settings → Auto-Deploy.

1. Ustaw `Auto-Deploy = Off` na czas E4.0–E4.10.
2. Otwórz Events.
3. Potwierdź brak deployu w toku.
4. Potwierdź brak rollbacku w toku.
5. Potwierdź brak restartu/config-change deployment w toku.
6. Nie uruchamiaj `Manual Deploy`.

PASS tylko jeśli auto-deploy jest wyłączony i Events nie pokazuje aktywnego deployu/restartu/rollbacku.
ABORT jeśli jakakolwiek operacja deploymentowa jest aktywna.

## Warunek 3 — Normal mutation writer stopped or proven blocked

Guided Link: Render Dashboard → Web Service → Logs / Events oraz lista powiązanych Background Workers / Cron Jobs.

1. Zidentyfikuj wszystkie procesy, które mogą zapisywać do produkcyjnej PostgreSQL:
   - główny Web Service,
   - Background Workers,
   - Cron Jobs,
   - webhook consumers,
   - ręczne skrypty/operator shells,
   - inne usługi używające tego samego `DATABASE_URL`.
2. Dla każdego writera potwierdź: STOPPED albo MUTATIONS BLOCKED.
3. Sprawdź Events, że żaden writer nie jest właśnie restartowany lub redeployowany.
4. Nie uruchamiaj nowych Shell sessions ani skryptów DML.

PASS tylko jeśli nie istnieje aktywna ścieżka mutacji.
ABORT jeśli choć jeden writer może nadal zapisywać.

## Warunek 4 — GitHub/source freeze

Guided Link: GitHub → PR #26 i branch `audit/gate14a2-runtime-ddl-separation`.

1. PR #26 pozostaje `OPEN / DRAFT / NOT MERGED`.
2. Nie merge'ować PR #26.
3. Nie pushować zmian do cutover branch podczas freeze bez jawnego wpisu do execution log.
4. Zamrozić exact source SHA dla E4.1.

Aktualny znany baseline przed świeżym E4.1: `cb073bad3050ffc9726e0a1528c2ec4a4808f12e`.

## Warunek 5 — Environment freeze

Guided Link: Render Dashboard → Web Service → Environment.

1. Nie zmieniaj `DATABASE_URL`.
2. Nie dodawaj `MIGRATOR_DATABASE_URL` do normalnego runtime.
3. Nie rotuj `AUTH_SECRET`.
4. Nie ustawiaj nowych crypto keys.
5. Nie zmieniaj `NODE_ENV`, Turnstile, Resend, Twilio ani proxy trust flags.
6. Nie zapisuj wartości sekretów do notatek/screenshots/logów.

PASS jeśli konfiguracja pozostaje niezmieniona od baseline do zakończenia E4.1.

## Evidence wymagane do zamknięcia E4.0

Zapisz bez sekretów:

- timestamp freeze start,
- nazwa usługi Render,
- Auto-Deploy = Off,
- Maintenance Mode / alternatywny mutation lock = aktywny,
- Events: brak deployu/rollbacku/restartu w toku,
- lista writerów + status każdego,
- PR #26 status,
- exact source SHA,
- operator potwierdzający freeze.

## Finalna decyzja E4.0

### E4.0 COMPLETE

Można oznaczyć tylko jeśli jednocześnie:

- publiczne mutacje są zablokowane,
- normalny writer jest zatrzymany lub udowodniono brak możliwości mutacji,
- wszystkie inne writery/background jobs są zatrzymane lub zablokowane,
- Auto-Deploy = Off,
- brak deployu/rollbacku/restartu w toku,
- source/config/env są zamrożone,
- exact source SHA został zapisany.

Wtedy: `E4.0 = COMPLETE` i można rozpocząć `E4.1 — Fresh Pre-Mutation Evidence`.

### ABORT / HOLD

Jeśli choć jeden z powyższych punktów nie jest potwierdzony:

`E4.0 = INCOMPLETE / HOLD`

Nie uruchamiać E4.1, migratora, DDL/DCL/DML, provisioning ról ani rotacji sekretów.
