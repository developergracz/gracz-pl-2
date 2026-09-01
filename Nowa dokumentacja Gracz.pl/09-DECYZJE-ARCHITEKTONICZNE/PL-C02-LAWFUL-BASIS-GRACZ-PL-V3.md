# Gracz.pl V3 — PL-C02 Lawful Basis

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — HOLD / VERSIONED CONTROL RECORD / FREEZE-SAFE**  
Control ID: `PL-C02`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E10`, `PL-E11`, `PL-E13`, `PL-E16`  
Powiązane decyzje retencyjne: `PL-R01`–`PL-R09`

> Kryterium PL-C02 wymaga, aby każdy cel przetwarzania miał zatwierdzoną podstawę prawną. Sama obecność projektowej mapy podstaw prawnych nie wystarcza do `PASS`, jeżeli część podstaw pozostaje oznaczona jako `PROPOSED`, `PENDING`, `LIA REQUIRED` albo wymaga dodatkowego review prawnego.

---

## 1. Kryterium kontroli

```text
PL-C02 PASS CRITERION =
EVERY PROCESSING PURPOSE HAS AN APPROVED LAWFUL BASIS
```

Kontrola obejmuje co najmniej:

- rejestrację i prowadzenie konta;
- uwierzytelnianie, sesje, recovery i MFA;
- gry, mecze, historię gry, ranking i turnieje;
- prywatne wiadomości i załączniki;
- publiczny chat i social;
- newsletter i komunikację marketingową;
- moderację, zgłoszenia, sankcje i odwołania;
- audit, RBAC i działania uprzywilejowane;
- realizację praw osób;
- security telemetry, logi, traces i anti-abuse;
- backup, restore i deletion replay.

---

## 2. Stan aktualny

Mapa `PL-E03` przypisuje projektowe podstawy prawne do procesów, ale część z nich pozostaje warunkowa albo nierozstrzygnięta.

| Obszar | Projektowa podstawa | Stan kontroli |
|---|---|---|
| konto i profil | art. 6(1)(b) — projektowo | `PASS WITH CONDITIONS CANDIDATE` |
| auth / MFA / security | art. 6(1)(b) + 6(1)(f) | `HOLD UNTIL LIA / scope approval` |
| gry / mecze / ranking / turnieje | art. 6(1)(b), częściowo 6(1)(f) | `PASS WITH CONDITIONS / LIA ALIGNMENT` |
| prywatne wiadomości | art. 6(1)(b) | `PASS WITH CONDITIONS` |
| publiczny chat / social | art. 6(1)(b) + 6(1)(f) | `HOLD FOR LIA / minors alignment` |
| newsletter | art. 6(1)(a) dla marketingu; proof po withdrawal — pending | `HOLD` |
| moderacja i sankcje | art. 6(1)(f) projektowo | `HOLD UNTIL LIA / proportionality closure` |
| audit / RBAC | art. 6(1)(f) projektowo; 6(1)(c) tylko przy konkretnej normie | `HOLD` |
| prawa osób | art. 6(1)(c) dla obowiązków RODO; proof/defence dodatkowo pending | `PASS WITH CONDITIONS / LEGAL REVIEW REQUIRED` |
| security telemetry | art. 6(1)(f), częściowo 6(1)(b) | `HOLD UNTIL LIA / minimization closure` |
| backup / restore | źródłowe podstawy danych + projektowo 6(1)(f) dla continuity | `PASS WITH CONDITIONS / provider + operational evidence open` |

---

## 3. Główne blokery

### PL-C02-B01 — podstawy 6(1)(f) nie są jeszcze globalnie zamknięte

LIA istnieje jako wersjonowany artefakt, ale kilka materialnych przypadków nadal wymaga ostatecznego rozstrzygnięcia zakresu i proporcjonalności, w szczególności:

- security telemetry;
- anti-cheat / anti-abuse;
- moderacja;
- dostęp moderacyjny do treści prywatnych wiadomości;
- audit i dłuższa retencja śladu uprzywilejowanego;
- proof/claims defence.

### PL-C02-B02 — newsletter i dowód zgody po withdrawal

Podstawa dla samej dobrowolnej komunikacji marketingowej jest projektowo oparta na zgodzie, natomiast retencja identyfikowalnego proof po unsubscribe/withdrawal nie jest jeszcze ostatecznie zatwierdzona.

### PL-C02-B03 — art. 6(1)(c) tylko przy wskazanym obowiązku

Nie wolno używać `art. 6(1)(c)` jako ogólnej podstawy „dla bezpieczeństwa” lub „dla dokumentacji”. Wymagany jest konkretny obowiązek prawny mający zastosowanie do administratora.

### PL-C02-B04 — okresy retencji HOLD wpływają na lawful-basis review

`PL-R03`, `PL-R06` i `PL-R07` zawierają materialne pozycje `HOLD`, w tym:

- 6 lat privacy request evidence;
- 6 lat consent proof;
- 24 miesiące identyfikowalnego unsubscribe record;
- maksymalnie 6 lat privileged audit / role history.

Jeżeli dłuższa retencja ma się opierać na innej podstawie niż przetwarzanie pierwotne, musi być jawnie określona i zaakceptowana.

---

## 4. Zasady obowiązkowe przed PASS

1. Każdy cel musi mieć jedną lub więcej jawnie zaakceptowanych podstaw prawnych.
2. Podstawa nie może być dobierana po fakcie dla uzasadnienia istniejącego przetwarzania.
3. Dla art. 6(1)(f) wymagany jest zamknięty LIA/balancing test dla danego materialnego procesu.
4. Dla art. 6(1)(a) wymagane są mechanizmy ważnej zgody i skutecznego withdrawal.
5. Dla art. 6(1)(c) wymagane jest wskazanie konkretnego obowiązku prawnego.
6. Nowy cel wymaga ponownej oceny podstawy, ROPA, privacy notice, retencji i DPIA/LIA tam, gdzie ma zastosowanie.
7. Podstawa prawna i retencja muszą być ze sobą spójne.
8. Podstawa przetwarzania nie autoryzuje automatycznie pełnego zakresu telemetry, moderacji, audit ani długiej retencji.

---

## 5. Decyzja kontroli

```text
PL-C02 = HOLD

