# ETAP 1B — Mapa PostgreSQL — Global Chat AS-IS

Data: 28.08.2026

## Status i źródła

Zweryfikowany fragment audytu AS-IS globalnego chatu na podstawie:
- `modern/checkers-engine/src/global-chat.js`,
- `modern/checkers-engine/src/moderation-service.js`,
- `modern/checkers-engine/src/main.js`.

Dokument opisuje stan potwierdzony w kodzie. Nie zakłada istnienia FK, banów, retencji ani mechanizmów moderacyjnych, których nie ma w analizowanych plikach.

## 1. Potwierdzone tabele PostgreSQL

### `gracz_chat_topics`

```sql
CREATE TABLE IF NOT EXISTS gracz_chat_topics (
  topic_id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'ogólne',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed BOOLEAN NOT NULL DEFAULT FALSE
)
```

Indeks:
```sql
CREATE INDEX IF NOT EXISTS gracz_chat_topics_created_idx
ON gracz_chat_topics(created_at DESC)
```

Potwierdzone:
- brak FK `owner_id -> gracz_accounts` w tym DDL,
- `owner_name` jest denormalizowanym tekstem,
- `category` jest ograniczana w aplikacji do zdefiniowanego zbioru kategorii, ale brak CHECK w schemacie,
- zamknięcie tematu reprezentuje flaga `closed`.

### `gracz_global_chat`

```sql
CREATE TABLE IF NOT EXISTS gracz_global_chat (
  message_id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  reply_to UUID NULL,
  topic_id UUID NULL,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
)
```

Kod wykonuje również:
```sql
ALTER TABLE gracz_global_chat
ADD COLUMN IF NOT EXISTS topic_id UUID NULL
```

Indeksy:
```sql
CREATE INDEX IF NOT EXISTS gracz_global_chat_created_idx
ON gracz_global_chat(created_at DESC)
```

```sql
CREATE INDEX IF NOT EXISTS gracz_global_chat_user_idx
ON gracz_global_chat(user_id,created_at DESC)
```

```sql
CREATE INDEX IF NOT EXISTS gracz_global_chat_topic_idx
ON gracz_global_chat(topic_id,created_at DESC)
```

Potwierdzone:
- brak FK `user_id -> gracz_accounts`,
- brak FK `topic_id -> gracz_chat_topics`,
- brak FK `reply_to -> gracz_global_chat.message_id`,
- `display_name` jest utrwalane w rekordzie wiadomości,
- reakcje są przechowywane w jednym polu JSONB.

### `gracz_chat_friends`

```sql
CREATE TABLE IF NOT EXISTS gracz_chat_friends (
  relation_id UUID PRIMARY KEY,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  addressee_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requester_id <> addressee_id),
  UNIQUE(requester_id, addressee_id)
)
```

Indeks:
```sql
CREATE INDEX IF NOT EXISTS gracz_chat_friends_users_idx
ON gracz_chat_friends(requester_id,addressee_id,status)
```

Potwierdzone:
- brak FK requester/addressee do `gracz_accounts`,
- CHECK uniemożliwia relację użytkownika z samym sobą,
- unikalność dotyczy pary kierunkowej `(requester_id, addressee_id)`.

### `gracz_global_chat_reports`

```sql
CREATE TABLE IF NOT EXISTS gracz_global_chat_reports (
  report_id UUID PRIMARY KEY,
  message_id UUID NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, reporter_id)
)
```

Potwierdzone:
- brak FK `message_id -> gracz_global_chat`,
- brak FK `reporter_id -> gracz_accounts`,
- jeden użytkownik może zgłosić daną wiadomość tylko raz dzięki `UNIQUE(message_id, reporter_id)`.

## 2. Wiadomości — DML i walidacja

Zapis:
```sql
INSERT INTO gracz_global_chat
(message_id,user_id,display_name,body,reply_to,topic_id)
VALUES($1,$2,$3,$4,$5,$6)
```

`message_id` powstaje przez `randomUUID()`.

Walidacja aplikacyjna wiadomości:
- treść nie może być pusta,
- maksymalna długość 600 znaków,
- maksymalnie 2 linki HTTP/HTTPS,
- limit wysyłania: maksymalnie 5 wiadomości w oknie 10 sekund,
- bezpośrednie ponowienie identycznej treści w aktywnym oknie rate limitu jest blokowane.

Dodatkowo `withChatModeration()` przepuszcza wysyłaną treść przez `ModerationService`, który blokuje m.in. aktywny HTML/JS, wybrane wzorce phishingu i nadmiar linków.

