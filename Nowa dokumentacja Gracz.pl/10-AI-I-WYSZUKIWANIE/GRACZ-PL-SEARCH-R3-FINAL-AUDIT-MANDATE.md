# GRACZ.PL SEARCH R3 — FINAL INDEPENDENT AUDIT MANDATE

Data: 03.10.2026  
Status: **ACTIVE / STRICT READ-ONLY AUDIT**  
Target: publiczna wyszukiwarka SEARCH R3 SMART  
Repo: `developergracz/gracz-pl-2`

## 1. Cel

Przeprowadzić rygorystyczny, niezależny audyt SEARCH R3 przed uznaniem jej za zamrożony baseline dla SEARCH R4.

Audyt ma potwierdzić nie tylko działanie happy-path, ale także brak regresji, poprawność indeksu, responsywność, dostępność, bezpieczeństwo, prywatność i stabilność na różnych klasach urządzeń.

## 2. Zasada audytu

W fazie audytu:

- **STRICT READ ONLY** dla kodu funkcjonalnego,
- brak merge,
- brak deploymentu zmian funkcjonalnych,
- brak napraw „przy okazji” przed wydaniem pierwszego werdyktu,
- każde znalezione odchylenie zapisujemy jako finding,
- poprawki dopiero po zamknięciu pierwszego niezależnego audytu.

## 3. Role

```text
Owner: Czesław Socha
Lead / Control Tower: ChatGPT
Independent auditor #1: Claude
Optional independent auditor #2: Factory
Implementation corrections: osobny mandat po audycie
```

## 4. Zakres obowiązkowy

### A. Search correctness

- exact match,
- prefix/substring,
- polskie znaki,
- literówki,
- synonimy,
- natural-language questions,
- intent detection,
- game context,
- ranking,
- filtry,
- skróty @,
- scope per game,
- historia,
- deep links,
- full results page,
- standalone results window.

### B. Index integrity

- kompletność pól,
- duplikaty,
- URL safety,
- anchor existence,
- category counts,
- stale URLs,
- broken anchors,
- title/description consistency.

### C. Accessibility

- keyboard-only operation,
- focus management,
- dialog semantics,
- combobox/listbox semantics,
- aria-expanded/aria-controls,
- zoom controls,
- standalone results window,
- focus-visible,
- reduced motion,
- 100–175% search zoom,
- 85–145% results zoom,
- usability for low-vision users.

### D. Responsive/browser matrix

Minimum:

```text
Desktop: 1920x1080, 1600x900, 1366x768, 1280x720
Tablet: 1024x768, 820x1180, 768x1024
Phone: 430x932, 390x844, 360x800
Orientation: portrait + landscape where relevant
Browsers: Chromium/Chrome, Firefox, Safari/WebKit where available
```

Check:

- normal modal,
- maximize,
- 100/115/130/145/160/175%,
- dynamic resize,
- visualViewport / mobile keyboard,
- no right-side clipping,
- footer visibility,
- top navigation overflow,
- dropdowns,
- standalone results dialog.

### E. Security

- no eval,
- no Function constructor,
- no document.write,
- no unsafe remote fetch,
- no javascript:/data: result URLs,
- escaping of title/description/query,
- CSP compatibility,
- no secret exposure,
- no arbitrary HTML from search index.

### F. Privacy

- localStorage only for documented local preferences/history,
- no external AI/query provider in R3,
- no hidden analytics of search queries,
- policy consistency.

### G. Performance

- input latency,
- repeated compute cost,
- resize/orientation handlers,
- no event-listener leaks,
- no excessive layout thrash,
- acceptable rendering of 158-entry index.

### H. Maintainability

- duplicate/overlapping CSS,
- dead selectors,
- append-only override accumulation,
- legacy naming,
- clear separation R2 fallback / R3 smart / future R4.

## 5. Severity

```text
P0 — critical security/privacy/cross-user or arbitrary execution
P1 — high correctness/security/accessibility blocker
P2 — material UX/a11y/responsive/maintainability defect
P3 — minor polish/cleanup
```

## 6. Verdict

Auditor must issue exactly one:

```text
PASS
HOLD
FAIL
```

PASS requires:

- 0 open P0,
- 0 open P1,
- no unresolved material P2 that prevents stable baseline,
- browser/device evidence sufficient,
- index and anchor integrity PASS,
- privacy/security checks PASS.

## 7. Required final report

```text
SEARCH R3 FINAL INDEPENDENT AUDIT

AUDITOR:
DATE:
BASE SHA:
HEAD SHA:
DEPLOY ID:

VERDICT:

P0:
P1:
P2:
P3:

CORRECTNESS:
INDEX:
ACCESSIBILITY:
RESPONSIVE:
SECURITY:
PRIVACY:
PERFORMANCE:
MAINTAINABILITY:

BROWSER MATRIX:
NEGATIVE TESTS:
LIMITATIONS:

REQUIRED FIXES:
READY TO FREEZE: YES/NO
READY AS R4 BASELINE: YES/NO
```