LAWFUL-BASIS MAP EXISTS = YES
EVERY PURPOSE HAS CANDIDATE BASIS = SUBSTANTIALLY YES
EVERY MATERIAL BASIS FORMALLY APPROVED = NO
OPEN LIA-DEPENDENT AREAS = YES
NEWSLETTER PROOF BASIS = OPEN
CASE-SPECIFIC 6-YEAR RETENTION BASIS = OPEN
ARTICLE 6(1)(c) SPECIFIC-DUTY VALIDATION = OPEN WHERE USED
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
FREEZE = ACTIVE
```

`PL-C02` nie może przejść do `PASS` tylko dlatego, że mapa PL-E03 istnieje. Wymagane jest formalne domknięcie materialnych podstaw prawnych i powiązanych warunków.

---

## 6. Warunki zamknięcia

Pełny `PASS` dla PL-C02 wymaga co najmniej:

- zaakceptowania LIA dla wszystkich materialnych procesów opartych na art. 6(1)(f);
- zamknięcia modelu newsletter consent + proof;
- rozstrzygnięcia podstawy dla 6-letnich/24-miesięcznych pozycji pozostających w `HOLD`;
- potwierdzenia konkretnych obowiązków prawnych tam, gdzie używane jest 6(1)(c);
- synchronizacji z ROPA, privacy notice, retencją i finalnym decision record;
- braku otwartego P0/P1 dotyczącego podstaw prawnych.

---

## 7. Granica autoryzacji

Utworzenie PL-C02:

- nie stanowi opinii prawnej;
- nie zatwierdza automatycznie żadnej podstawy jako `FINAL`;
- nie uruchamia implementacji ani deploymentu;
- nie zmienia konfiguracji Render, bazy, providerów ani sekretów;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NOT READY` ani `Reviewed Design Gate = HOLD`.
