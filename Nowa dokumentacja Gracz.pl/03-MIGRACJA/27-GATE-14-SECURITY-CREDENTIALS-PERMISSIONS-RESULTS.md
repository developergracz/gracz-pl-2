# ETAP 3 — Gate 14: Security / Credentials / DB Permissions — RESULTS

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4 + Render test runtime  
Status: **GATE 14 = BLOCKED — REMEDIATION REQUIRED**

## 1. Cel

Gate 14 ma potwierdzić, że przed migracją V3:

- runtime DB principal działa z least privilege,
- uprawnienia DDL i runtime DML są rozdzielone,
- połączenie DB jest szyfrowane,
- polityka credential/password jest odpowiednia,
- sekrety aplikacyjne są obecne, odpowiednio długie i rozdzielone według funkcji,
- security providers są spójnie skonfigurowane,
- żadne wartości sekretów nie trafiają do dokumentacji ani logów collectora.

Collector SQL:
`26-GATE-14-SECURITY-CREDENTIALS-PERMISSIONS-COLLECTOR.sql`

## 2. Fresh evidence

Capture:
- timestamp: `2026-08-29T00:40:12.972Z`,
- database: `gracz_pl_database`,
- PostgreSQL: 18.4,
- current DB role: `gracz_pl_database_user`,
- GitHub Actions run: `33222770175`,
- job: `99024402951`,
- artifact id: `9706264073`,
- collector: `PASS-COLLECTOR`,
- `transaction_read_only=on`,
- normal application not started by collector.

`PASS-COLLECTOR` oznacza poprawne zebranie dowodu. Nie oznacza PASS Gate 14.

## 3. Połączenie PostgreSQL — PASS / WARNING

Fresh wynik:

- server SSL enabled: **1**,
- current connection SSL: **1**,
- row_security setting: **on**,
- `password_encryption_scram_sha_256`: **0**.

### Ocena

**PASS:** połączenie aplikacja ↔ PostgreSQL jest szyfrowane SSL.

**BLOCKER/REMEDIATION:** server/session setting dla nowych haseł ról nie jest potwierdzony jako `scram-sha-256`. Ten wynik nie dowodzi formatu już istniejącego credentiala obecnej roli; dowodzi jedynie, że bieżące ustawienie `password_encryption` nie jest SCRAM-SHA-256.

Dla nowych ról V3 credential należy tworzyć/rotować wyłącznie przy jawnie wymuszonej polityce SCRAM-SHA-256.

## 4. Runtime DB role — krytyczny blocker least privilege

Fresh role attributes:

- `rolsuper = 0` — PASS,
- `rolreplication = 0` — PASS,
- `rolbypassrls = 0` — PASS,
- `rolcanlogin = 1`,
- `rolcreatedb = 1` — **BLOCKER**,
- `rolcreaterole = 1` — **BLOCKER**,
- direct role memberships = 0.

Database/schema:

- current role jest właścicielem bazy: **1**,
- `database CREATE`: **1**,
- `public schema CREATE`: **1**,
- `public schema USAGE`: 1.

Tables:

- public tables total: **28**,
- tables owned by current role: **28/28**,
- SELECT: 28/28,
- INSERT: 28/28,
- UPDATE: 28/28,
- DELETE: 28/28,
- TRUNCATE: 28/28,
- REFERENCES: 28/28,
- TRIGGER: 28/28.

Sequences:

- total: **8**,
- owned by current role: **8/8**,
- USAGE/SELECT/UPDATE: 8/8.

### Decyzja

Obecny principal jest administracyjno-właścicielski, nie application least-privilege.

**To jest Gate 14 BLOCKER.**

Nie wolno używać tak szerokiego principal jako docelowego stałego runtime writera V3.

## 5. PUBLIC grants — PASS

Fresh wynik:

- PUBLIC schema CREATE grants: **0**,
- PUBLIC table SELECT grants: **0**,
- PUBLIC table write grants: **0**,
- default ACL PUBLIC write entries: **0**.

**PASS.** Nie wykryto niekontrolowanego dostępu `PUBLIC` do tabel ani write/DDL surface przez PUBLIC ACL.

## 6. RLS — informacja, nie automatyczny blocker

Fresh wynik:

- RLS-enabled tables: **0**,
- RLS-forced tables: **0**.

Aktualna aplikacja opiera autoryzację na warstwie serwisowej, nie na PostgreSQL RLS. Sam brak RLS nie jest automatycznym blockerem Gate 14, ale V3 security architecture powinna jawnie zdecydować, czy RLS jest wymagane dla wybranych domen.

