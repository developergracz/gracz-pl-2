# ETAP 3 — DDL V3 REVIEW

Data: 29.08.2026
Status: **REVIEW — DOZWOLONE GENEROWANIE I PRZEGLĄD EXECUTABLE DDL / PRODUKCJA NO-GO**

## 1. Cel

Formalny przegląd planu DDL PostgreSQL V3 po zamknięciu Bramki 11 crypto decryptability.

Review nie autoryzuje wykonania DDL na produkcji. Jego celem jest:
- zamknąć decyzje techniczne pozostawione przez ETAP 2,
- ustalić naming/coexistence V3,
- usunąć ryzyka z kontraktów Game Platform / Outbox / Idempotency,
- ustalić bezpieczną strategię Messaging po potwierdzeniu decryptability,
- wskazać, które skrypty mogą być już przygotowane do review,
- rozdzielić `READY TO DRAFT` od `READY TO EXECUTE`.

Źródła normatywne:
- `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md`,
- Iteracje PostgreSQL V3 2–7,
- `03-MIGRACJA/04-PLAN-DDL-MIGRACJI-ITERACJA-2.md`,
- `03-MIGRACJA/13-WRITER-READER-INVENTORY.md`,
- `03-MIGRACJA/14-WORKER-EVENT-REALTIME-INVENTORY.md`,
- `03-MIGRACJA/15-CRYPTO-COMPATIBILITY-INVENTORY.md`,
- `03-MIGRACJA/16-CRYPTO-DECRYPTABILITY-SMOKE-TEST.md`,
- `03-MIGRACJA/17-RUNTIME-CRYPTO-SELFCHECK.md`.

## 2. Stan wejściowy

Potwierdzone:
- backup: PASS,
- restore test: PASS,
- 28/28 tabel odtworzonych,
- DQ-001: decision-ready / quarantine,
- DQ-002: decision-ready / legacy-test identities,
- writer/reader inventory: 28/28 kodowo zmapowane,
- worker/event/realtime inventory: zmapowane kodowo,
- crypto decryptability: **PASS**,
- private messages: 5/5 decrypt success,
- attachments: 2/2 decrypt success,
- MFA: 0 rekordów / N/A.

Pozostają otwarte środowiskowe gates przed wykonaniem produkcyjnym.

## 3. Decyzja DDL-001 — namespace V3

**DECYZJA: stosujemy osobny schema namespace `v3`.**

Przykłady:
- `v3.users`,
- `v3.game_matches`,
- `v3.outbox_events`,
- `v3.private_messages`.

Nie stosujemy `_v3` jako podstawowej strategii naming.

Uzasadnienie:
- brak kolizji z tabelami legacy w `public`,
- jednoznaczny ownership podczas expand/backfill,
- prostszy rollback przed cutover,
- łatwiejsze audytowanie, które zapytanie korzysta z V3,
- brak tymczasowego chaosu nazw typu `tournaments_v3`,
- możliwość późniejszego kontrolowanego contract/cutover bez niszczenia legacy w fazie expand.

W pierwszej fazie nie zmieniamy `search_path` aplikacji globalnie. V3 będzie adresowane jawnie.

## 4. Decyzja DDL-002 — Game Match Events

Projekt Iteracji 2 zawierał jednocześnie:
- `UNIQUE(match_id, sequence_no)`,
- `UNIQUE(match_id, aggregate_version)`.

**DECYZJA REVIEW:**
- pozostaje twarde `UNIQUE(match_id, sequence_no)`,
- `aggregate_version` pozostaje obowiązkowe i dodatnie,
- `(match_id, aggregate_version)` staje się indeksem nieunikalnym, nie UNIQUE.

Powód: jedna mutacja agregatu może legalnie wygenerować więcej niż jedno zdarzenie domenowe przy tej samej wersji agregatu. Unikalność aggregate version na event table sztucznie ograniczałaby ten kontrakt.

Jeżeli konkretna implementacja przyjmie dokładnie jeden event na wersję, może egzekwować to w warstwie command/service, ale fundament V3 nie powinien blokować poprawnego multi-event command.

## 5. Decyzja DDL-003 — fencing / split-brain

**DECYZJA REVIEW: egzekwujemy fencing dwuwarstwowo.**

1. `v3.match_actor_leases.fencing_token` jest monotoniczny per `match_id`.
2. `v3.game_matches` otrzymuje `last_fencing_token BIGINT NOT NULL DEFAULT 0`.

Każda mutacja meczu musi w jednej transakcji:
- zweryfikować aktualny lease dla `match_id`,
- zweryfikować `owner_instance_id`,
- zweryfikować dokładny `fencing_token`,
- zweryfikować `lease_expires_at > NOW()`,
- wykonać CAS po `version`,
- odrzucić token starszy niż `last_fencing_token`,
- po sukcesie ustawić `last_fencing_token` na użyty token.

Samo `last_fencing_token` bez weryfikacji aktualnego lease nie jest wystarczające; stary writer nie może wygrać wyścigu tylko dlatego, że nowy owner nie zdążył jeszcze zapisać pierwszej mutacji.

## 6. Decyzja DDL-004 — Outbox stale claims

AS-IS nie posiada Transactional Outbox. W V3 status `processing` musi być odzyskiwalny po crashu workera.

**DECYZJA REVIEW:**
- pozostają `claimed_by` i `claimed_at`,
- dodajemy partial index dla rekordów `processing` po `claimed_at`,
- runtime publisher posiada jawny reclaim timeout,
- rekord `processing` starszy niż timeout może zostać atomowo przejęty/requeued,
- reclaim zwiększa `attempt_count`,
- reclaim nie może publikować dwóch niezależnych efektów bez idempotentnego event ID po stronie konsumenta.

