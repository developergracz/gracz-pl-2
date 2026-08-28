# ETAP 3 — Privacy-safe crypto decryptability smoke test

Data: 29.08.2026
Status: **PASS — BRAMKA 11 / DECRYPTABILITY POTWIERDZONE**

## 1. Cel

Zweryfikować, czy aktualny materiał kluczowy runtime Gracz.pl potrafi poprawnie odszyfrować istniejący ciphertext bez ujawniania danych wrażliwych.

Test miał raportować wyłącznie:
- liczbę rekordów,
- liczbę sukcesów,
- liczbę błędów,
- status,
- privacy-safe SHA-256 zaszyfrowanego korpusu.

Nie raportowano:
- plaintextu wiadomości,
- treści załączników,
- sekretów MFA,
- kluczy szyfrowania,
- wartości AAD,
- connection stringów ani haseł PostgreSQL.

## 2. Zakres

Test objął:
1. private messages — `gracz_messages`,
2. message attachments — `gracz_message_attachments`,
3. MFA — `gracz_mfa`.

Formaty kryptograficzne pozostają zgodne z inventory w `15-CRYPTO-COMPATIBILITY-INVENTORY.md`:
- wiadomości: AES-256-GCM + HKDF-SHA256, envelope `enc:v1`, AAD zależne od `message_id` i pola,
- załączniki: AES-256-GCM + HKDF-SHA256, AAD zawierające `message_id`, `storage_name`, MIME i rozmiar, z obsługą znanego wariantu legacy,
- MFA: AES-256-GCM + HKDF-SHA256, AAD = `user_id`.

## 3. Próba lokalna

Lokalny tester `modern/checkers-engine/scripts/preflight/crypto-decryptability-smoke.mjs` został uruchomiony przeciw izolowanemu restore `gracz_restore_test_20260828` w trybie read-only.

Połączenie z bazą i wymuszenie trybu read-only zadziałały, ale lokalnie dostępny materiał `AUTH_SECRET` nie został uznany za wiarygodny key material i tester zwrócił `AUTH_SECRET_INVALID`.

Nie obniżono wymagań kryptograficznych i nie użyto zastępczej wartości typu `present`. Zamiast przenosić produkcyjny sekret poza Render, wykonano runtime self-check wewnątrz usługi.

## 4. Runtime self-check — wynik

Wariant runtime został uruchomiony na aktywnej usłudze `gracz-checkers-test` z kluczami już obecnymi w środowisku procesu Render.

Self-check działał odczytowo i korzystał z istniejących ścieżek aplikacyjnych do deszyfracji.

Privacy-safe wynik przekazany z logu `[preflight.crypto]`:

```json
{
  "test": "runtime-crypto-selfcheck-v2",
  "readOnlyProbe": true,
  "messages": {
    "total": 5,
    "success": 5,
    "failure": 0,
    "status": "PASS",
    "ciphertextSha256": "b26c71d29bbe99965e054c717f47e7cf1ff71ef239f25c5aa14b07b49db31c3"
  },
  "attachments": {
    "total": 2,
    "success": 2,
    "failure": 0,
    "status": "PASS",
    "ciphertextSha256": "730fabedaa8cff02e0421d8abb31b8ef1168554c14de90e9c9bd1b03dda327"
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

Uwaga dokumentacyjna: w ręcznie przekazanym zapisie wyniku wystąpiła literówka nazwy pola `gate1Candidate`; implementacja self-checka używa pola `gate11Candidate`. Wartość wyniku była `PASS`.

## 5. Interpretacja

### Messages
- total: **5**
- success: **5**
- failure: **0**
- pokrycie: **100%**
- status: **PASS**

### Attachments
- total: **2**
- success: **2**
- failure: **0**
- pokrycie: **100%**
- status: **PASS**

### MFA
- total: **0**
- status: **N/A**

`N/A` dla MFA nie jest błędem migracyjnym, ponieważ w badanym zbiorze nie ma rekordów MFA do odszyfrowania.

## 6. Fingerprint ciphertextu

Zachowano wyłącznie SHA-256 zaszyfrowanego korpusu:
- messages: `b26c71d29bbe99965e054c717f47e7cf1ff71ef239f25c5aa14b07b49db31c3`
- attachments: `730fabedaa8cff02e0421d8abb31b8ef1168554c14de90e9c9bd1b03dda327`

Według przekazanego wyniku preflight fingerprinty odpowiadają zaszyfrowanemu korpusowi użytemu do porównania z backupem. Dokumentacja nie zawiera plaintextu ani key material.

## 7. Decyzja Bramki 11

**Bramka 11 — PASS.**

Potwierdzono:
- poprawną decryptability 5/5 wiadomości,
- poprawną decryptability 2/2 załączników,
- zero błędów odszyfrowania,
- brak rekordów MFA wymagających migracji w badanym zbiorze,
- privacy-safe charakter testu,
- brak potrzeby ujawniania lub przenoszenia produkcyjnego materiału kluczowego.

## 8. Cleanup runtime self-checka

Po zebraniu wyniku wykonano cleanup na gałęzi `feature/homepage-game-center`:
- przywrócenie normalnego `start`: commit `c2de7b5630a05a888e69988c09a1e8653907bf36`,
- usunięcie tymczasowego `COPY scripts ./scripts` z Dockerfile: commit `62e5cb7e259842c060e0e2174f26ad4e1fd0bc00`,
- usunięcie `runtime-crypto-selfcheck-and-start.mjs`: commit `e01b40e18442194870f9b465fd0007c12840010c`.

## 9. Wpływ na DDL V3

Zamknięcie Bramki 11 usuwa blocker kryptograficzny dla dalszego review migracji.

**DDL V3 może przejść do REVIEW dokumentacyjnego/technicznego, ale wykonanie produkcyjne pozostaje NO-GO do czasu zamknięcia pozostałych bramek preflight.**
