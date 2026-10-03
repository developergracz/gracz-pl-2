# GRACZ.PL SEARCH R3 — CLAUDE DEEP INDEPENDENT AUDIT MANDATE R1

Data: 03.10.2026
Status: READY / STRICT READ-ONLY / INDEPENDENT REVIEW
Target: SEARCH R3 SMART
Repository: developergracz/gracz-pl-2
Branch: main
Production: https://gracz.pl
Production Render deploy reference: dep-db0culph83ns73cmtnhg
Production site commit reference: 0b34b31ae8d253ca1572be0141471206d2ab33ef

## 0. EXECUTIVE ORDER

You are the independent auditor of GRACZ.PL SEARCH R3. Determine whether SEARCH R3 is safe, correct, accessible, responsive, maintainable and stable enough to be frozen as the production baseline for future SEARCH R4.

HARD RULES:

~~~text
MODE = STRICT READ ONLY
CODE MODIFICATIONS = FORBIDDEN
COMMITS = FORBIDDEN
PR CREATION = FORBIDDEN
MERGE = FORBIDDEN
DEPLOYMENT = FORBIDDEN
RENDER CHANGES = FORBIDDEN
SECRETS / ENV CHANGES = FORBIDDEN
PRODUCTION DATA CHANGES = FORBIDDEN
AUTO-FIX = FORBIDDEN
~~~

Do not fix defects before issuing the first independent verdict. Record defects as findings with evidence and required remediation.

## 1. INDEPENDENCE REQUIREMENT

Do not begin by reading the Lead audit conclusions. First perform your own fresh investigation of the actual code and runtime behavior. Only after creating a PRELIMINARY FINDINGS REGISTER may you compare your findings with:

Nowa dokumentacja Gracz.pl/10-AI-I-WYSZUKIWANIE/GRACZ-PL-SEARCH-R3-LEAD-AUDIT-R1.md

This ordering is mandatory to reduce confirmation bias.

## 2. AUDIT BASELINE LOCK

At audit start record:

~~~text
AUDIT_START_UTC
CURRENT_MAIN_SHA
CURRENT_SEARCH_JS_SHA
CURRENT_SEARCH_CSS_SHA
CURRENT_SEARCH_INDEX_SHA
CURRENT_LEGAL_LINKS_SHA
PRODUCTION_DEPLOY_ID
PRODUCTION_SITE_COMMIT
~~~

Obtain the fresh HEAD yourself. Do not assume the SHA values written in this mandate are still current.

Then verify production/repository equivalence by checking the diff from production site commit 0b34b31ae8d253ca1572be0141471206d2ab33ef to current HEAD under maintenance-site/. If runtime drift exists, report PRODUCTION/REPOSITORY DRIFT = YES and enumerate the files before continuing.

Browser tests must use a fresh reload / disabled cache where possible.

Expected currently published asset chain to verify, not assume:

~~~text
page loader legal-links.js = v=r25
search.css = v=r19
search.js = v=r13
search-index.js = v=r5
SEARCH ENGINE = R3-SMART-2026-10-03
SEARCH INDEX = R3-SMART-2026-10-03
~~~

## 3. PRIMARY FILES

Inspect at minimum:

~~~text
maintenance-site/assets/search.js
maintenance-site/assets/search.css
maintenance-site/assets/search-index.js
maintenance-site/assets/legal-links.js
maintenance-site/szukaj/index.html
maintenance-site/wyszukiwarka/index.html
maintenance-site/polityka-prywatnosci/index.html
maintenance-site/index.html
maintenance-site/gry/index.html
maintenance-site/gry-karciane/index.html
maintenance-site/poradniki/index.html
maintenance-site/o-gracz-pl/index.html
maintenance-site/regulamin/index.html
maintenance-site/gry/poker-treningowy/index.html
maintenance-site/gry/poker-treningowy/zasady/index.html
maintenance-site/gry/tysiac/index.html
maintenance-site/gry/tysiac/zasady/index.html
maintenance-site/gry/warcaby/index.html
maintenance-site/gry/warcaby/zasady/index.html
maintenance-site/gry/gomoku/index.html
maintenance-site/gry/gomoku/zasady/index.html
~~~

