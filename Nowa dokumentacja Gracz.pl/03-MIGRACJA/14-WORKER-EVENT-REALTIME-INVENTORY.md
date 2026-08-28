# ETAP 3 — Worker / Event / Realtime Inventory

Data: 28.08.2026
Status: **WYKONANE DLA AKTUALNEGO RUNTIME / BRAMKA 10 = WARNING DO CZASU KORELACJI ŚRODOWISKA**

## 1. Cel

Zinwentaryzować istniejące background jobs, workers, retry paths, mail delivery, realtime, cleanup/retention oraz event side effects, aby przed V3 wiedzieć, co musi zostać przełączone na docelowy Transactional Outbox / broker / worker model.

Kod odniesienia bieżącego runtime: `main` analizowany od stanu `8dee41deea93465f5777de318b5866be898ff237` wraz z kolejnymi commitami dokumentacyjnymi bez zmiany kodu aplikacji.

Nie wykonano zmian produkcyjnych.

## 2. POTWIERDZONE — model procesu AS-IS

`modern/checkers-engine/package.json` ma pojedynczy runtime script:

`node --require ./src/pg-secure-preload.cjs src/main.js`

W przeanalizowanym drzewie aktualnego `modern/checkers-engine/src` nie występuje osobny plik `worker`, `cron` ani `job`, a `main.js` konstruuje wszystkie główne serwisy w jednym procesie Node.

To oznacza, że na poziomie aktualnego repozytorium większość efektów ubocznych jest wykonywana:
- synchronicznie w request path,
- po zapisie do PostgreSQL,
- albo w pamięci procesu.

**Nie jest to jeszcze dowód środowiskowy, że Render nie ma osobnego external cron/job/service.** To wymaga korelacji konfiguracji deployu.

## 3. Realtime inventory

| obszar | implementacja AS-IS | stan | trwałość | związek z DB commit | ryzyko |
|---|---|---|---|---|---|
| Warcaby | `RealtimeHub` + SSE | subscribers `Map` w procesie | brak | `store.save()` kończy się przed `realtime.publish()` | HIGH |
| Tysiąc | `ThousandRealtimeHub` + SSE | subscribers `Map` w procesie | brak | CAS save kończy się przed `publish()` | MEDIUM/HIGH |
| Global Chat | `GlobalChatService.subscribers` + SSE | `Set` w procesie + presence `Map` | brak | INSERT/UPDATE kończy się przed `broadcast()` | HIGH |
| Global Chat presence | `presence Map`, timeout logic na touch | pamięć procesu | brak | niezależne od DB | HIGH przy multi-instance |
| Tournament | brak osobnego realtime hub | request/response + DB | n/d | n/d | LOW dla realtime, HIGH dla concurrency DB |
| Newsletter | brak realtime | n/d | n/d | n/d | LOW |

### Warcaby

`RealtimeHub`:
- zapisuje subskrypcje per `gameId` wyłącznie w pamięci procesu,
- wysyła SSE `game.snapshot` i późniejsze typy eventów,
- nie ma brokera, durable queue ani replay logu.

Mutujące endpointy w `server.js` wykonują wzorzec:
1. mutacja sesji,
2. `await store.save(...)`,
3. `realtime.publish(...)`.

Awaria procesu między 2 i 3 może pozostawić poprawny stan DB bez odpowiadającego broadcastu.

### Tysiąc

`ThousandRealtimeHub`:
- subskrypcje są process-local,
- keepalive co 20 s,
- przy publish ponownie czyta widok gry dla każdego subskrybenta,
- `Promise.allSettled` izoluje błędy poszczególnych klientów.

`thousand-http.js` wykonuje persistence przez service/repository, a następnie `realtime.publish`.

### Global Chat

`GlobalChatService` utrzymuje:
- `subscribers` w `Set`,
- presence w `Map`,
- rate state w `Map`.

Po DB mutation wykonywany jest `broadcast`. Brak durable replay i brak cross-instance coordination.

## 4. Mail delivery inventory

