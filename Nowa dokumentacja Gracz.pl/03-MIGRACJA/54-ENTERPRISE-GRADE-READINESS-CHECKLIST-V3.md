# Gracz.pl V3 — Enterprise-Grade Readiness Checklist

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status początkowy: **ENTERPRISE-STYLE ENGINEERING / NOT YET PRODUCTION-READY / NOT YET ENTERPRISE-GRADE PRODUCTION**

> Ten dokument jest nadrzędną checklistą kwalifikacyjną dla `53-ENTERPRISE-GRADE-DEFINITION-V3.md`. Nie zastępuje E4.0–E4.10. Każdy punkt wymaga dowodu technicznego, operacyjnego albo proceduralnego. Brak dowodu oznacza `HOLD`, nie domniemany PASS.

## 1. Zasada kwalifikacji

Poziomy:

- `LEVEL A — ENTERPRISE-STYLE ENGINEERING`
- `LEVEL B — PRODUCTION-READY V3`
- `LEVEL C — ENTERPRISE-GRADE PRODUCTION`

Warunek Level B:
- [ ] E4.0–E4.10 zakończone bez otwartych blockerów,
- [ ] fresh post-remediation evidence,
- [ ] exact deployed SHA CI/security PASS,
- [ ] rollback/restore path zweryfikowany.

Warunek Level C:
- [ ] Level B osiągnięty,
- [ ] wszystkie 14 obszarów poniżej mają komplet wymaganych dowodów,
- [ ] brak otwartego blocker-class finding,
- [ ] continuous verification/governance jest aktywne.

---

# OBSZAR 1 — Controlled Change Management

Wymagane:
- [ ] formalny freeze przed krytycznymi zmianami,
- [ ] Auto-Deploy kontrolowany,
- [ ] brak równoległych writerów podczas cutover,
- [ ] exact source/deployed SHA,
- [ ] review krytycznych zmian,
- [ ] rollback/repair plan,
- [ ] brak niezarejestrowanych zmian environment/DB.

Evidence:
- [ ] execution log,
- [ ] PR/commit SHA,
- [ ] deploy history,
- [ ] maintenance/freeze record.

PASS tylko jeśli zmiana jest odtwarzalna i audytowalna.  
HOLD jeśli istnieje nieudokumentowany deploy/env/DB drift.

---

# OBSZAR 2 — Database Migration Safety

Wymagane:
- [ ] runtime DDL-free,
- [ ] dedykowany migrator,
- [ ] immutable migration history,
- [ ] exact version/name/checksum ledger,
- [ ] unknown migration fail-closed,
- [ ] plan/apply/verify,
- [ ] migracje transakcyjne tam, gdzie możliwe,
- [ ] backup + zweryfikowany restore przed krytycznym cutover.

Evidence:
- [ ] migration plan output,
- [ ] ledger verification,
- [ ] CI dla migratora,
- [ ] backup/restore evidence.

PASS tylko przy exact ledger i odtwarzalnym restore.  
HOLD przy checksum mismatch, unknown migration lub niezweryfikowanym restore.

---

# OBSZAR 3 — Least-Privilege Database Security

Wymagane:
- [ ] runtime nie jest DB ownerem,
- [ ] brak SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS/REPLICATION,
- [ ] brak nieuzasadnionych CREATE/TRUNCATE/REFERENCES/TRIGGER,
- [ ] per-table DML matrix,
- [ ] sequence privileges minimalne,
- [ ] unknown/legacy objects bez automatycznych grantów,
- [ ] osobne runtime/migrator credentials,
- [ ] SCRAM-SHA-256,
- [ ] fresh read-only ACL verifier PASS.

Evidence:
- [ ] role attributes capture,
- [ ] ACL verifier output,
- [ ] ownership report,
- [ ] credential separation presence-only proof.

HOLD przy owner/admin runtime albo privilege drift.

---

# OBSZAR 4 — Cryptographic Separation and Versioning

Wymagane:
- [ ] legacy v1 decryptability,
- [ ] explicit `LEGACY_CRYPTO_ROOT_V1`,
- [ ] niezależne roots messages/attachments/MFA,
- [ ] version-aware keyring,
- [ ] unknown crypto version fail-closed,
- [ ] kontrolowany write-version switch,
- [ ] rekey bez aktywnych writerów,
- [ ] reconciliation po rekey,
- [ ] zero secret/plaintext leakage,
- [ ] rollback build obsługuje wszystkie aktywne wersje.

Evidence:
- [ ] v1/v2 regression tests,
- [ ] decryptability verifier,
- [ ] version inventory,
- [ ] rekey reconciliation,
- [ ] secret-leak scan.

HOLD przy decrypt failure, nieznanej wersji albo rollbacku v1-only po v2 writes.

---

# OBSZAR 5 — Authentication, Sessions and Secrets

Wymagane:
- [ ] `AUTH_SECRET` oddzielony od crypto roots i audit salt,
- [ ] sekrety tylko w secret manager/environment,
- [ ] brak sekretów w repo/logach/artifactach,
- [ ] session lifecycle/revoke/expiry,
- [ ] udokumentowany wpływ rotacji AUTH,
- [ ] production config fail-closed dla krytycznych braków.

