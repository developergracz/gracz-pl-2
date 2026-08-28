# ETAP 3 — Crypto Compatibility / Key-Version Inventory

Data: 28.08.2026
Status: **KODOWY FORMAT ZMAPOWANY / BRAMKA 11 = NOT VERIFIED — WYMAGANY CONTROLLED DECRYPTABILITY TEST**

## 1. Cel

Zmapować rzeczywiste formaty szyfrowania AS-IS dla:
- prywatnych wiadomości,
- załączników wiadomości,
- MFA/TOTP,

oraz ustalić, co dokładnie musi pozostać kompatybilne podczas migracji V3.

Dokument nie zawiera żadnego sekretu, connection stringa, plaintextu wiadomości ani odszyfrowanego TOTP secret.

## 2. Konfiguracja kluczy — POTWIERDZONE

`src/config.js` definiuje trzy logiczne klucze:
- `MESSAGE_ENCRYPTION_KEY`,
- `ATTACHMENT_ENCRYPTION_KEY`,
- `MFA_ENCRYPTION_KEY`.

Każdy z nich:
- musi mieć co najmniej 32 znaki, jeśli jest ustawiony,
- w razie braku wartości **fallbackuje do `AUTH_SECRET`**,
- w `production` brak dedykowanego klucza wywołuje warning, ale nie blokuje startu.

### Ryzyko CR-001

Fallback do `AUTH_SECRET` oznacza, że rotacja `AUTH_SECRET` może równocześnie zmienić material kryptograficzny dla danych historycznych, jeśli dedykowane key env vars nie były ustawione przy ich szyfrowaniu.

**Wniosek:** przed migracją nie wolno rotować/zmieniać kluczy aplikacyjnych w sposób niszczący decryptability bez key-version planu.

## 3. Prywatne wiadomości — `gracz_messages`

Źródło: `src/postgres-accounts.js`.

### Algorytm

- AES-256-GCM.
- Klucz 32 bytes przez HKDF-SHA256.
- Input secret: `MESSAGE_ENCRYPTION_KEY` albo fallback `AUTH_SECRET`.
- HKDF salt: `gracz.pl/messages/v1`.
- HKDF info: `private-message-encryption`.

### Format payload

Current encrypted text ma prefix:

`enc:v1:`

Dalej:

`base64url(iv).base64url(tag).base64url(ciphertext)`

IV ma 12 bytes.

### AAD

AAD jest zależne od rekordu i pola:
- subject: `${messageId}:subject`,
- body: `${messageId}:body`.

To oznacza, że ciphertext nie może zostać bezpośrednio przepięty do nowego message ID bez zachowania starego AAD albo kontrolowanego decrypt+re-encrypt.

### Legacy behavior

`decryptMessageText()` zwraca wartość bez odszyfrowania, jeśli nie zaczyna się od `enc:v1:`.

Zatem tabela może semantycznie obsługiwać mieszankę:
- current encrypted `enc:v1`,
- historyczny plaintext/legacy non-prefixed content.

Nie wolno jednak umieszczać plaintextu z jakiegokolwiek rekordu w raporcie preflight.

### Migracyjne znaczenie

V3 ma dwie bezpieczne opcje:
1. **preserve legacy ciphertext envelope + legacy message ID/AAD metadata**, albo
2. kontrolowane decrypt → re-encrypt do nowego versioned envelope.

Opcja 2 jest dopuszczalna wyłącznie po potwierdzonym decryptability smoke test i z jawnie wersjonowanym nowym key/envelope formatem.

## 4. Załączniki — `gracz_message_attachments`

Źródło: `src/message-attachments.js`.

### Algorytm

- AES-256-GCM.
- Klucz 32 bytes przez HKDF-SHA256.
- Input secret: `ATTACHMENT_ENCRYPTION_KEY` albo fallback `AUTH_SECRET`.
- HKDF salt: `gracz.pl/message-attachments/v1`.
- HKDF info: `private-message-attachment-encryption`.

Dane są przechowywane osobno jako BYTEA:
- `iv`,
- `auth_tag`,
- `ciphertext`.

### AAD current

Dla rekordu ze `storage_name`:

`${messageId}:${storageName}:${mimeType}:${fileSize}`

### AAD legacy compatibility

Reader posiada jawny fallback dla rekordu bez `storage_name`:

`${messageId}:${mimeType}:${fileSize}`

To jest **potwierdzony legacy AAD variant**, który migracja musi zachować lub przepisać świadomie.

### Ryzyko CR-002

Zmiana któregokolwiek z elementów AAD:
- message ID,
- storage name,
- MIME type,
- file size,

bez re-encryption spowoduje failure GCM authentication.

## 5. MFA — `gracz_mfa`

Źródło: `src/mfa-service.js`.

### Algorytm przechowywania secret

- AES-256-GCM.
- HKDF-SHA256, 32 bytes.
- Input secret: `MFA_ENCRYPTION_KEY` albo fallback `AUTH_SECRET`.
- HKDF salt: `gracz.pl/mfa/v1`.
- HKDF info: `totp-secret-encryption`.
- IV: 12 random bytes.
- DB fields: `secret_iv`, `secret_tag`, `secret_ciphertext`.

