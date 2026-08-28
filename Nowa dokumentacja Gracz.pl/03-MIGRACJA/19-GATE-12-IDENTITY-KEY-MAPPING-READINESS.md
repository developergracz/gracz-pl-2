# ETAP 3 — Bramka 12: Identity / key mapping readiness

Data: 29.08.2026  
Status: **OPEN / REVIEW — NIE JEST JESZCZE PASS**

## 1. Cel

Bramka 12 ma udowodnić, że każda tożsamość i każdy credential/lifecycle artifact objęty migracją ma deterministyczny, bezpieczny sposób mapowania do V3 bez:
- zgadywania tożsamości,
- automatycznego merge kont,
- utraty historycznego provenance,
- resetowania haseł bez potrzeby,
- kopiowania jawnych tokenów lub sekretów,
- tworzenia nowych FK do nieistniejących canonical users.

Źródła:
- `01-PREFLIGHT-MIGRACJI.md` — Bramka 12 = Identity/key mapping readiness,
- `08-MACIERZ-DECYZJI-DQ-001-DQ-002.md`,
- `11-DQ-002-PER-ACCOUNT-EVIDENCE.md`,
- PostgreSQL V3 Iteracja 4 Identity/Role/Audit,
- PostgreSQL V3 Iteracja 6 Messaging/Chat,
- aktualny kod `postgres-accounts.js`, `secure-accounts.js`, `auth-sessions.js`, `rbac-service.js`,
- Bramka 11 crypto decryptability = PASS.

## 2. POTWIERDZONE — AS-IS identity key

Aktualny writer normalizuje login przez `normalizeUserId()`:
- dozwolone 3–32 znaki `[a-zA-Z0-9._-]`,
- zapis/odczyt używa lowercase,
- `gracz_accounts.user_id` jest PK i jednocześnie bieżącym loginem użytkownika.

### Decyzja G12-001 — canonical user key

Dla kont dopuszczonych do canonical V3:
- `v3.users.user_id = gracz_accounts.user_id`,
- `v3.users.username = gracz_accounts.user_id`,
- `v3.users.username_normalized = lower(trim(gracz_accounts.user_id))`,
- `v3.user_profiles.display_name = gracz_accounts.display_name`.

Nie generujemy nowych user IDs bez konieczności. Dzięki temu ograniczamy koszt i ryzyko mapowania FK w pozostałych bounded contexts.

## 3. DQ-002 — pięć testowych identity

Potwierdzone biznesowo jako `LEGACY-IDENTITY / TEST`:
- `gamerpl`,
- `gamerde`,
- `gracz.pl`,
- `gamerpolska`,
- `gamer`.

### Decyzja G12-002 — quarantine zamiast canonical merge

- nie wykonujemy MERGE,
- nie wykonujemy automatycznego DELETE,
- nie wymyślamy alternatywnych emaili tylko po to, aby przejść `UNIQUE(email_normalized)`,
- te identity nie są automatycznie ładowane jako aktywne canonical `v3.users`.

Historyczne zależności muszą pozostać odtwarzalne.

Messaging V3 wspiera to bez tworzenia fikcyjnego canonical usera:
- `sender_user_id` / `recipient_user_id` są nullable,
- `sender_id_snapshot` / `recipient_id_snapshot` zachowują techniczne provenance,
- user state również posiada `user_id_snapshot` obok nullable FK.

Dla audit/history, gdy legacy actor nie ma canonical usera, FK aktora pozostaje NULL, a legacy actor/target identifier musi być zachowany jako kontrolowane provenance migracyjne zgodnie z allowlistą audit payload/mapping report.

## 4. Password hashes — krytyczne mapowanie

AS-IS przechowuje:
- `salt BYTEA`,
- `password_hash BYTEA`,
- `password_hash_version SMALLINT`.

Kod potwierdza dwa scrypt profiles:
- version 1: `N=16384, r=8, p=1`,
- version 2: `N=131072, r=8, p=1`.

V3 `users` ma jedno pole `password_hash TEXT`.

### Decyzja G12-003 — wersjonowany password envelope

Nie odszyfrowujemy i nie znamy plaintextu hasła. Backfill pakuje istniejące wartości do tekstowego envelope:

`gracz-scrypt-v<version>$<salt-base64url>$<hash-base64url>`

Envelope jest wyłącznie formatem transportowym dla istniejącego salted hash; nie zawiera plaintextu.

Docelowy verifier przed writer cutover musi:
1. rozpoznać `gracz-scrypt-v1` / `gracz-scrypt-v2`,
2. użyć odpowiednich parametrów scrypt,
3. porównać wynik constant-time,
4. po poprawnym logowaniu opcjonalnie przeliczyć credential do przyszłego current format i zapisać nowy envelope/hash.

Nie wykonujemy masowego resetu haseł tylko z powodu zmiany schematu.

### PASS condition
Fresh collector musi potwierdzić, że wszystkie canonical candidates mają:
- wspieraną `password_hash_version`,
- poprawną długość salt,
- poprawną długość hash,
- brak NULL/empty credential material.