## 3. Odczyt i wyszukiwanie

Lista pomija rekordy `deleted=TRUE`.

Obsługiwane filtry:
- tekst (`q`),
- użytkownik (`user_id`),
- temat (`topic_id`),
- data od/do.

Zapytanie łączy wiadomości z tematami przez:
```sql
LEFT JOIN gracz_chat_topics t ON t.topic_id=m.topic_id
```

Jest to relacja wykorzystywana logicznie w zapytaniu, ale nie wymuszona FK w potwierdzonym DDL.

Limit wyników jest aplikacyjnie ograniczony do zakresu 20–150, domyślnie 100.

## 4. Edycja i usuwanie wiadomości

Edycja PostgreSQL:
```sql
UPDATE gracz_global_chat
SET body=$3, edited_at=NOW()
WHERE message_id=$1
  AND user_id=$2
  AND deleted=FALSE
  AND created_at > NOW()-INTERVAL '15 minutes'
```

Potwierdzone:
- autor może edytować własną wiadomość maksymalnie przez 15 minut,
- nie można edytować wiadomości oznaczonej jako usunięta.

Usunięcie:
```sql
UPDATE gracz_global_chat
SET deleted=TRUE, body=''
WHERE message_id=$1 AND user_id=$2
```

Jest to soft-delete połączony z wyzerowaniem treści. Rekord nie jest fizycznie usuwany przez tę ścieżkę.

Brak potwierdzonego TTL lub automatycznego cleanup starych wiadomości.

## 5. Reakcje — JSONB i concurrency

Reakcje są przechowywane w `reactions JSONB` jako mapowanie emoji -> lista userId.

Aktualny algorytm PostgreSQL:
1. `SELECT reactions ...`,
2. modyfikacja obiektu w pamięci procesu,
3. `UPDATE gracz_global_chat SET reactions=$2::jsonb ...`.

Brak:
- `revision`,
- `expectedRevision`,
- `SELECT ... FOR UPDATE`,
- warunku compare-and-swap,
- pojedynczej atomowej operacji JSONB dla konkretnej reakcji.

Wniosek AS-IS: równoczesne reakcje na tę samą wiadomość mogą wejść w klasyczny read-modify-write i jedna aktualizacja może nadpisać wynik drugiej. Jest to potwierdzone ryzyko lost update wynikające z konstrukcji kodu.

## 6. Raportowanie

Zgłoszenie używa:
```sql
INSERT INTO gracz_global_chat_reports
(report_id,message_id,reporter_id,reason)
VALUES($1,$2,$3,$4)
ON CONFLICT(message_id,reporter_id) DO NOTHING
```

`reason` jest aplikacyjnie ograniczany do 240 znaków.

Potwierdzone:
- operacja jest idempotentna dla pary `(message_id, reporter_id)`,
- kod zapisu nie weryfikuje w tej samej operacji FK do wiadomości, bo takiego FK nie ma,
- `report()` zwraca `{ok:true}` także przy konflikcie unikalności,
- w analizowanym GlobalChatService brak workflow rozpatrywania zgłoszeń.

`gracz_global_chat_reports` należy do Global Chatu i jest odrębny od `gracz_moderation_decisions` / `gracz_moderation_appeals`.

## 7. Tematy

Tworzenie tematu:
```sql
INSERT INTO gracz_chat_topics
(topic_id,owner_id,owner_name,title,description,category)
VALUES($1,$2,$3,$4,$5,$6)
```

Walidacja aplikacyjna:
- tytuł 3–80 znaków,
- opis do 280 znaków,
- kategoria z listy: `ogólne`, `warcaby`, `gomoku`, `szachy`, `turnieje`, `pomoc`, `offtopic`; nieznana kategoria jest normalizowana do `ogólne`.

Lista tematów pokazuje tylko `closed=FALSE` i oblicza `message_count` podzapytaniem do `gracz_global_chat`.

## 8. Znajomi

Przed INSERT kod sprawdza obie orientacje relacji:
```sql
SELECT 1 FROM gracz_chat_friends
WHERE (requester_id=$1 AND addressee_id=$2)
   OR (requester_id=$2 AND addressee_id=$1)
```

Następnie wykonuje INSERT jednej orientacji.

Akceptacja:
```sql
UPDATE gracz_chat_friends
SET status='accepted', updated_at=NOW()
WHERE relation_id=$1
  AND addressee_id=$2
  AND status='pending'
```

Odrzucenie usuwa rekord `pending`, a usunięcie znajomego wykonuje fizyczny DELETE relacji.

### Ryzyko concurrency