### AAD

AAD = normalized `user_id`.

Zmiana canonical user ID bez re-encryption uniemożliwi odszyfrowanie historycznego MFA secret.

### TOTP

- secret random 20 bytes, Base32,
- HMAC-SHA1,
- 6 digits,
- period 30 s,
- verify window ±1 step.

### Stan danych

W ostatnim zebranym profilu środowiska `gracz_mfa` miało 0 rekordów. To oznacza, że przy tym snapshotcie nie istnieje rekord produkcyjny pozwalający udowodnić realną decryptability MFA.

Nie jest to błąd; oznacza `NO DATA TO TEST` dla historycznego MFA ciphertext. Nadal trzeba zachować format dla przyszłej zgodności lub świadomie zresetować MFA przy zmianie modelu.

## 6. Macierz crypto compatibility

| obszar | envelope/version | key derivation | AAD | legacy variant | runtime decrypt path | status |
|---|---|---|---|---|---|---|
| message subject | `enc:v1:` | HKDF-SHA256 message key | `messageId:subject` | non-prefixed passthrough | TAK | **TEST REQUIRED** |
| message body | `enc:v1:` | HKDF-SHA256 message key | `messageId:body` | non-prefixed passthrough | TAK | **TEST REQUIRED** |
| attachment | raw BYTEA iv/tag/ciphertext | HKDF-SHA256 attachment key | current includes storage name | no-storage-name AAD | TAK | **TEST REQUIRED** |
| MFA secret | raw BYTEA iv/tag/ciphertext | HKDF-SHA256 MFA key | normalized user_id | brak drugiego variantu w current reader | TAK | **NO DATA / CONFIG REVIEW** |

## 7. Co musi sprawdzić controlled decryptability test

Test wykonujemy na izolowanej bazie restore, nie na raportowanych plaintextach.

Minimalny wynik testu ma zawierać wyłącznie liczby/statusy:

### Messages
- liczba rekordów,
- liczba subject `enc:v1`,
- liczba body `enc:v1`,
- liczba legacy/non-prefixed,
- `decrypt_success_count`,
- `decrypt_failure_count`.

Nie wypisywać subject/body po odszyfrowaniu.

### Attachments
- liczba rekordów,
- count current AAD (`storage_name IS NOT NULL`),
- count legacy AAD (`storage_name IS NULL`),
- decrypt success/failure,
- opcjonalnie cryptographic integrity only; nie wypisywać base64/plain file bytes.

### MFA
- liczba rekordów,
- decrypt success/failure,
- dla odszyfrowanego secret wolno sprawdzić wyłącznie syntaktyczną poprawność Base32/długość; nie wypisywać secret.

## 8. Warunki bezpiecznego uruchomienia smoke test

1. Test DB = izolowany restore, nie produkcja.
2. Użyć tych samych **logicznych** key values, które są używane przez deploy szyfrujący dane, ale nie kopiować ich do czatu, GitHuba ani logów.
3. Nie przekazywać sekretów w command-line argumentach, jeśli mogłyby trafić do historii/process list; preferować istniejące zmienne środowiskowe/secure secret injection.
4. Output ma być agregatem sukces/porażka, nigdy plaintext.
5. Po teście usunąć tymczasowe env vars/proces testowy zgodnie z procedurą.

## 9. Decyzja migracyjna przed V3

Do czasu smoke testu domyślna polityka brzmi:

**PRESERVE EXISTING CIPHERTEXT + ITS AAD IDENTITY; NO RE-ENCRYPTION YET.**

Nie wolno:
- masowo zmieniać `message_id` dla encrypted data bez mapy AAD,
- zmieniać attachment metadata używanego w AAD,
- zmieniać `user_id` dla MFA ciphertext bez planu,
- usuwać starych key materials przed observation/rollback window.

## 10. Key-version problem

Current implementations kodują wersję jawnie tylko dla message text (`enc:v1`). Attachment i MFA nie mają osobnej kolumny `key_version`/`encryption_version`.

### Wymaganie V3

Docelowy model powinien posiadać jawne version metadata, np. logicznie:
- encryption_version,
- key_id/key_version,
- aad_version,

bez zapisywania samego secret/key material w DB.

Pozwala to na bezpieczną rotację i wielowersyjne read compatibility.

## 11. Ocena bramki 11

### Kodowy format inventory

**COMPLETE.**

### Decryptability

**NOT VERIFIED.**

Powód: sam kod i schemat nie dowodzą, że aktualnie dostępne środowiskowe key materials odpowiadają ciphertext istniejącemu w backupie.

### Status formalny

**BRAMKA 11 — NOT VERIFIED / DDL V3 pozostaje NO-GO.**

Do zmiany na `PASS` albo kontrolowane `WARNING` potrzebny jest privacy-safe decryptability smoke test na izolowanym restore.

## 12. Następny krok

Przygotować i uruchomić **read-only crypto smoke test** na `gracz_restore_test_20260828`, używając lokalnie bezpiecznie wprowadzonych właściwych key env vars i raportując wyłącznie success/failure counters.

Dopiero potem podejmujemy decyzję preserve-as-is vs re-encrypt V3.