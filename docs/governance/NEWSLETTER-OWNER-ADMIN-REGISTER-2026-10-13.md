# Newsletter + Owner Admin — rejestr etapów i dowodów (2026-10-13)

**Stan:** SNAPSHOT / DOCUMENTATION PROPOSAL / NOT CLOSURE AUTHORITY. Aktualizować na bazie GitHub przed każdą decyzją.

## Decyzja Owner — kolejność projektu

Provenance: oświadczenie Owner w rozmowie z Lead Architect 2026-10-13. **Trwały, autoryzowany zapis decyzji w GitHub = PENDING / NEEDS EVIDENCE**; nie udawaj, że poniższe samo w sobie jest podpisaną decyzją scaleniową.

Przed przekazaniem *głównego wysiłku implementacyjnego* do Gracz Next L6 ukończyć i pozytywnie zaudytować **całość kodowania newslettera, w tym panel administracyjny właściciela FULL MAX PREMIUM**.

Sekwencja: B1 → B2 STATUS_CHECK → prywatny Owner Admin → B3 końcowa weryfikacja **wszystkich trzech**. Kolejność wewnętrzna może zostać zmieniona wyłącznie jawną decyzją Owner po ocenie zależności. Osobny kod nie jest domyślnie autoryzowany przez ten dokument. Audyt read-only L6 i niezależne zadania organizacyjne mogą postępować osobno, z zachowaniem ownership.

## Aktualny rejestr

