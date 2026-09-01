# Gracz.pl V3 — PL-R02 MFA, credentiale, sesje i tokeny

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL RETENTION REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Decision ID: `PL-R02`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument zapisuje decyzję retencyjną dla MFA, credentiali, sesji i tokenów. Jest artefaktem governance. Nie potwierdza wdrożenia technicznego i nie autoryzuje implementacji ani deploymentu.

---

## 1. Zakres

PL-R02 obejmuje:

- aktywne credentiale i hashe haseł,
- MFA secrets i recovery material,
- aktywne oraz unieważnione sesje,
- tokeny rejestracyjne,
- tokeny resetu hasła,
- tokeny publiczne/lifecycle używane jednorazowo,
- metadata konieczne do bezpiecznego unieważnienia i audytu.

Nie obejmuje ogólnych security logs i telemetry — te są oceniane w PL-R07/PL-R08.

---

## 2. Cele przetwarzania

1. Bezpieczne uwierzytelnienie użytkownika.
2. Utrzymanie i odwołanie sesji.
3. Odzyskanie dostępu do konta.
4. Obsługa MFA.
5. Uniemożliwienie ponownego użycia tokenu po consume/revoke/expiry.
6. Ochrona konta przed przejęciem po usunięciu konta lub zmianie credentiali.

---

## 3. Podstawa projektowa

| Obszar | Podstawa projektowa | Status |
|---|---|---|
| credentiale i podstawowe auth | `art. 6(1)(b) PROPOSED` | `PASS WITH CONDITIONS CANDIDATE` |
| MFA jako element bezpieczeństwa usługi | `art. 6(1)(b) PROPOSED` + dla części security `6(1)(f) PROPOSED` | `LIA LINK REQUIRED` |
| metadata revoke/anti-reuse | `6(1)(f) PROPOSED` tam, gdzie wykracza poza samo wykonanie usługi | `LIA REQUIRED` |

Ostateczna kwalifikacja podstaw musi pozostać spójna z PL-E03 i PL-E10.

---

## 4. Decyzja retencyjna

| Klasa | Retention clock | Okres | Akcja końcowa | Decyzja |
|---|---|---:|---|---|
| aktywne credentiale | lifecycle konta / zmiana credentialu | do zmiany lub usunięcia konta | zastąpienie/revoke, następnie purge | `APPROVE` |
| credentiale po zweryfikowanym delete konta | `verified_at` | natychmiast; cel operacyjny maks. 24 h | revoke + purge/cryptographic erase | `APPROVE WITH CONDITIONS` |
| MFA secrets | disable/revoke/account delete | natychmiast; cel operacyjny maks. 24 h | cryptographic erase/purge | `APPROVE WITH CONDITIONS` |
| aktywna sesja | expiry/revoke/delete | do expiry lub revoke | natychmiastowa utrata autoryzacji | `APPROVE` |
| metadata sesji po expiry/revoke/delete | expiry/revoke/delete | 30 dni | purge | `APPROVE WITH CONDITIONS` |
| reset token hash/metadata | expiry/consume/revoke | 7 dni | purge | `APPROVE WITH CONDITIONS` |
| registration token hash/metadata | expiry/consume/revoke | 7 dni | purge | `APPROVE WITH CONDITIONS` |
| jednorazowe public/lifecycle token metadata | expiry/consume/revoke | 7 dni | purge | `APPROVE WITH CONDITIONS` |

---

## 5. Uzasadnienie okresów

### 5.1 Credentiale i MFA — natychmiast / cel 24 h

Po usunięciu konta, wyłączeniu MFA lub zmianie credentialu nie istnieje cel do dalszego używania aktywnego sekretu. Dlatego najpierw następuje natychmiastowe logiczne unieważnienie, a fizyczne usunięcie lub cryptographic erase powinno nastąpić bez zbędnej zwłoki. `24 h` jest maksymalnym celem operacyjnym na zakończenie purge w systemach aktywnych, a nie okresem uprawniającym do dalszego używania credentialu.

### 5.2 Sesje — 30 dni metadata po expiry/revoke/delete

Krótka retencja metadata sesyjnej może służyć diagnostyce bezpieczeństwa, wykrywaniu anomalii, odtworzeniu incydentu i ochronie przed ponownym użyciem identyfikatora. Nie uzasadnia przechowywania aktywnego sekretu sesji ani ponownej autoryzacji.

Warunek proporcjonalności: metadata ma być ograniczone do minimum i nie może zawierać plaintext tokenów.

### 5.3 Tokeny — 7 dni po expiry/consume/revoke

