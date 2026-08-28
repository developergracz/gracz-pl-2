# ETAP 3 — Writer/Reader Inventory 28/28

Data: 28.08.2026
Status: **WYKONANE — 28/28 TABEL ZMAPOWANE / BRAMKA 9 = WARNING DO CZASU KORELACJI DEPLOYU**

## 1. Cel

Celem dokumentu jest zamknięcie repozytoryjnej części bramki preflight dotyczącej writerów, readerów i endpointów dla wszystkich 28 tabel rzeczywiście obecnych w PostgreSQL Render.

Dokument odpowiada na pytania:
- kto zapisuje daną tabelę,
- kto ją czyta,
- przez jaki endpoint/job/boot path operacja jest osiągalna,
- gdzie przebiega granica transakcji,
- jakie ryzyko ma writer cutover,
- który bounded context V3 ma przejąć odpowiedzialność.

Nie wykonano żadnego DDL, DML ani zmiany produkcji.

## 2. Zakres dowodowy

### POTWIERDZONE — aktualny kod repozytorium

Runtime wiring przeanalizowano dla `developergracz/gracz-pl-2` na stanie `main` poprzedzającym ten dokument:

`8dee41deea93465f5777de318b5866be898ff237`

Główny entrypoint `modern/checkers-engine/src/main.js` przy obecności `DATABASE_URL` konstruuje i podłącza do wspólnego PostgreSQL m.in.:
- `PostgresSessionStore`,
- `PostgresAccountService` + `SecureAccountService`,
- `PostgresAuthSessionStore`,
- `MessageAttachmentService`,
- `AuditService`,
- `ModerationService`,
- `RbacService`,
- `MfaService`,
- `GlobalChatService`,
- `TournamentService`,
- `RankingService`,
- `NewsletterService`,
- `NewsletterAdminService`,
- `NewsletterLifecycleRecorder`,
- `PostgresThousandRepository`.

Gomoku w aktualnym wiring działa przez `GomokuService` bez PostgreSQL repository.

### POTWIERDZONE — historyczny AS-IS

Dla przyczyn DQ-001/DQ-002 i historycznego zachowania writerów nadal obowiązuje osobny baseline `origin/main @ db3c15a` opisany w `07-AUDYT-WRITEROW-I-PLAN-NAPRAWY-BLOCKEROW.md`.

### WYMAGA WERYFIKACJI ŚRODOWISKA

Sam fakt istnienia kodu na `main` nie dowodzi, że dokładnie ten commit jest aktualnym deployem Render. Dlatego repozytoryjna mapa 28/28 jest kompletna, lecz bramka 9 pozostaje `WARNING`, dopóki freeze/deploy correlation nie potwierdzi, że nie działa dodatkowy/starszy writer spoza zmapowanego runtime.

## 3. Klasyfikacja ścieżek

- **ACTIVE** — serwis jest podłączony w `main.js` i posiada osiągalną ścieżkę HTTP/runtime.
- **BOOT** — zapis wykonywany przy inicjalizacji/startupie serwisu.
- **LATENT** — metoda writer istnieje w podłączonym serwisie, ale w przeanalizowanym aktualnym handler wiring nie potwierdzono publicznej ścieżki wywołania.
- **LEGACY-NO-CURRENT-PATH** — tabela istnieje w produkcji, ale nie ustalono aktualnego writera/readera w przeanalizowanym runtime.

## 4. Macierz 28/28

