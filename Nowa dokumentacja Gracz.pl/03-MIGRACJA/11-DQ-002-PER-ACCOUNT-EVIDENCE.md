# ETAP 3 — DQ-002: evidence per-account dla 5 kont

Data: 28.08.2026  
Status: **ARTEFAKT EVIDENCE — COLLECTOR GOTOWY / OCZEKUJE NA WYNIK PRODUKCYJNY / BEZ DML / DDL V3 NO-GO**

## 1. Cel

Zebrać privacy-safe evidence techniczne i migracyjne dla pięciu kont objętych dwiema grupami kolizji normalized-email:

- `gamerpl`
- `gamerde`
- `gracz.pl`
- `gamerpolska`
- `gamer`

Dokument nie ujawnia surowych adresów e-mail, treści wiadomości, tokenów, kodów ani sekretów.

## 2. Collector

Źródło wykonawcze:

`11-DQ-002-PER-ACCOUNT-EVIDENCE-COLLECTOR.sql`

Collector działa w `BEGIN TRANSACTION READ ONLY` i kończy się `ROLLBACK`.

Zakres:

1. metadata konta i hash normalized-email,
2. auth sessions — liczba, aktywność, pierwszy/ostatni timestamp,
3. private messaging i attachments,
4. reset tokens / registration codes / MFA / role footprint,
5. social / global chat / moderation,
6. tournaments,
7. games — Tysiąc jako structured JSON, Warcaby jako oznaczony heuristic candidate count,
8. newsletter correlation po normalized-email bez wyświetlania adresu,
9. audit footprint i event types,
10. re-check składu grup DQ-002.

## 3. Zasady interpretacji

- Wspólny normalized-email nie jest dowodem wspólnej osoby.
- Newsletter correlation po normalized-email jest tylko dowodem wspólnego kanału kontaktowego, nie identity proof.
- Warcaby `state` jest legacy TEXT; wynik `LIKE` jest wyłącznie candidate evidence i wymaga potwierdzenia przed użyciem jako lineage.
- Brak rekordu w jednej tabeli nie dowodzi, że konto było nieużywane.
- Decyzja `MERGE` wymaga silnego, wieloźródłowego dowodu i osobnej autoryzacji.

## 4. Macierz wynikowa — do uzupełnienia po collectorze

| Konto | Created | Verified | Auth | Messages | Recovery/Reg | Social/Mod | Games | Tournament | Newsletter | Audit | Status biznesowy | Kandydat remediation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `gamerpl` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gamerde` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gracz.pl` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gamerpolska` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gamer` | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## 5. Kryteria decyzji per-account

### KEEP-CANONICAL

Dopuszczalne po potwierdzeniu prawa do kanału kontaktowego i braku sprzecznego evidence.

### REQUIRE-EMAIL-CHANGE

Preferowane dla niezależnego, aktywnego konta, które ma zachować historię, ale nie może zachować konfliktującego canonical normalized-email.

### LEGACY-IDENTITY

Dopuszczalne tylko po potwierdzeniu, że konto jest legacy/test/inactive lub nie powinno zachować aktywnego kanału e-mail.

### MERGE

Wyjątek wysokiego ryzyka. Nie podejmować na podstawie samego e-maila, timestampu ani liczby zależności.

## 6. Następny krok

Uruchomić collector na Render PostgreSQL bez ujawniania connection string/password, zapisać pełny wynik i na jego podstawie uzupełnić tę macierz oraz `08-MACIERZ-DECYZJI-DQ-001-DQ-002.md` i `09-PLAN-DML-REMEDIATION.md`.

Do czasu zebrania i zatwierdzenia evidence:

**DQ-002: OPEN**  
**DDL V3: NO-GO**
