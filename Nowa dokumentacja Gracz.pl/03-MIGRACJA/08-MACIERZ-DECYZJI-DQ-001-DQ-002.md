# ETAP 3 — Macierz decyzji DQ-001 / DQ-002

Data: 28.08.2026  
Status: **DQ-001 DECISION-READY / DQ-002 OTWARTE — BEZ DML / DDL V3 NO-GO**

## 1. Cel

Dokument łączy dowody Data Quality z decyzjami remediation przed wykonaniem jakiegokolwiek DML lub V3 DDL.

Zakres:

- **DQ-001** — orphan friendship z ephemeral guest,
- **DQ-002** — 2 grupy normalized-email obejmujące 5 kont.

## 2. POTWIERDZONE

### DQ-001

- istnieje 1 orphan friendship,
- requester ma format `guest-*`, addressee jest canonical account,
- `gracz_chat_friends` nie ma FK do `gracz_accounts`,
- `requestFriend()` nie sprawdza istnienia obu kont,
- commit `a377bfc151914ba8bc448cf6e55ffb9598f522eb` dodał ephemeral guest tokens dla podglądu gier,
- commit `06b6352499332c35fcf836d1dac5b0b9a21469aa` dodał `POST /auth/guest`, generujący `guest-` + 8 hex i 30-minutową sesję,
- guest celowo nie wymaga `gracz_accounts` ani normalnego wpisu session registry,
- commit `2b8821088dd7025bd4c97680d1b84650288eae90` dodał wejście „jako gość” do demonstracji Tysiąca, bez zakładania konta i bez wpływu na ranking,
- `trustedChatUser()` nie odrzuca guest capability,
- `requestFriend()` może więc utrwalić ephemeral guest jako requestera persistent friendship.

### DQ-002

- 2 grupy normalized-email, łącznie 5 kont,
- wszystkie 5 kont powstało przed commitem `6e7a55ea8e5d2f4db4dabb2e15d1e1acb459bf1c` dodającym guard unique-email,
- najpóźniejsze konto powstało około 11 min 33 s przed guardem,
- obecny standardowy writer blokuje nowe kolizje po `trim().toLowerCase()`.

## 3. DQ-001 — klasyfikacja i decyzja

### Root cause

**EPHEMERAL-GUEST został dopuszczony przez lukę authorization/bounded-context do persistent Social writer.**

Nie ma podstaw, by traktować `guest-*` jako usunięte lub niepełne konto. Mechanizm został zaprojektowany właśnie jako tożsamość bez konta.

### Macierz

| Pole | Wynik |
|---|---|
| Typ principalu | **EPHEMERAL-GUEST** |
| Persistence Identity | Brak canonical account z założenia |
| Generator | `POST /auth/guest`, `randomBytes(4).hex` |
| TTL | 1800 s domyślnie |
| Trwała relacja Social przez guest | Możliwa wskutek luki authz/writera |
| Canonical mapping | Brak dowodu |
| `MAP-TO-CANONICAL` | **NIE** |
| Backfill do aktywnego Social V3 | **NIE** |
| Decyzja remediation | **LEGACY-QUARANTINE** |
| Późniejszy DELETE | Tylko osobno zatwierdzony, po zachowaniu provenance |
| Status DQ-001 | **DECISION-READY** |

### Wymaganie V3

Persistent Social writes muszą wymagać canonical registered identity; guest capability musi być jawnie odrzucana dla trwałych operacji Social, a requester/addressee muszą przejść canonical identity validation.

## 4. DQ-002 — zasada nadrzędna

Wspólny normalized-email **nie jest dowodem wspólnej osoby**. Dlatego:

- brak automatycznego MERGE,
- brak automatycznego DELETE,
- brak wyboru canonical account tylko po wieku lub liczbie danych,
- brak V3 `UNIQUE(email_normalized)` do czasu remediation.

### Grupa A

- `gamerpl`
- `gamerde`

### Grupa B

- `gracz.pl`
- `gamerpolska`
- `gamer`

## 5. Macierz per konto DQ-002

| Konto | Grupa | Potwierdzony footprint z drill-down | Kandydat remediation | Status |
|---|---|---|---|---|
| `gamerpl` | A | registration code | KEEP-CANONICAL lub REQUIRE-EMAIL-CHANGE | TBD-EVIDENCE + TBD-BUSINESS |
| `gamerde` | A | reset token + registration code | KEEP-CANONICAL lub REQUIRE-EMAIL-CHANGE | TBD-EVIDENCE + TBD-BUSINESS |
| `gracz.pl` | B | private messages sent | KEEP-CANONICAL lub REQUIRE-EMAIL-CHANGE | TBD-EVIDENCE + TBD-BUSINESS |
| `gamerpolska` | B | brak zależności w dotychczasowym drill-downie | REQUIRE-EMAIL-CHANGE / LEGACY-IDENTITY / KEEP-CANONICAL po evidence | TBD-EVIDENCE + TBD-BUSINESS |
| `gamer` | B | auth sessions | KEEP-CANONICAL lub REQUIRE-EMAIL-CHANGE / LEGACY-IDENTITY | TBD-EVIDENCE + TBD-BUSINESS |

## 6. Dozwolone polityki DQ-002

- **KEEP-CANONICAL** — maksymalnie jedno konto w grupie zachowuje canonical normalized-email po potwierdzeniu prawa do kanału kontaktowego.
- **REQUIRE-EMAIL-CHANGE** — konto i historia zostają; użytkownik musi zweryfikować nowy adres.
- **LEGACY-IDENTITY** — dla potwierdzonych kont legacy/test/inactive.
- **MERGE** — tylko jako wyjątkowa decyzja przy silnym dowodzie wspólnej osoby, pełnej mapie zależności i immutable provenance.

## 7. Evidence wymagane przed decyzją DQ-002

Dla każdego konta:

1. `created_at`, verification state,
2. ostatnia aktywność i sessions,
3. messages/attachments,
4. reset tokens / registration codes,
5. audit/roles,
6. game/tournament/moderation/newsletter references,
7. writer/deploy lineage, jeśli możliwa,
8. status biznesowy,
9. dowód kontroli nad kanałem kontaktowym.

## 8. Formalny status

- **DQ-001: przyczyna zamknięta, decyzja LEGACY-QUARANTINE zapisana; DML niewykonany.**
- **DQ-002: otwarte — wymagane per-account evidence i decyzje.**
- **DDL V3: NO-GO.**

Następny krok: zebrać privacy-safe evidence DQ-002 dla pięciu kont, następnie uzupełnić `09-PLAN-DML-REMEDIATION.md`; wykonywalny DML powstanie dopiero po zamknięciu wymaganych gate'ów.