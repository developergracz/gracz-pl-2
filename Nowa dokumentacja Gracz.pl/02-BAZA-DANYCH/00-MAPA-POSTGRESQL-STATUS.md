# Mapa PostgreSQL — status

## Cel

Zbudowanie kompletnej, dowodowej mapy PostgreSQL projektu Gracz.pl.

## Zakres

Mapa obejmuje **26 tabel** zidentyfikowanych w ramach rozpoczętego audytu.

## Metodyka

Dla każdej tabeli należy dokumentować osobno:
- dowody DDL,
- dowody DML,
- relacje i zależności tylko potwierdzone kodem/schematem,
- miejsca użycia,
- ryzyka i niespójności,
- elementy wymagające weryfikacji środowiska.

Nie wolno rekonstruować brakujących kolumn lub metod na podstawie domysłów.

## Postęp

| Obszar | Status |
|---|---|
| Tożsamość — 7 tabel | opracowane w pierwszej partii |
| Audyt — 1 tabela | opracowane |
| Gry — Warcaby / `gracz_game_sessions` | AS-IS zamknięte; DDL/DML, sesja, ranking i concurrency zweryfikowane |
| Gry — Tysiąc / `gracz_thousand_games` | AS-IS zamknięte; JSONB, revision i optimistic locking zweryfikowane |
| Gry — Gomoku | AS-IS zamknięte; brak persistence PostgreSQL, stan wyłącznie w pamięci procesu |
| Gry — legacy `prefix_*` | materiał porównawczy MySQL; DDL legacy do weryfikacji, nie liczyć automatycznie do mapy PostgreSQL |
| Wiadomości prywatne — `gracz_messages` | AS-IS zamknięte na poziomie kodu; DDL/DML, FK, indeksy, szyfrowanie, foldery i delete zweryfikowane |
| Załączniki wiadomości — `gracz_message_attachments` | AS-IS zamknięte na poziomie kodu; FK 1:1, AES-256-GCM, walidacja i cascade delete zweryfikowane |
| Moderacja — `gracz_moderation_decisions` | AS-IS rdzenia zamknięte; DDL/DML, filtr, audit integration i ryzyka zweryfikowane |
| Moderacja — `gracz_moderation_appeals` | AS-IS rdzenia zamknięte; FK do decyzji, DML odwołań i braki workflow review zweryfikowane |
| Global Chat — `gracz_chat_topics` | AS-IS zamknięte na poziomie kodu; DDL/DML, indeks, brak FK, kategorie i tematy zweryfikowane |
| Global Chat — `gracz_global_chat` | AS-IS zamknięte na poziomie kodu; DDL/DML, JSONB reactions, soft-delete, SSE i concurrency zweryfikowane |
| Global Chat — `gracz_chat_friends` | AS-IS zamknięte na poziomie kodu; DDL/DML, CHECK, unique i race A↔B zweryfikowane |
| Global Chat — `gracz_global_chat_reports` | AS-IS zamknięte na poziomie kodu; DDL/DML, idempotency raportu i brak FK zweryfikowane |
| Turnieje — `gracz_tournaments` | AS-IS zamknięte na poziomie kodu; DDL/DML, status, formaty i ryzyka startu zweryfikowane |
| Turnieje — `gracz_tournament_players` | AS-IS zamknięte na poziomie kodu; FK do turnieju, standings, join/leave i race limit/seed zweryfikowane |
| Turnieje — `gracz_tournament_matches` | AS-IS zamknięte na poziomie kodu; FK do turnieju, pairingi, wynik, awans rund i concurrency zweryfikowane |
| Newsletter — `gracz_newsletter_subscribers` | AS-IS zamknięte na poziomie kodu; double opt-in, token hashes, transakcje, FOR UPDATE i retencja zweryfikowane |
| Newsletter — `newsletter_sources` | AS-IS zamknięte; DDL, CHECK, bootstrap homepage zweryfikowane |
| Newsletter — `newsletter_subscriber_sources` | AS-IS zamknięte; FK, UNIQUE, source attribution zweryfikowane |
| Newsletter — `newsletter_consent_history` | AS-IS zamknięte; FK, CHECK, consent lifecycle i ryzyko dedupe concurrency zweryfikowane |
| Newsletter — `newsletter_events` | AS-IS zamknięte; FK SET NULL, indeksy, lifecycle/security analytics zweryfikowane |
| **Inwentaryzacja kodowa** | **26/26 tabel zmapowane** |
| **Formalne zamknięcie ETAPU 1B** | **pozostaje porównanie z produkcją/Renderem i końcowy model match** |