| # | tabela AS-IS | writer | reader | endpoint / job / runtime path | granica transakcji | ryzyko cutover | owner V3 |
|---:|---|---|---|---|---|---|---|
| 1 | `gracz_accounts` | **ACTIVE** `PostgresAccountService.register/updateProfile/reset...`; `SecureAccountService` aktualizuje verification/password i może usuwać niedokończoną rejestrację | auth, profile, player search, messaging recipient lookup, ranking display names, RBAC bootstrap, recovery | `/auth/register`, `/auth/login`, `/auth/availability`, `/auth/request-password-reset`, `/auth/reset-password`, `/account/profile`, `/players/search`, `/messages`, `/rankings*` | część operacji konta ma `BEGIN/COMMIT`; warstwa secure wykonuje część kroków po bazowym commicie, więc cały lifecycle rejestracji nie jest jednym tx | **HIGH** — Identity jest kluczem dla wielu kontekstów; DQ-002/recovery musi pozostać jednoznaczne | Identity & Access |
| 2 | `gracz_audit_log` | **ACTIVE** `AuditService.record()`; liczne security/admin/moderation wrappers | brak potwierdzonego list/read API tabeli; `audit-health` nie czyta logu | request finish/error, admin security, newsletter admin, moderation, MFA/RBAC | pojedynczy append po operacji domenowej; często poza transakcją domenową | **MEDIUM** — audyt może powstać/nie powstać niezależnie od commitu domeny | Audit |
| 3 | `gracz_audit_log_legacy_1787562123031` | **LEGACY-NO-CURRENT-PATH** | **LEGACY-NO-CURRENT-PATH** | brak aktualnej ścieżki w przeanalizowanym runtime | n/d | **MEDIUM** — provenance/retention przed archive/deprecate | Audit / Legacy archive |
| 4 | `gracz_auth_sessions` | **ACTIVE** create/upsert, heartbeat update, revoke/revokeAll, cleanup delete | `has()`, `assertActive()` w praktycznie wszystkich authenticated handlers | auth login/register/migrate/logout, profile, games, chat, tournaments, rankings, admin, newsletter admin, Thousand | pojedyncze statementy; revoke po password/profile change może następować po osobnym tx konta | **HIGH** przy cutover Identity — sesje muszą mieć jawny drain/mapping | Identity & Access |
| 5 | `gracz_chat_friends` | **ACTIVE** insert/update/delete w `GlobalChatService` | friends/list/existence check | `GET/POST /global-chat/friends`, `PATCH/DELETE /global-chat/friends/:id` | check-then-insert bez wspólnego tx; brak FK do accounts | **HIGH** — potwierdzona przyczyna DQ-001, możliwe niekanoniczne principal IDs | Global Chat & Social |
| 6 | `gracz_chat_topics` | **ACTIVE** create topic; boot DDL | list/get topic; join z global chat | `GET/POST /global-chat/topics`; message send z `topicId` | pojedyncze statementy | **MEDIUM** — topic/message consistency oraz legacy logical refs | Global Chat & Social |
| 7 | `gracz_game_sessions` | **ACTIVE** `PostgresSessionStore.create/save()` INSERT/UPSERT pełnego `state` | game GET/mutations read state; `RankingService` skanuje zakończone stany | `POST /games`, `GET /games/:id`, `POST /games/:id/{moves,chat,actions,disconnect,reconnect}`, `/rankings*` | każdy save jest osobnym UPSERT; realtime publish po zapisie | **HIGH** — produkcyjny `version` istnieje, ale aktualny store go nie czyta/nie inkrementuje i nie stosuje CAS | Game Platform / Match Runtime |
| 8 | `gracz_global_chat` | **ACTIVE** insert/edit/soft-delete/reaction update | list/search/topic aggregation; reaction read-before-write | `/global-chat/messages*`, `/global-chat/topics` | zwykle pojedyncze statements; reactions = oddzielny SELECT + UPDATE; broadcast po DB | **HIGH** — reaction lost-update + DB/realtime nieatomowe | Global Chat & Social |
| 9 | `gracz_global_chat_reports` | **ACTIVE** `report()` INSERT ON CONFLICT DO NOTHING | brak potwierdzonego bieżącego review/read API w przeanalizowanym runtime | `POST /global-chat/messages/:id/report` | pojedynczy statement | **MEDIUM** — raporty mają przejść pod Moderation bez utraty provenance | Moderation / Chat ingress |
| 10 | `gracz_message_attachments` | **ACTIVE** `MessageAttachmentService.save()` INSERT | metadata list i attachment get; join do messages | `POST/GET /messages/:id/attachment`, `GET /messages` | weryfikacja message SELECT, potem osobny INSERT; osobny lifecycle od wiadomości | **HIGH** — ciphertext/AAD/key compatibility i delete cascade | Messaging |
| 11 | `gracz_messages` | **ACTIVE** send INSERT, read/archive/delete-state UPDATE | inbox/sent/archive, attachment authorization | `GET/POST /messages`, `PATCH/DELETE /messages/:id`, attachment endpoints | pojedyncze operacje; wiadomość i załącznik nie są jednym tx | **HIGH** — szyfrowany subject/body, retention i referencje accounts | Messaging |
| 12 | `gracz_mfa` | **ACTIVE** begin UPSERT, enable UPDATE | isEnabled/getRecord/verify | `/admin/security/mfa/setup`, `/admin/security/mfa/enable`, privileged admin/newsletter operations | pojedyncze statements; audit osobno | **HIGH** — encrypted TOTP secret wymaga key/AAD compatibility | Identity & Access |
| 13 | `gracz_moderation_appeals` | **LATENT** `ModerationService.appeal()` INSERT; serwis jest podłączony, ale nie potwierdzono bieżącego HTTP route wywołującego `appeal()` | metoda appeal sprawdza decision; brak potwierdzonego list/review readera | brak potwierdzonego aktualnego endpointu w zmapowanym handler wiring | decision lookup i appeal INSERT osobno; audit potem osobno | **MEDIUM** — tabela istnieje, ale runtime surface jest niepełny | Moderation |
| 14 | `gracz_moderation_decisions` | **ACTIVE** `ModerationService.record/enforce()` | appeal decision ownership check | moderation wrappers rejestracji/profilu/private-message/chat | decyzja i audit/domains są osobnymi zapisami | **MEDIUM/HIGH** — cross-context atomicity brak | Moderation |
| 15 | `gracz_newsletter_subscribers` | **ACTIVE** subscribe/resend/confirm/unsubscribe updates/inserts | public lifecycle, lifecycle recorder, admin dashboard/list/detail/reveal/stats joins | `/newsletter/*`, `/admin/newsletter/*` | część core lifecycle ma tx + `FOR UPDATE`; delivery mail/status oraz analytics następują po commicie | **HIGH** — znany hybrid legacy/new drift i dwa modele pól consent/token/id | Newsletter |
| 16 | `gracz_password_reset_tokens` | **ACTIVE** insert/delete/mark-used | recovery lookup/join z accounts | `/auth/request-password-reset`, `/auth/reset-password` | reset właściwy ma tx; request/cleanup/insert nie zawsze w jednym tx | **HIGH** — zależność od DQ-002 i jednoznacznej Identity | Identity & Access |
| 17 | `gracz_registration_codes` | **ACTIVE** UPSERT code, increment attempts, delete after verify | join/read `FOR UPDATE` przy verification | `/auth/register` + login/verification flow | verification ma tx; account creation i późniejsze wygenerowanie kodu nie są jednym wspólnym tx | **MEDIUM/HIGH** | Identity & Access |
| 18 | `gracz_role_changes` | **LEGACY-NO-CURRENT-PATH** | **LEGACY-NO-CURRENT-PATH** | brak bieżącej ścieżki w zmapowanym runtime; produkcja ma tę tabelę obok `gracz_role_history` | n/d | **MEDIUM** — należy zachować provenance i ustalić historyczny owner | Identity & Access / Legacy history |
| 19 | `gracz_role_history` | **ACTIVE** `RbacService.setRole()` INSERT | brak potwierdzonego bieżącego history-list readera | `POST /admin/security/roles` | role UPSERT + history INSERT w jednym tx; audit po COMMIT | **MEDIUM** | Identity & Access |
| 20 | `gracz_roles` | **BOOT/ACTIVE** owner bootstrap INSERT; role UPSERT | `getRole/can/require` w admin/security/newsletter admin | startup bootstrap, `/admin/security/*`, `/admin/newsletter/*` | `setRole`: roles + role_history w jednym tx; bootstrap osobny statement | **HIGH** — autoryzacja privileged paths | Identity & Access |
| 21 | `gracz_thousand_games` | **ACTIVE** create INSERT; save CAS UPDATE `revision=revision+1` | game view/actions + ranking | `POST /thousand/games`, `GET /thousand/games/:id`, `POST .../actions`, `POST .../next-round`, `/rankings*` | pojedynczy CAS statement; realtime publish po persistence | **MEDIUM/HIGH** — concurrency lepsza niż Warcaby, ale DB/realtime nieatomowe | Game Platform / Match Runtime |
| 22 | `gracz_tournament_matches` | **ACTIVE** insert pairings, report result UPDATE | detail, standings recompute, advance | `GET /tournaments/:id`, `POST /tournaments/:id/start`, `POST /tournaments/:id/matches/:matchId/result` | multi-statement workflow bez jednego obejmującego tx; inserts one-by-one | **HIGH** — report/advance races, weak round-board serialization | Tournament |
| 23 | `gracz_tournament_players` | **ACTIVE** owner/join INSERT, leave DELETE, standings/buchholz UPDATE | list/detail/pairing/advance | `/tournaments`, `/tournaments/:id/{join,leave,start}`, result reporting | create tournament + owner player osobno; join uses `MAX(seed)+1`; recompute updates one-by-one | **HIGH** — cap/seed/concurrent standings races | Tournament |
| 24 | `gracz_tournaments` | **ACTIVE** create INSERT, start/round/finish UPDATE | list/detail/start/advance | `/tournaments`, `/tournaments/:id`, `/tournaments/:id/{join,leave,start}`, result path | multi-table lifecycle nie jest jednym tx | **HIGH** | Tournament |
| 25 | `newsletter_consent_history` | **ACTIVE** lifecycle recorder INSERT | admin subscriber detail | subscribe/confirm/unsubscribe analytics wrapper; `/admin/newsletter/subscribers/:id` | **best-effort po core operation**, poza core newsletter tx | **HIGH** dla kompletności audytowej zgód | Newsletter |
| 26 | `newsletter_events` | **ACTIVE** lifecycle recorder INSERT; `NewsletterAdminService.recordEvent()` posiada writer | admin dashboard/list/detail/stats/security events | lifecycle wrapper + `/admin/newsletter/*`; dodatkowe security analytics mogą wywoływać recordEvent | poza core newsletter tx; część dedupe check+insert logiczna | **MEDIUM/HIGH** | Newsletter |
| 27 | `newsletter_sources` | **BOOT** seed `homepage` INSERT ON CONFLICT; brak potwierdzonego publicznego mutation endpointu | lifecycle source resolution + admin joins/stats | startup `NewsletterAdminService.initialize`; lifecycle/admin reads | startup single statement | **LOW/MEDIUM** — seed musi być stabilny przed backfill | Newsletter |
| 28 | `newsletter_subscriber_sources` | **ACTIVE** lifecycle recorder INSERT ON CONFLICT | admin filters/list/detail | lifecycle wrapper po subscribe/resend/confirm/unsubscribe; admin reads | best-effort po core newsletter tx | **MEDIUM/HIGH** — attribution może nie być atomowa z subscription | Newsletter |

