# ETAP 3 — Macierz decyzji DQ-001 / DQ-002

Data: 28.08.2026  
Status: **DQ-001 DECISION-READY / DQ-002 EVIDENCE COMPLETE — BUSINESS RESOLUTION REQUIRED / BEZ DML / DDL V3 NO-GO**

## 1. DQ-001

Root cause potwierdzony: EPHEMERAL-GUEST został dopuszczony przez lukę authorization/bounded-context do persistent Social writer. Decyzja: **LEGACY-QUARANTINE**. `MAP-TO-CANONICAL`: NIE. Backfill do aktywnego Social V3: NIE. Fizyczny DELETE nie jest autoryzowany.

## 2. DQ-002 — POTWIERDZONE

- 2 grupy normalized-email / 5 kont.
- Wszystkie konta powstały przed guardem unique-email w commit `6e7a55ea8e5d2f4db4dabb2e15d1e1acb459bf1c`.
- Collector 11 wykonano na produkcyjnym Render PostgreSQL 18.4 w READ ONLY i zakończono ROLLBACK.
- Grupa A: `gamerpl`, `gamerde`.
- Grupa B: `gracz.pl`, `gamerpolska`, `gamer`.
- Brak podstaw do automatycznego MERGE lub DELETE.
- W chwili capture żadne z pięciu kont nie miało aktywnej auth session.
- Wszystkie pięć ma 0 references w Social/Global Chat/Moderation, Tournament i badanym Games footprint.

## 3. Macierz per-account

| Konto | Grupa | Evidence | Decyzja techniczna | Co pozostaje |
|---|---|---|---|---|
| `gamerpl` | A | unverified; reg code 1; auth 0; audit 0; newsletter pending | `REQUIRE-EMAIL-CHANGE` dla aktywnego konta albo `LEGACY-IDENTITY` po potwierdzeniu | status biznesowy / kontrola kanału |
| `gamerde` | A | unverified; reset 1; reg code 1; audit: pending-registration + 5 login | `REQUIRE-EMAIL-CHANGE` dla aktywnego konta albo `LEGACY-IDENTITY` po potwierdzeniu | status biznesowy / kontrola kanału |
| `gracz.pl` | B | verified; 3 sent messages; 4 login audit events; newsletter subscribed | zachować identity/history; `KEEP-CANONICAL` tylko po potwierdzeniu prawa do kanału, inaczej `REQUIRE-EMAIL-CHANGE` | wybór canonical w grupie B |
| `gamerpolska` | B | verified; activation; 5 login + logout; newsletter subscribed | zachować identity/history; `KEEP-CANONICAL` tylko po potwierdzeniu prawa do kanału, inaczej `REQUIRE-EMAIL-CHANGE` | wybór canonical w grupie B |
| `gamer` | B | verified; 4 historical sessions, 0 active; activation; login/logout; newsletter subscribed | zachować identity/history; `KEEP-CANONICAL` tylko po potwierdzeniu prawa do kanału, inaczej `REQUIRE-EMAIL-CHANGE` | wybór canonical w grupie B |

## 4. Zasada decyzji DQ-002

Wspólny normalized-email nie dowodzi wspólnej osoby. Dlatego:

- **MERGE — NIE na obecnym evidence.**
- **DELETE — NIE na obecnym evidence.**
- Maksymalnie jedno konto w każdej grupie może zachować konfliktujący canonical normalized-email.
- Pozostałe aktywne konta: `REQUIRE-EMAIL-CHANGE`.
- `LEGACY-IDENTITY` tylko po osobnym potwierdzeniu statusu test/legacy/inactive.
- Collector nie może sam wskazać właściciela kanału kontaktowego; wymaga to biznesowego/ownership resolution.

## 5. Status bramki

DQ-002 nie jest już zablokowane brakiem technicznego evidence. Jest zablokowane **wyłącznie przed mutacją** brakiem ostatecznego business/ownership resolution dla każdej grupy.

**DML: NIE WYKONYWAĆ.**  
**DDL V3: NO-GO.**

Po zatwierdzeniu per-account ownership/status można zamrozić decision record i przygotować reviewowalny DML remediation. Pozostałe gate'y preflight nadal obowiązują.