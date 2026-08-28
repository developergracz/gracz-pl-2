# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja rozdziela: **POTWIERDZONE**, **WYMAGA WERYFIKACJI ŚRODOWISKA** oraz **ARCHITEKTURA DOCELOWA**. Punktem odniesienia rozpoczętej analizy kodowej był `origin/main @ db3c15a`; dowody środowiskowe są dokumentowane osobno.

## Stan audytu

### ETAP 1B — mapa PostgreSQL

**STATUS: ZAMKNIĘTY 28.08.2026.**

Wykonano mapę kodową 26/26, rzeczywisty dump Rendera (28 tabel), porównanie oraz końcowy Model Match/rejestr rozbieżności.

### ETAP 2 — architektura docelowa i plan migracji

**STATUS: W TRAKCIE od 28.08.2026.**

Ukończone:
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`,
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` — iteracja 1,
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md` — iteracja 2,
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md` — iteracja 3,
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md` — iteracja 4,
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md` — iteracja 5,
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md` — iteracja 6.

### PostgreSQL V3 — Iteracja 6: Messaging & Global Chat — ZAKOŃCZONA

Zdefiniowano projektowo:
- odrębny Messaging V3 i Global Chat & Social V3 przy wspólnej infrastrukturze Identity/Outbox/Realtime,
- `private_messages`, `private_message_user_state`, `private_message_attachments`,
- szyfrowanie prywatnych wiadomości i key versioning,
- per-user read/archive/delete state bez przypadkowego kasowania danych drugiej strony,
- brak `ON DELETE CASCADE users -> private_messages`,
- `chat_channels`, `chat_topics`, `chat_messages`, `chat_message_events`,
- złożony FK zabezpieczający topic↔channel,
- relacyjne `chat_reactions` eliminujące JSONB lost-update,
- `social_friendships` z kanoniczną nieuporządkowaną parą i DB-level ochroną race A↔B,
- `chat_reports` jako intake do przyszłego Moderation V3,
- atomowe mutacje + outbox + idempotency,
- Realtime Gateway z broker/shared ephemeral store zamiast process-local SSE/presence,
- migrację wszystkich 6 tabel AS-IS Messaging + Global Chat z zachowaniem szyfrowania/provenance i bez wymyślania brakujących timestampów/relacji.

Najważniejsza decyzja: prywatne wiadomości nie zostały włączone do `chat_messages`, ponieważ mają inny model bezpieczeństwa, szyfrowania, dostępu i retencji. Wspólna pozostaje infrastruktura, nie tabela domenowa.

### Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 7: Moderation V3.**

Zakres:
1. `moderation_cases`,
2. źródła zgłoszeń/flags/reports,
3. `moderation_actions`,
4. sanctions: mute/ban/restrictions,
5. appeals i review workflow,
6. integracja z Identity, Chat, Messaging i Audit,
7. outbox/idempotency,
8. migracja `gracz_moderation_decisions` i `gracz_moderation_appeals`.

Po Moderation V3 pozostanie końcowa macierz migracji kolumna-po-kolumnie z 28 tabel AS-IS do struktur V3 oraz formalne domknięcie modelu PostgreSQL V3 w ETAPIE 2.

## Spis dokumentacji

### Architektura
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md`
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`

### PostgreSQL
- `02-BAZA-DANYCH/00-MAPA-POSTGRESQL-STATUS.md`
- `02-BAZA-DANYCH/01-TOZSAMOSC-I-AUDYT.md`
- `02-BAZA-DANYCH/02-GRY-WARCABY-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/03-GRY-TYSIAC-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/04-GRY-GOMOKU-AS-IS.md`
- `02-BAZA-DANYCH/05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/06-MODERACJA-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/07-GLOBAL-CHAT-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/08-TURNIEJE-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/09-NEWSLETTER-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/10-POROWNANIE-POSTGRESQL-REPO-PRODUKCJA.md`
- `02-BAZA-DANYCH/11-MODEL-MATCH-I-ROZBIEZNOSCI.md`
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md`
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md`
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md`
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md`
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md`
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md`

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.