Evidence:
- [ ] config verifier,
- [ ] secret scan,
- [ ] session lifecycle tests,
- [ ] rotation runbook.

HOLD przy wspólnym root bez kontrolowanej kompatybilności albo secret leakage.

---

# OBSZAR 6 — Production Security Configuration

Wymagane:
- [ ] `NODE_ENV=production`,
- [ ] canonical `PUBLIC_BASE_URL`,
- [ ] Turnstile fail-closed,
- [ ] provider mail/sender zweryfikowany,
- [ ] Twilio fully configured albo fully disabled,
- [ ] dedicated `AUDIT_HASH_SALT`,
- [ ] DB transport private network albo verified TLS,
- [ ] proxy trust tylko po dowodzie topologii,
- [ ] normal runtime bez migrator credential.

Evidence:
- [ ] Gate 14D env verifier,
- [ ] provider presence/state evidence,
- [ ] transport/topology classification,
- [ ] negative config tests.

HOLD przy partial provider config, unsafe transport lub migrator credential w runtime.

---

# OBSZAR 7 — Backup and Disaster Recovery

Wymagane:
- [ ] regularne backupy,
- [ ] udokumentowana retencja,
- [ ] okresowe restore rehearsals,
- [ ] restore do oddzielnego środowiska,
- [ ] row-count/integrity reconciliation,
- [ ] określone RPO,
- [ ] określone RTO,
- [ ] DR runbook,
- [ ] dostępność legacy crypto material dla historycznych backupów.

Evidence:
- [ ] backup timestamps/IDs,
- [ ] restore rehearsal results,
- [ ] measured RPO/RTO,
- [ ] DR test record.

Brak udowodnionego restore = automatyczny HOLD dla Level C.

---

# OBSZAR 8 — Observability and SLO

Wymagane:
- [ ] centralne logowanie,
- [ ] runtime/DB/realtime metrics,
- [ ] alerty availability/errors/latency/DB saturation/auth spikes/security anomalies,
- [ ] zdefiniowane SLI/SLO,
- [ ] health/readiness checks,
- [ ] correlation/request IDs,
- [ ] dashboard operacyjny,
- [ ] udowodniona reakcja na alert.

Minimum SLO dla:
- [ ] login,
- [ ] create/join game,
- [ ] realtime gameplay,
- [ ] message send,
- [ ] DB availability.

Evidence:
- [ ] dashboard snapshots/config,
- [ ] alert definitions,
- [ ] SLO document,
- [ ] alert drill record.

HOLD jeśli brak mierzalnych SLO albo alerty nie mają zweryfikowanej reakcji.

---

# OBSZAR 9 — Incident Response

Wymagane:
- [ ] severity model,
- [ ] incident owner/on-call responsibility,
- [ ] playbook auth compromise,
- [ ] playbook DB incident,
- [ ] playbook crypto failure,
- [ ] playbook deploy failure,
- [ ] playbook data corruption,
- [ ] outage/maintenance communication procedure,
- [ ] rollback/repair paths,
- [ ] post-incident review,
- [ ] evidence retention bez secret leakage.

Evidence:
- [ ] incident runbook,
- [ ] tabletop/drill result,
- [ ] escalation matrix,
- [ ] PIR template/example.

HOLD jeśli nie ma wskazanego ownera lub procedury dla krytycznych klas incydentów.

---

# OBSZAR 10 — CI/CD and Supply-Chain Security

Wymagane:
- [ ] CI dla exact production SHA,
- [ ] unit/integration/browser critical journeys,
- [ ] dependency vulnerability scanning,
- [ ] secret scanning,
- [ ] static/security analysis,
- [ ] kontrola źródeł dependencies,
- [ ] brak deployu z niezweryfikowanego SHA,
- [ ] branch/PR policy dla krytycznych zmian,
- [ ] build provenance adekwatne do projektu.

Evidence:
- [ ] workflow run IDs,
- [ ] CodeQL/static scan,
- [ ] gitleaks/secret scan,
- [ ] dependency audit,
- [ ] exact SHA mapping do deployu.

HOLD jeśli deployed SHA nie ma kompletnego security/CI evidence.

---

# OBSZAR 11 — Capacity, Performance and Resilience

Wymagane:
- [ ] performance baseline,
- [ ] realistyczny load test,
- [ ] concurrency/limit policy,
- [ ] timeout/backpressure behavior,
- [ ] reconnect/resume tests,
- [ ] restart/realtime disconnect resilience,
- [ ] DB pool sizing,
- [ ] resource saturation alerting,
- [ ] external provider partial-failure behavior.

Evidence:
- [ ] load test report,
- [ ] latency/error/throughput metrics,
- [ ] resource saturation results,
- [ ] resilience/failure drill.

HOLD jeśli brak dowodu zachowania przy docelowym obciążeniu lub częściowej awarii.

---

