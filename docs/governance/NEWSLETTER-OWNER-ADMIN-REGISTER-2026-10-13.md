# Newsletter + Owner Admin — rejestr etapów i dowodów (2026-10-13)

**Stan:** SNAPSHOT / DOCUMENTATION PROPOSAL / NOT CLOSURE AUTHORITY. Aktualizować na bazie GitHub przed każdą decyzją.

## Decyzja Owner — kolejność projektu

Przed przekazaniem *głównego wysiłku implementacyjnego* do Gracz Next L6 ukończyć i pozytywnie zaudytować **całość kodowania newslettera, w tym panel administracyjny właściciela FULL MAX PREMIUM**.

Sekwencja: B1 → B2 STATUS_CHECK → prywatny Owner Admin → B3 końcowa weryfikacja **wszystkich trzech**. Kolejność wewnętrzna może zostać zmieniona wyłącznie jawną decyzją Owner po ocenie zależności. Osobny kod nie jest domyślnie autoryzowany przez ten dokument. Audyt read-only L6 i niezależne zadania organizacyjne mogą postępować osobno, z zachowaniem ownership.

## Aktualny rejestr

| Etap | Źródło | Kod | Audyt | Merge | Produkcja / migracja | Otwarte |
|---|---|---|---|---|---|---|
| B1 dedup DOI | PR #248, base 4fa9b909..., audited 32b5de8... | IMPLEMENTED / DRAFT | independent audit HOLD, P1/P2 | HOLD | HOLD, m.in. migracja 005 | timing/error enumeration, unknown recovery, Resend contract, cutover, E2E |
| B1.2 korekty | Mandat korekcyjny 2026-10-13 | NOT VERIFIED | NOT EXECUTED | HOLD | HOLD | Exact HEAD i świeże wyniki po korekcie |
| B2 STATUS_CHECK | Dokumentacja programu w PR #245 | NOT VERIFIED / NOT AUTHORIZED | NOT EXECUTED | HOLD | HOLD | Jednorazowy token i mechanizm dowodu własności e-maila |
| Owner Admin FULL MAX PREMIUM | PR #245: DOCS-ONLY, DRAFT | NOT IMPLEMENTED / NOT AUTHORIZED | NOT EXECUTED | HOLD | HOLD | MFA, RBAC, prywatność, audyt, zakres statystyk i provider truth |
| B3 końcowy audyt pakietu | Plan | NOT STARTED | NOT EXECUTED | HOLD | HOLD | Pełny końcowy zakres wraz z Admin |
| L6 (inne repo: gracz-next) | PR #78 R5 DRAFT | code present in draft | independent final gate pending | HOLD | paid/prod HOLD | Nie deklarować L6 CLOSED |

Wynikami PASS wstępnymi B1 nie zastępuj HOLD niezależnego audytu. Snapshot nie stwierdza, że korekta B1.2 już nastąpiła. Raporty z prywatnego czatu wymagają trwałej, bezpiecznie zredagowanej referencji w odpowiednim dossier.

## Warunek programowego FINISH

**NEWSLETTER CODING COMPLETE** tylko wtedy, gdy B1, B2 i panel Admin mają finalny zatwierdzony kod, pełny zestaw wymaganych dowodów i niezależny PASS; B3 obejmuje końcowe testy regresyjne i zgodności.

**NEWSLETTER PRODUCTION LIVE** to odrębna bramka — backup, realny restore, zatwierdzone migracje i rollout; nie wynika ze statusu CODING COMPLETE.

## Zastrzeżenie dot. migracji

Istniejące runbooki contact-data i DR oznaczają migrację 005 jako HOLD. PR #248 używa nazwy 005 dla newslettera. Numeracja wymaga formalnego uzgodnienia bez obejścia jakichkolwiek recovery gate. Ten rejestr nie rozstrzyga kolizji.

## Dowody startowe do przeniesienia w dossier (po niezależnej weryfikacji)

- gracz-pl-2 PR #248: https://github.com/developergracz/gracz-pl-2/pull/248
- Dokumentacja wymagań PR #245: https://github.com/developergracz/gracz-pl-2/pull/245
- gracz-next L6 PR #78: https://github.com/developergracz/gracz-next/pull/78
- Governing contact runbooks: contact-api/README.md, PRODUCTION_BACKFILL_RUNBOOK.md, RENDER_POSTGRES_UPGRADE_RUNBOOK.md, docs/operations/BACKUP_DISASTER_RECOVERY_R1_2026-10-09.md

Uzupełnij każdy stan aktualnym exact HEAD i PR przy jego rzeczywistym przeglądzie. Nie wpisuj haseł, adresów abonentów ani kluczy.
