# Gracz.pl V3 — PL-C09 Anonimizacja i ryzyko reidentyfikacji

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — VERSIONED / FREEZE-SAFE**  
Control ID: `PL-C09`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence/decisions: `PL-E06`, `PL-E13`, `PL-R04`, `PL-C03`, `PL-C07`

> Kontrola PL-C09 ocenia, czy Gracz.pl V3 rozróżnia rzeczywistą anonimizację od pseudonimizacji oraz czy bezterminowe zachowanie danych jest dopuszczane wyłącznie po skutecznym, nieodwracalnym zerwaniu powiązania z osobą. Dokument nie stanowi dowodu, że mechanizm anonimizacji został już wdrożony lub przetestowany produkcyjnie.

---

## 1. Kryterium kontroli

Kontrola jest spełniona projektowo tylko wtedy, gdy:

1. dane oznaczone jako `ANONYMIZED` nie zawierają bezpośrednich identyfikatorów osoby;
2. nie istnieje odwracalna mapa ani lookup pozwalający połączyć rekord z użytkownikiem;
3. nie pozostaje stabilny pseudonim umożliwiający śledzenie osoby pomiędzy rekordami/usługami;
4. pośrednie identyfikatory i unikalne kombinacje pól są ocenione pod kątem realistycznej reidentyfikacji;
5. dane nadal możliwe do powiązania z osobą są traktowane jako dane osobowe, nawet po pseudonimizacji;
6. bezterminowa retencja jest dopuszczalna wyłącznie dla danych rzeczywiście anonimowych;
7. skuteczność anonimizacji podlega okresowemu ponownemu review.

---

## 2. Rozróżnienie anonimizacji i pseudonimizacji

```text
PSEUDONYMIZATION != ANONYMIZATION

Pseudonimizacja:
- identyfikator został zastąpiony lub odseparowany,
- ale przy użyciu dodatkowych informacji możliwe jest ponowne powiązanie z osobą,
- dane nadal pozostają danymi osobowymi.

Anonimizacja:
- brak racjonalnej możliwości ponownego powiązania z osobą,
- brak mapy zwrotnej i ukrytego lookupu,
- brak stabilnego identyfikatora osoby,
- ryzyko reidentyfikacji zostało ocenione w praktycznym modelu zagrożeń.
```

Samo usunięcie `user_id` z rekordu nie wystarcza do uznania danych za anonimowe.

---

## 3. Główne przypadki użycia anonimizacji w V3

### PL-C09-01 — historia rozgrywek / replay

Po zakończeniu identyfikowalnego okresu retencji replay może pozostać bezterminowo tylko wtedy, gdy:

- usunięto `user_id`, e-mail, login i inne bezpośrednie identyfikatory;
- nie istnieje odwracalna mapa replay → użytkownik;
- nie zachowano stabilnego pseudonimu pozwalającego łączyć aktywność tej samej osoby pomiędzy partiami;
- kombinacja danych meczu nie umożliwia realistycznego odtworzenia tożsamości przez połączenie z innymi zbiorami;
- wykonano udokumentowany test anonimizacji;
- ryzyko reidentyfikacji jest ponownie oceniane co najmniej raz na 12 miesięcy.

Status projektowy: `PASS WITH CONDITIONS`.

### PL-C09-02 — historia turniejowa

Po okresie identyfikowalnym uczestnik może zostać odłączony od historii turnieju przy zachowaniu wyniku/struktury tylko wtedy, gdy końcowy rekord nie pozwala realistycznie wskazać konkretnej osoby.

Publiczny alias, jeśli nadal pozostaje jednoznacznie i trwale powiązany z użytkownikiem, nie jest anonimowy.

Status projektowy: `PASS WITH CONDITIONS`.

### PL-C09-03 — ranking i statystyki

Po usunięciu konta:

- bieżący ranking nie może pozostawiać trwałego publicznego aliasu powiązanego z osobą;
- agregaty mogą pozostać dłużej, jeżeli są faktycznie anonimowe;
- małe grupy, unikalne kombinacje wyników lub bardzo szczegółowe statystyki wymagają sprawdzenia ryzyka singling-out/reidentyfikacji.

Status projektowy: `PASS WITH CONDITIONS`.

### PL-C09-04 — telemetry i metryki

Metryka może być oznaczona jako anonimowa tylko po usunięciu identyfikatorów i cech pozwalających na racjonalne powiązanie z użytkownikiem. Hash lub HMAC stabilnego identyfikatora nie jest automatycznie anonimizacją, jeśli administrator posiada klucz lub możliwość połączenia rekordów.

Status projektowy: `PASS WITH CONDITIONS`.

---

## 4. Niedozwolone skróty projektowe

Poniższe wzorce nie spełniają PL-C09:

