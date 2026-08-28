# ETAP 1B — Mapa PostgreSQL — Newsletter AS-IS

Data: 28.08.2026

## Status i źródła

Zweryfikowany fragment audytu AS-IS newslettera na podstawie:
- `modern/checkers-engine/src/newsletter.js`,
- `modern/checkers-engine/src/newsletter-admin-service.js`,
- `modern/checkers-engine/src/newsletter-lifecycle-recorder.js`,
- `modern/checkers-engine/src/newsletter-analytics-wrapper.js`,
- integracji inicjalizowanej w `modern/checkers-engine/src/main.js`.

Dokument opisuje stan potwierdzony w kodzie. Nie opisuje jako faktu produkcyjnego tego, czego nie potwierdzono bezpośrednio na środowisku Render/PostgreSQL.

## 1. Potwierdzone tabele PostgreSQL

Newsletter używa pięciu potwierdzonych tabel PostgreSQL:

1. `gracz_newsletter_subscribers`,
2. `newsletter_sources`,
3. `newsletter_subscriber_sources`,
4. `newsletter_consent_history`,
5. `newsletter_events`.

Łącznie z wcześniej zmapowanymi obszarami daje to 26 tabel objętych rozpoczętą mapą PostgreSQL ETAPU 1B.

---

## 2. `gracz_newsletter_subscribers`

DDL tworzony przez `NewsletterService.initialize()`:

```sql
CREATE TABLE IF NOT EXISTS gracz_newsletter_subscribers(
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  email_normalized VARCHAR(254) NOT NULL UNIQUE,
  preferred_nick VARCHAR(24),
  preferred_nick_normalized VARCHAR(24),
  consent_version VARCHAR(64) NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL DEFAULT 'pending_confirmation',
  confirmation_token_hash BYTEA,
  confirmation_expires_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  position_token_hash BYTEA,
  unsubscribe_token_hash BYTEA,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Kod wykonuje także serię `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, co wskazuje na ewolucję schematu i kompatybilność z wcześniejszą wersją tabeli.

Potwierdzone indeksy:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_id_unique
ON gracz_newsletter_subscribers(id)
```

Indeks ten jest redundantny względem `PRIMARY KEY(id)`, ale występuje w aktualnym kodzie.

```sql
CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_preferred_nick_unique_v2
ON gracz_newsletter_subscribers(preferred_nick_normalized)
WHERE preferred_nick_normalized IS NOT NULL
  AND status IN ('pending_confirmation','subscribed')
```

Dodatkowo indeksy częściowe po hashach:
- `confirmation_token_hash`,
- `position_token_hash`,
- `unsubscribe_token_hash`.

Stary indeks `gracz_newsletter_preferred_nick_unique` jest jawnie usuwany przez `DROP INDEX IF EXISTS`.

### Statusy widoczne w bieżącym DML

Potwierdzone wartości używane w kodzie:
- `pending_confirmation`,
- `subscribed`,
- `unsubscribed`.

Brak potwierdzonego `CHECK` ograniczającego `status` do tych wartości.

### Consent version

Aktualny kod zapisuje:

`launch-v3-double-opt-in`

jako `consent_version` dla nowego/ponowionego zapisu.

---

## 3. Double opt-in — zapis

`subscribe()` wymaga aplikacyjnie:
- `legal === true`,
- `consent === true`,
- poprawnego e-maila,
- opcjonalnego poprawnego nicku.

API zwraca neutralną odpowiedź niezależnie od tego, czy adres już istnieje, co ogranicza enumerację subskrybentów.

W wariancie PostgreSQL zapis jest chroniony transakcją:

```sql
BEGIN
```

oraz blokadą rekordu:

```sql
SELECT id,status,confirmation_sent_at
FROM gracz_newsletter_subscribers
WHERE email_normalized=$1
FOR UPDATE
```

Następnie kod:
- kończy operację neutralnie, jeśli adres jest już `subscribed`,
- respektuje 30-minutowy cooldown ponownej wysyłki,
- sprawdza konflikt nicku,
- generuje nowy token potwierdzający,
- wykonuje `UPDATE` istniejącego rekordu albo `INSERT` nowego rekordu,
- ustawia `confirmation_expires_at` na 24 godziny,
- zatwierdza transakcję.

Token jawny nie jest zapisywany do bazy; przechowywany jest hash tokenu.

### Ważna granica atomowości

Wysyłka e-maila potwierdzającego następuje **po COMMIT** transakcji PostgreSQL.

Dopiero po udanej wysyłce wykonywane jest osobne:

```sql
UPDATE gracz_newsletter_subscribers
SET confirmation_sent_at=NOW(), updated_at=NOW()
...
```

Jeśli mail się nie powiedzie, `confirmation_sent_at` jest ponownie ustawiane na `NULL`.

Oznacza to, że zapis subskrypcji i dostarczenie e-maila nie są jedną transakcją/atomową operacją.

---

## 4. Resend confirmation

`resendConfirmation()` również używa:
- `BEGIN`,
- `SELECT ... FOR UPDATE`,
- kontroli `pending_confirmation`,
- 30-minutowego cooldownu,
- nowego hasha tokenu,
- 24-godzinnego TTL.

Wysłanie wiadomości następuje po COMMIT.

Nie występuje Transactional Outbox łączący zmianę bazy z wysyłką e-mail.

---

## 5. Confirm

Potwierdzenie hashuję token wejściowy i wyszukuje rekord:

```sql
SELECT id,email,preferred_nick
FROM gracz_newsletter_subscribers
WHERE confirmation_token_hash=$1
  AND confirmation_expires_at>NOW()
  AND status='pending_confirmation'
