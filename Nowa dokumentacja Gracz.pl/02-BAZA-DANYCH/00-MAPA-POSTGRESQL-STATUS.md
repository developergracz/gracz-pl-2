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
| Pozostałe obszary | do opracowania/weryfikacji |
| **Łącznie** | **mapa 26 tabel w toku** |

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

Bieżący `record()` zapisuje `decision_id,user_id,context,outcome,reason`; `content_hash` nie jest w tej ścieżce wypełniany.

### `gracz_moderation_appeals`
- `appeal_id UUID PRIMARY KEY`,
- `decision_id UUID NOT NULL REFERENCES gracz_moderation_decisions(decision_id) ON DELETE CASCADE`,
- `user_id VARCHAR(32) NOT NULL`,
- `explanation TEXT NOT NULL`,
- `status VARCHAR(16) NOT NULL DEFAULT 'open'`,
- `reviewed_by VARCHAR(32)`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `reviewed_at TIMESTAMPTZ`.

Nie potwierdzono w `moderation-service.js` osobnej trwałej tabeli banów ani implementacji review/close odwołania. RBAC definiuje permissions `moderation.review`, `moderation.warn` i `moderation.ban`, ale samo uprawnienie nie jest dowodem istnienia mechanizmu wykonawczego.

Dokument: `06-MODERACJA-POSTGRESQL-AS-IS.md`.

## Pozostałe obszary

Dalsza mapa obejmuje m.in. globalny chat (w tym `gracz_global_chat_reports`), turnieje, newsletter, porównanie ze środowiskiem produkcyjnym i analizę modelu match.

## Kryterium zakończenia ETAPU 1B

ETAP 1B można uznać za zakończony dopiero po udokumentowaniu wszystkich 26 tabel, sprawdzeniu dowodów DDL/DML i oznaczeniu rozbieżności wymagających weryfikacji środowiska.