# ETAP 3 — Gate 14C: Crypto Keyring v1/v2 Design

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status Gate 14C: **PASS — DESIGN-LEVEL / NOT APPLIED / PRODUCTION NO-GO**

> Ten PASS dotyczy projektu keyringu i kontrolowanej ścieżki przejścia. Nie oznacza rotacji sekretów, re-encryption istniejących danych, zmiany Render environment ani production GO. Żaden sekret nie został odczytany, zapisany do repo ani zmieniony.

## 1. Cel

Gate 14C ma rozdzielić jeden obecny root secret na niezależne domeny kryptograficzne bez utraty możliwości odszyfrowania istniejących danych.

Docelowo:

- `AUTH_SECRET` służy wyłącznie do funkcji uwierzytelniania/podpisu,
- wiadomości prywatne mają własny root,
- załączniki mają własny root,
- MFA ma własny root,
- legacy `v1` pozostaje czytelne do zakończenia kontrolowanej migracji,
- nowe zapisy są wykonywane wyłącznie jako `v2`,
- key version jest jawna i deterministyczna,
- wartości sekretów nigdy nie trafiają do DB, repo, logów ani dokumentacji.

## 2. Stan AS-IS

### 2.1 Config

Aktualny `config.js` działa tak:

- `AUTH_SECRET` jest wymagany,
- `MESSAGE_ENCRYPTION_KEY` jest opcjonalny i fallbackuje do `AUTH_SECRET`,
- `ATTACHMENT_ENCRYPTION_KEY` jest opcjonalny i fallbackuje do `AUTH_SECRET`,
- `MFA_ENCRYPTION_KEY` jest opcjonalny i fallbackuje do `AUTH_SECRET`.

Fresh Gate 14 potwierdził:

- `AUTH_SECRET` present = true,
- trzy dedicated encryption keys = false,
- wszystkie trzy domeny korzystają więc obecnie z key material wywiedzionego z `AUTH_SECRET`.

### 2.2 Wiadomości prywatne

Obecny format:

`enc:v1:<iv>.<tag>.<ciphertext>`

Algorytm:

- AES-256-GCM,
- 12-byte random IV,
- tag GCM,
- AAD = `${messageId}:${field}`,
- `field` = `subject` albo `body`.

Klucz domenowy `v1` jest wyprowadzany HKDF-SHA256 z obecnego rootu przy użyciu:

- salt: `gracz.pl/messages/v1`,
- info: `private-message-encryption`.

Wersja jest już zakodowana w payloadzie jako `enc:v1:`.

### 2.3 Załączniki

Obecny format jest rozdzielony na kolumny:

- `iv`,
- `auth_tag`,
- `ciphertext`.

Algorytm:

- AES-256-GCM,
- AAD dla bieżącego formatu = `${messageId}:${storageName}:${mimeType}:${fileSize}`,
- legacy decrypt zachowuje także fallback AAD bez `storageName`.

HKDF-SHA256 v1:

- salt: `gracz.pl/message-attachments/v1`,
- info: `private-message-attachment-encryption`.

Problem: rekord nie posiada jawnej `key_version`.

### 2.4 MFA

Obecny format jest rozdzielony na:

- `secret_iv`,
- `secret_tag`,
- `secret_ciphertext`.

AES-256-GCM z AAD = `userId`.

HKDF-SHA256 v1:

- salt: `gracz.pl/mfa/v1`,
- info: `totp-secret-encryption`.

Problem: rekord nie posiada jawnej `key_version`.

### 2.5 Istniejące encrypted data

Gate 11 / Gate 14 potwierdziły decryptability pod aktualnym key material oraz co najmniej:

- 5 private messages,
- 2 encrypted attachments,
- 0 MFA rows.

Dlatego natychmiastowa zmiana dedykowanych encryption env vars na nowe wartości przed wdrożeniem keyringu jest **zabroniona**.

## 3. Target keyring — root secrets

Projekt wprowadza następujące logiczne secrets:

### Legacy decrypt root

`LEGACY_CRYPTO_ROOT_V1`

