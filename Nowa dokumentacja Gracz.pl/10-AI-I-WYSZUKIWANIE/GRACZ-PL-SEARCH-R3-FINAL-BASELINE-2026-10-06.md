# GRACZ.PL SEARCH R3 — FINAL BASELINE RECORD — 2026-10-06

Status dokumentu: **CURRENT BASELINE RECORD / NOT A FINAL PASS CERTIFICATE**  
Repozytorium: `developergracz/gracz-pl-2`  
Baseline code reference inspected before docs sync: `cb464725c0c6bd04c2e1618aac530aa9289736a5`

## 1. Purpose

Ten dokument zamyka rozbieżność pomiędzy starszymi zapisami dokumentacji SEARCH R3 a aktualnym stanem kodu na `main`.

Nie zmienia kodu wyszukiwarki i nie nadaje automatycznie statusu PASS dla finalnego audytu.

## 2. Current implementation truth

```text
SEARCH R2 FALLBACK CORE = PRESERVED
SEARCH R3 SMART = IMPLEMENTED / LIVE
SEARCH R4 DESIGN = COMPLETE
SEARCH R4 CODE IMPLEMENTATION = NOT STARTED
```

SEARCH R3 działa jako lokalny silnik portalu bez zewnętrznego modelu AI.

Potwierdzone klasy funkcjonalne:

- exact / fuzzy / substring search,
- synonimy, literówki, filtry i komendy @,
- kontekst gry, intent detection, concept matching,
- ranking zależny od intencji i kontekstu,
- deep links i historia lokalna,
- pełna strona wyników i osobne okno wyników,
- zoom wyszukiwarki i wyników,
- responsywne dopasowanie interfejsu,
- lokalny fallback bez zewnętrznego AI.

## 3. Current code/asset baseline

```text
search engine internal version = R3-SMART-2026-10-03
search index internal version = R3-SMART-2026-10-03

/assets/search.css?v=nav-scale-r5
/assets/search-index.js?v=r5
/assets/search.js?v=results-resizer-r3
/assets/legal-links.js?v=r31
```

## 4. R3 security/privacy boundary

Current R3 search does not require generative AI, embeddings API, vector database, RAG, AI API key, Player Context ani My Trainer. Te elementy są zarezerwowane dla SEARCH R4.

## 5. Audit truth

Istniejący dokument `GRACZ-PL-SEARCH-R3-LEAD-AUDIT-R1.md` ma status **HOLD**.

Otwarte obszary z tego audytu obejmowały m.in. pełny wzorzec ARIA combobox, keyboard/ARIA dla menu zoom, browser/device matrix, nagromadzenie override w CSS, zgodność deklarowanej liczby wyników z limitem wyświetlania oraz dalsze hardening/maintainability checks.

Istnieje finalny mandat niezależnego audytu, ale w repo nie ma obecnie odrębnego dokumentu potwierdzającego wykonany finalny audit z werdyktem PASS.

## 6. Freeze gate

Do zapisania formalnego `SEARCH R3 FREEZE = PASS` oraz `READY AS R4 BASELINE = YES` należy posiadać dowód końcowy obejmujący:

1. independent audit,
2. browser/device matrix,
3. accessibility verification,
4. poprawki confirmed blockers/findings,
5. fresh re-audit,
6. Lead final gate.

Do tego czasu:

```text
SEARCH R3 LIVE = YES
SEARCH R3 DOCUMENTATION SYNCED = YES
SEARCH R3 FINAL FREEZE = HOLD
R4.1 IMPLEMENTATION AUTHORIZATION = NONE
```

## 7. R4 boundary

Dokumentacja R4 pozostaje projektem i planem wykonania. W bieżącym baseline R3 nie ma aktywnej implementacji RAG/embeddings/vector store/Player Context/My Trainer.

## 8. Change-control rule

Każda przyszła materialna zmiana SEARCH R3 lub rozpoczęcie R4 powinny aktualizować branch, PR, HEAD SHA, asset chain, audit verdict, merge SHA, deploy evidence i next authorized action.
