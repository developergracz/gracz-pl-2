# ETAP 3 — DQ-002: evidence per-account dla 5 kont

Data: 28.08.2026  
Status: **EVIDENCE COMPLETE / BUSINESS RESOLUTION COMPLETE / 5x LEGACY-IDENTITY TEST / BEZ DML / DDL V3 NO-GO**

## 1. Źródło evidence

Collector `11-DQ-002-PER-ACCOUNT-EVIDENCE-COLLECTOR.sql` wykonano na Render PostgreSQL 18.4 w `BEGIN TRANSACTION READ ONLY`; wynik zakończył się `ROLLBACK`. Capture: 2026-08-28 14:22:35 UTC. Nie wykonano DML ani DDL.

## 2. POTWIERDZONE — grupy kolizji

- Grupa A / `8e1fe098170985141c8c0073377d51e1`: `gamerde`, `gamerpl` — 2 konta.
- Grupa B / `9c22fd45d3bc5aa1e89eaf8d61de97e9`: `gamer`, `gamerpolska`, `gracz.pl` — 3 konta.
- Łącznie: 2 grupy / 5 kont.
- Wspólny normalized-email jest korelacją kanału kontaktowego, nie samodzielnym dowodem identity.

## 3. Evidence per-account

| Konto | Created | Verified | Auth | Messages | Recovery/Reg | Social/Mod | Games | Tournament | Newsletter correlation | Audit |
|---|---|---|---|---|---|---|---|---|---|---|
| `gamerpl` | 2026-08-26 04:54 UTC | NIE | 0 sessions | 0 | registration code 1 | 0 | 0 | 0 | 1 pending | 0 events |
| `gamerde` | 2026-08-26 22:36 UTC | NIE | 0 sessions | 0 | reset token 1 + registration code 1 | 0 | 0 | 0 | 1 pending | 6 audit events |
| `gracz.pl` | 2026-08-22 00:19 UTC | TAK | 0 persisted sessions | 3 sent | 0 | 0 | 0 | 0 | 1 subscribed | 4 login events |
| `gamerpolska` | 2026-08-26 04:42 UTC | TAK | 0 persisted sessions | 0 | 0 | 0 | 0 | 0 | 1 subscribed | 9 events |
| `gamer` | 2026-08-27 07:20 UTC | TAK | 4 sessions, 0 active now | 0 | 0 | 0 | 0 | 0 | 1 subscribed | 6 events |

## 4. Audit lineage

- `gamer`: registration pending 1, activation verified 1, login 2, logout 2.
- `gamerde`: registration pending 1, login 5.
- `gamerpl`: brak audit events w zebranym evidence.
- `gamerpolska`: registration pending 1, activation verified 1, registration failed 1, login 5, logout 1.
- `gracz.pl`: login 4; brak registration/activation event w aktualnym audit footprint mimo `contact_verified=true`.

## 5. Rozstrzygnięcie biznesowe

Właściciel projektu potwierdził 28.08.2026, że **wszystkie pięć kont zostało założonych testowo podczas prac nad Gracz.pl**.

Na tej podstawie każde z pięciu kont otrzymuje klasyfikację:

**`LEGACY-IDENTITY / TEST`**.

To rozstrzygnięcie usuwa potrzebę wyboru `KEEP-CANONICAL` pomiędzy tymi pięcioma kontami jako aktywnymi identity. Nie jest jednak zgodą na automatyczny DELETE: istnieją historyczne artefakty, w tym wiadomości, audit, registration/recovery, auth sessions i newsletter correlation, które muszą zostać bezpiecznie obsłużone w remediation.

## 6. Decyzja per-account

- `gamerpl` — `LEGACY-IDENTITY / TEST`.
- `gamerde` — `LEGACY-IDENTITY / TEST`.
- `gracz.pl` — `LEGACY-IDENTITY / TEST`; zachować provenance/history prywatnych wiadomości.
- `gamerpolska` — `LEGACY-IDENTITY / TEST`; zachować audit/newsletter provenance.
- `gamer` — `LEGACY-IDENTITY / TEST`; zachować session/audit/newsletter provenance.

**MERGE: NIE. Automatyczny DELETE: NIE. REQUIRE-EMAIL-CHANGE: NIE dla tych testowych identity.**

## 7. Formalny status

**DQ-002: DECISION-READY.** Evidence techniczne i rozstrzygnięcie biznesowe są kompletne.

Nie wykonano DML. Następny krok: przygotowanie reviewowalnych artefaktów remediation i domknięcie pozostałych bramek preflight. Globalnie **DDL V3: NO-GO**.