# OBSZAR 12 — Application Security and Abuse Resistance

Wymagane:
- [ ] input validation,
- [ ] rate limiting/bot defense,
- [ ] secure headers/cookies/session handling,
- [ ] server-side authorization,
- [ ] audit trail admin/moderation,
- [ ] anti-spam/abuse controls,
- [ ] bezpieczne uploady,
- [ ] regular security review nowych modułów.

Dla gier:
- [ ] server-authoritative state,
- [ ] server-side move validation,
- [ ] replay/double-submit protection gdzie potrzebne,
- [ ] reconnect/state recovery,
- [ ] anti-cheat/abuse telemetry adekwatne do gry.

Evidence:
- [ ] security test suite,
- [ ] negative authorization tests,
- [ ] abuse/rate-limit tests,
- [ ] upload validation tests,
- [ ] game-state integrity tests.

---

# OBSZAR 13 — Data Governance and Privacy

Wymagane:
- [ ] klasyfikacja danych,
- [ ] data minimization,
- [ ] retention policy,
- [ ] kontrola admin access,
- [ ] audit privileged actions,
- [ ] procedura delete/export user data tam, gdzie wymagana,
- [ ] encryption-at-rest/in-transit zgodna z architekturą,
- [ ] brak PII w niesanitowanych logach.

Evidence:
- [ ] data inventory/classification,
- [ ] retention matrix,
- [ ] privileged-access audit,
- [ ] privacy operation procedure,
- [ ] log sanitization review.

HOLD przy nieznanym ownerze danych, niekontrolowanej retencji lub PII leakage.

---

# OBSZAR 14 — Operational Ownership

Wymagane:
- [ ] wskazany system owner,
- [ ] odpowiedzialność deploy/DB/security/incidents,
- [ ] operator onboarding runbook,
- [ ] credential ownership/rotation responsibilities,
- [ ] regularny documentation review,
- [ ] kontrola driftu docs ↔ environment.

Evidence:
- [ ] ownership matrix,
- [ ] review schedule,
- [ ] access/credential responsibility matrix,
- [ ] drift review record.

HOLD jeśli krytyczny obszar nie ma jednoznacznego właściciela.

---

# FINAL ENTERPRISE-GRADE DECISION MATRIX

## Level A — ENTERPRISE-STYLE ENGINEERING

Można utrzymywać jeśli:
- [ ] proces pozostaje evidence-first,
- [ ] zmiany są fail-closed,
- [ ] dokumentacja pozostaje audytowalna.

Aktualny status V3: **TAK**.

## Level B — PRODUCTION-READY V3

Wszystkie wymagane:
- [ ] E4.0 COMPLETE,
- [ ] E4.1 COMPLETE,
- [ ] E4.2 COMPLETE,
- [ ] E4.3 COMPLETE,
- [ ] E4.4 COMPLETE,
- [ ] E4.5 COMPLETE,
- [ ] E4.6 COMPLETE,
- [ ] E4.7 COMPLETE,
- [ ] E4.8 COMPLETE,
- [ ] E4.9 COMPLETE,
- [ ] E4.10 COMPLETE,
- [ ] exact deployed SHA CI/security PASS,
- [ ] rollback/restore path fresh and verified,
- [ ] no open blocker-class findings.

Jeśli którykolwiek punkt nie jest spełniony: **NOT PRODUCTION-READY**.

## Level C — ENTERPRISE-GRADE PRODUCTION

Wszystkie wymagane:
- [ ] Level B = PASS,
- [ ] Obszar 1 PASS,
- [ ] Obszar 2 PASS,
- [ ] Obszar 3 PASS,
- [ ] Obszar 4 PASS,
- [ ] Obszar 5 PASS,
- [ ] Obszar 6 PASS,
- [ ] Obszar 7 PASS,
- [ ] Obszar 8 PASS,
- [ ] Obszar 9 PASS,
- [ ] Obszar 10 PASS,
- [ ] Obszar 11 PASS,
- [ ] Obszar 12 PASS,
- [ ] Obszar 13 PASS,
- [ ] Obszar 14 PASS,
- [ ] continuous verification aktywne,
- [ ] brak krytycznego driftu między dokumentacją a rzeczywistym środowiskiem.

Dopiero wtedy można formalnie oznaczyć:

`V3 = ENTERPRISE-GRADE PRODUCTION`

---

# Aktualny status na 29.08.2026

- ETAP 3: `CLOSED`
- Gate 15: `GO TO ETAP 4`
- ETAP 4: `OPEN`
- E4.0: `INCOMPLETE / HOLD`
- E4.1–E4.10: `BLOCKED BY E4.0`
- Production V3: `NO-GO`
- Level A: `ACHIEVED`
- Level B: `NOT YET ACHIEVED`
- Level C: `NOT YET ACHIEVED`

## Zasada końcowa

Żaden punkt nie jest oznaczany PASS na podstawie deklaracji lub jakości dokumentacji. Wymagany jest:

**design + implementation + applied control + fresh evidence + operational proof + continuous verification.**
