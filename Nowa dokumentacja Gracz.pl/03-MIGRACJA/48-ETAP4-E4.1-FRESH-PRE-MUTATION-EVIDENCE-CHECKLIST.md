# ETAP 4 — E4.1 Fresh Pre-Mutation Evidence Checklist

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status początkowy: **BLOCKED UNTIL E4.0 COMPLETE / READ-ONLY ONLY**

> E4.1 wolno rozpocząć dopiero po operacyjnym zamknięciu E4.0 Freeze/Maintenance. E4.1 nie wykonuje migracji, DDL/DCL/DML, provisioning ról, zmian sekretów, zmian Render environment ani deployu. Celem jest wyłącznie zebranie świeżych, porównywalnych dowodów przed pierwszą mutacją ETAPU 4.

## 1. Warunek wejścia — E4.0

Przed uruchomieniem któregokolwiek collectora:

- [ ] E4.0 ma status `COMPLETE` w dzienniku wykonawczym,
- [ ] publiczne mutacje są zablokowane,
- [ ] normalny mutation writer jest zatrzymany albo skutecznie zablokowany,
- [ ] wszystkie dodatkowe writery/background jobs/webhook consumers są zatrzymane albo skutecznie zablokowane,
- [ ] `Auto-Deploy = Off`,
- [ ] brak aktywnego deployu/restartu/rollbacku,
- [ ] environment jest zamrożony,
- [ ] exact source SHA został zapisany.

**Jeśli choć jeden punkt jest niepotwierdzony: E4.1 = HOLD. Nie uruchamiać żadnego kroku mutacyjnego.**

---

# A. Source / GitHub baseline

Cel: zamrozić dokładny kod i stan repozytorium używany jako baseline.

- [ ] Repo: `developergracz/gracz-pl-2`.
- [ ] PR #26 jest `OPEN`.
- [ ] PR #26 jest `DRAFT`.
- [ ] PR #26 jest `NOT MERGED`.
- [ ] Head branch: `audit/gate14a2-runtime-ddl-separation`.
- [ ] Head SHA jest zapisany.
- [ ] Oczekiwany baseline head: `cb073bad3050ffc9726e0a1528c2ec4a4808f12e` albo nowy SHA został formalnie zrecenzowany i wpisany jako replacement baseline.
- [ ] Base branch/target jest zapisany.
- [ ] Brak niezatwierdzonego merge/deploy między końcem E4.0 a capture E4.1.

### Evidence do zapisania

- PR number,
- state/draft/merged,
- head branch,
- exact head SHA,
- timestamp capture.

**Mismatch nie jest automatycznie naprawiany. Niezrecenzowany SHA = HOLD/ABORT.**

---

# B. Migration package 001–014 — names + checksums

Cel: potwierdzić, że pakiet migracji nie zmienił się od zatwierdzonego Gate 14A.

- [ ] Istnieją dokładnie kolejne migracje `001`–`014` w zatwierdzonym pakiecie Gate 14A.
- [ ] Nie ma luki numeracyjnej.
- [ ] Nie ma duplikatu numeru.
- [ ] Nazwy migracji są zgodne z migration plan.
- [ ] Checksums SHA-256 są zgodne z migration plan.
- [ ] Historyczne migracje `001`–`014` nie zostały edytowane po zatwierdzeniu bez formalnego review.
- [ ] `015` z Gate 14C pozostaje poza tym baseline, dopóki E4.3 nie przeprowadzi formalnego review/promocji.

### Wymagane wykonanie

Uruchomić **wyłącznie** migrator w trybie plan/read-only na zatwierdzonym source SHA:

`npm run migrate:v3 -- --plan`

albo równoważny zatwierdzony wrapper plan mode, bez `MIGRATOR_DATABASE_URL` wskazującego produkcję i bez apply.

- [ ] Plan kończy się sukcesem.
- [ ] Plan pokazuje wyłącznie oczekiwane migracje.
- [ ] Nie wykonuje DDL/DCL/DML.

**Unknown migration / checksum mismatch / altered historical migration = ABORT.**

---

# C. Fresh Gate 13 active-state collector

Cel: udowodnić, że po freeze nie istnieje nowy aktywny stan, który mógłby zostać uszkodzony przez dalsze kroki.

Uruchomić fresh, read-only Gate 13 collector.

- [ ] `readOnly = true`.
- [ ] capture timestamp jest po rozpoczęciu E4.0.
- [ ] normal application writer nie został uruchomiony przez collector.
- [ ] brak nowych aktywnych canonical gameplay states wymagających ochrony.
- [ ] brak aktywnych auth/session/reset/registration states sprzecznych z maintenance contract.
- [ ] brak konkurencyjnych transakcji/writerów blokujących dalsze prace.
- [ ] legacy/quarantine state jest zgodny z wcześniejszą klasyfikacją albo każda różnica została wyjaśniona.

