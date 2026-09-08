# GRACZ.PL — FULL MAX EVIDENCE REGISTER

**Status:** LIVING / APPEND-ONLY PRINCIPLE  
**Purpose:** centralny indeks dowodów technicznych i decyzyjnych.

## 1. Zasada

Żaden ważny status (`PASS`, `CLOSED`, `MERGED`, `READY`, `NO-GO`, `DEPLOYED`) nie powinien istnieć bez przypisanego dowodu.

Każdy wpis powinien wskazywać w miarę możliwości:

- obszar,
- typ dowodu,
- PR,
- branch,
- commit SHA,
- TREE SHA,
- workflow/run,
- wynik,
- audytora/reviewer,
- zakres,
- ograniczenia.

## 2. Zweryfikowane dowody główne

### EVID-HIST-P1-001 — historical technical P1 backfill

- source document: `00-FULL-MAX-MASTER/17-HISTORICAL-EVIDENCE-BACKFILL-P1.md`
- status: `BACKFILL COMPLETE FOR REPOSITORY-AVAILABLE EVIDENCE`
- scope: PR `#29`, `#30`, `#36`, `#37`, `#38`, `#39`
- exact final HEAD/TREE: `RECORDED`
- exact merge commit/TREE: `RECORDED`
- exact-head PR-triggered workflow runs: `RECORDED`
- audit provenance quality: `CLASSIFIED PER PR`
- production deployment evidence: `NONE CLAIMED`

Canonical reconstructed records:

| PR | Work item | Final HEAD | Final TREE | Merge | Exact-head CI | Audit provenance |
|---:|---|---|---|---|---|---|
| #29 | P1-C-01 / P1-AUD3-02 | `f2167bf3bcab0247ae6e865a67c9afbf93f55efc` | `b08662e95962539bdd5bbb1dc7458e9d6f6b77a2` | `c81b7819b5a9e994b1bdc04a304288fca030fdcd` | runs `33880837982`, `33880837696`, `33880837643` = SUCCESS | reconstructed/partial; final commit references Claude startup conditions, final review report not retained in PR timeline |
| #30 | P1-H-01 | `08419e823cb771d22862a9e14d99a87bc75adcfb` | `83ea72156d4946a41a42c95e5bbde374506c76cf` | `2445434c85ac838a88747906dfce77f78764b901` | runs `33885568448`, `33885568583`, `33885568596`, `33885568581` = SUCCESS | audit artifact gap in GitHub PR timeline |
| #36 | P1-AUD3-03 | `bbb48464f164a9c0687a65e5b660f447e069c189` | `43ead9cc3c54023c18d27236f1f41c21a81b22ee` | `05989fa219cc92a299a3f3a193f3dfda5762bbca` | runs `33909692336`, `33909692327`, `33909692352` = SUCCESS | direct-partial; PR body records independently audited earlier head + corrective finding |
| #37 | P1-AUD3-04 | `5d155fd058343355346fbb2b6637881ca3b73b66` | `2e7ad8c027ece18ffe1da175221274a1ee6a4255` | `d002027114a7ef28ec02436e39798b70267e8502` | runs `33944042420`, `33944042417`, `33944042416` = SUCCESS | direct-partial; merge records audited commit history; final commit closes audit conditions |
| #38 | P1-AUD3-07 / P5 | `6e49cde56cf7e9ef4c1b74ca3fe0735485a91103` | `d1b0a05480e098a576cba518f1a11c5f2ad0d943` | `8d520a5c2fea80b458e0adcf59468c9d6921c985` | runs `33952985186`, `33952985175`, `33952985147`, `33952985162` = SUCCESS | reconstructed; strong CI/final evidence, independent report not retained in PR timeline |
| #39 | P1-AUD3-01 / P6 | `c4669ea81bc2d0404f95d75a17a793a065ed725a` | `3b6dbca54ff33e06691ecbe002bdc96f0215f151` | `c5c34aabe4fcd04b087e25161778798146030c9b` | runs `33962992679`, `33962992739`, `33962992733`, `33962992668`, `33962992847` = SUCCESS | DIRECT — merge records Owner-authorized merge after Lead PASS and independent Claude audit |

Historical work-item closure remains preserved. Audit provenance gaps do not imply that an audit did not occur; they mean the final report is not directly retained in the current GitHub PR timeline and must not be invented.

### EVID-P7-001 — P7 / P1-U-02 closure

- status: `CLOSED`
- PR: `#40`
- final implementation HEAD: `5b70c2d95fc937f0b516b7fafbce22bb8f59f432`
- final TREE: `81da9ee04a15fea2ea329d9e19e61cf9f6b438e6`
- merge commit: `f88070b0f1d13a3ef353a46714f456c452876872`
- reviews: Lead PASS / ChatGPT-2 independent PASS / Claude final PASS
- production deployment: `NO`
- production migration: `NO`

