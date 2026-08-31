# Nowa dokumentacja Gracz.pl — status i spis treści

Data aktualizacji: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Branch: `main`

## 1. Zasada źródła prawdy

Dokumentacja rozdziela:

- stan potwierdzony dowodami,
- stan wymagający świeżej weryfikacji środowiska,
- architekturę docelową,
- projekty wykonawcze,
- faktyczne autoryzacje operacyjne.

Ukończenie dokumentu nie oznacza udzielenia zgody na wykonanie. Żaden plik dokumentacyjny nie zdejmuje freeze automatycznie.

Pełny indeks artefaktów znajduje się w:

- `00A-INDEKS-PAKIETU-DO-NIEZALEZNEGO-PRZEGLADU.md`.

## 2. Inwentarz bieżący

Katalog `Nowa dokumentacja Gracz.pl/` zawiera 123 pliki:

| Obszar | Liczba plików |
|---|---:|
| Dokumenty główne | 3 |
| `01-ARCHITEKTURA` | 3 |
| `02-BAZA-DANYCH` | 21 |
| `03-MIGRACJA` | 95 |
| `09-DECYZJE-ARCHITEKTONICZNE` | 1 |
| **Łącznie** | **123** |

## 3. Status etapów

| Etap | Status |
|---|---|
| ETAP 1B — mapa PostgreSQL | `CLOSED` |
| ETAP 2 — architektura backendu i PostgreSQL V3 | `CLOSED` |
| ETAP 3 — preflight i Gate 15 | `CLOSED` |
| Gate 15 | `GO TO ETAP 4 / PRODUCTION V3 NO-GO` |
| ETAP 4 | `OPEN` |
| E4.0 | `OPERATIONALLY COMPLETE / FREEZE ACTIVE` |
| E4.1 | `IN PROGRESS / H BLOCKED` |
| E4.1-H | `PENDING / SAFE HOLD` |
| E4.2–E4.10 | `NOT AUTHORIZED / NOT COMPLETE` |
| Production V3 | `NO-GO` |

## 4. Potwierdzone dowody E4.1

- frozen source baseline i integralność pakietu migracji: potwierdzone,
- fresh Gate 13 active-state evidence: `PASS`,
- fresh Gate 14 DB permissions capture: `PASS`; stan AS-IS nadal wymaga remediation,
- fresh backup anchor: `PASS`,
- restore validation: `PASS`,
- zgodność produkcji z restore: 28/28 tabel, 17 711/17 711 rekordów, 0 różnic,
- historyczny crypto proof: 5/5 wiadomości czytelnych, w tym 2 rekordy `enc:v1` rzeczywiście odszyfrowane i 3 rekordy legacy czytelne bez deszyfracji; 2/2 załączniki,
- fresh E4.1-H crypto decryptability: `PENDING / SAFE HOLD`.

Historyczny wynik crypto nie zastępuje świeżego E4.1-H.

## 5. Obowiązujący status E4.1-H

```text
DOCUMENTATION DESIGN 62-77 = COMPLETE
FORMAL T-GATES = NOT EXECUTED
C0-S1 / C0-S3 = NOT AUTHORIZED
A1 / A2 / A3 = NOT AUTHORIZED
FREEZE RELEASE = NOT AUTHORIZED
AUTHORIZED OPERATIONS = NONE
RSK-E41H-009 = OPEN / CRITICAL / TIME-BOUND
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Dokument 77 kończy projekt dokumentacyjny sekwencji 62–77. Nie tworzy się automatycznie dokumentu 78.

## 6. Architektura i baza danych

### Architektura

- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md`
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`
- `01-ARCHITEKTURA/03-SKONSOLIDOWANA-ARCHITEKTURA-SYSTEMOWA-GRACZ-PL-V3.md`

Skonsolidowana architektura systemowa V3 istnieje w wersji `0.2 / DESIGN DRAFT`. Przegląd strukturalny i spójności zakończył się `PASS`, natomiast bramka `REVIEWED DESIGN` pozostaje w `HOLD` do zamknięcia albo formalnej akceptacji trzech ADR klasy P0: `ADR-V3-004`, `ADR-V3-012` i `ADR-V3-013`.

### PostgreSQL

Dokumenty `02-BAZA-DANYCH/00–20` obejmują:

- model AS-IS,
- porównanie repozytorium z produkcją,
- model match i rozbieżności,
- docelowy PostgreSQL V3,
- identity, gry, turnieje, newsletter, messaging/chat i moderację,
- macierz migracji 28 tabel AS-IS do V3.

ETAP 1B i ETAP 2 pozostają zamknięte.

## 7. Aktualny punkt wznowienia dokumentacji

Skonsolidowana architektura systemowa V3 została zmaterializowana i rozwinięta do wersji `0.2 / DESIGN DRAFT`:

```text
01-ARCHITEKTURA/03-SKONSOLIDOWANA-ARCHITEKTURA-SYSTEMOWA-GRACZ-PL-V3.md
```

Pierwszy ADR klasy P0 został opracowany:

```text
09-DECYZJE-ARCHITEKTONICZNE/ADR-V3-004-MATCH-RUNTIME-LEASE-FENCING-ENFORCEMENT.md
```

Status ADR-V3-004:

```text
DESIGN CONTENT = COMPLETE
FORMAL ACCEPTANCE = PENDING REVIEW
IMPLEMENTATION = NOT AUTHORIZED
```

Kolejność dalszej pracy dokumentacyjnej:

1. formalny review i decyzja dla `ADR-V3-004`,
2. opracowanie `ADR-V3-012` — retencja, privacy deletion i legal hold,
3. opracowanie `ADR-V3-013` — ownership, checkpointy i rebuild read models,
4. ponowny review V3 0.2 i decyzja o statusie `REVIEWED DESIGN`.

Żaden z tych kroków nie autoryzuje implementacji ani wdrożenia.

## 8. Reguła dalszej pracy

- E4.1-H pozostaje w SAFE HOLD.
- Nie wykonujemy T-14, T-10, T-7 ani T-3 bez jawnej decyzji i named owners.
- Nie udzielamy C0-S1/C0-S3/A1/A2/A3 przez samą aktualizację dokumentacji.
- Nie zmieniamy produkcji, Rendera ani sekretów.
- Nowe pakiety dokumentacyjne muszą wynikać ze skonsolidowanej architektury systemowej.
- Każdy ukończony i zweryfikowany dokument jest wersjonowany w Git.
