# Gracz.pl V3 — Enterprise-Grade Operational Proof Plan

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status wejściowy: **LEVEL A ACHIEVED / LEVEL B NOT YET ACHIEVED / LEVEL C NOT YET ACHIEVED**

> Ten dokument opisuje, jak zebrać rzeczywiste dowody operacyjne dla 14 obszarów z `54-ENTERPRISE-GRADE-READINESS-CHECKLIST-V3.md`. Nie zastępuje ETAPU 4. E4.0–E4.10 pozostają wymaganym kontraktem prowadzącym do Level B. Ten plan definiuje warstwę dowodową wymaganą do Level C.

## 1. Zasada dowodowa

Każdy obszar może otrzymać `PASS` wyłącznie wtedy, gdy istnieją jednocześnie:

1. zatwierdzony design/kontrakt,
2. wdrożona kontrola,
3. świeży dowód techniczny albo operacyjny,
4. możliwy do zidentyfikowania source/deployed SHA lub wersja konfiguracji,
5. wynik bez blocker-class findings,
6. wskazany właściciel utrzymania kontroli,
7. określony moment ponownej weryfikacji.

Deklaracja, checklista bez wykonania albo sam screenshot nie wystarczają do trwałego PASS, jeśli kontrola wymaga testu technicznego.

## 2. Klasy dowodów

Dopuszczalne klasy evidence:

- `CODE` — commit/PR/diff/test dla exact SHA,
- `CI` — workflow run, security scan, test run,
- `CONFIG` — niesekretne potwierdzenie stanu konfiguracji,
- `DB-READONLY` — collector/verifier bez mutacji,
- `RUNTIME` — health/metrics/logs/journey z działającego runtime,
- `DRILL` — kontrolowany test awarii, restore, alertu albo incydentu,
- `RUNBOOK` — procedura wykonawcza wraz z ownerem,
- `OPERATIONS` — deploy/freeze/maintenance/incident record,
- `GOVERNANCE` — ownership/access/review/retention record.

Każdy artefakt musi zawierać co najmniej timestamp, zakres, wynik, identyfikator środowiska i — jeśli dotyczy kodu — exact SHA. Nie zapisujemy wartości sekretów.

## 3. Ważność dowodów

Evidence traci ważność, gdy nastąpi istotna zmiana w obszarze, którego dotyczy, np.:

- nowy deployed SHA,
- zmiana DB schema/ACL/role,
- zmiana auth/crypto secret topology,
- zmiana infrastruktury sieciowej/proxy/DB transport,
- zmiana backup/retention policy,
- zmiana SLO/alerting,
- duża zmiana realtime/game architecture,
- incydent ujawniający nieskuteczność kontroli.

Po istotnej zmianie wymagany jest fresh proof dla dotkniętych obszarów.

---

# OBSZAR 1 — Controlled Change Management

## Operacyjne wykonanie

1. Wykonać kontrolowany deployment/cutover zgodnie z freeze runbookiem.
2. Zapisać exact source SHA i exact deployed SHA.
3. Potwierdzić brak równoległego writera i nieautoryzowanych zmian env/DB.
4. Zachować deploy/maintenance history i decyzję GO/ABORT.
5. Wykonać po zmianie drift review.

## Wymagane evidence

- `OPERATIONS`: freeze/execution log,
- `CODE`: PR + commit SHA,
- `OPERATIONS`: deploy history,
- `CONFIG`: environment state presence-only,
- `GOVERNANCE`: change owner/reviewer.

## PASS

Zmiana jest odtwarzalna, zatwierdzona, powiązana z exact SHA i nie ma nieudokumentowanego driftu.

## HOLD

Nieznany deployed SHA, równoległy writer, nieudokumentowana zmiana env/DB albo brak rollback/repair path.

## Revalidation

Po każdym krytycznym deployu albo zmianie konfiguracji produkcyjnej.

---

# OBSZAR 2 — Database Migration Safety

## Operacyjne wykonanie

1. `--plan` dla zatwierdzonego pakietu migracji.
2. Backup + restore rehearsal przed krytycznym cutover.
3. Apply wyłącznie dedykowanym migratorem.
4. Verify exact ledger version/name/checksum.
5. Negative test dla unknown/checksum mismatch.
6. Potwierdzić runtime DDL-free.