### EVID-DR-001 — P1-R-01 recurring PostgreSQL DR

- status: `CLOSED`
- final branch: `fix/p1-r-01-recurring-dr-restore-resync`
- final HEAD: `535eaac04522c53f1ee8506881a70461cfabc22a`
- final TREE: `6f3b73c0525b1157d764a358127af8afa32c4d41`
- PR: `#41`
- merge commit: `b276c92342203eb6c2e591b30219219b8ab7cf10`
- final CI run: `34053197756`
- CI: `PASS`
- real isolated PostgreSQL DR: `PASS`
- gitleaks: `PASS`
- CodeQL: `PASS`
- production restore: `NO`
- production migration: `NO`

Historical PR `#35` is reference only and is not the final P1-R-01 implementation.

### EVID-DOC-001 — post P7/DR documentation checkpoint

- docs commit: `43a9dd7ff111b46107af1e7f6ebdb056c345ebb7`
- docs TREE: `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`
- PR: `#42`
- merged main commit: `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`
- purpose: record P7 and P1-R-01 closure; establish P8 as next controlled phase.

### EVID-P8-001 — P8 / P1-U-01 implementation head

- branch: `fix/p1-u-01-canonical-game-types-p8`
- authorized base main: `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`
- final HEAD: `d7220f57d60779584048cc5c695d40dbb948b9cb`
- final TREE: `4cbb8504036d26ed2e257f52a475968f5d4cd827`
- PR: `#43`
- PR state at checkpoint: `OPEN / NOT MERGED`
- Lead review: `PASS`
- independent Claude audit: `PENDING`
- merge authorization: `NO`

### EVID-P8-CI-001 — P8 exact-head push CI

- workflow run: `34147638975`
- exact HEAD: `d7220f57d60779584048cc5c695d40dbb948b9cb`
- result: `SUCCESS`
- P8 focused contract: `8/8 PASS`
- Checkers focused regression: `26/26 PASS`
- Gomoku focused: `24/24 PASS`
- Thousand focused: `20/20 PASS`
- tournament concurrency: `2/2 PASS`
- P5 readiness: `14/14 PASS`
- P6: `23/23 PASS`
- P7: `19/19 PASS`
- full Node suite: `229/229 PASS`
- npm audit: `0 vulnerabilities`
- browser Checkers journey: `PASS`
- browser Gomoku journey: `PASS`
- isolated real PostgreSQL DR regression: `PASS`
- gitleaks: `PASS`
- CodeQL: `PASS`

### EVID-P8-CI-002 — PR-triggered checks

Exact PR #43 HEAD checks recorded as successful:

- `Greetings` run `34148547705`
- `Security Gate` run `34148547720`
- `P1-H-01 Tournament Concurrency` run `34148547738`
- `CheckersEngine` run `34148547736`
- `P1-U-01 Canonical Game Types P8` run `34148547703`

## 3. FairPlay MAX evidence state

### EVID-GFPE-001 — GFPE-0 / GFPE-1 pre-design

- date: `08.09.2026`
- type: architecture pre-design
- status: `PRE-DESIGN COMPLETE / NOT FROZEN`
- implementation: `NOT AUTHORIZED`
- file: `04-FAIRPLAY-MAX/00-GFPE-0-GFPE-1-PRE-DESIGN-WYMAGANIA-I-THREAT-MODEL.md`
- independent crypto audit: `NOT YET EXECUTED`
- Gemini statistical review: `NOT YET EXECUTED`
- production use: `NO`

## 4. Evidence classes

- `EVID-GIT-*` — commit/tree/branch evidence
- `EVID-PR-*` — pull request evidence
- `EVID-CI-*` — automated CI evidence
- `EVID-DB-*` — PostgreSQL/restore evidence
- `EVID-SEC-*` — security evidence
- `EVID-AUD-*` — independent review/audit evidence
- `EVID-OPS-*` — production/operations evidence
- `EVID-GFPE-*` — FairPlay MAX evidence

Historical evidence-quality qualifiers may additionally use `DIRECT`, `DIRECT-PARTIAL`, `RECONSTRUCTED`, and `GAP` as defined in TOM 17.

## 5. Open evidence gaps

At 08.09.2026:

1. P8 lacks final independent Claude audit evidence.
2. P8 lacks Owner + Lead final merge authorization.
3. Full-project audit after P8 has not started.
4. FairPlay MAX protocol has no frozen cryptographic specification yet.
5. FairPlay MAX has no implementation/test/audit evidence yet.
6. Production V3 remains outside this evidence set as a completed deployment.
7. Historical independent-audit reports are not uniformly preserved in GitHub PR timelines; TOM 17 classifies the exact provenance quality, with the most material repository artifact gaps currently documented for PR #30 and PR #38.

These gaps are intentional and must not be represented as PASS beyond the scope supported by preserved evidence.
