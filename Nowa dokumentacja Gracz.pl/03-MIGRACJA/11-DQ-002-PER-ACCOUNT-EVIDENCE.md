# ETAP 3 — DQ-002: evidence per-account dla 5 kont

Data: 28.08.2026  
Status: **EVIDENCE PRODUKCYJNE ZEBRANE / DECYZJE TECHNICZNE PRZYGOTOWANE / BEZ DML / DDL V3 NO-GO**

## 1. Źródło evidence

Collector `11-DQ-002-PER-ACCOUNT-EVIDENCE-COLLECTOR.sql` wykonano na Render PostgreSQL 18.4 w `BEGIN TRANSACTION READ ONLY`; wynik zakończył się `ROLLBACK`. Capture potwierdzony: 2026-08-28 14:22:35 UTC. Nie wykonano DML ani DDL.

## 2. POTWIERDZONE — grupy kolizji

- Grupa A / `8e1fe098170985141c8c0073377d51e1`: `gamerde`, `gamerpl` — 2 konta.
- Grupa B / `9c22fd45d3bc5aa1e89eaf8d61de97e9`: `gamer`, `gamerpolska`, `gracz.pl` — 3 konta.
- Łącznie: 2 grupy / 5 kont.
- Wspólny normalized-email jest korelacją kanału kontaktowego, nie dowodem wspólnej osoby.

## 3. Evidence per-account

| Konto | Created | Verified | Auth | Messages | Recovery/Reg | Social/Mod | Games | Tournament | Newsletter correlation | Audit |
|---|---|---|---|---|---|---|---|---|---|---|
| `gamerpl` | 2026-08-26 04:54 UTC | NIE | 0 sessions | 0 | registration code 1 | 0 | 0 | 0 | 1 pending | 0 events |
| `gamerde` | 2026-08-26 22:36 UTC | NIE | 0 sessions | 0 | reset token 1 + registration code 1 | 0 | 0 | 0 | 1 pending | 6 audit events |
| `gracz.pl` | 2026-08-22 00:19 UTC | TAK | 0 persisted sessions | 3 sent | 0 | 0 | 0 | 0 | 1 subscribed | 4 login events |
| `gamerpolska` | 2026-08-26 04:42 UTC | TAK | 0 persisted sessions | 0 | 0 | 0 | 0 | 0 | 1 subscribed | 9 events |
| `gamer` | 2026-08-27 07:20 UTC | TAK | 4 sessions, 0 active now | 0 | 0 | 0 | 0 | 0 | 1 subscribed | 6 events |

### Audit lineage

- `gamer`: registration pending 1, activation verified 1, login 2, logout 2.
- `gamerde`: registration pending 1, login 5; brak activation-verified event w zebranym evidence.
- `gamerpl`: brak audit events w zebranym evidence.
- `gamerpolska`: registration pending 1, activation verified 1, registration failed 1, login 5, logout 1.
- `gracz.pl`: login 4; brak registration/activation event w aktualnym audit footprint, mimo `contact_verified=true` w rekordzie konta.

## 4. Interpretacja

### Grupa A — `gamerpl`, `gamerde`

Oba konta są `contact_verified=false`. `gamerpl` ma jedynie registration code i brak audit footprint. `gamerde` ma registration code, reset token oraz pięć zdarzeń logowania w audycie. Nie ma dowodu pozwalającego scalać te konta ani uznać jedno za tę samą osobę co drugie.

**Kierunek techniczny:** nie wybierać automatycznie KEEP-CANONICAL. Oba konta wymagają rozstrzygnięcia prawa do kanału kontaktowego. Dla konta, które ma pozostać aktywne, właściwą polityką jest zweryfikowanie kanału; przy konflikcie — `REQUIRE-EMAIL-CHANGE`. `LEGACY-IDENTITY` tylko po biznesowym potwierdzeniu, że dane konto jest testowe/legacy/inactive.

### Grupa B — `gracz.pl`, `gamerpolska`, `gamer`

Wszystkie trzy rekordy mają `contact_verified=true`, ale mają niezależny footprint: `gracz.pl` posiada historię 3 prywatnych wiadomości i logowania; `gamerpolska` ma pełną ścieżkę registration/activation oraz logowania; `gamer` ma registration/activation, 4 historyczne sesje i logowania. To jest silny argument przeciw automatycznemu MERGE/DELETE.

**Kierunek techniczny:** zachować wszystkie trzy identity records i ich historię. Maksymalnie jedno konto może finalnie zachować obecny canonical normalized-email; pozostałe aktywne konta powinny przejść `REQUIRE-EMAIL-CHANGE`, chyba że status biznesowy potwierdzi `LEGACY-IDENTITY`. Sam collector nie rozstrzyga, które z trzech ma prawo do KEEP-CANONICAL.

## 5. Co collector rozstrzygnął

- pełny techniczny footprint pięciu kont został zebrany,
- brak zależności Social/Global Chat/Moderation, Tournament oraz Games dla wszystkich pięciu,
- brak aktywnych auth sessions w chwili capture,
- brak podstaw do automatycznego MERGE lub DELETE,
- techniczne evidence per-account jest wystarczające do przygotowania polityki remediation,
- do ostatecznego przypisania `KEEP-CANONICAL` nadal potrzebny jest status biznesowy/dowód kontroli nad kanałem kontaktowym.

## 6. Formalny status

**DQ-002: EVIDENCE COMPLETE / BUSINESS RESOLUTION REQUIRED BEFORE MUTATION.**

Nie wykonano DML. Nie tworzyć jeszcze wykonywalnego remediation SQL. Globalnie **DDL V3: NO-GO**, ponieważ pozostają także inne bramki preflight.