## Potwierdzony PostgreSQL — Gry

### `gracz_game_sessions`
- `game_id VARCHAR(128) PRIMARY KEY`,
- `state TEXT NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- indeks `gracz_game_sessions_updated_idx(updated_at DESC)`.

Dokument: `02-GRY-WARCABY-POSTGRESQL-AS-IS.md`.

### `gracz_thousand_games`
- `game_id VARCHAR(96) PRIMARY KEY`,
- `players JSONB NOT NULL`,
- `state JSONB NOT NULL`,
- `revision BIGINT NOT NULL DEFAULT 1`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

Kod stosuje optimistic locking przez `WHERE game_id = ... AND revision = ...` oraz konflikt wersji mapowany na błąd concurrency/HTTP 409.

Dokument: `03-GRY-TYSIAC-POSTGRESQL-AS-IS.md`.

### Gomoku

Aktualny kod nie tworzy ani nie używa tabeli PostgreSQL dla Gomoku. `GomokuService` przechowuje partie w `Map()` w pamięci procesu; `revision` jest licznikiem RAM, nie mechanizmem optimistic lockingu.

Dokument: `04-GRY-GOMOKU-AS-IS.md`.

## Potwierdzony PostgreSQL — Wiadomości prywatne

### `gracz_messages`
- `message_id UUID PRIMARY KEY`,
- `sender_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`,
- `recipient_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`,
- `subject TEXT NOT NULL` po wykonaniu `ALTER COLUMN`,
- `body TEXT NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `read_at TIMESTAMPTZ`,
- `recipient_archived BOOLEAN NOT NULL DEFAULT FALSE`,
- `sender_deleted BOOLEAN NOT NULL DEFAULT FALSE`,
- `recipient_deleted BOOLEAN NOT NULL DEFAULT FALSE`,
- indeksy po `(recipient_id, created_at DESC)` i `(sender_id, created_at DESC)`.

Temat i treść są szyfrowane aplikacyjnie przed zapisem.

Delete AS-IS:
- nadawca ustawia `sender_deleted=TRUE`,
- odbiorca ustawia `recipient_deleted=TRUE`,
- fizyczny `DELETE` następuje dopiero przy obu flagach `TRUE`,
- w analizowanej ścieżce brak czasowego TTL/retention pola.

