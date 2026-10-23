# GRACZ.PL — FULL MAX PRO: standard dowodów i zamykania etapów R1

**Data propozycji:** 2026-10-13  
**Stan:** PROPOSED / DRAFT PR / NOT YET BINDING  
**Zakres:** developergracz/gracz-pl-2, dokumentowanie prac wykonywanych od chwili przyjęcia standardu.  
**Właściciel decyzji:** Owner. **Przygotowanie:** Lead Architect. **Wykonawcy:** zgodnie z przypisanym zadaniem.  

Ten dokument jest propozycją procesu, a nie potwierdzeniem zakończenia istniejących etapów. Stanie się przyjętym standardem dopiero po osobnej decyzji Owner i kontrolowanym scaleniu. Nie zmienia istniejącej architektury, nie znosi ograniczeń bezpieczeństwa, nie upoważnia do merge ani deploy.

## 1. Zasada podstawowa

**ETAP CLOSED (zadeklarowany zakres kodowania lub dokumentacji) = zakres zrealizowany zgodnie z mandatem + testy odpowiednie do ryzyka + niezależna ocena + dowody + pełne dossier + aktualne artefakty GitHub/CPAED, gdy mają zastosowanie + decyzja Owner. Wdrożenie produkcyjne i wykonanie migracji mają osobne bramki i nie są domyślnym elementem CLOSED.**

Statusy rozdzielamy jednoznacznie:
- PROPOSED: specyfikacja bez autoryzacji.
- ACTIVE: praca trwa, właściciel i PR/gałąź są znane.
- IMPLEMENTED: kod zapisany, ale jeszcze nie zatwierdzony.
- READY_FOR_INDEPENDENT_REVIEW: wynik wykonawcy, bez twierdzenia o niezależnym PASS.
- REVIEW_HOLD / BLOCKED: błąd, kolizja lub brak dowodu.
- REVIEW_PASS: niezależna kontrola konkretnego HEAD zakończona PASS, nie implikuje merge.
- READY_TO_MERGE: aktualny exact-head review i CI, wszystkie bramki i osobna zgoda Owner.
- MERGED: commit/scalenie zweryfikowane na main, ale nie oznacza produkcji.
- DEPLOYED: odrębny status operacyjny (zweryfikowany SHA produkcji + kontrole po wdrożeniu), a nie automatyczny krok między MERGED i CLOSED.
- CLOSED: zamknięty jest wyłącznie **jawnie określony zakres**; wymagane testy, audyt, dokumentacja, dowody, zatwierdzenie i zależne aktualizacje stanu są kompletne. Produkcja może pozostać HOLD, ale nie wolno wówczas deklarować CLOSED dla zakresu obejmującego wdrożenie.
- SUPERSEDED: zapis historyczny zastąpiony wskazanym SHA/PR. Nigdy nie usuwaj historii.

Nie przenoś automatycznie PASS między HEAD, branchami, etapami, środowiskami czy datami.

## 2. Obowiązkowy pakiet dla każdego etapu

Każdy etap musi mieć jeden dossier (szablon obok) zawierający:
1. Identyfikator etapu i zależności; zakres IN/OUT, mierzalne kryteria akceptacji, Owner, architekt, implementer i niezależny reviewer.
2. Repo, remote, base SHA, branch, PR, lista commitów, final HEAD/TREE jeśli ustalony; daty i stan.
3. ADR/uzasadnienie wariantów, model danych i migracji, kompatybilność stary/nowy, rollback i konsekwencje.
4. Konkretne zmienione pliki i ich role; mapowanie wymaganie → kod → test → dowód.
5. Zagrożenia, granice zaufania, dostęp, sekrety, ochrona danych, logowanie, ryzyko nadużyć.
6. Wyniki unit/contract/integration/DB/browser, w tym PASS/FAIL/SKIP, środowisko, wersje, uruchomienia CI i dokładne SHA; test pozorowany nie zastępuje rzeczywistego.
7. Niezależną opinię przypisaną do exact HEAD, niezależność uczestników, findings P0–P3, regresje RED→GREEN i aktualny status.
8. Runbook wdrożenia i rollback, preflight/postflight, plan migracji oraz wymagane backup/restore; decyzję, czy wdrożenie jest wyłączone.
9. Spis ryzyk otwartych, akceptowanych i przenoszonych, właściciel/termin, wpływ na kolejny etap.
10. Podpis decyzji Owner: zakres, stan, datę, dokładny SHA i jawne wyłączenia.