## Wymagane evidence

- `CI`: migrator tests,
- `DB-READONLY`: ledger verifier,
- `DRILL`: restore rehearsal,
- `CODE`: runtime DDL scan/inventory,
- `OPERATIONS`: migration execution record.

## PASS

Exact ledger, udowodniony restore, runtime bez DDL i fail-closed przy niezgodności.

## HOLD

Checksum mismatch, unknown migration, brak restore proof albo runtime DDL.

## Revalidation

Przy każdej nowej migracji oraz okresowo dla restore path.

---

# OBSZAR 3 — Least-Privilege Database Security

## Operacyjne wykonanie

1. Uruchomić fresh read-only role/ACL verifier.
2. Potwierdzić runtime != owner/admin.
3. Potwierdzić brak SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS/REPLICATION.
4. Zweryfikować per-table DML matrix i sequence USAGE.
5. Negative tests: runtime nie może CREATE/ALTER/DROP/TRUNCATE/GRANT ani czytać write-only targets poza contract.
6. Potwierdzić osobne runtime/migrator credentials presence-only.

## Evidence

- `DB-READONLY`: role/ACL/ownership capture,
- `DB-READONLY`: least-privilege verifier,
- `RUNTIME`: negative privilege test results,
- `CONFIG`: credential separation presence-only.

## PASS

Runtime ma wyłącznie jawnie potrzebne uprawnienia i negatywne testy kończą się odmową.

## HOLD

Runtime jest owner/admin albo privilege drift rozszerza możliwości poza contract.

## Revalidation

Po każdej zmianie schema, roli, ownership lub ACL.

---

# OBSZAR 4 — Cryptographic Separation and Versioning

## Operacyjne wykonanie

1. Fresh v1 decryptability before transition.
2. Potwierdzić keyring dual-read v1/v2.
3. Negative test unknown version => fail-closed.
4. Przełączyć write version zgodnie z runbookiem.
5. Controlled rekey bez aktywnych writerów.
6. Reconciliation v1/v2 i fresh decryptability.
7. Potwierdzić rollback build obsługuje wszystkie aktywne wersje.
8. Secret/plaintext leak scan.

## Evidence

- `CI`: v1/v2 regression tests,
- `RUNTIME`: decryptability probe,
- `DB-READONLY`: version inventory/reconciliation,
- `CI`: secret scan,
- `CODE`: rollback compatibility proof.

## PASS

Każdy aktywny ciphertext jest czytelny przez zatwierdzony runtime, wersje są jawne, unknown version fail-closed, brak leakage.

## HOLD

Decrypt failure, nieznana wersja, rekey przy aktywnych writerach albo brak rollback compatibility.

## Revalidation

Po zmianie keyringu, write version, rekey lub rotacji crypto roots.

---

# OBSZAR 5 — Authentication, Sessions and Secrets

## Operacyjne wykonanie

1. Potwierdzić rozdział AUTH/crypto/audit roots presence-only.
2. Uruchomić session lifecycle tests: login, expiry, revoke/logout, invalid token/session.
3. Zweryfikować wpływ rotacji AUTH na istniejące sesje.
4. Secret scan repo/logs/artifacts.
5. Negative config tests dla krytycznych braków.

## Evidence

- `CONFIG`: env verifier presence-only,
- `CI`: secret scan,
- `RUNTIME`: session lifecycle tests,
- `RUNBOOK`: AUTH rotation procedure.

## PASS

Sekrety są rozdzielone i niewyciekające, session lifecycle działa, krytyczne braki fail-closed.

## HOLD

Secret leakage, wspólny root poza zatwierdzoną kompatybilnością albo brak kontrolowanego revoke/expiry.

## Revalidation

Po zmianach auth/session/secret topology i po każdej rotacji.

---

# OBSZAR 6 — Production Security Configuration

## Operacyjne wykonanie

