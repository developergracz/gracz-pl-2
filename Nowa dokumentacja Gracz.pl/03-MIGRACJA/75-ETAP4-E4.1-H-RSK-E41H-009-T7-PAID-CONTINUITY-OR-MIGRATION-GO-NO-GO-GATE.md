# ETAP 4 — E4.1-H RSK-E41H-009 T-7 Paid Continuity or Migration GO/NO-GO Gate

**Data projektu dokumentu:** 31.08.2026  
**Nominalny termin bramki T-7:** 14.09.2026  
**Repozytorium:** `developergracz/gracz-pl-2`  
**Branch:** `main`  
**Status:** `GATE DESIGN READY / EVIDENCE PACK TEMPLATE READY / GATE NOT EXECUTED / CURRENT PROJECTION HOLD / FREEZE ACTIVE`

---

## 1. Stan wejściowy

```text
F0-F7 = PASS
E4.1-H = PENDING / SAFE HOLD
T-14 GATE DESIGN = READY
T-14 FORMAL REVIEW = NOT EXECUTED
T-10 GATE DESIGN = READY
T-10 FORMAL REVIEW = NOT EXECUTED
BA1 PRODUCTION BACKUP = NOT AUTHORIZED
BA2 ISOLATED RESTORE VALIDATION = NOT AUTHORIZED
BA3 RECOVERY EVIDENCE ACCEPTANCE = NOT AUTHORIZED
NAMED OWNERS = PENDING / UNASSIGNED
RPO/RTO = NOT APPROVED
CONTINUITY OPTION = PENDING
RSK-E41H-009 = OPEN / CRITICAL / TIME-BOUND
A1-A3 = BLOCKED / NOT AUTHORIZED
AUTHORIZED OPERATIONS = NONE
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Dokument jest projektem bramki decyzyjnej. Nie jest wynikiem T-7 i nie udziela zgody na zakup planu, upgrade, utworzenie bazy, backup, restore, zmianę sekretów, cutover, deploy ani wznowienie aplikacji.

---

## 2. Cel T-7

Bramka T-7 ma formalnie rozstrzygnąć, czy przed wygaśnięciem bezpłatnej bazy istnieje wykonalna, finansowo zaakceptowana i odtwarzalna ścieżka ciągłości:

1. `S1` — kontrolowany upgrade istniejącej bazy do zatwierdzonego planu płatnego,
2. `S3` — kontrolowana migracja do nowej bazy z przygotowanym restore i cutoverem,
3. `HOLD` — brak kompletnego mandatu lub dowodów, ale istnieje jeszcze bezpieczny czas na uzupełnienie,
4. `NO-GO` — żadna ścieżka nie spełnia kryteriów bezpieczeństwa albo pozostały czas nie pozwala wykonać jej zgodnie z kontraktem.

T-7 nie zastępuje T-14 ani T-10. PASS wcześniejszej bramki jest warunkiem wejścia, a nie automatycznym PASS T-7.

---

## 3. Granica dokumentu

### 3.1. Dokument obejmuje

- formalny evidence pack T-7,
- porównanie S1 i S3,
- provider capability i eligibility,
- wybór docelowego planu i pojemności,
- dowód akceptacji kosztu,
- akceptację niedostępności,
- walidację backup/PITR i recovery readiness,
- przygotowanie rollbacku S1,
- przygotowanie rollbacku i cutoveru S3,
- kryteria `GO / HOLD / NO-GO`,
- rekord formalnego review.

### 3.2. Dokument nie obejmuje

- wykonania backupu BA1,
- wykonania restore BA2,
- akceptacji BA3,
- zakupu lub zmiany planu,
- zmiany regionu, pojemności, wersji lub konfiguracji bazy,
- utworzenia nowej bazy,
- zmiany `DATABASE_URL` albo innych sekretów,
- uruchomienia aplikacji lub writera,
- deployu, restartu ani cutoveru,
- wykonania E4.1-H,
- scalania PR #26.

---

## 4. Fakty dostawcy — snapshot źródeł

Fakty poniżej zostały sprawdzone 31.08.2026 w oficjalnej dokumentacji Render. Muszą zostać ponownie potwierdzone w formalnym review T-7, ponieważ funkcje i warunki dostawcy mogą się zmienić.

| Fakt kontrolny | Stan źródłowy | Konsekwencja T-7 |
|---|---|---|
| Free Render Postgres wygasa po 30 dniach | potwierdzone w Render Docs | brak działania nie jest ciągłością |
| po expiry istnieje ograniczony okres na upgrade przed usunięciem | potwierdzone w Render Docs | okres ten jest awaryjny, nie plan podstawowy |
| Free Postgres nie ma zarządzanych backupów | potwierdzone w Render Docs | S2 wymaga jawnej ścieżki `pg_dump` albo wcześniejszego upgrade |
| płatne bazy zapewniają PITR i eksporty logiczne | potwierdzone w Render Docs | funkcje muszą być potwierdzone dla wybranego planu |
| zmiana compute planu powoduje krótką niedostępność | potwierdzone w Render Docs | wymagane RTO i akceptacja przerwy |
| upgrade wersji PostgreSQL powoduje niedostępność i powinien być testowany na kopii | potwierdzone w Render Docs | upgrade planu i upgrade wersji to odrębne zmiany |
| restore logiczny może usuwać i odtwarzać obiekty | potwierdzone w Render Docs | restore tylko do pustego, izolowanego targetu |
| ephemeral shell wymaga kompatybilnej usługi na planie płatnym | potwierdzone w Render Docs | nie jest zdolnością obecnego Free service |
| One-Off Job dziedziczy artefakt i zmienne środowiskowe base service | potwierdzone w Render Docs | późniejsze użycie wymaga odrębnej autoryzacji i log review |

Źródła:

- `https://render.com/docs/free`
- `https://render.com/docs/postgresql-backups`
- `https://render.com/docs/postgresql-creating-connecting`
- `https://render.com/docs/postgresql-upgrading`
- `https://render.com/docs/ssh`
- `https://render.com/docs/one-off-jobs`

