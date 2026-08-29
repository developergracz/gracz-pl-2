# ETAP 3 — Gate 14C: Controlled Rekey Runbook i PASS Criteria

Data: 29.08.2026  
Status: **DESIGN ONLY / NO PRODUCTION EXECUTION AUTHORIZED**

## 1. Cel runbooka

Ten dokument definiuje późniejszą, kontrolowaną operację przejścia encrypted data z v1 do v2 po wdrożeniu i przetestowaniu keyringu.

Nie zawiera sekretów ani ich fingerprintów.

## 2. Bezwarunkowe preconditions

Rekey może rozpocząć się dopiero, gdy:

1. keyring code obsługuje read v1 + v2,
2. proposed migration 015 została zatwierdzona i wykonana przez migrator,
3. runtime rollback build również rozumie v2,
4. backup i restore rehearsal są aktualne,
5. Gate 13 cutover active-state check jest czysty,
6. maintenance/stop mutations aktywne,
7. `LEGACY_CRYPTO_ROOT_V1` został bezpiecznie zamrożony,
8. trzy v2 roots istnieją i są pairwise distinct,
9. `CRYPTO_WRITE_VERSION=2` został zweryfikowany na kontrolowanym runtime,
10. fresh read-only crypto version inventory wykonany,
11. fresh v1 decryptability probe = PASS.

Brak dowolnego warunku = **ABORT / NO-GO**.

## 3. Scope oczekiwany z obecnego evidence

Aktualny evidence przed Gate 14C wskazuje co najmniej:

- 5 private messages,
- 2 encrypted attachments,
- 0 MFA rows.

Przed realnym rekey liczby muszą zostać ponownie zebrane. Nie wolno przyjmować tych wartości jako aktualnych w dniu cutover.

## 4. Kolejność domen

Rekomendowana kolejność:

1. MFA — jeśli nadal 0 rows, tylko potwierdzenie braku migracji danych,
2. attachments — mały, binarny zestaw, łatwy do indywidualnej weryfikacji,
3. private messages — subject + body atomowo per message.

Powód: zaczynamy od domeny o najmniejszym ryzyku i najmniejszej liczbie rekordów.

## 5. Rekey transaction — attachments

Dla każdego rekordu `key_version=1`:

1. SELECT metadata + encrypted fields w procesie maintenance tool,
2. decrypt przy użyciu exact v1 attachment key i v1 AAD compatibility logic,
3. jeśli decrypt fail → ROLLBACK/ABORT, bez UPDATE,
4. encrypt plaintext in-memory v2 key + v2 AAD,
5. UPDATE wszystkich encrypted fields + `key_version=2` z warunkiem `WHERE message_id=$1 AND key_version=1`,
6. wymagać rowCount=1,
7. SELECT updated record,
8. decrypt jako v2,
9. compare plaintext hash/bytes in memory,
10. COMMIT,
11. zero plaintext/ciphertext in logs.

## 6. Rekey transaction — messages

Dla każdego message, którego subject/body są `enc:v1:`:

1. SELECT `message_id`, subject, body,
2. wymagać obu pól v1; mixed version = ABORT/manual reconciliation,
3. decrypt subject v1,
4. decrypt body v1,
5. jeśli którekolwiek fail → brak UPDATE,
6. encrypt subject i body v2 in memory,
7. UPDATE obu kolumn w jednej transakcji z optimistic predicate wymagającym nadal v1,
8. SELECT after update,
9. decrypt obu jako v2,
10. porównać in-memory plaintext/hash,
11. COMMIT.

Subject/body nigdy nie mogą zostać pozostawione w mixed v1/v2 state.

## 7. MFA

Jeżeli fresh inventory nadal pokazuje 0 rows:

- nie wykonuje się DML rekey,
- pierwszy nowy MFA zapis po switchu musi mieć `key_version=2`,
- test restore compatibility powinien nadal potwierdzić możliwość v1 decrypt dla starszego snapshotu testowego.

