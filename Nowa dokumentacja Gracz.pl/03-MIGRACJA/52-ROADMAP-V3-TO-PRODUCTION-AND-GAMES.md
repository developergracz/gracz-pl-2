# Gracz.pl — Roadmap V3 → Production → Games

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status wejściowy: **ETAP 4 OPEN / E4.0 INCOMPLETE-HOLD / Production V3 NO-GO**

## 1. Cel roadmapy

Ten dokument porządkuje drogę od aktualnego stanu V3 do bezpiecznego uruchomienia platformy produkcyjnej oraz dalszego uruchamiania gier.

Nie zastępuje kontraktu `44-GATE-15-ETAP4-ENTRY-CONTRACT.md`. Jeżeli roadmapa i kontrakt różnią się, kontrakt E4.0–E4.10 ma pierwszeństwo.

## 2. Ważna interpretacja „profesjonalny V3”

Aktualny proces jest prowadzony w standardzie enterprise-style: evidence-first, fail-closed, least privilege, kontrolowane migracje, rollback anchors, read-only verification i pełna dokumentacja.

Nie należy jednak nazywać całego V3 „produkcyjnie enterprise-grade” przed applied/fresh-evidence PASS. Ostateczna kwalifikacja produkcyjna następuje dopiero po E4.10 i fresh post-remediation evidence.

## 3. Faza A — Zamknięcie E4.0

Cel: pełny freeze przed pierwszą mutacją ETAPU 4.

Wymagane jednocześnie:
- publiczne mutacje zablokowane,
- `Auto-Deploy = Off`,
- brak aktywnego deploy/restart/rollback,
- każdy mutation writer `STOPPED` albo `MUTATIONS BLOCKED`,
- environment frozen,
- PR #26 `OPEN / DRAFT / NOT MERGED`,
- exact source SHA zapisany,
- finalna read-only kontrola potwierdza brak driftu.

Dopiero wtedy:

`E4.0 = COMPLETE`

oraz:

`E4.1 = READY`

## 4. Faza B — E4.1 Fresh Pre-Mutation Evidence

Przed pierwszą mutacją:
- fresh Gate 13 active-state collector,
- fresh Gate 14 AS-IS collector,
- fresh backup,
- restore rehearsal / validation,
- row-count i integrity reconciliation,
- Gate 11 legacy decryptability check,
- migrator `--plan`,
- exact migration names/checksums reconciliation.

Każdy blocker = ABORT/HOLD.

## 5. Faza C — E4.2 Code prerequisite: strict-ACL probes removal

Usunąć redundantne runtime `SELECT LIMIT 0` dla write-only tables:
- `gracz_audit_log`,
- `gracz_role_history`,
- `gracz_moderation_appeals`,
- `gracz_global_chat_reports`.

Następnie:
- pełne CI,
- Security Gate,
- review bez rozszerzenia business logic poza wymagany contract.

## 6. Faza D — E4.3 Keyring v1/v2 implementation

W kontrolowanym branch/PR:
- centralny keyring v1/v2,
- exact legacy v1 derivation/AAD compatibility,
- v2 message prefix,
- attachment/MFA key version handling,
- migration 015 dopiero po formalnym review,
- `CRYPTO_WRITE_VERSION` fail-closed,
- zero secret logging,
- regression tests v1 + v2,
- rollback build musi rozumieć v2 przed pierwszym v2 write.

## 7. Faza E — E4.4 Least-Privilege Credentials

Po fresh prechecks:
- SCRAM-SHA-256,
- utworzenie `gracz_migrator_v3`,
- utworzenie `gracz_runtime_v3`,
- credentials tylko out-of-band / secret manager,
- `DATABASE_URL != MIGRATOR_DATABASE_URL`,
- zero wartości credentiali w logach i dokumentacji.

## 8. Faza F — E4.5 Ownership / Migrator

W maintenance:
- ownership tylko zatwierdzonych V3 objects → migrator,
- migrator wyłącznie przez `MIGRATOR_DATABASE_URL`,
- plan/apply/verify,
- exact ledger,
- brak unknown migration/checksum mismatch.

Mismatch = ABORT.

## 9. Faza G — E4.6 Runtime ACL

Po przygotowaniu schema:
- runtime privileges reset do zero,
- jawny Gate 14B DML matrix,
- sequence `USAGE` tylko tam, gdzie wymagane,
- brak runtime CREATE/ownership/TRUNCATE/REFERENCES/TRIGGER,
- unknown legacy objects = zero privilege,
- read-only least-privilege verifier.

## 10. Faza H — E4.7 Crypto Environment Transition

Kolejność obowiązkowa:
1. zamrozić current v1 material jako `LEGACY_CRYPTO_ROOT_V1`,
2. potwierdzić v1 decryptability,
3. provision niezależnych v2 roots,
4. presence/distinctness verification bez wartości,
5. uruchomić keyring-compatible runtime,
6. dopiero potem `CRYPTO_WRITE_VERSION=2`,
7. controlled rekey,
8. reconciliation `v1=0` dla migrowanych rekordów,
9. fresh decryptability verification.