## 7. Sekrety kryptograficzne — krytyczny blocker separacji kluczy

Runtime collector zwrócił tylko booleany, nigdy wartości.

### Potwierdzone

- `AUTH_SECRET` present: **true**,
- `AUTH_SECRET` >=32: **true**,
- `DATABASE_URL` present: **true**.

### Nieobecne dedykowane root secrets

- `MESSAGE_ENCRYPTION_KEY` present: **false**,
- `ATTACHMENT_ENCRYPTION_KEY` present: **false**,
- `MFA_ENCRYPTION_KEY` present: **false**,
- all dedicated: **false**,
- pairwise distinct from `AUTH_SECRET`: **false**.

Aktualny `config.js` świadomie fallbackuje brakujące trzy klucze do `AUTH_SECRET` i w production wypisuje warning, że powinny być osobne.

### Decyzja

**Gate 14 BLOCKER.**

Jeden root secret nie powinien pełnić równolegle roli:

- authentication signing root,
- message encryption root,
- attachment encryption root,
- MFA secret encryption root.

### Ważne: nie wolno teraz po prostu ustawić nowych kluczy

Gate 11 potwierdził decryptability istniejących szyfrogramów pod aktualnym runtime key material.

AS-IS zawiera co najmniej:
- 5 private messages,
- 2 encrypted attachments,
- 0 MFA rows.

Natychmiastowa podmiana `MESSAGE_ENCRYPTION_KEY` / `ATTACHMENT_ENCRYPTION_KEY` bez key-version/keyring albo controlled re-encryption mogłaby uniemożliwić odczyt istniejących danych.

Dlatego obecne sekrety pozostają bez zmian do zatwierdzonego crypto migration step.

## 8. Security providers — mixed PASS / REVIEW

### Turnstile

- site key present: **true**,
- secret key present: **true**,
- pair complete: **true**,
- partial config: **false**,
- expected hostname present: **false**.

**Provider pair = PASS.**

**Hostname binding = REVIEW / remediation recommended.** Aktualny kod, gdy `TURNSTILE_HOSTNAME` jest pusty, nie wymusza dopasowania hostname z odpowiedzi Turnstile. Dla production target należy ustawić oczekiwany hostname (`gracz.pl`, z obsługą `www.gracz.pl` już przewidzianą w kodzie).

### E-mail / Resend

- Resend API key present: **true**,
- explicit e-mail sender present: **true**.

**PASS dla konfiguracji provider-presence.** Collector nie wykonywał wysyłki wiadomości i nie ujawniał API key.

### SMS / Twilio

- complete: false,
- disabled: **true**,
- partial: false.

To jest spójny stan `DISABLED`, nie błędna konfiguracja częściowa. SMS może pozostać opcjonalny, o ile product scope V3 nie wymaga SMS recovery.

## 9. Runtime environment mode — blocker dla production certification

- `node_env_production = false`.

Collector działał na testowym Render service. To jest ważny sygnał: nie można na podstawie tego runtime certyfikować, że production-only security behavior jest aktywne.

W szczególności `AdaptiveBotDefense` wymusza Turnstile dla rejestracji/resetu zawsze tylko wtedy, gdy `NODE_ENV=production`.

### Decyzja

Przed production GO należy potwierdzić docelowy runtime z:

`NODE_ENV=production`

oraz ponownie wykonać security behavior verification.

Nie zmieniamy tej zmiennej w ramach read-only audytu.

## 10. PUBLIC_BASE_URL — REVIEW

- explicit `PUBLIC_BASE_URL` present: **false**,
- HTTPS check nie wykazał wartości nie-HTTPS.

Newsletter ma bezpieczny kodowy fallback do `https://gracz.pl`, ale docelowy production deployment powinien jawnie ustawić canonical public base URL, aby konfiguracja nie zależała od implicit default.

## 11. Gate 14 — decyzja

**GATE 14 = BLOCKED — REMEDIATION REQUIRED.**

### Krytyczne blockery

1. **DB least privilege failure**
   - runtime role = database owner,
   - `CREATEDB=1`,
   - `CREATEROLE=1`,
   - schema/database CREATE,
   - owner 28/28 tables i 8/8 sequences,
   - pełne INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES.

2. **Crypto root separation failure**
   - brak trzech dedykowanych encryption root secrets,
   - fallback do `AUTH_SECRET`.