**Pokrycie: 28/28 tabel produkcyjnych.**

## 5. Endpoint inventory — główne mutujące ścieżki

### Identity & Access

- `POST /auth/register` → accounts + registration workflow + auth session.
- `POST /auth/login` → session creation; account password-hash upgrade może zapisać account.
- `POST /auth/logout` → auth session revoke + audit.
- `POST /auth/migrate` → nowa sesja + revoke poprzedniej.
- `POST /auth/request-password-reset` → reset tokens.
- `POST /auth/reset-password` → account password + reset tokens; następnie revoke sessions.
- `PUT /account/profile` → account update; następnie new session/revoke old session.
- `POST /admin/security/mfa/setup` → MFA secret.
- `POST /admin/security/mfa/enable` → MFA enable.
- `POST /admin/security/roles` → roles + role_history + audit.

### Messaging

- `POST /messages` → encrypted private message.
- `PATCH /messages/:id` → read/archive state.
- `DELETE /messages/:id` → logical deletion state.
- `POST /messages/:id/attachment` → encrypted attachment.

### Warcaby / Game Platform

- `POST /games` → create game session.
- `POST /games/:id/moves` → full state UPSERT.
- `POST /games/:id/chat` → full state UPSERT.
- `POST /games/:id/actions` → full state UPSERT.
- `POST /games/:id/disconnect` → full state UPSERT.
- `POST /games/:id/reconnect` → full state UPSERT.