1. Gate 14D env verifier na exact deployed runtime.
2. Potwierdzić canonical base URL, production mode, Turnstile, mail, Twilio state, audit salt.
3. Potwierdzić DB transport/topology.
4. Potwierdzić proxy trust według udowodnionej topologii.
5. Potwierdzić brak migrator credential w normalnym runtime.
6. Negative config tests.

## Evidence

- `CONFIG`: environment verifier,
- `RUNTIME`: negative config behavior,
- `OPERATIONS`: provider/topology record.

## PASS

Każdy obowiązkowy production control jest aktywny i zweryfikowany bez ujawniania sekretów.

## HOLD

Partial provider config, unsafe transport, błędny proxy trust albo migrator credential w runtime.

## Revalidation

Po zmianach env, dostawców, domeny, sieci lub proxy.

---

# OBSZAR 7 — Backup and Disaster Recovery

## Operacyjne wykonanie

1. Zdefiniować RPO i RTO.
2. Zweryfikować harmonogram i retencję backupów.
3. Wykonać restore do izolowanego środowiska.
4. Zmierzyć czas restore i rzeczywiste RPO/RTO.
5. Wykonać row-count/integrity/decryptability reconciliation.
6. Zweryfikować dostępność legacy crypto material do historycznych backupów.
7. Przeprowadzić DR drill według runbooka.

## Evidence

- `OPERATIONS`: backup IDs/timestamps,
- `DRILL`: restore report,
- `DB-READONLY`: reconciliation results,
- `DRILL`: measured RPO/RTO,
- `RUNBOOK`: DR procedure.

## PASS

Restore jest rzeczywiście wykonalny, dane są spójne, a zmierzone RPO/RTO spełniają zatwierdzony cel.

## HOLD

Brak udowodnionego restore, nieosiągnięte RPO/RTO albo brak kluczy do odszyfrowania historycznych backupów.

## Revalidation

Cyklicznie oraz po zmianach backup/DB/crypto architecture.

---

# OBSZAR 8 — Observability and SLO

## Operacyjne wykonanie

1. Zdefiniować SLI/SLO dla login, create/join game, realtime gameplay, message send i DB availability.
2. Włączyć centralne logi, metryki i correlation/request IDs.
3. Zbudować dashboard operacyjny.
4. Skonfigurować alerty availability/errors/latency/DB saturation/auth spikes/security anomalies.
5. Wykonać kontrolowany alert drill i potwierdzić reakcję.
6. Udowodnić health/readiness behavior.

## Evidence

- `CONFIG`: alert definitions,
- `RUNTIME`: dashboard/metrics capture,
- `RUNBOOK`: SLO document,
- `DRILL`: alert drill record.

## PASS

Krytyczne ścieżki są mierzalne, mają zatwierdzone SLO, alerty działają i ktoś faktycznie reaguje.

## HOLD

Brak mierzalnych SLO, ślepe obszary telemetryczne albo alert bez zweryfikowanej reakcji.

## Revalidation

Po zmianie architektury, SLO albo systemu telemetrycznego; alert drill okresowo.

---

# OBSZAR 9 — Incident Response

## Operacyjne wykonanie

1. Zdefiniować severity model.
2. Wskazać incident owner/escalation path.
3. Utrzymać playbooki dla auth compromise, DB incident, crypto failure, deploy failure i data corruption.
4. Przeprowadzić tabletop/drill co najmniej jednego krytycznego scenariusza.
5. Zweryfikować maintenance/outage communication path.
6. Utrzymać PIR template i evidence-retention rules.

## Evidence

- `RUNBOOK`: incident playbooks,
- `GOVERNANCE`: escalation matrix,
- `DRILL`: tabletop/incident drill,
- `RUNBOOK`: PIR template.

## PASS

Każda krytyczna klasa incydentu ma ownera, procedurę, kanał komunikacji i przetestowaną reakcję.

## HOLD

Brak ownera, brak playbooka dla krytycznego scenariusza albo procedura nigdy nieprzetestowana.

## Revalidation

Po istotnym incydencie oraz okresowo przez tabletop.

---

# OBSZAR 10 — CI/CD and Supply-Chain Security

## Operacyjne wykonanie