| Etap | Źródło | Kod | Audyt | Merge | Produkcja / migracja | Otwarte |
|---|---|---|---|---|---|---|
| B1 dedup DOI | [PR #248](https://github.com/developergracz/gracz-pl-2/pull/248), BASE `4fa9b909667651a2580e28b404539dfe4306b950`, HEAD `32b5de8beca8862ac2fda510c25a322857e74a70` | IMPLEMENTED / DRAFT | Claude audit HOLD reported by Owner; **not persisted on GitHub**, evidence pending | **BLOCKS_MERGE** | HOLD: SQL slot `005_*`, backup/restore | timing/error enumeration, unknown recovery, Resend contract, cutover, E2E |
| B1.2 korekty | Mandat korekcyjny w rozmowie 2026-10-13, trwały transcript/link: PENDING | NOT VERIFIED | NOT EXECUTED | HOLD | HOLD | Wymagany exact HEAD i świeży audyt po poprawkach |
| B2 STATUS_CHECK | [PR #245](https://github.com/developergracz/gracz-pl-2/pull/245), HEAD `28e35c7d9288df30625f7f561e3fcda48ecbe3b8`, DOI scope issue [#246](https://github.com/developergracz/gracz-pl-2/issues/246) | NOT VERIFIED / NOT AUTHORIZED | NOT EXECUTED | HOLD | HOLD | Jednorazowy token i dowód własności adresu; własny mandat przed implementacją |
| Owner Admin FULL MAX PREMIUM | [PR #245](https://github.com/developergracz/gracz-pl-2/pull/245), implementacja [issue #247](https://github.com/developergracz/gracz-pl-2/issues/247), OWNER CODEX wg komentarza PR #245 z 2026-10-12 | NOT IMPLEMENTED / NOT AUTHORIZED | NOT EXECUTED | HOLD | HOLD | MFA, RBAC, prywatność, audyt, provider truth; dodatkowe zatwierdzenie admin-auth |
| B3 końcowy audyt pakietu | Plan | NOT STARTED | NOT EXECUTED | HOLD | HOLD | Pełny końcowy zakres wraz z Admin |
| L6 (inne repo: gracz-next) | [PR #78](https://github.com/developergracz/gracz-next/pull/78), HEAD `682e85edb4a3cbb7e29995d9b4fd8a902401247b`, BASE `28c18abce80453f72c6efc2f95bcc9da5589dae8` | code present in DRAFT | [Claude R5 PASS](https://github.com/developergracz/gracz-next/pull/78#issuecomment-5864617793), [Factory R5 PASS](https://github.com/developergracz/gracz-next/pull/78#issuecomment-5864619719), [targeted module-scope reconciliation PASS](https://github.com/developergracz/gracz-next/pull/78#pullrequestreview-5493231805) | HOLD, no Owner merge GO | paid/prod HOLD | Nie deklarować L6 CLOSED; main evolved and exact effective-merge readiness must be checked |

Wynikami PASS wstępnymi B1 nie zastępuj HOLD niezależnego audytu. Snapshot nie stwierdza, że korekta B1.2 już nastąpiła. Raporty z prywatnego czatu wymagają trwałej, bezpiecznie zredagowanej referencji w odpowiednim dossier.

## Warunek programowego FINISH

**NEWSLETTER CODING COMPLETE** tylko wtedy, gdy B1, B2 i panel Admin mają finalny zatwierdzony kod, pełny zestaw wymaganych dowodów i niezależny PASS; B3 obejmuje końcowe testy regresyjne i zgodności.

**NEWSLETTER PRODUCTION LIVE** to odrębna bramka — backup, realny restore, zatwierdzone migracje i rollout; nie wynika ze statusu CODING COMPLETE.

## Zastrzeżenie dot. migracji

Istniejące runbooki contact-data i DR oznaczają migrację 005 jako HOLD. PR #248 proponuje `005_newsletter_opt_in_requests.sql`, czyli **kolizję obowiązującego slotu 005**. **MIGRATION SLOT 005 = BLOCKS_MERGE of PR #248** until formal schema versioning, migration sequence, autorun build/deploy coupling and verified DR gates are reconciled. Sama zmiana nazwy nie wystarcza. Zasada dotyczy również włączenia zaległej migracji przez pośredni deploy. Ten dokumentacyjny PR #249 nie zawiera SQL i nie rozstrzyga kolizji.

## Dowody startowe do przeniesienia w dossier (po niezależnej weryfikacji)

- gracz-pl-2 PR #248: https://github.com/developergracz/gracz-pl-2/pull/248
- Dokumentacja wymagań PR #245: https://github.com/developergracz/gracz-pl-2/pull/245
- gracz-next L6 PR #78: https://github.com/developergracz/gracz-next/pull/78
- L6 Claude independent PASS exact HEAD: https://github.com/developergracz/gracz-next/pull/78#issuecomment-5864617793
- L6 Factory adversarial PASS exact HEAD: https://github.com/developergracz/gracz-next/pull/78#issuecomment-5864619719
- L6 Owner bounded scope: https://github.com/developergracz/gracz-next/pull/78#issuecomment-5864631711
- L6 Owner residual disposition (10 findings): https://github.com/developergracz/gracz-next/pull/78#issuecomment-5864745196
- L6 module-scope reconciliation PASS with separate merge HOLD: https://github.com/developergracz/gracz-next/pull/78#pullrequestreview-5493231805
- Newsletter owner implementer assignment: https://github.com/developergracz/gracz-pl-2/pull/245#issuecomment-6129078471
- Claude independent B1 HOLD transcript: provided in chat, GitHub persistence UNKNOWN; do not claim formal stored evidence.
- Governing contact runbooks: contact-api/README.md, PRODUCTION_BACKFILL_RUNBOOK.md, RENDER_POSTGRES_UPGRADE_RUNBOOK.md, docs/operations/BACKUP_DISASTER_RECOVERY_R1_2026-10-09.md

Uzupełnij każdy stan aktualnym exact HEAD i PR przy jego rzeczywistym przeglądzie. Nie wpisuj haseł, adresów abonentów ani kluczy.

## Weryfikacja zależności merge → deploy → migracje (G4, stan na 2026-10-13)

| Element | Stan potwierdzony / brak dowodu | Bramka |
|---|---|---|
| Render `gracz-contact-api` real autoDeploy, branch, build i preDeploy command | **UNKNOWN**; pliki repo/README nie są dowodem live konfiguracji | **MERGE HOLD** dla każdego PR, którego merge mógłby uruchomić niezabezpieczony migrator |
| Render `gracz-pl-maintenance` / inne konsumujące `main` | Konfiguracja repo nie zastępuje obserwacji usługi | Verify live read-only przed owner GO |
| Pending migrations against production DB | UNKNOWN; no DB inspection authorized | HOLD na niezatwierdzoną DDL |
| `005_*` from PR #248 | Konflikt z contact-data CONTRACT slot 005 | **BLOCKS_MERGE PR #248**, do not run |
| DR: actual independent restore/decrypt evidence | not verified against live recovery gate | HOLD dla chronionych operacji |

**Rozróżnienie:** dokumentacyjny PR #249 nie dodaje migracji, a zmiany na gałęziach DRAFT nie są produkcją. Każdy rzeczywisty merge wymaga osobnego potwierdzenia efektywnego zachowania Render i Owner GO. Nie wstawiaj rzeczywistych sekretów ani connection strings do rejestru.

## Rejestrowanie i wznowienie audytu

Raport niezapisany trwale otrzymuje status `OWNER-PROVIDED / GITHUB PERSISTENCE PENDING`; nie znaczy to, że audyt nie został wykonany, ale **nie jest kompletnym dowodem zamknięcia**. Po przerwie wykonawcy ponownie weryfikują HEAD, branch, active PR inventory, ownership, CI i brak kolizji, zamiast kontynuować ze starego workspace bez synchronizacji.