Also inspect every directly referenced asset needed to validate the search.

## 4. SEARCH CORRECTNESS

Audit exact match, prefix, substring, Polish diacritics, accent-insensitive matching, fuzzy matching, typo correction, synonyms, natural-language detection, game detection, intent detection, concept detection, ranking, tie-breaking, filters, category counts, game scope, @ commands, deep links, URL query state, recent history, clear history, copy link, keyboard result selection, Enter behavior, no-results state, correction suggestions, smart best-source card, standalone results window and full results page.

Mandatory query matrix:

~~~text
poker
Poker Academy
pokr
texas holdem
pot odds
co to jest pot odds?
jakie są układy w pokerze?

tysiąc
1000
tysioc
jak działa meldunek w tysiącu?
jak licytować w tysiącu?
musik

warcaby
warcby
czy bicie w warcabach jest obowiązkowe?
wielokrotne bicie
damka

gomoku
gomku
jak wygrać w gomoku?
pięć w linii
legalny ruch

RODO
polityka prywatności
cookies
regulamin
konto
logowanie

@poker
@zasady
@academy
@rodo
@poker zasady
~~~

For each query record QUERY / TOP-1 / TOP-3 / EXPECTED DOMAIN OR SECTION / PASS-FAIL / COMMENT. Do not mark ranking PASS merely because a relevant item appears somewhere in the result list.

## 5. INDEX INTEGRITY

Programmatically validate the entire current index, not samples:

~~~text
INDEX VERSION
TOTAL ENTRY COUNT
REQUIRED FIELD COMPLETENESS
DUPLICATE FULL URL COUNT
DUPLICATE TITLE COUNT
CATEGORY DISTRIBUTION
UNKNOWN CATEGORY COUNT
UNSAFE URL COUNT
EXTERNAL URL COUNT
BROKEN BASE PATH COUNT
BROKEN ANCHOR COUNT
EMPTY TITLE COUNT
EMPTY DESCRIPTION COUNT
EMPTY KEYWORDS COUNT
INVALID GAME ID COUNT
~~~

Every indexed anchor must exist in the current HTML. Every local base URL must map to an actual route/file. Previously observed size was 158 entries; verify independently.

## 6. SECURITY

Confirm absence or justified use of eval, Function constructor, document.write, javascript URLs, data URLs, protocol-relative result URLs, external query fetch, WebSocket, unsafe postMessage and query-influenced dynamic script URLs.

Run DOM injection/XSS probes:

~~~text
<img src=x onerror=alert(1)>
"><svg/onload=alert(1)>
<script>alert(1)</script>
javascript:alert(1)
& < > " '
~~~

Check results, corrections, history, chips, smart card, standalone results window, full results page and URL query rendering. Expected: inert text only, no executable markup.

Verify result navigation cannot escape the trusted local corpus. Check CSP compatibility and confirm there are no exposed API keys, tokens or credentials.

## 7. PRIVACY

Verify actual behavior against the current privacy policy. List every SEARCH R3 localStorage key and content type. Audit recent search history, main zoom, standalone results zoom, absence of external AI/search provider calls, absence of undeclared query analytics/logging, history clearing and policy consistency.

## 8. ACCESSIBILITY — WCAG ORIENTED

Keyboard-only test must cover: open, close, initial focus, typing, ArrowUp/ArrowDown, Enter, filters, scope, clear query, clear history, zoom selector, all zoom levels, A-/A+, maximize/restore, standalone results window, results zoom, close results window and top portal navigation.

Audit focus trap, Escape, return focus, nested dialog behavior, hidden focus, resize/orientation focus stability.

ARIA/semantics review must cover dialog labelling, input combobox/listbox model, aria-controls, aria-activedescendant, aria-expanded, aria-haspopup, option semantics, zoom menu semantics, menuitemradio state, live result count, hidden state, disabled state and duplicate IDs.

Low-vision test the application zoom levels 100, 115, 130, 145, 160, 175 percent and standalone result levels 85, 100, 115, 130, 145 percent.

Also test browser zoom 100, 125, 150 and 200 percent. Do not substitute application zoom for browser zoom.