`SecureMailService.send()` wysyła wiadomość **bezpośrednio w request path** do Resend HTTP API.

POTWIERDZONE:
- brak durable mail queue,
- brak osobnego mail worker w aktualnym runtime,
- timeout requestu provider = 10 s,
- network/provider failure jest zwracany jako błąd aplikacyjny,
- po sukcesie zapisywany jest osobny audit event `mail.sent`,
- brak wbudowanego automatycznego retry/backoff queue.

Purpose whitelist obejmuje:
- `newsletter-confirm`,
- `newsletter-welcome`,
- `account-verify`,
- `password-reset`,
- `security-alert`.

### Newsletter

Core newsletter zapisuje stan, po czym wysyła mail i aktualizuje delivery timestamp. `NewsletterLifecycleRecorder` działa dodatkowo przez wrapper best-effort po core operation.

To tworzy trzy niezależne warstwy skutku:
1. core DB state,
2. provider mail call,
3. lifecycle analytics/consent/event writes.

Nie są objęte jednym atomowym mechanizmem.

## 5. Security alert transport

`SecurityMonitor` jest process-local:
- okno zdarzeń 15 min w tablicy pamięci,
- cooldown alertów w `Map`,
- przy progu zapisuje audit event,
- opcjonalnie wysyła webhook HTTP,
- failure transportu webhook jest świadomie non-fatal.

Brak durable alert queue/retry. Restart procesu zeruje stan okna i cooldownów.

## 6. Cleanup / retention inventory

### Auth sessions

`PostgresAuthSessionStore.cleanup()` usuwa stare sesje, ale w aktualnym kodzie jest wywoływany podczas inicjalizacji store. Nie znaleziono w przeanalizowanym runtime osobnego cyklicznego scheduler/cron dla tej metody.

Dodatkowo revoke/revokeAll są wykonywane inline przy logout/reset/profile operations.

### Global Chat presence/rate

Cleanup jest opportunistic/process-local:
- presence wygasa podczas `touch`,
- rate arrays są filtrowane podczas kolejnych operacji.

### Realtime connections

Cleanup następuje przez event `close` klienta i shutdown procesu.

### Newsletter token/history retention

Reset tokeny kont są czyszczone inline podczas requestów. Newsletter lifecycle nie ma w przeanalizowanym runtime oddzielnego retention worker.

### Tournament advancement

Nie istnieje osobny tournament worker. Advancement jest wywoływany inline po zgłoszeniu wyniku (`report → recomputeStandings → advanceDatabase`).

## 7. Event inventory AS-IS

### Durable event store/outbox

**BRAK POTWIERDZONEGO Transactional Outbox AS-IS.**

Aktualne "eventy" dzielą się na:
- SSE messages wysyłane bezpośrednio z procesu,
- append-only audit log,
- newsletter lifecycle/events zapisywane best-effort,
- security alerts/audit + optional webhook,
- direct mail provider calls.

Żaden z tych mechanizmów nie jest odpowiednikiem wspólnego durable outboxu dla business transaction → async delivery.

### Główne event names / side effects

Warcaby:
- `game.updated`,
- `chat.message`,
- `game.action`,
- `player.disconnected`,
- `player.reconnected`.

Tysiąc:
- `thousand.updated`,
- `thousand.round-started`,
- initial `thousand.snapshot`.

Global Chat:
- `message.created`,
- `message.updated`,
- `message.deleted`,
- `topic.created`,
- presence/connected/ping SSE.

Audit/security:
- domenowe/security event types zapisywane do `gracz_audit_log`,
- `security.alert.*`,
- `mail.sent`,
- admin/newsletter/moderation/MFA/RBAC audit events.

Newsletter lifecycle:
- `subscribe.requested`,
- `subscribe.confirmation_sent`,
- `subscribe.resend_requested`,
- `subscribe.confirmed`,
- `subscribe.unsubscribed`.

## 8. Retry / idempotency inventory

### Retry