Nie zamykaj etapu z pustym polem — wpisz NOT EXECUTED, UNKNOWN albo NOT APPLICABLE z uzasadnieniem. Brak dowodu to HOLD, nie PASS.

## 3. Bramki zatwierdzenia

- G0 SOURCE: aktualne main, kolizje PR, istniejące dokumenty, ownership, brak niezatwierdzonych zmian. Zakres IN/OUT i autoryzacja decyzji Owner pozostają obowiązkowe niezależnie od nazwy bramki.
- G1 DESIGN: kontrakty, zagrożenia, ADR, plan testów, migracje i strategie wstecznej kompatybilności.
- G2 IMPLEMENTATION: zapisany kod, pełna mapa diff, narzędzia i testy, brak nieujawnionych zmian.
- G3 INDEPENDENT REVIEW: zewnętrzny wobec wykonawcy reviewer; dowody oparte na final HEAD; testy niepowiązane z zakresem nie liczą się.
- G4 OWNER MERGE: przed zgodą na merge sprawdź rzeczywistą konfigurację każdej powiązanej usługi (repo/branch, **auto-deploy ON/OFF, rzeczywisty build i pre-deploy command, migrator oraz DDL uruchamiane przez build/deploy**), uwzględniając Render static i contact API oraz inne konsumenty wspólnego `main`. Sprawdź zaległe migracje, bazę, skutki mieszanych wersji, rollback i DR. **Nieznany stan live deploy/build = MERGE HOLD**, gdy merge może uruchomić niezatwierdzoną operację; dokument z repo nie dowodzi stanu usługi. Następnie jawne zatwierdzenie Owner dla konkretnego HEAD i wszystkich wymaganych checks. Żadnego domyślnego merge.
- G5 POST-MERGE: zweryfikuj rzeczywisty main merge SHA i skuteczny wynik integracji, wymagane push CI i spójny zapis canonical status. Zielone PR CI nie dowodzą post-merge PASS.
- G6 RELEASE / PAID: oddzielne GO operacyjne; potwierdzone kopie/restore i migracje, zgodność API/DB, rollback, dowód wdrożonego SHA i obserwacja. Żadna zmiana statusu nie może automatycznie autoryzować produkcji lub kosztów.
- G7 CLOSURE: kompletne dossier, trwała referencja do aktualnych dowodów, przeniesione ryzyka, spójność statusów i protokół decyzji Owner.

Wybór bramek NOT APPLICABLE musi być jawny; przy projektach docs-only G2 oznacza zatwierdzoną dokumentację, nie udawane testy runtime.

## 4. Bezpieczeństwo dokumentacji

Repo jest publiczne. Nie zapisuj tutaj: danych osobowych z bazy, treści wiadomości, kopii DB, haseł, kluczy API, CONTACT_DATA_ENCRYPTION_SECRET, kluczy prywatnych, sesji, tokenów, pełnych DATABASE_URL, logów z PII ani zaszyfrowanych archiwów produkcyjnych. Dowody w GitHub muszą być zredagowane, agregowane i bezpieczne; prywatne dowody operatora przechowuj w osobnym szyfrowanym miejscu, opisując wyłącznie identyfikator i opiekuna. Hash pliku nie czyni danych anonimowymi.

## 5. Kolizje i rozdzielenie odpowiedzialności

Jeden materiał implementacyjny = przypisany wykonawca i izolowany PR. Nie edytuj aktywnych gałęzi innych agentów. Osoba uczestnicząca w wykonaniu nie wystawia niezależnego audytu własnego HEAD. Review może wskazać HOLD bez przejęcia implementacji. Powtórzony audyt po korekcie dotyczy nowego HEAD.

Wszystkie aktywne PR, w szczególności newsletter #248 i dokumentacyjny #245, zachowują własne uprawnienia i historię. Ten PR nie poprawia ani nie scala tamtych.

## 6. Szczególne ograniczenia PostgreSQL / Render / Resend