### Tysiąc

- `POST /thousand/games` → create.
- `POST /thousand/games/:id/actions` → CAS state update.
- `POST /thousand/games/:id/next-round` → CAS state update.

### Global Chat & Social

- `POST /global-chat/messages` → message insert.
- `PATCH/DELETE /global-chat/messages/:id` → edit/soft delete.
- `POST /global-chat/messages/:id/reaction` → reaction RMW.
- `POST /global-chat/messages/:id/report` → report insert.
- `POST /global-chat/topics` → topic insert.
- `POST /global-chat/friends` → friendship insert.
- `PATCH/DELETE /global-chat/friends/:id` → accept/reject/remove.

### Tournament

- `POST /tournaments` → tournament + owner participant.
- `POST /tournaments/:id/join` → participant insert.
- `POST /tournaments/:id/leave` → participant delete.
- `POST /tournaments/:id/start` → tournament state + match inserts.
- `POST /tournaments/:id/matches/:matchId/result` → match result + standings + possible round advancement.

### Newsletter

- `POST /newsletter/subscribe`.
- `POST /newsletter/resend`.
- `POST /newsletter/confirm`.
- `POST /newsletter/unsubscribe`.

Aktualne `/admin/newsletter/*` w przeanalizowanym handlerze są ścieżkami odczytowymi z audit write side-effect; nie potwierdzono endpointu edycji źródeł/subskrybentów.

