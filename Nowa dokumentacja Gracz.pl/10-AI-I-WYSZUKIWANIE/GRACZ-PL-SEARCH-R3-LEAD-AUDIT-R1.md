# SEARCH R3 — LEAD BASELINE AUDIT R1

Data: 03.10.2026  
Auditor: **ChatGPT / Lead baseline review**  
Mode: **STRICT READ ONLY**  
Status: **HOLD — independent browser/a11y audit and corrections still required**

## 1. Baseline inspected

Primary files:

- `maintenance-site/assets/search.js`
- `maintenance-site/assets/search.css`
- `maintenance-site/assets/search-index.js`
- `maintenance-site/assets/legal-links.js`
- `maintenance-site/szukaj/index.html`
- `maintenance-site/wyszukiwarka/index.html`
- `maintenance-site/polityka-prywatnosci/index.html`

Latest observed production deployment during baseline review:

`dep-db0culph83ns73cmtnhg` — LIVE.

## 2. Verified evidence

### Index integrity — PASS

Programmatic inspection of `search-index.js`:

```text
INDEX VERSION = R3-SMART-2026-10-03
TOTAL ENTRIES = 158
DUPLICATE URLS = 0
MISSING REQUIRED FIELDS = 0
UNSAFE / EXTERNAL RESULT URLS = 0
```

Category distribution:

```text
informacje = 49
gry = 2
poradniki = 26
academy = 34
zasady = 47
TOTAL = 158
```

### Source/anchor integrity — PASS

Indexed anchors were checked against current HTML IDs for:

- Poradniki,
- Regulamin,
- Polityka prywatności,
- Poker Academy,
- Poker rules,
- Tysiąc Academy,
- Tysiąc rules,
- Warcaby Academy,
- Warcaby rules,
- Gomoku Academy,
- Gomoku rules.

Observed missing indexed anchors: **0**.

### URL boundary — PASS

All 158 current result URLs are relative same-site paths.

Observed:

```text
javascript: = 0
data: = 0
external http/https result URLs = 0
protocol-relative // URLs = 0
```

### Static security scan — PASS with hardening notes

For current search engine/index/loader:

```text
eval() = not present
new Function() = not present
document.write() = not present
external fetch() in search path = not present
WebSocket = not present
```

Search rendering uses `innerHTML`, but the current result/query fields are escaped before insertion in the inspected result/suggestion paths.

### Privacy alignment — PASS

Current privacy policy documents:

- local search history,
- search UI zoom preference,
- standalone-results zoom preference,
- localStorage usage,
- no external search/AI provider for current R3 search queries.

## 3. Open findings

### R3-AUD-001 — P2 — incomplete ARIA combobox pattern

The search input uses:

- `aria-autocomplete="list"`,
- `aria-controls`,
- `aria-activedescendant` during keyboard navigation,

but does not currently implement the complete combobox pattern, including a clear `role="combobox"` and dynamic expanded-state semantics.

**Risk:** reduced screen-reader predictability.

**Required:** independent accessibility audit and correction.

### R3-AUD-002 — P2 — zoom selector menu keyboard/ARIA state

The zoom-level selector uses `aria-haspopup`, `role="menu"` and radio-like items, but there is no explicit dynamic `aria-expanded` state and no dedicated arrow-key menu navigation model.

**Risk:** keyboard/screen-reader interaction is less complete than the visual interaction.

### R3-AUD-003 — P2 — responsive CSS override accumulation

`search.css` has grown through multiple successive hardening/layout layers. Multiple selectors intentionally override earlier viewport/fullscreen/mobile rules.

**Risk:** future regressions and difficult browser-specific diagnosis.

**Required before final freeze:** browser matrix evidence; afterwards consider one consolidation/hardening PR without visual redesign.

### R3-AUD-004 — P2 — standalone results count vs displayed cap

The standalone results window reports the total result count but currently slices display rows to `PAGE_LIMIT = 60`.

Example conceptual state:

```text
count label = 158 results
visible rows = first 60
```

**Risk:** user may interpret the separate window as containing all returned results.

**Required:** either render all intended results, paginate/load more, or clearly state “showing first 60 of N”.

### R3-AUD-005 — P3 — result URL defense-in-depth

Current search index contains only safe relative URLs, which passes current data audit. The result renderer trusts the repository-owned index after HTML escaping but does not independently enforce a same-origin URL scheme at render time.

**Risk:** low under current trusted static-index model; future hardening opportunity.

### R3-AUD-006 — P3 — legacy storage naming

History key remains named `graczSearchRecentR2` although public baseline is R3.

No functional defect observed; cleanup/documentation issue.

### R3-AUD-007 — P3 — navigation active state

The embedded search navigation currently highlights `Start` regardless of the page from which the search modal was opened.

**Risk:** minor orientation inconsistency.

## 4. Current gate

```text
INDEX INTEGRITY = PASS
ANCHOR INTEGRITY = PASS
STATIC URL SAFETY = PASS
NO EXTERNAL AI QUERY PATH = PASS
PRIVACY DOCUMENTATION = PASS
STATIC SECURITY BASELINE = PASS

ACCESSIBILITY FINAL = NOT YET PASS
BROWSER MATRIX = NOT YET PASS
INDEPENDENT AUDIT = NOT YET DONE
CSS CONSOLIDATION REVIEW = REQUIRED
```

## 5. Current verdict

**HOLD**

This is not a failure of SEARCH R3. It means the feature set is mature enough to stop adding functions, but a rigorous final freeze requires:

1. independent Claude audit,
2. browser/device matrix,
3. correction PR for confirmed findings,
4. fresh re-audit,
5. final Lead gate,
6. only then SEARCH R3 FREEZE / R4 BASELINE PASS.
