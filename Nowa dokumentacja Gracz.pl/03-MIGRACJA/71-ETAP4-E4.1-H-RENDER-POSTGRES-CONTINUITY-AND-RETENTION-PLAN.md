# ETAP 4 — E4.1-H Render Postgres Continuity and Retention Plan

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **PLAN READY / DECISION PENDING / NO ACTION AUTHORIZED / FREEZE ACTIVE**  
Production V3: **NO-GO**

> Dokument określa plan ochrony ciągłości i retencji bazy `gracz-pl-database` przed wskazanym przez Render terminem wygaśnięcia 21.09.2026. Nie autoryzuje zmiany planu, płatności, eksportu, `pg_dump`, utworzenia nowej bazy, restore, przełączenia aplikacji, zmiany environment, wznowienia usługi ani żadnej operacji produkcyjnej.

## 1. Decyzja bieżąca

```text
RSK-E41H-009 = OPEN / CRITICAL / TIME-BOUND
DATABASE EXPIRY DATE = 2026-09-21 / REQUIRES FRESH PROVIDER CONFIRMATION
CONTINUITY PLAN = READY
CONTINUITY OPTION = NOT SELECTED
NAMED DATA OWNER = PENDING
NAMED BILLING/PROVIDER OWNER = PENDING
BACKUP REFRESH = NOT AUTHORIZED
PLAN UPGRADE = NOT AUTHORIZED
RESTORE OR CUTOVER = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
```

Dokumentacja może być rozwijana w czasie freeze. Każdy dostęp do produkcyjnej bazy, zmiana zasobu Render, operacja billingowa lub utworzenie nowego zasobu wymaga odrębnej, pisemnej autoryzacji.

## 2. Cel

Plan ma zapewnić, że przed utratą dostępności bezpłatnej bazy zostaną formalnie rozstrzygnięte:

1. docelowa metoda utrzymania bazy,
2. świeżość i odtwarzalność kopii danych,
3. odpowiedzialność właścicieli,
4. dopuszczalny RPO i RTO,
5. koszt oraz konsekwencje billingowe,
6. wpływ operacji na freeze i dostępność,
7. rollback i retencja evidence,
8. zależność E4.1-H od dalszej dostępności danych.

Plan nie służy do obejścia freeze. Służy do uniknięcia niekontrolowanego wygaśnięcia zasobu.

## 3. Zakres

### W zakresie

- baza Render `gracz-pl-database`,
- ryzyko `RSK-E41H-009`,
- istniejący backup E4.1-E,
- warianty retencji, upgrade, backupu i migracji,
- kryteria wyboru wariantu,
- kalendarz decyzji przed 21.09.2026,
- recovery evidence oraz zasady retencji,
- wpływ na A2 i A3 E4.1-H.

### Poza zakresem

- implementacja kolektora E4.1-H,
- wykonanie świeżego testu deszyfrowania,
- merge albo deploy PR #26,
- wznowienie `gracz-checkers-test`,
- zmiana sekretów lub kluczy,
- zmiana schematu lub danych,
- wybór konkretnego płatnego planu bez zatwierdzonej oferty,
- deklarowanie finalnego RPO/RTO bez właściciela biznesowego.

## 4. Fakty wejściowe

### 4.1. Stan dostawcy

Na podstawie operator evidence panel Render wskazuje:

- plan bazy: `Free`,
- stan: `Available`,
- komunikat o wygaśnięciu: `21.09.2026`,
- brak managed logical backups dla planu Free,
- po wygaśnięciu baza staje się niedostępna,
- według bieżącej dokumentacji Render istnieje 14-dniowy okres na upgrade po wygaśnięciu; po jego upływie baza i dane są usuwane.

Data, godzina i warunki muszą zostać ponownie potwierdzone w panelu i aktualnej dokumentacji dostawcy przez uprawnionego właściciela. Okres po wygaśnięciu jest ścieżką awaryjną, nie planem podstawowym.

### 4.2. Istniejący punkt odzyskania

Kanoniczny anchor E4.1-E:

| Pole | Wartość |
|---|---|
| plik | `E4.1-E-gracz-pl-database-pre-mutation-2026-08-29.dump` |
| format | PostgreSQL custom archive |
| rozmiar | `1,440,765` bajtów |
| SHA-256 | `87BC0380C8F7EF39E21600E87B80045E4A9C52481C9D4EAE7FB937E98CDC8D8B` |
| `pg_restore --list` | `EXIT 0` |
| pełny izolowany restore | `PASS / EXIT 0` |
| tabele | `28/28` |
| rekordy | `17,711` |
| zgodność z produkcją 31.08.2026 | `28/28 / 17,711 / 0 różnic` |

Kopia stanowi zweryfikowany punkt odzyskania co najmniej dla stanu potwierdzonego 31.08.2026. Nie jest automatyczną gwarancją bieżącego RPO aż do 21.09.2026, ponieważ późniejsza zmiana danych może zwiększyć utratę od ostatniego potwierdzonego punktu.

### 4.3. Stan aplikacji i freeze

- usługa web jest zawieszona,
- normalna aplikacja nie może zostać wznowiona,
- PR #26 pozostaje Draft i nie może zostać scalony,
- sekrety nie mogą być kopiowane ani ujawniane,
- produkcja nie może być modyfikowana,
- operacje dokumentacyjne pozostają dozwolone.

Zawieszenie aplikacji ogranicza typowy ruch zapisu, ale nie jest dowodem absolutnego braku zmian w bazie. Istnieje zewnętrzna ścieżka dostępu do bazy, dlatego świeżość backupu musi być ustalana dowodem, nie założeniem.

## 5. Zasady dostawcy wpływające na decyzję

Bieżąca dokumentacja Render wskazuje:

1. Free Render Postgres wygasa 30 dni po utworzeniu.
2. Po wygaśnięciu pozostaje niedostępny, dopóki nie zostanie podniesiony do planu płatnego.
3. Okres na upgrade po wygaśnięciu wynosi 14 dni; później baza i dane są usuwane.
4. Render nie wykonuje logical backups dla planu Free.
5. Dla planu Free dostawca zaleca lokalny `pg_dump` albo upgrade i dopiero wykonanie eksportu.
6. Logical backup należy odtwarzać do pustej bazy.
7. Zmiana compute planu może spowodować krótką niedostępność bazy.
8. Paid Render Postgres zapewnia ciągłe backupy dla Point-in-Time Recovery zgodnie z warunkami wybranego planu.
9. Usunięcie bazy nie zachowuje backupów ani snapshotów, dlatego wymagane artefakty muszą zostać pobrane przed usunięciem.

Źródła dostawcy należy zweryfikować ponownie bezpośrednio przed decyzją. Zmiana dokumentacji, planów albo cen uruchamia ponowny review.

## 6. Klasy operacji i zgodność z freeze

| Klasa | Przykład | Stan w bieżącym freeze | Wymagana decyzja |
|---|---|---|---|
| D0 | dokumentacja, analiza, przypisanie roli | dozwolone | brak operacji na środowisku |
| D1 | lokalna weryfikacja checksum istniejących kopii bez połączenia z produkcją | warunkowo dozwolone | zgodność z lokalną polityką evidence |
| D2 | ponowny odczyt publicznej dokumentacji dostawcy | dozwolone | zapisać datę i źródło |
| O1 | odczyt panelu Render bez zmiany ustawień | wymaga uprawnionego właściciela i jawnego scope | evidence-only authorization |
| O2 | fresh `pg_dump` z produkcji | nieautoryzowane teraz | osobna read-only backup authorization |
| O3 | upgrade istniejącej bazy | nieautoryzowane teraz | change + billing authorization |
| O4 | utworzenie nowej bazy / restore | nieautoryzowane teraz | change authorization i izolowany target |
| O5 | zmiana `DATABASE_URL`, cutover, deploy lub resume | zabronione w freeze | osobne przyszłe okno po zdjęciu freeze |
| O6 | usunięcie bazy albo kopii | zabronione | retention closure + destructive change authorization |

Operacja read-only może nadal być operacją produkcyjną. Brak DDL/DML nie oznacza automatycznej zgody.

## 7. Cele ciągłości

Do formalnego zatwierdzenia:

| Cel | Stan bieżący | Wymagane rozstrzygnięcie |
|---|---|---|
| zachowanie danych po 21.09.2026 | niezapewnione | wybrać S1 lub S2+S3 |
| zachowanie zdolności do E4.1-H | zależne od bazy | utrzymać dostępny target i dataset |
| RPO | punkt potwierdzony 31.08.2026 | Data owner ustala maksymalną utratę |
| RTO | niezmierzony | Business/Data owner ustala akceptowalny czas |
| poufność | surowy dump poza GitHub | utrzymać szyfrowanie i ACL |
| odtwarzalność | restore PASS dla anchoru | fresh artefakt wymaga osobnego restore testu |
| retencja | dwie zweryfikowane kopie lokalne | ustalić lokalizację, okres i cleanup ownera |

Nie wolno wpisywać arbitralnych wartości RPO/RTO bez akceptacji właściciela danych i właściciela biznesowego.

## 8. Warianty

### S0 — brak działania

Opis: pozostawić plan Free do wygaśnięcia i nie przygotowywać dodatkowej ochrony.

Ocena: **REJECTED AS PRIMARY PLAN**.

Skutki:

- niedostępność od terminu wygaśnięcia,
- ryzyko trwałego usunięcia po okresie dostawcy,
- możliwa utrata zmian po ostatnim backupie,
- blokada E4.1-H,
- brak kontrolowanego RTO.

### S1 — upgrade istniejącej bazy przed wygaśnięciem

Opis: formalnie zatwierdzona zmiana istniejącego zasobu z Free na wybrany plan płatny.

Zalety:

- zachowanie istniejącej tożsamości i danych bazy,
- brak logicznego cutover aplikacji,
- uzyskanie funkcji backup/PITR właściwych dla wybranego planu,
- najmniej ruchomych elementów w porównaniu z migracją do nowej bazy.

Ryzyka/warunki:

- koszt i billing owner,
- możliwa krótka niedostępność,
- aktualne warunki planu muszą być potwierdzone,
- upgrade jest zmianą Render i wymaga autoryzacji,
- należy wykonać fresh backup przed zmianą, jeżeli zostanie autoryzowany,
- po upgrade należy osobno zweryfikować dostępność, plan i backup policy.

Ocena: **PREFERRED CONTINUITY TARGET / NOT AUTHORIZED**.

### S2 — świeży logiczny backup przed terminem

Opis: autoryzowany read-only `pg_dump` do chronionego artefaktu poza Render, z checksum, retencją i pełnym restore testem na izolowanym pustym celu.

Zalety:

- niezależność od cyklu życia zasobu Render,
- możliwość zmierzenia świeżego recovery point,
- ochrona defense-in-depth przed problemem upgrade.

Ryzyka/warunki:

- dostęp do produkcji jest działaniem operacyjnym,
- dump zawiera dane produkcyjne i wymaga szyfrowania, ACL oraz zakazu zapisu do GitHub,
- poświadczenia nie mogą trafić do argumentów, historii, logu ani evidence,
- sukces `pg_dump` i checksum nie wystarczają bez restore validation,
- backup nie zapewnia ciągłości online samodzielnie.

Ocena: **MANDATORY DEFENSE-IN-DEPTH CANDIDATE / NOT AUTHORIZED**.

### S3 — nowa płatna baza i kontrolowany restore

Opis: utworzenie nowego płatnego targetu, restore świeżej kopii oraz przyszły, osobno autoryzowany cutover.

Zalety:

- izolowany target,
- możliwość pełnej walidacji przed przełączeniem,
- alternatywa, gdy upgrade in-place nie jest możliwy lub akceptowalny.

Ryzyka/warunki:

- większa liczba operacji i punktów awarii,
- koszt równoległych zasobów,
- wymagane mapowanie właścicieli/ACL/extension/schema,
- restore tylko do pustej bazy,
- cutover i zmiana URL są zabronione w bieżącym freeze,
- wymaga osobnego runbooka, okna i rollbacku.

Ocena: **CONTROLLED FALLBACK / NOT AUTHORIZED**.

### S4 — pozostanie wyłącznie przy anchorze z 29.08

Opis: zachowanie istniejących kopii bez fresh backupu.

Zalety:

- artefakt jest już zweryfikowany,
- restore zakończył się PASS,
- brak nowego połączenia z produkcją.

Ograniczenia:

- potencjalna utrata zmian po potwierdzonym punkcie,
- brak gwarancji RPO zgodnego z wymaganiami biznesowymi,
- lokalna retencja może mieć wspólną domenę awarii,
- nie zapewnia dostępnej bazy online po wygaśnięciu.