FOR UPDATE
```

Po znalezieniu rekordu generowane są dwa nowe tokeny:
- position token,
- unsubscribe token.

Ich hashe trafiają do tabeli, a rekord jest aktualizowany do:
- `status='subscribed'`,
- `confirmed_at=NOW()`,
- usunięty `confirmation_token_hash`,
- usunięty `confirmation_expires_at`,
- ustawione `position_token_hash`,
- ustawione `unsubscribe_token_hash`.

Operacja zmiany statusu jest transakcyjna.

Welcome e-mail jest wysyłany **po COMMIT** i jego błąd jest tylko logowany; potwierdzenie subskrypcji pozostaje skuteczne.

---

## 6. Pozycja na liście

`position(token)` identyfikuje subskrybenta przez `position_token_hash` i oblicza pozycję jako liczbę aktywnych subskrypcji z `id <= current id`.

To nie jest osobna, trwała kolumna `position`; pozycja jest wyliczana przy odczycie.

---

## 7. Wypisanie

`unsubscribeByToken()` aktualizuje rekord przez hash tokenu:

```sql
UPDATE gracz_newsletter_subscribers
SET status='unsubscribed',
    unsubscribed_at=NOW(),
    position_token_hash=NULL,
    unsubscribe_token_hash=NULL,
    confirmation_token_hash=NULL,
    updated_at=NOW()