### Twardy ABORT

- nowa aktywna canonical rozgrywka,
- aktywny mutation writer,
- nieoczekiwany competing transaction,
- fresh state niezgodny z freeze.

---

# D. Fresh Gate 14 AS-IS security / DB permissions collector

Cel: zebrać ostatni snapshot stanu bezpieczeństwa **przed** remediation.

Uruchomić fresh Gate 14 collector w transakcji read-only.

- [ ] `readOnly = true`.
- [ ] capture timestamp jest po E4.0.
- [ ] zapisany jest current DB role name bez credential values.
- [ ] zapisane są role attributes booleans.
- [ ] zapisane są DB/schema privilege booleans.
- [ ] zapisane są aggregate table/sequence ownership/privilege counts.
- [ ] zapisane są safe runtime config booleans.
- [ ] żadne secret value, URL credential, ciphertext ani PII nie trafiają do artifactu/logów.

Oczekuje się, że fresh AS-IS może nadal pokazywać stare blockery Gate 14 (np. broad current role). To jest baseline przed remediation, nie powód do ich „naprawiania” w E4.1.

**Collector write / secret leakage / niezgodność trybu read-only = ABORT.**

---

# E. Backup — fresh pre-mutation anchor

Cel: posiadać aktualny punkt przywrócenia wykonany po freeze, przed pierwszą zmianą.

- [ ] Fresh backup/snapshot został wykonany po E4.0 i przed pierwszą mutacją.
- [ ] Zapisano provider backup identifier / timestamp bez sekretów.
- [ ] Backup jest kompletny dla produkcyjnej DB objętej cutoverem.
- [ ] Retencja backupu obejmuje cały planowany maintenance/cutover + rollback window.
- [ ] Nie polegamy wyłącznie na „ostatnim automatycznym backupie”, jeśli jego czas poprzedza freeze w sposób pozostawiający lukę danych.

**Brak świeżego backupu = ABORT.**

---

# F. Restore rehearsal / restore validation

Cel: udowodnić, że backup jest praktycznie odtwarzalny, nie tylko istnieje.

- [ ] Restore rehearsal/validation jest aktualne zgodnie z wcześniejszym Gate 4.
- [ ] Restore destination nie jest produkcyjną DB.
- [ ] Odtworzenie nie nadpisuje żadnego istniejącego środowiska bez jawnej autoryzacji.
- [ ] Restore kończy się sukcesem.
- [ ] Można połączyć się z restored DB read-only.
- [ ] Schema/table presence jest zgodne z backupem.
- [ ] Row-count/integrity checks wykonują się na restore.
- [ ] Legacy crypto decryptability może być zweryfikowana na restore bez ujawniania plaintextów.

**Restore nieudany / niezweryfikowany = ABORT.**

---

# G. Row-count + integrity reconciliation

Cel: potwierdzić spójność danych źródłowych i backup/restore baseline.

- [ ] Fresh production row counts pobrane read-only po freeze.
- [ ] Restore row counts pobrane read-only.
- [ ] Porównanie obejmuje wszystkie tabele objęte wcześniejszym preflightem.
- [ ] Expected differences = 0, chyba że wcześniej udokumentowany techniczny wyjątek ma formalne uzasadnienie.
- [ ] FK/orphan/integrity checks pozostają zgodne z wcześniejszym baseline.
- [ ] Identity collision/duplicate conditions nie pogorszyły się.
- [ ] Nie pojawiły się nowe unexplained rows po freeze.

**Nieuzasadniona różnica row count/integrity = ABORT.**

---

# H. Gate 11 legacy decryptability — fresh confirmation

Cel: przed jakąkolwiek zmianą keyringu/sekretów jeszcze raz udowodnić, że istniejące dane v1 są czytelne.

- [ ] Private messages: wszystkie oczekiwane encrypted rows decryptable pod obecnym v1 material.
- [ ] Attachments: wszystkie oczekiwane encrypted rows decryptable pod obecnym v1 material.
- [ ] MFA: stan zgodny z actual DB; jeśli 0 rows, wynik jawnie `N/A / 0`.
- [ ] Probe nie loguje plaintextów.
- [ ] Probe nie loguje secret values/fingerprints.
- [ ] Probe nie modyfikuje ciphertextów.
- [ ] Probe jest read-only.

Dodatkowo:

- [ ] dokładny runtime-vs-restore ciphertext SHA comparison jest wykonany, jeśli evidence technicznie dostępne;
- [ ] jeśli exact SHA comparison nadal nie jest możliwe, limitation jest jawnie zapisana i nie jest przedstawiana jako udowodniona identyczność.

**Decrypt failure choć jednego oczekiwanego rekordu = ABORT.**

---

# I. Gate 14B / 14C / 14D design package integrity

Cel: potwierdzić, że execution będzie opierał się na zatwierdzonych projektach, a nie na ad-hoc instrukcjach.