Ocena: **EMERGENCY RECOVERY FLOOR / INSUFFICIENT AS SOLE CONTINUITY PLAN**.

### S5 — upgrade dopiero po wygaśnięciu w okresie dostawcy

Opis: skorzystanie z deklarowanego okresu 14 dni po wygaśnięciu.

Ocena: **EMERGENCY ONLY / NOT A PRIMARY PLAN**.

Powody:

- baza jest niedostępna od terminu wygaśnięcia,
- plan zależy od niezmienności zasad i dostępności panelu,
- brak kontrolowanego RTO,
- opóźnienie lub problem billingowy może doprowadzić do trwałego usunięcia.

## 9. Macierz decyzyjna

Skala: 1 = niekorzystnie, 5 = korzystnie. Wynik służy do porównania, nie jest autoryzacją.

| Wariant | Ciągłość online | Świeżość danych | Izolacja od dostawcy | Złożoność | Zgodność z bieżącym freeze | Rola |
|---|---:|---:|---:|---:|---:|---|
| S0 | 1 | 1 | 1 | 5 | 5 | odrzucony |
| S1 | 5 | 5 | 2 | 4 | 1 | preferowany target |
| S2 | 1 | 5 | 5 | 3 | 1 | defense-in-depth |
| S3 | 4 | 5 | 3 | 1 | 1 | fallback migracyjny |
| S4 | 1 | 2 | 5 | 4 | 5 | emergency recovery floor |
| S5 | 2 | 4 | 1 | 3 | 1 | awaryjny po expiry |

Rekomendowany wzorzec docelowy:

```text
AUTHORIZED FRESH BACKUP + RESTORE VALIDATION (S2)
THEN AUTHORIZED IN-PLACE PAID CONTINUITY (S1)
WITH S3 AS PREPARED FALLBACK
```

Rekomendacja pozostaje projektem. Obecnie S1, S2 i S3 nie są autoryzowane.

## 10. Warunki wyboru S1

S1 może zostać rekomendowany do autoryzacji dopiero, gdy:

- [ ] nazwany Data owner zaakceptował cel retencji,
- [ ] nazwany Provider/Billing owner zaakceptował koszt,
- [ ] Change authorizer zatwierdził zakres i okno,
- [ ] data wygaśnięcia została świeżo potwierdzona,
- [ ] docelowy plan i funkcje backup/PITR zostały potwierdzone,
- [ ] wpływ upgrade na dostępność został zaakceptowany,
- [ ] fresh backup S2 i jego recovery evidence są gotowe albo jawnie odrzucone przez uprawnionego risk ownera,
- [ ] brak automatycznego wznowienia `gracz-checkers-test` został potwierdzony,
- [ ] monitoring i post-change verification są gotowe,
- [ ] rollback/incident owner jest dostępny.

Dowolny brak lub `UNKNOWN` oznacza HOLD.

## 11. Warunki fresh backupu S2

Autoryzacja musi jawnie ograniczać backup do read-only i zawierać:

```text
BACKUP_CHANGE_ID=
TARGET_CLASS=PRODUCTION_READ_ONLY
AUTHORIZED_SOURCE_DATABASE=
BACKUP_FORMAT=CUSTOM
AUTHORIZED_START_UTC=
AUTHORIZED_END_UTC=
OPERATOR=
DATA_OWNER=
SECURITY_REVIEWER=
EVIDENCE_CUSTODIAN=
RETENTION_OWNER=
RETENTION_UNTIL=
RPO_STATEMENT=
RESTORE_TEST_TARGET_CLASS=ISOLATED_NON_PRODUCTION
```

Minimalne dowody:

- target identity bez ujawnienia hosta/credential values,
- SSL i połączenie read-only,
- wersja narzędzia,
- exit code,
- rozmiar,
- SHA-256,
- archive list PASS,
- co najmniej dwie kontrolowane kopie w odseparowanych domenach awarii,
- pełny restore do pustego isolated targetu,
- porównanie struktury i liczników,
- brak sekretów i danych w repozytorium.

## 12. Retencja i klasyfikacja artefaktów