Timeout jest parametrem runtime/ops, nie stałą semantyką domenową zaszytą w CHECK.

Dodatkowo executable DDL powinien mieć consistency CHECK:
- `published` => `published_at IS NOT NULL`,
- `processing` => `claimed_by IS NOT NULL AND claimed_at IS NOT NULL`.

## 7. Decyzja DDL-005 — Idempotency failed semantics

**DECYZJA REVIEW:**
- `completed` jest terminalnym sukcesem i przechowuje bezpieczny replay response,
- `failed` jest terminalnym, deterministycznym wynikiem biznesowym, który może zostać bezpiecznie odtworzony dla tego samego `request_hash`,
- transient infrastructure failure nie jest commitowany jako terminalne `failed`, jeżeli efekt biznesowy nie został zatwierdzony,
- zawieszony `processing` musi mieć możliwość reclaim/retry po kontrolowanym timeout,
- ten sam `(context,idempotency_key)` z innym `request_hash` pozostaje konfliktem.

Executable DDL powinien dodać pole pozwalające odróżnić aktywne od wygasłego `processing` (`processing_expires_at` albo równoważny kontrakt czasowy). Konkretny naming zostanie użyty konsekwentnie w `01-v3-foundation.sql`.

## 8. Decyzja DDL-006 — Messaging crypto migration

Bramka 11 potwierdziła decryptability bieżącego ciphertextu.

**DECYZJA REVIEW: pierwsza migracja Messaging zachowuje istniejący ciphertext zamiast wykonywać masowy decrypt+reencrypt.**

W V3 należy jawnie zapisać format/version crypto dla historycznych rekordów, aby:
- nie wykonywać niepotrzebnej transformacji danych wrażliwych,
- zachować rollbackability,
- nie uzależnić strukturalnego backfillu od jednorazowego re-encryption job,
- umożliwić późniejszą kontrolowaną rotację/re-encryption jako oddzielną operację.

Plaintext nie trafia do migration logs, reconciliation ani GitHub.

## 9. Decyzja DDL-007 — CREATE TYPE / ENUM

**DECYZJA REVIEW: pierwsza wersja executable DDL preferuje `VARCHAR` + jawne CHECK zamiast PostgreSQL ENUM dla stanów domenowych.**

Powód:
- łatwiejsza ewolucja statusów,
- prostszy expand/rollback,
- mniejsze ryzyko blokujących zmian typu przy kolejnych iteracjach,
- zgodność z dotychczasowym projektem Iteracji 2–7.

## 10. Decyzja DDL-008 — rozszerzenia PostgreSQL

Executable DDL nie może zakładać nowych extensions bez preflight.

UUID pozostaje generowany po stronie aplikacji/migration runnera tam, gdzie nie potwierdzono wymaganej funkcji DB. Jeżeli później zostanie zatwierdzone `pgcrypto`/`gen_random_uuid()`, jest to osobna jawna decyzja środowiskowa.

## 11. Kolejność skryptów — REVIEW

Podział z `04-PLAN-DDL-MIGRACJI-ITERACJA-2.md` zostaje utrzymany:

1. `00-precheck-readonly.sql`
2. `01-v3-foundation.sql`
3. `02-identity-audit-v3.sql`
4. `03-game-platform-v3.sql`
5. `04-tournament-v3.sql`
6. `05-messaging-chat-v3.sql`
7. `06-moderation-v3.sql`
8. `07-newsletter-v3.sql`
9. `08-indexes-and-constraints.sql`
10. `09-verification.sql`

## 12. Co jest READY TO DRAFT

Można już przygotować bez wykonywania na produkcji:
- `00-precheck-readonly.sql`,
- `01-v3-foundation.sql`,
- CREATE-only część `02-identity-audit-v3.sql`,
- CREATE-only część `03-game-platform-v3.sql`,
- kolejne context DDL jako review-only artifacts.

Wszystkie te skrypty muszą być oznaczone `REVIEW ONLY / DO NOT RUN ON PRODUCTION` do czasu finalnego GO.

## 13. Co NIE jest READY TO EXECUTE

Produkcja pozostaje NO-GO z powodu otwartych bramek:
- fresh schema snapshot/diff,
- środowiskowe domknięcie writer/process/job inventory (Bramki 9–10),
- active-state/drain/cutover assessment,
- credentials rotation / least privilege / migration role,
- capacity i lock-risk confirmation,
- finalny reconciliation rerun,
- maintenance/rollback/feature-flag readiness,
- końcowy GO/NO-GO.

## 14. Zmiany względem wcześniejszego planu

Review zamyka następujące wcześniejsze `TBD`:
- naming: **schema `v3`**,
- game event version uniqueness: **nieunikalny aggregate-version index**,
- fencing: **lease validation + `last_fencing_token`**,
- stale outbox claim recovery: **obowiązkowy reclaim contract**,
- idempotency failed semantics: **terminal deterministic failure vs transient rollback/retry**,
- Messaging: **preserve ciphertext first, re-encryption oddzielnie**,
- status types: **VARCHAR + CHECK**.

## 15. Wynik REVIEW

**DDL V3 — REVIEW: PASS DO GENEROWANIA SKRYPTÓW.**

Nie oznacza to `PREFLIGHT GO` ani zgody na produkcyjne `CREATE/ALTER/DROP`.

Następny wykonawczy artefakt:

**`00-precheck-readonly.sql` + `01-v3-foundation.sql` jako review-only executable drafts.**