1. CI dla exact deployed SHA.
2. Unit/integration/browser critical journeys.
3. Dependency audit.
4. Secret scanning.
5. CodeQL/static/security analysis.
6. Potwierdzić branch/PR policy dla krytycznych zmian.
7. Udowodnić mapping commit → build → deploy.
8. Potwierdzić kontrolę źródeł dependencies/build provenance adekwatną do projektu.

## Evidence

- `CI`: workflow run IDs,
- `CI`: CodeQL/gitleaks/dependency audit,
- `CODE`: PR/commit review,
- `OPERATIONS`: exact SHA deploy mapping.

## PASS

Exact deployed SHA ma kompletny zestaw wymaganych testów i security evidence.

## HOLD

Deploy z niezweryfikowanego SHA, brak secret scan/static analysis albo brak możliwości ustalenia provenance.

## Revalidation

Przy każdym produkcyjnym deployu.

---

# OBSZAR 11 — Capacity, Performance and Resilience

## Operacyjne wykonanie

1. Ustalić realistyczny model obciążenia.
2. Zmierzyć baseline latency/error/throughput.
3. Wykonać load test dla login/lobby/realtime/game/message paths.
4. Zweryfikować DB pool sizing i saturation behavior.
5. Przetestować timeout/backpressure/limits.
6. Przetestować reconnect/resume i restart procesu.
7. Przeprowadzić partial-failure drill dla istotnych providerów.

## Evidence

- `DRILL`: load test report,
- `RUNTIME`: latency/error/throughput/resource metrics,
- `DRILL`: reconnect/restart/provider failure results,
- `CONFIG`: concurrency/pool/timeout policy.

## PASS

System zachowuje się przewidywalnie przy zatwierdzonym obciążeniu i kontrolowanych awariach częściowych.

## HOLD

Brak load proof, niestabilność realtime/reconnect, niekontrolowana saturacja albo brak backpressure.

## Revalidation

Po istotnej zmianie wydajnościowej/architektonicznej oraz przed dużym wzrostem ruchu.

---

# OBSZAR 12 — Application Security and Abuse Resistance

## Operacyjne wykonanie

1. Negative authorization tests.
2. Input validation tests.
3. Rate-limit/bot-defense tests.
4. Secure cookie/session/header verification.
5. Upload validation tests.
6. Anti-spam/abuse tests.
7. Audit trail admin/moderation verification.
8. Dla gier: server-authoritative state, move validation, replay/double-submit defense, reconnect/state recovery i anti-cheat telemetry.

## Evidence

- `CI`: application security tests,
- `RUNTIME`: negative auth/rate-limit behavior,
- `CI`: upload/game-state integrity tests,
- `DB-READONLY`: audit trail verification where applicable.

## PASS

Niedozwolone działania są odrzucane po stronie serwera, a abuse controls i game-state integrity są udowodnione testami.

## HOLD

Client-trusted authorization/state, bypassowalne limity, niebezpieczne uploady albo brak audytowalności działań uprzywilejowanych.

## Revalidation

Przy każdym nowym module bezpieczeństwa, grze albo istotnej zmianie API.

---

# OBSZAR 13 — Data Governance and Privacy

## Operacyjne wykonanie

1. Utworzyć aktualny data inventory/classification.
2. Zdefiniować retention matrix.
3. Zweryfikować minimalizację danych i admin access.
4. Zweryfikować audit privileged actions.
5. Utrzymać delete/export procedure tam, gdzie wymagana.
6. Zweryfikować encryption in transit/at rest zgodnie z architekturą.
7. Przeprowadzić log sanitization review pod kątem PII.

## Evidence

- `GOVERNANCE`: data inventory/classification,
- `GOVERNANCE`: retention matrix,
- `DB-READONLY`: privileged-access/audit evidence,
- `RUNBOOK`: privacy operation procedure,
- `RUNTIME`: sanitized log review.

## PASS

Dane mają znany cel, właściciela, retencję, kontrolę dostępu i nie wyciekają do niesanitowanych logów.

## HOLD

Nieznana retencja/owner, nadmiarowe dane, niekontrolowany admin access albo PII leakage.

## Revalidation

Przy zmianie modelu danych, nowych funkcjach zbierających dane lub zmianie wymogów prawnych/polityk.

---