Dokument nie utrwala ceny jako stałego faktu. Koszt musi pochodzić ze świeżego dashboardu/cennika, być opatrzony `Captured UTC` i zaakceptowany przez Billing Ownera.

---

## 5. Daty kontrolne i clock source

| Punkt | Data nominalna | Znaczenie | Stan |
|---|---:|---|---|
| T-14 | 07.09.2026 | ownership, RPO/RTO, wariant i evidence baseline | NOT EXECUTED |
| T-10 | 11.09.2026 | BA1-BA3 i recovery readiness | NOT EXECUTED |
| T-7 | 14.09.2026 | GO/HOLD/NO-GO S1 vs S3 | NOT EXECUTED |
| T-3 | 18.09.2026 | finalny continuity preflight | NOT EXECUTED |
| expiry | 21.09.2026 według dashboardu | utrata dostępności Free DB | dokładny UTC do potwierdzenia |

Każdy review zapisuje:

```text
REVIEW_OPENED_UTC=
REVIEW_CLOSED_UTC=
EXPIRY_SOURCE=
EXPIRY_CAPTURED_UTC=
EXPIRY_EXACT_UTC=
TIME_REMAINING_AT_CLOSE=
CLOCK_SOURCE=
```

Brak dokładnego i świeżego źródła czasu oznacza `HOLD`.

---

## 6. Zależności i kolejność

```text
T-14 FORMAL PASS
  -> T-10 FORMAL PASS
      -> BA1 PASS
          -> BA2 PASS
              -> BA3 PASS
                  -> T-7 FORMAL REVIEW
                      -> T-3 FINAL GATE
                          -> DOCUMENT 77 AUTHORIZATION RECORD
```

Żaden krok nie może być inferowany z istnienia dokumentu. Każdy wymaga osobnego, podpisanego evidence recordu.

---

## 7. Modele decyzji

### 7.1. S1 — paid continuity istniejącej bazy

S1 oznacza zatwierdzoną zmianę compute planu istniejącego zasobu Render Postgres przed expiry.

S1 nie oznacza automatycznie:

- upgrade wersji PostgreSQL,
- zmiany regionu,
- zwiększenia storage,
- wznowienia aplikacji,
- wykonania E4.1-H,
- zgody A2 lub A3.

### 7.2. S3 — controlled migration

S3 oznacza utworzenie zatwierdzonego targetu, odtworzenie zwalidowanego backupu, pełną walidację oraz osobny cutover.

S3 nie może używać produkcyjnej bazy jako targetu restore i nie może dopuścić dwóch aktywnych writerów.

### 7.3. S2 — backup prerequisite

S2 jest warstwą ochronną i warunkiem decyzji. Sam backup nie zapewnia dostępności po expiry i nie jest samodzielnym wariantem ciągłości.

### 7.4. S0 — brak działania

S0 pozostaje `REJECTED AS PRIMARY PLAN`. Brak wykonania operacji w freeze jest poprawny dziś, ale brak formalnej decyzji przed deadline nie może zostać uznany za bezpieczną strategię ciągłości.

---

## 8. Wyniki bramki T-7

Formalny wynik jest jednym z poniższych:

```text
GO-S1
GO-S3
HOLD
NO-GO
```

Nie dopuszcza się wyniku `PASS` bez wskazania wybranej ścieżki.

### 8.1. GO-S1

