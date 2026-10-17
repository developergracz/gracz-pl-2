# GRACZ-SEO-01 — Future Session Resume Runbook

Status: `CANONICAL RESUME INSTRUCTIONS`

## 1. Why this file exists

This file is the durable handoff for a future ChatGPT/Codex/Claude/engineer session. It prevents the SEO system from being restarted from memory, partially re-invented or implemented out of order.

## 2. First command to the future reviewer/implementer

Use this intent:

"Resume GRACZ-SEO-01 from the repository documentation. Read the canonical package in order, verify the current repo/main/PR state, determine the first non-closed phase from `09-IMPLEMENTATION-ROADMAP-AND-GATES.md`, and continue only that phase. Do not infer status from old chats."

## 3. Mandatory reading order

1. `README.md`
2. `01-SYSTEM-SPECIFICATION.md`
3. `02-ARCHITECTURE-AND-DATA-MODEL.md`
4. module document for the phase being worked,
5. `08-API-JOBS-AND-INTEGRATION-CONTRACTS.md`
6. `09-IMPLEMENTATION-ROADMAP-AND-GATES.md`
7. `10-TESTING-SECURITY-AND-OPERATIONS.md`
8. `11-ACCEPTANCE-MATRIX.md`
9. `SEO-00-AS-IS-INVENTORY.md` when resuming implementation after the initial discovery phase,
10. this file.

Do not read only the last chat summary.

## 4. Identity lock template

Before work:

`REPO = developergracz/gracz-pl-2`  
`BASE BRANCH = main`  
`CURRENT MAIN SHA = <fresh lookup>`  
`WORK PHASE = SEO-XX`  
`WORK BRANCH = <fresh lookup/create>`  
`STARTING HEAD = <sha>`  
`OPEN PR = <number or NONE>`  
`PRODUCTION ACTION AUTHORIZED = YES/NO`

If any expected SHA/branch differs from a mandate, stop with `SOURCE DRIFT / HOLD`.

## 5. Status reconstruction

Determine from repository evidence:

### Documentation
- package exists?
- latest version/status?
- any later superseding ADR/spec?

### Implementation
- which SEO phases have code?
- which are merged?
- which have open PRs?
- which gates passed?

### Production
- which features are deployed?
- current public robots/sitemap/meta?
- Search Console connection state?
- active jobs/alerts?

Never use `document exists` as proof `feature implemented`.

## 6. Phase selection rule

Choose the first phase in `09-IMPLEMENTATION-ROADMAP-AND-GATES.md` that is not `CLOSED`.

If an earlier phase is partially implemented or has HOLD findings, finish it before starting a later phase.

## 7. Required work item header

Every implementation mandate should include:

- phase ID,
- goal,
- exact repository,
- exact branch/HEAD,
- allowed files/packages,
- forbidden scope,
- acceptance IDs from `11-ACCEPTANCE-MATRIX.md`,
- test commands,
- required evidence,
- merge prohibition unless separately authorized.

## 8. Branch policy

Prefer one branch/PR per controlled phase or tightly related correction series.

Do not mix:
- SEO platform work,
- unrelated game features,
- DB migration work outside approved SEO schema,
- infrastructure changes,
- homepage design experiments.

## 9. Review policy

Default efficient process:

1. implementer self-check,
2. CI,
3. one fresh independent review,
4. correct if needed,
5. re-review corrected HEAD if material,
6. Owner merge decision.

Additional audits only when risk justifies them.

## 10. Documentation update after each phase

Update or add:
- phase implementation record,
- final merged SHA,
- PR number,
- acceptance results,
- audit verdict,
- known limitations,
- next phase.

Do not rewrite old evidence to make history look cleaner.

## 11. Provider setup rule

Before Search Console implementation:
- verify whether a supported connector/API integration exists,
- determine authentication model,
- obtain explicit user action for connection where required,
- never ask the user to paste tokens/secrets into chat or repository.

## 12. Production rollout rule

No production action from design docs alone.

A production mandate must name:
- exact implementation HEAD,
- deploy artifact,
- canary scope,
- prechecks,
- rollback,
- post-deploy smoke,
- Owner authorization.

## 13. SEO safety checklist before any public activation

- no unexpected noindex,
- no global robots block,
- canonical host correct,
- sitemap correct,
- public URLs 200/intentional redirects,
- one intended H1/semantic content where applicable,
- JSON-LD parses,
- social image exists,
- no hidden SEO text,
- no mass generated thin pages,
- rollback ready.

## 14. Search Console interpretation

Remember:
- provider data has delay,
- average position is aggregated,
- data changes do not prove causality,
- low-volume fluctuations are noisy,
- indexed/not-indexed evidence must be timestamped.

## 15. Strategic focus

Prioritize work in this order:

1. deindexing/crawl blockers,
2. broken canonicals/redirects/errors,
3. strategic page discoverability,
4. content/intent mapping,
5. internal links,
6. snippet/CTR opportunities,
7. broader content expansion.

Avoid spending implementation time optimizing tiny metadata warnings while major crawl/indexing defects remain.

## 16. Future extension candidates

Only after core system is stable:
- automated content decay detection,
- log-file SEO analysis if infrastructure permits,
- competitor/topic research connectors,
- experiment framework,
- Bing/Webmaster provider adapter,
- richer page-quality models,
- internationalization expansion.

Each extension requires its own scope review.

## 17. Current canonical resume state

Current canonical state after SEO-00 closure on 2026-09-29:

`GRACZ-SEO-01 DESIGN = DOCUMENTED`  
`SEO-00 DISCOVERY AND BASELINE = CLOSED / PASS`  
`CURRENT IMPLEMENTATION PHASE = SEO-01a DOMAIN FOUNDATION + FILE-BACKED PAGE REGISTRY`  
`SEO-01a CODING AUTHORIZATION = REQUIRES SEPARATE OWNER MANDATE`  
`SEO-01a DATABASE/DDL = FORBIDDEN`  
`SEO-01a maintenance-site/** CHANGES = FORBIDDEN`  
`SEO-01b POSTGRES PERSISTENCE = DEFERRED`  
`SEO-02+ RUNTIME OWNER DECISION = REQUIRED BEFORE START`  
`PRODUCTION DEPLOYMENT = NOT AUTHORIZED BY THIS PACKAGE`  
`SEARCH CONSOLE CONNECTION = NOT ESTABLISHED BY THIS PACKAGE`

Before implementation, read `SEO-00-AS-IS-INVENTORY.md` and refresh all repository/PR identities. Do not infer that the 2026-09-29 production baseline is still current.

## 18. Minimal resume output

Before coding, future session should report:

`IDENTITY LOCK: PASS/HOLD`  
`CURRENT CLOSED PHASE: <phase/NONE>`  
`NEXT PHASE: <SEO-XX>`  
`OPEN BLOCKERS: <list/NONE>`  
`PRODUCTION AUTHORIZATION: YES/NO`  
`PROPOSED WORK BRANCH: <name>`  
`SAFE TO START IMPLEMENTATION: YES/NO`

Only then begin changes.
