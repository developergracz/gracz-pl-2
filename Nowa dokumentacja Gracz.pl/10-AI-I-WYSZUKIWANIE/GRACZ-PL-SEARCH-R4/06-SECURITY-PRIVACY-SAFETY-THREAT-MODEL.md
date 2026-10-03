# 06 — Security, Privacy, Safety i Threat Model SEARCH R4

Status: **TARGET CONTROL BASELINE**

## 1. Główne aktywa

Chronione aktywa:

- klucze providerów AI,
- konto użytkownika,
- Player Context,
- publiczny kanoniczny korpus,
- indeks semantyczny,
- konfiguracja modeli,
- system prompts,
- limity budżetowe,
- logi i telemetria.

## 2. Główne zagrożenia

### T1 — Prompt injection z zapytania

Użytkownik próbuje nadpisać instrukcje systemowe.

Kontrole:

- rozdzielenie query i instructions,
- schema-constrained output,
- brak dowolnych tool calls,
- allowlista actions,
- confidence/source gate.

### T2 — Prompt injection z indeksowanej treści

Złośliwy tekst trafia do korpusu.

Kontrole:

- indeks tylko z allowlisty,
- sanityzacja HTML,
- usuwanie skryptów i komentarzy,
- source classification,
- treść retrieved traktowana jako data.

### T3 — Exfiltration system prompt

Model proszony jest o ujawnienie instrukcji.

Kontrole:

- model nie otrzymuje sekretów,
- system prompt bez danych wrażliwych,
- blokowanie debug promptów w produkcji,
- brak echo konfiguracji backendu.

### T4 — API key leakage

Kontrole:

- key tylko server-side,
- secret manager / env,
- brak klucza w JS,
- brak klucza w logach,
- rotacja po incydencie.

### T5 — Cross-user data leak

Kontrole:

- scoped authorization,
- per-user cache keys,
- brak wspólnego cache odpowiedzi trenera,
- testy izolacji tenant/user,
- minimalny Player Context.

### T6 — Cost abuse / denial of wallet

Kontrole:

- rate limit,
- quota,
- max tokens,
- model routing,
- per-IP / per-account budgets,
- daily hard cap,
- circuit breaker.

### T7 — Hallucinated rules

Kontrole:

- canonical retrieval,
- no-answer gate,
- citation verification,
- evaluation suite,
- source-class priority.

### T8 — Unsafe dynamic actions

Kontrole:

- AI proponuje action, ale backend waliduje typ,
- allowlista URL i operation,
- brak arbitralnego SQL/HTTP/tool execution,
- side effect wymaga aplikacyjnego handlera i autoryzacji.

## 3. Privacy by design

### 3.1. Minimalizacja

Do providera trafia tylko:

- query,
- niezbędne chunki,
- minimalna metadata,
- ewentualnie minimalny Player Context.

### 3.2. Brak domyślnego pełnego logowania promptów

Domyślnie telemetryka powinna przechowywać parametry techniczne, nie pełną treść rozmowy.

Jeżeli pełny tekst ma być przechowywany:

- potrzebna jest osobna decyzja celu,
- okres retencji,
- podstawa prawna,
- kontrola dostępu,
- informacja dla użytkownika.

### 3.3. Provider

Przed wdrożeniem trzeba udokumentować:

- rolę procesora,
- DPA,
- lokalizację przetwarzania,
- subprocessors,
- transfer poza EOG,
- retencję danych po stronie providera,
- ustawienia training/data usage.

## 4. Player Context

Kontekst edukacyjny jest traktowany jako dane konta i podlega:

- access control,
- deletion policy,
- export/rights handling zgodnie z obowiązującą polityką,
- backup/restore reconciliation,
- audit dostępu administracyjnego, jeśli występuje.

## 5. Małoletni

Jeżeli R4 jest dostępne dla użytkowników 16–17:

- brak profilowania marketingowego,
- rekomendacje wyłącznie edukacyjne/produktowe,
- brak manipulacyjnych mechanizmów engagement,
- minimalizacja danych,
- dodatkowy review Privacy/Legal przed produkcją.

## 6. Content safety

R4 jest asystentem gier i Academy. Dla tematów niezwiązanych z zakresem:

- może przekierować do wyszukiwania portalu,
- nie powinien udawać ogólnego asystenta do wszystkiego,
- nie powinien tworzyć autorytatywnych odpowiedzi spoza korpusu.

## 7. Abuse controls

- maksymalna długość query,
- max requests/min,
- max AI requests/day,
- captcha/anti-abuse dopiero jeśli potrzebne,
- anon vs logged-in quotas,
- wykrywanie automatycznych burstów,
- blokada powtarzalnych kosztownych promptów.

## 8. Security headers / frontend

- CSP bez bezpośrednich połączeń do model providera,
- `connect-src` tylko do własnego API,
- `frame-ancestors` zgodnie z polityką serwisu,
- sanityzacja odpowiedzi,
- tekst AI renderowany jako bezpieczny tekst/whitelist markdown.

## 9. Data-flow review gate

Przed produkcją musi istnieć diagram:

```text
Browser
→ gracz.pl API
→ retrieval store
→ AI provider
→ gracz.pl API
→ Browser
```

oraz osobny wariant z Player Context.

## 10. Security acceptance

FAIL, jeśli:

- klucz jest widoczny w kliencie,
- model może wykonać nieautoryzowaną akcję,
- odpowiedź o zasadach nie ma źródła,
- cache może zwrócić dane innego użytkownika,
- brak limitu kosztów,
- provider data handling nie został zweryfikowany.