Oznacza, że S1 jest rekomendowane do późniejszej autoryzacji. Nie uruchamia upgrade.

### 8.2. GO-S3

Oznacza, że S3 jest rekomendowane do późniejszej autoryzacji. Nie tworzy bazy i nie uruchamia migracji.

### 8.3. HOLD

Oznacza niekompletność dowodów, ról, kosztu lub decyzji przy zachowanej możliwości bezpiecznego uzupełnienia przed T-3.

### 8.4. NO-GO

Oznacza brak bezpiecznej i wykonalnej ścieżki w pozostałym czasie albo wystąpienie krytycznego warunku zakazującego wykonania.

---

## 9. Zasada braku autoryzacji

T-7 może rekomendować wariant, ale nie może wykonać zmiany.

```text
T7-GO-S1 != AUTHORIZATION TO UPGRADE
T7-GO-S3 != AUTHORIZATION TO CREATE / RESTORE / CUTOVER
T7-HOLD != APPROVAL TO USE AN EXCEPTION
T7-NO-GO != AUTHORIZATION TO DELETE OR ABANDON DATA
```

Wykonanie pozostaje zależne od dokumentu 77 i jawnych zgód A1/A2/A3.

---

## 10. Evidence pack — reguły ogólne

Każda kontrola ma pola:

| Pole | Wymaganie |
|---|---|
| Evidence ID | unikalny identyfikator `EVD-T7-*` |
| Owner | osoba w stanie ACTIVE |
| Reviewer | niezależna osoba, jeśli wymagane |
| Source | dokument, dashboard, log lub zatwierdzony rekord |
| Captured UTC | czas pozyskania |
| SHA-256 | wymagany dla plików |
| Classification | PUBLIC / INTERNAL / CONFIDENTIAL / SECRET-PROHIBITED |
| Quality | Q0-Q5 zgodnie z dokumentem 73 |
| Result | PASS / FAIL / UNKNOWN / N/A-JUSTIFIED |
| Expiry | termin ważności dowodu |
| Notes | bez sekretów i danych osobowych |

`UNKNOWN`, puste pole albo dowód po terminie ważności nie daje PASS.

---

## 11. Domena A — prerequisite chain (10 kontroli)

| Evidence ID | Kontrola | Minimalny dowód | Kryterium PASS |
|---|---|---|---|
| `EVD-T7-A01` | formalny wynik T-14 | podpisany Gate Review Record | formalny PASS, nie projekcja |
| `EVD-T7-A02` | formalny wynik T-10 | podpisany Gate Review Record | formalny PASS |
| `EVD-T7-A03` | BA1 | backup execution record | PASS i artefakt istnieje |
| `EVD-T7-A04` | BA2 | isolated restore record | PASS na pustym targetcie |
| `EVD-T7-A05` | BA3 | independent evidence acceptance | PASS bez niezamkniętych critical gaps |
| `EVD-T7-A06` | expiry | dashboard/provider evidence | dokładny termin i fresh capture |
| `EVD-T7-A07` | RPO | podpis Data Ownera | wartość jawna i zaakceptowana |
| `EVD-T7-A08` | RTO | podpis Business Ownera | wartość jawna i zaakceptowana |
| `EVD-T7-A09` | option baseline | DEC-009-03 | S1/S3 porównane, bez pustego wyboru |
| `EVD-T7-A10` | freeze/change state | repo + change record | brak nieautoryzowanej zmiany |

Bloker w A01-A08 wymusza `HOLD` albo `NO-GO` zależnie od pozostałego czasu.

---

## 12. Domena O — ownership and authority (10 kontroli)

| Evidence ID | Kontrola | Minimalny dowód | Kryterium PASS |
|---|---|---|---|
| `EVD-T7-O01` | Business Service Owner | OWN-01 ACTIVE | zaakceptowane RTO i downtime |
| `EVD-T7-O02` | Data Owner | OWN-02 ACTIVE | zaakceptowane RPO, retencja, recovery point |
| `EVD-T7-O03` | Change Owner | OWN-03 ACTIVE | scope i pakiet review kompletny |
| `EVD-T7-O04` | Change Authorizer | OWN-04 ACTIVE | mandat zweryfikowany |
| `EVD-T7-O05` | Provider Operations Owner | OWN-05 ACTIVE | eligibility i plan potwierdzone |
| `EVD-T7-O06` | Billing Owner | OWN-06 ACTIVE | koszt zaakceptowany |
| `EVD-T7-O07` | Database Reviewer | OWN-07 ACTIVE | backup/restore i compatibility reviewed |
| `EVD-T7-O08` | Security Reviewer | OWN-08 ACTIVE | sekrety, ACL i retencja reviewed |
| `EVD-T7-O09` | Rollback + Incident owners | OWN-12 i OWN-14 ACTIVE | dostępność w oknie potwierdzona |
| `EVD-T7-O10` | Independent Evidence Reviewer | OWN-15 ACTIVE | niezależność i wynik review zapisane |

