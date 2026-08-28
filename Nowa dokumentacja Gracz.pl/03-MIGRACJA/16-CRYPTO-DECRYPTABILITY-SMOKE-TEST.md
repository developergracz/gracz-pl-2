# ETAP 3 — Privacy-safe crypto decryptability smoke test

Data: 28.08.2026
Status: **ARTEFAKT WYKONAWCZY — GOTOWY DO URUCHOMIENIA NA IZOLowanym RESTORE**

## 1. Cel

Zweryfikować Bramię 11 preflight bez ujawniania danych wrażliwych.

Test ma odpowiedzieć wyłącznie na pytania:
- ile rekordów można odszyfrować poprawnie,
- ile rekordów kończy się błędem,
- czy wykryto oczekiwany legacy format wymagający REVIEW.

Test nie może wyświetlać ani zapisywać:
- treści wiadomości,
- treści załączników,
- sekretów MFA,
- kluczy szyfrowania,
- wartości AAD,
- connection stringów,
- haseł PostgreSQL.

## 2. Zakres

Test obejmuje trzy obszary:

1. **Private messages** — `gracz_messages.subject` i `gracz_messages.body`.
2. **Message attachments** — `gracz_message_attachments`.
3. **MFA** — `gracz_mfa`.

Źródła implementacji AS-IS:
- `modern/checkers-engine/src/postgres-accounts.js`,
- `modern/checkers-engine/src/message-attachments.js`,
- `modern/checkers-engine/src/mfa-service.js`,
- `modern/checkers-engine/src/config.js`.

## 3. Potwierdzone formaty kryptograficzne

### Wiadomości
- AES-256-GCM,
- key derivation: HKDF-SHA256,
- salt: `gracz.pl/messages/v1`,
- info: `private-message-encryption`,
- envelope: `enc:v1:<iv>.<tag>.<ciphertext>`,
- AAD zależne od `message_id` i pola (`subject`/`body`).

### Załączniki
- AES-256-GCM,
- HKDF-SHA256,
- salt: `gracz.pl/message-attachments/v1`,
- info: `private-message-attachment-encryption`,
- aktualny AAD uwzględnia `message_id`, `storage_name`, MIME i rozmiar,
- istnieje legacy AAD bez `storage_name`.

### MFA
- AES-256-GCM,
- HKDF-SHA256,
- salt: `gracz.pl/mfa/v1`,
- info: `totp-secret-encryption`,
- AAD: `user_id`.

## 4. Wykonywalny test

Repozytorium zawiera:

`modern/checkers-engine/scripts/preflight/crypto-decryptability-smoke.mjs`

Właściwości bezpieczeństwa skryptu:
- akceptuje tylko host lokalny: `127.0.0.1`, `localhost` albo `::1`,
- akceptuje wyłącznie bazę `gracz_restore_test_20260828`,
- uruchamia transakcję `REPEATABLE READ READ ONLY`,
- nie wykonuje `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE` ani `DROP`,
- nie drukuje identyfikatorów rekordów,
- nie drukuje plaintextu,
- nie drukuje kluczy,
- nie drukuje wartości AAD,
- błędy są raportowane wyłącznie jako bezpieczny kod klasy błędu.

## 5. Wymagane ustawienia lokalne

Skrypt korzysta z lokalnych zmiennych środowiskowych procesu:

### PostgreSQL
- `PGHOST=127.0.0.1`
- `PGPORT=5433`
- `PGUSER=postgres`
- `PGDATABASE=gracz_restore_test_20260828`
- `PGPASSWORD` — ustawione wyłącznie lokalnie, bez zapisywania w repozytorium.

### Klucze aplikacyjne
- `MESSAGE_ENCRYPTION_KEY`,
- `ATTACHMENT_ENCRYPTION_KEY`,
- `MFA_ENCRYPTION_KEY`,
- `AUTH_SECRET` wyłącznie jako rzeczywisty fallback, jeżeli tak działał badany deploy.

**Nie wolno zgadywać kluczy ani używać nowo wygenerowanych wartości.** Smoke test ma używać dokładnie tego key material, które odpowiada ciphertextowi z backupu.

