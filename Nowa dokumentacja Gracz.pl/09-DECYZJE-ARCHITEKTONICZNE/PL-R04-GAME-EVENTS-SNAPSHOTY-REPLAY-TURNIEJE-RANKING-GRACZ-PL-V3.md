# Gracz.pl V3 — PL-R04 Game events, snapshoty, replay, turnieje i ranking

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL RETENTION REVIEW — VERSIONED / FREEZE-SAFE**  
Decision ID: `PL-R04`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E10`, `PL-E13`, `PL-E14`, `PL-E16`

> Dokument stanowi formalny punkt decyzji retencyjnej dla danych rozgrywek, rankingów i turniejów. Nie zatwierdza implementacji ani deploymentu. Okresy są polityką projektową Gracz.pl V3 podlegającą dalszej walidacji wraz z DPIA, privacy notice i testami operacyjnymi.

---

## 1. Zakres decyzji

PL-R04 obejmuje:

- zakończone game/match events z identyfikatorem użytkownika,
- snapshoty zakończonych meczów,
- historię/replay po anonimizacji,
- historię turniejów,
- ranking bieżący i historyczny,
- dane potrzebne do rozstrzygania sporów i integralności wyniku,
- relację z legal hold i account deletion.

Nie obejmuje telemetry anti-cheat wykraczającej poza zwykłe dane gry — taki zakres wymaga odrębnego review LIA/DPIA.

---

## 2. Cele przetwarzania

Cele dopuszczalne dla tego bloku:

1. świadczenie usługi gry i utrzymanie wyniku;
2. zachowanie integralności rankingu i turnieju;
3. rozstrzyganie sporów dotyczących wyniku lub przebiegu meczu;
4. wykrywanie błędów i nadużyć w zakresie proporcjonalnym do celu;
5. tworzenie anonimowych statystyk i replayów po skutecznej anonimizacji.

Zakazane jest wtórne użycie identyfikowalnej historii rozgrywek do niepowiązanego profilowania marketingowego bez osobnej podstawy i review.

---

## 3. Decyzje retencyjne

| Klasa | Retention clock | Okres | Akcja końcowa | Status |
|---|---|---:|---|---|
| zakończone game/match events z user ID | `finished_at` | 36 miesięcy | nieodwracalna anonimizacja identyfikatorów albo purge, jeśli dane nie są dalej potrzebne | `APPROVE WITH CONDITIONS` |
| snapshoty zakończonych meczów | `finished_at` | 90 dni | purge, chyba że aktywny dispute/legal hold | `APPROVE WITH CONDITIONS` |
| anonimowy replay/historia | moment skutecznej anonimizacji | bezterminowo tylko przy potwierdzonej anonimowości | zachowanie jako dane anonimowe + reidentification review co 12 miesięcy | `APPROVE WITH CONDITIONS` |
| historia turnieju z ID uczestnika | `finished_at` turnieju | 36 miesięcy | anonimizacja uczestnika przy zachowaniu struktury/wyniku, jeśli nadal potrzebne | `APPROVE WITH CONDITIONS` |
| bieżący ranking | lifecycle aktywnego konta | aktywne konto + maks. 30 dni | usunięcie z publicznej projekcji; anonimowy agregat może pozostać | `APPROVE WITH CONDITIONS` |

---

## 4. Uzasadnienie 36 miesięcy dla game events i turniejów

36 miesięcy jest przyjmowane jako górna wartość projektowa dla identyfikowalnej historii zakończonych rozgrywek i turniejów, ponieważ dane mogą być potrzebne do:

- stabilności i integralności rankingu,
- analizy sporów i reklamacji dotyczących wyniku,
- wykrycia później ujawnionych błędów domenowych,
- ochrony przed manipulacją historii rozgrywki.

Warunki:

- okres nie może stać się automatycznym minimum dla każdej gry;
- purge lub anonimizacja może nastąpić wcześniej, jeśli cel ustanie;
- identyfikowalne dane nie mogą być zachowywane bezterminowo;
- privacy notice musi podawać okres albo zrozumiałe kryterium;
- każda nowa gra z innym profilem ryzyka może wymagać własnego okresu.

---

## 5. Snapshoty — 90 dni

Snapshot meczu jest artefaktem operacyjnym, a nie trwałą historią użytkownika.

Po zakończeniu meczu jego wartość maleje szybko. Retencja 90 dni ma umożliwić:

- analizę błędu/reconnect,
- krótkoterminową diagnostykę,
- weryfikację sporu dotyczącego stanu partii.

Po 90 dniach snapshot podlega purge, chyba że istnieje jawnie zarejestrowany aktywny dispute/legal hold obejmujący konkretny mecz.

Legal hold nie może obejmować wszystkich snapshotów danego użytkownika lub całej platformy bez indywidualnego uzasadnienia.

---

## 6. Anonimowy replay — warunek bezterminowego zachowania

Replay może być przechowywany bezterminowo tylko wtedy, gdy nie jest już daną osobową w praktycznym modelu zagrożeń.

Minimalne warunki:

- brak user ID, e-maila, loginu i innych bezpośrednich identyfikatorów;
- brak odwracalnej mapy replay → użytkownik;
- brak stabilnego pseudonimu pozwalającego śledzić osobę pomiędzy grami;
- brak pośrednich identyfikatorów, które realistycznie umożliwiają reidentyfikację;
- brak sekretnego lookupu utrzymywanego w innej tabeli;
- reidentification risk review co 12 miesięcy.

Jeśli istnieje realna możliwość reidentyfikacji, replay pozostaje danymi osobowymi i nie może korzystać z bezterminowej retencji jako „anonimowy”.

---

## 7. Ranking i account deletion

Po zweryfikowanym usunięciu konta:

- profil użytkownika powinien zostać usunięty z bieżącej publicznej projekcji rankingu możliwie szybko, nie później niż w granicy przyjętej przez PL-R01;
- dopuszczalny jest techniczny okres do 30 dni na pełne wygaszenie projekcji i read modeli, jeśli nie oznacza dalszej normalnej publikacji danych osobowych;
- historyczny wynik może zostać zachowany tylko po odłączeniu od osoby albo po skutecznej anonimizacji, jeśli zachowanie struktury rankingu ma rzeczywistą wartość domenową.

Ranking nie może służyć jako sposób obejścia usunięcia konta przez pozostawienie trwałego publicznego aliasu powiązanego z osobą.

---

## 8. Spory i legal hold

Aktywny dispute/legal hold może czasowo zatrzymać purge tylko dla oznaczonych rekordów.

Wymagane są co najmniej:

- `hold_id`,
- konkretny cel i reason class,
- konkretne match/tournament IDs lub inny wąski scope,
- owner,
- `review_at`,
- `expires_at`,
- audyt utworzenia i zwolnienia hold.

Po zwolnieniu hold rekord wraca do normalnej oceny retention eligibility.

---

## 9. Małoletni 16–17

Dla użytkowników 16–17 lat:

- ranking i historia publiczna wymagają ograniczonej ekspozycji danych identyfikujących;
- nie wolno łączyć historii gry z marketingowym profilem behawioralnym;
- anti-cheat lub scoring zachowania wymagają odrębnego DPIA/LIA review;
- publiczne aliasy/profil powinny być projektowane z privacy by default.

Wiek 16+ jest w tym materiale polityką projektową Gracz.pl, a nie twierdzeniem o uniwersalnym ustawowym wieku korzystania z każdej usługi internetowej.

---

## 10. Warunki wcześniejszego purge

Purge lub anonimizacja mogą nastąpić wcześniej, gdy:

- cel biznesowy ustał,
- gra/turniej został usunięty z usługi,
- nie istnieje już potrzeba utrzymania identyfikowalności dla integralności wyniku,
- nie istnieje aktywny dispute/legal hold,
- użytkownik wykonał skuteczne żądanie i nie zachodzi ważny wyjątek,
- dane mogą zostać bezpiecznie zastąpione anonimizowanym agregatem.

---

## 11. Warunki przed pełnym PASS

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-R04-O01 | potwierdzić w DPIA, że 36 miesięcy jest proporcjonalne dla konkretnych klas gier/turniejów | P1 Privacy/Legal | Privacy/Legal + Game Platform | `OPEN` |
| PL-R04-O02 | wykonać test skutecznej anonimizacji replay | P1 Privacy/Technical | Privacy/Legal + Engineering | `OPEN` |
| PL-R04-O03 | potwierdzić zachowanie rankingu po account deletion i brak publicznego linku do osoby | P1 Privacy/Product | Privacy/Legal + Game Platform | `OPEN` |
| PL-R04-O04 | opisać każdą przyszłą telemetry anti-cheat osobno | P1 Privacy/Security | Privacy/Legal + Game/Security | `OPEN IF FEATURE EXISTS` |
| PL-R04-O05 | odzwierciedlić okresy/kryteria w finalnym privacy notice i ROPA | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 12. Decyzja PL-R04

```text
PL-R04 = APPROVE WITH CONDITIONS

GAME/MATCH EVENTS IDENTIFIABLE = 36 MONTHS MAX PROJECT TARGET
FINISHED MATCH SNAPSHOTS = 90 DAYS
ANONYMIZED REPLAY = INDEFINITE ONLY IF ANONYMIZATION IS EFFECTIVE
TOURNAMENT HISTORY WITH IDENTIFIERS = 36 MONTHS MAX PROJECT TARGET
ACTIVE RANKING = ACTIVE ACCOUNT + UP TO 30 DAYS FOR CONTROLLED DECOMMISSION
LEGAL HOLD = NARROW / CASE-SPECIFIC ONLY
EARLIER PURGE = ALLOWED WHEN PURPOSE ENDS
DPIA VALIDATION = REQUIRED BEFORE FULL PASS
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

---

## 13. Granica autoryzacji

Utworzenie i zatwierdzenie warunkowe PL-R04:

- nie wdraża workerów retencyjnych,
- nie uruchamia purge ani anonimizacji,
- nie zmienia produkcyjnej bazy danych,
- nie autoryzuje anti-cheat telemetry,
- nie autoryzuje implementation/deployment,
- nie zdejmuje freeze,
- nie zmienia `Production V3 = NO-GO`.
