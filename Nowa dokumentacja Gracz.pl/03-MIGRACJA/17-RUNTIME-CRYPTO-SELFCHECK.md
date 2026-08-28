# ETAP 3 — Runtime crypto decryptability self-check

Data: 29.08.2026
Status: **ARTEFAKT WYKONAWCZY — WDROŻENIE TESTOWE OCZEKUJE NA WYNIK Z LOGÓW RENDER**

## Cel

Domknięcie Bramki 11 bez ujawniania ani przenoszenia produkcyjnego materiału kluczowego poza runtime Render.

## Powód użycia wariantu runtime

Lokalny smoke test na `gracz_restore_test_20260828` uruchomił się w trybie read-only, ale otrzymał `AUTH_SECRET_INVALID`. Lokalnie skopiowana wartość miała długość 30 znaków. Kod aktualnego deployu `9fb6a4c` wymaga `AUTH_SECRET` o długości co najmniej 32 znaków już przy starcie, więc wartość lokalna nie została uznana za wiarygodny materiał kluczowy.

Nie odsłaniano prawdziwego `AUTH_SECRET` i nie zapisano go w dokumentacji, repozytorium ani wynikach testu.

## Zatwierdzony wariant

Na aktywnej gałęzi Render `feature/homepage-game-center` dodano tymczasowy runtime self-check:

- plik: `modern/checkers-engine/scripts/preflight/runtime-crypto-selfcheck-and-start.mjs`
- commit utworzenia: `f9cd513ad59a22b20433be8d5fc4591e56888e27`
- tymczasowa zmiana skryptu `start` w `package.json`: commit `ee1d6a9b46e6c7cc963b3946b6b88fc00cacdba7`

Self-check uruchamia normalną aplikację, następnie wykonuje odczytowy probe przez istniejące endpointy aplikacji, tak aby rzeczywiste odszyfrowanie wykonał kod AS-IS z kluczami już obecnymi w runtime Render. Raportuje wyłącznie liczniki, statusy oraz SHA-256 zaszyfrowanego korpusu; nie raportuje plaintextu, kluczy, AAD ani connection stringów.

## Oczekiwany wpis w logu

W logach usługi należy wyszukać pojedynczy wpis rozpoczynający się od:

`[preflight.crypto]`

Wynik zawiera sekcje:
- `messages`: total / success / failure / status / ciphertextSha256,
- `attachments`: total / success / failure / status / ciphertextSha256,
- `mfa`: total / success / failure / status,
- `gate11Candidate`.

## Warunek interpretacji

- `messages.failure = 0` i `attachments.failure = 0`, przy pełnym pokryciu rekordów, daje dowód zgodności runtime key material z aktualnym ciphertextem.
- `mfa.status = N/A` jest poprawne, jeżeli `gracz_mfa` nie zawiera rekordów.
- SHA-256 zostanie porównany z lokalnym restore, aby potwierdzić, czy produkcyjny self-check dotyczył tego samego zaszyfrowanego korpusu co backup.
- Do czasu odczytania logu i porównania fingerprintów Bramka 11 pozostaje **NOT VERIFIED / REVIEW PENDING**.

## Cleanup

Po zebraniu privacy-safe wyniku należy niezwłocznie:
1. przywrócić zwykły skrypt `start`,
2. usunąć tymczasowy runtime self-check z gałęzi deployowej,
3. zapisać tylko wynik licznikowy/fingerprint i interpretację w dokumentacji ETAPU 3.

DDL V3 pozostaje `NO-GO` do czasu formalnego zamknięcia Bramki 11 i pozostałych bramek preflight.
