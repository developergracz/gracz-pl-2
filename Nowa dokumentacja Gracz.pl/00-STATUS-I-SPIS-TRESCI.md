# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja rozdziela: **POTWIERDZONE**, **WYMAGA WERYFIKACJI ŚRODOWISKA**, **ARCHITEKTURA DOCELOWA** oraz **ARTEFAKTY WYKONAWCZE MIGRACJI**. Bazą rozpoczętej analizy kodowej był `origin/main @ db3c15a`; dowody środowiskowe są dokumentowane osobno.

## ETAP 1B — mapa PostgreSQL

**STATUS: ZAMKNIĘTY 28.08.2026.**

Mapa kodowa 26/26, rzeczywisty dump Render 28 tabel, porównanie i Model Match zakończone.

## ETAP 2 — architektura docelowa i PostgreSQL V3

**STATUS: ZAMKNIĘTY 28.08.2026.**

Zatwierdzone: Backend V3, PostgreSQL V3 Iteracje 1–8, macierz migracji 28/28 i `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md`.

## ETAP 3 — migracja

**STATUS: W TRAKCIE od 28.08.2026.**

### FORMALNY GATE

**DDL V3: NO-GO.**

Aktualny stan Data Quality:

- **DQ-001 — ANALIZA PRZYCZYNY ZAMKNIĘTA / DECISION-READY.** Root cause: ephemeral guest przeznaczony do preview/demo został dopuszczony do persistent Social writer. Decyzja: `LEGACY-QUARANTINE`; żadnego DML jeszcze nie wykonano.
- **DQ-002 — OTWARTE.** 2 grupy normalized-email, 5 kont; wymagane privacy-safe per-account evidence i decyzja dla każdego konta.

Ponadto pozostają inne bramki preflight, więc zamknięcie DQ-001 nie zmienia globalnego NO-GO.

### Potwierdzone DQ-001

- commit `a377bfc151914ba8bc448cf6e55ffb9598f522eb` dodał tymczasowe guest sessions do podglądu gier,
- guest token ma domyślny TTL 1800 s, brak `jti` i z założenia nie wymaga `gracz_accounts` ani normalnej trwałej auth session,
- commit `06b6352499332c35fcf836d1dac5b0b9a21469aa` dodał `POST /auth/guest`, generujący serwerowo `guest-` + 8 hex,
- produkcyjny `guest-24ea096d` pasuje dokładnie do tego formatu,
- commit `2b8821088dd7025bd4c97680d1b84650288eae90` dodał UI wejścia do demonstracji Tysiąca jako gość, bez zakładania konta i bez wpływu na ranking,
- `trustedChatUser()` nie odrzuca guest capability,
- `requestFriend()` nie waliduje requestera/addressee względem `gracz_accounts`,
- w rezultacie ephemeral guest mógł utworzyć persistent friendship,
- `MAP-TO-CANONICAL` nie ma podstaw dowodowych,
- aktywny backfill Social V3 ma wykluczyć ten rekord; kierunek remediation: `LEGACY-QUARANTINE`.

### Potwierdzone DQ-002

- drill-down: 2 grupy / 5 kont,
- grupa A: `gamerpl`, `gamerde`,
- grupa B: `gracz.pl`, `gamerpolska`, `gamer`,
- guard unique-email został dodany dopiero w `6e7a55ea8e5d2f4db4dabb2e15d1e1acb459bf1c`,
- wszystkie 5 kont powstało wcześniej; najpóźniejsze około 11 min 33 s przed guardem,
- brak automatycznego MERGE/DELETE.

### Stan środowiskowy

- Render PostgreSQL 18.4,
- 28/28 tabel,
- 13 865 rekordów łącznie,
- `gracz_audit_log`: 13 743 (~99,1%),
- DB ok. 8,2 MiB,
- 1 orphan friendship,
- 2 grupy collision / 5 accounts,
- 3 divergences newsletter `consent_at` vs `consented_at`.

### Otwarte bramki krytyczne

- DQ-002 per-account evidence i decyzje,
- remediation + rerun data-quality,
- fresh schema snapshot/diff,
- pełny backup + restore test,
- pełny writer/reader/endpoint/worker inventory,
- crypto compatibility Messaging/attachments/MFA,
- active-state/cutover assessment,
- credential rotation/least privilege/secret hygiene,
- rollback/maintenance window i finalny GO/NO-GO.

## Artefakty ETAPU 3

- `03-MIGRACJA/01-PREFLIGHT-MIGRACJI.md`
- `03-MIGRACJA/02-ENVIRONMENT-BASELINE-COLLECTOR.sql`
- `03-MIGRACJA/02-ENVIRONMENT-BASELINE.md`
- `03-MIGRACJA/03-DATA-PROFILE-COLLECTOR.sql`
- `03-MIGRACJA/03-DATA-PROFILE-28-TABLES.md`
- `03-MIGRACJA/04-PLAN-DDL-MIGRACJI-ITERACJA-2.md`
- `03-MIGRACJA/05-DATA-QUALITY-ORPHAN-COLLISION-COLLECTOR.sql`
- `03-MIGRACJA/05-DATA-QUALITY-ORPHAN-COLLISION.md`
- `03-MIGRACJA/06-BLOCKER-DRILLDOWN-COLLECTOR.sql`
- `03-MIGRACJA/07-AUDYT-WRITEROW-I-PLAN-NAPRAWY-BLOCKEROW.md`
- `03-MIGRACJA/08-MACIERZ-DECYZJI-DQ-001-DQ-002.md`
- `03-MIGRACJA/09-PLAN-DML-REMEDIATION.md`
- `03-MIGRACJA/10-CHECKLISTA-DQ-001-GUEST-ORIGIN.md` — **DQ-001 DECISION-READY**.

## Następny krok

**DQ-002 — zebrać privacy-safe evidence per account dla:**

- `gamerpl`,
- `gamerde`,
- `gracz.pl`,
- `gamerpolska`,
- `gamer`.

Następnie wypełnić decyzje per rekord w `08` i `09`. Dopiero po zamknięciu wymaganych gate'ów można przygotować i zatwierdzić wykonywalny DML, a później rozważać V3 DDL.

## Spis dokumentacji

### Architektura
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md`
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`

### PostgreSQL — AS-IS / porównanie
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

### PostgreSQL V3 — ETAP 2
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md`
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md`
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md`
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md`
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md`
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md`
- `02-BAZA-DANYCH/18-POSTGRESQL-V3-ITERACJA-7-MODERATION.md`
- `02-BAZA-DANYCH/19-POSTGRESQL-V3-ITERACJA-8-MACIERZ-MIGRACJI-28-AS-IS-DO-V3.md`
- `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md`

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany tutaj. AS-IS, dowody środowiskowe, architektura docelowa i artefakty migracyjne pozostają rozdzielone.