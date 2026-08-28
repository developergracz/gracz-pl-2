# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja rozdziela: **POTWIERDZONE**, **WYMAGA WERYFIKACJI ŚRODOWISKA**, **ARCHITEKTURA DOCELOWA** oraz **ARTEFAKTY WYKONAWCZE MIGRACJI**. Bazą analizy kodowej był `origin/main @ db3c15a`; dowody środowiskowe są dokumentowane osobno.

## ETAP 1B — mapa PostgreSQL

**STATUS: ZAMKNIĘTY 28.08.2026.** Mapa kodowa 26/26; rzeczywisty Render: 28 tabel; porównanie i Model Match zakończone.

## ETAP 2 — architektura docelowa i PostgreSQL V3

**STATUS: ZAMKNIĘTY 28.08.2026.** Backend V3, PostgreSQL V3 Iteracje 1–8, macierz migracji 28/28 i finalny model zakończone.

## ETAP 3 — migracja

**STATUS: W TRAKCIE — REMEDIATION-PLANNING.**  
**DDL V3: NO-GO.**

### Data Quality

- **DQ-001 — DECISION-READY:** root cause EPHEMERAL-GUEST -> persistent Social writer; decyzja `LEGACY-QUARANTINE`; DML niewykonany.
- **DQ-002 — DECISION-READY:** collector 11 wykonany READ ONLY i zakończony ROLLBACK; 2 grupy / 5 kont potwierdzone. Właściciel projektu potwierdził, że wszystkie pięć kont było utworzonych testowo podczas prac nad Gracz.pl. Wszystkie sklasyfikowano `LEGACY-IDENTITY / TEST`. MERGE: NIE. Automatyczny DELETE: NIE. DML niewykonany.

### DQ-002 — decyzja per-account

- `gamerpl` — `LEGACY-IDENTITY / TEST`.
- `gamerde` — `LEGACY-IDENTITY / TEST`.
- `gracz.pl` — `LEGACY-IDENTITY / TEST`; zachować provenance/history prywatnych wiadomości.
- `gamerpolska` — `LEGACY-IDENTITY / TEST`; zachować audit/newsletter provenance.
- `gamer` — `LEGACY-IDENTITY / TEST`; zachować session/audit/newsletter provenance.

`KEEP-CANONICAL` i `REQUIRE-EMAIL-CHANGE` nie są wymagane dla tych pięciu jako aktywnych identity. Historyczne zależności muszą być obsłużone przez kontrolowaną remediation.

### Aktualny punkt wznowienia

**ETAP 3 → REMEDIATION-PLANNING → przygotowanie reviewowalnych artefaktów DML dla DQ-001 i DQ-002, bez wykonywania ich na produkcji.**

### Otwarte bramki krytyczne

- przygotowanie remediation + późniejszy rerun data-quality,
- fresh schema snapshot/diff,
- pełny backup + udokumentowany restore test,
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
- `03-MIGRACJA/08-MACIERZ-DECYZJI-DQ-001-DQ-002.md` — DQ-001 i DQ-002 decision-ready.
- `03-MIGRACJA/09-PLAN-DML-REMEDIATION.md` — plan po decyzji 5x `LEGACY-IDENTITY / TEST`, bez wykonywalnego SQL.
- `03-MIGRACJA/10-CHECKLISTA-DQ-001-GUEST-ORIGIN.md` — DQ-001 decision-ready.
- `03-MIGRACJA/11-DQ-002-PER-ACCOUNT-EVIDENCE-COLLECTOR.sql` — wykonany READ ONLY.
- `03-MIGRACJA/11-DQ-002-PER-ACCOUNT-EVIDENCE.md` — evidence + business resolution complete.

## Spis dokumentacji — ETAP 2

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

### PostgreSQL V3
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