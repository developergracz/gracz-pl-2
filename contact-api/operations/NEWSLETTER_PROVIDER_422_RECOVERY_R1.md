# P1-3: definitive Resend 422 rejection — safe operator HOLD and recovery design

**DRAFT / NO MERGE / NO DEPLOY / NO PRODUCTION WRITES.** This independent candidate is based on `b6e4a9bc3e3d0d1952ede20130146e7fc5501cd7`.

## Scope
1. Distinguish a fully received Resend HTTP 422 from ambiguous failures (timeout, 5xx, network loss, lost commit acknowledgement). No exception changes the current durable `inflight → unknown` fence.
2. Surface a fixed P1 operational log code `NEWSLETTER_DOI_422_OPERATOR_HOLD` carrying only a random requestId and sanitized providerRequestId, not raw email or tokens.
3. Provide a non-mutating DB-store inspector for trusted operator workflows (HMAC identity input only).
4. Add local regression proof that a definite 422 never retries automatically, keeps an `unknown` reservation, and does not silently resend on later subscription requests.

## Critical: manual recovery NOT authorized by this PR
These changes improve diagnosis; they do **NOT** clear existing 422 holds. A durable recovery **remains a P1 go-live blocker** until a separately reviewed explicit operator tool is implemented. This repository currently does not retain immutable proof of the provider's 422 response in the reservation table; clearing it automatically would risk duplicate/unauthorized sends.

The proposed operator release procedure must:
- Work only from an approved private, authenticated environment with business writers controlled.
- Verify independently obtained exact Resend delivery evidence for the specific request and idempotency key, and check there was no acceptance, no send and no welcome/consent reconciliation.
- Require recorded authorized owner approval and a second reviewer, plus an immutable append-only audit record that survives later claims and backups.
- Compare exact HMAC emailHash, UUID requestId, `state='unknown'` and current consent/withdrawal state in one bounded transaction.
- Reject missing, stale, conflicting or ambiguous proof and stop without mutation (HOLD).
- Never release timeout/5xx/unknown outcomes, never replay old tokens, never bulk reset, never clear provider suppressions or override opt-outs.
- Have full disposable PostgreSQL 16/18 tests and independent security audit before any Owner execution GO.

This PR adds *zero* write-capable recovery routes or scripts. Exact approval remains required for production release.

Offline test: `node --test contact-api/test/newsletter-provider-422.test.mjs`.

## R2 superseding details

A complete, parseable HTTP 422 from `POST /emails` is a classified response,
**not proof of rejection/non-delivery**. Incomplete/truncated or invalid response
bodies, timeout, disconnect and invalid success acknowledgements remain uncertain.
Every call to the email transport makes exactly one attempt; there is no internal
retry after 429/5xx/timeout. Existing non-email provider API handling is separate.
The DOI reservation and public admission fences remain unchanged.

Persist the unknown fence before logging. Logging exceptions cannot interrupt
that transition or replace the provider error. The operator log contains the
random request UUID and `providerRequestIdSha256`, never the remote header itself.
This replaces the earlier R1 wording about logging a sanitized provider ID.

The unit expectation of four attempts is intentionally replaced by one to satisfy
the R2 no-automatic-retry requirement. The welcome failure fixture now injects
one failed transport attempt before its explicitly requested recovery; assertions
on durable consent and duplicate prevention remain. Invalid successful send ACKs
retain the existing NEWSLETTER_REQUEST_UNCERTAIN contract.

Recovery remains HOLD because the present schema cannot store immutable evidence
and two-party approval atomically with a guarded release. See
[the separate architecture proposal](NEWSLETTER_RECOVERY_R2_DESIGN.md).
Do not execute a migration or invent a write workaround. No production evidence
of the specific 422 cause was available; synthetic tests prove handling only.

## R3 recovery and verification record (2026-10-17)

Recovered workspace `/workspace/newsletter-267` at
`b54667605dfcc63a77e133bd8fb6da3c361c8b5a`; main remains
`b6e4a9bc3e3d0d1952ede20130146e7fc5501cd7`.
Actual recovered work is seven modified tracked files and two new source/docs
files, not merely the four files visible in an earlier UI snapshot. The new
files are the R2 architecture proposal and read-only inspector regression test.
No changes were discarded, no reset/clean/force push used.

Local results:
- Backend unit suite: 122/122, no skips; 13 focused provider/422 tests included.
- PostgreSQL 16/18: 112/112 each in separate disposable loopback databases,
  including 422 followed by four independent restarted processes, unchanged
  reservation/history, and existing race, unsubscribe, crash and lost-ACK cases.
- Backend syntax, SEO/CSP, targeted ESLint correctness checks and diff whitespace:
  PASS. No TypeScript or separate build step in the changed backend scope.
- Frontend changes are isolated in #266 (38 browser and 5 consent tests PASS;
  seven exact-HEAD GitHub workflows SUCCESS at 97048c2b5e5dd24b6607d449ec5c569bc087d3cf).
- A supplemental review agent was unavailable because of a usage limit; it did
  not produce an audit. Independent Claude review remains required.
- Exact new-HEAD CI and secret scanning are reported in the PR after push.

The existing API integration harness and synthetic provider were used. No live
Resend requests, production SQL, F-03 execution, deploys, paid services, DNS or
secrets changes occurred. No schema/migration or production intake setting changed.

P1 CLOSED at code/test level: ambiguous automatic transport retry, truncated422
misclassification, logger failure bypassing unknown transition, and untrusted
provider-header logging. P1 HOLD: actual production422 diagnosis/evidence and
safe audited release of existing reservations. All unknown reservations remain
fenced. These local results do not close the operational HOLD or authorize GO.