```text
DELETE user_id ONLY = NOT ENOUGH
HASHED USER ID WITH AVAILABLE KEY = PSEUDONYMIZED, NOT ANONYMOUS
STABLE CROSS-GAME ALIAS = NOT ANONYMOUS IF LINKABLE
SECRET LOOKUP TABLE EXISTS = NOT ANONYMOUS
REVERSIBLE ENCRYPTION = NOT ANONYMIZATION
"ANONYMOUS" LABEL WITHOUT TEST = NOT ACCEPTED
INDEFINITE RETENTION BEFORE ANONYMIZATION = NOT ACCEPTED
```

---

## 5. Test reidentyfikacji

Przed uznaniem mechanizmu za produkcyjnie gotowy należy udokumentować test obejmujący co najmniej:

1. listę wszystkich pól pozostających po anonimizacji;
2. sprawdzenie bezpośrednich identyfikatorów;
3. sprawdzenie stabilnych pseudonimów i lookupów;
4. możliwość linkage z rankingiem, profilem, historią turniejową, publicznym chatem i telemetry;
5. możliwość singling-out przy nietypowych wynikach lub małych grupach;
6. ocenę dostępu administratora do dodatkowych informacji umożliwiających reidentyfikację;
7. wynik `PASS / FAIL / CONDITIONAL`;
8. datę następnego review;
9. evidence locator do testu.

Jeżeli wynik jest `FAIL` albo `CONDITIONAL` z materialnym ryzykiem, dane pozostają klasyfikowane jako osobowe i podlegają zwykłej retencji/purge.

---

## 6. Review okresowe

Dla danych utrzymywanych bezterminowo jako anonimowe wymagany jest przegląd ryzyka reidentyfikacji co najmniej co 12 miesięcy oraz dodatkowo po materialnej zmianie systemu, np.:

- dodaniu nowego publicznego identyfikatora lub profilu;
- zmianie modelu rankingu;
- uruchomieniu nowych analytics/anti-cheat;
- połączeniu danych z nowym providerem;
- dodaniu publicznej historii meczów;
- zmianie schematu danych replay/turniejów.

Jeśli nowy kontekst zwiększa możliwość reidentyfikacji, dane trzeba ponownie sklasyfikować i zastosować odpowiednią retencję/purge.

---

## 7. Relacja do deletion i legal hold

Anonimizacja może być końcową akcją privacy workflow tylko wtedy, gdy rzeczywiście usuwa relację z osobą.

Legal hold:

- nie pozwala na oznaczenie pseudonimizowanych danych jako anonimowych;
- może czasowo zatrzymać anonimizację konkretnego rekordu tylko przy prawidłowym, wąskim hold;
- po release hold należy ponownie wykonać retention eligibility i właściwą anonimizację/purge.

---

## 8. Warunki przed pełnym PASS

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C09-O01 | zdefiniować konkretny algorytm/transformację anonimizacji per klasa replay/turniej/ranking/metryka | P1 Privacy/Architecture | Privacy/Legal + Engineering | `OPEN` |
| PL-C09-O02 | wykonać udokumentowany test reidentyfikacji na rzeczywistym schemacie danych | P1 Privacy/Technical | Privacy/Legal + Engineering | `OPEN` |
| PL-C09-O03 | potwierdzić brak odwracalnych lookupów i stabilnych pseudonimów w data modelu | P1 Privacy/Technical | Engineering + Privacy/Legal | `OPEN` |
| PL-C09-O04 | ustanowić cykliczny reidentification review co 12 miesięcy | P1 Governance | Privacy/Legal Decision Owner | `OPEN` |
| PL-C09-O05 | uwzględnić ryzyko reidentyfikacji w pełnej DPIA | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 9. Formalna decyzja PL-C09

```text
PL-C09 = PASS WITH CONDITIONS

ANONYMIZATION MODEL = DEFINED
PSEUDONYMIZATION != ANONYMIZATION = CONFIRMED
INDEFINITE RETENTION OF IDENTIFIABLE DATA = NOT ALLOWED
INDEFINITE ANONYMOUS REPLAY = ALLOWED ONLY AFTER EFFECTIVE ANONYMIZATION
REVERSIBLE LOOKUP / STABLE PSEUDONYM = NOT ACCEPTED AS ANONYMOUS
REIDENTIFICATION REVIEW = REQUIRED AT LEAST EVERY 12 MONTHS
OPERATIONAL ANONYMIZATION TEST = OPEN
FULL DPIA = OPEN
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Kontrola jest `PASS WITH CONDITIONS`, ponieważ model i granice anonimizacji są jednoznacznie zdefiniowane, ale brak jeszcze dowodu technicznego skutecznej anonimizacji i testu reidentyfikacji na rzeczywistym systemie.

---

## 10. Granica autoryzacji

Utworzenie PL-C09:

- nie uruchamia anonimizacji ani purge;
- nie zmienia żadnych danych użytkowników;
- nie oznacza, że istniejący replay jest już anonimowy;
- nie autoryzuje bezterminowej retencji danych, które nie przeszły testu anonimizacji;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.