- Istniejące runbooki DR, secret escrow i contact backfill pozostają nadrzędnymi bramkami operacyjnymi.
- **MIGRATION SLOT 005 = BLOCKS_MERGE** każdego PR wprowadzającego plik SQL `005_*` lub produkcyjną DDL, dopóki nie uzgodniono numeracji, kompatybilności, migratora i recovery gates. Szczególnie PR #248 zawiera `005_newsletter_opt_in_requests.sql`, podczas gdy runbooki rezerwują 005 dla odrębnego CONTRACT contact-data. **Nie scalać PR #248**, nie wykonywać migracji ani nie uznawać zmiany nazwy za wystarczającą naprawę. Ten dokumentacyjny PR #249 nie zawiera DDL, jednak sam merge do `main` nadal wymaga kontroli rzeczywistego deploy-coupling według G4.
- Zakaz samoczynnego uruchomienia DDL, produkcyjnych eksperymentów i zmian Render bez osobnego mandatu.
- Rejestruj cutover starych/nowych instancji, downgrade/rollback, stan zgód oraz niespójności dostawcy.
- Resend jest operacyjnym źródłem stanu subskrypcji w aktualnej architekturze; PostgreSQL przechowuje dowody zgody i kontrolę trwałych operacji.

## 7. Podstawy dowodowe i utrzymanie

GitHub jest systemem odniesienia dla PR/SHA/CI. Raport z czatu bez trwałej referencji otrzymuje stan EVIDENCE NOT PERSISTED / HOLD, a nie fikcyjny `independent PASS`. Zapisuj pełne SHA (nie tylko 7-znakowe skróty) i dowody z decyzji Owner, bez sekretów. Wymagane są źródło zdarzenia, data, identyfikator raportu, autor i powiązanie exact HEAD. Linki do CI muszą wskazywać exact HEAD; daty, reviewer i środowiska są jawne. Zapisy historyczne pozostają niezmienione, a sprostowanie otrzymuje własną datę i link. Przy ponownym otwarciu etapu utwórz wersję dossier R2; nie nadpisuj dowodów starego PASS.

**Szablony:** [Dossier etapu](./templates/STAGE-DOSSIER-R1.md), [Lista kontroli dowodów](./templates/AUDIT-CLOSURE-CHECKLIST-R1.md).

**Rejestr programu newsletter:** [NEWSLETTER-OWNER-ADMIN-REGISTER](./NEWSLETTER-OWNER-ADMIN-REGISTER-2026-10-13.md).

**Deklarowany cel właściciela (rozmowa 2026-10-13, publiczny trwały zapis autoryzacji poza tym dossier: PENDING):** przed przekazaniem głównego wysiłku do L6 Gracz Next zakończyć kodowanie i audyty B1, B2, panelu newslettera Owner Admin FULL MAX PREMIUM i końcowe B3. To preferencja kolejności, nie techniczna zależność ani upoważnienie do wdrożenia produkcyjnego.

## 8. Wznowienie po przerwaniu / utracie workspace

Po utracie zadania Codex/Factory/Claude lub limitach: pobierz ponownie `main`, aktualne PR, HEAD/TREE, gałąź, CI i zapisane dowody; zweryfikuj przydział właściciela oraz kolizje, porównaj stan rozmowy z trwałym stanem GitHub. Nie odtwarzaj testów ani PASS z pamięci. Kontynuuj istniejący PR tylko po potwierdzeniu zgodności źródeł i authority. Każdy nieodtwarzalny dowód oznacz UNKNOWN/HOLD. Nie importuj historycznych gałęzi bez analizy diff.

## 9. Wspólne nazwy bramek z Gracz Next

Oba standardy dokumentacyjne używają wspólnej semantyki **G0 SOURCE, G1 DESIGN, G2 IMPLEMENTATION, G3 INDEPENDENT REVIEW, G4 OWNER MERGE, G5 POST-MERGE, G6 RELEASE/PAID, G7 CLOSURE**. Te etykiety są językiem audytu, nie zmieniają istniejących bramek maszynowych AGCAF/CPAED ani hierarchii governance. Typy ustaleń: P0 CRITICAL, P1 BLOCKER/MAJOR, P2 SIGNIFICANT, P3 IMPROVEMENT; w każdym raporcie podać faktyczny wpływ i obowiązujący lokalny model severity.