Krótki okres po zakończeniu lifecycle tokenu pozwala na kontrolę anti-reuse, diagnostykę błędów i potwierdzenie zdarzeń, przy jednoczesnym unikaniu długiego przechowywania danych tokenowych. Przechowywany może być wyłącznie hash lub nieodwracalny identyfikator oraz minimalne metadata.

---

## 6. Zasady bezwzględne

1. Plaintext haseł nie jest przechowywany.
2. Plaintext reset/registration tokens nie są przechowywane po stronie serwera poza chwilowym zakresem niezbędnym do dostarczenia/wykonania operacji.
3. MFA secrets są klasą `SECRET` i nie mogą trafiać do zwykłych logów, audit payloadów ani evidence artifacts.
4. Revoke musi mieć skutek natychmiastowy z punktu widzenia autoryzacji, niezależnie od późniejszego fizycznego purge.
5. Backup nie może być źródłem ponownej aktywacji starego credentialu lub sesji.
6. Po restore obowiązuje replay deletion/revocation state zgodnie z PL-E15.
7. Legal hold co do zasady nie powinien zachowywać aktywnych sekretów; jeżeli potrzebny jest dowód, zachowuje się minimalne metadata/evidence, nie używalny sekret.

---

## 7. Wyjątki i legal hold

Legal hold nie może uzasadniać pozostawienia aktywnego hasła, MFA secretu ani działającego tokenu. Jeżeli istnieje uzasadniony obowiązek dowodowy, można zachować wyłącznie minimalny nieaktywny proof, np. fingerprint/hash, timestamp, event ID i reason class, jeśli jego zachowanie ma zaakceptowaną podstawę.

Każdy wyjątek musi mieć:

- konkretny cel,
- podstawę,
- ownera,
- `review_at`,
- `expires_at`,
- zakres danych nie większy niż konieczny.

---

## 8. Obowiązek informacyjny

Privacy notice nie musi publikować szczegółów technicznych tokenów ani konfiguracji MFA, ale powinien informować o:

- przetwarzaniu danych uwierzytelniających i bezpieczeństwa,
- ogólnych okresach/kryteriach retencji,
- tym, że część krótkotrwałych metadata może być przechowywana po revoke/expiry do celów bezpieczeństwa.

Nie publikuje się informacji ułatwiających obejście zabezpieczeń.

---

## 9. Warunki przed pełnym APPROVE

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-R02-O01 | potwierdzić, że revoke sesji i tokenów jest natychmiastowy w projekcie wykonawczym | P1 | Identity/Security | `OPEN` |
| PL-R02-O02 | potwierdzić, że żaden plaintext token/MFA secret nie trafia do logów/audit/outbox | P1 | Security | `OPEN` |
| PL-R02-O03 | zatwierdzić 30 dni metadata sesyjnej jako proporcjonalny okres w LIA/security model | P1 Privacy/Legal | Privacy/Legal + Security | `OPEN` |
| PL-R02-O04 | zatwierdzić 7 dni token metadata i zakres przechowywanego proof | P1 Privacy/Legal | Privacy/Legal + Identity | `OPEN` |
| PL-R02-O05 | wykonać operacyjny test po restore, że revoked/deleted credential nie wraca do stanu aktywnego | P1 Operations | Security/Operations | `OPEN` |

---

## 10. Werdykt PL-R02

```text
PL-R02 = APPROVE WITH CONDITIONS

ACTIVE CREDENTIAL LIFECYCLE = APPROVED
ACCOUNT DELETE REVOKE = IMMEDIATE
CREDENTIAL / MFA PHYSICAL PURGE TARGET = <= 24 H
SESSION METADATA RETENTION = 30 DAYS / CONDITIONALLY APPROVED
RESET / REGISTRATION / PUBLIC TOKEN METADATA = 7 DAYS / CONDITIONALLY APPROVED
PLAINTEXT SECRET RETENTION = NOT ALLOWED
LEGAL HOLD OF ACTIVE SECRET = NOT ALLOWED
RESTORE MAY REACTIVATE REVOKED SECRET = NO
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `APPROVE` wymaga zamknięcia warunków P1 i operacyjnego potwierdzenia zachowania revoke/purge/restore.

---

## 11. Granica autoryzacji

Utworzenie PL-R02:

- nie zmienia kodu,
- nie rotuje żadnych sekretów,
- nie usuwa sesji ani tokenów,
- nie zmienia konfiguracji produkcyjnej,
- nie autoryzuje implementacji ani deploymentu,
- nie zdejmuje freeze.