### `gracz_message_attachments`
- `message_id UUID PRIMARY KEY REFERENCES gracz_messages(message_id) ON DELETE CASCADE`,
- `file_name VARCHAR(120) NOT NULL`,
- `storage_name VARCHAR(80)`,
- `mime_type VARCHAR(32) NOT NULL`,
- `file_size INTEGER NOT NULL`,
- `iv BYTEA NOT NULL`,
- `auth_tag BYTEA NOT NULL`,
- `ciphertext BYTEA NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

Model jest 1:1 z wiadomością; załączniki są szyfrowane AES-256-GCM i usuwane kaskadowo po fizycznym DELETE wiadomości.

Dokument: `05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md`.

## Potwierdzony PostgreSQL — Moderacja

### `gracz_moderation_decisions`
- `decision_id UUID PRIMARY KEY`,
- `user_id VARCHAR(32)` bez FK w potwierdzonym DDL,
- `context VARCHAR(32) NOT NULL`,
- `outcome VARCHAR(16) NOT NULL`,
- `reason VARCHAR(64)`,
- `content_hash CHAR(64)`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

### `gracz_moderation_appeals`
- `appeal_id UUID PRIMARY KEY`,
- `decision_id UUID NOT NULL REFERENCES gracz_moderation_decisions(decision_id) ON DELETE CASCADE`,
- `user_id VARCHAR(32) NOT NULL`,
- `explanation TEXT NOT NULL`,
- `status VARCHAR(16) NOT NULL DEFAULT 'open'`,
- `reviewed_by VARCHAR(32)`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `reviewed_at TIMESTAMPTZ`.

Dokument: `06-MODERACJA-POSTGRESQL-AS-IS.md`.

## Potwierdzony PostgreSQL — Global Chat

### `gracz_chat_topics`
- `topic_id UUID PRIMARY KEY`,
- brak FK do konta w potwierdzonym DDL,
- indeks po `created_at DESC`.

### `gracz_global_chat`
- `message_id UUID PRIMARY KEY`,
- `reactions JSONB`, soft-delete, indeksy po czasie/użytkowniku/temacie,
- brak FK dla user/reply/topic,
- read-modify-write reakcji bez revision/lockingu,
- SSE i presence w pamięci procesu.

### `gracz_chat_friends`
- CHECK requester != addressee,
- kierunkowy UNIQUE `(requester_id,addressee_id)`,
- brak FK do kont,
- race A↔B możliwy przy równoległych zaproszeniach.

### `gracz_global_chat_reports`
- `report_id UUID PRIMARY KEY`,
- UNIQUE `(message_id,reporter_id)`,
- brak FK do wiadomości/konta.

Dokument: `07-GLOBAL-CHAT-POSTGRESQL-AS-IS.md`.

## Potwierdzony PostgreSQL — Turnieje

### `gracz_tournaments`
- `tournament_id UUID PRIMARY KEY`,
- owner/title/game/format/status/visibility/max_players/rounds/time_control/rated,
- `starts_at`, `current_round`, `created_at`, `finished_at`,
- indeks `(status, starts_at)`,
- brak FK ownera do konta w potwierdzonym DDL.

### `gracz_tournament_players`
- PK `(tournament_id,user_id)`,
- FK `tournament_id -> gracz_tournaments` z `ON DELETE CASCADE`,
- points/wins/draws/losses/buchholz/status/seed,
- brak FK usera do konta.

### `gracz_tournament_matches`
- `match_id UUID PRIMARY KEY`,
- FK `tournament_id -> gracz_tournaments` z `ON DELETE CASCADE`,
- round/board/white/black/result/status/reported_by,
- indeks `(tournament_id,round,board)`, ale brak UNIQUE dla tej trójki,
- brak FK graczy i brak potwierdzonego DB-level powiązania meczu z realną sesją gry.

Ryzyka AS-IS: brak transakcji przy create/start/report/advance, race przy join i seed, brak CAS przy zakończeniu meczu i awansie rundy, wieloetapowy recompute standings bez transakcji.

Dokument: `08-TURNIEJE-POSTGRESQL-AS-IS.md`.

## Potwierdzony PostgreSQL — Newsletter

### `gracz_newsletter_subscribers`
- `id BIGSERIAL PRIMARY KEY`,
- unikalny e-mail i e-mail znormalizowany,
- preferred nick + częściowy UNIQUE dla aktywnego pending/subscribed,
- wersja i czas zgody,
- status lifecycle,
- hashe tokenów confirmation/position/unsubscribe,
- 24-godzinny TTL tokenu potwierdzenia,
- daty sent/confirmed/unsubscribed/created/updated.

`subscribe`, `resendConfirmation` i `confirm` wykorzystują transakcje i `FOR UPDATE`. Wysłanie maila oraz lifecycle analytics odbywają się poza główną transakcją.

### `newsletter_sources`
- `id BIGSERIAL PRIMARY KEY`,
- `code UNIQUE`,
- `source_type` z CHECK,
- active/timestamps,
- bootstrap źródła `homepage`.

### `newsletter_subscriber_sources`
- FK do subskrybenta `ON DELETE RESTRICT`,
- FK do źródła `ON DELETE RESTRICT`,
- UNIQUE `(subscriber_id,source_id)`,
- metadata JSONB i referencje campaign/partner.

### `newsletter_consent_history`
- FK do subskrybenta `ON DELETE RESTRICT`,
- action CHECK `granted/confirmed/revoked`,
- consent type/version/source/time/metadata,
- indeksy historii,
- dedupe w kodzie przez `WHERE NOT EXISTS`, bez odpowiadającego potwierdzonego UNIQUE.

### `newsletter_events`
- opcjonalny FK do subskrybenta `ON DELETE SET NULL`,
- opcjonalny FK do source `ON DELETE SET NULL`,
- `event_type`, czas, source/user-agent hashes, metadata JSONB,
- indeksy po czasie/subscriber/type/source.

Lifecycle source/consent/events jest best-effort po operacji głównej i nie jest atomowy ze zmianą stanu subskrypcji.

Dokument: `09-NEWSLETTER-POSTGRESQL-AS-IS.md`.

## Stan końcowy inwentaryzacji kodowej

Wszystkie 26 tabel objętych mapą zostały zidentyfikowane i udokumentowane na podstawie kodu.

Nie oznacza to jeszcze formalnego zamknięcia ETAPU 1B. Pozostają dwa kroki kontrolne:
1. porównanie schematu wynikającego z repozytorium z rzeczywistym PostgreSQL na środowisku produkcyjnym/Render,
2. końcowy model match i rejestr rozbieżności.

## Kryterium zakończenia ETAPU 1B

ETAP 1B można uznać za zakończony po potwierdzeniu 26/26 tabel, sprawdzeniu produkcyjnego schematu i oznaczeniu wszystkich rozbieżności między kodem a środowiskiem.