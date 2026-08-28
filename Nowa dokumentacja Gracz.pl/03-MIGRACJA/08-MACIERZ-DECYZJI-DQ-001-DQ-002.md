# ETAP 3 — Macierz decyzji DQ-001 / DQ-002

Data: 28.08.2026  
Status: **DQ-001 DECISION-READY / DQ-002 DECISION-READY — 5 KONT POTWIERDZONYCH JAKO TESTOWE / BEZ DML / DDL V3 NO-GO**

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

## 3. Decyzja biznesowa właściciela projektu

Właściciel projektu potwierdził 28.08.2026, że wszystkie pięć kont objętych DQ-002 zostało utworzonych testowo podczas prac nad Gracz.pl.

To rozstrzyga brakujący status biznesowy. Informacja ta nie zmienia historycznego evidence ani nie oznacza automatycznej zgody na fizyczne usunięcie danych.

## 4. Macierz per-account po decyzji biznesowej

| Konto | Grupa | Evidence skrót | Klasyfikacja |
|---|---|---|---|
| `gamerpl` | A | unverified; reg code 1; auth 0; audit 0; newsletter pending | `LEGACY-IDENTITY` — TEST |
| `gamerde` | A | unverified; reset 1; reg code 1; audit login footprint | `LEGACY-IDENTITY` — TEST |
| `gracz.pl` | B | verified; 3 sent messages; 4 login audit events; newsletter subscribed | `LEGACY-IDENTITY` — TEST; zachować provenance/history do czasu kontrolowanej remediation |
| `gamerpolska` | B | verified; activation/login lineage; newsletter subscribed | `LEGACY-IDENTITY` — TEST |
| `gamer` | B | verified; 4 historical sessions; activation/login/logout; newsletter subscribed | `LEGACY-IDENTITY` — TEST |

## 5. Formalna decyzja DQ-002

- Wszystkie pięć kont: **LEGACY-IDENTITY / TEST**.
- `KEEP-CANONICAL`: NIE jest wymagane dla żadnego z pięciu kont jako konta produkcyjnego.
- `REQUIRE-EMAIL-CHANGE`: NIE jest wymagane jako polityka aktywnego użytkownika, ponieważ konta zostały biznesowo sklasyfikowane jako testowe.
- `MERGE`: NIE.
- Automatyczny `DELETE`: NIE.
- Historyczne zależności, wiadomości, audit, newsletter/recovery/session artefacts muszą zostać uwzględnione przez przyszłą kontrolowaną remediation.

## 6. Status bramki

**DQ-002: DECISION-READY.** Techniczne evidence i wymagane rozstrzygnięcie biznesowe są kompletne.

Nie wykonano DML. Następny krok ETAPU 3 to przygotowanie reviewowalnej remediation DML oraz zamknięcie pozostałych gate'ów preflight przed jakąkolwiek mutacją produkcji.

**DDL V3: NO-GO** — zamknięcie decyzji DQ-002 nie zamyka pozostałych bramek preflight.