| Artefakt | Klasa | Dozwolone miejsce | GitHub |
|---|---|---|---|
| surowy `.dump` | produkcyjne dane wrażliwe | zatwierdzony szyfrowany magazyn z ACL | zakaz |
| checksum | metadata | repo + evidence store | dozwolone |
| rozmiar/timestamp/tool version | metadata | repo + evidence store | dozwolone |
| restore log po redakcji | privacy-safe evidence | repo/evidence store | dozwolone po review |
| connection string/hasło | sekret | wyłącznie mechanizm credential store | zakaz |
| tabela row counts | privacy-safe metadata po review | repo/evidence store | dozwolone |
| plaintext/ciphertext/AAD | dane/crypto material | brak w evidence | zakaz |

Backup musi pozostać poza repozytorium. GitHub przechowuje wyłącznie metadane, checksum i wynik kontroli.

## 13. Harmonogram decyzyjny

Poniższe daty wynikają z operator evidence `expiry = 21.09.2026`. Każda z nich wymaga ponownego potwierdzenia daty i strefy czasowej u dostawcy.

| Termin | Data orientacyjna | Wymagany rezultat | Jeśli brak |
|---|---|---|---|
| T-21 | 31.08.2026 | plan 71, rozpoczęcie owner assignment | ryzyko pozostaje CRITICAL |
| T-14 | 07.09.2026 | wybrany wariant, named owners, koszt i change path | formalna eskalacja |
| T-10 | 11.09.2026 | autoryzacja fresh backup/restore albo pisemna akceptacja braku | NO-GO dla niechronionej zmiany |
| T-7 | 14.09.2026 | GO/NO-GO dla S1 lub gotowość S3 | tryb awaryjny, brak odkładania |
| T-3 | 18.09.2026 | finalny provider/backup/owner preflight | najwyższa eskalacja |
| T0 | 21.09.2026 | nie może być planowanym dniem decyzji | baza może stać się niedostępna |
| T+14 | ok. 05.10.2026 | koniec deklarowanego okresu awaryjnego, do fresh verification | ryzyko trwałego usunięcia |

T0 i T+14 nie są terminami roboczymi. Wszystkie decyzje planowe powinny zostać zamknięte przed T-7, z buforem na problem billingowy, techniczny albo review.

## 14. RPO i RTO

### Stan bieżący

- najnowszy zweryfikowany recovery point: anchor 29.08, zgodny z produkcją na poziomie liczników 31.08,
- RPO po 31.08: rośnie wraz z każdą nieobjętą backupem zmianą,
- RTO: niezmierzony dla nowego provider targetu i nie może być deklarowany,
- dostępność po 21.09 bez decyzji: niezapewniona.

### Rekord decyzji

```text
BUSINESS_SERVICE_OWNER=
DATA_OWNER=
MAXIMUM_ACCEPTABLE_DATA_LOSS=
TARGET_RPO=
MAXIMUM_ACCEPTABLE_DOWNTIME=
TARGET_RTO=
RPO_EVIDENCE=
RTO_TEST_METHOD=
APPROVED_BY=
APPROVED_AT_UTC=
REVIEW_DATE=
```

Brak wartości oznacza brak zatwierdzonego celu, a nie automatyczne `RPO=0` lub `RTO=0`.

## 15. Post-change verification dla przyszłego S1

Po osobno zatwierdzonym upgrade należy potwierdzić:

1. identyfikator i tożsamość tej samej bazy,
2. plan płatny zgodny z autoryzacją,
3. status `Available`,
4. brak nieplanowanego wznowienia web service,
5. brak zmiany environment i sekretów,
6. połączenie read-only, SSL i target identity,
7. dokładne liczniki 28 tabel i brak nieoczekiwanej różnicy,
8. dostępność backup/PITR zgodną z wybranym planem,
9. zapis bezpiecznego evidence bez connection stringów,
10. utrzymanie freeze albo formalne przywrócenie jego baseline.

Nie wolno uznać samego statusu `Available` za pełny PASS.

## 16. Restore/migration fallback dla przyszłego S3

S3 wymaga odrębnego runbooka obejmującego:

- pusty target,
- wersję PostgreSQL i compatibility review,
- `--no-owner` i `--no-privileges`, jeśli zgodne z zatwierdzonym modelem,
- kontrolowane odtworzenie ról/ACL poza surowym restore,
- extensions i parametry,
- structural validation,
- exact row-count reconciliation,
- crypto-structure validation bez plaintextów,
- osobny fresh decryptability test dopiero po A1–A3,
- cutover plan, rollback i DNS/application dependency map,
- zakaz zmiany `DATABASE_URL` w bieżącym freeze.