Jeśli fresh inventory pokaże rekordy v1, stosuje się taki sam pattern: decrypt v1 → encrypt v2 → conditional update → decrypt-after-write verification.

## 8. Batch / locking policy

Przy obecnym małym wolumenie preferowana jest maintenance-mode migracja rekord-po-rekordzie lub w małych batchach.

- nie utrzymywać jednej długiej transakcji dla wszystkich domen,
- lock_timeout i statement_timeout muszą być ograniczone,
- rekey job musi być single-writer,
- każdy commit zwiększa licznik bez identyfikatorów użytkownika w logu,
- każdy błąd zatrzymuje dalsze rekey do wyjaśnienia.

## 9. Logging contract

Dozwolone logi:

- domena,
- wersja source/target,
- licznik scanned/skipped/migrated/failed,
- ogólny error code,
- timestamp/run id.

Zabronione:

- secret values,
- plaintext,
- ciphertext,
- IV/tag,
- message subject/body,
- MFA secret,
- attachment bytes,
- pełne connection strings.

## 10. Pre/post evidence

Przed rekey:

- read-only version inventory,
- decryptability v1 counts,
- backup identity/SHA evidence,
- application SHA,
- migration ledger version.

Po rekey:

- version inventory ponownie,
- v1 count = 0 dla migrowanego zakresu,
- mixed/unknown version = 0,
- v2 decryptability = 100%,
- message/attachment logical content fingerprint before/after = equal,
- DB row counts = expected,
- no unexpected DML outside encrypted fields/version metadata.

## 11. Failure policy

### Failure przed UPDATE

- nie zmieniać rekordu,
- ABORT run.

### Failure po UPDATE przed verification

- ROLLBACK transakcji danego rekordu,
- ABORT run.

### Crash pomiędzy rekordami

- już zweryfikowane v2 rows pozostają v2,
- restart job skipuje v2,
- kontynuuje wyłącznie v1,
- to zapewnia idempotency.

### Mixed message version

- nie próbować automatycznej naprawy przez zgadywanie,
- sklasyfikować i ręcznie zreconcile przed dalszym runem.

## 12. Legacy root retirement criteria

`LEGACY_CRYPTO_ROOT_V1` może zostać wycofany z aktywnego runtime dopiero, gdy wszystkie są true:

- messages v1 = 0,
- attachments v1 = 0,
- MFA v1 = 0,
- unknown/mixed versions = 0,
- full v2 decrypt probe = PASS,
- restore strategy dla historycznych backupów jest jawnie rozwiązana,
- rollback build nie wymaga active v1 root do bieżącej bazy,
- Gate 15 zatwierdził cutover state.

Uwaga: historyczne backupy utworzone przed rekey mogą nadal wymagać legacy root. Dlatego usunięcie go z **runtime** nie musi oznaczać natychmiastowego zniszczenia bezpiecznie escrowed key material potrzebnego do disaster recovery zgodnie z polityką retencji.

## 13. AUTH_SECRET rotation

Po zamrożeniu legacy root do osobnego slotu i po wdrożeniu keyring code `AUTH_SECRET` przestaje być logicznym decrypt rootem.

Faktyczna rotacja `AUTH_SECRET` jest jednak osobną operacją security/cutover i nie powinna być łączona z rekey danych w tym samym kroku. Minimalizuje to blast radius i ułatwia rollback.

## 14. Final Gate 14C runtime PASS evidence

Finalny Gate 14C runtime remediation może zostać uznany za PASS dopiero po dowodzie:

- v2 roots configured,
- roots distinct,
- write version=2,
- v1 dual-read działa przed rekey,
- rekey = complete,
- version inventory clean,
- decryptability=100%,
- logical content fingerprints preserved,
- no secret leakage,
- legacy root nie jest używany do nowych zapisów.

## 15. Obecna decyzja

Na dzień utworzenia tego runbooka:

- **Gate 14C design = PASS**,
- **Gate 14C production remediation = NOT APPLIED**,
- **Gate 14 overall = BLOCKED**,
- **Production V3 = NO-GO**.
