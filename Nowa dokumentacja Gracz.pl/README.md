# Nowa dokumentacja Gracz.pl

## Status

Nowa, profesjonalna dokumentacja techniczna projektu **Gracz.pl**, tworzona w ramach audytu, modernizacji i przygotowania architektury V3.

**Rozpoczęcie zapisu repozytoryjnego:** 28.08.2026  
**Ostatnia synchronizacja indeksu:** 31.08.2026  
**Aktualny inwentarz:** 125 plików

Bieżący status projektu znajduje się w:

- `00-STATUS-I-SPIS-TRESCI.md`,
- `00A-INDEKS-PAKIETU-DO-NIEZALEZNEGO-PRZEGLADU.md`.

## Zasady prowadzenia dokumentacji

- Ten folder jest źródłem nowej dokumentacji projektu Gracz.pl.
- Nie należy mieszać go ze starszą dokumentacją w repozytorium.
- Dokumentacja musi rozróżniać stan AS-IS, architekturę docelową, projekty wykonawcze, dowody środowiskowe i autoryzacje.
- Ukończenie dokumentu nie jest zgodą na zmianę środowiska.
- Dokumentacja nie może zawierać sekretów, pełnych connection strings, haseł, tokenów ani niezredagowanych wartości środowiskowych.
- Zmiany są wersjonowane w Git.
- Każdy status musi mieć wskazane źródło dowodowe i datę aktualizacji.

## Faktyczna struktura

1. `00-STATUS-I-SPIS-TRESCI.md` — bieżący status i punkt wznowienia.
2. `00A-INDEKS-PAKIETU-DO-NIEZALEZNEGO-PRZEGLADU.md` — pełny indeks dokumentów.
3. `01-ARCHITEKTURA/` — architektura AS-IS, docelowa oraz skonsolidowana V3.
4. `02-BAZA-DANYCH/` — PostgreSQL AS-IS, porównanie i model V3.
5. `03-MIGRACJA/` — preflight, Gate 12–15, ETAP 4, evidence i runbooki.
6. `09-DECYZJE-ARCHITEKTONICZNE/` — przyjęte i proponowane ADR dla V3.

## Planowane pakiety po konsolidacji architektury

Numeracja przyszłych folderów nie może kolidować z istniejącym `03-MIGRACJA`. Folder `09-DECYZJE-ARCHITEKTONICZNE/` jest już aktywny; do utworzenia pozostają pakiety 04–08:

4. `04-BEZPIECZENSTWO/` — bezpieczeństwo aplikacji, danych i dostępu.
5. `05-GRY/` — wspólna platforma gier oraz Warcaby, Gomoku i Tysiąc.
6. `06-KOMUNIKACJA/` — wiadomości, chat, newsletter i powiadomienia.
7. `07-INFRASTRUKTURA/` — Render, Cloudflare, deployment i środowiska.
8. `08-TESTY-I-JAKOSC/` — testy, QA, kryteria odbioru i operacyjne dowody jakości.

Pakiety AI i marketplace nie są obecnie częścią faktycznej struktury. Mogą zostać dodane dopiero po udokumentowanej decyzji architektonicznej.

## Bieżący punkt dokumentacyjny

Sekwencja E4.1-H 62–77 jest zamknięta projektowo, ale operacyjnie pozostaje `PENDING / SAFE HOLD`. Freeze jest aktywny, formalne bramki nie zostały wykonane, a C0/A1/A2/A3 nie są autoryzowane.

Skonsolidowana architektura systemowa V3 istnieje w wersji `0.2 / DESIGN DRAFT`. Przeglądy strukturalny i spójności zakończyły się `PASS`, ale bramka `REVIEWED DESIGN` pozostaje w `HOLD` do zakończenia review dwóch pozostałych pozycji P0.

```text
ADR-V3-004 = ACCEPTED / FINAL
ADR-V3-012 = DESIGN COMPLETE / ARCHITECTURE PASS / PRIVACY-LEGAL REVIEW PENDING
ADR-V3-013 = PROPOSED / ARCHITECTURE PASS / P1 CORRECTIONS APPLIED / DELTA REVIEW PENDING
```

Następny krok to krótki delta review `ADR-V3-013` oraz formalne zatwierdzenie Privacy/Legal dla `ADR-V3-012`. Dopiero po zamknięciu obu pozycji można wykonać finalny `REVIEWED DESIGN GATE`. Implementacja i deployment nie są autoryzowane.