Po pierwszym v2 write nie wolno cofać się do runtime v1-only.

## 11. Faza I — E4.8 Production Security Environment

Docelowy runtime:
- `NODE_ENV=production`,
- `PUBLIC_BASE_URL=https://gracz.pl`,
- `TURNSTILE_HOSTNAME=gracz.pl`,
- Turnstile pair complete,
- Resend complete,
- Twilio complete albo fully disabled,
- dedicated `AUDIT_HASH_SALT`,
- proxy trust flags tylko po dowodzie topologii,
- runtime `DATABASE_URL=gracz_runtime_v3`,
- brak `MIGRATOR_DATABASE_URL` w normalnym runtime.

Następnie Gate 14D read-only env verifier.

## 12. Faza J — E4.9 Start Target Runtime

Start wyłącznie jeśli:
- schema ledger exact,
- strict runtime ACL PASS,
- config verifier PASS,
- crypto verifier PASS,
- deployed runtime build SHA zatwierdzony.

Fail-closed startup failure = ABORT/repair, nigdy bypass.

## 13. Faza K — E4.10 Fresh Post-Remediation Evidence

Po starcie target runtime:
- fresh Gate 14 collector,
- Gate 14B ACL verifier,
- Gate 14C version/rekey verifier,
- Gate 14D env verifier,
- Gate 11-style decryptability probe,
- negative DDL/admin privilege tests,
- browser/auth critical journeys,
- Security Gate / CodeQL / gitleaks dla exact deployed SHA.

Dopiero po pozytywnym wyniku tego zestawu:

`Gate 14 overall: BLOCKED -> PASS`

oraz może zostać wydana właściwa decyzja produkcyjna dla V3.

## 14. Po E4.10 — Production V3

Po applied/fresh-evidence PASS:
- utrzymać monitoring i alerting,
- zachować rollback anchors,
- prowadzić deploy history,
- okresowo powtarzać restore validation,
- monitorować auth/crypto/audit/DB privilege drift,
- utrzymywać incident/rollback runbook.

To jest moment, w którym V3 może być traktowany jako produkcyjny fundament Gracz.pl.

## 15. Gry po V3 — priorytet produkcyjny

### 15.1 Warcaby

Warcaby nie są projektem od zera. Po V3 główne zadania to:
- końcowa zgodność reguł,
- multi-capture dama,
- reconnect/resume,
- stabilność multiplayer,
- lobby/stoły,
- finalne UI konsoli,
- testy regresji i przeciążeniowe,
- integracja z docelowym auth/session/runtime V3.

Szacunek po zamknięciu V3: około **1–3 tygodnie** zależnie od liczby defektów końcowych.

### 15.2 Gomoku

Gomoku również istnieje i powinno ponownie wykorzystać wspólną infrastrukturę V3:
- auth/session,
- lobby/presence,
- realtime,
- reconnect,
- chat,
- ranking/telemetry.

Szacunek po V3: około **1–2 tygodnie** przy współdzielonej infrastrukturze z Warcabami.

### 15.3 Tysiąc

Tysiąc pozostaje większym osobnym produktem:
- pełny engine zasad,
- licytacja,
- meldunki,
- punktacja,
- lifecycle partii,
- reconnect/state recovery,
- multiplayer/realtime,
- anti-cheat/state validation,
- UI i testy.

Szacunek po V3: około **6–10 tygodni** do pierwszej uczciwej wersji produkcyjnej, zależnie od zakresu lobby/turniejów/rankingu.

## 16. Zalecana kolejność po produkcyjnym V3

1. Ustabilizować Warcaby na V3.
2. Ustabilizować Gomoku na tej samej infrastrukturze.
3. Wydzielić wspólną warstwę lobby/realtime/reconnect/ranking.
4. Dopiero potem rozwijać Tysiąca jako trzecią pełną grę.
5. Turnieje, premium UI, marketplace i AI rozszerzać dopiero na stabilnym wspólnym fundamencie.

## 17. Aktualny status roadmapy

- ETAP 3: **CLOSED**
- Gate 15: **GO TO ETAP 4**
- ETAP 4: **OPEN**
- E4.0: **INCOMPLETE / HOLD**
- E4.1–E4.10: **BLOCKED BY E4.0**
- Production V3: **NO-GO**
- Warcaby: istnieją, wymagają production hardening/integration po V3
- Gomoku: istnieje, wymaga production hardening/integration po V3
- Tysiąc: osobny większy development stream po ustabilizowaniu fundamentu V3

## 18. Zasada końcowa

Nie przyspieszamy V3 kosztem bezpieczeństwa. Najszybszą drogą do produkcji jest zachowanie deterministycznej sekwencji E4.0–E4.10, ponieważ omijanie freeze, fresh evidence, least privilege albo crypto reconciliation tworzy ryzyko kosztownego rollbacku później.