- [ ] `32-GATE-14B-LEAST-PRIVILEGE-ROLE-DESIGN.md` dostępny i niezmieniony bez review.
- [ ] `33-GATE-14B-ROLE-PROVISIONING-AND-ACL-TEMPLATE.sql` dostępny.
- [ ] `34-GATE-14B-LEAST-PRIVILEGE-READONLY-VERIFIER.sql` dostępny.
- [ ] `35-GATE-14C-CRYPTO-KEYRING-V1-V2-DESIGN.md` dostępny.
- [ ] `36-GATE-14C-PROPOSED-MIGRATION-015-CRYPTO-KEY-VERSIONS.sql` nadal `DO NOT EXECUTE` do E4.3 review.
- [ ] `37-GATE-14C-CRYPTO-VERSION-READONLY-VERIFIER.sql` dostępny.
- [ ] `38-GATE-14C-REKEY-RUNBOOK-AND-PASS-CRITERIA.md` dostępny.
- [ ] `39-GATE-14D-PRODUCTION-SECURITY-CONFIG-DESIGN.md` dostępny.
- [ ] `40-GATE-14D-PRODUCTION-ENV-CONTRACT.md` dostępny.
- [ ] `41-GATE-14D-READONLY-ENV-VERIFIER.mjs` dostępny.
- [ ] `42-GATE-14D-APPLIED-PASS-AND-CUTOVER-CHECKLIST.md` dostępny.

**Brak artefaktu lub nieprzejrzana zmiana = HOLD.**

---

# J. Render / environment baseline — presence/status only

Cel: zapisać stan konfiguracji bez ujawniania values.

- [ ] Service name/environment zapisane.
- [ ] maintenance/mutation lock nadal aktywny.
- [ ] `Auto-Deploy = Off`.
- [ ] brak deploy/restart/rollback od capture E4.0.
- [ ] env nie został zmieniony od freeze.
- [ ] runtime nadal używa dotychczasowego AS-IS credential przed E4.4.
- [ ] nie ustawiono `MIGRATOR_DATABASE_URL` w normalnym runtime.
- [ ] nie ustawiono nowych v2 crypto roots przed E4.3/E4.7.
- [ ] `AUTH_SECRET` nie został obrócony.
- [ ] żaden screenshot/log nie ujawnia sekretów.

**Każda nieautoryzowana zmiana env/deploy podczas E4.1 = ABORT i restart E4.0/E4.1 baseline.**

---

# K. Evidence manifest E4.1

Po zebraniu dowodów utworzyć jeden manifest zawierający wyłącznie bezpieczne identyfikatory:

- timestamp start/end E4.1,
- exact source SHA,
- PR #26 state,
- migration plan identifier/checksum set,
- fresh Gate 13 run/job/artifact IDs,
- fresh Gate 14 run/job/artifact IDs,
- backup identifier/timestamp,
- restore rehearsal identifier/timestamp,
- row-count reconciliation result,
- Gate 11 decryptability result,
- listę użytych dokumentów 14B/14C/14D,
- operator decision: `COMPLETE` albo `ABORT/HOLD`.

Manifest nie może zawierać:

- haseł,
- tokenów,
- connection strings,
- encryption keys,
- plaintext wiadomości,
- ciphertextów,
- danych osobowych.

---

# L. Decyzja końcowa E4.1

## E4.1 = COMPLETE

Tylko jeśli **wszystkie** poniższe są potwierdzone:

1. E4.0 nadal obowiązuje bez naruszenia freeze.
2. Source/PR SHA jest zamrożony i zatwierdzony.
3. Migrator `--plan` i migration names/checksums są exact.
4. Fresh Gate 13 read-only evidence jest akceptowalne.
5. Fresh Gate 14 AS-IS read-only evidence zostało zapisane.
6. Fresh backup istnieje.
7. Restore validation jest aktualne i poprawne.
8. Row-count/integrity reconciliation jest zgodne.
9. Fresh Gate 11 decryptability jest poprawne.
10. Gate 14B/14C/14D design package jest kompletny.
11. Render/environment freeze nie został naruszony.
12. Evidence manifest E4.1 został zapisany.

Wtedy można rozpocząć:

**E4.2 — strict-ACL probes removal.**

## E4.1 = HOLD / ABORT

Jeśli dowolny twardy warunek nie jest spełniony:

**STOP.**

Nie wolno rozpoczynać:

- E4.2 code prerequisite,
- E4.3 keyring implementation,
- provisioning ról,
- migratora apply,
- DDL/DCL/DML,
- zmian `DATABASE_URL`,
- zmian secrets,
- rekey,
- produkcyjnego deployu.

Po każdym naruszeniu freeze lub zmianie source SHA wymagającej nowego baseline należy ponownie ocenić E4.0 i powtórzyć odpowiednie dowody E4.1.
