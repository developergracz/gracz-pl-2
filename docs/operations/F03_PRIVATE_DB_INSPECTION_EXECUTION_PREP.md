# P0 execution handoff — 2026-10-16 (supersedes the preparation status below)

[Current mandate](https://github.com/developergracz/gracz-pl-2/pull/263#issuecomment-6219329181).
No new general audit. The Owner's external /32 exception and already verified
production registry 001–004 (4/4 MATCH), no F-03 objects/seal, and counts 2/32/1 are
accepted evidence. Dump-list PASS is not restore PASS. The following is the one
current operator procedure; the older private-route section is historical only.

## One local action now

Run `contact-api/operations/Restore-F03.ps1` from this PR's exact reviewed HEAD
(HEAD and CI are recorded in the PR description), in a normal Windows PowerShell
session without a transcript, not as administrator:

```powershell
powershell.exe -NoProfile -File "$HOME\Downloads\Restore-F03.ps1"
```

Save the reviewed standalone script to that path first. Do not pipe downloaded
text to Invoke-Expression. Default input is the Owner's existing
`C:\Users\user\GraczDR\gracz_render_20261016_174133.dump`; default PG tools
are `C:\Program Files\PostgreSQL\18\bin`. If installed elsewhere, pass only
the local `-PgBin` path. No DB password, DATABASE_URL, production secret or dump
is requested or transmitted. No new service, plan or recurring cost.

The masked local GUI requests a Render API key solely to GET the pinned database,
remove exactly `GRACZ F03 TEMP / 193.106.209.40/32`, and GET-confirm `[]`.
The key stays in process memory; do not paste it into chat or a command argument.
Unexpected target or rules abort before PATCH. API uses verified HTTPS with
redirects disabled. Closing this rule is explicitly authorized by mandate F while
waiting for the operator session; it does not stop the API's internal DB access.
If already closed, verification is idempotent. If there is no API-key access,
close the rule in the Render database access settings and run `-RestoreOnly`;
that mode reports allowlist NOT_CHECKED, requiring connector readback. The
current connector lacks PATCH-Postgres capability and the cloud has no API key.

The script uses a unique protected local directory, generated local SCRAM password,
new PG18 cluster with locale C and port 55432, explicit loopback/role/database,
and rejects an occupied port. It does not reuse or stop 5432 or any previous
cluster. It clears inherited libpq settings, checks server data_directory/identity,
restores the entire custom archive in one transaction with no owner/ACL/tablespace
replay, verifies 2 contacts / 32 events / 1 confirmed event, last-event timestamp,
exact four checksums and absence of F-03, then stops only its cluster and removes
temporary password files. Local loopback-only ssl=off is not a production TLS
policy or change. The private restored files remain ACL-protected for operator
review; they contain production data and must not be uploaded. After approved
retention, delete only this script's stopped run directory; retain the original dump.

Return only `result.json` (sanitized counts/hash/status), never server logs,
dump, data directory or secret files. PASS in this report means local full-dump
restoration and metadata/count checks, not offsite recovery, application decrypt,
escrow, role/ACL fidelity, live subscriber count or production migration GO.
RTO field is measured restore+validation time, not whole-service RTO.
The script never reads escrow keys and does not claim their recoverability.

## Exact next production sequence — gated, not executed

1. Preserve accepted read-only production evidence. Canonical Node/pg registry
   SHA for exactly the four confirmed rows is
   `12bf844cedef7c9b3dd4dba578f50435b9a763996c56abed3934f269e9494f1f`.
   Derived from reviewed source checksums; not a new production query.
2. After actual restore: independently verify private offsite/PITR/export recovery,
   contact-encryption and newsletter signing/hash key recovery and decrypt.
   No such evidence is currently available to Codex. Never print/read keys into chat.
3. Complete the retirement certificate: no old/queued/manual/external writers,
   DB-session cross-check plus provider uncertain DOI disposition and last-write
   boundary. Current inert deployment and one confirmed event do not prove these.
   32 events are preserved; no automatic replay, reset or assumption of two active
   subscribers. No live Resend query/send was made in this task.
4. Pin final integrated SHA and matching CI; populate the existing
   `newsletter-migration-evidence.example.json` outside the checkout with real
   references/hashes, Owner+DB GO, target and <=1-hour timestamps. Do not mark
   missing gates verified. Keep both autoDeploy OFF and F-02.
5. Use original `newsletter-migrator.mjs --preflight <receipt>`, then only with
   specific production GO `--execute <receipt>` and
   `NEWSLETTER_MIGRATION_CONFIRM=INSTALL_NEWSLETTER_SCHEMA`.
   Secret injection must be private. External target is
   `dpg-db38btt9fdbs73aadohg-a.frankfurt-postgres.render.com:5432`,
   DB/user as in the mandate. URL must have no query/fragment.
   Previously accepted psql sslmode=require does NOT satisfy the migrator's
   rejectUnauthorized=true requirement. Obtain verified CA+hostname trust;
   otherwise STOP for explicit policy review, never silently weaken the original.
   No raw candidate SQL, CONTACT005, global migrator shortcut or automatic retry.
6. With no new writer yet, separately authorize HISTORY with an immutable UTC
   cutoff after `2026-10-15T19:29:31.474Z` and <= actual installation seal.
   Use existing `importNewsletterHistory(database,{cutoverBefore:new Date(cutoff),
   writersStopped:true})` from `persistence/newsletter-cutover.mjs`, with the
   same verified target/TLS and receipt checks. Verify same-cutoff repeat returns
   zero and 2/32/1/events remain unchanged; inspect exclusions/unknown sends.
   This imports reservations, not consent rewriting or new active subscriptions.
   No production wrapper is enabled before these inputs and approvals exist.
7. Only then deliver pinned integrated API with intake paused, safe build/start,
   readiness schemaReady=true/intakePaused=true, then matching frontend,
   separate live-send test GO and enable GO. Keep original F-02 as rollback;
   never restart legacy writers. Restore autoDeploy only by separate decision.
8. Close any separately reopened /32 immediately after that approved window;
   confirm control-plane allowlist [] again. The current script never opens it.

**Current production state:** RESTORE HOLD; F03 NOT APPLIED (accepted mandate
evidence); API MAINTENANCE; NEWSLETTER HOLD; external DB allowlist TEMP
(control-plane observed this turn). No production DB connection or mutation,
mail or deploy has been performed. The only prepared production mutation is
closing the existing temporary allowlist through the Owner's local API session.

---

## Historical private-route preparation (superseded by the mandate above)

# F-03 private DB inspection — execution preparation, 2026-10-16

**BLOCKED.** Brak potwierdzonego, istniejącego kanału operatora do uruchomienia
osobnego procesu w prywatnej sieci Render bez dodatkowych kosztów.
To dokument przygotowania; nie upoważnia do połączenia z bazą.
Migracja F-03, import i aktywacja: **HOLD**.

## Ustalenia i dowody

Mandat: [PR #262, komentarz 6214597223](https://github.com/developergracz/gracz-pl-2/pull/262#issuecomment-6214597223).
Baza przeglądu: `f908d5d68812614a99da136587a31a9ac790a503`.
Przegląd dotyczy wyłącznie kanału wykonania oraz inspektora, nie powtarza audytów B1/B2/F-02.

- Odczyt konfiguracji API `srv-db00m2u7bikc73fnsje0`: Free, Frankfurt,
  jedna instancja, autoDeploy OFF, root repo, Build
  `sh contact-api/maintenance/build.sh`, Start
  `sh contact-api/maintenance/start.sh`. Pole `sshAddress` nie dowodzi dostępu.
- [Free limitations](https://render.com/docs/free): brak Shell/SSH i one-off jobs.
  Free pozwala na prywatny ruch wychodzący, ale nie daje kanału uruchamiania komend.
  [SSH](https://render.com/docs/ssh): ephemeral shell wymaga płatnej usługi i jest
  dodatkowo rozliczany. [One-off jobs](https://render.com/docs/one-off-jobs)
  również są rozliczane. Żadna z tych alternatyw nie spełnia mandatu.
- F-02 uruchamia wyłącznie inert HTTP server; build robi tylko syntax check,
  bez npm install. Nie ma uprawnionego mechanizmu do uruchomienia drugiego procesu.
  Nie dodawać endpointu, hooka ani kodu child_process do F-02.
- Dowód wcześniejszego rollout: [6214426307](https://github.com/developergracz/gracz-pl-2/pull/262#issuecomment-6214426307):
  inert LIVE `b52202daf9cc7779989cefcd457ead16b3b8da7d`.
  Ten artifact poprzedza inspektor; nie zakładać obecności jego nowych plików ani pg.
  Poprzedni [spis usług](https://github.com/developergracz/gracz-pl-2/pull/262#issuecomment-6214506683)
  wskazuje statyczne preview i zawieszoną usługę testową, bez wskazanego operatora.
  Nie ponawiano tego audytu. Bieżący list_services wymagał wyboru workspace;
  nie uznano błędu narzędzia za dowód pustego workspace.
- Odczyt DB control plane: `dpg-db38btt9fdbs73aadohg-a`, Frankfurt,
  PostgreSQL 18, available, plan `0.1c-256mb`, external allowlist `[]`.
  Historyczny dokument DR mówił o Free; bieżący plan jest płatny.
  Z tego nie wynika sprawdzony punkt PITR, backup ani restore PASS.
- Nie pobierano sekretów. Historyczna obecność DATABASE_URL w aplikacji nie
  dowodzi dostępności ani poprawnej tożsamości w przyszłym procesie operatora.
  Lokalny Codex nie jest w sieci Render; brak skonfigurowanego VPN/TCP route.

## Inspektor i granice kontroli

R1 sprawdzał nazwę DB dopiero w wyniku i nie przerywał odczytu przy mismatch.
R2 wymaga przed połączeniem zgodnego host/port/database/role, odrzuca URL query
i fragment, po połączeniu sprawdza database/role/PG18/read-only przed metadata.
Expected host musi pochodzić z niezależnie potwierdzonego przypisania do ID Render,
nie z bezrefleksyjnego przepisania tego samego DATABASE_URL.

Zachowuje BEGIN READ ONLY i ROLLBACK, limity czasu, jeden klient, brak retries.
Odczytuje tylko cztery wskazane relacje, globalny ledger i agregat sesji.
Odrzuca nieoczekiwany typ/trwałość relacji i dowolny tekst w ledgerze.
Nie jest pełnym schema verifierem (nie sprawdza kolumn/constraintów ani cutover seal).
Brak ledgera daje registryPresent=false i pozostawia HOLD, nie gotowość migracji.
Błędy CLI, brak pg i błędy konfiguracji dają wyłącznie stały kod.
Null state sesji oznacza niepełną widoczność; nawet pełna widoczność tej migawki
nie dowodzi zatrzymania wszystkich writerów ani braku przyszłego restartu.

R2 wymaga weryfikacji certyfikatu TLS. Wewnętrzne certyfikaty Render mogą nie
spełniać tego warunku (patrz kanoniczny DR runbook). Nie używać
NODE_TLS_REJECT_UNAUTHORIZED=0 ani rejectUnauthorized=false. Jeśli zatwierdzony
trust chain/hostname nie działa, STOP; odrębny przegląd modelu zaufania jest
wymagany przed zmianą zabezpieczeń. Nie wykonano prób TLS ani połączenia z DB.

## Jedna procedura operatora — warunkowa, obecnie STOP na kroku 1

1. **STOP teraz:** Owner musi wskazać już istniejący, uprawniony kanał operatora
   w tym samym workspace/Frankfurcie, zdolny uruchomić oddzielny proces bez
   restartu HTTP i nowych opłat. Nie ma go w zebranych dowodach.
   Nie tworzyć joba/instancji, nie odwieszać testowej usługi, nie zmieniać planu.
   Samo GO nie usuwa braku kanału.
2. Gdy kanał jest udokumentowany: osobne Owner READ-ONLY INSPECTION GO z oknem,
   operatorem, DB ID, dokładnym commit SHA poprawki, digestem źródła i zaufaniem TLS.
   Zachować F-02 i oba autoDeploy OFF. Nie używać build/predeploy/start.
3. W odizolowanym katalogu operatora dostarczyć pliki z zatwierdzonego SHA
   (SHA w DRAFT PR zawierającym ten plik) i sprawdzić digest inspektora:
   `9267e37762953c059e287508d934fc7c0e9d6bbc49496616fa90e626f9d580ec`.
   Nie wdrażać tego SHA do API tylko po to, aby uzyskać plik.
   Wcześniej zapewnić zatwierdzony Node >=20 i istniejącą zależność pg zgodną
   z contact-api/package.json; nie zakładać jej obecności w F-02.
   Bez połączenia z DB sprawdzić `node --check contact-api/operations/f03-readonly-inspect.mjs`
   oraz, z contact-api, `node --input-type=module -e "await import('pg')"`.
4. Operator bez ujawniania wartości potwierdza przypisanie hosta wewnętrznego,
   portu 5432, nazwy i roli do DB ID w control plane. Istniejący mechanizm sekretów
   ma udostępnić DATABASE_URL temu procesowi. Ustawić niezależnie zweryfikowane
   F03_EXPECTED_DB_HOST, F03_EXPECTED_DB_PORT, F03_EXPECTED_DB_NAME,
   F03_EXPECTED_DB_ROLE. Nie kopiować URL do argumentów, historii, PR ani logów.
   Preferować istniejącą rolę z CONNECT i SELECT na ledgerze; nie tworzyć roli
   ani GRANTów. Brak uprawnień oznacza STOP; nie podnosić uprawnień automatycznie.
5. Dopiero po krokach 1–4 i GO, w chronionej sesji bez tracing/preloads:
   `umask 077`, następnie
   `env -u NODE_OPTIONS -u NODE_PATH node contact-api/operations/f03-readonly-inspect.mjs > f03-metadata.json`.
   Wynik pozostaje w katalogu operatora poza repo. Sprawdzić kod wyjścia 0,
   R2, targetMatchesExpected=true, registryPresent i kompletność widoczności.
   Przekazać do przeglądu tylko ten ograniczony JSON oraz czas UTC, źródłowy SHA,
   DB ID i referencję zgody. Nie przekazywać stderr innych narzędzi lub env dump.
6. Przy błędzie, braku zaufania TLS, mismatch lub przerwaniu: zatrzymać wyłącznie
   proces inspektora i zamknąć sesję; nie restartować HTTP, nie ponawiać automatycznie.
   ROLLBACK/disconnect kończy transakcję. Usunąć tymczasowy katalog po bezpiecznym
   przejęciu wyniku. Brak zmian Render oznacza brak rollbacku konfiguracji.
   Nie przywracać starego business API. Bez cron, harmonogramu lub trwałej usługi.

## Co pozostaje przed uruchomieniem newslettera

Istnieją: inert rollout i wcześniejszy spis usług, runbooki DR/escrow oraz testy
syntetyczne. Nie są to dowody produkcyjnego restore.
Brak potwierdzonych: okna PITR i odzyskiwalnego backup/export, niezależnego restore
z pomiarem RPO/RTO i decrypt, odzyskania contact encryption oraz newsletter
signing/hash secrets z escrow, pełnego all-writer retirement/last-write boundary,
inwentaryzacji uncertain DOI i granicy importu. Odczyt sesji tego nie zastąpi.
Patrz docs/operations/BACKUP_DISASTER_RECOVERY_R1_2026-10-09.md,
contact-api/CONTACT_DATA_ENCRYPTION_SECRET_ESCROW_RUNBOOK.md i
contact-api/NEWSLETTER_F03_RELEASE.md.

Po rozwiązaniu kanału: osobno zatwierdzony odczyt i ocena schema/registry,
uzupełnienie powyższych dowodów, finalny release SHA/CI, oddzielne GO na
merge, migrację F-03/import, deploy nowego paused API i enable z kontrolą.
Panel OWNER/WebAuthn i CONTACT005 nie są warunkiem publicznego B1/B2.

**Werdykt: BLOCKED — najmniejszy blocker: brak istniejącego bezkosztowego
kanału wykonania w prywatnej sieci Render. F-03 migration/import/activation HOLD.**
