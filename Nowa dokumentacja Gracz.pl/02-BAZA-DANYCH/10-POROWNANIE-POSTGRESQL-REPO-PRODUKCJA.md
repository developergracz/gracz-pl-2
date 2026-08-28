# PostgreSQL — porównanie repozytorium z Renderem

Data weryfikacji: 28.08.2026

## Status

**POTWIERDZONE NA PODSTAWIE RZECZYWISTEGO DUMPU SCHEMATU RENDER**

Źródło środowiskowe: `pg_dump --schema-only` bazy `gracz-pl-database` na Renderze. Dump wskazuje PostgreSQL server **18.4** i `pg_dump` **18.6**.

## Wynik główny

- mapa kodowa obejmowała **26 tabel**,
- w rzeczywistym schemacie Render znajduje się **28 tabel**,
- wszystkie tabele z 26-elementowej mapy mają odpowiedniki w środowisku,
- Render zawiera dodatkowo dwa obiekty tabelowe poza zakresem mapy: `gracz_audit_log_legacy_1787562123031` i `gracz_role_changes`,
- występuje istotny schema drift w `gracz_newsletter_subscribers`,
- `gracz_game_sessions` posiada dodatkową kolumnę `version INTEGER NOT NULL DEFAULT 1`, której nie było w udokumentowanym wcześniej modelu kodowym.

## 1. Tabele zgodne z mapą — obecność

W dumpie potwierdzono obecność obszarów: tożsamość i audyt, Warcaby, Tysiąc, wiadomości prywatne, moderacja, Global Chat, turnieje oraz newsletter.

Dla wcześniej szczegółowo udokumentowanych 18 tabel domenowych potwierdzono obecność:

- `gracz_game_sessions`,
- `gracz_thousand_games`,
- `gracz_messages`,
- `gracz_message_attachments`,
- `gracz_moderation_decisions`,
- `gracz_moderation_appeals`,
- `gracz_chat_topics`,
- `gracz_global_chat`,
- `gracz_chat_friends`,
- `gracz_global_chat_reports`,
- `gracz_tournaments`,
- `gracz_tournament_players`,
- `gracz_tournament_matches`,
- `gracz_newsletter_subscribers`,
- `newsletter_sources`,
- `newsletter_subscriber_sources`,
- `newsletter_consent_history`,
- `newsletter_events`.

Gomoku pozostaje modelem pamięciowym i nie ma własnej tabeli PostgreSQL, zgodnie z audytem kodowym.

## 2. Rozbieżność — `gracz_game_sessions`

### Repozytorium / wcześniejszy AS-IS

Udokumentowano:
- `game_id VARCHAR(128) PRIMARY KEY`,
- `state TEXT NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

### Render

Render posiada powyższe pola oraz dodatkowo:

```sql
version integer DEFAULT 1 NOT NULL
```

### Ocena

**MEDIUM — schema drift.**

Sama obecność pola nie dowodzi, że aktualna ścieżka zapisu Warcabów używa optimistic lockingu. W modelu AS-IS nie wolno utożsamiać obecności `version` z CAS/single-writer bez potwierdzonego DML.

## 3. Rozbieżność krytyczna — `gracz_newsletter_subscribers`

Rzeczywista tabela na Renderze jest modelem hybrydowym: zachowuje starsze pola i jednocześnie zawiera kolumny nowszego lifecycle newslettera.

### Render — starsza część modelu

Potwierdzone m.in.:
- `subscriber_id UUID NOT NULL` — PRIMARY KEY,
- `email VARCHAR(254) NOT NULL`,
- `preferred_nick VARCHAR(32)`,
- `consent_version VARCHAR(32) NOT NULL`,
- `consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `status VARCHAR(20) NOT NULL DEFAULT 'active'`,
- `unsubscribe_token UUID`,
- `terms_version`, `privacy_version`, `terms_accepted_at`, `welcome_email_sent_at`.

### Render — nowsza część modelu

Potwierdzone również:
- `id BIGINT NOT NULL`,
- `email_normalized VARCHAR(254)`,
- `preferred_nick_normalized VARCHAR(24)`,
- `consented_at TIMESTAMPTZ DEFAULT NOW()`,
- `unsubscribed_at`,
- `confirmation_token_hash BYTEA`,
- `confirmation_expires_at`,
- `confirmation_sent_at`,
- `confirmed_at`,
- `position_token_hash BYTEA`,
- `unsubscribe_token_hash BYTEA`.

