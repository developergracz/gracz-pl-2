# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy
Dokumentacja rozdziela: **POTWIERDZONE**, **WYMAGA WERYFIKACJI ŚRODOWISKA**, **ARCHITEKTURA DOCELOWA** oraz **ARTEFAKTY WYKONAWCZE MIGRACJI**. Bazą analizy kodowej był `origin/main @ db3c15a`; dowody środowiskowe są dokumentowane osobno. Dla bieżącego writer/reader inventory dodatkowo przeanalizowano aktualny runtime wiring `main` przy stanie `8dee41deea93465f5777de318b5866be898ff237`.

## ETAP 1B — mapa PostgreSQL
**STATUS: ZAMKNIĘTY 28.08.2026.** Mapa kodowa 26/26; rzeczywisty Render: 28 tabel; porównanie i Model Match zakończone.

## ETAP 2 — architektura docelowa i PostgreSQL V3
**STATUS: ZAMKNIĘTY 28.08.2026.** Backend V3, PostgreSQL V3 Iteracje 1–8, macierz migracji 28/28 i finalny model zakończone.

## ETAP 3 — migracja
**STATUS: W TRAKCIE — PREFLIGHT / WRITER-READER INVENTORY 28/28 WYKONANE.**  
**DDL V3: NO-GO.**

### Data Quality
- **DQ-001 — DECISION-READY:** `LEGACY-QUARANTINE`; DML niewykonany.
- **DQ-002 — DECISION-READY:** 5/5 kont biznesowo potwierdzone jako testowe i sklasyfikowane `LEGACY-IDENTITY / TEST`; MERGE NIE; automatyczny DELETE NIE; DML niewykonany.

### Backup / restore
- **Bramka 3 — pełny backup: PASS.**
- **Bramka 4 — restore test: PASS.**
- Dowód: `03-MIGRACJA/12-BACKUP-I-RESTORE-TEST.md`.
- Restore wykonano do izolowanej PostgreSQL 18.6; odtworzenie zakończone bez błędu, 28/28 tabel dostępnych.

### Writer / Reader inventory
- `03-MIGRACJA/13-WRITER-READER-INVENTORY.md` — mapa **28/28** tabel produkcyjnych.
- Repozytoryjne writer/read paths, główne mutujące endpointy, transaction boundaries, cutover risk i V3 owners zostały sklasyfikowane.
- **Bramka 9 — WARNING:** mapa kodowa jest kompletna, ale do `PASS` pozostaje korelacja aktualnego deployu/procesów/jobów z analizowanym runtime.
- Szczególne ostrzeżenia: `gracz_game_sessions.version` nie jest używany przez aktualny store jako CAS; tournament lifecycle jest wielostatementowy; newsletter lifecycle analytics są best-effort po core commicie; Chat DB→realtime nie jest atomowy; dwa production-only legacy tables nie mają potwierdzonego current runtime path.

### Remediation planning
Przygotowano reviewowalny komplet:
- `03-MIGRACJA/09a-dml-precheck-readonly.sql` — readonly snapshot/assertions.
- `03-MIGRACJA/09b-dq001-remediation.sql` — DQ-001 review-only, obecnie NO-OP.
- `03-MIGRACJA/09c-dq002-remediation.sql` — DQ-002 review-only, obecnie NO-OP.
- `03-MIGRACJA/09d-dml-postcheck-readonly.sql` — readonly verify.
- `03-MIGRACJA/09e-rollback-procedure.md` — STOP/rollback procedure.
- `03-MIGRACJA/09f-remediation-runbook.md` — kolejność review i warunki dopuszczenia przyszłych mutacji.

Aktualne 09a–09d nie zmieniają danych; mutujący DML nie został przygotowany ani wykonany. Dla DQ-002 preferowany bezpieczny kierunek to zachowanie historycznych rekordów/provenance i wykluczenie testowych identity z aktywnego backfill V3, zamiast automatycznego DELETE.

### Aktualny punkt wznowienia
**ETAP 3 → PREFLIGHT GATE 10 — worker/event/realtime inventory.**

### Otwarte bramki krytyczne
- fresh schema snapshot/diff,
- deploy/process/job correlation potrzebna do domknięcia bramki 9,
- worker/event/realtime inventory,
- crypto compatibility Messaging/attachments/MFA,
- active-state/cutover assessment,
- credential rotation/least privilege/secret hygiene,
- późniejszy rerun data-quality/reconciliation,
- rollback/maintenance window i finalny GO/NO-GO.

## Artefakty ETAPU 3 — główne
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
- `03-MIGRACJA/09a-dml-precheck-readonly.sql`
- `03-MIGRACJA/09b-dq001-remediation.sql`
- `03-MIGRACJA/09c-dq002-remediation.sql`
- `03-MIGRACJA/09d-dml-postcheck-readonly.sql`
- `03-MIGRACJA/09e-rollback-procedure.md`
- `03-MIGRACJA/09f-remediation-runbook.md`
- `03-MIGRACJA/10-CHECKLISTA-DQ-001-GUEST-ORIGIN.md`
- `03-MIGRACJA/11-DQ-002-PER-ACCOUNT-EVIDENCE-COLLECTOR.sql`
- `03-MIGRACJA/11-DQ-002-PER-ACCOUNT-EVIDENCE.md`
- `03-MIGRACJA/12-BACKUP-I-RESTORE-TEST.md`
- `03-MIGRACJA/13-WRITER-READER-INVENTORY.md`

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