Utworzenie nowej bazy nie oznacza zgody na cutover.

## 17. Kryteria GO / HOLD / NO-GO

### GO do wnioskowania o autoryzację

- nazwani właściciele,
- fresh provider facts,
- wybrany wariant,
- koszt zaakceptowany,
- RPO/RTO zaakceptowane,
- backup/recovery plan zatwierdzony,
- kontrolowane okno i rollback gotowe,
- brak konfliktu z freeze albo formalna zgoda na jego ograniczone zdjęcie.

### HOLD

- nieznana data/godzina expiry,
- brak ownera,
- brak billing approval,
- brak akceptacji RPO/RTO,
- niepotwierdzony wpływ upgrade,
- brak bezpiecznego miejsca retencji,
- niepełny restore evidence,
- każda potrzeba ujawnienia sekretu.

### NO-GO / INCIDENT

- utrata wszystkich zweryfikowanych kopii,
- checksum mismatch,
- sekret lub dane trafiły do repo/logu/czatu,
- nieautoryzowana zmiana planu lub bazy,
- nieautoryzowany resume/deploy/cutover,
- baza została usunięta albo expiry window minął bez recoverability evidence.

## 18. Powiązanie z RSK-E41H-009 i E4.1-H

`RSK-E41H-009` może zostać obniżone dopiero po evidence, nie po samym wyborze wariantu.

Warunki zamknięcia:

- aktywna retencja bazy wykraczająca poza 21.09.2026 albo zatwierdzony nowy target,
- świeży backup z potwierdzoną integralnością,
- udany izolowany restore,
- named Data owner i Retention owner,
- zatwierdzony RPO/RTO,
- potwierdzony cleanup/retention contract,
- niezależny DB/operations review.

Wpływ na autoryzacje E4.1-H:

```text
RSK-E41H-009 OPEN  => A2 READINESS BLOCKED
A2 BLOCKED         => A3 BLOCKED
A3 BLOCKED         => E4.1-H PENDING / SAFE HOLD
```

Plan ciągłości nie udziela A2 ani A3.

## 19. Role i RACI

| Działanie | Accountable | Responsible | Consulted | Informed |
|---|---|---|---|---|
| wybór wariantu | Change authorizer | Data owner | Provider/Billing owner, DB reviewer | Project owner |
| akceptacja kosztu | Billing owner | Provider owner | Change owner | Data owner |
| RPO/RTO | Business/Data owner | Data owner | DB reviewer | Change authorizer |
| fresh backup | Data owner | Technical operator | Security reviewer | Change owner |
| restore validation | DB/operations owner | Technical operator | Security/Evidence reviewer | Data owner |
| upgrade | Change authorizer | Provider operator | Billing/Data/DB owners | Project owner |
| retencja artefaktów | Data owner | Evidence custodian | Security reviewer | Change owner |
| cleanup | Change authorizer | Cleanup owner | Data/Security reviewer | Project owner |

Role funkcjonalne muszą zostać zastąpione konkretnymi osobami przed działaniem.

## 20. Rekord formalnej decyzji

```text
DECISION_ID=
RISK_ID=RSK-E41H-009
PROVIDER_EXPIRY_CONFIRMED_AT_UTC=
PROVIDER_EXPIRY_AT_UTC=
SELECTED_OPTION=S1|S2+S3|OTHER
REJECTED_OPTIONS_AND_REASON=
DATA_OWNER=
BUSINESS_SERVICE_OWNER=
PROVIDER_OWNER=
BILLING_OWNER=
CHANGE_AUTHORIZER=
DB_OPERATIONS_REVIEWER=
SECURITY_REVIEWER=
EVIDENCE_CUSTODIAN=
TARGET_RPO=
TARGET_RTO=
COST_APPROVAL_REFERENCE=
BACKUP_AUTHORIZATION_REFERENCE=
CHANGE_AUTHORIZATION_REFERENCE=
WINDOW_START_UTC=
WINDOW_END_UTC=
ROLLBACK_OWNER=
CLEANUP_OWNER=
APPROVED_BY=
APPROVED_AT_UTC=
DECISION_EXPIRES_AT_UTC=
```