### Klucz główny

W aktualnym Renderze PRIMARY KEY pozostaje na `subscriber_id`, natomiast `id` jest zabezpieczone osobnym indeksem UNIQUE. Jest to inne ukształtowanie niż czysty model kodowy dokumentowany jako `id BIGSERIAL PRIMARY KEY`.

### Dalsze różnice

- produkcyjny `status` ma legacy default `'active'`, podczas gdy nowy lifecycle używa m.in. `pending_confirmation`, `subscribed`, `unsubscribed`,
- tabela zachowuje legacy `unsubscribe_token UUID` obok nowszego `unsubscribe_token_hash BYTEA`,
- występują równolegle `consent_at` i `consented_at`,
- `preferred_nick` ma na Renderze długość 32, podczas gdy nowszy model kodowy przewidywał 24,
- `consent_version` ma na Renderze długość 32, a nowszy model kodowy przewidywał 64.

### Ocena

**HIGH — istotny schema drift / migracja kompatybilnościowa pozostawiona w modelu produkcyjnym.**

Nie oznacza to automatycznie awarii aplikacji. Oznacza natomiast, że rzeczywisty model produkcyjny nie jest czystym odwzorowaniem docelowego DDL newslettera i przed kolejną migracją wymaga świadomego planu normalizacji.

## 4. Dodatkowa tabela — `gracz_audit_log_legacy_1787562123031`

Render zawiera zachowaną tabelę legacy audytu z PRIMARY KEY `audit_id` oraz starszym zestawem pól. Aktualna tabela `gracz_audit_log` istnieje równolegle i ma PRIMARY KEY `event_id`.

**Ocena: MEDIUM.**

Należy ustalić cel retencji tej tabeli, zależności operacyjne i dopiero potem zdecydować o archiwizacji/usunięciu. Nie usuwać bez analizy danych i polityki audytowej.

## 5. Dodatkowa tabela — `gracz_role_changes`

Render zawiera `gracz_role_changes` z:
- `change_id BIGINT PRIMARY KEY`,
- `target_user_id VARCHAR(32) NOT NULL`,
- `previous_role VARCHAR(20) NOT NULL`,
- `new_role VARCHAR(20) NOT NULL`,
- `changed_by VARCHAR(32) NOT NULL`,
- `reason VARCHAR(300)`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- FK `target_user_id -> gracz_accounts(user_id) ON DELETE CASCADE`,
- indeksem po `target_user_id, created_at DESC`.

Równolegle istnieje `gracz_role_history`.

**Ocena: MEDIUM.**

To wskazuje na współistnienie dwóch modeli historii zmian ról. Przed konsolidacją trzeba sprawdzić DML i dane obu tabel.

## 6. Potwierdzone relacje i ograniczenia dla domen 2–9

Dump potwierdza m.in.:
- wiadomości: FK sender/recipient do `gracz_accounts` z `ON DELETE CASCADE`,
- załączniki: FK do `gracz_messages` z `ON DELETE CASCADE`,
- moderacja appeals: FK do decisions z `ON DELETE CASCADE`,
- chat friends: CHECK requester != addressee i UNIQUE pary kierunkowej,
- chat reports: UNIQUE `(message_id, reporter_id)`,
- turnieje: FK players/matches do tournament z `ON DELETE CASCADE`,
- newsletter source attribution i consent: FK `ON DELETE RESTRICT`,
- newsletter events: FK do subscriber/source z `ON DELETE SET NULL`.

Potwierdza to wcześniejsze ustalenia AS-IS dotyczące tych relacji. Brak FK wcześniej wskazany dla rdzenia Global Chat i części pól turniejowych pozostaje widoczny również w dumpie.

## 7. Wniosek

Porównanie repozytorium z rzeczywistym PostgreSQL zostało wykonane. Środowisko nie jest identyczne z czystym modelem kodowym: posiada dwa dodatkowe obiekty tabelowe oraz istotne ślady ewolucji/migracji w newsletterze i dodatkowe `version` w Warcabach.

Te różnice są wejściem do dokumentu `11-MODEL-MATCH-I-ROZBIEZNOSCI.md`.