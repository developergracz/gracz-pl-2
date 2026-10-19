# #282 Private withdrawal intake — isolated R1 code slice

**DRAFT / NOT READY FOR PRODUCTION.** This first implementation slice adds
an isolated PostgreSQL recovery schema with opaque request receipts and an
append-only audit trail. The internal withdrawal-inbox.mjs atomically receives
a deduplicated request and returns only **PENDING**, never withdrawn or confirmed.

- This SQL is intentionally **not** part of global CONTACT migrations 001–005,
  or the F03 newsletter/001_opt_in_requests migration. It is not installed by
  build, deploy, start or migrate scripts. A separately reviewed,
  checksum-validated recovery migration executor is still needed.
- This library has **no public route**, no Resend side effects, no recovery
  bypass and no way to modify newsletter consent or provider suppression.
- Its trusted caller must authenticate the intake source and supply a fresh,
  purpose-separated HMAC dedupe tag; never raw email, historical bearers or
  derivation from the potentially compromised newsletter secrets.
- evidence_ref is an opaque UUID pointing to a future restricted, encrypted
  evidence store; evidence and personal data are not present in these tables.
- No human operator should receive direct PostgreSQL credentials.
- Private RBAC/MFA, independent operator accounts, authenticated operator
  action audit, identity verification, subject mapping, confirmed withdrawals,
  provider-off reconciliation, lifecycle/tombstones, retention, monitoring,
  synthetic operator rehearsal and incident sign-off are **NOT IMPLEMENTED**
  in this R1 slice. They remain blocking before activation.
- The new integration file is automatically collected by the existing
  npm --prefix contact-api run test:persistence test glob in PostgreSQL 16/18 CI.
  Its test fixture requires a loopback disposable gracz_test DB and destroys
  only the dedicated recovery schema. NEVER run it against production.
- Database append-only triggers protect against ordinary application writes;
  a privileged owner who disables triggers is outside that guarantee.
  A future restricted service role must enforce least privilege.

No integration with PR #281. PR #281 stays DRAFT and HARD HOLD. This commit
does NOT approve merge, production schema installation, live requests or sending.
