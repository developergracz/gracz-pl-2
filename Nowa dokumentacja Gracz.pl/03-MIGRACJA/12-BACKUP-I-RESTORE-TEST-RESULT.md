# ETAP 3 — Backup + real restore test — wynik

Data: 28.08.2026  
Status: **OCZEKUJE NA WYKONANIE — GATE 3 NOT VERIFIED / GATE 4 NOT VERIFIED**

## Backup evidence

- Source: Render PostgreSQL `gracz_pl_database` (bez credentials)
- Backup timestamp UTC: TODO
- pg_dump version: TODO
- Format: PostgreSQL custom (`-Fc`)
- Filename: `gracz-preflight-full-2026-08-28.dump`
- Size bytes: TODO
- SHA-256: TODO
- `pg_restore --list`: TODO PASS/FAIL

## Restore evidence

- Restore target: TODO — musi być odrębny i nieprodukcyjny
- Restore start UTC: TODO
- Restore end UTC: TODO
- `pg_restore --exit-on-error` status: TODO
- Public base tables: expected 28 / actual TODO
- Critical row-count reconciliation: TODO
- PK/UNIQUE/FK verification: TODO
- Sequences/identity verification: TODO
- Read-only smoke tests: TODO
- Crypto smoke test: osobna bramka; TODO
- Anomalies: TODO

## Gate result

- Gate 3 — Full backup: **NOT VERIFIED**
- Gate 4 — Real restore test: **NOT VERIFIED**
- DDL V3: **NO-GO**

Ten dokument wolno oznaczyć PASS wyłącznie na podstawie rzeczywistego wykonania i evidence. Samo przygotowanie runbooka nie jest dowodem backupu ani restore.