## 6. Reader inventory — ważne ścieżki przekrojowe

### Ranking

`RankingService` jest istotnym readerem migracyjnym, ponieważ bez własnej tabeli projekcji:
- czyta zakończone Warcaby z `gracz_game_sessions`, rzutując `state::jsonb`,
- czyta zakończone gry Tysiąc z `gracz_thousand_games`,
- dociąga nazwy/profile z `gracz_accounts`.

Reader rankingowy musi przełączyć się dopiero po zapewnieniu V3 projection/read model; samo przełączenie writerów gier nie wystarczy.

### Realtime

- Warcaby: persistence w `gracz_game_sessions`, następnie `RealtimeHub.publish()`.
- Tysiąc: CAS persistence, następnie `ThousandRealtimeHub.publish()`.
- Global Chat: DB mutation, następnie process-local SSE `broadcast()`.

Realtime **nie jest źródłem prawdy** i w AS-IS nie jest atomowe z transakcją bazy.

### Admin/audit

Admin security opiera autoryzację o `gracz_roles`, `gracz_mfa`, `gracz_auth_sessions`; operacje administracyjne generują osobne wpisy `gracz_audit_log`.

Newsletter admin czyta jednocześnie subscriber + source + consent + event tables i generuje audit log przy odczytach wrażliwych.

## 7. Najważniejsze ustalenia cutover

### WR-001 — Warcaby ignorują produkcyjne `version`

**POTWIERDZONE:** produkcyjny `gracz_game_sessions` posiada dodatkową kolumnę `version`, natomiast aktualny `PostgresSessionStore` zapisuje przez UPSERT wyłącznie `state` i `updated_at` i nie stosuje `version` w warunku CAS.

Skutek: nie wolno traktować samej obecności `version` jako ochrony single-writer/concurrency. Writer cutover Warcabów wymaga drain/fencing albo docelowego V3 writer ownership.

Klasyfikacja: **WARNING wysokiego ryzyka / blocker dla bezpośredniego writer cutover aktywnej gry**.

### WR-002 — Tournament lifecycle jest wielostatementowy bez wspólnego tx

Create/start/report/recompute/advance składają się z wielu odrębnych statementów. Szczególnie result reporting może uruchamiać standings i advance po osobnym UPDATE match.

Klasyfikacja: **WARNING wysokiego ryzyka**; V3 command path musi zapewnić serializację/idempotency i jednoznaczną transakcję dla odpowiedniej granicy agregatu.

### WR-003 — Newsletter core i lifecycle analytics nie są atomowe

`withNewsletterLifecycleAnalytics` najpierw wykonuje core operation, a dopiero potem best-effort zapisuje source/consent/event records. Błąd recorder jest logowany i nie cofa core subscription.

