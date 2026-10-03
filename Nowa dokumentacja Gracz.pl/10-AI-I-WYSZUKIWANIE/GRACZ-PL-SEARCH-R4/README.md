# GRACZ.PL SEARCH R4 — dokumentacja projektowa

Data: 03.10.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status pakietu: **DESIGN COMPLETE / IMPLEMENTATION NOT STARTED / NOT DEPLOYED**

## Cel pakietu

Ten katalog definiuje pełny projekt SEARCH R4 — hybrydowej wyszukiwarki AI, warstwy RAG oraz osobistego trenera Academy.

SEARCH R4 **nie zastępuje** SEARCH R2 MAX. R2 pozostaje szybkim, lokalnym i niezależnym od providera fundamentem. R4 dodaje inteligencję tylko tam, gdzie klasyczne wyszukiwanie nie wystarcza.

## Dokumenty

1. `01-ARCHITEKTURA-SYSTEMOWA-SEARCH-R4.md` — komponenty, przepływy, granice odpowiedzialności i topologia.
2. `02-AI-ROUTER-RAG-RETRIEVAL-CONTRACT.md` — intent routing, semantic retrieval, hybrid ranking, rerank, confidence gate.
3. `03-KANONICZNE-ZRODLA-CHUNKING-INDEXING.md` — korpus, klasy źródeł, chunking, embedding, wersjonowanie indeksu.
4. `04-PLAYER-CONTEXT-LEARNING-GRAPH-I-MY-TRAINER.md` — personalizacja, Learning Graph, rekomendacje i granice pamięci.
5. `05-API-DATA-MODEL-EVENTS.md` — kontrakty API, model danych, encje i zdarzenia.
6. `06-SECURITY-PRIVACY-SAFETY-THREAT-MODEL.md` — security, privacy, prompt injection, abuse i dane osobowe.
7. `07-OBSERVABILITY-SLO-COST-CONTROLS-RUNBOOK.md` — metryki, SLO, cache, limity kosztów, fallback i operacje.
8. `08-UI-UX-ACCESSIBILITY-SPEC.md` — interfejs trzech trybów i zachowanie desktop/mobile.
9. `09-IMPLEMENTATION-ROADMAP-TESTS-ACCEPTANCE-GATES.md` — fazy wdrożenia, testy, kryteria odbioru i bramki.
10. `10-PROVIDER-ABSTRACTION-AND-COST-MODEL.md` — kontrakt providerów, strategie modeli i neutralny model kosztowy.

ADR nadrzędny:

`09-DECYZJE-ARCHITEKTONICZNE/ADR-V3-014-SEARCH-R4-HYBRID-AI-RAG-PLAYER-ASSISTANT.md`

## Status prawdy

```text
R2 MAX = IMPLEMENTED / LIVE
R4 DESIGN = COMPLETE
R4 IMPLEMENTATION = NOT STARTED
R4 MODEL PROVIDER = NOT SELECTED
R4 SEMANTIC STORE = NOT SELECTED
R4 API KEY = NOT CONFIGURED
R4 PRODUCTION DEPLOYMENT = NOT AUTHORIZED
```

## Zasada wdrożeniowa

Dokumentacja jest gotowym baseline do implementacji. Nie stanowi zgody na zakup usług, konfigurację sekretów, uruchomienie zewnętrznego modelu ani wdrożenie produkcyjne.
