# 13 — SEARCH R4 Independent Audit Protocol

Data: 03.10.2026  
Status: **AUDIT CONTRACT / READY**  
Primary auditor: **Claude**  
Final gate review: **ChatGPT**  
Optional escalation: **Factory**

## 1. Zasada niezależności

Audytor:

- nie bazuje na samoocenie Codexa,
- czyta faktyczny diff i pliki,
- uruchamia lub analizuje testy,
- szuka braków spoza happy path,
- nie poprawia kodu przed wydaniem pierwszego werdyktu.

Pierwszy wynik ma być niezależny.

## 2. Input do audytu etapu

Audytor otrzymuje:

- mandat etapu,
- ADR-V3-014,
- PR URL/numer,
- base SHA,
- head SHA,
- evidence pack wykonawcy.

## 3. Mandatory audit dimensions

Każdy etap:

### A. Scope compliance

- czy zaimplementowano wszystko z mandatu,
- czy nie dodano elementów spoza zakresu.

### B. Architecture compliance

- zgodność z R2-first,
- provider abstraction,
- canonical source model,
- fallback model.

### C. Correctness

- deterministyczność,
- edge cases,
- błędy wejścia,
- stan po awarii.

### D. Security

- secrets,
- path traversal,
- injection,
- unsafe parsing,
- cross-user isolation, gdy dotyczy,
- arbitrary actions, gdy dotyczy.

### E. Privacy

- minimalizacja,
- brak niejawnego logowania promptów,
- brak PII w publicznym korpusie,
- provider boundary, gdy dotyczy.

### F. Quality

- test coverage,
- maintainability,
- czytelność kontraktów,
- brak dead code.

### G. Operations

- fallback,
- metrics,
- rollback,
- budget, gdy dotyczy.

## 4. R4.1 specific audit

Dla Corpus Foundation audytor obowiązkowo sprawdza:

- allowlistę źródeł,
- canonical priority,
- deterministic chunk IDs,
- hash/version,
- lineage,
- anchor correctness,
- sanitization,
- duplicate handling,
- disallowed source rejection,
- secret exclusion,
- brak semantic/generative scope creep,
- brak regresji R2.

## 5. Werdykt

Dozwolony tylko jeden:

```text
PASS
HOLD
FAIL
```

Nie używać „PASS z zastrzeżeniami” dla otwartego P1. Jeśli P1 jest otwarte → HOLD albo FAIL zależnie od charakteru.

## 6. Findings format

```text
ID:
SEVERITY: P0/P1/P2/P3
FILE:
LINES:
REQUIREMENT:
OBSERVATION:
RISK:
REPRODUCTION:
REQUIRED FIX:
```

## 7. PASS criteria

PASS wymaga:

- brak P0/P1,
- wszystkie mandatory requirements spełnione,
- evidence wystarczające,
- negatywne testy obecne,
- scope nie został rozszerzony bez decyzji.

## 8. Re-audit

Po poprawkach:

- audytor sprawdza świeży HEAD,
- nie zakłada, że poprawiono tylko wskazane linie,
- sprawdza regresję,
- wydaje nowy werdykt.

## 9. Final Lead review

Po Claude PASS Lead sprawdza:

- czy auditor review pokrył mandat,
- czy wszystkie findingi są zamknięte,
- czy status dokumentacji jest aktualny,
- czy merge jest bezpieczny architektonicznie.

Dopiero wtedy możliwa rekomendacja do Owner merge authorization.

## 10. Full SEARCH R4 Final Audit

Po R4.9 finalny audyt obejmuje cały system razem:

- R2 regression,
- semantic retrieval,
- intent routing,
- RAG grounding,
- citations,
- hallucination resistance,
- prompt injection,
- canonical conflicts,
- provider failure,
- budget failure,
- cache isolation,
- Player Context isolation,
- Learning Graph correctness,
- My Trainer explainability,
- load/performance,
- accessibility,
- privacy,
- rollback,
- observability.

## 11. Audit provenance

Każdy audit record zapisuje:

```text
AUDITOR
DATE
MANDATE VERSION
BASE SHA
HEAD SHA
PR
VERDICT
P0 COUNT
P1 COUNT
P2 COUNT
P3 COUNT
TESTS REVIEWED
LIMITATIONS
```

## 12. No self-approval

- Codex nie nadaje sobie finalnego PASS.
- Claude nie merge'uje.
- Lead nie zastępuje niezależnego audytu.
- Owner decyduje o merge/deployment.
