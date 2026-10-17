# Newsletter F-02 — komunikat konserwacyjny i wycofanie zgody (R1)
Mode: **DRAFT / NO DEPLOY / NO MERGE**. Base: `b6e4a9bc3e3d0d1952ede20130146e7fc5501cd7`.

The current production API is intentionally inert. This change makes the public forms fail-closed by a hardcoded `NEWSLETTER_PUBLIC_INTAKE_ENABLED=false` flag (both the shared footer controller and dedicated newsletter page). It is intentionally **not** an automatic readiness probe: browser access to the maintenance `/health` endpoint cannot authorize public intake. The ordinary `/newsletter/ready` endpoint may be inaccessible cross-origin and is not a release switch.

The dedicated newsletter page visibly explains maintenance and provides the existing published contact mailbox for a **manually handled** consent withdrawal request. It does not invent an unsubscribe endpoint or claim that a sent message has already withdrawn consent. A trained operator must authenticate the requester appropriately, verify the existing subscriber record and record/process revocation through the approved private channel. During maintenance there is no automatic consent withdrawal; this is a known P1 service interruption requiring an owner-approved operational resolution, not a compliance PASS.

Link actions (confirm/unsubscribe/status) are disabled during maintenance without submitting any tokens. Users should retain the original email and not share bearer links. Future activation requires a **separate owner-approved change**, coordinated API readiness, validated database cutover, and a new cache-busting asset version on every footer-bearing page. Until that GO, keeping this gate false is intentional.

Local offline check: `node --test scripts/test-newsletter-maintenance-notice.mjs`.
No credentials, test emails, PostgreSQL writes or production mutation are needed.

## R2 operational gate — HOLD until evidenced

The published mailbox is a contact option, **not verified withdrawal service**.
No mailbox ownership/monitoring attestation or independent Claude audit was
available in this review. Do not label P1 consent handling PASS from UI tests.

Before any activation, the Owner must identify the primary and backup operator,
prove mailbox access and monitoring, agree response/escalation times, and rehearse
with synthetic requests. Receipt must use neutral wording: no subscriber lookup
result, confirmation token, bearer link or promised completed withdrawal.
A matching From address alone is not authentication. Use the approved private
identity verification procedure without requesting passwords or bearer links.

When the API or DB is unavailable, keep a restricted, access-controlled intake
record with receipt time, request reference, verification status and assigned
operator. Keep sending and public intake paused. Do not claim the subscriber
record has changed. Escalate overdue/unverifiable requests to the Owner; avoid
unnecessary PII in logs, public issues and audit reports. After availability is
restored, an authorized operator must process the verified withdrawal through an
approved private procedure preserving consent history and suppression, record
its durable event/reference, and then notify the requester. A second reviewer
must reconcile the entire backlog before any send/intake release. No such
execution is authorized by this document or by this remediation session.

## Separate future activation

1. Independent audit of the exact frontend/backend SHA and current collision map.
2. Evidence of API/schema readiness and all F-03 gates; health alone is insufficient.
3. Operational withdrawal rehearsal and verified reconciliation of the backlog.
4. Independent Owner GO explicitly covering activation and rollback.
5. A separate reviewed activation change; both public flags remain false here.
   Version every shared JS reference together and purge/verify the published
   artifact caches. Test enabled and maintenance flows against isolated mocks.
6. Separately authorized rollout with business intake paused until coordinated
   release. On uncertainty, restore maintenance; never clear reservations.

R2 preflight: main b6e4a9bc3e3d0d1952ede20130146e7fc5501cd7;
PR #266 started at 91f3c50665473e4a7a04de1fe7f5b01a274f7dd0.
No AGENTS.md or CODEOWNERS found in this checkout. Governance A1 is explicitly
proposed, not binding. Open #250/#253 overlap footer CSS/JS; current main's
validation and layout are preserved. #255 (inert API), #258 (admin) and #261
(F-03) remain separate. No edits to Forum F1 or Gracz Next.

## R2 local verification (2026-10-17)

- Newsletter Playwright: 38/38 (desktop/mobile, all 18 shared-script pages,
  footer geometry at 390/768/1440, forced submit, navigation/BFCache, mock API).
- Consent/modal/375px and desktop footer tests: 5/5.
- Offline maintenance/validation checks: 7/7; backend unit suite: 108/108.
- Disposable PostgreSQL 16 and 18 integration: 111/111 each; no skips.
- Backend syntax, SEO and CSP gates: PASS. Targeted ESLint correctness rules:
  no-unreachable, no-dupe-args, no-dupe-keys, valid-typeof: PASS.
- Local Security Gate engine tests: 188 passed, 61 skipped (DB-dependent tests);
  engine syntax PASS. GitHub CodeQL/gitleaks/audit are separate exact-HEAD checks.
- Static site has no separate build step in this scope; actual source is served.
- Initial unit invocation from repo root had a fixture-path error; final run used
  contact-api. Initial PG18 fixture raced bootstrap restart; final harness waits
  for TCP readiness. Neither required a product/test expectation workaround.
- Five new browser tests failed before correction (input state, cache version,
  lost withdrawal link); a later focus check required dismissing the existing
  cookie modal before testing background footer keyboard access.

No production API, DB or email provider was invoked. Test processes used synthetic
local providers and disposable loopback databases. No migration/schema files,
consent history, reservations, production settings or secrets were changed.
**Overall P1 HOLD: operational withdrawal evidence and independent audit pending.**