Brak jednej roli wymaganej dla wybranego wariantu oznacza `DECISION BLOCKED`.

---

## 13. Domena P — provider and target capability (12 kontroli)

| Evidence ID | Kontrola | Minimalny dowód | Kryterium PASS |
|---|---|---|---|
| `EVD-T7-P01` | tożsamość obecnej bazy | redacted dashboard evidence | właściwy resource ID i region |
| `EVD-T7-P02` | stan Free DB | dashboard evidence | Available, bez incydentu |
| `EVD-T7-P03` | eligibility S1 | provider/dashboard evidence | upgrade dostępny dla zasobu |
| `EVD-T7-P04` | lista planów | fresh official evidence | dostępne plany z datą capture |
| `EVD-T7-P05` | selected compute | signed selection | jawny plan i uzasadnienie |
| `EVD-T7-P06` | selected storage | capacity worksheet | headroom zaakceptowany |
| `EVD-T7-P07` | PITR | plan-specific provider evidence | PITR potwierdzone dla planu |
| `EVD-T7-P08` | logical exports | plan-specific evidence | eksporty dostępne i retencja znana |
| `EVD-T7-P09` | maintenance/restart behavior | official evidence | wpływ udokumentowany |
| `EVD-T7-P10` | version compatibility | source/target version record | brak nierozwiązanego incompatibility |
| `EVD-T7-P11` | region/network compatibility | architecture review | aplikacja może połączyć się po autoryzacji |
| `EVD-T7-P12` | provider incident status | status evidence | brak aktywnego incidentu blokującego |

Nie wolno zastąpić świeżego dashboard evidence samą treścią dokumentu 67 albo 71.

---

## 14. Domena F — financial and commercial approval (8 kontroli)

| Evidence ID | Kontrola | Minimalny dowód | Kryterium PASS |
|---|---|---|---|
| `EVD-T7-F01` | cena planu | fresh pricing/dashboard capture | waluta, okres i VAT/fees jawne |
| `EVD-T7-F02` | koszt compute | signed worksheet | miesięczny koszt zaakceptowany |
| `EVD-T7-F03` | koszt storage | signed worksheet | obecny i prognozowany koszt |
| `EVD-T7-F04` | koszt overlap S3 | migration worksheet | okres podwójnych zasobów policzony |
| `EVD-T7-F05` | koszt backup/retention | storage worksheet | magazyn i retencja zaakceptowane |
| `EVD-T7-F06` | metoda płatności | billing readiness record | metoda ważna, bez ujawnienia danych |
| `EVD-T7-F07` | limit/budget | Billing Owner approval | mandat i limit wystarczające |
| `EVD-T7-F08` | renewal/exit | commercial decision | cykl rozliczenia i rezygnacja znane |

Numery kart, tokeny płatnicze i dane rozliczeniowe nie mogą trafić do GitHub ani evidence packu.

---

## 15. Domena I — S1 in-place paid continuity (10 kontroli)

| Evidence ID | Kontrola | Minimalny dowód | Kryterium PASS |
|---|---|---|---|
| `EVD-T7-I01` | scope S1 | signed change scope | wyłącznie plan, bez ukrytych zmian |
| `EVD-T7-I02` | pre-change snapshot | BA1/BA3 reference | fresh recovery point zaakceptowany |
| `EVD-T7-I03` | przewidywana przerwa | provider + test evidence | mieści się w RTO |
| `EVD-T7-I04` | writer state | service inventory | wszystkie writery zatrzymane/zakazane |
| `EVD-T7-I05` | suspended app invariant | Render evidence | brak automatycznego resume/deploy |
| `EVD-T7-I06` | change steps | reviewed runbook | kroki, ownerzy i checkpointy kompletne |
| `EVD-T7-I07` | abort criteria | runbook | jednoznaczne i mierzalne |
| `EVD-T7-I08` | post-change DB checks | checklist | availability, version, rows, TLS, read-only probe |
| `EVD-T7-I09` | rollback/incident path | provider-supported plan | wykonalny albo jawnie ograniczony |
| `EVD-T7-I10` | monitoring | dashboard/log plan | owner i czas obserwacji wskazane |

Jeżeli provider nie umożliwia bezpiecznego rollbacku planu, ten fakt musi zostać jawnie zaakceptowany jako ryzyko; nie wolno deklarować nieistniejącego rollbacku.

---

## 16. Domena M — S3 controlled migration (12 kontroli)