Klasyfikacja: **WARNING**; V3 wymaga spójnego outbox/event contract albo świadomie zdefiniowanej reconciliation.

### WR-004 — Chat DB + realtime są rozdzielone

Message/topic updates są utrwalane, a dopiero potem broadcastowane do process-local subscribers. Reaction ma dodatkowo klasyczny read-modify-write JSONB.

Klasyfikacja: **WARNING**; V3 wymaga commit-first + outbox/broker oraz bezpiecznej semantyki reakcji.

### WR-005 — DQ-001 writer nadal nie jest dobrym modelem docelowym

Friendship writer sprawdza duplikat relacji, lecz nie potwierdza obu principal IDs w canonical accounts i tabela nie ma FK do Identity. To jest potwierdzony mechanizm, który umożliwił orphan.

Klasyfikacja: **WARNING/BLOCKER dla przeniesienia writera 1:1**. V3 writer musi rozwiązać requester/addressee do canonical Identity przed persistence.

### WR-006 — dwie tabele produkcyjne bez bieżącego path

- `gracz_audit_log_legacy_1787562123031`,
- `gracz_role_changes`.

W przeanalizowanym aktualnym runtime nie ustalono dla nich bieżącego writera ani readera. To nie jest dowód, że nigdy nie są używane przez starszy deploy/skrypt.

Klasyfikacja: **WARNING** do czasu deploy/process/job correlation. Nie usuwać w EXPAND.

### WR-007 — Moderation appeals ma latent writer bez potwierdzonego route

`ModerationService.appeal()` istnieje i może zapisać `gracz_moderation_appeals`, lecz przeanalizowany `main.js`/handler wiring nie ujawnił obecnego endpointu odwołań/review.

Klasyfikacja: **WARNING funkcjonalny**, nie blocker DDL EXPAND; trzeba jawnie zdecydować, czy V3 migruje historyczne dane bez aktywnego legacy UI/API.

## 8. Ocena bramki 9

### Repozytoryjne pokrycie

**28/28 — COMPLETE.**

Dla każdej produkcyjnej tabeli przypisano co najmniej jedną z kategorii:
- aktywny writer/reader,
- boot writer,
- latent writer,
- legacy/no-current-path.

Główne mutujące endpointy i przekrojowe read paths zostały zmapowane.

### Status formalny preflight

**BRAMKA 9 — WARNING, nie PASS.**

Powód nie jest brakiem mapy. Mapa repozytoryjna jest kompletna. Pozostaje środowiskowe potwierdzenie, że:
1. analizowany runtime odpowiada faktycznie wdrożonemu commitowi/procesowi,
2. nie działa starszy worker/skrypt zapisujący legacy audit/role_changes,
3. nie ma dodatkowego writera poza głównym Node runtime.

Po korelacji deploy/process/job gate 9 może przejść `WARNING → PASS` bez ponownego mapowania 28 tabel, o ile nie pojawi się drift.

## 9. Wpływ na DDL V3

**DDL V3 pozostaje NO-GO.**

Writer/reader inventory nie ujawnił powodu do wykonywania destrukcyjnych zmian. Przeciwnie, potwierdził konieczność:
- EXPAND przed cutover,
- zachowania legacy tables w pierwszej fazie,
- oddzielnego writer cutover per bounded context,
- feature flag/drain dla gier,
- CAS/fencing/single-writer dla Match Runtime,
- outbox dla commit→event/realtime,
- idempotency dla commands,
- reader cutover rankingu po gotowości projekcji,
- zachowania crypto key/AAD compatibility dla Messaging/MFA.

## 10. Następny krok

Po tej mapie najbliższa odrębna bramka to **10 — worker/event/realtime inventory**, która powinna:
1. sklasyfikować wszystkie process-local realtime hubs,
2. potwierdzić brak/obecność cronów i background workers,
3. zinwentaryzować mail delivery/retry paths,
4. ustalić cleanup jobs i procesy retention,
5. połączyć je z docelowym Transactional Outbox V3.

Równolegle nadal otwarte pozostają crypto compatibility, active-state/cutover, credentials/least privilege i finalna korelacja deployu.