POTWIERDZONE w aktualnym runtime:
- brak centralnego durable retry worker,
- brak dead-letter queue,
- brak durable delivery-attempt table dla mail/realtime/webhook,
- provider/network error zwykle wraca do requestu lub jest best-effort ignorowany zależnie od ścieżki.

### Idempotency

Mechanizmy lokalne istnieją punktowo:
- Warcaby session domain ma request/event semantics, ale persistence store nie używa produkcyjnego `version` CAS,
- Tysiąc używa `revision` CAS,
- newsletter lifecycle część wpisów deduplikuje przez `WHERE NOT EXISTS`,
- chat reports używają `ON CONFLICT ... DO NOTHING`,
- newsletter source mapping używa `ON CONFLICT ... DO NOTHING`.

Nie ma wspólnego idempotency key store dla commands ani consumer deduplication.

## 9. Docelowe mapowanie V3

| AS-IS side effect | V3 kierunek |
|---|---|
| DB commit → SSE publish | transaction + `outbox_events` → publisher → broker → realtime gateway |
| direct mail w request | outbox event → mail worker z retry/idempotency |
| newsletter best-effort lifecycle recorder | durable domain/outbox event + idempotent projection/consumer |
| process-local security alert | durable audit/security event; opcjonalny alert worker |
| tournament inline advancement | command/aggregate serialization; ewentualne durable follow-up event, nie luźny background race |
| cleanup at startup/opportunistic | jawny retention/cleanup job z metrykami i idempotency |
| process-local presence | shared ephemeral store/broker z TTL; presence nie jest source of truth |

## 10. Rejestr ryzyk

### WE-001 — process-local realtime

**HIGH.** Multi-instance/restart może utracić presence/subscription state i pojedyncze broadcasty. Nie może być podstawą correctness V3.

### WE-002 — brak transactional outbox

**HIGH.** Business commit i external/realtime side effect są rozdzielone.

### WE-003 — direct mail bez durable retry

**HIGH dla operacji wymagających dostarczenia.** Provider failure może wymagać działania użytkownika/retry requestu; nie ma kolejki z attempt state.

### WE-004 — newsletter analytics best-effort

**MEDIUM/HIGH.** Core lifecycle może być poprawny, a pomocniczy event/consent/source zapis może nie powstać przy błędzie recorder.

### WE-005 — security monitor memory-only

**MEDIUM.** Restart/multi-instance fragmentuje okna detekcji.

### WE-006 — brak potwierdzonego zewnętrznego scheduler inventory

**WARNING środowiskowy.** Repo/runtime nie pokazuje cron/worker, lecz brak osobnego Render job/service musi zostać potwierdzony konfiguracją środowiska.

## 11. Ocena bramki 10

### Repozytoryjne pokrycie

**COMPLETE dla bieżącego runtime.**

Zmapowano:
- realtime Warcaby,
- realtime Tysiąc,
- realtime/presence Global Chat,
- mail delivery,
- newsletter lifecycle side effects,
- security alerts,
- cleanup/retention paths,
- tournament advancement,
- retry/idempotency gaps.

### Status formalny

**BRAMKA 10 — WARNING.**

Do `PASS` wymagana jest tylko środowiskowa korelacja, że poza zmapowanym głównym procesem nie działa:
- Render cron job,
- osobny worker/service,
- stary deploy zapisujący do tej samej DB,
- zewnętrzny skrypt integracyjny.

Jeśli environment check potwierdzi brak takich procesów, gate może przejść do `PASS` bez zmiany mapy kodowej.

## 12. Następny krok

Następna krytyczna bramka: **11 — Crypto compatibility i key/version inventory**.

Zakres:
- private-message subject/body ciphertext format,
- attachment AES-GCM IV/tag/ciphertext + AAD variants,
- MFA encrypted TOTP secret,
- key derivation/versioning,
- kontrolowany decryptability smoke test bez zapisywania plaintextu do dokumentacji/logów,
- decyzja: preserve legacy ciphertext vs re-encrypt during V3 migration.