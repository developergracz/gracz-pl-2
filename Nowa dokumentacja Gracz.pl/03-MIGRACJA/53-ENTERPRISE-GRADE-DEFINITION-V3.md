# Gracz.pl V3 — Enterprise-Grade Definition

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status wejściowy: **ENTERPRISE-STYLE ENGINEERING / NOT YET ENTERPRISE-GRADE PRODUCTION**

## 1. Cel

Ten dokument definiuje jednoznaczne kryteria, po których V3 może zostać nazwany **enterprise-grade production foundation** dla Gracz.pl.

Nie jest to etykieta marketingowa. Każde kryterium musi mieć dowód techniczny, operacyjny albo proceduralny.

## 2. Zasada klasyfikacji

V3 może zostać sklasyfikowany w trzech poziomach:

### Poziom A — Enterprise-style engineering

Proces wykorzystuje:
- evidence-first,
- fail-closed,
- formalne checklisty i runbooki,
- least privilege,
- kontrolowane migracje,
- rollback anchors,
- audytowalną dokumentację.

To opisuje aktualny sposób pracy nad V3.

### Poziom B — Production-ready V3

Wymaga co najmniej pełnego wykonania E4.0–E4.10 oraz fresh post-remediation evidence bez otwartych blockerów.

### Poziom C — Enterprise-grade production

Wymaga Production-ready V3 oraz trwałych mechanizmów operacyjnych: observability/SLO, backup/DR, incident response, access governance, capacity/load, vulnerability management i ciągłej kontroli driftu.

## 3. Kryterium 1 — Controlled Change Management

Wymagane:
- formalny freeze przed zmianami produkcyjnymi,
- Auto-Deploy kontrolowany,
- brak równoległych writerów podczas cutover,
- exact source/deployed SHA,
- review dla zmian krytycznych,
- deterministyczny plan rollback/repair,
- brak niezarejestrowanych zmian environment/DB.

Dowód:
- execution logs,
- PR/commit SHA,
- deploy history,
- maintenance records.

## 4. Kryterium 2 — Database Migration Safety

Wymagane:
- runtime DDL-free,
- dedykowany migrator,
- immutable migration history,
- exact version/name/checksum ledger,
- unknown migration = fail-closed,
- migration plan/apply/verify,
- transakcyjne migracje tam, gdzie możliwe,
- backup + zweryfikowany restore przed krytycznym cutover.

## 5. Kryterium 3 — Least-Privilege Database Security

Wymagane:
- runtime nie jest DB ownerem,
- runtime bez CREATEDB/CREATEROLE/SUPERUSER/BYPASSRLS/REPLICATION,
- brak CREATE/TRUNCATE/REFERENCES/TRIGGER poza jawnie uzasadnionymi wyjątkami,
- per-table DML matrix,
- sequence privileges tylko tam, gdzie wymagane,
- unknown/legacy objects bez automatycznych grantów,
- migrator i runtime używają osobnych credentials,
- SCRAM-SHA-256 dla nowych login roles,
- fresh read-only verifier potwierdza ACL.

## 6. Kryterium 4 — Cryptographic Separation and Versioning

Wymagane:
- legacy v1 decryptability zachowana,
- explicit `LEGACY_CRYPTO_ROOT_V1`,
- niezależne roots dla messages/attachments/MFA,
- version-aware keyring,
- fail-closed dla unknown crypto versions,
- kontrolowany write-version switch,
- rekey bez aktywnych writerów,
- fresh reconciliation po rekey,
- brak sekretów i ciphertext plaintextu w logach,
- rollback build obsługuje wszystkie aktywne wersje ciphertextu.

## 7. Kryterium 5 — Authentication, Sessions and Secrets

Wymagane:
- `AUTH_SECRET` oddzielony od encryption roots i audit salt,
- sekrety tylko w secret manager/environment,
- brak sekretów w repo/logach/artifactach,
- sesje mają kontrolowany lifecycle i revoke/expiry,
- rotacja AUTH ma opisany wpływ na aktywne sesje,
- production configuration fail-closed dla krytycznych braków.

## 8. Kryterium 6 — Production Security Configuration

Wymagane:
- `NODE_ENV=production`,
- canonical `PUBLIC_BASE_URL`,
- Turnstile skonfigurowany fail-closed,
- mail provider i sender zweryfikowane,
- Twilio albo kompletnie skonfigurowany, albo kompletnie wyłączony,
- dedicated `AUDIT_HASH_SALT`,
- transport DB zgodny z zatwierdzoną topologią private network albo verified TLS,
- proxy trust tylko po udowodnieniu topologii,
- normal runtime bez migrator credential.

## 9. Kryterium 7 — Backup and Disaster Recovery

Wymagane:
- regularne backupy,
- udokumentowana retencja,
- okresowe restore rehearsals,
- restore do oddzielnego środowiska,
- row-count/integrity reconciliation po restore,
- określone i zmierzone RPO/RTO,
- procedura disaster recovery,
- dostępność legacy crypto material wymagana do odtworzenia historycznych backupów.

Brak udowodnionego restore oznacza brak pełnej klasyfikacji enterprise-grade.

## 10. Kryterium 8 — Observability and SLO

