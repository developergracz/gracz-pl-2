# GRACZ.PL — FULL MAX PRO: standard dowodów i zamykania etapów R1

**Data propozycji:** 2026-10-13  
**Stan:** PROPOSED / DRAFT PR / NOT YET BINDING  
**Zakres:** developergracz/gracz-pl-2, dokumentowanie prac wykonywanych od chwili przyjęcia standardu.  
**Właściciel decyzji:** Owner. **Przygotowanie:** Lead Architect. **Wykonawcy:** zgodnie z przypisanym zadaniem.  

Ten dokument jest propozycją procesu, a nie potwierdzeniem zakończenia istniejących etapów. Stanie się przyjętym standardem dopiero po osobnej decyzji Owner i kontrolowanym scaleniu. Nie zmienia istniejącej architektury, nie znosi ograniczeń bezpieczeństwa, nie upoważnia do merge ani deploy.

## 1. Zasada podstawowa

**ETAP CLOSED = zakres wdrożony + wymagane testy + niezależna ocena + dowody + pełna dokumentacja + decyzja Owner + stan GitHub odpowiadający decyzji.**

Statusy rozdzielamy jednoznacznie:
- PROPOSED: specyfikacja bez autoryzacji.
- ACTIVE: praca trwa, właściciel i PR/gałąź są znane.
- IMPLEMENTED: kod zapisany, ale jeszcze nie zatwierdzony.
- READY_FOR_INDEPENDENT_REVIEW: wynik wykonawcy, bez twierdzenia o niezależnym PASS.
- REVIEW_HOLD / BLOCKED: błąd, kolizja lub brak dowodu.
- REVIEW_PASS: niezależna kontrola konkretnego HEAD zakończona PASS, nie implikuje merge.
- READY_TO_MERGE: aktualny exact-head review i CI, wszystkie bramki i osobna zgoda Owner.
- MERGED: commit/scalenie zweryfikowane na main, ale nie oznacza produkcji.
- DEPLOYED: zweryfikowany SHA produkcji + kontrole po wdrożeniu.
- CLOSED: kompletne dowody dla **zadeklarowanego zakresu** i zatwierdzony protokół zamknięcia; produkcja może pozostać osobno HOLD.
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

- G0 SCOPE: aktualne main, kolizje PR, istniejące dokumenty, ownership, brak niezatwierdzonych zmian.
- G1 DESIGN: kontrakty, zagrożenia, ADR, plan testów, migracje i strategie wstecznej kompatybilności.
- G2 IMPLEMENTATION: zapisany kod, pełna mapa diff, narzędzia i testy, brak nieujawnionych zmian.
- G3 INDEPENDENT REVIEW: zewnętrzny wobec wykonawcy reviewer; dowody oparte na final HEAD; testy niepowiązane z zakresem nie liczą się.
- G4 OWNER MERGE: jawne zatwierdzenie konkretnego HEAD i gotowych checks; żadnych domyślnych lub autonomicznych merge.
- G5 RELEASE: osobne GO produkcyjne, kopia/restore i migracje, zgodność API/DB, rollback i obserwacja; niezależne od CLOSED kodowania.
- G6 CLOSURE: ukończony dossier, niezmienna referencja do dowodów, przeniesione ryzyka, protokół Owner.

Wybór bramek NOT APPLICABLE musi być jawny; przy projektach docs-only G2 oznacza zatwierdzoną dokumentację, nie udawane testy runtime.

## 4. Bezpieczeństwo dokumentacji

Repo jest publiczne. Nie zapisuj tutaj: danych osobowych z bazy, treści wiadomości, kopii DB, haseł, kluczy API, CONTACT_DATA_ENCRYPTION_SECRET, kluczy prywatnych, sesji, tokenów, pełnych DATABASE_URL, logów z PII ani zaszyfrowanych archiwów produkcyjnych. Dowody w GitHub muszą być zredagowane, agregowane i bezpieczne; prywatne dowody operatora przechowuj w osobnym szyfrowanym miejscu, opisując wyłącznie identyfikator i opiekuna. Hash pliku nie czyni danych anonimowymi.

## 5. Kolizje i rozdzielenie odpowiedzialności

Jeden materiał implementacyjny = przypisany wykonawca i izolowany PR. Nie edytuj aktywnych gałęzi innych agentów. Osoba uczestnicząca w wykonaniu nie wystawia niezależnego audytu własnego HEAD. Review może wskazać HOLD bez przejęcia implementacji. Powtórzony audyt po korekcie dotyczy nowego HEAD.

Wszystkie aktywne PR, w szczególności newsletter #248 i dokumentacyjny #245, zachowują własne uprawnienia i historię. Ten PR nie poprawia ani nie scala tamtych.

## 6. Szczególne ograniczenia PostgreSQL / Render / Resend

- Istniejące runbooki DR, secret escrow i contact backfill pozostają nadrzędnymi bramkami operacyjnymi.
- Numer migracji 005 jest aktualnie objęty kolizją / HOLD; standard nie zatwierdza nowej migracji ani sekwencji.
- Zakaz samoczynnego uruchomienia DDL, produkcyjnych eksperymentów i zmian Render bez osobnego mandatu.
- Rejestruj cutover starych/nowych instancji, downgrade/rollback, stan zgód oraz niespójności dostawcy.
- Resend jest operacyjnym źródłem stanu subskrypcji w aktualnej architekturze; PostgreSQL przechowuje dowody zgody i kontrolę trwałych operacji.

## 7. Podstawy dowodowe i utrzymanie

GitHub jest systemem odniesienia dla PR/SHA/CI. Raport z czatu nie wystarcza bez trwałej referencji. Linki do CI muszą wskazywać exact HEAD; daty, reviewer i środowiska są jawne. Zapisy historyczne pozostają niezmienione, a sprostowanie otrzymuje własną datę i link. Przy ponownym otwarciu etapu utwórz wersję dossier R2; nie nadpisuj dowodów starego PASS.

**Szablony:** [Dossier etapu](./templates/STAGE-DOSSIER-R1.md), [Lista kontroli dowodów](./templates/AUDIT-CLOSURE-CHECKLIST-R1.md).

**Rejestr programu newsletter:** [NEWSLETTER-OWNER-ADMIN-REGISTER](./NEWSLETTER-OWNER-ADMIN-REGISTER-2026-10-13.md).

**Niezmienny cel właściciela:** przed przekazaniem głównego wysiłku do L6 Gracz Next zakończyć kodowanie i audyty B1, B2, panelu newslettera Owner Admin FULL MAX PREMIUM i końcowe B3. To preferencja kolejności, nie upoważnienie do wdrożenia produkcyjnego.
