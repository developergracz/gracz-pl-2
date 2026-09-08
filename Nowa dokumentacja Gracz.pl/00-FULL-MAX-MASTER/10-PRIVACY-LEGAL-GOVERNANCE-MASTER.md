# GRACZ.PL — PRIVACY / LEGAL / GOVERNANCE MASTER

**Status:** LIVING CONSOLIDATION  
**Legal conclusion:** NOT PROVIDED BY THIS DOCUMENT

## 1. Purpose

This volume records governance, privacy and legal-decision boundaries so technical implementation cannot silently override prior holds, retention rules or Owner authorization requirements.

## 2. Governance roles

- **Owner — Czesław Socha:** final business/production authority and explicit merge/deploy authorization where required.
- **Lead Architect — GPT-5.6 Sol:** architecture, scope control, mandates, technical verification and recommendation.
- **Implementation Engineer — GPT-2:** controlled implementation under mandate.
- **Claude:** independent audit at defined technical/security gates.
- **Copilot:** implementation assistance, not final authority.
- **Gemini:** independent mathematical/statistical review for relevant FairPlay work.

## 3. Decision types

Every material decision should be classed as one of:

- architecture decision,
- implementation authorization,
- audit verdict,
- merge authorization,
- production/deploy authorization,
- privacy/legal decision,
- operational exception/incident decision.

These decision types are not interchangeable.

## 4. Privacy baseline

Final documentation must identify for each personal-data domain:

- purpose,
- legal/operational basis to be confirmed by appropriate review,
- data categories,
- retention,
- deletion/anonymization,
- export/access behavior,
- legal hold,
- backup implications,
- processor/provider dependencies,
- admin visibility.

## 5. Existing Privacy/Legal gate

Existing V3 documentation records a signed Owner HOLD on the Privacy/Legal review path with five open P1 items at that historical checkpoint.

This FULL MAX package preserves that boundary. It must not reinterpret the HOLD as closed without later evidence and an explicit decision.

## 6. Audit provenance

For every external/AI review retained as project evidence, document where possible:

- reviewer/model role,
- date,
- exact scope,
- exact code/docs baseline,
- findings,
- final verdict,
- whether Lead independently verified findings,
- corrections and re-audit evidence.

AI audit is technical review evidence; it is not automatically a legal opinion, formal certification or regulatory approval.

## 7. FairPlay marketing/governance boundary

Future FairPlay MAX may be described as cryptographically verifiable only to the extent supported by the frozen protocol and actual proof system.

Unless a formal external certification occurs, prohibited implication includes describing the system as formally casino-certified or equivalent to a named regulated operator's certification status.

## 8. Change governance

High-risk changes should follow:

```text
requirement
 -> Lead design/mandate
 -> controlled implementation
 -> exact-head CI evidence
 -> Lead review
 -> independent audit when required
 -> corrections/re-test
 -> Owner + Lead merge authorization
 -> separate production authorization
 -> post-deploy evidence
```

## 9. Documentation governance

Documentation can be developed on a separate docs branch while implementation PRs remain frozen. Documentation commits do not authorize application changes or production actions.

Every statement of `CLOSED`, `PASS`, `MERGED`, `DEPLOYED` or `PRODUCTION READY` must be traceable to evidence.

## 10. Final legal/privacy gate

Before final production AS-BUILT certification, the project must explicitly state:

- which privacy/legal items are closed,
- which external/legal reviews occurred,
- what retention/deletion configuration is actually deployed,
- whether future prizes/card-game mechanics introduce additional legal obligations,
- which claims may be made publicly about FairPlay MAX.

## 11. Current status

```text
PRIVACY/LEGAL/GOVERNANCE MASTER = LIVING
HISTORICAL OWNER PRIVACY/LEGAL HOLD = PRESERVED
FULL LEGAL CLOSURE = NOT CLAIMED
P8 MERGE AUTHORIZATION = NO
FULL MAX IMPLEMENTATION AUTHORIZATION = NO
DOCUMENTATION BRANCH WORK = ALLOWED / NON-PRODUCTION
```
