# Gracz.pl V3 — PL-C01 Purpose Limitation

Data decyzji: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E02 ROPA`, `PL-E03 Mapa celów i podstaw prawnych`, `PL-E06 Klasyfikacja danych`, `PL-E09 Privacy Notice`, `PL-E13 Retencja`, `PL-R01–PL-R09`  
Status artefaktu: **FORMAL PRIVACY/LEGAL CONTROL REVIEW / VERSIONED / FREEZE-SAFE**

> Kryterium PL-C01: każdy proces przetwarzania musi mieć konkretny, jawnie udokumentowany cel. Dane nie mogą być zbierane lub wykorzystywane „na zapas”, dla nieokreślonego przyszłego użycia ani dla nowego niezgodnego celu bez ponownego review.

---

## 1. Zakres kontroli

PL-C01 obejmuje co najmniej następujące procesy V3:

1. rejestracja i prowadzenie konta;
2. uwierzytelnianie, sesje, recovery i MFA;
3. rozgrywki, mecze i historia gry;
4. ranking i turnieje;
5. prywatne wiadomości i załączniki;
6. publiczny chat, reakcje i relacje social;
7. newsletter i komunikacja marketingowa;
8. moderacja, zgłoszenia, sankcje i odwołania;
9. audit, RBAC i historia działań uprzywilejowanych;
10. realizacja praw osób / privacy requests;
11. security telemetry, logi, traces i anti-abuse;
12. backup, restore i deletion replay.

Cele dla tych procesów zostały opisane w PL-E03 i muszą pozostawać zsynchronizowane z ROPA, privacy notice, retencją oraz implementacją.

---

## 2. Zasady purpose limitation

1. Każdy nowy proces lub nowe wykorzystanie danych wymaga jawnego celu przed rozpoczęciem przetwarzania.
2. Nie wolno rozszerzać istniejącego celu wyłącznie dlatego, że dane są już technicznie dostępne.
3. Zmiana celu wymaga co najmniej oceny zgodności, aktualizacji PL-E03, ROPA, privacy notice, retencji i — gdy właściwe — LIA/DPIA.
4. Dane opcjonalne profilu muszą mieć osobny, zrozumiały cel; nie mogą być wymagane bez potrzeby funkcjonalnej.
5. Dane security/anti-abuse nie mogą być wtórnie używane do marketingu, profilowania reklamowego ani niejawnej analityki behawioralnej.
6. Prywatne wiadomości i załączniki nie mogą być wtórnie wykorzystywane do trenowania modeli, reklamy lub ogólnej analityki treści bez odrębnego review i podstawy.
7. Audit i logi nie mogą stawać się alternatywną historią użytkownika ani magazynem danych „na wszelki wypadek”.
8. Backup służy recovery/continuity; nie jest dodatkowym celem biznesowym ani archiwum.
9. Legal hold nie tworzy nowego celu ogólnego — czasowo ogranicza purge wyłącznie dla konkretnego, udokumentowanego przypadku.
10. Dane po skutecznej anonimizacji mogą służyć celom statystycznym/replay wyłącznie, jeśli anonimowość jest rzeczywista i nie istnieje mapa zwrotna umożliwiająca reidentyfikację.

---

## 3. Niedozwolone domyślne cele

Bez odrębnej formalnej decyzji Privacy/Legal oraz aktualizacji dokumentacji nie są zatwierdzone:

- reklama behawioralna i profilowanie użytkowników;
- cross-site tracking;
- sprzedaż lub udostępnianie danych dla celów marketingowych partnerów;
- trenowanie modeli na prywatnych wiadomościach lub załącznikach;
- przetwarzanie danych szczególnych kategorii jako planowana funkcja;
- gromadzenie dokumentów tożsamości, biometrii lub dokładnej geolokalizacji;
- KYC, płatności real-money lub hazard;
- decyzje wywołujące istotne skutki wyłącznie automatycznie;
- wykorzystywanie security telemetry do celów innych niż bezpieczeństwo, diagnostyka i ściśle uzasadniony anti-abuse.

Dodanie któregokolwiek z tych celów wymaga nowego review i może uruchomić obowiązek LIA, DPIA, zmiany notice, nowych umów procesorskich lub odrębnej konsultacji prawnej.

---

## 4. Test kontroli

| Test | Wynik | Uzasadnienie |
|---|---|---|
| Każdy obecnie projektowany proces ma nazwany cel | `PASS` | PL-E03 zawiera jawne cele dla głównych domen V3 |
| Cele są rozdzielone od podstaw prawnych | `PASS` | cel jest dokumentowany niezależnie od tego, czy podstawa jest już finalnie zatwierdzona |
| Istnieje zakaz użycia danych dla nieokreślonego przyszłego celu | `PASS` | zasada jest jawnie ustanowiona w evidence i niniejszej kontroli |
| Nowy cel wymaga change-control | `PASS WITH CONDITIONS` | proces governance jest zdefiniowany dokumentacyjnie, ale nie ma jeszcze dowodu egzekwowania w produkcji |
| Prywatne wiadomości mają ograniczony cel funkcjonalny | `PASS WITH CONDITIONS` | komunikacja jest celem głównym; model dostępu moderacyjnego nadal wymaga materialnego domknięcia |
| Security telemetry ma ograniczony cel | `PASS WITH CONDITIONS` | cele bezpieczeństwa są określone, lecz finalny LIA i zakres telemetry pozostają otwarte |
| Newsletter nie może być warunkiem podstawowej usługi | `PASS` | marketing jest traktowany jako odrębny cel oparty projektowo na zgodzie |
| Backup nie stanowi odrębnego archiwalnego celu | `PASS` | PL-E15/PL-R09 ustanawiają continuity/recovery jako jedyny cel backupu |

---

## 5. Warunki pozostające otwarte

PL-C01 nie jest podstawą do zamknięcia innych kontroli. Nadal wymagane są m.in.:

- finalne rozstrzygnięcie podstaw prawnych w PL-C02;
- domknięcie LIA tam, gdzie używany jest art. 6(1)(f);
- pełna DPIA przed produkcją zgodnie z PL-E11;
- finalny model dostępu do prywatnych wiadomości/moderation evidence;
- weryfikacja providerów, DPA i transferów;
- synchronizacja finalnej privacy notice i ROPA z zatwierdzonymi celami;
- dowód, że implementacja nie wprowadza celów niewidocznych w dokumentacji.

---

## 6. Decyzja PL-C01

```text
PL-C01 = PASS WITH CONDITIONS

