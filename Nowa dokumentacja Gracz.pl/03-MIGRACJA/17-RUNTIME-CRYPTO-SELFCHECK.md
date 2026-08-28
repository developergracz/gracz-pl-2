# ETAP 3 — Runtime crypto decryptability self-check

Data: 29.08.2026
Status: **DECRYPTABILITY PASS / RUNTIME↔RESTORE FINGERPRINT CORRELATION PENDING EXACT RUNTIME HASH**

## Cel

Domknięcie kompatybilności kryptograficznej bez ujawniania produkcyjnego materiału kluczowego poza runtime Render oraz zachowanie privacy-safe dowodu korelacyjnego z lokalnym restore.

## Runtime self-check

Na gałęzi `feature/homepage-game-center` jednorazowo uruchomiono `runtime-crypto-selfcheck-and-start.mjs`. Self-check korzystał z rzeczywistego runtime aplikacji i istniejących endpointów, dzięki czemu odszyfrowanie wykonywał kod AS-IS z właściwym materiałem kluczowym obecnym w `process.env`.

Potwierdzony wynik funkcjonalny:
- `readOnlyProbe = true`,
- private messages: **5/5 success, 0 failure, PASS**,
- attachments: **2/2 success, 0 failure, PASS**,
- MFA: **0 rekordów, N/A**,
- `gate11Candidate = PASS`.

Self-check nie wypisywał plaintextu, kluczy, AAD, connection stringów ani sekretów.

## Cleanup — wykonany i potwierdzony Live

Po zebraniu wyniku usunięto tymczasową ścieżkę:
1. normalny start aplikacji przywrócony — commit `c2de7b5630a05a888e69988c09a1e8653907bf36`,
2. tymczasowe `COPY scripts ./scripts` cofnięte — commit `62e5cb7e259842c060e0e2174f26ad4e1fd0bc00`,
3. runtime self-check usunięty — commit `e01b40e18442194870f9b465fd0007c12840010c`.

Render Events potwierdził `Deploy live for e01b40e` 29.08.2026. Tymczasowy kod diagnostyczny nie pozostaje w aktywnym obrazie.

## Niezależny fingerprint lokalnego restore

Na `gracz_restore_test_20260828` uruchomiono `modern/checkers-engine/scripts/preflight/crypto-ciphertext-fingerprint.mjs`.

Właściwości testu:
- tylko localhost,
- tylko baza `gracz_restore_test_20260828`,
- `REPEATABLE READ READ ONLY`,
- brak kluczy szyfrowania,
- brak plaintextu,
- brak sekretów,
- identyczny algorytm fingerprintu jak w runtime self-checku.

Wynik lokalny:

```json
{
  "test": "crypto-ciphertext-fingerprint-v1",
  "database": "gracz_restore_test_20260828",
  "readOnly": true,
  "messages": {
    "total": 5,
    "ciphertextSha256": "b2c671d29bbe99956e054c71f747e72cff1ff71ef239f25c5aa14b07b49db31c"
  },
  "attachments": {
    "total": 2,
    "ciphertextSha256": "730fabeada8cfdf02ee0421d8abb31b8ef1f68554c14dc90e9c9bd1b03dda327"
  },
  "status": "PASS"
}
```

## Korekta dowodowa

Wcześniej fingerprinty runtime zostały przepisane ręcznie z logu jako tekst. Przepisane ciągi nie mają poprawnej długości 64 znaków dla SHA-256, dlatego **nie są traktowane jako wiarygodny dowód bitowej równości**.

Nie oznacza to błędu kryptografii ani błędu backupu. Oznacza wyłącznie, że dokładne porównanie runtime↔restore trzeba wykonać z oryginalnej linii `[preflight.crypto]` w historycznym logu Render albo z innym bezpośrednim capture dokładnych 64-znakowych fingerprintów.

Do czasu tego porównania:
- **Bramka 11 decryptability = PASS**,
- **runtime key compatibility z bieżącym ciphertextem = PASS**,
- **lokalny restore fingerprint collector = PASS**,
- **twierdzenie „runtime ciphertext jest bitowo identyczny z tym konkretnym restore” = PENDING EXACT HASH COMPARISON**.

## Decyzja

DDL V3 może pozostawać w fazie REVIEW. Produkcyjne DDL/DML pozostaje **NO-GO** do czasu zamknięcia pozostałych bramek preflight oraz pełnego łańcucha dowodowego wymaganych korelacji.