WHERE unsubscribe_token_hash=$1
```

Operacja jest zewnętrznie idempotentna — funkcja zwraca `{ok:true}` również wtedy, gdy żaden rekord nie został zmieniony.

W analizowanym DML nie jest usuwany fizycznie rekord subskrybenta przy wypisaniu.

---

## 8. `newsletter_sources`

DDL:

```sql
CREATE TABLE IF NOT EXISTS newsletter_sources(
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  source_type VARCHAR(32) NOT NULL
    CHECK(source_type IN ('internal','campaign','partner','advertisement','other')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Kod bootstrapuje źródło `homepage` przez `INSERT ... ON CONFLICT(code) DO NOTHING`.

---

## 9. `newsletter_subscriber_sources`

DDL:

```sql
CREATE TABLE IF NOT EXISTS newsletter_subscriber_sources(
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL
    REFERENCES gracz_newsletter_subscribers(id) ON DELETE RESTRICT,
  source_id BIGINT NOT NULL
    REFERENCES newsletter_sources(id) ON DELETE RESTRICT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  campaign_reference VARCHAR(128),
  partner_reference VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(subscriber_id,source_id)
)
```

Relacje są rzeczywistymi FK.

`ON DELETE RESTRICT` chroni historię źródła przed przypadkowym usunięciem rekordu subskrybenta lub źródła, jeśli istnieje powiązanie.

Lifecycle recorder dodaje powiązanie przez:

```sql
INSERT INTO newsletter_subscriber_sources(subscriber_id,source_id)
VALUES(...)
ON CONFLICT(subscriber_id,source_id) DO NOTHING
```

---

## 10. `newsletter_consent_history`

DDL:

```sql
CREATE TABLE IF NOT EXISTS newsletter_consent_history(
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL
    REFERENCES gracz_newsletter_subscribers(id) ON DELETE RESTRICT,
  consent_type VARCHAR(64) NOT NULL,
  consent_version VARCHAR(64) NOT NULL,
  action VARCHAR(24) NOT NULL
    CHECK(action IN ('granted','confirmed','revoked')),
  source VARCHAR(64) NOT NULL DEFAULT 'homepage',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
)
```

Indeksy:
- `(subscriber_id, occurred_at DESC)`,
- `(occurred_at DESC)`,
- `(consent_type, action)`.

Lifecycle recorder zapisuje `consent_type='marketing_newsletter'` i akcje:
- `granted`,
- `confirmed`,
- `revoked`.

Deduplikacja historii zgody odbywa się aplikacyjnie przez `INSERT ... SELECT ... WHERE NOT EXISTS(...)`; nie ma potwierdzonego UNIQUE odpowiadającego temu warunkowi.

Przy równoległych identycznych zapisach istnieje więc możliwość duplikatu historii consent, ponieważ `WHERE NOT EXISTS` samo w sobie nie jest constraintem unikalności.

---

## 11. `newsletter_events`

DDL:

```sql
CREATE TABLE IF NOT EXISTS newsletter_events(
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT
    REFERENCES gracz_newsletter_subscribers(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  source_id BIGINT
    REFERENCES newsletter_sources(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_hash CHAR(64),
  user_agent_hash CHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
)
```

Indeksy:
- `(occurred_at DESC)`,
- `(subscriber_id, occurred_at DESC)`,
- `(event_type, occurred_at DESC)`,
- `(source_id, occurred_at DESC)`.

`ON DELETE SET NULL` pozwala zachować zdarzenie po usunięciu źródła/subskrybenta, jeśli fizyczne usunięcie będzie kiedyś wykonywane.

Potwierdzone eventy lifecycle obejmują m.in.:
- `subscribe.requested`,
- `subscribe.confirmation_sent`,
- `subscribe.resend_requested`,
- `subscribe.confirmed`,
- `subscribe.unsubscribed`.

Admin service wykorzystuje także eventy `security.%` i umożliwia zapisywanie arbitralnego `event_type` o długości do 64 znaków przez `recordEvent()`.

---

## 12. Lifecycle / analytics — brak atomowości z głównym stanem

`withNewsletterLifecycleAnalytics()` jest wrapperem typu best-effort:

1. wykonuje główną operację `NewsletterService`,
2. dopiero potem próbuje zapisać source/consent/eventy,
3. błędy rejestracji lifecycle są tylko logowane i nie cofają głównej operacji.

To jest świadome zachowanie kodu, ale oznacza:
- subskrybent może być poprawnie zapisany/confirmed/unsubscribed,
- a odpowiadający wpis w `newsletter_consent_history` lub `newsletter_events` może nie powstać.

Nie ma wspólnej transakcji między tabelą subskrybentów a tabelami lifecycle.

---

## 13. Warstwa administracyjna

`NewsletterAdminService` wykorzystuje powyższe tabele do:
- dashboardu liczby subscribed/pending/unsubscribed,
- listy subskrybentów,
- filtrowania po statusie/datach/source,
- wyszukiwania po nicku lub zamaskowanym e-mailu,
- historii źródeł,
- historii zgód,
- historii eventów,
- statystyk godzinowych/dziennych/source/eventType,
- przeglądu eventów bezpieczeństwa.

Domyślna lista maskuje adresy e-mail. Pełny adres jest pobierany przez osobną metodę `revealEmail()`; kontrola uprawnień do tej metody znajduje się poza `NewsletterAdminService` w warstwie handler/RBAC i powinna być oceniana razem z modułem administracyjnym bezpieczeństwa.

---

## 14. Bezpieczeństwo publicznego API

W potwierdzonym handlerze newslettera występują m.in.:
- kontrola hosta w produkcji (`gracz.pl` / `www.gracz.pl`),
- same-origin dla mutacji,
- rate limiting per operacja,
- Turnstile w produkcji,
- honeypot,
- detekcja bardzo szybkiego submitu,
- neutralna odpowiedź przy zapisie,
- limity wielkości payloadu,
- walidacja `submissionId`,
- hash tokenów zamiast przechowywania tokenów jawnych.

---

## 15. Retencja AS-IS

W analizowanym kodzie:
- wypisanie nie usuwa fizycznie rekordu subskrybenta,
- historia consent jest trwała, bez widocznego TTL,
- eventy newslettera są trwałe, bez widocznego TTL,
- źródła i powiązania źródeł nie mają automatycznego cleanup,
- nie potwierdzono joba czyszczącego wygasłe rekordy `pending_confirmation`.

Wygasa jedynie możliwość użycia tokenu potwierdzającego przez `confirmation_expires_at` (24 h); sam rekord pending nie jest przez pokazany kod automatycznie usuwany.

Polityka produkcyjnej retencji/backupów wymaga osobnej weryfikacji środowiska.

---

## 16. Concurrency i integralność — POTWIERDZONE

### Mocniejsze elementy

- `subscribe`, `resendConfirmation` i `confirm` stosują transakcje oraz `FOR UPDATE` dla konkretnego rekordu subskrybenta.
- e-mail i email_normalized mają UNIQUE.
- aktywny `preferred_nick_normalized` ma częściowy UNIQUE dla pending/subscribed.
- powiązania source mają prawdziwe FK i UNIQUE `(subscriber_id,source_id)`.
- akcje consent i source_type mają CHECK.

### Ryzyka / ograniczenia

#### HIGH / istotne

- główny lifecycle subskrypcji i lifecycle analytics/consent/eventy nie są atomowe; wrapper działa best-effort po głównej operacji,
- zapis stanu subskrypcji i wysyłka e-mail nie są atomowe; brak Transactional Outbox.

#### MEDIUM

- deduplikacja `newsletter_consent_history` i części eventów przez `WHERE NOT EXISTS` nie jest chroniona odpowiadającym UNIQUE, więc pod concurrency możliwe są duplikaty,
- `status` subskrybenta nie ma potwierdzonego CHECK,
- brak automatycznej retencji pending/eventów/consent w analizowanym kodzie,
- redundantny unique index na `id` istnieje obok PK.

#### Obserwacja

- `newsletter_events` celowo używa `ON DELETE SET NULL`, podczas gdy historia consent/source używa `ON DELETE RESTRICT`; są to różne polityki zachowania danych historycznych.

---

## 17. WYMAGA WERYFIKACJI ŚRODOWISKA

- rzeczywisty schemat PostgreSQL na Renderze i zgodność z aktualnym DDL,
- czy istnieją stare indeksy/kolumny pozostałe po wcześniejszych wdrożeniach,
- retencja danych newslettera i wymogi prawne/RODO,
- backupy i okres przechowywania consent/events,
- rzeczywista konfiguracja providera e-mail,
- skuteczność dostarczania i retry po awarii providera,
- ewentualne zewnętrzne joby cleanup,
- produkcyjna konfiguracja Turnstile/rate limits.

---

## 18. Status obszaru

Newsletter AS-IS jest zamknięty na poziomie kodu dla mapy PostgreSQL.

Potwierdzone pięć tabel newslettera:
1. `gracz_newsletter_subscribers`,
2. `newsletter_sources`,
3. `newsletter_subscriber_sources`,
4. `newsletter_consent_history`,
5. `newsletter_events`.

Po ich dodaniu inwentaryzacja kodowa ETAPU 1B osiąga 26 zmapowanych tabel PostgreSQL. Do formalnego zamknięcia ETAPU 1B pozostaje porównanie z rzeczywistym schematem środowiska produkcyjnego oraz końcowe sprawdzenie model match/rozbieżności.