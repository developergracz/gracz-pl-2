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
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md` — iteracja 4.

### PostgreSQL V3 — Iteracja 4: Identity & Access + Role/Audit — ZAKOŃCZONA

Zdefiniowano projektowo:
- `users`, `user_profiles`, `auth_sessions`,
- `password_reset_tokens`, `registration_codes`, `mfa_credentials`,
- `roles`, `user_roles`,
- kanoniczny append-only `role_change_events`,
- kanoniczny append-only `audit_log`,
- odrębny `security_events`,
- version/CAS dla krytycznych zmian statusu użytkownika,
- hash tokenów oraz szyfrowanie sekretów MFA,
- atomowy kontrakt zmiany roli: current state + role event + audit + outbox + idempotency,
- merge `gracz_role_changes` + `gracz_role_history` z provenance i bez wymyślania brakujących danych,
- kontrolowany DEPRECATE legacy audit po data profiling/retencji/backupie,
- zasady retencji, prywatności i zakaz credential secrets w audit/outbox.

Ważna decyzja: historia ról nie opiera się wyłącznie na JSON `old_roles/new_roles`; V3 zapisuje granularne `assigned/revoked` z `role_code_snapshot`, aktorem, reason, correlation i provenance. Pozwala to zachować legacy rekord nawet wtedy, gdy nie można wiarygodnie odtworzyć FK do aktualnej roli.

### Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 5: Newsletter V3.**

Zakres:
1. normalizacja HIGH drift `gracz_newsletter_subscribers`,
2. `newsletter_subscribers`, sources i attribution,
3. pełna historia zgód i lifecycle events,
4. double opt-in,
5. token hashing i retencja,
6. `DB transaction -> outbox -> mail worker -> provider/delivery event`,
7. idempotency/deduplikacja i migracja hybrydowych pól legacy.

Po Newsletter V3:
- Messaging / Global Chat / Moderation,
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

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.