- podczas kontrolowanego cutover otrzymuje **dokładnie obecny** key material używany przez v1,
- w aktualnym stanie oznacza to bezpieczne skopiowanie wartości obecnego `AUTH_SECRET` do osobnego secret slotu bez ujawniania jej operatorowi/logom,
- po aktywacji keyringu jest używany wyłącznie do decrypt `v1`, nigdy do nowych zapisów,
- nie jest traktowany jako nowy auth signing secret.

### Nowe niezależne roots v2

- `MESSAGE_ENCRYPTION_KEY_V2`
- `ATTACHMENT_ENCRYPTION_KEY_V2`
- `MFA_ENCRYPTION_KEY_V2`

Wymagania:

- każdy co najmniej 32 bytes/znaki wysokiej entropii,
- wszystkie trzy pairwise distinct,
- każdy różny od `AUTH_SECRET`,
- każdy różny od `LEGACY_CRYPTO_ROOT_V1`,
- generowane i przechowywane wyłącznie w secret manager/environment,
- wartości nigdy nie są logowane.

### Write selector

`CRYPTO_WRITE_VERSION`

Dozwolone wartości:

- `1` — compatibility stage, nowe zapisy pozostają v1,
- `2` — nowe zapisy wyłącznie v2.

W production po przejściu Gate 14C docelową wartością jest `2`.

## 4. Dlaczego nowe nazwy mają `_V2`

Nie wolno użyć nowych wartości bezpośrednio pod obecnymi nazwami:

- `MESSAGE_ENCRYPTION_KEY`,
- `ATTACHMENT_ENCRYPTION_KEY`,
- `MFA_ENCRYPTION_KEY`.

Obecny kod interpretuje te zmienne jako jedyny root do encrypt **i decrypt v1**. Ustawienie nowego sekretu pod starą nazwą przed wdrożeniem keyringu może natychmiast zerwać decryptability legacy ciphertext.

Dlatego Gate 14C używa jednoznacznych nazw `_V2` i jawnego `LEGACY_CRYPTO_ROOT_V1`.

Stare trzy nazwy powinny zostać zdeprecjonowane w nowym config contract, a nie po cichu zmienić znaczenie.

## 5. Derivation contract

### 5.1 V1 — bez zmian

Decrypt v1 musi zachować **bit-for-bit** obecną derivation i AAD.

Żadnej zmiany salt/info/AAD dla v1.

### 5.2 V2 — domain/version separation

Messages v2:

- HKDF-SHA256 root = `MESSAGE_ENCRYPTION_KEY_V2`,
- salt = `gracz.pl/messages/v2`,
- info = `private-message-encryption-v2`,
- output = 32 bytes.

Attachments v2:

- root = `ATTACHMENT_ENCRYPTION_KEY_V2`,
- salt = `gracz.pl/message-attachments/v2`,
- info = `private-message-attachment-encryption-v2`,
- output = 32 bytes.

MFA v2:

- root = `MFA_ENCRYPTION_KEY_V2`,
- salt = `gracz.pl/mfa/v2`,
- info = `totp-secret-encryption-v2`,
- output = 32 bytes.

## 6. V2 ciphertext/AAD contract

### 6.1 Messages

Nowy payload:

`enc:v2:<iv>.<tag>.<ciphertext>`

AAD:

`gracz.pl:message:v2:${messageId}:${field}`

Read contract:

- `enc:v1:` → decrypt tylko v1 message key,
- `enc:v2:` → decrypt tylko v2 message key,
- plaintext legacy without `enc:` → zachować obecną compatibility ścieżkę tylko dopóki takie rekordy istnieją,
- unknown `enc:vN:` → fail closed / nie próbować losowo innych kluczy.

Nie wykonujemy „spróbuj v2, potem v1”. Wersja wybiera dokładnie jeden klucz.

### 6.2 Attachments

Schema dostaje `key_version SMALLINT`, istniejące rows = `1`.

V2 AAD:

`gracz.pl:attachment:v2:${messageId}:${storageName}:${mimeType}:${fileSize}`

Read contract:

- key_version=1 → dokładna obecna v1 derivation + obecny compatibility AAD fallback,
- key_version=2 → wyłącznie v2 derivation + v2 AAD,
- inna wartość → fail closed.

### 6.3 MFA