Wymagane:
- centralne logowanie aplikacyjne i security events,
- metryki zdrowia runtime/DB/realtime,
- alerty dla availability, errors, latency, DB saturation, failed auth spikes i security anomalies,
- zdefiniowane SLI/SLO dla krytycznych ścieżek,
- health/readiness checks,
- correlation/request IDs,
- dashboard operacyjny,
- udowodniona reakcja na alerty.

Minimum należy określić dla:
- logowania,
- tworzenia/joinowania gry,
- realtime gameplay,
- wysyłki wiadomości,
- DB availability.

## 11. Kryterium 9 — Incident Response

Wymagane:
- severity model,
- incident owner/on-call responsibility,
- playbook dla auth compromise, DB incident, crypto failure, deploy failure i data corruption,
- komunikacja maintenance/outage,
- rollback/repair paths,
- post-incident review,
- evidence retention bez ujawniania sekretów.

## 12. Kryterium 10 — CI/CD and Supply-Chain Security

Wymagane:
- CI dla exact production SHA,
- testy unit/integration/browser critical journeys,
- dependency vulnerability scanning,
- secret scanning,
- static/security analysis,
- kontrola źródła dependencies,
- brak deployu z niezweryfikowanego SHA,
- branch/PR review policy dla zmian krytycznych,
- możliwość odtworzenia build provenance w stopniu odpowiednim do projektu.

## 13. Kryterium 11 — Capacity, Performance and Resilience

Wymagane:
- baseline performance,
- load test dla realistycznej liczby użytkowników i aktywnych gier,
- limit/concurrency policy,
- timeout/backpressure behavior,
- test reconnect/resume,
- odporność na restart procesu/realtime disconnect,
- DB connection pool sizing,
- resource saturation alerting,
- udowodnione zachowanie przy częściowej awarii providerów zewnętrznych.

## 14. Kryterium 12 — Application Security and Abuse Resistance

Wymagane:
- input validation,
- rate limiting/bot defense,
- secure headers/cookies/session handling,
- authorization checks server-side,
- audit trail dla czynności administracyjnych/moderacyjnych,
- anti-spam/abuse controls,
- bezpieczna obsługa uploadów,
- regularne security review dla nowych modułów.

Dla gier dodatkowo:
- server-authoritative state,
- walidacja ruchów po stronie serwera,
- ochrona przed double-submit/replay tam, gdzie ma znaczenie,
- reconnect/state recovery,
- mechanizmy wykrywania nadużyć/cheatów adekwatne do gry.

## 15. Kryterium 13 — Data Governance and Privacy

Wymagane:
- klasyfikacja danych,
- minimalizacja przechowywanych danych,
- polityka retencji,
- kontrola dostępu administracyjnego,
- audyt działań uprzywilejowanych,
- procedura usuwania/eksportu danych użytkownika tam, gdzie wymagana,
- encryption-at-rest/in-transit zgodnie z architekturą,
- brak danych osobowych w niesanitowanych logach diagnostycznych.

## 16. Kryterium 14 — Operational Ownership

Wymagane:
- jednoznacznie wskazany właściciel systemu,
- odpowiedzialność za deploy/DB/security/incidents,
- runbook onboarding dla operatora,
- udokumentowane credentials ownership/rotation responsibilities,
- regularny review dokumentacji,
- kontrola driftu między dokumentacją a rzeczywistym środowiskiem.

## 17. Relacja do ETAPU 4

E4.0–E4.10 zapewniają krytyczny rdzeń technicznego production-readiness V3:
- freeze,
- fresh evidence,
- DDL separation,
- least privilege,
- crypto transition,
- production env,
- target runtime,
- fresh post-remediation verification.

**E4.10 jest konieczne do Production-ready V3, ale nie jest samo w sobie pełnym dowodem wszystkich kryteriów enterprise-grade.**

Pełna kwalifikacja enterprise-grade wymaga dodatkowo trwałych dowodów z sekcji observability/SLO, DR/RPO/RTO, incident response, capacity/load, access governance i continuous security operations.

## 18. Minimalna decyzja formalna

### `V3 = ENTERPRISE-STYLE ENGINEERING`

Można stosować obecnie, jeśli proces pozostaje evidence-first i fail-closed.

### `V3 = PRODUCTION-READY`

Tylko po:
- E4.0–E4.10 zakończonych bez blockerów,
- fresh post-remediation evidence,
- exact deployed SHA CI/security PASS,
- zweryfikowanym rollback/restore path.

### `V3 = ENTERPRISE-GRADE PRODUCTION`

Tylko po `PRODUCTION-READY` oraz udowodnieniu wszystkich obowiązkowych kryteriów operacyjnych z tego dokumentu.

## 19. Aktualna klasyfikacja Gracz.pl V3

Na dzień 29.08.2026:

- ETAP 3: CLOSED,
- Gate 15: GO TO ETAP 4,
- ETAP 4: OPEN,
- E4.0: INCOMPLETE / HOLD,
- E4.1–E4.10: BLOCKED BY E4.0,
- Production V3: NO-GO,
- klasyfikacja: **ENTERPRISE-STYLE ENGINEERING / NOT YET ENTERPRISE-GRADE PRODUCTION**.

## 20. Zasada końcowa

Nie oznaczamy systemu jako enterprise-grade na podstawie samej jakości dokumentacji. Status wynika z kombinacji:

**design + implementation + applied controls + fresh evidence + operational capability + continuous verification.**

Dopiero ta całość stanowi profesjonalny, produkcyjny fundament długoterminowego Gracz.pl.