| Evidence ID | Kontrola | Minimalny dowód | Kryterium PASS |
|---|---|---|---|
| `EVD-T7-M01` | target identity | approved design | nowy, pusty i jednoznaczny target |
| `EVD-T7-M02` | target plan | signed plan selection | compute/storage wystarczające |
| `EVD-T7-M03` | target version | compatibility matrix | zgodna ścieżka restore |
| `EVD-T7-M04` | target region | latency/network review | zaakceptowany region |
| `EVD-T7-M05` | restore source | BA3 evidence | właściwy hash i recovery point |
| `EVD-T7-M06` | restore runbook | reviewed procedure | pusty target, stop-on-error, log policy |
| `EVD-T7-M07` | structural validation | schema evidence | 28/28 lub świeży oczekiwany manifest |
| `EVD-T7-M08` | row reconciliation | count evidence | zero niewyjaśnionych różnic |
| `EVD-T7-M09` | crypto preservation | design review | ciphertext niezmieniony; brak eksportu kluczy |
| `EVD-T7-M10` | cutover plan | signed runbook | pojedynczy writer i atomiczny switch |
| `EVD-T7-M11` | rollback plan | old-target retention record | stara baza zachowana przez zatwierdzony okres |
| `EVD-T7-M12` | cleanup plan | owner + criteria | brak przedwczesnego usunięcia źródła |

S3 nie uzyskuje GO, jeżeli wymagany cutover zależy od wznowienia aplikacji w freeze albo od kopiowania kluczy poza zatwierdzony boundary.

---

## 17. Domena D — decision, rollback and timing (8 kontroli)

| Evidence ID | Kontrola | Minimalny dowód | Kryterium PASS |
|---|---|---|---|
| `EVD-T7-D01` | weighted decision matrix | signed matrix | S1 i S3 ocenione tymi samymi kryteriami |
| `EVD-T7-D02` | selected primary path | DEC-009-06/07 | dokładnie jedna ścieżka primary |
| `EVD-T7-D03` | fallback path | signed fallback record | trigger i owner zdefiniowane |
| `EVD-T7-D04` | controlled window | draft window record | czas mieści się przed T-3/expiry |
| `EVD-T7-D05` | rollback decision point | runbook checkpoint | nieodwracalność jawnie wskazana |
| `EVD-T7-D06` | downtime acceptance | Business Owner record | przerwa mieści się w RTO |
| `EVD-T7-D07` | residual risk acceptance | Data + Change owners | brak niejawnej akceptacji |
| `EVD-T7-D08` | independent recommendation | reviewer record | GO-S1/GO-S3/HOLD/NO-GO podpisane |

---

## 18. Podsumowanie evidence packu

| Domena | Zakres ID | Liczba |
|---|---|---:|
| A — prerequisites | `EVD-T7-A01`–`A10` | 10 |
| O — ownership | `EVD-T7-O01`–`O10` | 10 |
| P — provider | `EVD-T7-P01`–`P12` | 12 |
| F — financial | `EVD-T7-F01`–`F08` | 8 |
| I — S1 in-place | `EVD-T7-I01`–`I10` | 10 |
| M — S3 migration | `EVD-T7-M01`–`M12` | 12 |
| D — decision | `EVD-T7-D01`–`D08` | 8 |
| **Łącznie** |  | **70** |

Kompletność szablonu nie oznacza kompletności dowodów.

---

## 19. Macierz porównania S1 i S3

Każdy wpis otrzymuje score `0–5`, uzasadnienie i odsyłacz do Evidence ID. Wagi zatwierdzają named owners.

| Kryterium | Waga | S1 | S3 | Owner | Evidence |
|---|---:|---:|---:|---|---|
| spełnienie RPO | TBD | TBD | TBD | Data Owner | A07, I02, M05 |
| spełnienie RTO | TBD | TBD | TBD | Business Owner | A08, I03, D06 |
| koszt 30/90/365 dni | TBD | TBD | TBD | Billing Owner | F01-F08 |
| złożoność | TBD | TBD | TBD | Change Owner | I06, M06-M10 |
| rollback | TBD | TBD | TBD | Rollback Owner | I09, M11 |
| poufność | TBD | TBD | TBD | Security Reviewer | O08, M09 |
| odtwarzalność | TBD | TBD | TBD | DB Reviewer | A03-A05 |
| ryzyko dostawcy | TBD | TBD | TBD | Provider Owner | P01-P12 |
| czas do wykonania | TBD | TBD | TBD | Change Authorizer | D04 |
| zdolność do E4.1-H | TBD | TBD | TBD | Technical Owner | provider execution review |

`TBD` w wadze albo score w czasie formalnego review oznacza `HOLD`.

---