Puste pole, placeholder lub brak podpisu oznacza `NOT AUTHORIZED`.

## 21. Monitoring i triggery ponownej oceny

Plan należy przeglądać ponownie, gdy:

- zmieni się data expiry,
- zmieni się status bazy,
- zmieni się oferta albo dokumentacja Render,
- zostanie przypisany owner,
- zostanie wybrany plan płatny,
- powstanie fresh backup,
- checksum albo restore test nie przejdzie,
- zmienią się liczniki danych,
- zostanie zgłoszona A2 albo A3,
- nastąpi zmiana freeze,
- nastąpi incident, nieautoryzowany dostęp albo utrata kopii.

Minimalny rytm dokumentacyjny do rozstrzygnięcia ryzyka: kontrola na T-14, T-10, T-7 i T-3. Odczyt panelu i operacje na środowisku pozostają poza zakresem bez autoryzacji.

## 22. Źródła i dokumenty powiązane

Dokumenty repozytorium:

- `61-ETAP4-E4.1-E-FRESH-BACKUP-ANCHOR-2026-08-29.md`,
- `62-ETAP4-E4.1-F-RESTORE-VALIDATION-EXECUTION-LOG.md`,
- `63-ETAP4-E4.1-H-FRESH-CRYPTO-DECRYPTABILITY-EXECUTION-PLAN.md`,
- `67-ETAP4-E4.1-H-RENDER-PROVIDER-CAPABILITY-ASSESSMENT.md`,
- `69-ETAP4-E4.1-H-CHANGE-AUTHORIZATION-EXECUTION-WINDOW-ROLLBACK-CLEANUP-CONTRACT.md`,
- `70-ETAP4-E4.1-H-RISK-REGISTER-AND-IMPLEMENTATION-READINESS-MATRIX.md`.

Źródła dostawcy sprawdzone 31.08.2026:

- `https://render.com/docs/free`,
- `https://render.com/docs/postgresql-backups`,
- `https://render.com/docs/postgresql-creating-connecting`,
- `https://render.com/docs/backup-postgresql-to-s3`,
- `https://render.com/docs/service-types`.

## 23. Końcowy status

```text
CONTINUITY AND RETENTION PLAN = READY
PREFERRED PATTERN = S2 THEN S1 / S3 FALLBACK
OPTION SELECTION = PENDING
NAMED OWNERS = PENDING
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

Następny krok dokumentacyjny: przypisać named owners i utworzyć formalny Decision Record dla `RSK-E41H-009`. Do czasu odrębnej autoryzacji nie wykonywać backupu, upgrade, restore, tworzenia zasobu, cutover ani żadnej zmiany Render.


## 24. Named ownership and decision record — dokument 72

Formalnym rejestrem odpowiedzialności dla planu ciągłości jest:

- `72-ETAP4-E4.1-H-NAMED-OWNERSHIP-AND-CONTINUITY-DECISION-RECORD.md`.

Dokument 72 nie wskazuje fikcyjnych właścicieli. Każda rola wymaga nominacji, akceptacji, mandate verification, kontroli konfliktów i aktywacji.

```text
OWNERSHIP CONTRACT = READY
NAMED OWNERS = PENDING / UNASSIGNED
CONTINUITY DECISION RECORD = READY / NOT COMPLETED
OPTION SELECTION = PENDING
RSK-E41H-009 = OPEN / CRITICAL / TIME-BOUND
```

Do czasu aktywacji wymaganych ownerów i zatwierdzenia decyzji S1/S2/S3 backup, upgrade, restore i cutover pozostają nieautoryzowane.


## 25. T-14 continuity decision gate — dokument 73

Weryfikację gotowości planu przed T-10 definiuje:

- `73-ETAP4-E4.1-H-RSK-E41H-009-T14-CONTINUITY-DECISION-GATE-AND-EVIDENCE-PACK.md`.

Bramka wymaga fresh provider facts, aktywnych ownerów, zatwierdzonych RPO/RTO, formalnego wyboru opcji, kosztu/change path i review recovery evidence.

```text
T-14 GATE DESIGN = READY
T-14 GATE = NOT EXECUTED
CURRENT PROJECTION = HOLD
OPTION SELECTION = PENDING
AUTHORIZED OPERATIONS = NONE
```