Dedykowane klucze i hasło DB należy wprowadzić tylko w lokalnej sesji PowerShell/środowisku procesu. Nie należy ich wklejać do czatu, issue, commita, pliku wynikowego ani dokumentacji.

## 6. Uruchomienie

Uruchomić z katalogu:

`modern/checkers-engine`

Polecenie:

```powershell
node .\scripts\preflight\crypto-decryptability-smoke.mjs | Tee-Object "$env:USERPROFILE\Downloads\16-CRYPTO-DECRYPTABILITY-RESULT.txt"
```

Plik wynikowy jest privacy-safe, ponieważ zawiera wyłącznie statusy i liczniki.

## 7. Format wyniku

Przykład struktury — liczby poniżej są tylko ilustracją formatu:

```json
{
  "test": "crypto-decryptability-smoke-v1",
  "database": "gracz_restore_test_20260828",
  "readOnly": true,
  "messages": {
    "total": 5,
    "success": 5,
    "failure": 0,
    "legacyExpected": 0,
    "encryptedRecords": 5,
    "status": "PASS"
  },
  "attachments": {
    "total": 2,
    "success": 2,
    "failure": 0,
    "legacyAadSuccess": 0,
    "status": "PASS"
  },
  "mfa": {
    "total": 0,
    "success": 0,
    "failure": 0,
    "status": "N/A"
  },
  "gate11Candidate": "PASS"
}
```

## 8. Kryteria interpretacji

### PASS
- każdy niepusty obszar został faktycznie przetestowany,
- `failure = 0`,
- brak nieoczekiwanego formatu legacy wymagającego decyzji.

### REVIEW
- `failure = 0`,
- ale istnieją rekordy poprawnie obsłużone jako znany legacy format, np. legacy attachment AAD albo legacy unencrypted message wymagający osobnej decyzji migracyjnej.

### FAIL
- co najmniej jeden rekord, który powinien być odszyfrowywalny, kończy się błędem GCM/AAD/key compatibility albo walidacji payloadu.

### NOT_VERIFIED
- brak wymaganej wartości key material,
- błąd połączenia z lokalną bazą,
- próba uruchomienia na innym hoście lub bazie,
- nieprawidłowa konfiguracja testu.

### N/A
- dana tabela nie zawiera rekordów do przetestowania, np. `gracz_mfa = 0`.

`N/A` nie jest błędem migracji, jeżeli nie istnieją dane tego typu do przeniesienia.

## 9. Dodatkowa walidacja bez ujawniania danych

Skrypt oprócz samego `decipher.final()` wykonuje bezpieczne kontrole integralności:
- wiadomość: oba pola `subject` i `body` muszą odszyfrować się w tym samym rekordzie,
- załącznik: długość plaintextu musi odpowiadać `file_size`, a sygnatura pliku musi być zgodna z deklarowanym PNG/JPEG,
- MFA: odszyfrowany sekret musi mieć poprawny format Base32.

Żaden z tych payloadów nie jest zwracany na stdout.

## 10. Warunek zamknięcia Bramki 11

Po uzyskaniu wyniku:

- `gate11Candidate = PASS` → Bramka 11 może zostać oznaczona **PASS** na poziomie decryptability aktualnego backupu,
- `gate11Candidate = REVIEW` → Bramka 11 może przejść do **REVIEW/WARNING** z opisem legacy przypadków,
- `gate11Candidate = FAIL` → pozostaje **BLOCKER**,
- `gate11Candidate = NOT_VERIFIED` → pozostaje **NOT VERIFIED**.

Do pełnego zamknięcia Bramy 11 należy zachować w GitHubie tylko privacy-safe wynik licznikowy i interpretację. Kluczy ani plaintextu nie zapisujemy.

## 11. Następny krok wykonawczy

1. Wprowadzić wymagane sekrety tylko lokalnie w bieżącej sesji PowerShell.
2. Uruchomić skrypt na `gracz_restore_test_20260828`.
3. Zachować wyłącznie wygenerowany privacy-safe JSON.
4. Na podstawie wyniku zaktualizować status Bramy 11 oraz główny status ETAPU 3.