## 20. Kryteria GO-S1

GO-S1 wymaga łącznie:

- [ ] T-14 formal PASS,
- [ ] T-10 formal PASS,
- [ ] BA1, BA2 i BA3 PASS,
- [ ] named owners ACTIVE,
- [ ] RPO i RTO zaakceptowane,
- [ ] fresh provider eligibility PASS,
- [ ] konkretny plan płatny wybrany,
- [ ] PITR i logical exports potwierdzone dla planu,
- [ ] pełny koszt zaakceptowany,
- [ ] downtime mieści się w RTO,
- [ ] writer inventory i suspended app invariant PASS,
- [ ] runbook, abort i post-change checks READY,
- [ ] fallback S3 co najmniej DESIGN READY,
- [ ] brak critical gap,
- [ ] niezależny reviewer rekomenduje GO-S1.

GO-S1 nie aktywuje upgrade.

---

## 21. Kryteria GO-S3

GO-S3 wymaga łącznie:

- [ ] T-14 formal PASS,
- [ ] T-10 formal PASS,
- [ ] BA1, BA2 i BA3 PASS,
- [ ] named owners ACTIVE,
- [ ] RPO i RTO zaakceptowane,
- [ ] nowy target i plan wybrane,
- [ ] koszt overlap zaakceptowany,
- [ ] version/extension compatibility PASS,
- [ ] restore runbook zweryfikowany,
- [ ] reconciliation contract gotowy,
- [ ] pojedynczy writer zapewniony,
- [ ] cutover i rollback mają ownerów,
- [ ] old DB retention zaakceptowana,
- [ ] cleanup nie usuwa źródła przed evidence acceptance,
- [ ] brak critical gap,
- [ ] niezależny reviewer rekomenduje GO-S3.

GO-S3 nie aktywuje utworzenia bazy, restore ani cutoveru.

---

## 22. Kryteria HOLD

HOLD jest obowiązkowe, gdy co najmniej jeden warunek występuje, ale bezpieczne uzupełnienie przed T-3 pozostaje realistyczne:

- T-14 albo T-10 nie ma formalnego wyniku,
- BA1-BA3 są niekompletne,
- właściciel pozostaje `UNASSIGNED`, `NOMINATED` lub `ACCEPTED`, ale nie `ACTIVE`,
- RPO/RTO nie są zatwierdzone,
- koszt lub metoda płatności nie są zatwierdzone,
- plan-specific PITR/export evidence jest nieświeże,
- downtime nie został zaakceptowany,
- S1 i S3 nie zostały porównane,
- rollback lub fallback jest niekompletny,
- istnieje `UNKNOWN`, Q0-Q2 albo nierozstrzygnięty high gap,
- freeze pozostaje ACTIVE i nie istnieje późniejsza ścieżka autoryzacji.

---

## 23. Kryteria NO-GO

NO-GO jest obowiązkowe, gdy:

- nie istnieje możliwa do wykonania ścieżka przed expiry,
- provider nie pozwala na S1, a S3 nie ma zgodnego targetu,
- nie istnieje zwalidowany recovery point,
- integralność backupu lub restore nie została potwierdzona,
- wymagany sekret został ujawniony albo chain of custody jest niewiarygodny,
- koszt został odrzucony dla S1 i S3,
- RPO/RTO nie mogą zostać spełnione,
- cutover wymaga dwóch aktywnych writerów,
- rollback/fallback jest technicznie niemożliwy i ryzyko nie zostało jawnie zaakceptowane,
- pozostały czas jest krótszy niż minimalny bezpieczny czas wykonania z buforem,
- formalny reviewer stwierdzi konflikt dowodów krytycznych.

NO-GO uruchamia eskalację ciągłości, ale nie autoryzuje usuwania danych ani obchodzenia freeze.

---

## 24. Minimalny bufor czasowy

Change Owner przygotowuje jawny harmonogram:

```text
PLAN_PREPARATION_DURATION=
BACKUP_DURATION=
RESTORE_DURATION=
RECONCILIATION_DURATION=
PROVIDER_CHANGE_DURATION=
CUTOVER_DURATION=
OBSERVATION_DURATION=
ROLLBACK_DURATION=
SAFETY_BUFFER=
TOTAL_REQUIRED_TIME=
TIME_REMAINING=
```

Jeżeli `TIME_REMAINING < TOTAL_REQUIRED_TIME`, wynik nie może być GO.

---

## 25. Rollback S1

Ponieważ provider może nie gwarantować prostego powrotu do planu Free, rollback S1 nie może być opisany jako fikcyjne „cofnięcie kliknięcia”. Musi wskazywać faktycznie obsługiwaną ścieżkę:

1. zatrzymanie procesu przy błędzie,
2. zachowanie bazy w stanie dostępnym,
3. użycie PITR/clone/restore wyłącznie jeśli funkcja jest aktywna i zatwierdzona,
4. eskalację do Render Support, jeżeli provider path tego wymaga,
5. zakaz wznowienia writerów bez pozytywnej walidacji,
6. uruchomienie S3 fallback, jeżeli spełnia własne kryteria.

---

## 26. Rollback S3

Minimalny rollback S3:

1. źródłowa baza pozostaje zachowana,
2. stary connection target nie jest niszczony podczas cutoveru,
3. writer jest zatrzymany przed przełączeniem,
4. punkt nieodwracalności jest jawny,
5. rollback zmiennej połączeniowej ma osobną zgodę,
6. dane powstałe po cutoverze nie są automatycznie scalane,
7. rollback owner ocenia ryzyko rozbieżności,
8. cleanup targetu następuje dopiero po zamknięciu evidence.

---

## 27. Security boundary

W evidence packu zabronione są:

- pełne Internal/External Database URL,
- hasła, tokeny API i klucze Render CLI,
- klucze szyfrowania wiadomości lub załączników,
- dane kart i metody płatności,
- pełne wartości zmiennych środowiskowych,
- dumpy i ich zawartość,
- dane osobowe rekordów produkcyjnych.

Dozwolone są wyłącznie zredagowane identyfikatory, hashe, czasy, liczby i statusy.

---

## 28. Gap register — stan początkowy

| Gap ID | Luka | Severity | Stan |
|---|---|---|---|
| `GAP-T7-001` | T-14 formal review niewykonany | CRITICAL | OPEN |
| `GAP-T7-002` | T-10 formal review niewykonany | CRITICAL | OPEN |
| `GAP-T7-003` | BA1-BA3 nieautoryzowane i niewykonane | CRITICAL | OPEN |
| `GAP-T7-004` | named owners nieprzypisani | CRITICAL | OPEN |
| `GAP-T7-005` | RPO/RTO niezatwierdzone | HIGH | OPEN |
| `GAP-T7-006` | koszt i Billing Owner approval nie istnieją | HIGH | OPEN |
| `GAP-T7-007` | plan-specific provider evidence nie istnieje | HIGH | OPEN |
| `GAP-T7-008` | S1/S3 decision matrix niewypełniona | HIGH | OPEN |
| `GAP-T7-009` | controlled window nieustalone | HIGH | OPEN |
| `GAP-T7-010` | dokładny expiry UTC niepotwierdzony | HIGH | OPEN |

Otwarte GAP-T7-001–004 uniemożliwiają GO.

---

## 29. Abort triggers

Review lub późniejsze przygotowanie jest natychmiast zatrzymywane, gdy:

- źródło lub target nie są jednoznaczne,
- pojawi się sekret w logu lub dokumencie,
- hash backupu nie jest zgodny,
- liczby tabel/rekordów mają niewyjaśnione różnice,
- writer zostanie uruchomiony bez zgody,
- Render wykona nieoczekiwaną zmianę zasobu,
- incident dostawcy wpływa na bazę,
- wybrany plan/funkcja przestanie być dostępna,
- czas wykonania przekroczy bezpieczny bufor,
- właściciel wycofa akceptację,
- freeze zostanie naruszony,
- PR #26 zostanie scalony lub Production V3 zmienione bez osobnej zgody.

---

## 30. T-7 Gate Review Record

```text
GATE_ID=E4.1-H-T7
REVIEW_OPENED_UTC=
REVIEW_CLOSED_UTC=
EXPIRY_EXACT_UTC=
TIME_REMAINING=
EVIDENCE_MANIFEST_SHA256=
T14_FORMAL_RESULT=
T10_FORMAL_RESULT=
BA1_RESULT=
BA2_RESULT=
BA3_RESULT=
NAMED_OWNERS_RESULT=
RPO_RESULT=
RTO_RESULT=
S1_CAPABILITY_RESULT=
S3_CAPABILITY_RESULT=
FINANCIAL_APPROVAL_RESULT=
SECURITY_REVIEW_RESULT=
ROLLBACK_REVIEW_RESULT=
INDEPENDENT_REVIEW_RESULT=
FINAL_RESULT=GO-S1|GO-S3|HOLD|NO-GO
SELECTED_PRIMARY_PATH=
FALLBACK_PATH=
OPEN_GAPS=
RESIDUAL_RISKS=
CHANGE_AUTHORIZER=
DATA_OWNER=
BUSINESS_OWNER=
BILLING_OWNER=
INDEPENDENT_REVIEWER=
SIGNATURE_REFERENCES=
```

Puste pole wymagane dla decyzji oznacza `HOLD`.

---