3. **Production environment not certified**
   - test runtime nie ma `NODE_ENV=production`, więc production-only security paths nie są dowiedzione.

4. **DB credential policy**
   - bieżące `password_encryption` nie zostało potwierdzone jako SCRAM-SHA-256.

### Security hardening wymagane przed PASS

5. ustawić `TURNSTILE_HOSTNAME` dla docelowego production hosta,
6. jawnie ustawić production `PUBLIC_BASE_URL`.

## 12. Bezpieczny remediation plan — bez wykonywania teraz DDL/DCL

### Faza A — rozdział migrator vs runtime

Docelowo utworzyć osobne principals:

- **migration/owner role** — DDL, ownership, controlled migrations,
- **application runtime role** — tylko wymagane `CONNECT`, schema `USAGE`, precyzyjne DML na tabelach oraz minimalne sequence `USAGE`.

Runtime role nie powinien mieć:

- SUPERUSER,
- CREATEDB,
- CREATEROLE,
- REPLICATION,
- BYPASSRLS,
- database/schema CREATE,
- object ownership,
- TRUNCATE,
- TRIGGER,
- REFERENCES, jeśli runtime ich nie potrzebuje.

### Faza B — usunąć runtime DDL z startup path

Aktualne serwisy wykonują `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE`, `CREATE INDEX` podczas `initialize()`.

Zanim runtime dostanie least privilege:

- DDL musi zostać przeniesiony do kontrolowanego migration step,
- normalny `src/main.js` nie może wymagać ownership/CREATE do startu,
- schema version/migration state musi być sprawdzany read-only przy starcie, a nie naprawiany ad hoc przez runtime.

Bez tego przełączenie aplikacji na least-privilege role spowoduje startup failure.

### Faza C — crypto key versioning

Nie rotować obecnych kluczy w ciemno.

Docelowy plan:

1. zachować obecny key material jako **legacy decrypt key / v1** w kontrolowanym keyring,
2. wygenerować niezależne nowe secrets dla:
   - messages,
   - attachments,
   - MFA,
3. oznaczyć nowy zapis jako **v2**,
4. wykonać controlled re-encryption/backfill albo utrzymać dual-read v1/v2 do zakończenia migracji,
5. po reconciliation wycofać legacy fallback.

MFA ma obecnie 0 rows, więc jego dedykowany klucz może zacząć od nowej wersji bez re-encryption istniejącego MFA payloadu.

### Faza D — production environment

Przed GO:

- `NODE_ENV=production`,
- Turnstile pair + hostname binding,
- canonical `PUBLIC_BASE_URL=https://gracz.pl`,
- provider readiness recheck,
- fresh Gate 14 collector na docelowym runtime.

### Faza E — credential creation policy

Nowe migration/runtime DB credentials tworzyć przy jawnie wymuszonym `scram-sha-256` i bez wypisywania credentiali do repo/logów/dokumentacji.

## 13. Warunek PASS Gate 14

Gate 14 może przejść na PASS dopiero po fresh evidence pokazującym co najmniej:

- runtime role nie jest ownerem i nie ma DDL/admin privileges,
- minimalny required table/sequence privilege set,
- PUBLIC write grants = 0,
- SSL = on,
- SCRAM policy dla nowych credentials,
- dedykowane crypto roots są obecne i rozdzielone,
- legacy crypto data pozostaje decryptable po key-version transition,
- production runtime ma `NODE_ENV=production`,
- Turnstile hostname binding aktywne,
- brak sekretów w repo/logach.

## 14. Cleanup diagnostyki

Po capture przywrócono normalny application start i usunięto tymczasowy proxy.

Cleanup commit na `feature/homepage-game-center`:

`3dfb9ab9f1e069afc831d44b81e020c04c9a3466`

Repo state:
- `npm start` = `node --require ./src/pg-secure-preload.cjs src/main.js`,
- `gate14-security-proxy.mjs` = usunięty.

Finalny Render-live cleanup deploy należy traktować jako osobny operational evidence, jeśli Gate 15 będzie wymagał potwierdzenia konkretnego live SHA.

## 15. Następny krok

Gate 15 nie może jeszcze wydać GO.

Następnym krokiem ETAPU 3 jest **Gate 14 remediation design / implementation plan**, a dopiero po bezpiecznym wdrożeniu zmian i fresh rechecku można przejść do finalnego Gate 15 GO/NO-GO.

Produkcja V3: **NO-GO**.
