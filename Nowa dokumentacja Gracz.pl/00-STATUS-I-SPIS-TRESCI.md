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
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md` — iteracja 5.

### PostgreSQL V3 — Iteracja 5: Newsletter — ZAKOŃCZONA

Zdefiniowano projektowo:
- `newsletter_subscribers` jako current state,
- `newsletter_tokens` z hashami i lifecycle tokenów,
- `newsletter_sources` i `newsletter_subscriber_sources` jako attribution,
- `newsletter_consents` jako dedykowaną append-only historię zgód,
- `newsletter_events` jako lifecycle/operational history,
- opcjonalny model kampanii bez blokowania migracji rdzenia,
- atomowe kontrakty `subscribe`, `resend_confirmation`, `confirm`, `unsubscribe`, bounce/block,
- integrację Identity z nullable `user_id` i `ON DELETE SET NULL`,
- Transactional Outbox dla mail delivery,
- idempotentne retry API/worker/provider,
- rozdzielenie statusu dostarczalności od stanu zgody,
- migrację wszystkich pięciu tabel newslettera AS-IS,
- szczególną obsługę hybrydowych identyfikatorów/kolumn `gracz_newsletter_subscribers`,
- migrację online: shadow/backfill/validate/cutover/read-only legacy/rollback,
- rozdzieloną retencję consent, lifecycle, tokenów i delivery telemetry.

Korekta względem uproszczonego założenia wejściowego: AS-IS już posiada osobne `newsletter_consent_history` i `newsletter_events`; V3 nie tworzy historii z domysłu. Naprawia przede wszystkim hybrydowy subscriber schema, deduplikację consent i brak atomowości lifecycle/mail delivery.

### Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 6: Messaging & Global Chat V3.**

Zakres:
1. prywatne wiadomości i załączniki,
2. bezpieczna semantyka kasowania/retencji wiadomości,
3. Global Chat topics/messages,
4. concurrency-safe reactions,
5. symetryczne friendships bez race,
6. reports i integracja Moderation,
7. trwały multi-instance realtime/pub-sub,
8. outbox/idempotency.

Po Iteracji 6:
- Moderation V3,
- końcowa macierz migracji kolumna-po-kolumnie z 28 tabel AS-IS do V3.

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

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.