Constraint:
```sql
UNIQUE(requester_id, addressee_id)
```

nie traktuje `(A,B)` i `(B,A)` jako tej samej pary. Ponieważ kontrola obu orientacji odbywa się przed INSERT i nie jest chroniona transakcją/lockiem, dwa równoległe żądania A->B i B->A mogą oba przejść pre-check i utworzyć dwa przeciwne rekordy.

To jest potwierdzone ryzyko wyścigu na poziomie konstrukcji kodu.

## 9. Realtime / presence

Global Chat używa SSE, nie WebSocket.

`subscribe()`:
- ustawia `Content-Type: text/event-stream`,
- wysyła event `connected`,
- wysyła `ping` co 25 sekund,
- utrzymuje subskrybentów w `Set()` w pamięci procesu.

Broadcasty obejmują m.in.:
- `message.created`,
- `message.updated`,
- `message.deleted`,
- `topic.created`.

Presence:
- przechowywane w `Map()` w pamięci procesu,
- użytkownik uznawany jest za online przez 90 sekund od ostatniego touch,
- lista jest ograniczana do 200 użytkowników.

Konsekwencja AS-IS:
- presence i SSE subscribers nie są współdzielone między instancjami,
- restart procesu usuwa obecność i bieżące subskrypcje,
- wieloinstancyjne wdrożenie bez zewnętrznego pub/sub nie daje wspólnego realtime.

## 10. Atomowość DB -> realtime

Wysyłanie/edycja/usuwanie zapisuje stan w DB, a następnie osobno wywołuje `broadcast()`.

Brak potwierdzonej transakcji obejmującej zapis PostgreSQL i publikację SSE.

Wniosek AS-IS: commit DB może się udać, a proces może przerwać się przed broadcastem. Klient może wtedy nie dostać eventu mimo poprawnego stanu w bazie.

## 11. Relacje i integralność — podsumowanie

Potwierdzone FK w czterech tabelach Global Chatu: brak.

Relacje istnieją głównie logicznie:
- `gracz_global_chat.user_id` -> konto,
- `gracz_global_chat.topic_id` -> temat,
- `gracz_global_chat.reply_to` -> wiadomość,
- `gracz_chat_topics.owner_id` -> konto,
- requester/addressee -> konta,
- report.message_id -> wiadomość,
- report.reporter_id -> konto.

Nie należy opisywać ich jako FK PostgreSQL.

## 12. Ryzyka AS-IS

### HIGH
- reakcje JSONB mają read-modify-write bez revision/lockingu -> ryzyko lost update przy współbieżnych reakcjach,
- presence i SSE są stanem pamięciowym procesu -> brak wspólnego realtime przy wielu instancjach,
- zapis DB i broadcast SSE nie są atomowe,
- brak FK dla kluczowych relacji może pozostawiać rekordy osierocone.

### MEDIUM
- wyścig przy równoległych zaproszeniach znajomych A->B i B->A; unikalność DB jest kierunkowa,
- raport może logicznie wskazywać nieistniejącą wiadomość, ponieważ brak FK,
- `status` relacji znajomych nie ma CHECK ograniczającego do znanych wartości,
- `category` tematu nie ma CHECK,
- długości treści/tytułów/reason są głównie wymuszane w aplikacji, nie DB,
- soft-delete wiadomości nie ma potwierdzonej polityki czasowej retencji.

### LOW / obserwacje
- `display_name`, `owner_name`, `requester_name`, `addressee_name` są denormalizowanymi snapshotami nazw i mogą odbiegać od bieżącej nazwy konta,
- tryb bez PostgreSQL ma osobne magazyny pamięciowe i limit 1000 wiadomości, więc zachowanie dev różni się od trwałego trybu DB.

## 13. WYMAGA WERYFIKACJI ŚRODOWISKA

- rzeczywisty schemat produkcyjnego PostgreSQL/Render,
- czy poza analizowanym kodem istnieją migracje dodające FK/CHECK/indeksy,
- retencja i backup Global Chatu,
- monitoring wieloinstancyjnego SSE,
- sposób obsługi zgłoszeń przez moderatorów poza `GlobalChatService`.

## 14. Status obszaru

Global Chat AS-IS został zmapowany na poziomie kodu.

Potwierdzone tabele:
1. `gracz_chat_topics`,
2. `gracz_global_chat`,
3. `gracz_chat_friends`,
4. `gracz_global_chat_reports`.

Potwierdzono DDL, główne DML, SSE/presence, raportowanie, relacje znajomych, integrację z moderacją oraz ryzyka concurrency i integralności.