Schema dostaje `key_version SMALLINT`, istniejące rows = `1`.

V2 AAD:

`gracz.pl:mfa:v2:${userId}`

Read contract:

- v1 → exact legacy decrypt,
- v2 → v2 root/derivation/AAD,
- unknown → fail closed.

Obecnie MFA rows=0, więc produkcyjna data migration dla MFA nie jest potrzebna, ale kod nadal powinien umieć odczytać v1 dla bezpieczeństwa/restore compatibility.

## 7. Keyring API — projekt kodu

Docelowo jeden centralny moduł, np. `crypto-keyring.js`, odpowiada za:

- walidację konfiguracji,
- derivation kluczy,
- wybór klucza po wersji,
- aktywną write version,
- kontrolę pairwise-distinct,
- brak logowania sekretów.

Logiczny interfejs:

- `keyring.message.encryptV2(...)`
- `keyring.message.decrypt(version, ...)`
- `keyring.attachment.encryptV2(...)`
- `keyring.attachment.decrypt(version, ...)`
- `keyring.mfa.encryptV2(...)`
- `keyring.mfa.decrypt(version, ...)`

Serwisy domenowe nie powinny samodzielnie czytać `process.env` ani implementować fallbacków między rootami.

## 8. Production configuration invariants

W `NODE_ENV=production` i `CRYPTO_WRITE_VERSION=2` startup ma failować, jeśli:

- brak `LEGACY_CRYPTO_ROOT_V1` dopóki istnieją v1 encrypted rows,
- brak któregoś z trzech v2 roots,
- dowolne dwa v2 roots są identyczne,
- v2 root == `AUTH_SECRET`,
- v2 root == legacy root,
- write version jest nieznana.

Legacy root może zostać usunięty dopiero po fresh evidence, że liczba wymagających go rekordów wynosi 0 i Gate 11-style decryptability reconciliation po rekey jest PASS.

## 9. Schema versioning

Nie zmieniamy historycznych migracji `001–014` po fakcie.

Gate 14C proponuje osobną przyszłą migrację:

`015_crypto-key-versions.sql`

Minimalny zakres:

- `gracz_message_attachments.key_version SMALLINT NOT NULL DEFAULT 1`,
- `gracz_mfa.key_version SMALLINT NOT NULL DEFAULT 1`,
- CHECK key_version IN (1,2).

Messages nie wymagają dodatkowej kolumny, ponieważ wersja jest już częścią payloadu `enc:vN:`.

## 10. Controlled transition — dual-read / new-write

### Stage C0 — current frozen state

- nic nie zmieniać w production secrets,
- zachować aktualny decryptability evidence.

### Stage C1 — deploy keyring-compatible code in compatibility mode

- czyta v1 i v2,
- write version nadal = 1,
- legacy root nadal może być pobrany z current auth material wyłącznie jako tymczasowa compatibility ścieżka,
- pełne CI i crypto regression tests.

### Stage C2 — freeze explicit legacy root

W secret manager:

- `LEGACY_CRYPTO_ROOT_V1` = dokładny obecny root v1,
- bez logowania/eksportowania wartości.

Od tego momentu v1 decrypt nie zależy logicznie od przyszłych rotacji `AUTH_SECRET`.

### Stage C3 — provision v2 roots

Bez zmiany ciphertext:

- wygenerować 3 niezależne v2 roots,
- potwierdzić obecność/distinctness tylko booleanami/fingerprint comparison bez ujawniania wartości.

### Stage C4 — switch new writes to v2

- `CRYPTO_WRITE_VERSION=2`,
- nowe messages = `enc:v2:`,
- nowe attachments/MFA = key_version=2,
- reads nadal v1+v2.

### Stage C5 — controlled re-encryption

W maintenance window / kontrolowanym one-off job:

- 5 istniejących wiadomości,
- 2 istniejące attachments,
- MFA obecnie 0.

Re-encryption musi być idempotentne i nigdy nie logować plaintextu.

### Stage C6 — reconciliation

Wymagane:

- każdy rekord decryptable przed update,
- każdy re-encrypted rekord decryptable po update,
- v1 count = 0 dla danych podlegających migracji,
- v2 count = expected total,
- no plaintext leakage,
- fresh Gate 11-style probe PASS.