## 5. Email / status mapping

### Decyzja G12-004 — email
Dla canonical candidates:
- `email = trim(email)`,
- `email_normalized = lower(trim(email))`.

Przed backfill musi być 0 collision groups po wyłączeniu jawnie quarantined DQ-002 identities i 0 pustych emaili dla rekordów, które mają trafić do `v3.users`.

### Decyzja G12-005 — status initial mapping
Jeżeli fresh evidence nie ujawni dodatkowego persistent account-state modelu:
- `contact_verified = TRUE` -> `status='active'`,
- `contact_verified = FALSE` -> `status='pending'`.

`suspended/banned/deleted` nie są generowane z domysłu. Jeśli Gate 13 / Moderation evidence wykaże egzekwowalny stan wymagający takiego mapowania, status mapping zostanie rozszerzony przed backfill.

## 6. Auth sessions

AS-IS `gracz_auth_sessions.token_id` jest UUID session/JTI key, a V3 wymaga `token_hash`.

### Decyzja G12-006
Nie kopiujemy `token_id` bezpośrednio jako `token_hash` i nie nazywamy surowego identyfikatora hashem.

Preferowany cutover: **drain / re-login** zamiast migracji istniejących sesji, jeżeli Gate 13 fresh active-state potwierdzi 0 aktywnych sesji lub zaakceptowane krótkie okno wylogowania.

Jeżeli migracja aktywnych sesji okaże się wymagana, powstaje osobny zatwierdzony mapping/token-hash contract przed DML.

Wcześniejszy capture wykazał 0 aktywnych sesji, ale Bramka 12/13 wymaga fresh recheck przed cutover.

## 7. Password reset / registration codes

Tokeny i kody są krótkotrwałe i AS-IS przechowuje ich hash, nie plaintext.

### Decyzja G12-007
- nigdy nie przenosimy plaintext token/code,
- rekord związany z quarantined identity nie staje się aktywnym credential w V3,
- wygasłe/zużyte rekordy nie są reaktywowane,
- dla krótkotrwałych aktywnych tokenów preferowany jest drain/expiry przed cutover; migracja tylko jeśli fresh Gate 13 wymaga zachowania aktywnego workflow.

`registration_codes` pozostaje warunkową funkcją produktu również w `02-identity-audit-v3.sql`; przed produkcyjnym GO trzeba potwierdzić, czy feature pozostaje aktywny.

## 8. MFA

Bramka 11 potwierdziła:
- `gracz_mfa`: 0 rekordów,
- status: N/A.

### Decyzja G12-008
Brak bieżącego MFA backfillu. `v3.mfa_credentials` pozostaje docelową strukturą dla nowych danych. Nie wymyślamy historycznego credential material.

Jeżeli fresh snapshot przed cutover pokaże `gracz_mfa > 0`, Bramka 12 wraca do REVIEW i wymaga ponownego crypto/key mapping check dla tych rekordów.

## 9. Role / privilege mapping

AS-IS `gracz_roles.role` dopuszcza:
- `player`,
- `moderator`,
- `administrator`,
- `owner`.

V3 rozdziela:
- `roles` — słownik,
- `user_roles` — current state,
- `role_change_events` — append-only history.

### Decyzja G12-009
- seed V3 roles używa stabilnych `code` z powyższej allowlisty,
- current `gracz_roles` mapuje do `user_roles` tylko dla canonical users,
- legacy role history zachowuje `source_system/source_record_id` i nie jest deduplikowana na podstawie podobnego timestampu/tekstu,
- role przypisane quarantined identities nie tworzą aktywnego privileged V3 usera; zachowujemy provenance historyczne.

Fresh collector musi potwierdzić 0 nieznanych role values.

## 10. Bramka 12 — kryteria PASS

Bramka 12 może przejść do **PASS** dopiero, gdy fresh read-only evidence potwierdzi równocześnie:

1. wszystkie canonical candidate `user_id` spełniają docelowy format i mapują się 1:1,
2. 0 normalized-username collisions,
3. 0 normalized-email collisions w canonical candidates,
4. 0 pustych wymaganych identity fields,
5. wszystkie candidate password hashes mają wspieraną wersję/salt/hash shape,
6. DQ-002 quarantine nadal obejmuje dokładnie zatwierdzony zestaw i nie tworzy aktywnych V3 users,
7. brak nieznanych role values,
8. MFA pozostaje 0 albo ma osobno zatwierdzony mapping,
9. aktywne sessions/reset/registration workflow mają jawny drain/migrate plan,
10. counts mapowania `MIGRATE/QUARANTINE/SKIP-WITH-APPROVAL` sumują się do pełnego source setu.

## 11. Następny artefakt

Uruchomić wyłącznie read-only collector Bramy 12, który raportuje counts/statusy i nie wypisuje:
- emaili,
- password hash/salt,
- tokenów/kodów,
- MFA secretów,
- danych prywatnych wiadomości.

Do czasu wyniku collector + reconciliation:

**BRAMKA 12 = OPEN / REVIEW.**  
**PRODUKCYJNY DDL/DML = NO-GO.**