## 31. Działania po wyniku

### Po GO-S1

- utrwalić recommendation record,
- zamrozić evidence manifest,
- przygotować T-3,
- nie wykonywać upgrade,
- przekazać zależności do dokumentu 77.

### Po GO-S3

- utrwalić recommendation record,
- zamrozić target/cutover design,
- przygotować T-3,
- nie tworzyć bazy i nie wykonywać restore/cutover,
- przekazać zależności do dokumentu 77.

### Po HOLD

- przypisać ownera i deadline każdej luki,
- ponowić review tylko z nową wersją evidence manifestu,
- nie skracać kryteriów z powodu presji czasu.

### Po NO-GO

- eskalować RSK-E41H-009,
- zabezpieczyć istniejące recovery evidence,
- zakazać działań ad hoc,
- udokumentować decyzję biznesową o dalszym postępowaniu.

---

## 32. Powiązania dokumentacyjne

Dokument należy czytać razem z:

- `62-ETAP4-E4.1-F-RESTORE-VALIDATION-EXECUTION-LOG.md`,
- `63-ETAP4-E4.1-H-FRESH-CRYPTO-DECRYPTABILITY-EXECUTION-PLAN.md`,
- `66-ETAP4-E4.1-H-EVIDENCE-CONTRACT-AND-REVIEW-CHECKLIST.md`,
- `67-ETAP4-E4.1-H-RENDER-PROVIDER-CAPABILITY-ASSESSMENT.md`,
- `69-ETAP4-E4.1-H-CHANGE-AUTHORIZATION-EXECUTION-WINDOW-ROLLBACK-CLEANUP-CONTRACT.md`,
- `70-ETAP4-E4.1-H-RISK-REGISTER-AND-IMPLEMENTATION-READINESS-MATRIX.md`,
- `71-ETAP4-E4.1-H-RENDER-POSTGRES-CONTINUITY-AND-RETENTION-PLAN.md`,
- `72-ETAP4-E4.1-H-NAMED-OWNERSHIP-AND-CONTINUITY-DECISION-RECORD.md`,
- `73-ETAP4-E4.1-H-RSK-E41H-009-T14-CONTINUITY-DECISION-GATE-AND-EVIDENCE-PACK.md`,
- `74-ETAP4-E4.1-H-RSK-E41H-009-T10-BACKUP-AUTHORIZATION-AND-RECOVERY-READINESS-GATE.md`.

---

## 33. Triggery ponownego review

T-7 review trzeba wykonać ponownie, gdy:

- zmieni się expiry albo status bazy,
- zmieni się plan, cena, storage albo funkcja provider,
- zmieni się RPO/RTO,
- zmieni się backup hash lub recovery point,
- zmieni się S1/S3 recommendation,
- zmieni się named owner lub jego mandat,
- pojawi się incident,
- zmieni się aplikacja, writer inventory albo target,
- zmieni się freeze, PR #26 lub Production V3,
- dowód przekroczy termin ważności.

---

## 34. Bieżąca decyzja

```text
T-7 GATE DESIGN = READY
EVIDENCE PACK TEMPLATE = READY / 70 CONTROLS
EVIDENCE PACK EXECUTION = NOT STARTED
FORMAL T-7 REVIEW = NOT EXECUTED
CURRENT PROJECTION = HOLD
GO-S1 = NOT GRANTED
GO-S3 = NOT GRANTED
CONTINUITY OPTION = PENDING
PAID PLAN = NOT SELECTED / NOT AUTHORIZED
MIGRATION TARGET = NOT SELECTED / NOT AUTHORIZED
T-14 FORMAL REVIEW = NOT EXECUTED
T-10 FORMAL REVIEW = NOT EXECUTED
BA1 / BA2 / BA3 = NOT AUTHORIZED
AUTHORIZED OPERATIONS = NONE
RSK-E41H-009 = OPEN / CRITICAL / TIME-BOUND
A1 READINESS = BLOCKED
A2 READINESS = BLOCKED
A3 READINESS = BLOCKED
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Dokument nie zmienia środowiska i nie stanowi autoryzacji operacyjnej.

---

## 35. Następny krok dokumentacyjny

Następnym artefaktem powinien być:

`76-ETAP4-E4.1-H-RSK-E41H-009-T3-FINAL-CONTINUITY-DECISION-GATE.md`

Zakres:

- finalna bramka T-3,
- potwierdzenie wybranej ścieżki S1 albo S3,
- finalny time/buffer check,
- finalne owner, billing, provider, backup, restore, rollback i security evidence,
- rozstrzygnięcie `READY FOR AUTHORIZATION / HOLD / NO-GO`,
- brak wykonania jakiejkolwiek operacji bez dokumentu 77.