## 9. RESPONSIVE / DEVICE / BROWSER MATRIX

Use real browser automation if available.

Minimum viewport matrix:

~~~text
Desktop: 1920x1080, 1600x900, 1440x900, 1366x768, 1280x720
Tablet: 1180x820, 1024x768, 820x1180, 768x1024
Phone: 430x932, 412x915, 390x844, 375x812, 360x800
~~~

Test landscape where meaningful. Browsers where available: Chromium/Chrome, Firefox, WebKit/Safari.

For each relevant viewport test normal modal, maximize, restore, 100 percent, 175 percent, zoom menu, top navigation, long and empty history, natural-language smart card, scrolling, standalone results window, max result zoom, footer, dynamic resize, orientation change and mobile virtual keyboard where supported.

Explicitly inspect: right clipping, left clipping, horizontal overflow, off-screen buttons, cut tooltips/dropdowns, hidden footer, overlay collisions, unreachable controls, text overlap, truncated navigation, scrollbar collision and dialog larger than visual viewport.

If browser execution is unavailable, do not infer PASS from CSS. Report BROWSER MATRIX = HOLD / NOT EXECUTED.

## 10. ADAPTIVE VIEWPORT MODULE

Audit visualViewport fallback, resize handling, orientation handling, requestAnimationFrame throttling, device bucket transitions, CSS-variable refresh, right-side overflow after maximize, behavior when browser sidebars/devtools reduce the viewport, address-bar/mobile viewport changes, browser zoom interaction and nested results dialog adaptation.

Check runtime state:

~~~text
data-search-device
data-search-height
data-search-orientation
--search-vw
--search-vh
--search-gutter
~~~

Confirm values change correctly when viewport size/orientation changes.

## 11. PERFORMANCE

Measure or substantiate first-open cost, index initialization, keystroke-to-render latency, repeated compute cost, category recount, typo-distance cost, 158-entry scaling, DOM replacement frequency, large query behavior, history rendering, resize handler frequency and memory/listener growth.

If automation allows, stress:

~~~text
open-close x100
resize x100
query changes x200
zoom changes x100
standalone results open-close x100
~~~

Check duplicate listeners, duplicate dialogs, duplicate styles/scripts, memory growth and stale focus references.

## 12. MAINTAINABILITY

Review function size, duplicated logic, state ownership, DOM-query duplication, naming, legacy R2 names, dead code, dead selectors, conflicting CSS, specificity escalation, repeated !important and responsive override layering.

Assess whether search.css requires a consolidation-only hardening PR before freeze. Do not perform it during audit.

## 13. REGRESSION

Verify SEARCH R3 does not break page scroll, existing page navigation, contact modal, privacy/legal links, game anchors, page top navigation, mobile menus, search button on all public pages, Ctrl/Cmd+K, slash shortcut where implemented, direct /szukaj/ and direct /wyszukiwarka/.

Audit loader race: legal-links.js -> search-index.js -> search.js. Confirm rapid clicking cannot fall back to stale placeholder behavior.

## 14. STANDALONE RESULTS WINDOW

Audit result count accuracy, actual rows rendered, cap/pagination behavior, focus, Escape, close, zoom, zoom persistence, scroll, adaptive viewport, keyboard activation, nested-dialog behavior and return focus.

Explicitly verify:

~~~text
DISPLAYED RESULTS COUNT == LABELLED RESULTS COUNT
~~~

If false, record a correctness/UX finding.

## 15. NEGATIVE TESTS

Mandatory:

~~~text
empty query
1-character query
very long query >= 500 chars
only punctuation
only emoji
only @
unknown @command
mixed valid and invalid commands
HTML payload
script payload
very long localStorage history value
corrupted recent-history JSON
invalid zoom localStorage value
invalid results-zoom localStorage value
rapid repeated open
rapid Escape
rapid maximize/restore
resize while maximized
rotate while maximized
~~~

No uncaught exception is acceptable as PASS.

## 16. LEAD FINDINGS CROSS-CHECK — ONLY AFTER PRELIMINARY AUDIT