CONTROL = PURPOSE LIMITATION
DOCUMENTED PURPOSES FOR CURRENT V3 PROCESSES = YES
UNSPECIFIED FUTURE PURPOSE = NOT ALLOWED
NEW PURPOSE WITHOUT REVIEW = NOT ALLOWED
SECONDARY USE OF PRIVATE MESSAGES FOR AI/MARKETING = NOT APPROVED
SECONDARY USE OF SECURITY TELEMETRY FOR MARKETING = NOT APPROVED
BACKUP AS GENERAL ARCHIVE = NOT APPROVED
CHANGE-CONTROL FOR NEW PURPOSES = REQUIRED
IMPLEMENTATION EVIDENCE = NOT YET AVAILABLE
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
FREEZE = ACTIVE
```

`PASS WITH CONDITIONS` oznacza, że kontrola purpose limitation jest prawidłowo zdefiniowana i pokrywa obecny zakres projektu, ale pełny `PASS` operacyjny wymaga zgodności implementacji i końcowej synchronizacji dokumentów przed produkcją.

---

## 7. Granica autoryzacji

Utworzenie i zatwierdzenie kontrolne PL-C01:

- nie zatwierdza wszystkich podstaw prawnych;
- nie zamyka HOLD w PL-E08, PL-R03, PL-R06 ani PL-R07;
- nie zastępuje LIA ani DPIA;
- nie zatwierdza providerów lub transferów;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NOT READY`.