### Stage C7 — retire legacy

Dopiero po C6:

- usunąć compatibility fallback `AUTH_SECRET -> v1`,
- następnie można usunąć `LEGACY_CRYPTO_ROOT_V1`, jeśli nie ma żadnych snapshot/restore requirements wymagających go online,
- `AUTH_SECRET` może być rotowany niezależnie od danych szyfrowanych.

## 11. Rekey safety contract

One-off rekey nie może:

- re-encryptować rekordu, którego nie potrafi najpierw odszyfrować,
- nadpisywać v2 ponownie,
- logować plaintext/ciphertext/keys,
- działać równolegle bez kontroli wersji,
- oznaczać sukcesu przed decrypt-after-write verification.

Dla każdego rekordu:

1. SELECT row + current version,
2. jeśli już v2 → skip,
3. decrypt v1,
4. encrypt v2 in memory,
5. UPDATE warunkowy `... WHERE key_version=1` albo dla messages `WHERE subject/body nadal mają enc:v1`,
6. ponowny SELECT,
7. decrypt v2,
8. porównanie plaintext hash in-memory / constant-time gdzie praktyczne,
9. COMMIT,
10. licznik sukcesu bez danych użytkownika.

## 12. Rollback

Podczas dual-read rollback aplikacji jest bezpieczny tylko do wersji kodu, która rozumie v2.

Po rozpoczęciu nowych zapisów v2 **nie wolno** cofać runtime do starego kodu znającego wyłącznie v1.

Dlatego przed C4 Gate 15 musi posiadać:

- rollback build z obsługą v1+v2,
- backup,
- restore rehearsal,
- dokładny cutover SHA.

Po rekey rollback danych oznacza restore zatwierdzonego backupu lub forward-fix; nie „odszyfrowanie wszystkiego z powrotem do v1” ad hoc.

## 13. Test contract

Gate 14C implementation musi posiadać testy co najmniej:

1. v1 message decrypt zachowuje exact legacy ciphertext compatibility,
2. v2 message round-trip,
3. v1 attachment decrypt zachowuje oba legacy AAD variants,
4. v2 attachment round-trip,
5. v1 MFA decrypt compatibility,
6. v2 MFA round-trip,
7. wrong domain key fails,
8. wrong version fails closed,
9. modified AAD fails authentication,
10. modified tag/ciphertext fails authentication,
11. production config odrzuca brakujące v2 roots,
12. production config odrzuca equal roots,
13. no secret values in errors/logs,
14. rekey job jest idempotentny,
15. rekey nie modyfikuje rekordu przy v1 decrypt failure,
16. v2 record nie jest ponownie re-encryptowany.

## 14. Warunki finalnego PASS Gate 14 crypto blocker

Design-level Gate 14C może być zamknięty teraz, ale blocker Gate 14 znika dopiero po fresh evidence pokazującym:

- trzy dedicated v2 roots obecne,
- pairwise distinct,
- distinct from auth/legacy root,
- new writes = v2,
- v1 legacy data nadal decryptable w transition,
- controlled rekey zakończony,
- v1 production row count = 0 (lub jawnie zatwierdzony wyjątek),
- Gate 11-style decryptability po rekey = PASS,
- brak sekretów w repo/logach,
- legacy fallback nie jest aktywnym write rootem.

## 15. Formalna decyzja

**GATE 14C = PASS — DESIGN-LEVEL CRYPTO KEYRING V1/V2 COMPLETE.**

Jednocześnie:

- code implementation keyringu nie została jeszcze wykonana,
- schema migration 015 nie została wykonana,
- żadne nowe secret values nie zostały wygenerowane ani ustawione,
- istniejące encrypted rows nie zostały zmienione,
- Render nie został dotknięty,
- Gate 14 overall pozostaje **BLOCKED — REMEDIATION REQUIRED**,
- produkcja V3 pozostaje **NO-GO**.

Następny krok po design Gate 14C: implementacja/scaffold keyringu na izolowanej gałęzi lub Gate 14D production security config design — zgodnie z sekwencją remediation, implementacja keyringu musi nastąpić przed faktycznym Gate 14 fresh PASS.