After finishing independent preliminary findings, read GRACZ-PL-SEARCH-R3-LEAD-AUDIT-R1.md and classify each Lead finding as CONFIRMED / NOT CONFIRMED / SEVERITY CHANGED / SUPERSEDED. Do not copy Lead severity without your own evidence.

## 17. SEVERITY

~~~text
P0 — critical: exploitable XSS/RCE, secret leak, major privacy leak, cross-user exposure, arbitrary privileged action
P1 — high: material security defect, broken core correctness, critical accessibility blocker, systemic browser failure, production-breaking responsive failure
P2 — medium: material UX/accessibility/responsive defect, misleading result behavior, important maintainability/performance risk
P3 — low: polish, low-risk hardening, naming, minor semantics/maintainability
~~~

Every finding requires evidence.

## 18. REQUIRED FINDING FORMAT

~~~text
ID:
SEVERITY:
AREA:
FILE:
LINES:
RUNTIME/VIEWPORT:
REQUIREMENT:
OBSERVATION:
EVIDENCE:
USER IMPACT:
SECURITY/PRIVACY IMPACT:
REPRODUCTION:
REQUIRED FIX:
RETEST REQUIREMENT:
~~~

No vague findings such as 'could be improved'.

## 19. FINAL VERDICT

Issue exactly one: PASS / HOLD / FAIL.

PASS only when:

~~~text
P0 OPEN = 0
P1 OPEN = 0
MATERIAL BLOCKING P2 = 0
INDEX INTEGRITY = PASS
ANCHOR INTEGRITY = PASS
CORRECTNESS MATRIX = PASS
SECURITY = PASS
PRIVACY = PASS
ACCESSIBILITY = PASS
BROWSER MATRIX = PASS
RESPONSIVE = PASS
REGRESSION = PASS
~~~

Use HOLD when evidence is incomplete, browser/a11y matrix cannot be executed, or correctable material findings remain. Use FAIL for substantial architectural/security/correctness failure. Do not issue PASS WITH CONDITIONS.

## 20. REQUIRED FINAL OUTPUT

~~~text
GRACZ.PL SEARCH R3 — CLAUDE FINAL INDEPENDENT AUDIT

AUDITOR:
AUDIT DATE/TIME:
AUDIT MODE: STRICT READ ONLY

CURRENT MAIN SHA:
PRODUCTION DEPLOY:
PRODUCTION SITE COMMIT:
PRODUCTION/REPOSITORY DRIFT:

FINAL VERDICT: PASS / HOLD / FAIL

P0 COUNT:
P1 COUNT:
P2 COUNT:
P3 COUNT:

1. EXECUTIVE SUMMARY
2. BASELINE AND PROVENANCE
3. SEARCH CORRECTNESS — matrix and failures
4. INDEX INTEGRITY
5. SECURITY
6. PRIVACY
7. ACCESSIBILITY
8. RESPONSIVE / DEVICE / BROWSER MATRIX
9. ADAPTIVE VIEWPORT MODULE
10. PERFORMANCE
11. MAINTAINABILITY
12. REGRESSION
13. STANDALONE RESULTS WINDOW
14. NEGATIVE TESTS
15. FINDINGS REGISTER
16. LEAD-FINDING CROSS-CHECK
17. LIMITATIONS / TESTS NOT EXECUTED
18. REQUIRED CORRECTIONS
19. RETEST PLAN
20. FREEZE DECISION

READY TO FREEZE SEARCH R3: YES / NO
READY AS SEARCH R4 BASELINE: YES / NO
CODE CHANGED: NO
COMMITS CREATED: NO
PR CREATED: NO
DEPLOYMENT: NO
RENDER: UNCHANGED
SECRETS: UNCHANGED
~~~

## 21. STOP CONDITIONS

Stop and immediately report active secret exposure, exploitable XSS, RCE path, malicious redirect path, production/repository mismatch invalidating the audit, or inability to identify the deployed search version. Do not fix it.

## 22. AUTHORIZATION BOUNDARY

This mandate authorizes inspection and testing only. It does not authorize implementation, refactoring, cleanup, correction commits, PR creation, merge, deployment, provider selection or R4 work.

The first deliverable is the independent audit report. Only after Owner and Lead review may a separate correction mandate be issued.