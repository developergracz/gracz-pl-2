# ETAP 3 — Runtime crypto decryptability self-check

Data: 29.08.2026
Status: **PASS — SELF-CHECK ZAKOŃCZONY I USUNIĘTY Z RUNTIME**

## Cel

Domknięcie Bramki 11 bez ujawniania ani przenoszenia produkcyjnego materiału kluczowego poza runtime Render.

## Powód użycia wariantu runtime

Lokalny smoke test na `gracz_restore_test_20260828` potwierdził prawidłowy read-only target, ale lokalnie dostępny materiał `AUTH_SECRET` nie był wiarygodnym key material i test zakończył się `AUTH_SECRET_INVALID`.

Kod aktualnego deployu wymaga `AUTH_SECRET` o długości co najmniej 32 znaków już przy starcie aplikacji. Nie obniżono wymagań kryptograficznych, nie użyto zastępczego sekretu i nie odsłaniano prawdziwego `AUTH_SECRET`.

Dlatego zastosowano jednorazowy self-check uruchamiany wewnątrz `gracz-checkers-test`, gdzie właściwe klucze są już dostępne w `process.env`.

## Wdrożenie testowe

Na gałęzi `feature/homepage-game-center` wykorzystano:
- `runtime-crypto-selfcheck-and-start.mjs` — commit `f9cd513ad59a22b20433be8d5fc4591e56888e27`,
- tymczasowe przełączenie `npm start` — commit `ee1d6a9b46e6c7cc963b3946b6b88fc00cacdba7`,
- dodanie `scripts/` do obrazu Docker — commit `957e8fde5bd209a12ab82305748069798df35d1c`.

Pierwszy deploy po `ee1d6a9` zakończył się `Exited with status 1`, ponieważ Dockerfile nie kopiował katalogu `scripts/` do obrazu. Po dodaniu `COPY scripts ./scripts` deploy `957e8fd` osiągnął status Live i self-check wykonał się poprawnie.

## Wynik `[preflight.crypto]`

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

Self-check nie zapisał plaintextu, kluczy, AAD, connection stringów ani sekretów.

## Interpretacja

- private messages: **5/5 PASS**,
- attachments: **2/2 PASS**,
- decrypt failures: **0**,
- MFA: **0 rekordów → N/A**,
- Bramka 11 candidate: **PASS**.

Fingerprinty ciphertextu zostały zachowane jako privacy-safe dowód korelacyjny. Według przekazanego wyniku preflight odpowiadają zaszyfrowanemu korpusowi porównywanemu z backupem.

## Cleanup — wykonany

Po zebraniu wyniku natychmiast cofnięto tymczasową ścieżkę:

1. normalny start aplikacji przywrócony:
   - commit `c2de7b5630a05a888e69988c09a1e8653907bf36`,
2. tymczasowe kopiowanie `scripts/` do obrazu usunięte:
   - commit `62e5cb7e259842c060e0e2174f26ad4e1fd0bc00`,
3. plik runtime self-checka usunięty:
   - commit `e01b40e18442194870f9b465fd0007c12840010c`.

Gałąź `feature/homepage-game-center` pozostaje gałęzią aplikacyjną; usunięto wyłącznie tymczasowy artefakt diagnostyczny. Commitów historycznych nie usuwa się z historii Git.

## Decyzja

**Bramka 11 — PASS.**

Crypto compatibility istniejącego ciphertextu została potwierdzona w realnym runtime bez ujawniania materiału kluczowego.

DDL V3 może wejść w etap REVIEW, ale jego wykonanie produkcyjne pozostaje **NO-GO**, dopóki pozostałe bramki preflight nie zostaną zamknięte.