# OBSZAR 14 — Operational Ownership

## Operacyjne wykonanie

1. Wskazać system ownera.
2. Zdefiniować odpowiedzialność za deploy, DB, security i incidents.
3. Utrzymać operator onboarding runbook.
4. Zdefiniować credential ownership i rotation responsibility.
5. Ustalić harmonogram review dokumentacji.
6. Wykonać cykliczny docs ↔ environment drift review.

## Evidence

- `GOVERNANCE`: ownership/RACI matrix,
- `RUNBOOK`: operator onboarding,
- `GOVERNANCE`: access/credential responsibility matrix,
- `OPERATIONS`: drift review record.

## PASS

Każda krytyczna odpowiedzialność ma jednoznacznego ownera i regularny proces kontroli driftu.

## HOLD

Krytyczny obszar bez właściciela albo dokumentacja nie odpowiada rzeczywistemu środowisku.

## Revalidation

Po zmianie operatorów/odpowiedzialności oraz w stałym cyklu governance.

---

# 4. Kolejność zbierania operational proof

Nie wszystkie dowody należy zbierać natychmiast. Obowiązuje bezpieczna kolejność:

## Faza P0 — teraz

- utrzymać Level A,
- zakończyć E4.0,
- nie uruchamiać Level C drills, które wymagają gotowego target runtime.

## Faza P1 — podczas E4.1–E4.10

Zbierać dowody bezpośrednio powstające w ETAPIE 4 dla obszarów:
- 1 Controlled Change,
- 2 Migration Safety,
- 3 Least Privilege,
- 4 Crypto,
- 5 Auth/Secrets,
- 6 Production Security Config,
- części 7 Backup/Restore,
- 10 CI/CD.

## Faza P2 — po Level B / stabilnym target runtime

Zebrać trwałe dowody dla:
- 7 pełny DR/RPO/RTO,
- 8 Observability/SLO,
- 9 Incident Response,
- 11 Capacity/Performance/Resilience,
- 12 Application Security/Abuse na docelowym runtime,
- 13 Data Governance/Privacy,
- 14 Operational Ownership.

## Faza P3 — kwalifikacja Level C

1. Wszystkie 14 obszarów fresh PASS.
2. Brak blocker-class findings.
3. Continuous verification aktywne.
4. Brak krytycznego docs/environment driftu.
5. Finalny evidence manifest z identyfikatorami wszystkich artefaktów.
6. Formalna decyzja:

`V3 = ENTERPRISE-GRADE PRODUCTION`

albo:

`V3 = HOLD — ENTERPRISE-GRADE CRITERIA NOT YET COMPLETE`.

---

# 5. Evidence Manifest — minimalny format

Dla każdego dowodu zapisać:

- `area_id` — 1..14,
- `control/test`,
- `evidence_class`,
- `environment`,
- `timestamp`,
- `source_sha/deployed_sha` jeśli dotyczy,
- `result` = PASS/HOLD/FAIL,
- `artifact/run/report id`,
- `owner`,
- `valid_until_or_revalidation_trigger`,
- `notes` bez sekretów.

Nie przechowujemy secret values, connection strings, plaintextów chronionych danych ani materiału umożliwiającego odtworzenie kluczy.

# 6. Finalna reguła kwalifikacji

`LEVEL C — ENTERPRISE-GRADE PRODUCTION` może zostać nadany wyłącznie wtedy, gdy:

- Level B = PASS,
- Obszary 1–14 = PASS,
- każdy PASS ma fresh operational evidence,
- brak blocker-class finding,
- continuous verification jest aktywne,
- istnieje finalny Enterprise-Grade Evidence Manifest,
- nie ma krytycznego driftu między dokumentacją, kodem, DB i realnym środowiskiem.

## Aktualny status

Na dzień 29.08.2026:

- Level A: **ACHIEVED**,
- Level B: **NOT YET ACHIEVED**,
- Level C: **NOT YET ACHIEVED**,
- E4.0: **INCOMPLETE / HOLD**,
- Production V3: **NO-GO**.

Dlatego obecnie ten dokument jest **planem zbierania przyszłych dowodów**, a nie potwierdzeniem, że dowody już istnieją.